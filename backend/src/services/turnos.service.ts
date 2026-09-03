import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Turnos de guardias (ronda 20): rol JEFE_GUARDIAS gestiona el calendario de
// "bloques fijos por día" (Mañana/Tarde/Noche, catalogados por condominio con
// su horario — ver seed.ts) y asigna qué guardia cubre cada bloque cada día.
// A pedido explícito del usuario, este calendario SÍ restringe el login del
// guardia — ver verificarTurnoParaLogin, llamada desde auth.service.ts. La
// nota completa de la regla de negocio (y el supuesto sobre "fail-open"
// cuando todavía no hay turnos cargados) está en docs/schema-mysql.sql,
// sobre la tabla turno_asignado_guardia.
//
// Ronda 39, a pedido explícito del usuario (mostró un roster mensual hecho
// en Excel, formato "4x4"): se agregó
//   1) CRUD de bloques (antes fijos, sembrados una vez, no editables) —
//      crearBloque/actualizarBloque/eliminarBloque.
//   2) Vista mensual: ya la soportaba listarTurnosSemana con fechas
//      explícitas (renombrada acá a listarTurnos para reflejar que no es
//      solo semanal), el front ahora pide un mes en vez de una semana.
//   3) generarPatronTurnos: dado un rango de fechas, un bloque de día y uno
//      de noche, una lista ORDENADA de "duplas" (guardia de día + guardia
//      de noche) y cuántos días seguidos cubre cada dupla, completa todo el
//      rango solo, rotando cíclicamente por la lista de duplas — reproduce
//      el patrón "4x4" del Excel (incluido el caso real del usuario, donde
//      una de las dos duplas alterna quién hace de día y quién de noche:
//      se logra simplemente agregando esa dupla dos veces a la lista, con
//      los roles invertidos, en el orden que corresponda).
//   4) El JefeGuardias ahora puede asignarse turno a sí mismo (antes el
//      sistema solo reconocía rol Guardia en el calendario) — ver
//      listarPersonalParaTurno y el chequeo de asignarTurno.
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
function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return formatFecha(d);
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

// --- Bloques de turno --------------------------------------------------

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

function validarHoraHHMM(valor: string, campo: string) {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(valor)) {
    throw new Error(`${campo} debe tener formato HH:MM (ej: 20:00).`);
  }
}

export async function crearBloque(condominioId: number, input: { gls_turnobloque: string; hora_inicio: string; hora_termino: string }) {
  if (!input.gls_turnobloque?.trim()) throw new Error("Falta el nombre del bloque (ej: 'Día', 'Noche').");
  validarHoraHHMM(input.hora_inicio, "La hora de inicio");
  validarHoraHHMM(input.hora_termino, "La hora de término");
  const insert = await db
    .prepare(`INSERT INTO turno_bloque (gls_turnobloque, hora_inicio, hora_termino, condominio_id_condominio) VALUES (?, ?, ?, ?)`)
    .run(input.gls_turnobloque.trim(), input.hora_inicio, input.hora_termino, condominioId);
  return db
    .prepare(`SELECT id_turnobloque, gls_turnobloque, hora_inicio, hora_termino FROM turno_bloque WHERE id_turnobloque = ?`)
    .get(Number(insert.lastInsertRowid));
}

export async function actualizarBloque(id: number, input: { gls_turnobloque?: string; hora_inicio?: string; hora_termino?: string }) {
  const existente = await db.prepare(`SELECT id_turnobloque FROM turno_bloque WHERE id_turnobloque = ?`).get(id);
  if (!existente) throw new Error("No existe ese bloque de turno.");
  if (input.hora_inicio) validarHoraHHMM(input.hora_inicio, "La hora de inicio");
  if (input.hora_termino) validarHoraHHMM(input.hora_termino, "La hora de término");

  const campos: string[] = [];
  const valores: unknown[] = [];
  if (input.gls_turnobloque !== undefined) {
    campos.push("gls_turnobloque = ?");
    valores.push(input.gls_turnobloque.trim());
  }
  if (input.hora_inicio !== undefined) {
    campos.push("hora_inicio = ?");
    valores.push(input.hora_inicio);
  }
  if (input.hora_termino !== undefined) {
    campos.push("hora_termino = ?");
    valores.push(input.hora_termino);
  }
  if (campos.length > 0) {
    valores.push(id);
    await db.prepare(`UPDATE turno_bloque SET ${campos.join(", ")} WHERE id_turnobloque = ?`).run(...valores);
  }
  return db
    .prepare(`SELECT id_turnobloque, gls_turnobloque, hora_inicio, hora_termino FROM turno_bloque WHERE id_turnobloque = ?`)
    .get(id);
}

