import { db, withTransaction, DbLike } from "../db/client";
import { guardarImagenBase64 } from "../utils/imagenes";
import {
  crearNotificacionParaUnidad,
  enviarPushesDeNotificacion,
  GLS_TIPONOTIF_PAQUETE_RECIBIDO,
  GLS_TIPONOTIF_PAQUETE_EN_PORTERIA,
  GLS_TIPONOTIF_PAQUETE_ALERTA_7DIAS,
} from "./notificaciones.service";

export const GLS_ESTADO_RECEPCIONADO = "Recepcionado";
export const GLS_ESTADO_NOTIFICADO = "Notificado";
export const GLS_ESTADO_EN_PORTERIA = "En portería";
export const GLS_ESTADO_ENTREGADO = "Entregado a residente";
export const GLS_ESTADO_RECHAZADO = "Rechazado por el residente";
export const GLS_ESTADO_DEVUELTO = "Devuelto al remitente";
export const GLS_ESTADO_PERDIDO = "Perdido";
const GLS_TIPO_PAQUETE_DEFAULT = "Bulto";

// Estados que se pueden setear a mano desde /paquetes/:id/estado. La
// entrega ("Entregado a residente") tiene su propio endpoint porque exige
// firma siempre, y foto de quien retira cuando no es la persona a la que
// venía dirigido el paquete (ver registrarEntrega).
const ESTADOS_MANUALES = [
  GLS_ESTADO_NOTIFICADO,
  GLS_ESTADO_EN_PORTERIA,
  GLS_ESTADO_RECHAZADO,
  GLS_ESTADO_DEVUELTO,
  GLS_ESTADO_PERDIDO,
];

const DIAS_ALERTA_SIN_RETIRAR = 7;

function nowIso() {
  return new Date().toISOString();
}

async function getIdByGls(
  conn: DbLike,
  table: string,
  idColumn: string,
  glsColumn: string,
  valor: string,
  condominioId: number
): Promise<number> {
  const row = (await conn
    .prepare(`SELECT ${idColumn} as id FROM ${table} WHERE ${glsColumn} = ? AND condominio_id_condominio = ?`)
    .get(valor, condominioId)) as { id: number } | undefined;
  if (!row) throw new Error(`No se encontró "${valor}" en ${table} para este condominio.`);
  return row.id;
}

async function getPaqueteConDetalle(conn: DbLike, idPaquete: number) {
  return conn
    .prepare(
      `SELECT
         p.*,
         tp.gls_tipopaquete,
         ep.gls_estadopaquete,
         u.numero_unidad,
         tb.nombre_torre,
         gc.nombre_usuario as nombre_guardia_creador,
         ge.nombre_usuario as nombre_guardia_entrega
       FROM paquete p
       JOIN tipo_paquete tp ON tp.id_tipopaquete = p.tipo_paquete_id_tipopaquete
       JOIN estado_paquete ep ON ep.id_estadopaquete = p.estado_paquete_id_estadopaquete
       JOIN unidad u ON u.id_unidad = p.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = u.torre_block_id_torreblock
       JOIN usuario gc ON gc.id_usuario = p.usuario_id_usuario_creador
       LEFT JOIN usuario ge ON ge.id_usuario = p.usuario_id_usuario_entrega
       WHERE p.id_paquete = ?`
    )
    .get(idPaquete);
}

export interface RegistrarLlegadaInput {
  unidad_id_unidad: number;
  nombre_receptor: string;
  residente_receptor_usuario_id?: number;
  rut_receptor?: string;
  tipo_paquete_id_tipopaquete?: number;
  foto_recepcion: string; // data URL base64
  condominio_id_condominio: number;
}

/**
 * Registra la llegada de un paquete a conserjería. Solo lo puede hacer un
 * guardia/conserje (ver requireAuth en la ruta — cualquier usuario logeado
 * puede, no hay perfil "conserje" separado de "Guardia" en este MVP).
 *
 * La foto es obligatoria (para dejar constancia del estado en que llegó).
 * El tipo de paquete es opcional: si no se manda, queda "Bulto" por
 * defecto. Queda en estado "Recepcionado".
 */
