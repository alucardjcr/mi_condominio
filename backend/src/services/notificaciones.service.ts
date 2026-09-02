import { db, DbLike } from "../db/client";

// Ronda 16, a pedido explícito del usuario: "notificaciones push para
// paquetes y visitas y otras cosas... el administrador o el comité podrá
// emitir un comunicado y debería llegarles a todos". Este servicio cubre
// las tres fuentes (paquetes, visitas, comunicados) con una sola tabla de
// notificaciones + una fila por destinatario (notificacion_usuario), y un
// intento best-effort de push real vía el servicio de Expo cuando el
// destinatario tiene push_token registrado — ver la nota larga en
// docs/schema-mysql.sql sobre por qué el push nunca puede romper el flujo
// que lo generó.

export const GLS_TIPONOTIF_PAQUETE_RECIBIDO = "Paquete recibido";
export const GLS_TIPONOTIF_PAQUETE_EN_PORTERIA = "Paquete en portería";
export const GLS_TIPONOTIF_PAQUETE_ALERTA_7DIAS = "Alerta paquete sin retirar";
export const GLS_TIPONOTIF_VISITA = "Visita registrada";
export const GLS_TIPONOTIF_COMUNICADO = "Comunicado";
// Ronda 18: tarea puntual que administrador/comité le escribe a un
// trabajador de personal externo (ver personal.service.ts).
export const GLS_TIPONOTIF_TAREA_PERSONAL = "Tarea asignada";
// Ronda 19: mantenciones (ver mantencion.service.ts) — aviso generado por
// el propio sistema en dos momentos: al programar (anticipado) y al
// iniciar (cuando el guardia marca el ingreso de la empresa externa).
export const GLS_TIPONOTIF_MANTENCION_PROGRAMADA = "Mantención programada";
export const GLS_TIPONOTIF_MANTENCION_EN_CURSO = "Mantención en curso";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
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

/**
 * Manda un push real a través del servicio de Expo (no necesita credenciales
 * propias de Apple/Google — Expo hace de intermediario). Nunca lanza: si
 * falla (sin red, token inválido, Expo caído, o el residente todavía no
 * tiene push_token porque está en Expo Go sin development build — ver
 * "Supuestos" en el README) devuelve false y quien llama sigue igual.
 */
async function enviarPushExpo(pushToken: string, titulo: string, cuerpo: string, data?: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([{ to: pushToken, title: titulo, body: cuerpo, data: data ?? {}, sound: "default" }]),
    });
    if (!res.ok) return false;
    const json: any = await res.json();
    return json?.data?.[0]?.status === "ok";
  } catch {
    return false;
  }
}

async function destinatariosOcupantesDeUnidad(conn: DbLike, unidadId: number): Promise<number[]> {
  // TODOS los residentes activos con acceso a la app de esa unidad (dueño
  // viva o no ahí, arrendatario, pareja, roomies, etc.) — no solo la
  // persona puntual a la que se dirigió el paquete o a la que se dijo que
  // visitaban, porque cualquiera del hogar puede querer saberlo (mismo
  // criterio que ya se usa en /mi-depto, ronda 15).
  const rows = (await conn
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE tu.gls_tipousuario = 'Residente' AND u.unidad_id_unidad = ? AND u.flg_vigencia = 1 AND u.usuariocol IS NOT NULL`
    )
    .all(unidadId)) as { id_usuario: number }[];
  return rows.map((r) => r.id_usuario);
}

async function destinatariosResidentesActivosCondominio(conn: DbLike, condominioId: number): Promise<number[]> {
  const rows = (await conn
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE tu.gls_tipousuario = 'Residente' AND u.condominio_id_condominio = ? AND u.flg_vigencia = 1 AND u.usuariocol IS NOT NULL`
    )
    .all(condominioId)) as { id_usuario: number }[];
  return rows.map((r) => r.id_usuario);
}

export interface CrearNotificacionInput {
  condominioId: number;
  tipoGls: string;
  titulo: string;
  cuerpo: string;
  destinatarios: number[];
  referenciaTipo?: "paquete" | "visita" | "tarea_personal" | "mantencion" | "amonestacion";
  referenciaId?: number;
  creadoPorUsuarioId?: number;
}

/**
 * Inserta la notificación + una fila por destinatario. NO manda el push acá
 * a propósito: se llama desde dentro de transacciones (registrar paquete,
 * registrar visita) y una llamada de red no debe hacerse mientras se tiene
 * una conexión de base de datos reservada — ver enviarPushesDeNotificacion,
 * que se llama aparte, después de que la transacción ya hizo commit.
 */
