import { db, withTransaction, DbLike } from "../db/client";
import {
  crearNotificacionParaCondominio,
  enviarPushesDeNotificacion,
  GLS_TIPONOTIF_MANTENCION_PROGRAMADA,
  GLS_TIPONOTIF_MANTENCION_EN_CURSO,
} from "./notificaciones.service";

// Ronda 19, a pedido del usuario: mantenciones son las limpiezas de techo,
// piscina, ascensores, etc. — trabajo hecho por una empresa/contratista
// EXTERNA sin cuenta en el sistema (a diferencia de Personal, ronda 18, que
// sí tiene login). Reglas cerradas con el usuario antes de construir:
//
// (1) Solo Administrador/Comité programa una mantención (puntual, sin
//     recurrencia automática — "todos los veranos... no hay problema que
//     fuese puntual").
// (2) El guardia SIEMPRE elige de la lista de mantenciones ya programadas
//     cuál está llegando a realizar (nunca registra una "suelta") y anota
//     empresa + persona + RUT.
// (3) Al marcar la salida, la mantención pasa sola a "Realizada" (mismo
//     patrón que marcarLlegada/marcarSalida de Reservas).
// (4) El costo es solo informativo — no se prorratea en el gasto común.
// (5) Comprobantes/fotos los sube Administrador/Comité después, al recibir
//     la factura de la empresa (no el guardia).
// (6) Se avisa a los residentes en dos momentos: al programar (anticipado)
//     y al iniciar (cuando el guardia marca el ingreso) — mismo mecanismo
//     de "para todo el condominio" que un comunicado, pero generado por el
//     propio sistema.
// (7) El catálogo de elementos de infraestructura (techo, piscina,
//     ascensor...) es propio de cada condominio y editable por
//     administrador (a diferencia de otros catálogos cerrados del MVP).

const ESTADOS = {
  PROGRAMADA: "Programada",
  EN_CURSO: "En curso",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
} as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

async function getEstadoId(conn: DbLike, gls: string): Promise<number> {
  const row = (await conn.prepare(`SELECT id_estadomantencion FROM estado_mantencion WHERE gls_estadomantencion = ?`).get(gls)) as
    | { id_estadomantencion: number }
    | undefined;
  if (!row) throw new Error(`Estado de mantención "${gls}" no existe (revisa el seed).`);
  return row.id_estadomantencion;
}

// ---------------------------------------------------------------------------
// Catálogo de elementos de infraestructura (Administrador/Comité) —
// editable por condominio, a diferencia de otros catálogos cerrados del MVP
// (tipo_personal, tipo_notificacion).
// ---------------------------------------------------------------------------

export async function listarTiposElementoMantencion(condominioId: number, incluirInactivos = false) {
  const base = `SELECT id_tipoelementomantencion, gls_tipoelementomantencion, flg_vigencia
                FROM tipo_elemento_mantencion WHERE condominio_id_condominio = ?`;
  if (incluirInactivos) {
    return db.prepare(`${base} ORDER BY gls_tipoelementomantencion`).all(condominioId);
  }
  return db.prepare(`${base} AND flg_vigencia = 1 ORDER BY gls_tipoelementomantencion`).all(condominioId);
}

export async function crearTipoElementoMantencion(condominioId: number, gls: string) {
  if (!gls?.trim()) throw new Error("Falta el nombre del elemento de infraestructura.");
  const insert = await db
    .prepare(`INSERT INTO tipo_elemento_mantencion (gls_tipoelementomantencion, condominio_id_condominio) VALUES (?, ?)`)
    .run(gls.trim(), condominioId);
  return db
    .prepare(
      `SELECT id_tipoelementomantencion, gls_tipoelementomantencion, flg_vigencia FROM tipo_elemento_mantencion WHERE id_tipoelementomantencion = ?`
    )
    .get(Number(insert.lastInsertRowid));
}

