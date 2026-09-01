import { db, withTransaction, DbLike } from "../db/client";
import { crearNotificacionParaUnidad, enviarPushesDeNotificacion, GLS_TIPONOTIF_VISITA } from "./notificaciones.service";
import { verificarAlertaVetado } from "./vetados.service";

const GLS_ESTADO_DISPONIBLE = "Disponible";
const GLS_ESTADO_OCUPADO = "Ocupado";
const GLS_PERMISO_NORMAL = "Normal";
const GLS_PERMISO_DISCAPACITADO = "Discapacitado";
const GLS_PERMISO_PEATONAL = "Peatonal";
const GLS_TIPOEST_VISITA = "Visita";
const GLS_TIPOEST_DISCAPACITADO = "Discapacitado";
const GLS_TIPOVISITA_PEATONAL = "Peatonal";

function nowIso() {
  return new Date().toISOString();
}

async function getIdByGls(conn: DbLike, table: string, idColumn: string, glsColumn: string, valor: string): Promise<number> {
  const row = (await conn
    .prepare(`SELECT ${idColumn} as id FROM ${table} WHERE ${glsColumn} = ?`)
    .get(valor)) as { id: number } | undefined;
  if (!row) throw new Error(`No se encontró "${valor}" en ${table}. Revisa el seed de catálogos.`);
  return row.id;
}

export interface RegistrarEntradaInput {
  patente?: string;
  nombre_visita?: string;
  rut_visita?: string;
  tipo_visita_id_tipovisita: number;
  tipo_permiso_id_tipopermiso: number;
  condominio_id_condominio: number;
  unidad_id_unidad?: number;
  nombre_residente_visitado?: string;
  residente_visitado_usuario_id?: number;
  // Solo relevantes cuando el tipo de permiso es "Discapacitado":
  tipo_ocupante?: "Visita" | "Residente"; // default "Visita"
  carnet_discapacidad_confirmado?: boolean; // requerido si tipo_ocupante = "Visita"
  residente_usuario_id?: number; // requerido si tipo_ocupante = "Residente"
}

async function getVisitaConDetalle(conn: DbLike, idVisita: number) {
  return conn
    .prepare(
      `SELECT
         v.*,
         e.numero_estacionamiento,
         tv.gls_tipovisita,
         u.numero_unidad,
         tb.nombre_torre,
         tp.gls_tipopermiso,
         g.nombre_usuario as nombre_guardia_creador
       FROM visita v
       LEFT JOIN estacionamiento e ON e.id_estacionamiento = v.estacionamiento_id_estacionamiento
       JOIN tipo_visita tv ON tv.id_tipovisita = v.tipo_visita_id_tipovisita
       JOIN unidad u ON u.id_unidad = v.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = u.torre_block_id_torreblock
       JOIN tipo_permiso_visita tp ON tp.id_tipopermiso = v.tipo_permiso_id_tipopermiso
       JOIN usuario g ON g.id_usuario = v.usuario_id_usuario_creador
       WHERE v.id_visita = ?`
    )
    .get(idVisita);
}

/**
 * Registra la entrada de una visita peatonal: no ocupa cupo de
 * estacionamiento (no tiene auto), es gratis y puede estar el tiempo que
 * quiera dentro del condominio — por eso usa internamente el tipo de
 * permiso "Peatonal" (sin_limite_tiempo=1, monto_fijo=0), sin importar qué
 * haya mandado el cliente en tipo_permiso_id_tipopermiso. Se piden nombre
 * y apellidos, RUT, torre/depto, y a quién visita (misma regla anti-fraude
 * que la visita vehicular: si no coincide con un residente precargado
 * queda marcada residente_coincide=0 para revisión, pero igual se
 * registra).
 */