// Soft-delete (flg_vigencia = 0), mismo criterio que el resto del sistema —
// no se borra de verdad porque turnos ya asignados en el pasado siguen
// apuntando a este bloque (referencia histórica, no debería romperse).
export async function eliminarBloque(id: number) {
  const existente = await db.prepare(`SELECT id_turnobloque FROM turno_bloque WHERE id_turnobloque = ?`).get(id);
  if (!existente) throw new Error("No existe ese bloque de turno.");
  await db.prepare(`UPDATE turno_bloque SET flg_vigencia = 0 WHERE id_turnobloque = ?`).run(id);
}

// --- Personal asignable a un turno (Guardia + JefeGuardias) -------------

// Ronda 39: antes solo "Guardia" podía tener un turno asignado — el
// JefeGuardias no aparecía en ningún lado del calendario, aunque en la
// práctica también hace turno. Función APARTE de listarGuardias()
// (admin.service.ts, que sigue siendo solo para el CRUD de cuentas de
// guardias) para no mezclar "quién administro" con "a quién puedo poner en
// el calendario".
export async function listarPersonalParaTurno(condominioId: number) {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, tu.gls_tipousuario AS rol
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE tu.gls_tipousuario IN ('Guardia', 'JefeGuardias')
         AND u.condominio_id_condominio = ? AND u.flg_vigencia = 1
       ORDER BY tu.gls_tipousuario, u.nombre_usuario`
    )
    .all(condominioId);
}

// --- Calendario de turnos (cualquier rango — antes solo semana) --------

/** Calendario de turnos del rango pedido; sin fechas, la semana en curso (lunes a domingo). */
export async function listarTurnos(condominioId: number, fechaInicio?: string, fechaTermino?: string) {
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
      `SELECT ta.id_turnoasignado, ta.fecha, ta.guardia_usuario_id, u.nombre_usuario AS nombre_guardia, tu.gls_tipousuario AS rol_guardia,
              tb.id_turnobloque, tb.gls_turnobloque, tb.hora_inicio, tb.hora_termino
       FROM turno_asignado_guardia ta
       JOIN usuario u ON u.id_usuario = ta.guardia_usuario_id
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       JOIN turno_bloque tb ON tb.id_turnobloque = ta.turno_bloque_id_turnobloque
       WHERE ta.condominio_id_condominio = ? AND ta.fecha BETWEEN ? AND ?
       ORDER BY ta.fecha, tb.hora_inicio`
    )
    .all(condominioId, formatFecha(lunes), formatFecha(domingo));
}

async function validarPersonaAsignable(usuarioId: number) {
  const persona = await db
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE u.id_usuario = ? AND tu.gls_tipousuario IN ('Guardia', 'JefeGuardias') AND u.flg_vigencia = 1`
    )
    .get(usuarioId);
  if (!persona) throw new Error("Ese usuario no es un guardia ni jefe de guardias activo.");
}