export async function actualizarTipoElementoMantencion(
  id: number,
  input: { gls_tipoelementomantencion?: string; flg_vigencia?: number }
) {
  if (input.gls_tipoelementomantencion !== undefined) {
    if (!input.gls_tipoelementomantencion.trim()) throw new Error("El nombre del elemento no puede quedar vacío.");
    await db
      .prepare(`UPDATE tipo_elemento_mantencion SET gls_tipoelementomantencion = ? WHERE id_tipoelementomantencion = ?`)
      .run(input.gls_tipoelementomantencion.trim(), id);
  }
  if (input.flg_vigencia !== undefined) {
    await db.prepare(`UPDATE tipo_elemento_mantencion SET flg_vigencia = ? WHERE id_tipoelementomantencion = ?`).run(input.flg_vigencia, id);
  }
  return db
    .prepare(
      `SELECT id_tipoelementomantencion, gls_tipoelementomantencion, flg_vigencia FROM tipo_elemento_mantencion WHERE id_tipoelementomantencion = ?`
    )
    .get(id);
}

// ---------------------------------------------------------------------------
// Mantenciones
// ---------------------------------------------------------------------------

async function getMantencionConDetalle(conn: DbLike, id: number) {
  const mantencion = await conn
    .prepare(
      `SELECT m.*, te.gls_tipoelementomantencion, em.gls_estadomantencion,
              creador.nombre_usuario AS nombre_creador,
              cancelador.nombre_usuario AS nombre_cancelo,
              gl.nombre_usuario AS nombre_guardia_llegada,
              gs.nombre_usuario AS nombre_guardia_salida
       FROM mantencion m
       JOIN tipo_elemento_mantencion te ON te.id_tipoelementomantencion = m.tipo_elemento_mantencion_id_tipoelementomantencion
       JOIN estado_mantencion em ON em.id_estadomantencion = m.estado_mantencion_id_estadomantencion
       JOIN usuario creador ON creador.id_usuario = m.creado_por_usuario_id
       LEFT JOIN usuario cancelador ON cancelador.id_usuario = m.usuario_id_cancelo
       LEFT JOIN usuario gl ON gl.id_usuario = m.usuario_id_guardia_llegada
       LEFT JOIN usuario gs ON gs.id_usuario = m.usuario_id_guardia_salida
       WHERE m.id_mantencion = ?`
    )
    .get(id);
  if (!mantencion) throw new Error("No existe esa mantención.");
  return mantencion;
}

export async function getMantencion(id: number) {
  return getMantencionConDetalle(db, id);
}

export interface CrearMantencionInput {
  titulo: string;
  descripcion: string;
  tipoElementoMantencionId: number;
  condominioId: number;
  fechaProgramada: string; // YYYY-MM-DD
  costoEstimado?: number | null;
}

