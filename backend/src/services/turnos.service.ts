import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Turnos de guardias (ronda 20): rol JEFE_GUARDIAS gestiona el calendario
// semanal de "bloques fijos por día" (Mañana/Tarde/Noche, catalogados por
// condominio con su horario — ver seed.ts) y asigna qué guardia cubre cada
// bloque cada día. A pedido explícito del usuario, este calendario SÍ
// restringe el login del guardia — ver verificarTurnoParaLogin, llamada
// desde auth.service.ts. La nota completa de la regla de negocio (y el
// supuesto sobre "fail-open" cuando todavía no hay turnos cargados) está en
// docs/schema-mysql.sql, sobre la tabla turno_asignado_guardia.
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatFecha(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatDateTime(d: Date) {
  return `${formatFecha(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// Lunes (00:00) de la semana ISO que contiene `fecha` (1=lunes..7=domingo,
// mismo cálculo que ya usa reservas.service.ts para día de la semana).
function inicioSemana(fecha: Date): Date {
  const diaSemanaIso = ((fecha.getDay() + 6) % 7) + 1;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - (diaSemanaIso - 1));
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

export async function listarBloques(condominioId: number) {
  return db
    .prepare(
      `SELECT id_turnobloque, gls_turnobloque, hora_inicio, hora_termino
       FROM turno_bloque
       WHERE condominio_id_condominio = ? AND flg_vigencia = 1
       ORDER BY hora_inicio`
    )
    .all(condominioId);
}

/** Calendario de turnos de la semana (lunes a domingo) — por defecto, la semana en curso. */
export async function listarTurnosSemana(condominioId: number, fechaInicio?: string, fechaTermino?: string) {
  const lunes = fechaInicio ? new Date(`${fechaInicio}T00:00:00`) : inicioSemana(new Date());
  const domingo = fechaTermino
    ? new Date(`${fechaTermino}T00:00:00`)
    : (() => {
        const d = new Date(lunes);
        d.setDate(d.getDate() + 6);
        return d;
      })();

  return db
    .prepare(
      `SELECT ta.id_turnoasignado, ta.fecha, ta.guardia_usuario_id, u.nombre_usuario AS nombre_guardia,
              tb.id_turnobloque, tb.gls_turnobloque, tb.hora_inicio, tb.hora_termino
       FROM turno_asignado_guardia ta
       JOIN usuario u ON u.id_usuario = ta.guardia_usuario_id
       JOIN turno_bloque tb ON tb.id_turnobloque = ta.turno_bloque_id_turnobloque
       WHERE ta.condominio_id_condominio = ? AND ta.fecha BETWEEN ? AND ?
       ORDER BY ta.fecha, tb.hora_inicio`
    )
    .all(condominioId, formatFecha(lunes), formatFecha(domingo));
}

export async function asignarTurno(
  input: { guardiaUsuarioId: number; turnoBloqueId: number; fecha: string; condominioId: number },
  creadoPorUsuarioId: number
) {
  const guardia = await db
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE u.id_usuario = ? AND tu.gls_tipousuario = 'Guardia' AND u.flg_vigencia = 1`
    )
    .get(input.guardiaUsuarioId);
  if (!guardia) throw new Error("Ese usuario no es un guardia activo.");

  const bloque = await db
    .prepare(`SELECT id_turnobloque FROM turno_bloque WHERE id_turnobloque = ? AND condominio_id_condominio = ?`)
    .get(input.turnoBloqueId, input.condominioId);
  if (!bloque) throw new Error("Bloque de turno inválido para este condominio.");

  const insert = await db
    .prepare(
      `INSERT INTO turno_asignado_guardia
         (guardia_usuario_id, turno_bloque_id_turnobloque, fecha, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(input.guardiaUsuarioId, input.turnoBloqueId, input.fecha, input.condominioId, creadoPorUsuarioId, formatDateTime(new Date()));

  return db
    .prepare(
      `SELECT ta.id_turnoasignado, ta.fecha, ta.guardia_usuario_id, u.nombre_usuario AS nombre_guardia,
              tb.id_turnobloque, tb.gls_turnobloque, tb.hora_inicio, tb.hora_termino
       FROM turno_asignado_guardia ta
       JOIN usuario u ON u.id_usuario = ta.guardia_usuario_id
       JOIN turno_bloque tb ON tb.id_turnobloque = ta.turno_bloque_id_turnobloque
       WHERE ta.id_turnoasignado = ?`
    )
    .get(Number(insert.lastInsertRowid));
}

export async function quitarTurno(id: number) {
  const existe = await db.prepare(`SELECT id_turnoasignado FROM turno_asignado_guardia WHERE id_turnoasignado = ?`).get(id);
  if (!existe) throw new Error(`No existe esa asignación de turno.`);
  await db.prepare(`DELETE FROM turno_asignado_guardia WHERE id_turnoasignado = ?`).run(id);
}

// ---------------------------------------------------------------------------
// Restricción de login del Guardia (llamada desde auth.service.ts, solo
// para rol === "Guardia"):
//   a) sin NINGÚN turno asignado nunca -> se le deja entrar (fail-open, el
//      condominio todavía no carga su calendario).
//   b) con turnos en general, pero ninguno esta semana -> también se le
//      deja entrar (mismo criterio: el jefe de guardias no alcanzó a
//      programar esta semana todavía, no corresponde bloquearlo por eso).
//   c) con turnos esta semana pero ninguno hoy -> bloqueado hoy.
//   d) con un turno hoy -> solo puede entrar dentro de
//      [hora_inicio - 15min, hora_termino + 15min] de alguno de sus
//      bloques de hoy.
// ---------------------------------------------------------------------------
const MINUTOS_GRACIA = 15;

export async function verificarTurnoParaLogin(usuarioId: number, condominioId: number): Promise<{ permitido: boolean; motivo?: string }> {
  const tieneAlguno = await db.prepare(`SELECT 1 AS ok FROM turno_asignado_guardia WHERE guardia_usuario_id = ? LIMIT 1`).get(usuarioId);
  if (!tieneAlguno) return { permitido: true };

  const ahora = new Date();
  const lunes = inicioSemana(ahora);
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  const hoyStr = formatFecha(ahora);

  const turnosSemana = (await db
    .prepare(`SELECT fecha FROM turno_asignado_guardia WHERE guardia_usuario_id = ? AND condominio_id_condominio = ? AND fecha BETWEEN ? AND ?`)
    .all(usuarioId, condominioId, formatFecha(lunes), formatFecha(domingo))) as { fecha: string }[];
  if (turnosSemana.length === 0) return { permitido: true };

  const turnosHoy = (await db
    .prepare(
      `SELECT tb.hora_inicio, tb.hora_termino
       FROM turno_asignado_guardia ta
       JOIN turno_bloque tb ON tb.id_turnobloque = ta.turno_bloque_id_turnobloque
       WHERE ta.guardia_usuario_id = ? AND ta.condominio_id_condominio = ? AND ta.fecha = ?`
    )
    .all(usuarioId, condominioId, hoyStr)) as { hora_inicio: string; hora_termino: string }[];

  if (turnosHoy.length === 0) {
    return { permitido: false, motivo: "No tienes un turno asignado para hoy. Consulta el calendario con tu jefe de guardias." };
  }

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const dentroDeAlgunBloque = turnosHoy.some(({ hora_inicio, hora_termino }) => {
    const [hi, mi] = hora_inicio.split(":").map(Number);
    const [ht, mt] = hora_termino.split(":").map(Number);
    const inicio = hi * 60 + mi - MINUTOS_GRACIA;
    const termino = ht * 60 + mt + MINUTOS_GRACIA;
    return minutosAhora >= inicio && minutosAhora <= termino;
  });

  if (!dentroDeAlgunBloque) {
    return { permitido: false, motivo: "Tu turno de hoy todavía no comienza o ya terminó (con 15 minutos de margen)." };
  }
  return { permitido: true };
}
