import { db } from "../db/client";
import { crearNotificacionParaUnidad, enviarPushesDeNotificacion } from "./notificaciones.service";
import { GLS_TIPONOTIF_AMONESTACION, GLS_TIPONOTIF_MULTA } from "./catalogos-default.service";

// ---------------------------------------------------------------------------
// Amonestaciones y multas (ronda 41), a pedido explícito del usuario. Ver la
// nota completa de reglas de negocio en schema-mysql.sql, sobre la tabla
// `amonestacion`. Resumen del flujo:
//
//   Amonestación NORMAL (tipo con flg_es_multa=0): Administrador o
//   cualquier miembro del Comité la crea -> queda 'Enviada' de inmediato,
//   se notifica sola al residente en el mismo acto. No pasa por ninguna
//   aprobación.
//
//   MULTA (tipo con flg_es_multa=1): Administrador o Comité la crea ->
//   'Pendiente de aprobación' (título/monto propuestos, TODAVÍA no se
//   notifica a nadie) -> el Comité (o el Administrador) la aprueba o
//   rechaza -> si se aprobó, SOLO el Administrador (rol real, no un
//   miembro del comité) puede notificarla al residente -> 'Notificada'.
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export const ESTADOS = {
  ENVIADA: "Enviada",
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  NOTIFICADA: "Notificada",
} as const;

// ---------------------------------------------------------------------------
// Catálogo: tipos de amonestación (por condominio, editable — ver
// catalogos-default.service.ts para los 11 que trae cada condominio por
// defecto). Mismo patrón que tipo_elemento_mantencion.
// ---------------------------------------------------------------------------

export async function listarTiposAmonestacion(condominioId: number, incluirInactivos = false) {
  const base = `SELECT id_tipoamonestacion, gls_tipoamonestacion, flg_es_multa, flg_vigencia
                FROM tipo_amonestacion WHERE condominio_id_condominio = ?`;
  if (incluirInactivos) return db.prepare(`${base} ORDER BY gls_tipoamonestacion`).all(condominioId);
  return db.prepare(`${base} AND flg_vigencia = 1 ORDER BY gls_tipoamonestacion`).all(condominioId);
}

export async function crearTipoAmonestacion(condominioId: number, input: { gls_tipoamonestacion: string; flg_es_multa?: number }) {
  if (!input.gls_tipoamonestacion?.trim()) throw new Error("Falta el nombre del tipo de amonestación.");
  const insert = await db
    .prepare(`INSERT INTO tipo_amonestacion (gls_tipoamonestacion, flg_es_multa, condominio_id_condominio) VALUES (?, ?, ?)`)
    .run(input.gls_tipoamonestacion.trim(), input.flg_es_multa ? 1 : 0, condominioId);
  return db
    .prepare(`SELECT id_tipoamonestacion, gls_tipoamonestacion, flg_es_multa, flg_vigencia FROM tipo_amonestacion WHERE id_tipoamonestacion = ?`)
    .get(Number(insert.lastInsertRowid));
}

export async function actualizarTipoAmonestacion(
  id: number,
  input: { gls_tipoamonestacion?: string; flg_es_multa?: number; flg_vigencia?: number }
) {
  const campos: string[] = [];
  const valores: unknown[] = [];
  if (input.gls_tipoamonestacion !== undefined) {
    if (!input.gls_tipoamonestacion.trim()) throw new Error("El nombre no puede quedar vacío.");
    campos.push("gls_tipoamonestacion = ?");
    valores.push(input.gls_tipoamonestacion.trim());
  }
  if (input.flg_es_multa !== undefined) {
    campos.push("flg_es_multa = ?");
    valores.push(input.flg_es_multa ? 1 : 0);
  }
  if (input.flg_vigencia !== undefined) {
    campos.push("flg_vigencia = ?");
    valores.push(input.flg_vigencia);
  }
  if (campos.length > 0) {
    valores.push(id);
    await db.prepare(`UPDATE tipo_amonestacion SET ${campos.join(", ")} WHERE id_tipoamonestacion = ?`).run(...valores);
  }
  return db
    .prepare(`SELECT id_tipoamonestacion, gls_tipoamonestacion, flg_es_multa, flg_vigencia FROM tipo_amonestacion WHERE id_tipoamonestacion = ?`)
    .get(id);
}

