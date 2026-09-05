import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { sincronizarMembresiaPrincipal } from "./auth.service";
import { crearNotificacionParaUsuario, enviarPushesDeNotificacion, GLS_TIPONOTIF_TAREA_PERSONAL } from "./notificaciones.service";

// Ronda 18, a pedido del usuario: "el personal externo que trabaja en el
// condominio, por ejemplo la señora del aseo, el jardinero, el maestro que
// repara los techos... la administración y el comité le dejan como mensajes
// o tareas diarias". Se modeló como un tipo_usuario más ('Personal'), con
// login propio (usuariocol/password asignados por el administrador al
// crearlo, igual que un Guardia — no un flujo de "activar acceso" aparte
// como en Residente, porque el personal SIEMPRE tiene cuenta desde el día
// uno). Cubre tres cosas: (1) ficha + especialidad, (2) turno (el propio
// trabajador marca inicio/salida desde su app), (3) tareas puntuales que
// administrador/comité le escriben (texto libre, no una plantilla de
// checklist — el usuario prefirió que llegue como notificación).

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

async function getIdByGls(table: string, idColumn: string, glsColumn: string, valor: string): Promise<number> {
  const row = (await db.prepare(`SELECT ${idColumn} as id FROM ${table} WHERE ${glsColumn} = ?`).get(valor)) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`No se encontró "${valor}" en ${table}.`);
  return row.id;
}

async function esPersonalVigente(usuarioId: number): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE u.id_usuario = ? AND tu.gls_tipousuario = 'Personal' AND u.flg_vigencia = 1`
    )
    .get(usuarioId)) as { id_usuario: number } | undefined;
  return !!row;
}

// ---------------------------------------------------------------------------
// Catálogo de especialidades (tipo_personal)
// ---------------------------------------------------------------------------

export async function listarTiposPersonal(condominioId: number) {
  return db
    .prepare(`SELECT id_tipopersonal, gls_tipopersonal FROM tipo_personal WHERE condominio_id_condominio = ? AND flg_vigencia = 1 ORDER BY gls_tipopersonal`)
    .all(condominioId);
}

// ---------------------------------------------------------------------------
// Ficha de personal externo (Administrador/Comité)
// ---------------------------------------------------------------------------

// Ronda 61, a pedido explícito del usuario: mismo bug exacto — no
// filtraba por condominio en absoluto.
export async function listarPersonal(condominioId: number) {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia, u.flg_interno, u.empresa_externa,
              u.tipo_personal_id_tipopersonal, tp.gls_tipopersonal,
              u.jefe_id_usuario, jefe.nombre_usuario AS jefe_nombre,
              EXISTS(SELECT 1 FROM turno_personal t WHERE t.usuario_id_usuario = u.id_usuario AND t.fecha_termino IS NULL) as turno_abierto
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       LEFT JOIN tipo_personal tp ON tp.id_tipopersonal = u.tipo_personal_id_tipopersonal
       LEFT JOIN usuario jefe ON jefe.id_usuario = u.jefe_id_usuario
       WHERE tu.gls_tipousuario = 'Personal' AND u.condominio_id_condominio = ?
       ORDER BY u.nombre_usuario`
    )
    .all(condominioId);
}

export async function crearPersonal(input: {
  nombre_usuario: string;
  usuariocol: string;
  password: string;
  condominio_id_condominio: number;
  tipo_personal_id_tipopersonal?: number;
  // Ronda 68, a pedido explícito del usuario: el administrador decide
  // manualmente a qué Jefe de área reporta este trabajador (o a ninguno,
  // si el administrador lo supervisa directo).
  jefe_id_usuario?: number | null;
  // Ronda 69, a pedido explícito del usuario: "¿tenemos si... el personal
  // de jardinería y aseo son internos?" — antes no había ningún dato de
  // esto.
  flg_interno?: boolean | null;
  empresa_externa?: string | null;
}) {
  const tipoPersonalUsuarioId = await getIdByGls("tipo_usuario", "id_tipousuario", "gls_tipousuario", "Personal");
  if (input.jefe_id_usuario) {
    await validarJefeDelMismoCondominio(input.jefe_id_usuario, input.condominio_id_condominio);
  }
  const passwordHash = bcrypt.hashSync(input.password, 10);
  const insert = await db
    .prepare(
      `INSERT INTO usuario (nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio, tipo_personal_id_tipopersonal, jefe_id_usuario, flg_interno, empresa_externa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.nombre_usuario,
      input.usuariocol,
      passwordHash,
      tipoPersonalUsuarioId,
      input.condominio_id_condominio,
      input.tipo_personal_id_tipopersonal ?? null,
      input.jefe_id_usuario ?? null,
      input.flg_interno === undefined || input.flg_interno === null ? null : input.flg_interno ? 1 : 0,
      input.flg_interno === false ? input.empresa_externa?.trim() || null : null
    );
  const id = Number(insert.lastInsertRowid);
  await sincronizarMembresiaPrincipal(id);
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia, u.flg_interno, u.empresa_externa,
              u.tipo_personal_id_tipopersonal, tp.gls_tipopersonal,
              u.jefe_id_usuario, jefe.nombre_usuario AS jefe_nombre, 0 as turno_abierto
       FROM usuario u
       LEFT JOIN tipo_personal tp ON tp.id_tipopersonal = u.tipo_personal_id_tipopersonal
       LEFT JOIN usuario jefe ON jefe.id_usuario = u.jefe_id_usuario
       WHERE u.id_usuario = ?`
    )
    .get(id);
}