async function registrarEntradaPeatonal(conn: DbLike, input: RegistrarEntradaInput, guardiaId: number) {
  if (
    !input.nombre_visita ||
    !input.rut_visita ||
    !input.unidad_id_unidad ||
    !input.nombre_residente_visitado
  ) {
    throw new Error(
      "Faltan datos de la visita peatonal: nombre y apellidos, RUT, depto y a quién visita son obligatorios."
    );
  }

  const permisoPeatonalId = await getIdByGls(
    conn,
    "tipo_permiso_visita",
    "id_tipopermiso",
    "gls_tipopermiso",
    GLS_PERMISO_PEATONAL
  );

  let residenteCoincide = 0;
  if (input.residente_visitado_usuario_id) {
    const residente = await conn
      .prepare(`SELECT id_usuario FROM usuario WHERE id_usuario = ? AND unidad_id_unidad = ?`)
      .get(input.residente_visitado_usuario_id, input.unidad_id_unidad);
    residenteCoincide = residente ? 1 : 0;
  }

  const ahora = nowIso();

  const insert = await conn
    .prepare(
      `INSERT INTO visita
         (fecha_entrada, hora_entrada, patente, nombre_visita, rut_visita,
          tipo_ocupante, nombre_residente_visitado, residente_visitado_usuario_id, residente_coincide,
          carnet_discapacidad_confirmado, residente_discapacitado_id,
          tipo_visita_id_tipovisita, tipo_permiso_id_tipopermiso, condominio_id_condominio,
          unidad_id_unidad, estacionamiento_id_estacionamiento, usuario_id_usuario_creador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ahora,
      ahora,
      null,
      input.nombre_visita,
      input.rut_visita,
      "Visita",
      input.nombre_residente_visitado ?? null,
      input.residente_visitado_usuario_id ?? null,
      residenteCoincide,
      0,
      null,
      input.tipo_visita_id_tipovisita,
      permisoPeatonalId,
      input.condominio_id_condominio,
      input.unidad_id_unidad,
      null,
      guardiaId
    );

  const idVisita = Number(insert.lastInsertRowid);

  // Notificación al residente (ronda 16, a pedido del usuario: "las visitas
  // también deben llegarle como notificación al residente") — le llega a
  // todos los residentes activos con acceso de ese depto.
  const idNotificacion = await crearNotificacionParaUnidad(conn, {
    condominioId: input.condominio_id_condominio,
    unidadId: input.unidad_id_unidad!,
    tipoGls: GLS_TIPONOTIF_VISITA,
    titulo: "Visita registrada",
    cuerpo: `${input.nombre_visita} está ingresando a tu depto (visita peatonal).`,
    referenciaTipo: "visita",
    referenciaId: idVisita,
    creadoPorUsuarioId: guardiaId,
  });

  // Ronda 20: alerta VETADOS, solo informativa (nunca bloquea el registro).
  const alertaVetado = await verificarAlertaVetado(conn, input.condominio_id_condominio, input.rut_visita, input.patente);

  return {
    visita: await getVisitaConDetalle(conn, idVisita),
    cupoAsignado: false,
    residenteCoincide: !!residenteCoincide,
    cargoInmediato: null as any,
    idNotificacion,
    alertaVetado,
  };
}

/**
 * Registra el ingreso de una visita (o de un residente en un cupo de
 * discapacitados) y asigna un cupo disponible del pool correspondiente:
 * - Permiso "Discapacitado" -> pool de 3 cupos "Discapacitado" (sin
 *   límite de tiempo, sin cobro). Una visita externa requiere que el
 *   guardia confirme el carnet; un residente requiere estar registrado en
 *   residente_discapacitado por el administrador.
 * - Cualquier otro permiso -> pool de 11 cupos "Visita".
 *
 * Si el permiso es especial (12h/24h/fin de semana largo) genera de
 * inmediato el cobro fijo correspondiente.
 *
 * Si la visita es peatonal (tipo_visita = "Peatonal"), delega en
 * registrarEntradaPeatonal: no hay cupo que asignar.
 */
export async function registrarEntrada(input: RegistrarEntradaInput, guardiaId: number) {
  const resultado = await withTransaction(async (tx) => {
    const tipoVisita = (await tx
      .prepare(`SELECT gls_tipovisita FROM tipo_visita WHERE id_tipovisita = ? AND flg_vigencia = 1`)
      .get(input.tipo_visita_id_tipovisita)) as { gls_tipovisita: string } | undefined;
    if (!tipoVisita) throw new Error("Tipo de visita inválido.");

    if (tipoVisita.gls_tipovisita === GLS_TIPOVISITA_PEATONAL) {
      return registrarEntradaPeatonal(tx, input, guardiaId);
    }

    const estadoDisponibleId = await getIdByGls(
      tx,
      "estado_estacionamiento",
      "id_estadoestacionamiento",
      "gls_estadoestacionamiento",
      GLS_ESTADO_DISPONIBLE
    );
    const estadoOcupadoId = await getIdByGls(
      tx,
      "estado_estacionamiento",
      "id_estadoestacionamiento",
      "gls_estadoestacionamiento",
      GLS_ESTADO_OCUPADO
    );

    const tipoPermiso = (await tx
      .prepare(`SELECT * FROM tipo_permiso_visita WHERE id_tipopermiso = ? AND flg_vigencia = 1`)
      .get(input.tipo_permiso_id_tipopermiso)) as any | undefined;
    if (!tipoPermiso) throw new Error("Tipo de permiso inválido.");

    const esDiscapacitado = tipoPermiso.gls_tipopermiso === GLS_PERMISO_DISCAPACITADO;
    const tipoEstacionamientoBuscado = esDiscapacitado ? GLS_TIPOEST_DISCAPACITADO : GLS_TIPOEST_VISITA;
    const tipoEstacionamientoId = await getIdByGls(
      tx,
      "tipo_estacionamiento",
      "id_tipoestacionamiento",
      "gls_tipoestacionamiento",
      tipoEstacionamientoBuscado
    );

    // Datos que se arman distinto según quién ocupa el cupo.
    let tipoOcupante: "Visita" | "Residente" = "Visita";
    let nombreVisita = input.nombre_visita;
    let unidadId = input.unidad_id_unidad;
    let nombreResidenteVisitado: string | null = input.nombre_residente_visitado ?? null;
    let residenteVisitadoUsuarioId: number | null = input.residente_visitado_usuario_id ?? null;
    let residenteCoincide = 0;
    let carnetConfirmado = 0;
    let residenteDiscapacitadoId: number | null = null;

    if (esDiscapacitado && input.tipo_ocupante === "Residente") {
      tipoOcupante = "Residente";
      if (!input.residente_usuario_id) {
        throw new Error("Falta indicar qué residente va a usar el cupo de discapacitados.");
      }
      const registro = (await tx
        .prepare(
          `SELECT rd.id_residentediscapacitado, u.nombre_usuario, u.unidad_id_unidad
           FROM residente_discapacitado rd
           JOIN usuario u ON u.id_usuario = rd.usuario_id_usuario
           WHERE rd.usuario_id_usuario = ? AND rd.flg_vigencia = 1`
        )
        .get(input.residente_usuario_id)) as
        | { id_residentediscapacitado: number; nombre_usuario: string; unidad_id_unidad: number }
        | undefined;

      if (!registro) {
        throw new Error(
          "Este residente no está registrado con carnet de discapacidad. Debe registrarlo el administrador primero."
        );
      }

      residenteDiscapacitadoId = registro.id_residentediscapacitado;
      nombreVisita = registro.nombre_usuario;
      unidadId = registro.unidad_id_unidad;
      nombreResidenteVisitado = null;
      residenteVisitadoUsuarioId = null;
    } else {
      // Visita normal, o visita externa usando un cupo de discapacitados.
      if (!nombreVisita || !unidadId || !nombreResidenteVisitado) {
        throw new Error(
          "Faltan datos de la visita: nombre, unidad y a quién visita son obligatorios."
        );
      }
      if (esDiscapacitado && !input.carnet_discapacidad_confirmado) {
        throw new Error("Debes confirmar que revisaste el carnet de discapacidad de la visita.");
      }
      if (esDiscapacitado) carnetConfirmado = 1;

      if (residenteVisitadoUsuarioId) {
        const residente = await tx
          .prepare(`SELECT id_usuario FROM usuario WHERE id_usuario = ? AND unidad_id_unidad = ?`)
          .get(residenteVisitadoUsuarioId, unidadId);
        residenteCoincide = residente ? 1 : 0;
      }
    }

    const cupo = (await tx
      .prepare(
        `SELECT id_estacionamiento FROM estacionamiento
         WHERE condominio_id_condominio = ?
           AND tipo_estacionamiento_id_tipoestacionamiento = ?
           AND estado_estacionamiento_id_estadoestacionamiento = ?
         ORDER BY numero_estacionamiento ASC
         LIMIT 1`
      )
      .get(input.condominio_id_condominio, tipoEstacionamientoId, estadoDisponibleId)) as
      | { id_estacionamiento: number }
      | undefined;

    const ahora = nowIso();

    const insert = await tx
      .prepare(
        `INSERT INTO visita
           (fecha_entrada, hora_entrada, patente, nombre_visita, rut_visita,
            tipo_ocupante, nombre_residente_visitado, residente_visitado_usuario_id, residente_coincide,
            carnet_discapacidad_confirmado, residente_discapacitado_id,
            tipo_visita_id_tipovisita, tipo_permiso_id_tipopermiso, condominio_id_condominio,
            unidad_id_unidad, estacionamiento_id_estacionamiento, usuario_id_usuario_creador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ahora,
        ahora,
        input.patente ?? null,
        nombreVisita,
        input.rut_visita ?? null,
        tipoOcupante,
        nombreResidenteVisitado,
        residenteVisitadoUsuarioId,
        residenteCoincide,
        carnetConfirmado,
        residenteDiscapacitadoId,
        input.tipo_visita_id_tipovisita,
        input.tipo_permiso_id_tipopermiso,
        input.condominio_id_condominio,
        unidadId,
        cupo?.id_estacionamiento ?? null,
        guardiaId
      );

    const idVisita = Number(insert.lastInsertRowid);

    if (cupo) {
      await tx
        .prepare(
          `UPDATE estacionamiento SET estado_estacionamiento_id_estadoestacionamiento = ? WHERE id_estacionamiento = ?`
        )
        .run(estadoOcupadoId, cupo.id_estacionamiento);
    }

    let cargoInmediato: any = null;
    if (tipoPermiso.gls_tipopermiso !== GLS_PERMISO_NORMAL && tipoPermiso.monto_fijo > 0) {
      const insertCargo = await tx
        .prepare(
          `INSERT INTO constancia_exceso_tiempo (fecha_movimiento, hora_movimiento, concepto, minutos_extras, monto_cobrar, visita_id_visita)
           VALUES (?, ?, ?, NULL, ?, ?)`
        )
        .run(ahora, ahora, `Permiso ${tipoPermiso.gls_tipopermiso}`, tipoPermiso.monto_fijo, idVisita);
      cargoInmediato = await tx
        .prepare(`SELECT * FROM constancia_exceso_tiempo WHERE id_constancia = ?`)
        .get(Number(insertCargo.lastInsertRowid));
    }

    // Notificación al residente (ronda 16) — solo cuando es una visita de
    // verdad (tipoOcupante === "Visita"); si es un residente usando el cupo
    // de discapacitados a nombre propio, no hay "visita" que avisar.
    let idNotificacion: number | null = null;
    if (tipoOcupante === "Visita") {
      idNotificacion = await crearNotificacionParaUnidad(tx, {
        condominioId: input.condominio_id_condominio,
        unidadId: unidadId!,
        tipoGls: GLS_TIPONOTIF_VISITA,
        titulo: "Visita registrada",
        cuerpo: `${nombreVisita} está ingresando a tu depto.`,
        referenciaTipo: "visita",
        referenciaId: idVisita,
        creadoPorUsuarioId: guardiaId,
      });
    }

    // Ronda 20: alerta VETADOS, solo informativa (nunca bloquea el
    // registro) — se revisa tanto el RUT de la visita como su patente, si
    // viene. Cuando el ocupante es un residente en cupo de discapacitado
    // (tipoOcupante === "Residente") no hay RUT de visita que chequear.
    const alertaVetado =
      tipoOcupante === "Visita"
        ? await verificarAlertaVetado(tx, input.condominio_id_condominio, input.rut_visita, input.patente)
        : null;

    return {
      visita: await getVisitaConDetalle(tx, idVisita),
      cupoAsignado: !!cupo,
      residenteCoincide: !!residenteCoincide,
      cargoInmediato,
      idNotificacion,
      alertaVetado,
    };
  });

  await enviarPushesDeNotificacion(resultado.idNotificacion);
  const { idNotificacion, ...respuestaPublica } = resultado as any;
  return respuestaPublica;
}