export async function asignarTurno(
  input: { guardiaUsuarioId: number; turnoBloqueId: number; fecha: string; condominioId: number },
  creadoPorUsuarioId: number
) {
  await validarPersonaAsignable(input.guardiaUsuarioId);

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

// --- Generador de patrón (ej. "4x4") ------------------------------------

export interface DuplaPatron {
  guardiaDiaId: number;
  guardiaNocheId: number;
}

export interface GenerarPatronInput {
  condominioId: number;
  fechaInicio: string; // primer día cubierto por duplas[0]
  fechaTermino: string; // último día cubierto (incluido)
  bloqueDiaId: number;
  bloqueNocheId: number;
  diasPorBloque: number; // ej: 4 para un patrón "4x4"
  duplas: DuplaPatron[]; // orden = orden de rotación, se repite cíclicamente
}

/**
 * Genera el calendario completo del rango pedido, rotando cíclicamente por
 * `duplas` cada `diasPorBloque` días. SIEMPRE sobrescribe cualquier
 * asignación previa que ya existiera en el rango para este condominio
 * (cualquier guardia, cualquier bloque) — es la forma de "rehacer el mes"
 * de forma limpia, como se pediría en el Excel. Si se necesita un ajuste
 * puntual después (ej. un guardia con licencia un día), se sigue pudiendo
 * hacer a mano con asignarTurno/quitarTurno sobre un día suelto.
 */
export async function generarPatronTurnos(input: GenerarPatronInput, creadoPorUsuarioId: number) {
  if (!input.duplas || input.duplas.length === 0) {
    throw new Error("Agrega al menos una dupla (guardia de día + guardia de noche).");
  }
  if (!Number.isInteger(input.diasPorBloque) || input.diasPorBloque < 1) {
    throw new Error("Los días por bloque deben ser un número entero de al menos 1.");
  }
  if (input.fechaTermino < input.fechaInicio) {
    throw new Error("La fecha de término debe ser posterior a la de inicio.");
  }

  const bloqueDia = await db
    .prepare(`SELECT id_turnobloque FROM turno_bloque WHERE id_turnobloque = ? AND condominio_id_condominio = ?`)
    .get(input.bloqueDiaId, input.condominioId);
  const bloqueNoche = await db
    .prepare(`SELECT id_turnobloque FROM turno_bloque WHERE id_turnobloque = ? AND condominio_id_condominio = ?`)
    .get(input.bloqueNocheId, input.condominioId);
  if (!bloqueDia || !bloqueNoche) throw new Error("Bloque de día o de noche inválido para este condominio.");

  for (const dupla of input.duplas) {
    await validarPersonaAsignable(dupla.guardiaDiaId);
    await validarPersonaAsignable(dupla.guardiaNocheId);
  }

  // Sobrescribe: borra cualquier asignación existente en el rango para
  // este condominio antes de generar de nuevo.
  await db
    .prepare(`DELETE FROM turno_asignado_guardia WHERE condominio_id_condominio = ? AND fecha BETWEEN ? AND ?`)
    .run(input.condominioId, input.fechaInicio, input.fechaTermino);

  const ahora = formatDateTime(new Date());
  let fechaActual = input.fechaInicio;
  let diaOffset = 0;
  let filasGeneradas = 0;

  while (fechaActual <= input.fechaTermino) {
    const indiceDupla = Math.floor(diaOffset / input.diasPorBloque) % input.duplas.length;
    const dupla = input.duplas[indiceDupla];

    await db
      .prepare(
        `INSERT INTO turno_asignado_guardia
           (guardia_usuario_id, turno_bloque_id_turnobloque, fecha, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(dupla.guardiaDiaId, input.bloqueDiaId, fechaActual, input.condominioId, creadoPorUsuarioId, ahora);
    await db
      .prepare(
        `INSERT INTO turno_asignado_guardia
           (guardia_usuario_id, turno_bloque_id_turnobloque, fecha, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(dupla.guardiaNocheId, input.bloqueNocheId, fechaActual, input.condominioId, creadoPorUsuarioId, ahora);

    filasGeneradas += 2;
    diaOffset++;
    fechaActual = sumarDias(fechaActual, 1);
  }

  return { dias_generados: diaOffset, asignaciones_creadas: filasGeneradas };
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
//      bloques de hoy. Ronda 39: ahora soporta bloques que CRUZAN
//      medianoche (ej. Noche 20:00-08:00, necesario para el patrón 4x4)
//      — antes, un bloque así nunca daba "dentro de rango" (bug real, no
//      se había notado porque los 3 bloques sembrados originalmente
//      nunca cruzaban medianoche).
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
  const ayerStr = sumarDias(hoyStr, -1);

  const turnosSemana = (await db
    .prepare(`SELECT fecha FROM turno_asignado_guardia WHERE guardia_usuario_id = ? AND condominio_id_condominio = ? AND fecha BETWEEN ? AND ?`)
    .all(usuarioId, condominioId, formatFecha(lunes), formatFecha(domingo))) as { fecha: string }[];
  if (turnosSemana.length === 0) return { permitido: true };

  // Ronda 39: además de los turnos de HOY, hay que revisar los de AYER —
  // un bloque que cruza medianoche (ej. Noche 20:00-08:00) sigue vigente
  // hasta las 08:15 del día siguiente, así que si son las 02:00 hay que
  // mirar el turno que empezó ayer, no el de hoy (que a esa hora ni
  // siquiera empezó).
  const turnosHoyYAyer = (await db
    .prepare(
      `SELECT ta.fecha, tb.hora_inicio, tb.hora_termino
       FROM turno_asignado_guardia ta
       JOIN turno_bloque tb ON tb.id_turnobloque = ta.turno_bloque_id_turnobloque
       WHERE ta.guardia_usuario_id = ? AND ta.condominio_id_condominio = ? AND ta.fecha IN (?, ?)`
    )
    .all(usuarioId, condominioId, hoyStr, ayerStr)) as { fecha: string; hora_inicio: string; hora_termino: string }[];

  if (turnosHoyYAyer.filter((t) => t.fecha === hoyStr).length === 0 && turnosHoyYAyer.filter((t) => t.fecha === ayerStr).length === 0) {
    return { permitido: false, motivo: "No tienes un turno asignado para hoy. Consulta el calendario con tu jefe de guardias." };
  }

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const dentroDeAlgunBloque = turnosHoyYAyer.some(({ fecha, hora_inicio, hora_termino }) => {
    const [hi, mi] = hora_inicio.split(":").map(Number);
    const [ht, mt] = hora_termino.split(":").map(Number);
    const cruzaMedianoche = hi * 60 + mi >= ht * 60 + mt;

    if (!cruzaMedianoche) {
      // Bloque normal, mismo día (ej. Día 08:00-20:00). Solo aplica si el
      // turno es de HOY.
      if (fecha !== hoyStr) return false;
      const inicio = hi * 60 + mi - MINUTOS_GRACIA;
      const termino = ht * 60 + mt + MINUTOS_GRACIA;
      return minutosAhora >= inicio && minutosAhora <= termino;
    }

    // Bloque que cruza medianoche (ej. Noche 20:00-08:00). Si el turno es
    // de HOY, la ventana válida es [hora_inicio, medianoche] hoy o
    // [medianoche, hora_termino] mañana — acá solo se evalúa "hoy en
    // adelante" (la parte de mañana la cubre el registro de AYER de la
    // próxima vuelta del reloj). Si el turno es de AYER, la ventana válida
    // es [medianoche, hora_termino] de HOY.
    if (fecha === hoyStr) {
      const inicio = hi * 60 + mi - MINUTOS_GRACIA;
      return minutosAhora >= inicio; // desde el inicio del bloque hasta medianoche (fin del día)
    }
    if (fecha === ayerStr) {
      const termino = ht * 60 + mt + MINUTOS_GRACIA;
      return minutosAhora <= termino;
    }
    return false;
  });

  if (!dentroDeAlgunBloque) {
    return { permitido: false, motivo: "Tu turno de hoy todavía no comienza o ya terminó (con 15 minutos de margen)." };
  }
  return { permitido: true };
}

// ---------------------------------------------------------------------------
// Ronda 53, a pedido explícito del usuario, con referencia visual: resumen
// de cuántos turnos de cada bloque tiene asignado cada guardia en un rango
// (para el dashboard del JefeGuardias — "Turnos septiembre: 07:00-15:00
// x8, 23:00-07:00 x7"). Dato 100% real, agregado directo de
// turno_asignado_guardia — no es una proyección ni un promedio.
// ---------------------------------------------------------------------------
export async function resumenTurnosDelMes(condominioId: number, fechaInicio: string, fechaTermino: string) {
  return db
    .prepare(
      `SELECT ta.guardia_usuario_id, tb.id_turnobloque, tb.gls_turnobloque, tb.hora_inicio, tb.hora_termino, COUNT(*) AS cantidad
       FROM turno_asignado_guardia ta
       JOIN turno_bloque tb ON tb.id_turnobloque = ta.turno_bloque_id_turnobloque
       WHERE ta.condominio_id_condominio = ? AND ta.fecha BETWEEN ? AND ?
       GROUP BY ta.guardia_usuario_id, tb.id_turnobloque
       ORDER BY tb.hora_inicio`
    )
    .all(condominioId, fechaInicio, fechaTermino);
}