// Ronda 68: confirma que `jefeId` sea de verdad un Jefe de área
// (JefeGuardias/JefeAseo/JefeJardineria) del MISMO condominio — evita que
// alguien asigne un trabajador a un "jefe" que en realidad es de otro
// condominio, o que ni siquiera es un jefe (mismo criterio IDOR de
// siempre en este proyecto).
async function validarJefeDelMismoCondominio(jefeId: number, condominioId: number) {
  const jefe = await db
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE u.id_usuario = ? AND u.condominio_id_condominio = ?
         AND tu.gls_tipousuario IN ('JefeGuardias','JefeAseo','JefeJardineria')`
    )
    .get(jefeId, condominioId);
  if (!jefe) {
    throw new Error("Ese jefe no existe o no pertenece a este condominio.");
  }
}

export async function actualizarPersonal(
  id: number,
  input: {
    nombre_usuario?: string;
    password?: string;
    flg_vigencia?: number;
    tipo_personal_id_tipopersonal?: number | null;
    jefe_id_usuario?: number | null;
    condominio_id_condominio?: number; // para validar el jefe, si se manda
    flg_interno?: boolean | null;
    empresa_externa?: string | null;
  }
) {
  if (input.nombre_usuario !== undefined) {
    await db.prepare(`UPDATE usuario SET nombre_usuario = ? WHERE id_usuario = ?`).run(input.nombre_usuario, id);
  }
  if (input.password) {
    const hash = bcrypt.hashSync(input.password, 10);
    await db.prepare(`UPDATE usuario SET password_usuario = ? WHERE id_usuario = ?`).run(hash, id);
  }
  if (input.flg_vigencia !== undefined) {
    await db.prepare(`UPDATE usuario SET flg_vigencia = ? WHERE id_usuario = ?`).run(input.flg_vigencia, id);
  }
  if (input.tipo_personal_id_tipopersonal !== undefined) {
    await db
      .prepare(`UPDATE usuario SET tipo_personal_id_tipopersonal = ? WHERE id_usuario = ?`)
      .run(input.tipo_personal_id_tipopersonal, id);
  }
  if (input.jefe_id_usuario !== undefined) {
    if (input.jefe_id_usuario !== null && input.condominio_id_condominio) {
      await validarJefeDelMismoCondominio(input.jefe_id_usuario, input.condominio_id_condominio);
    }
    await db.prepare(`UPDATE usuario SET jefe_id_usuario = ? WHERE id_usuario = ?`).run(input.jefe_id_usuario, id);
  }
  if (input.flg_interno !== undefined) {
    const interno = input.flg_interno === null ? null : input.flg_interno ? 1 : 0;
    const empresa = input.flg_interno === false ? input.empresa_externa?.trim() || null : null;
    await db.prepare(`UPDATE usuario SET flg_interno = ?, empresa_externa = ? WHERE id_usuario = ?`).run(interno, empresa, id);
  }
  await sincronizarMembresiaPrincipal(id);
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia, u.flg_interno, u.empresa_externa,
              u.tipo_personal_id_tipopersonal, tp.gls_tipopersonal,
              u.jefe_id_usuario, jefe.nombre_usuario AS jefe_nombre,
              EXISTS(SELECT 1 FROM turno_personal t WHERE t.usuario_id_usuario = u.id_usuario AND t.fecha_termino IS NULL) as turno_abierto
       FROM usuario u
       LEFT JOIN tipo_personal tp ON tp.id_tipopersonal = u.tipo_personal_id_tipopersonal
       LEFT JOIN usuario jefe ON jefe.id_usuario = u.jefe_id_usuario
       WHERE u.id_usuario = ?`
    )
    .get(id);
}