export async function registrarLlegada(input: RegistrarLlegadaInput, guardiaId: number) {
  const resultado = await withTransaction(async (tx) => {
    if (!input.unidad_id_unidad || !input.nombre_receptor || !input.foto_recepcion) {
      throw new Error(
        "Faltan datos del paquete: depto (unidad_id_unidad), a quién viene dirigido (nombre_receptor) y la foto de recepción son obligatorios."
      );
    }

    const tipoId =
      input.tipo_paquete_id_tipopaquete ??
      (await getIdByGls(tx, "tipo_paquete", "id_tipopaquete", "gls_tipopaquete", GLS_TIPO_PAQUETE_DEFAULT, input.condominio_id_condominio));
    const estadoRecepcionadoId = await getIdByGls(
      tx,
      "estado_paquete",
      "id_estadopaquete",
      "gls_estadopaquete",
      GLS_ESTADO_RECEPCIONADO,
      input.condominio_id_condominio
    );

    let receptorCoincide = 0;
    if (input.residente_receptor_usuario_id) {
      const residente = await tx
        .prepare(`SELECT id_usuario FROM usuario WHERE id_usuario = ? AND unidad_id_unidad = ?`)
        .get(input.residente_receptor_usuario_id, input.unidad_id_unidad);
      receptorCoincide = residente ? 1 : 0;
    }

    const fotoUrl = await guardarImagenBase64(input.foto_recepcion, "recepcion");
    const ahora = nowIso();

    const insert = await tx
      .prepare(
        `INSERT INTO paquete
           (fecha_recepcion, hora_recepcion, nombre_receptor, residente_receptor_usuario_id, receptor_coincide,
            rut_receptor, foto_recepcion_url, tipo_paquete_id_tipopaquete, estado_paquete_id_estadopaquete,
            unidad_id_unidad, condominio_id_condominio, usuario_id_usuario_creador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ahora,
        ahora,
        input.nombre_receptor,
        input.residente_receptor_usuario_id ?? null,
        receptorCoincide,
        input.rut_receptor ?? null,
        fotoUrl,
        tipoId,
        estadoRecepcionadoId,
        input.unidad_id_unidad,
        input.condominio_id_condominio,
        guardiaId
      );

    const idPaquete = Number(insert.lastInsertRowid);

    // Notificación al residente (ronda 16, a pedido del usuario): le llega
    // a TODOS los residentes activos con acceso de ese depto, no solo a
    // quien coincidió con el nombre del receptor.
    const idNotificacion = await crearNotificacionParaUnidad(tx, {
      condominioId: input.condominio_id_condominio,
      unidadId: input.unidad_id_unidad,
      tipoGls: GLS_TIPONOTIF_PAQUETE_RECIBIDO,
      titulo: "Nuevo paquete",
      cuerpo: `Llegó un paquete a tu depto, dirigido a ${input.nombre_receptor}.`,
      referenciaTipo: "paquete",
      referenciaId: idPaquete,
      creadoPorUsuarioId: guardiaId,
    });

    return { paquete: await getPaqueteConDetalle(tx, idPaquete), receptorCoincide: !!receptorCoincide, idNotificacion };
  });

  // El push real (llamada de red a Expo) se manda DESPUÉS del commit, nunca
  // dentro de la transacción — ver la nota en notificaciones.service.ts.
  await enviarPushesDeNotificacion(resultado.idNotificacion);
  const { idNotificacion, ...respuestaPublica } = resultado;
  return respuestaPublica;
}

/**
 * Cambia el estado de un paquete a mano: "Notificado" (el guardia avisó,
 * hoy por WhatsApp fuera del sistema — cuando exista el módulo de
 * notificaciones push con login de residentes esto se automatiza),
 * "En portería" (sigue esperando que lo retiren), o a uno de los estados
 * de excepción: "Rechazado por el residente", "Devuelto al remitente",
 * "Perdido" (conviene dejar `observacion` con el motivo).
 *
 * No se usa para marcar la entrega — eso es registrarEntrega(), porque
 * exige firma y a veces foto.
 */
export async function cambiarEstado(idPaquete: number, nuevoEstadoGls: string, observacion: string | undefined, condominioId: number) {
  const resultado = await withTransaction(async (tx) => {
    if (!ESTADOS_MANUALES.includes(nuevoEstadoGls)) {
      throw new Error(
        `Estado "${nuevoEstadoGls}" inválido. Debe ser uno de: ${ESTADOS_MANUALES.join(", ")}. Para marcar la entrega usa el endpoint de entrega.`
      );
    }

    const paquete = (await tx.prepare(`SELECT * FROM paquete WHERE id_paquete = ?`).get(idPaquete)) as any;
    if (!paquete) throw new Error(`No existe el paquete ${idPaquete}.`);
    // Ronda 44, a pedido explícito del usuario (revisión de seguridad —
    // IDOR): antes `condominioId` llegaba a esta función pero nunca se
    // usaba para verificar que ESTE paquete fuera de ese condominio — un
    // guardia de un condominio podía cambiar el estado de un paquete de
    // OTRO condominio con solo adivinar el id.
    if (paquete.condominio_id_condominio !== condominioId) {
      throw new Error(`No existe el paquete ${idPaquete}.`);
    }
    if (paquete.fecha_entrega) {
      throw new Error("Este paquete ya fue entregado; no se puede cambiar su estado.");
    }

    const nuevoEstadoId = await getIdByGls(tx, "estado_paquete", "id_estadopaquete", "gls_estadopaquete", nuevoEstadoGls, condominioId);

    await tx
      .prepare(
        `UPDATE paquete SET estado_paquete_id_estadopaquete = ?, observaciones = COALESCE(?, observaciones) WHERE id_paquete = ?`
      )
      .run(nuevoEstadoId, observacion ?? null, idPaquete);

    // Ronda 16: cuando el guardia marca "En portería" se avisa al depto
    // (ya está listo para retirar). El paso "Notificado" no dispara un
    // segundo aviso aparte, para no duplicar el que ya se mandó al recibir
    // el paquete (ver registrarLlegada) — ver "Supuestos" en el README.
    let idNotificacion: number | null = null;
    if (nuevoEstadoGls === GLS_ESTADO_EN_PORTERIA) {
      idNotificacion = await crearNotificacionParaUnidad(tx, {
        condominioId,
        unidadId: paquete.unidad_id_unidad,
        tipoGls: GLS_TIPONOTIF_PAQUETE_EN_PORTERIA,
        titulo: "Paquete en portería",
        cuerpo: `Tu paquete (dirigido a ${paquete.nombre_receptor}) ya está en portería, puedes retirarlo.`,
        referenciaTipo: "paquete",
        referenciaId: idPaquete,
      });
    }

    return { paquete: await getPaqueteConDetalle(tx, idPaquete), idNotificacion };
  });

  await enviarPushesDeNotificacion(resultado.idNotificacion);
  return resultado.paquete;
}

export interface RegistrarEntregaInput {
  entregado_a: string;
  firma_retiro: string; // data URL base64, siempre obligatoria
  foto_retiro?: string; // data URL base64, obligatoria solo si entregado_a distinto del receptor
}

/**
 * Registra la entrega del paquete. Firma siempre obligatoria (hoy se firma
 * un cuaderno físico; acá queda la firma digital). Si quien retira es la
 * misma persona a la que venía dirigido el paquete, no se pide foto; si es
 * otra persona, además de la firma se exige registrar su nombre y una
 * foto de quien retira.
 */
export async function registrarEntrega(idPaquete: number, input: RegistrarEntregaInput, guardiaId: number, condominioId: number) {
  return withTransaction(async (tx) => {
    if (!input.entregado_a || !input.entregado_a.trim()) {
      throw new Error("Falta el nombre de quién retira el paquete.");
    }
    if (!input.firma_retiro) {
      throw new Error("La firma de quien retira es obligatoria para registrar la entrega.");
    }

    const paquete = (await tx.prepare(`SELECT * FROM paquete WHERE id_paquete = ?`).get(idPaquete)) as any;
    if (!paquete) throw new Error(`No existe el paquete ${idPaquete}.`);
    // Ronda 44, a pedido explícito del usuario (revisión de seguridad —
    // IDOR): mismo caso que cambiarEstado — sin este chequeo, un guardia
    // podía registrar la entrega de un paquete de OTRO condominio.
    if (paquete.condominio_id_condominio !== condominioId) {
      throw new Error(`No existe el paquete ${idPaquete}.`);
    }
    if (paquete.fecha_entrega) throw new Error("Este paquete ya fue entregado anteriormente.");

    const mismaPersona =
      input.entregado_a.trim().toLowerCase() === String(paquete.nombre_receptor).trim().toLowerCase();

    if (!mismaPersona && !input.foto_retiro) {
      throw new Error(
        "Quien retira no es la persona a la que venía dirigido el paquete: la foto de quien retira es obligatoria en ese caso."
      );
    }

    const firmaUrl = await guardarImagenBase64(input.firma_retiro, "firma");
    const fotoRetiroUrl = input.foto_retiro ? await guardarImagenBase64(input.foto_retiro, "retiro") : null;
    const estadoEntregadoId = await getIdByGls(
      tx,
      "estado_paquete",
      "id_estadopaquete",
      "gls_estadopaquete",
      GLS_ESTADO_ENTREGADO,
      condominioId
    );
    const ahora = nowIso();

    await tx
      .prepare(
        `UPDATE paquete SET
           fecha_entrega = ?, hora_entrega = ?, entregado_a = ?,
           firma_retiro_url = ?, foto_retiro_url = ?,
           estado_paquete_id_estadopaquete = ?, usuario_id_usuario_entrega = ?
         WHERE id_paquete = ?`
      )
      .run(ahora, ahora, input.entregado_a.trim(), firmaUrl, fotoRetiroUrl, estadoEntregadoId, guardiaId, idPaquete);

    return getPaqueteConDetalle(tx, idPaquete);
  });
}

/**
 * Paquetes que todavía no se retiran (Recepcionado, Notificado o En
 * portería) — lo que ve el guardia como "lo que hay guardado" y lo que el
 * administrador/comité usan para la alerta de 7 días sin retirar (no hay
 * módulo de notificaciones push todavía, así que por ahora la "alerta" es
 * este flag visual — `alerta7dias` — en vez de un aviso automático).
 */
export async function listarPendientes(condominioId: number) {
  const rows = (await db
    .prepare(
      `SELECT
         p.*,
         tp.gls_tipopaquete,
         ep.gls_estadopaquete,
         u.numero_unidad,
         tb.nombre_torre,
         gc.nombre_usuario as nombre_guardia_creador
       FROM paquete p
       JOIN tipo_paquete tp ON tp.id_tipopaquete = p.tipo_paquete_id_tipopaquete
       JOIN estado_paquete ep ON ep.id_estadopaquete = p.estado_paquete_id_estadopaquete
       JOIN unidad u ON u.id_unidad = p.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = u.torre_block_id_torreblock
       JOIN usuario gc ON gc.id_usuario = p.usuario_id_usuario_creador
       WHERE p.condominio_id_condominio = ?
         AND ep.gls_estadopaquete IN (?, ?, ?)
       ORDER BY p.fecha_recepcion ASC`
    )
    .all(condominioId, GLS_ESTADO_RECEPCIONADO, GLS_ESTADO_NOTIFICADO, GLS_ESTADO_EN_PORTERIA)) as any[];

  const ahora = Date.now();
  const resultado: any[] = [];
  for (const p of rows) {
    const diasPendiente = Math.floor((ahora - new Date(p.fecha_recepcion).getTime()) / 86400000);
    const alerta7dias = diasPendiente >= DIAS_ALERTA_SIN_RETIRAR;

    // La alerta de 7 días se recalcula perezosa (mismo patrón que la
    // expiración de reservas — ver reservas.service.ts): se dispara UNA
    // sola vez por paquete, la primera vez que este listado se consulta
    // después de cruzar los 7 días, marcando alerta7dias_notificada para no
    // repetirla en cada consulta siguiente.
    if (alerta7dias && !p.alerta7dias_notificada) {
      const idNotificacion = await crearNotificacionParaUnidad(db, {
        condominioId,
        unidadId: p.unidad_id_unidad,
        tipoGls: GLS_TIPONOTIF_PAQUETE_ALERTA_7DIAS,
        titulo: "Paquete sin retirar",
        cuerpo: `Llevas ${diasPendiente} días sin retirar un paquete (dirigido a ${p.nombre_receptor}) de portería.`,
        referenciaTipo: "paquete",
        referenciaId: p.id_paquete,
      });
      await db.prepare(`UPDATE paquete SET alerta7dias_notificada = 1 WHERE id_paquete = ?`).run(p.id_paquete);
      await enviarPushesDeNotificacion(idNotificacion);
    }

    resultado.push({ ...p, diasPendiente, alerta7dias });
  }
  return resultado;
}

export interface BuscarPaquetesFiltro {
  condominioId: number;
  fechaInicio?: string; // YYYY-MM-DD
  fechaTermino?: string; // YYYY-MM-DD
  q?: string; // busca en nombre_receptor o rut_receptor
  unidadId?: number;
  estadoGls?: string;
}

/**
 * Búsqueda flexible por rango de fecha de recepción, nombre/RUT del
 * receptor, depto o estado — para la auditoría del administrador/comité
 * (todos los deptos) y la consulta del guardia (todos, incluyendo ya
 * entregados). También es la base de la vista "mis paquetes" del residente
 * (con `unidadId` fijado server-side, ver paquetes.ts).
 */
export async function buscarPaquetes(filtro: BuscarPaquetesFiltro) {
  const condiciones = ["p.condominio_id_condominio = ?"];
  const params: unknown[] = [filtro.condominioId];

  if (filtro.fechaInicio) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filtro.fechaInicio)) throw new Error("fecha_inicio debe tener formato YYYY-MM-DD.");
    condiciones.push("p.fecha_recepcion >= ?");
    params.push(`${filtro.fechaInicio}T00:00:00.000`);
  }
  if (filtro.fechaTermino) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filtro.fechaTermino)) throw new Error("fecha_termino debe tener formato YYYY-MM-DD.");
    condiciones.push("p.fecha_recepcion <= ?");
    params.push(`${filtro.fechaTermino}T23:59:59.999`);
  }
  if (filtro.fechaInicio && filtro.fechaTermino && filtro.fechaInicio > filtro.fechaTermino) {
    throw new Error("fecha_inicio no puede ser posterior a fecha_termino.");
  }
  if (filtro.q) {
    condiciones.push("(p.nombre_receptor LIKE ? OR p.rut_receptor LIKE ?)");
    params.push(`%${filtro.q}%`, `%${filtro.q}%`);
  }
  if (filtro.unidadId) {
    condiciones.push("p.unidad_id_unidad = ?");
    params.push(filtro.unidadId);
  }
  if (filtro.estadoGls) {
    condiciones.push("ep.gls_estadopaquete = ?");
    params.push(filtro.estadoGls);
  }

  return db
    .prepare(
      `SELECT
         p.*,
         tp.gls_tipopaquete,
         ep.gls_estadopaquete,
         u.numero_unidad,
         tb.nombre_torre,
         gc.nombre_usuario as nombre_guardia_creador,
         ge.nombre_usuario as nombre_guardia_entrega
       FROM paquete p
       JOIN tipo_paquete tp ON tp.id_tipopaquete = p.tipo_paquete_id_tipopaquete
       JOIN estado_paquete ep ON ep.id_estadopaquete = p.estado_paquete_id_estadopaquete
       JOIN unidad u ON u.id_unidad = p.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = u.torre_block_id_torreblock
       JOIN usuario gc ON gc.id_usuario = p.usuario_id_usuario_creador
       LEFT JOIN usuario ge ON ge.id_usuario = p.usuario_id_usuario_entrega
       WHERE ${condiciones.join(" AND ")}
       ORDER BY p.fecha_recepcion DESC`
    )
    .all(...(params as any[]));
}

export async function getPaquete(idPaquete: number) {
  const paquete = await getPaqueteConDetalle(db, idPaquete);
  if (!paquete) throw new Error(`No existe el paquete ${idPaquete}.`);
  return paquete;
}