async function crearNotificacionEnConn(conn: DbLike, input: CrearNotificacionInput): Promise<number | null> {
  if (!input.destinatarios.length) return null; // nadie con acceso activo a quien avisar en ese depto/condominio

  const tipoId = await getIdByGls(conn, "tipo_notificacion", "id_tiponotificacion", "gls_tiponotificacion", input.tipoGls, input.condominioId);
  const ahora = formatDateTime(new Date());

  const insert = await conn
    .prepare(
      `INSERT INTO notificacion
         (tipo_notificacion_id_tiponotificacion, titulo, cuerpo, condominio_id_condominio, referencia_tipo, referencia_id, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      tipoId,
      input.titulo,
      input.cuerpo,
      input.condominioId,
      input.referenciaTipo ?? null,
      input.referenciaId ?? null,
      input.creadoPorUsuarioId ?? null,
      ahora
    );
  const idNotificacion = Number(insert.lastInsertRowid);

  for (const usuarioId of input.destinatarios) {
    await conn
      .prepare(`INSERT INTO notificacion_usuario (notificacion_id_notificacion, usuario_id_usuario) VALUES (?, ?)`)
      .run(idNotificacion, usuarioId);
  }

  return idNotificacion;
}

/** Notifica a todos los residentes activos con acceso de UNA unidad (paquetería/visitas). */
export async function crearNotificacionParaUnidad(
  conn: DbLike,
  params: Omit<CrearNotificacionInput, "destinatarios"> & { unidadId: number }
): Promise<number | null> {
  const { unidadId, ...resto } = params;
  const destinatarios = await destinatariosOcupantesDeUnidad(conn, unidadId);
  return crearNotificacionEnConn(conn, { ...resto, destinatarios });
}

/**
 * Notifica a UN solo usuario (ronda 18: tarea asignada a un trabajador de
 * personal externo) — a diferencia de paquetes/visitas (todo el hogar) o
 * comunicados (todo el condominio), esta es 1 a 1.
 */
export async function crearNotificacionParaUsuario(
  conn: DbLike,
  params: Omit<CrearNotificacionInput, "destinatarios"> & { usuarioId: number }
): Promise<number | null> {
  const { usuarioId, ...resto } = params;
  return crearNotificacionEnConn(conn, { ...resto, destinatarios: [usuarioId] });
}

/**
 * Notifica a TODOS los residentes activos con acceso del condominio — mismo
 * destinatario que un comunicado, pero para un aviso generado por el propio
 * sistema (ronda 19: mantenciones programadas/en curso), no uno que
 * administrador/comité redacta a mano como crearComunicado.
 */
export async function crearNotificacionParaCondominio(
  conn: DbLike,
  params: Omit<CrearNotificacionInput, "destinatarios">
): Promise<number | null> {
  const destinatarios = await destinatariosResidentesActivosCondominio(conn, params.condominioId);
  return crearNotificacionEnConn(conn, { ...params, destinatarios });
}

/**
 * Manda (best-effort) los push reales pendientes de una notificación ya
 * creada, a quienes tengan al menos un dispositivo con push_token
 * registrado. Ronda 40: ahora manda a TODOS los dispositivos de cada
 * destinatario (antes solo al único token que tenía guardado). Se llama
 * SIEMPRE fuera de cualquier transacción (después del commit) — nunca debe
 * interrumpir el flujo que generó la notificación (registrar un paquete,
 * una visita, un comunicado), así que atrapa cualquier error y no relanza
 * nada.
 */
export async function enviarPushesDeNotificacion(idNotificacion: number | null | undefined): Promise<void> {
  if (!idNotificacion) return;
  try {
    const notif = (await db.prepare(`SELECT titulo, cuerpo FROM notificacion WHERE id_notificacion = ?`).get(idNotificacion)) as
      | { titulo: string; cuerpo: string }
      | undefined;
    if (!notif) return;

    const destinatarios = (await db
      .prepare(
        `SELECT nu.id_notificacionusuario, upt.push_token
         FROM notificacion_usuario nu
         JOIN usuario_push_token upt ON upt.usuario_id_usuario = nu.usuario_id_usuario
         WHERE nu.notificacion_id_notificacion = ?`
      )
      .all(idNotificacion)) as { id_notificacionusuario: number; push_token: string }[];

    // Un destinatario puede aparecer varias veces (uno por dispositivo) —
    // se manda a cada uno, pero basta con que UNO tenga éxito para marcar
    // la notificación como entregada por push.
    const idsExitosos = new Set<number>();
    for (const d of destinatarios) {
      const ok = await enviarPushExpo(d.push_token, notif.titulo, notif.cuerpo, { idNotificacion });
      if (ok) idsExitosos.add(d.id_notificacionusuario);
    }
    for (const id of idsExitosos) {
      await db.prepare(`UPDATE notificacion_usuario SET flg_push_enviado = 1 WHERE id_notificacionusuario = ?`).run(id);
    }
  } catch {
    // Best-effort: un fallo acá nunca debe tumbar el registro de un
    // paquete/visita/comunicado que ya quedó guardado correctamente.
  }
}

/**
 * Comunicado de administrador/comité a TODOS los residentes activos con
 * acceso del condominio (regla del usuario: "debería llegarles a todos").
 * A diferencia de paquetes/visitas, esto no corre dentro de ninguna
 * transacción existente, así que acá mismo se manda también el push.
 */
export async function crearComunicado(input: { titulo: string; cuerpo: string; condominioId: number; creadoPorUsuarioId: number }) {
  if (!input.titulo?.trim() || !input.cuerpo?.trim()) {
    throw new Error("Faltan campos: título y cuerpo del comunicado son obligatorios.");
  }
  const destinatarios = await destinatariosResidentesActivosCondominio(db, input.condominioId);
  const idNotificacion = await crearNotificacionEnConn(db, {
    condominioId: input.condominioId,
    tipoGls: GLS_TIPONOTIF_COMUNICADO,
    titulo: input.titulo.trim(),
    cuerpo: input.cuerpo.trim(),
    destinatarios,
    creadoPorUsuarioId: input.creadoPorUsuarioId,
  });
  await enviarPushesDeNotificacion(idNotificacion);
  return { id_notificacion: idNotificacion, destinatarios: destinatarios.length };
}

/** Bandeja de notificaciones del propio usuario logeado, más recientes primero. */
export async function listarNotificacionesDeUsuario(usuarioId: number) {
  return db
    .prepare(
      `SELECT
         nu.id_notificacionusuario, nu.flg_leido, nu.fecha_leido, nu.flg_push_enviado,
         n.id_notificacion, n.titulo, n.cuerpo, n.referencia_tipo, n.referencia_id, n.fecha_creacion,
         tn.gls_tiponotificacion
       FROM notificacion_usuario nu
       JOIN notificacion n ON n.id_notificacion = nu.notificacion_id_notificacion
       JOIN tipo_notificacion tn ON tn.id_tiponotificacion = n.tipo_notificacion_id_tiponotificacion
       WHERE nu.usuario_id_usuario = ?
       ORDER BY n.fecha_creacion DESC`
    )
    .all(usuarioId);
}

/** Marca como leída UNA notificación propia (nunca la de otro usuario). */
export async function marcarNotificacionLeida(idNotificacionUsuario: number, usuarioId: number) {
  const fila = await db
    .prepare(`SELECT id_notificacionusuario FROM notificacion_usuario WHERE id_notificacionusuario = ? AND usuario_id_usuario = ?`)
    .get(idNotificacionUsuario, usuarioId);
  if (!fila) throw new Error("No existe esa notificación para tu usuario.");
  await db
    .prepare(`UPDATE notificacion_usuario SET flg_leido = 1, fecha_leido = ? WHERE id_notificacionusuario = ?`)
    .run(formatDateTime(new Date()), idNotificacionUsuario);
  return { ok: true };
}

/**
 * Guarda el push token de Expo del teléfono donde el usuario logeado tiene
 * la sesión abierta ahora (lo llama la app después de loguearse y de que el
 * usuario acepta el permiso de notificaciones). Ronda 40, a pedido
 * explícito del usuario: ahora soporta MÁS DE UN dispositivo por usuario
 * (antes se sobreescribía un único token en la propia tabla `usuario` — si
 * la misma cuenta estaba logeada en 2 celulares, solo el último en
 * loguearse recibía push). Un mismo token de dispositivo solo puede estar
 * vinculado a una cuenta a la vez — si el teléfono cambió de usuario
 * (cerró sesión alguien, entró otra persona), el token se reasigna acá,
 * quitándolo de quien lo tuviera antes.
 */
export async function registrarPushToken(usuarioId: number, token: string) {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw new Error("Falta el push_token.");
  }
  const tokenLimpio = token.trim();

  const existente = (await db
    .prepare(`SELECT id_usuariopushtoken, usuario_id_usuario FROM usuario_push_token WHERE push_token = ?`)
    .get(tokenLimpio)) as { id_usuariopushtoken: number; usuario_id_usuario: number } | undefined;

  if (existente) {
    if (existente.usuario_id_usuario !== usuarioId) {
      // El dispositivo tenía otra cuenta logeada antes — se reasigna.
      await db.prepare(`UPDATE usuario_push_token SET usuario_id_usuario = ? WHERE id_usuariopushtoken = ?`).run(usuarioId, existente.id_usuariopushtoken);
    }
    // Si ya era de este mismo usuario, no hay nada que hacer.
  } else {
    await db.prepare(`INSERT INTO usuario_push_token (usuario_id_usuario, push_token) VALUES (?, ?)`).run(usuarioId, tokenLimpio);
  }
  return { ok: true };
}

/**
 * Ronda 40: se llama al cerrar sesión (best-effort, ver AuthContext ->
 * logout) para que ESTE dispositivo deje de recibir push apenas la persona
 * sale — sin esto, el token seguiría vinculado a la cuenta hasta que
 * alguien más lo pisara entrando en el mismo teléfono.
 */
export async function eliminarPushToken(usuarioId: number, token: string) {
  if (!token) return { ok: true };
  await db.prepare(`DELETE FROM usuario_push_token WHERE usuario_id_usuario = ? AND push_token = ?`).run(usuarioId, token.trim());
  return { ok: true };
}
