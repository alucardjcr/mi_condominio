import { db, withTransaction, DbLike } from "../db/client";

// ---------------------------------------------------------------------------
// Reservas de Espacios Comunes (ronda 14). Reglas de negocio completas en
// el documento del proyecto (sección "Módulo Reservas de Espacios
// Comunes"). A diferencia de estacionamientos/paquetería, acá SÍ se usa
// aritmética real de fechas/horas de MySQL (columnas DATE/TIME/DATETIME en
// vez de VARCHAR) — ver la nota al principio de docs/schema-mysql.sql.
// ---------------------------------------------------------------------------

const ESTADOS = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  RESERVADO: "Reservado",
  EN_USO: "En uso",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
} as const;

const ESTADOS_QUE_BLOQUEAN_HORARIO = [ESTADOS.PENDIENTE, ESTADOS.APROBADO, ESTADOS.RESERVADO, ESTADOS.EN_USO];

async function getEstadoId(conn: DbLike, gls: string): Promise<number> {
  const row = (await conn.prepare(`SELECT id_estadoreserva FROM estado_reserespaciocomun WHERE gls_estadoreserva = ?`).get(gls)) as
    | { id_estadoreserva: number }
    | undefined;
  if (!row) throw new Error(`Estado de reserva "${gls}" no existe (revisa el seed).`);
  return row.id_estadoreserva;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatFecha(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatDateTime(d: Date) {
  return `${formatFecha(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Catálogos / configuración de espacios (CRUD administrador+comité)
// ---------------------------------------------------------------------------

export async function listarTiposEspacioComun(condominioId: number) {
  return db
    .prepare(
      `SELECT id_tipoespaciocomun, gls_tipoespaciocomun FROM tipo_espaciocomun WHERE condominio_id_condominio = ? AND flg_vigencia = 1 ORDER BY gls_tipoespaciocomun`
    )
    .all(condominioId);
}

export async function listarEspacios(condominioId: number, incluirInactivos = false) {
  const base = `SELECT e.*, t.gls_tipoespaciocomun
                FROM espacio_comun e
                JOIN tipo_espaciocomun t ON t.id_tipoespaciocomun = e.tipo_espaciocomun_id_tipoespaciocomun
                WHERE e.condominio_id_condominio = ?`;
  if (incluirInactivos) {
    return db.prepare(`${base} ORDER BY e.nombre`).all(condominioId);
  }
  return db.prepare(`${base} AND e.flg_vigencia = 1 ORDER BY e.nombre`).all(condominioId);
}

export async function getEspacio(id: number) {
  const espacio = await db
    .prepare(
      `SELECT e.*, t.gls_tipoespaciocomun FROM espacio_comun e
       JOIN tipo_espaciocomun t ON t.id_tipoespaciocomun = e.tipo_espaciocomun_id_tipoespaciocomun
       WHERE e.id_espaciocomun = ?`
    )
    .get(id);
  if (!espacio) throw new Error("No existe ese espacio común.");
  return espacio;
}

export interface EspacioComunInput {
  nombre: string;
  tipo_espaciocomun_id_tipoespaciocomun: number;
  condominio_id_condominio: number;
  capacidad?: number | null;
  flg_reservable: number;
  flg_gratuito: number;
  precio_bloque?: number;
  bloque_horas?: number;
  monto_garantia?: number;
  tarifa_atraso_minuto?: number;
  hora_apertura?: string;
  hora_cierre?: string;
  dias_disponibles?: string | null;
  minutos_separacion?: number;
  dias_max_anticipacion?: number;
  dias_min_cancelacion_residente?: number;
  mes_dia_inicio_temporada?: string | null;
  mes_dia_termino_temporada?: string | null;
}

export async function crearEspacio(input: EspacioComunInput) {
  const insert = await db
    .prepare(
      `INSERT INTO espacio_comun
        (nombre, tipo_espaciocomun_id_tipoespaciocomun, condominio_id_condominio, capacidad,
         flg_reservable, flg_gratuito, precio_bloque, bloque_horas, monto_garantia, tarifa_atraso_minuto,
         hora_apertura, hora_cierre, dias_disponibles, minutos_separacion, dias_max_anticipacion,
         dias_min_cancelacion_residente, mes_dia_inicio_temporada, mes_dia_termino_temporada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.nombre.trim(),
      input.tipo_espaciocomun_id_tipoespaciocomun,
      input.condominio_id_condominio,
      input.capacidad ?? null,
      input.flg_reservable,
      input.flg_gratuito,
      input.flg_gratuito ? 0 : input.precio_bloque ?? 0,
      input.bloque_horas ?? 1,
      input.monto_garantia ?? 0,
      input.tarifa_atraso_minuto ?? 0,
      input.hora_apertura ?? "09:00:00",
      input.hora_cierre ?? "22:00:00",
      input.dias_disponibles ?? null,
      input.minutos_separacion ?? 0,
      input.dias_max_anticipacion ?? 30,
      input.dias_min_cancelacion_residente ?? 0,
      input.mes_dia_inicio_temporada ?? null,
      input.mes_dia_termino_temporada ?? null
    );
  return getEspacio(Number(insert.lastInsertRowid));
}

// Whitelist de columnas editables — nunca se arma el UPDATE con nombres de
// columna que vengan del cliente, solo con este arreglo fijo.
const CAMPOS_EDITABLES_ESPACIO = [
  "nombre",
  "tipo_espaciocomun_id_tipoespaciocomun",
  "capacidad",
  "flg_reservable",
  "flg_gratuito",
  "precio_bloque",
  "bloque_horas",
  "monto_garantia",
  "tarifa_atraso_minuto",
  "hora_apertura",
  "hora_cierre",
  "dias_disponibles",
  "minutos_separacion",
  "dias_max_anticipacion",
  "dias_min_cancelacion_residente",
  "mes_dia_inicio_temporada",
  "mes_dia_termino_temporada",
  "flg_vigencia",
] as const;

export async function actualizarEspacio(id: number, input: Partial<Record<(typeof CAMPOS_EDITABLES_ESPACIO)[number], any>>) {
  const campos: string[] = [];
  const valores: any[] = [];
  for (const campo of CAMPOS_EDITABLES_ESPACIO) {
    if (input[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(input[campo]);
    }
  }
  if (campos.length === 0) return getEspacio(id);
  valores.push(id);
  await db.prepare(`UPDATE espacio_comun SET ${campos.join(", ")} WHERE id_espaciocomun = ?`).run(...valores);
  return getEspacio(id);
}

// ---------------------------------------------------------------------------
// Validaciones de una solicitud de reserva (ventana horaria, día de semana,
// anticipación, temporada) — separado de la escritura para poder probarlo
// solo y para reutilizarlo tanto al crear como al listar disponibilidad.
// ---------------------------------------------------------------------------

interface ValidarVentanaInput {
  espacio: any;
  fecha: string;
  horaInicio: string;
  horaTermino: string;
  esAdminOComite: boolean;
}

function validarVentanaReserva({ espacio, fecha, horaInicio, horaTermino, esAdminOComite }: ValidarVentanaInput) {
  if (!espacio.flg_vigencia) throw new Error("Este espacio ya no está disponible.");
  if (!espacio.flg_reservable) throw new Error("Este espacio es de libre uso, no requiere reserva.");

  const inicioMin = minutosDesdeMedianoche(horaInicio);
  const terminoMin = minutosDesdeMedianoche(horaTermino);
  if (terminoMin <= inicioMin) throw new Error("La hora de término debe ser posterior a la hora de inicio.");

  const aperturaMin = minutosDesdeMedianoche(espacio.hora_apertura);
  const cierreMin = minutosDesdeMedianoche(espacio.hora_cierre);
  if (inicioMin < aperturaMin || terminoMin > cierreMin) {
    throw new Error(`El horario del espacio es de ${String(espacio.hora_apertura).slice(0, 5)} a ${String(espacio.hora_cierre).slice(0, 5)}.`);
  }

  const fechaObj = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(fechaObj.getTime())) throw new Error("Fecha inválida (formato esperado YYYY-MM-DD).");
  const diaSemana = ((fechaObj.getDay() + 6) % 7) + 1; // JS: 0=domingo..6=sábado -> ISO 1=lunes..7=domingo
  if (espacio.dias_disponibles) {
    const diasPermitidos = String(espacio.dias_disponibles)
      .split(",")
      .map((d: string) => Number(d.trim()));
    if (!diasPermitidos.includes(diaSemana)) {
      throw new Error("El espacio no está disponible ese día de la semana.");
    }
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diffDias = Math.round((fechaObj.getTime() - hoy.getTime()) / 86400000);
  if (diffDias < 0) throw new Error("No se puede reservar una fecha pasada.");
  if (!esAdminOComite && diffDias > espacio.dias_max_anticipacion) {
    throw new Error(`Este espacio se puede reservar con un máximo de ${espacio.dias_max_anticipacion} día(s) de anticipación.`);
  }

  if (espacio.mes_dia_inicio_temporada && espacio.mes_dia_termino_temporada) {
    const md = `${pad2(fechaObj.getMonth() + 1)}-${pad2(fechaObj.getDate())}`;
    const ini = espacio.mes_dia_inicio_temporada;
    const fin = espacio.mes_dia_termino_temporada;
    const dentroDeTemporada = ini <= fin ? md >= ini && md <= fin : md >= ini || md <= fin;
    if (!dentroDeTemporada) {
      throw new Error(`Este espacio solo está disponible del ${ini} al ${fin} (temporada).`);
    }
  }
}

async function validarSinTraslape(
  conn: DbLike,
  espacioId: number,
  fecha: string,
  horaInicio: string,
  horaTermino: string,
  minutosSeparacion: number,
  excluirReservaId?: number
) {
  const placeholders = ESTADOS_QUE_BLOQUEAN_HORARIO.map(() => "?").join(",");
  const existentes = (await conn
    .prepare(
      `SELECT r.id_reserva, r.hora_inicio, r.hora_termino
       FROM reserva_espaciocomun r
       JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
       WHERE r.espacio_comun_id_espaciocomun = ? AND r.fecha_reserva = ? AND er.gls_estadoreserva IN (${placeholders})`
    )
    .all(espacioId, fecha, ...ESTADOS_QUE_BLOQUEAN_HORARIO)) as { id_reserva: number; hora_inicio: string; hora_termino: string }[];

  const inicioMin = minutosDesdeMedianoche(horaInicio) - minutosSeparacion;
  const terminoMin = minutosDesdeMedianoche(horaTermino) + minutosSeparacion;

  for (const r of existentes) {
    if (excluirReservaId && r.id_reserva === excluirReservaId) continue;
    const rInicio = minutosDesdeMedianoche(r.hora_inicio);
    const rTermino = minutosDesdeMedianoche(r.hora_termino);
    if (inicioMin < rTermino && terminoMin > rInicio) {
      throw new Error("Ese horario se traslapa con otra reserva de este espacio (incluyendo el tiempo de aseo entre arriendos).");
    }
  }
}

// Horarios ya tomados de un espacio en una fecha — para que la app pinte
// qué bloques no ofrecer antes de que el residente intente reservar.
export async function listarHorariosOcupados(espacioId: number, fecha: string) {
  await expirarReservasVencidas(db);
  return db
    .prepare(
      `SELECT r.hora_inicio, r.hora_termino, er.gls_estadoreserva
       FROM reserva_espaciocomun r
       JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
       WHERE r.espacio_comun_id_espaciocomun = ? AND r.fecha_reserva = ?
         AND er.gls_estadoreserva IN ('Pendiente','Aprobado','Reservado','En uso')
       ORDER BY r.hora_inicio`
    )
    .all(espacioId, fecha);
}

// ---------------------------------------------------------------------------
// Ciclo de vida de una reserva
// ---------------------------------------------------------------------------

async function getReservaConDetalle(conn: DbLike, id: number) {
  const reserva = await conn
    .prepare(
      `SELECT r.*, e.nombre AS nombre_espacio, e.flg_gratuito, te.gls_tipoespaciocomun,
              un.numero_unidad, tb.nombre_torre,
              er.gls_estadoreserva,
              sol.nombre_usuario AS nombre_solicitante,
              creador.nombre_usuario AS nombre_creador
       FROM reserva_espaciocomun r
       JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun
       JOIN tipo_espaciocomun te ON te.id_tipoespaciocomun = e.tipo_espaciocomun_id_tipoespaciocomun
       JOIN unidad un ON un.id_unidad = r.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
       JOIN usuario sol ON sol.id_usuario = r.solicitante_usuario_id
       JOIN usuario creador ON creador.id_usuario = r.creado_por_usuario_id
       WHERE r.id_reserva = ?`
    )
    .get(id);
  if (!reserva) throw new Error("No existe esa reserva.");
  return reserva;
}

export async function getReserva(id: number) {
  return getReservaConDetalle(db, id);
}

export interface CrearReservaInput {
  espacioComunId: number;
  unidadId: number;
  fecha: string;
  horaInicio: string;
  horaTermino: string;
  solicitanteUsuarioId: number;
}

export async function crearReserva(input: CrearReservaInput, creadoPor: { id: number; esAdminOComite: boolean }) {
  return withTransaction(async (tx) => {
    const espacio = (await tx.prepare(`SELECT * FROM espacio_comun WHERE id_espaciocomun = ? FOR UPDATE`).get(input.espacioComunId)) as any;
    if (!espacio) throw new Error("No existe ese espacio común.");

    validarVentanaReserva({
      espacio,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaTermino: input.horaTermino,
      esAdminOComite: creadoPor.esAdminOComite,
    });

    if (!creadoPor.esAdminOComite) {
      const unidad = (await tx.prepare(`SELECT flg_gastocomun FROM unidad WHERE id_unidad = ?`).get(input.unidadId)) as
        | { flg_gastocomun: number }
        | undefined;
      if (!unidad) throw new Error("No existe esa unidad.");
      if (!unidad.flg_gastocomun) {
        throw new Error("Tu depto tiene el gasto común pendiente — no puedes reservar espacios comunes hasta regularizarlo.");
      }
    }

    await validarSinTraslape(tx, input.espacioComunId, input.fecha, input.horaInicio, input.horaTermino, espacio.minutos_separacion);

    const duracionHoras = (minutosDesdeMedianoche(input.horaTermino) - minutosDesdeMedianoche(input.horaInicio)) / 60;
    const bloques = espacio.flg_gratuito ? 0 : Math.ceil(duracionHoras / Number(espacio.bloque_horas));
    const montoTarifa = espacio.flg_gratuito ? 0 : bloques * espacio.precio_bloque;
    const montoGarantia = espacio.monto_garantia || 0;

    const estadoPendienteId = await getEstadoId(tx, ESTADOS.PENDIENTE);

    const insert = await tx
      .prepare(
        `INSERT INTO reserva_espaciocomun
          (espacio_comun_id_espaciocomun, unidad_id_unidad, condominio_id_condominio, solicitante_usuario_id, creado_por_usuario_id,
           fecha_reserva, hora_inicio, hora_termino, estado_reserespaciocomun_id_estadoreserva, monto_tarifa, monto_garantia, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.espacioComunId,
        input.unidadId,
        espacio.condominio_id_condominio,
        input.solicitanteUsuarioId,
        creadoPor.id,
        input.fecha,
        input.horaInicio,
        input.horaTermino,
        estadoPendienteId,
        montoTarifa,
        montoGarantia,
        formatDateTime(new Date())
      );

    return getReservaConDetalle(tx, Number(insert.lastInsertRowid));
  });
}

// Si no se valida el pago hasta 2 días antes de la fecha de uso, la reserva
// expira sola y el horario queda libre (regla 6). Ronda 40, a pedido
// explícito del usuario: antes solo se revisaba "de paso" cada vez que se
// listaba algo (barato, pero dependía de que alguien consultara reservas
// para que corriera) — ahora TAMBIÉN corre sola por un cron diario (ver
// index.ts), así que se exporta. Sigue llamándose también "de paso" en
// cada listado/acción, así que el cron es un respaldo — no hace falta que
// corra exactamente a tiempo para que el sistema quede consistente.
export async function expirarReservasVencidas(conn: DbLike) {
  const estadoAprobadoId = await getEstadoId(conn, ESTADOS.APROBADO);
  const estadoExpiradoId = await getEstadoId(conn, ESTADOS.EXPIRADO);
  await conn
    .prepare(
      `UPDATE reserva_espaciocomun
       SET estado_reserespaciocomun_id_estadoreserva = ?
       WHERE estado_reserespaciocomun_id_estadoreserva = ?
         AND fecha_pago_validado IS NULL
         AND monto_tarifa > 0
         AND fecha_reserva <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)`
    )
    .run(estadoExpiradoId, estadoAprobadoId);
}

export async function listarReservasDeUnidad(unidadId: number, condominioId: number) {
  await expirarReservasVencidas(db);
  // Mismas columnas que getReservaConDetalle/listarReservas — "Mis
  // reservas" (app del residente) depende de flg_gratuito para decidir si
  // muestra el monto o "Gratuito".
  return db
    .prepare(
      `SELECT r.*, e.nombre AS nombre_espacio, e.flg_gratuito, te.gls_tipoespaciocomun,
              un.numero_unidad, tb.nombre_torre, er.gls_estadoreserva,
              sol.nombre_usuario AS nombre_solicitante,
              creador.nombre_usuario AS nombre_creador
       FROM reserva_espaciocomun r
       JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun
       JOIN tipo_espaciocomun te ON te.id_tipoespaciocomun = e.tipo_espaciocomun_id_tipoespaciocomun
       JOIN unidad un ON un.id_unidad = r.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
       JOIN usuario sol ON sol.id_usuario = r.solicitante_usuario_id
       JOIN usuario creador ON creador.id_usuario = r.creado_por_usuario_id
       WHERE r.unidad_id_unidad = ? AND r.condominio_id_condominio = ?
       ORDER BY r.fecha_reserva DESC, r.hora_inicio DESC`
    )
    .all(unidadId, condominioId);
}

export interface ListarReservasFiltro {
  estado?: string;
  espacioId?: number;
  fechaInicio?: string;
  fechaTermino?: string;
}

export async function listarReservas(condominioId: number, filtro?: ListarReservasFiltro) {
  await expirarReservasVencidas(db);
  // Mismas columnas que getReservaConDetalle (incluyendo flg_gratuito,
  // gls_tipoespaciocomun y nombre_creador) para que el listado admin tenga
  // la misma forma que el detalle de una reserva — la app (AdminReservasScreen)
  // depende de flg_gratuito para decidir si muestra el monto o "Gratuito".
  let sql = `SELECT r.*, e.nombre AS nombre_espacio, e.flg_gratuito, te.gls_tipoespaciocomun,
                    un.numero_unidad, tb.nombre_torre, er.gls_estadoreserva,
                    sol.nombre_usuario AS nombre_solicitante,
                    creador.nombre_usuario AS nombre_creador
             FROM reserva_espaciocomun r
             JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun
             JOIN tipo_espaciocomun te ON te.id_tipoespaciocomun = e.tipo_espaciocomun_id_tipoespaciocomun
             JOIN unidad un ON un.id_unidad = r.unidad_id_unidad
             JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
             JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
             JOIN usuario sol ON sol.id_usuario = r.solicitante_usuario_id
             JOIN usuario creador ON creador.id_usuario = r.creado_por_usuario_id
             WHERE r.condominio_id_condominio = ?`;
  const params: any[] = [condominioId];
  if (filtro?.estado) {
    sql += ` AND er.gls_estadoreserva = ?`;
    params.push(filtro.estado);
  }
  if (filtro?.espacioId) {
    sql += ` AND r.espacio_comun_id_espaciocomun = ?`;
    params.push(filtro.espacioId);
  }
  if (filtro?.fechaInicio) {
    sql += ` AND r.fecha_reserva >= ?`;
    params.push(filtro.fechaInicio);
  }
  if (filtro?.fechaTermino) {
    sql += ` AND r.fecha_reserva <= ?`;
    params.push(filtro.fechaTermino);
  }
  sql += ` ORDER BY r.fecha_reserva DESC, r.hora_inicio DESC`;
  return db.prepare(sql).all(...params);
}

export async function listarReservasDelDia(condominioId: number, fecha: string) {
  await expirarReservasVencidas(db);
  return db
    .prepare(
      `SELECT r.*, e.nombre AS nombre_espacio, e.flg_gratuito, te.gls_tipoespaciocomun,
              un.numero_unidad, tb.nombre_torre, er.gls_estadoreserva,
              sol.nombre_usuario AS nombre_solicitante,
              creador.nombre_usuario AS nombre_creador
       FROM reserva_espaciocomun r
       JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun
       JOIN tipo_espaciocomun te ON te.id_tipoespaciocomun = e.tipo_espaciocomun_id_tipoespaciocomun
       JOIN unidad un ON un.id_unidad = r.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
       JOIN usuario sol ON sol.id_usuario = r.solicitante_usuario_id
       JOIN usuario creador ON creador.id_usuario = r.creado_por_usuario_id
       WHERE r.condominio_id_condominio = ? AND r.fecha_reserva = ?
         AND er.gls_estadoreserva IN ('Reservado', 'En uso', 'Finalizado')
       ORDER BY r.hora_inicio`
    )
    .all(condominioId, fecha);
}

export async function aprobarReserva(id: number, usuarioId: number) {
  return withTransaction(async (tx) => {
    const reserva = (await tx
      .prepare(
        `SELECT r.*, e.flg_gratuito FROM reserva_espaciocomun r JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun WHERE r.id_reserva = ? FOR UPDATE`
      )
      .get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");
    const estadoPendienteId = await getEstadoId(tx, ESTADOS.PENDIENTE);
    if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoPendienteId) {
      throw new Error("Solo se puede aprobar una reserva que esté Pendiente.");
    }
    const siguienteEstado = reserva.flg_gratuito ? ESTADOS.RESERVADO : ESTADOS.APROBADO;
    const siguienteEstadoId = await getEstadoId(tx, siguienteEstado);
    await tx
      .prepare(
        `UPDATE reserva_espaciocomun SET estado_reserespaciocomun_id_estadoreserva = ?, fecha_aprobacion = ?, usuario_id_aprobo = ? WHERE id_reserva = ?`
      )
      .run(siguienteEstadoId, formatDateTime(new Date()), usuarioId, id);
    return getReservaConDetalle(tx, id);
  });
}

export async function rechazarReserva(id: number, motivo: string, usuarioId: number) {
  if (!motivo || !motivo.trim()) throw new Error("El motivo de rechazo es obligatorio.");
  return withTransaction(async (tx) => {
    const reserva = (await tx.prepare(`SELECT * FROM reserva_espaciocomun WHERE id_reserva = ? FOR UPDATE`).get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");
    const estadoPendienteId = await getEstadoId(tx, ESTADOS.PENDIENTE);
    if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoPendienteId) {
      throw new Error("Solo se puede rechazar una reserva que esté Pendiente.");
    }
    const estadoRechazadoId = await getEstadoId(tx, ESTADOS.RECHAZADO);
    await tx
      .prepare(
        `UPDATE reserva_espaciocomun SET estado_reserespaciocomun_id_estadoreserva = ?, fecha_aprobacion = ?, usuario_id_aprobo = ?, motivo_rechazo = ? WHERE id_reserva = ?`
      )
      .run(estadoRechazadoId, formatDateTime(new Date()), usuarioId, motivo.trim(), id);
    return getReservaConDetalle(tx, id);
  });
}

export async function subirComprobante(id: number, comprobanteUrl: string) {
  const estadoAprobadoId = await getEstadoId(db, ESTADOS.APROBADO);
  const reserva = (await db.prepare(`SELECT estado_reserespaciocomun_id_estadoreserva FROM reserva_espaciocomun WHERE id_reserva = ?`).get(id)) as
    | { estado_reserespaciocomun_id_estadoreserva: number }
    | undefined;
  if (!reserva) throw new Error("No existe esa reserva.");
  if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoAprobadoId) {
    throw new Error("Solo se puede subir el comprobante de una reserva Aprobada, esperando pago.");
  }
  await db.prepare(`UPDATE reserva_espaciocomun SET comprobante_pago_url = ? WHERE id_reserva = ?`).run(comprobanteUrl, id);
  return getReserva(id);
}

export async function validarPago(id: number, usuarioId: number) {
  return withTransaction(async (tx) => {
    const reserva = (await tx.prepare(`SELECT * FROM reserva_espaciocomun WHERE id_reserva = ? FOR UPDATE`).get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");
    const estadoAprobadoId = await getEstadoId(tx, ESTADOS.APROBADO);
    if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoAprobadoId) {
      throw new Error("Solo se puede validar el pago de una reserva Aprobada.");
    }
    if (!reserva.comprobante_pago_url) {
      throw new Error("Todavía no se ha subido un comprobante de pago para esta reserva.");
    }
    const estadoReservadoId = await getEstadoId(tx, ESTADOS.RESERVADO);
    await tx
      .prepare(
        `UPDATE reserva_espaciocomun SET estado_reserespaciocomun_id_estadoreserva = ?, fecha_pago_validado = ?, usuario_id_valido_pago = ? WHERE id_reserva = ?`
      )
      .run(estadoReservadoId, formatDateTime(new Date()), usuarioId, id);
    return getReservaConDetalle(tx, id);
  });
}

export async function cancelarReserva(id: number, usuarioId: number, esAdminOComite: boolean) {
  return withTransaction(async (tx) => {
    const reserva = (await tx
      .prepare(
        `SELECT r.*, e.dias_min_cancelacion_residente FROM reserva_espaciocomun r JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun WHERE r.id_reserva = ? FOR UPDATE`
      )
      .get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");

    const estadoActualRow = (await tx
      .prepare(`SELECT gls_estadoreserva FROM estado_reserespaciocomun WHERE id_estadoreserva = ?`)
      .get(reserva.estado_reserespaciocomun_id_estadoreserva)) as { gls_estadoreserva: string };
    const estadosCancelables: string[] = [ESTADOS.PENDIENTE, ESTADOS.APROBADO, ESTADOS.RESERVADO];
    if (!estadosCancelables.includes(estadoActualRow.gls_estadoreserva)) {
      throw new Error(`No se puede cancelar una reserva en estado "${estadoActualRow.gls_estadoreserva}".`);
    }

    if (!esAdminOComite) {
      const dias = reserva.dias_min_cancelacion_residente || 0;
      if (dias > 0) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaReserva = new Date(`${reserva.fecha_reserva}T00:00:00`);
        const diffDias = Math.round((fechaReserva.getTime() - hoy.getTime()) / 86400000);
        if (diffDias < dias) {
          throw new Error(`Este espacio exige cancelar con al menos ${dias} día(s) de anticipación.`);
        }
      }
    }

    const estadoCanceladoId = await getEstadoId(tx, ESTADOS.CANCELADO);
    await tx
      .prepare(
        `UPDATE reserva_espaciocomun SET estado_reserespaciocomun_id_estadoreserva = ?, fecha_cancelacion = ?, usuario_id_cancelo = ? WHERE id_reserva = ?`
      )
      .run(estadoCanceladoId, formatDateTime(new Date()), usuarioId, id);
    return getReservaConDetalle(tx, id);
  });
}

export async function marcarLlegada(id: number) {
  return withTransaction(async (tx) => {
    const reserva = (await tx.prepare(`SELECT * FROM reserva_espaciocomun WHERE id_reserva = ? FOR UPDATE`).get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");
    const estadoReservadoId = await getEstadoId(tx, ESTADOS.RESERVADO);
    if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoReservadoId) {
      throw new Error("Solo se puede marcar la llegada de una reserva Reservada (confirmada/pagada).");
    }
    const estadoEnUsoId = await getEstadoId(tx, ESTADOS.EN_USO);
    await tx
      .prepare(`UPDATE reserva_espaciocomun SET estado_reserespaciocomun_id_estadoreserva = ?, fecha_hora_llegada = ? WHERE id_reserva = ?`)
      .run(estadoEnUsoId, formatDateTime(new Date()), id);
    return getReservaConDetalle(tx, id);
  });
}

export async function marcarSalida(id: number) {
  return withTransaction(async (tx) => {
    const reserva = (await tx
      .prepare(
        `SELECT r.*, e.tarifa_atraso_minuto FROM reserva_espaciocomun r JOIN espacio_comun e ON e.id_espaciocomun = r.espacio_comun_id_espaciocomun WHERE r.id_reserva = ? FOR UPDATE`
      )
      .get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");
    const estadoEnUsoId = await getEstadoId(tx, ESTADOS.EN_USO);
    if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoEnUsoId) {
      throw new Error("Solo se puede marcar la salida de una reserva que esté En uso.");
    }
    const ahora = new Date();
    const horaTerminoProgramada = new Date(`${reserva.fecha_reserva}T${reserva.hora_termino}`);
    const minutosExceso = Math.max(0, Math.round((ahora.getTime() - horaTerminoProgramada.getTime()) / 60000));
    const montoCobroExceso = minutosExceso * (reserva.tarifa_atraso_minuto || 0);

    const estadoFinalizadoId = await getEstadoId(tx, ESTADOS.FINALIZADO);
    await tx
      .prepare(
        `UPDATE reserva_espaciocomun SET estado_reserespaciocomun_id_estadoreserva = ?, fecha_hora_salida = ?, minutos_exceso = ?, monto_cobro_exceso = ? WHERE id_reserva = ?`
      )
      .run(estadoFinalizadoId, formatDateTime(ahora), minutosExceso, montoCobroExceso, id);
    return getReservaConDetalle(tx, id);
  });
}

export async function resolverGarantia(
  id: number,
  decision: "Devuelta" | "Retenida",
  montoRetenido: number | undefined,
  observacion: string | undefined
) {
  return withTransaction(async (tx) => {
    const reserva = (await tx.prepare(`SELECT * FROM reserva_espaciocomun WHERE id_reserva = ? FOR UPDATE`).get(id)) as any;
    if (!reserva) throw new Error("No existe esa reserva.");
    const estadoFinalizadoId = await getEstadoId(tx, ESTADOS.FINALIZADO);
    if (reserva.estado_reserespaciocomun_id_estadoreserva !== estadoFinalizadoId) {
      throw new Error("La garantía solo se resuelve sobre una reserva Finalizada.");
    }
    if (reserva.monto_garantia <= 0) {
      throw new Error("Esta reserva no tiene garantía asociada.");
    }
    if (reserva.estado_garantia !== "Pendiente") {
      throw new Error("La garantía de esta reserva ya fue resuelta.");
    }
    if (decision === "Retenida" && (!montoRetenido || montoRetenido <= 0)) {
      throw new Error("Indica el monto retenido de la garantía.");
    }
    await tx
      .prepare(`UPDATE reserva_espaciocomun SET estado_garantia = ?, monto_garantia_retenido = ?, observacion_garantia = ? WHERE id_reserva = ?`)
      .run(decision, decision === "Retenida" ? montoRetenido : 0, observacion ?? null, id);
    return getReservaConDetalle(tx, id);
  });
}