// --- Catálogo: tipos/motivos de multa (por condominio, editable) --------

export async function listarTiposMulta(condominioId: number, incluirInactivos = false) {
  const base = `SELECT id_tipomulta, gls_tipomulta, monto_sugerido, unidad_monto, flg_vigencia
                FROM tipo_multa WHERE condominio_id_condominio = ?`;
  if (incluirInactivos) return db.prepare(`${base} ORDER BY gls_tipomulta`).all(condominioId);
  return db.prepare(`${base} AND flg_vigencia = 1 ORDER BY gls_tipomulta`).all(condominioId);
}

export async function crearTipoMulta(condominioId: number, input: { gls_tipomulta: string; monto_sugerido?: number; unidad_monto?: string }) {
  if (!input.gls_tipomulta?.trim()) throw new Error("Falta el nombre del motivo de multa.");
  const insert = await db
    .prepare(`INSERT INTO tipo_multa (gls_tipomulta, monto_sugerido, unidad_monto, condominio_id_condominio) VALUES (?, ?, ?, ?)`)
    .run(input.gls_tipomulta.trim(), input.monto_sugerido ?? null, input.unidad_monto ?? "UF", condominioId);
  return db
    .prepare(`SELECT id_tipomulta, gls_tipomulta, monto_sugerido, unidad_monto, flg_vigencia FROM tipo_multa WHERE id_tipomulta = ?`)
    .get(Number(insert.lastInsertRowid));
}

export async function actualizarTipoMulta(
  id: number,
  input: { gls_tipomulta?: string; monto_sugerido?: number | null; unidad_monto?: string; flg_vigencia?: number }
) {
  const campos: string[] = [];
  const valores: unknown[] = [];
  if (input.gls_tipomulta !== undefined) {
    if (!input.gls_tipomulta.trim()) throw new Error("El nombre no puede quedar vacío.");
    campos.push("gls_tipomulta = ?");
    valores.push(input.gls_tipomulta.trim());
  }
  if (input.monto_sugerido !== undefined) {
    campos.push("monto_sugerido = ?");
    valores.push(input.monto_sugerido);
  }
  if (input.unidad_monto !== undefined) {
    campos.push("unidad_monto = ?");
    valores.push(input.unidad_monto);
  }
  if (input.flg_vigencia !== undefined) {
    campos.push("flg_vigencia = ?");
    valores.push(input.flg_vigencia);
  }
  if (campos.length > 0) {
    valores.push(id);
    await db.prepare(`UPDATE tipo_multa SET ${campos.join(", ")} WHERE id_tipomulta = ?`).run(...valores);
  }
  return db
    .prepare(`SELECT id_tipomulta, gls_tipomulta, monto_sugerido, unidad_monto, flg_vigencia FROM tipo_multa WHERE id_tipomulta = ?`)
    .get(id);
}

// --- Amonestaciones -------------------------------------------------------

const SELECT_AMONESTACION = `
  SELECT a.id_amonestacion, a.condominio_id_condominio, a.unidad_id_unidad,
         un.numero_unidad, tb.nombre_torre,
         a.tipo_amonestacion_id_tipoamonestacion, ta.gls_tipoamonestacion, ta.flg_es_multa,
         a.descripcion, a.fecha_hecho,
         a.tipo_multa_id_tipomulta, tm.gls_tipomulta,
         a.monto, a.unidad_monto, a.estado,
         a.aprobado_por_usuario_id, aprob.nombre_usuario AS nombre_aprobador, a.fecha_aprobacion, a.motivo_rechazo,
         a.notificado_por_usuario_id, notif.nombre_usuario AS nombre_notificador, a.fecha_notificacion,
         a.creado_por_usuario_id, creador.nombre_usuario AS nombre_creador, a.fecha_creacion
  FROM amonestacion a
  JOIN unidad un ON un.id_unidad = a.unidad_id_unidad
  JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
  JOIN tipo_amonestacion ta ON ta.id_tipoamonestacion = a.tipo_amonestacion_id_tipoamonestacion
  LEFT JOIN tipo_multa tm ON tm.id_tipomulta = a.tipo_multa_id_tipomulta
  LEFT JOIN usuario aprob ON aprob.id_usuario = a.aprobado_por_usuario_id
  LEFT JOIN usuario notif ON notif.id_usuario = a.notificado_por_usuario_id
  JOIN usuario creador ON creador.id_usuario = a.creado_por_usuario_id
`;