/**
 * Registra la salida y libera el cupo. Si el permiso es "Normal", calcula
 * el exceso de tiempo (tras las 6 horas gratis, $60 por minuto). Los
 * permisos especiales (12h/24h/fin de semana largo) no generan cobro
 * adicional acá porque ya se cobraron completos al momento de la entrada.
 * El permiso "Discapacitado" nunca genera cobro ni tiene límite de tiempo:
 * el cupo se libera recién cuando la visita/residente se retira.
 */
export async function registrarSalida(idVisita: number) {
  return withTransaction(async (tx) => {
    const visita = (await tx
      .prepare(
        `SELECT v.*, tp.gls_tipopermiso, tp.tiempo_gratis_minutos, tp.tarifa_por_minuto_extra
         FROM visita v
         JOIN tipo_permiso_visita tp ON tp.id_tipopermiso = v.tipo_permiso_id_tipopermiso
         WHERE v.id_visita = ?`
      )
      .get(idVisita)) as any | undefined;

    if (!visita) throw new Error(`No existe la visita ${idVisita}.`);
    if (visita.fecha_salida) throw new Error("Esta visita ya tiene registrada su salida.");

    const estadoDisponibleId = await getIdByGls(
      tx,
      "estado_estacionamiento",
      "id_estadoestacionamiento",
      "gls_estadoestacionamiento",
      GLS_ESTADO_DISPONIBLE
    );

    const ahora = nowIso();

    await tx.prepare(`UPDATE visita SET fecha_salida = ?, hora_salida = ? WHERE id_visita = ?`).run(
      ahora,
      ahora,
      idVisita
    );

    if (visita.estacionamiento_id_estacionamiento) {
      await tx
        .prepare(
          `UPDATE estacionamiento SET estado_estacionamiento_id_estadoestacionamiento = ? WHERE id_estacionamiento = ?`
        )
        .run(estadoDisponibleId, visita.estacionamiento_id_estacionamiento);
    }

    let constancia: any = null;
    if (visita.gls_tipopermiso === GLS_PERMISO_NORMAL) {
      const minutosEstacionado = Math.round(
        (new Date(ahora).getTime() - new Date(visita.fecha_entrada).getTime()) / 60000
      );
      const minutosExtras = minutosEstacionado - visita.tiempo_gratis_minutos;

      if (minutosExtras > 0) {
        const montoCobrar = minutosExtras * visita.tarifa_por_minuto_extra;
        const insert = await tx
          .prepare(
            `INSERT INTO constancia_exceso_tiempo (fecha_movimiento, hora_movimiento, concepto, minutos_extras, monto_cobrar, visita_id_visita)
             VALUES (?, ?, 'Exceso de tiempo', ?, ?, ?)`
          )
          .run(ahora, ahora, minutosExtras, montoCobrar, idVisita);
        constancia = await tx
          .prepare(`SELECT * FROM constancia_exceso_tiempo WHERE id_constancia = ?`)
          .get(Number(insert.lastInsertRowid));
      }
    }

    return { visita: await getVisitaConDetalle(tx, idVisita), constancia };
  });
}