// ---------------------------------------------------------------------------
// Turno (autoservicio del propio trabajador — "Empezar turno"/"Marcar salida")
// ---------------------------------------------------------------------------

export async function iniciarTurno(usuarioId: number, condominioId: number) {
  const abierto = (await db
    .prepare(`SELECT id_turnopersonal FROM turno_personal WHERE usuario_id_usuario = ? AND fecha_termino IS NULL`)
    .get(usuarioId)) as { id_turnopersonal: number } | undefined;
  if (abierto) {
    throw new Error("Ya tienes un turno abierto — márcalo como salida antes de empezar uno nuevo.");
  }
  const ahora = formatDateTime(new Date());
  const insert = await db
    .prepare(`INSERT INTO turno_personal (usuario_id_usuario, condominio_id_condominio, fecha_inicio) VALUES (?, ?, ?)`)
    .run(usuarioId, condominioId, ahora);
  return db.prepare(`SELECT id_turnopersonal, fecha_inicio, fecha_termino FROM turno_personal WHERE id_turnopersonal = ?`).get(Number(insert.lastInsertRowid));
}

export async function finalizarTurno(usuarioId: number) {
  const abierto = (await db
    .prepare(`SELECT id_turnopersonal FROM turno_personal WHERE usuario_id_usuario = ? AND fecha_termino IS NULL`)
    .get(usuarioId)) as { id_turnopersonal: number } | undefined;
  if (!abierto) {
    throw new Error("No tienes un turno abierto.");
  }
  await db
    .prepare(`UPDATE turno_personal SET fecha_termino = ? WHERE id_turnopersonal = ?`)
    .run(formatDateTime(new Date()), abierto.id_turnopersonal);
  return db.prepare(`SELECT id_turnopersonal, fecha_inicio, fecha_termino FROM turno_personal WHERE id_turnopersonal = ?`).get(abierto.id_turnopersonal);
}

export async function getTurnoActual(usuarioId: number) {
  const row = await db
    .prepare(`SELECT id_turnopersonal, fecha_inicio, fecha_termino FROM turno_personal WHERE usuario_id_usuario = ? AND fecha_termino IS NULL`)
    .get(usuarioId);
  return row ?? null;
}

/** Historial de turnos de UN trabajador (Administrador/Comité) — más reciente primero. */
export async function listarTurnosDePersonal(usuarioId: number) {
  return db
    .prepare(`SELECT id_turnopersonal, fecha_inicio, fecha_termino FROM turno_personal WHERE usuario_id_usuario = ? ORDER BY fecha_inicio DESC`)
    .all(usuarioId);
}

// Ronda 40, a pedido explícito del usuario: "quién viene hoy" — vista para
// cualquier residente (no solo Administrador/Comité) de qué personal
// externo (aseo, jardinería, mantención, etc.) tiene turno registrado HOY
// en el condominio, esté trabajando ahora mismo o ya se haya retirado. Se
// arma con turno_personal.fecha_inicio = hoy — no existe hoy un concepto
// de "agendado con anticipación" para Personal (a diferencia de
// Mantenciones, que sí se programan con fecha_programada — ver
// mantencion.service.ts), así que esto muestra quién efectivamente marcó
// turno hoy, condominio completo (no depende de depto).
export async function listarPersonalEnTurnoHoy(condominioId: number) {
  return db
    .prepare(
      `SELECT tper.id_turnopersonal, tper.fecha_inicio, tper.fecha_termino,
              u.id_usuario, u.nombre_usuario, tp.gls_tipopersonal
       FROM turno_personal tper
       JOIN usuario u ON u.id_usuario = tper.usuario_id_usuario
       LEFT JOIN tipo_personal tp ON tp.id_tipopersonal = u.tipo_personal_id_tipopersonal
       WHERE tper.condominio_id_condominio = ? AND DATE(tper.fecha_inicio) = CURDATE()
       ORDER BY tper.fecha_inicio DESC`
    )
    .all(condominioId);
}