export interface FiltroAmonestacion {
  estado?: string;
  unidadId?: number;
}

export async function listarAmonestaciones(condominioId: number, filtro?: FiltroAmonestacion) {
  const condiciones = ["a.condominio_id_condominio = ?"];
  const params: unknown[] = [condominioId];
  if (filtro?.estado) {
    condiciones.push("a.estado = ?");
    params.push(filtro.estado);
  }
  if (filtro?.unidadId) {
    condiciones.push("a.unidad_id_unidad = ?");
    params.push(filtro.unidadId);
  }
  return db
    .prepare(`${SELECT_AMONESTACION} WHERE ${condiciones.join(" AND ")} ORDER BY a.fecha_creacion DESC`)
    .all(...params);
}

export async function getAmonestacion(id: number) {
  const fila = await db.prepare(`${SELECT_AMONESTACION} WHERE a.id_amonestacion = ?`).get(id);
  if (!fila) throw new Error("No existe esa amonestación.");
  return fila;
}

export interface CrearAmonestacionInput {
  condominioId: number;
  unidadId: number;
  tipoAmonestacionId: number;
  descripcion: string;
  fechaHecho: string; // 'YYYY-MM-DD'
  tipoMultaId?: number;
  monto?: number;
  unidadMonto?: string;
}

/**
 * Crea la amonestación. Si el tipo NO es multa, queda 'Enviada' y se
 * notifica al residente en el mismo acto (cualquiera de Administrador o
 * Comité puede hacer esto, sin aprobación de nadie más — regla explícita
 * del usuario). Si el tipo SÍ es multa, queda 'Pendiente de aprobación' y
 * todavía NO se notifica a nadie.
 */