export async function listarDisponibilidad(condominioId: number) {
  return db
    .prepare(
      `SELECT
         e.*,
         te.gls_tipoestacionamiento,
         ee.gls_estadoestacionamiento,
         v.id_visita as visita_activa_id,
         v.nombre_visita as visita_activa_nombre,
         v.patente as visita_activa_patente,
         v.fecha_entrada as visita_activa_fecha_entrada
       FROM estacionamiento e
       JOIN estado_estacionamiento ee ON ee.id_estadoestacionamiento = e.estado_estacionamiento_id_estadoestacionamiento
       JOIN tipo_estacionamiento te ON te.id_tipoestacionamiento = e.tipo_estacionamiento_id_tipoestacionamiento
       LEFT JOIN visita v ON v.estacionamiento_id_estacionamiento = e.id_estacionamiento AND v.fecha_salida IS NULL
       WHERE e.condominio_id_condominio = ? AND te.gls_tipoestacionamiento IN ('Visita', 'Discapacitado')
       ORDER BY te.gls_tipoestacionamiento DESC, e.numero_estacionamiento ASC`
    )
    .all(condominioId);
}

export async function listarVisitasActivas(condominioId: number) {
  return db
    .prepare(
      `SELECT
         v.*,
         e.numero_estacionamiento,
         tv.gls_tipovisita,
         u.numero_unidad,
         tb.nombre_torre,
         tp.gls_tipopermiso,
         g.nombre_usuario as nombre_guardia_creador
       FROM visita v
       LEFT JOIN estacionamiento e ON e.id_estacionamiento = v.estacionamiento_id_estacionamiento
       JOIN tipo_visita tv ON tv.id_tipovisita = v.tipo_visita_id_tipovisita
       JOIN unidad u ON u.id_unidad = v.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = u.torre_block_id_torreblock
       JOIN tipo_permiso_visita tp ON tp.id_tipopermiso = v.tipo_permiso_id_tipopermiso
       JOIN usuario g ON g.id_usuario = v.usuario_id_usuario_creador
       WHERE v.condominio_id_condominio = ? AND v.fecha_salida IS NULL
       ORDER BY v.fecha_entrada ASC`
    )
    .all(condominioId);
}