export async function crearMantencion(input: CrearMantencionInput, creadoPorUsuarioId: number) {
  if (!input.titulo?.trim()) throw new Error("Falta el título de la mantención.");
  if (!input.descripcion?.trim()) throw new Error("Falta la descripción del trabajo a realizar.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fechaProgramada || "")) {
    throw new Error("La fecha programada debe tener formato YYYY-MM-DD.");
  }
  const elemento = (await db
    .prepare(
      `SELECT gls_tipoelementomantencion FROM tipo_elemento_mantencion WHERE id_tipoelementomantencion = ? AND condominio_id_condominio = ?`
    )
    .get(input.tipoElementoMantencionId, input.condominioId)) as { gls_tipoelementomantencion: string } | undefined;
  if (!elemento) throw new Error("No existe ese elemento de infraestructura para este condominio.");

  const estadoProgramadaId = await getEstadoId(db, ESTADOS.PROGRAMADA);
  const ahora = formatDateTime(new Date());
  const insert = await db
    .prepare(
      `INSERT INTO mantencion
        (titulo, descripcion, tipo_elemento_mantencion_id_tipoelementomantencion, condominio_id_condominio, fecha_programada,
         estado_mantencion_id_estadomantencion, costo_estimado, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.titulo.trim(),
      input.descripcion.trim(),
      input.tipoElementoMantencionId,
      input.condominioId,
      input.fechaProgramada,
      estadoProgramadaId,
      input.costoEstimado ?? null,
      creadoPorUsuarioId,
      ahora
    );
  const idMantencion = Number(insert.lastInsertRowid);

  // Aviso anticipado a todos los residentes activos del condominio — no
  // corre dentro de ninguna transacción, así que el push se manda acá
  // mismo, best-effort (mismo patrón que un comunicado / tarea_personal).
  const idNotificacion = await crearNotificacionParaCondominio(db, {
    condominioId: input.condominioId,
    tipoGls: GLS_TIPONOTIF_MANTENCION_PROGRAMADA,
    titulo: `Mantención programada: ${elemento.gls_tipoelementomantencion}`,
    cuerpo: `${input.titulo.trim()} — programada para el ${input.fechaProgramada}. ${input.descripcion.trim()}`,
    referenciaTipo: "mantencion",
    referenciaId: idMantencion,
    creadoPorUsuarioId,
  });
  await enviarPushesDeNotificacion(idNotificacion);

  return getMantencionConDetalle(db, idMantencion);
}

const CAMPOS_EDITABLES_MANTENCION = [
  "titulo",
  "descripcion",
  "tipo_elemento_mantencion_id_tipoelementomantencion",
  "fecha_programada",
  "costo_estimado",
] as const;

// Solo se puede editar mientras está Programada — una vez que la empresa ya
// llegó (En curso) o el trabajo terminó (Realizada/Cancelada), los datos de
// planificación quedan fijos (el costo real y los comprobantes se agregan
// aparte, ver actualizarDatosFinalesMantencion).
export async function actualizarMantencion(id: number, input: Partial<Record<(typeof CAMPOS_EDITABLES_MANTENCION)[number], any>>) {
  const actual = (await db.prepare(`SELECT estado_mantencion_id_estadomantencion FROM mantencion WHERE id_mantencion = ?`).get(id)) as
    | { estado_mantencion_id_estadomantencion: number }
    | undefined;
  if (!actual) throw new Error("No existe esa mantención.");
  const estadoProgramadaId = await getEstadoId(db, ESTADOS.PROGRAMADA);
  if (actual.estado_mantencion_id_estadomantencion !== estadoProgramadaId) {
    throw new Error("Solo se puede editar una mantención mientras está Programada.");
  }
  const campos: string[] = [];
  const valores: any[] = [];
  for (const campo of CAMPOS_EDITABLES_MANTENCION) {
    if (input[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(input[campo]);
    }
  }
  if (campos.length === 0) return getMantencion(id);
  valores.push(id);
  await db.prepare(`UPDATE mantencion SET ${campos.join(", ")} WHERE id_mantencion = ?`).run(...valores);
  return getMantencion(id);
}

export async function cancelarMantencion(id: number, motivo: string, usuarioId: number) {
  if (!motivo?.trim()) throw new Error("El motivo de la cancelación es obligatorio.");
  return withTransaction(async (tx) => {
    const mantencion = (await tx.prepare(`SELECT * FROM mantencion WHERE id_mantencion = ? FOR UPDATE`).get(id)) as any;
    if (!mantencion) throw new Error("No existe esa mantención.");
    const estadoProgramadaId = await getEstadoId(tx, ESTADOS.PROGRAMADA);
    if (mantencion.estado_mantencion_id_estadomantencion !== estadoProgramadaId) {
      throw new Error("Solo se puede cancelar una mantención que esté Programada.");
    }
    const estadoCanceladaId = await getEstadoId(tx, ESTADOS.CANCELADA);
    await tx
      .prepare(
        `UPDATE mantencion
         SET estado_mantencion_id_estadomantencion = ?, motivo_cancelacion = ?, fecha_cancelacion = ?, usuario_id_cancelo = ?
         WHERE id_mantencion = ?`
      )
      .run(estadoCanceladaId, motivo.trim(), formatDateTime(new Date()), usuarioId, id);
    return getMantencionConDetalle(tx, id);
  });
}

// Comprobante/factura + foto del resultado + costo real — los sube
// Administrador/Comité después, al recibirlos de la empresa. No se
// restringe a un estado puntual (la factura puede llegar antes de que el
// guardia alcance a marcar la salida), salvo que ya esté Cancelada.
export async function actualizarDatosFinalesMantencion(
  id: number,
  input: { costoReal?: number | null; comprobanteUrl?: string; fotoResultadoUrl?: string }
) {
  const actual = (await db.prepare(`SELECT estado_mantencion_id_estadomantencion FROM mantencion WHERE id_mantencion = ?`).get(id)) as
    | { estado_mantencion_id_estadomantencion: number }
    | undefined;
  if (!actual) throw new Error("No existe esa mantención.");
  const estadoCanceladaId = await getEstadoId(db, ESTADOS.CANCELADA);
  if (actual.estado_mantencion_id_estadomantencion === estadoCanceladaId) {
    throw new Error("No se pueden agregar comprobantes a una mantención cancelada.");
  }
  const campos: string[] = [];
  const valores: any[] = [];
  if (input.costoReal !== undefined) {
    campos.push("costo_real = ?");
    valores.push(input.costoReal);
  }
  if (input.comprobanteUrl !== undefined) {
    campos.push("comprobante_url = ?");
    valores.push(input.comprobanteUrl);
  }
  if (input.fotoResultadoUrl !== undefined) {
    campos.push("foto_resultado_url = ?");
    valores.push(input.fotoResultadoUrl);
  }
  if (campos.length === 0) return getMantencion(id);
  valores.push(id);
  await db.prepare(`UPDATE mantencion SET ${campos.join(", ")} WHERE id_mantencion = ?`).run(...valores);
  return getMantencion(id);
}

export interface ListarMantencionesFiltro {
  estado?: string;
  tipoElementoId?: number;
  fechaInicio?: string;
  fechaTermino?: string;
}

export async function listarMantenciones(condominioId: number, filtro?: ListarMantencionesFiltro) {
  let sql = `SELECT m.*, te.gls_tipoelementomantencion, em.gls_estadomantencion, creador.nombre_usuario AS nombre_creador
             FROM mantencion m
             JOIN tipo_elemento_mantencion te ON te.id_tipoelementomantencion = m.tipo_elemento_mantencion_id_tipoelementomantencion
             JOIN estado_mantencion em ON em.id_estadomantencion = m.estado_mantencion_id_estadomantencion
             JOIN usuario creador ON creador.id_usuario = m.creado_por_usuario_id
             WHERE m.condominio_id_condominio = ?`;
  const params: any[] = [condominioId];
  if (filtro?.estado) {
    sql += ` AND em.gls_estadomantencion = ?`;
    params.push(filtro.estado);
  }
  if (filtro?.tipoElementoId) {
    sql += ` AND m.tipo_elemento_mantencion_id_tipoelementomantencion = ?`;
    params.push(filtro.tipoElementoId);
  }
  if (filtro?.fechaInicio) {
    sql += ` AND m.fecha_programada >= ?`;
    params.push(filtro.fechaInicio);
  }
  if (filtro?.fechaTermino) {
    sql += ` AND m.fecha_programada <= ?`;
    params.push(filtro.fechaTermino);
  }
  sql += ` ORDER BY m.fecha_programada DESC, m.id_mantencion DESC`;
  return db.prepare(sql).all(...params);
}

// Para que el guardia elija de la lista cuál mantención está llegando a
// realizar — regla explícita del usuario: nunca registra una "suelta".
export async function listarMantencionesProgramadas(condominioId: number) {
  return listarMantenciones(condominioId, { estado: ESTADOS.PROGRAMADA });
}

// Para que el guardia marque la salida de la empresa.
export async function listarMantencionesEnCurso(condominioId: number) {
  return listarMantenciones(condominioId, { estado: ESTADOS.EN_CURSO });
}

export interface RegistrarIngresoInput {
  empresaNombre: string;
  personaNombre: string;
  personaRut?: string;
}

export async function registrarIngresoEmpresa(id: number, input: RegistrarIngresoInput, guardiaUsuarioId: number) {
  if (!input.empresaNombre?.trim()) throw new Error("Falta el nombre de la empresa.");
  if (!input.personaNombre?.trim()) throw new Error("Falta el nombre de la persona que llega.");

  const resultado: any = await withTransaction(async (tx) => {
    const mantencion = (await tx.prepare(`SELECT * FROM mantencion WHERE id_mantencion = ? FOR UPDATE`).get(id)) as any;
    if (!mantencion) throw new Error("No existe esa mantención.");
    const estadoProgramadaId = await getEstadoId(tx, ESTADOS.PROGRAMADA);
    if (mantencion.estado_mantencion_id_estadomantencion !== estadoProgramadaId) {
      throw new Error("Solo se puede marcar el ingreso de una mantención que esté Programada.");
    }
    const estadoEnCursoId = await getEstadoId(tx, ESTADOS.EN_CURSO);
    await tx
      .prepare(
        `UPDATE mantencion
         SET estado_mantencion_id_estadomantencion = ?, empresa_nombre = ?, persona_nombre = ?, persona_rut = ?,
             fecha_hora_llegada = ?, usuario_id_guardia_llegada = ?
         WHERE id_mantencion = ?`
      )
      .run(
        estadoEnCursoId,
        input.empresaNombre.trim(),
        input.personaNombre.trim(),
        input.personaRut?.trim() || null,
        formatDateTime(new Date()),
        guardiaUsuarioId,
        id
      );
    return getMantencionConDetalle(tx, id);
  });

  // Aviso "en curso" — fuera de la transacción, igual que el resto de las
  // notificaciones de este proyecto.
  const idNotificacion = await crearNotificacionParaCondominio(db, {
    condominioId: resultado.condominio_id_condominio,
    tipoGls: GLS_TIPONOTIF_MANTENCION_EN_CURSO,
    titulo: `Mantención en curso: ${resultado.gls_tipoelementomantencion}`,
    cuerpo: `${resultado.titulo} — ${input.empresaNombre.trim()} está trabajando ahora en el condominio.`,
    referenciaTipo: "mantencion",
    referenciaId: id,
    creadoPorUsuarioId: guardiaUsuarioId,
  });
  await enviarPushesDeNotificacion(idNotificacion);

  return resultado;
}

export async function registrarSalidaEmpresa(id: number, guardiaUsuarioId: number) {
  return withTransaction(async (tx) => {
    const mantencion = (await tx.prepare(`SELECT * FROM mantencion WHERE id_mantencion = ? FOR UPDATE`).get(id)) as any;
    if (!mantencion) throw new Error("No existe esa mantención.");
    const estadoEnCursoId = await getEstadoId(tx, ESTADOS.EN_CURSO);
    if (mantencion.estado_mantencion_id_estadomantencion !== estadoEnCursoId) {
      throw new Error("Solo se puede marcar la salida de una mantención que esté En curso.");
    }
    const estadoRealizadaId = await getEstadoId(tx, ESTADOS.REALIZADA);
    await tx
      .prepare(
        `UPDATE mantencion SET estado_mantencion_id_estadomantencion = ?, fecha_hora_salida = ?, usuario_id_guardia_salida = ? WHERE id_mantencion = ?`
      )
      .run(estadoRealizadaId, formatDateTime(new Date()), guardiaUsuarioId, id);
    return getMantencionConDetalle(tx, id);
  });
}