export async function crearAmonestacion(input: CrearAmonestacionInput, creadoPorUsuarioId: number) {
  if (!input.descripcion?.trim()) throw new Error("Falta la descripción de la falta.");
  if (!input.fechaHecho) throw new Error("Falta la fecha en que ocurrió la falta.");

  const tipo = (await db
    .prepare(`SELECT id_tipoamonestacion, flg_es_multa FROM tipo_amonestacion WHERE id_tipoamonestacion = ? AND condominio_id_condominio = ?`)
    .get(input.tipoAmonestacionId, input.condominioId)) as { id_tipoamonestacion: number; flg_es_multa: number } | undefined;
  if (!tipo) throw new Error("Tipo de amonestación inválido para este condominio.");

  const unidad = await db.prepare(`SELECT id_unidad FROM unidad WHERE id_unidad = ? AND condominio_id_condominio = ?`).get(input.unidadId, input.condominioId);
  if (!unidad) throw new Error("Depto inválido para este condominio.");

  const esMulta = !!tipo.flg_es_multa;
  if (esMulta) {
    if (!input.tipoMultaId) throw new Error("Elige el motivo de la multa.");
    if (input.monto === undefined || input.monto === null || input.monto < 0) throw new Error("Ingresa un monto válido para la multa.");
    const tipoMulta = await db
      .prepare(`SELECT id_tipomulta FROM tipo_multa WHERE id_tipomulta = ? AND condominio_id_condominio = ?`)
      .get(input.tipoMultaId, input.condominioId);
    if (!tipoMulta) throw new Error("Motivo de multa inválido para este condominio.");
  }

  const ahora = formatDateTime(new Date());
  const insert = await db
    .prepare(
      `INSERT INTO amonestacion
         (condominio_id_condominio, unidad_id_unidad, tipo_amonestacion_id_tipoamonestacion, descripcion, fecha_hecho,
          tipo_multa_id_tipomulta, monto, unidad_monto, estado, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.condominioId,
      input.unidadId,
      input.tipoAmonestacionId,
      input.descripcion.trim(),
      input.fechaHecho,
      esMulta ? input.tipoMultaId : null,
      esMulta ? input.monto : null,
      esMulta ? input.unidadMonto ?? "UF" : null,
      esMulta ? ESTADOS.PENDIENTE_APROBACION : ESTADOS.ENVIADA,
      creadoPorUsuarioId,
      ahora
    );
  const id = Number(insert.lastInsertRowid);

  if (!esMulta) {
    await notificarAmonestacion(id, input.condominioId, input.unidadId, GLS_TIPONOTIF_AMONESTACION, "Nueva amonestación");
  }

  return getAmonestacion(id);
}

async function notificarAmonestacion(id: number, condominioId: number, unidadId: number, tipoGls: string, tituloPrefijo: string) {
  const idNotificacion = await crearNotificacionParaUnidad(db, {
    condominioId,
    unidadId,
    tipoGls,
    titulo: tituloPrefijo,
    cuerpo: "Tu depto recibió una amonestación. Revisa el detalle en la app.",
    referenciaTipo: "amonestacion",
    referenciaId: id,
  });
  await enviarPushesDeNotificacion(idNotificacion);
}

/**
 * Aprueba una multa pendiente — el Comité (o el Administrador) puede
 * hacer esto. Todavía NO notifica a nadie: eso queda exclusivo del
 * Administrador en notificarMulta().
 */
export async function aprobarMulta(id: number, usuarioId: number) {
  const amonestacion = (await db.prepare(`SELECT estado FROM amonestacion WHERE id_amonestacion = ?`).get(id)) as { estado: string } | undefined;
  if (!amonestacion) throw new Error("No existe esa amonestación.");
  if (amonestacion.estado !== ESTADOS.PENDIENTE_APROBACION) {
    throw new Error(`Solo se puede aprobar una multa "${ESTADOS.PENDIENTE_APROBACION}" (esta está "${amonestacion.estado}").`);
  }
  await db
    .prepare(`UPDATE amonestacion SET estado = ?, aprobado_por_usuario_id = ?, fecha_aprobacion = NOW() WHERE id_amonestacion = ?`)
    .run(ESTADOS.APROBADA, usuarioId, id);
  return getAmonestacion(id);
}

export async function rechazarMulta(id: number, usuarioId: number, motivo: string) {
  if (!motivo?.trim()) throw new Error("Explica por qué se rechaza la multa.");
  const amonestacion = (await db.prepare(`SELECT estado FROM amonestacion WHERE id_amonestacion = ?`).get(id)) as { estado: string } | undefined;
  if (!amonestacion) throw new Error("No existe esa amonestación.");
  if (amonestacion.estado !== ESTADOS.PENDIENTE_APROBACION) {
    throw new Error(`Solo se puede rechazar una multa "${ESTADOS.PENDIENTE_APROBACION}" (esta está "${amonestacion.estado}").`);
  }
  await db
    .prepare(`UPDATE amonestacion SET estado = ?, aprobado_por_usuario_id = ?, fecha_aprobacion = NOW(), motivo_rechazo = ? WHERE id_amonestacion = ?`)
    .run(ESTADOS.RECHAZADA, usuarioId, motivo.trim(), id);
  return getAmonestacion(id);
}

/**
 * Notifica al residente una multa YA APROBADA — regla explícita del
 * usuario: exclusivo del Administrador (rol real), nunca un miembro del
 * comité, aunque el comité sí pudo haber sido quien la aprobó. El chequeo
 * de rol se hace en la ruta (routes/admin.ts), no acá — este service no
 * conoce roles, solo recibe el usuarioId de quien ya se validó que puede.
 */
export async function notificarMulta(id: number, usuarioId: number) {
  const amonestacion = (await db
    .prepare(`SELECT estado, condominio_id_condominio, unidad_id_unidad FROM amonestacion WHERE id_amonestacion = ?`)
    .get(id)) as { estado: string; condominio_id_condominio: number; unidad_id_unidad: number } | undefined;
  if (!amonestacion) throw new Error("No existe esa amonestación.");
  if (amonestacion.estado !== ESTADOS.APROBADA) {
    throw new Error(`Solo se puede notificar una multa "${ESTADOS.APROBADA}" (esta está "${amonestacion.estado}").`);
  }
  await db
    .prepare(`UPDATE amonestacion SET estado = ?, notificado_por_usuario_id = ?, fecha_notificacion = NOW() WHERE id_amonestacion = ?`)
    .run(ESTADOS.NOTIFICADA, usuarioId, id);
  await notificarAmonestacion(id, amonestacion.condominio_id_condominio, amonestacion.unidad_id_unidad, GLS_TIPONOTIF_MULTA, "Multa aplicada a tu depto");
  return getAmonestacion(id);
}