// ---------------------------------------------------------------------------
// Tareas (administrador/comité escribe, el trabajador la completa)
// ---------------------------------------------------------------------------

export async function asignarTarea(input: {
  usuarioId: number;
  descripcion: string;
  creadoPorUsuarioId: number;
  condominioId: number;
}) {
  if (!input.descripcion?.trim()) {
    throw new Error("Falta la descripción de la tarea.");
  }
  if (!(await esPersonalVigente(input.usuarioId))) {
    throw new Error("Ese usuario no es personal externo activo.");
  }
  const descripcion = input.descripcion.trim();
  const ahora = formatDateTime(new Date());
  const insert = await db
    .prepare(
      `INSERT INTO tarea_personal (usuario_id_usuario, descripcion, estado, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, 'Pendiente', ?, ?, ?)`
    )
    .run(input.usuarioId, descripcion, input.condominioId, input.creadoPorUsuarioId, ahora);
  const idTarea = Number(insert.lastInsertRowid);

  // Igual que un comunicado (ronda 16): no corre dentro de ninguna
  // transacción existente, así que acá mismo se manda también el push —
  // best-effort, nunca rompe si falla (ver enviarPushesDeNotificacion).
  const idNotificacion = await crearNotificacionParaUsuario(db, {
    condominioId: input.condominioId,
    tipoGls: GLS_TIPONOTIF_TAREA_PERSONAL,
    titulo: "Nueva tarea asignada",
    cuerpo: descripcion,
    usuarioId: input.usuarioId,
    referenciaTipo: "tarea_personal",
    referenciaId: idTarea,
    creadoPorUsuarioId: input.creadoPorUsuarioId,
  });
  await enviarPushesDeNotificacion(idNotificacion);

  return db.prepare(`SELECT id_tareapersonal, descripcion, estado, fecha_creacion, fecha_completada FROM tarea_personal WHERE id_tareapersonal = ?`).get(idTarea);
}

/** Historial de tareas para Administrador/Comité — de un trabajador puntual, o de todo el condominio. */
export async function listarTareasAsignadas(filtro: { condominioId: number; usuarioId?: number }) {
  const condiciones = ["tp.condominio_id_condominio = ?"];
  const params: any[] = [filtro.condominioId];
  if (filtro.usuarioId) {
    condiciones.push("tp.usuario_id_usuario = ?");
    params.push(filtro.usuarioId);
  }
  return db
    .prepare(
      `SELECT tp.id_tareapersonal, tp.descripcion, tp.estado, tp.fecha_creacion, tp.fecha_completada,
              tp.usuario_id_usuario, u.nombre_usuario as nombre_personal,
              c.nombre_usuario as creado_por_nombre
       FROM tarea_personal tp
       JOIN usuario u ON u.id_usuario = tp.usuario_id_usuario
       JOIN usuario c ON c.id_usuario = tp.creado_por_usuario_id
       WHERE ${condiciones.join(" AND ")}
       ORDER BY tp.fecha_creacion DESC`
    )
    .all(...params);
}

/** Bandeja propia de tareas del trabajador logeado — más reciente primero. */
export async function listarMisTareas(usuarioId: number) {
  return db
    .prepare(
      `SELECT id_tareapersonal, descripcion, estado, fecha_creacion, fecha_completada
       FROM tarea_personal WHERE usuario_id_usuario = ? ORDER BY fecha_creacion DESC`
    )
    .all(usuarioId);
}

/** El trabajador marca UNA tarea propia como completada (nunca la de otro). */
export async function completarTarea(idTarea: number, usuarioId: number) {
  const tarea = (await db
    .prepare(`SELECT id_tareapersonal, estado FROM tarea_personal WHERE id_tareapersonal = ? AND usuario_id_usuario = ?`)
    .get(idTarea, usuarioId)) as { id_tareapersonal: number; estado: string } | undefined;
  if (!tarea) throw new Error("No existe esa tarea para tu usuario.");
  if (tarea.estado === "Completada") throw new Error("Esa tarea ya estaba marcada como completada.");
  await db
    .prepare(`UPDATE tarea_personal SET estado = 'Completada', fecha_completada = ? WHERE id_tareapersonal = ?`)
    .run(formatDateTime(new Date()), idTarea);
  return db.prepare(`SELECT id_tareapersonal, descripcion, estado, fecha_creacion, fecha_completada FROM tarea_personal WHERE id_tareapersonal = ?`).get(idTarea);
}
