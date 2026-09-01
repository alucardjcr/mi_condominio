import { db } from "../db/client";

// Ronda 34, a pedido explícito del usuario: notificación de brechas de
// seguridad — Ley 21.719, plazo de 72 horas desde la detección para
// avisar a la Agencia de Protección de Datos. Ver la nota completa en
// schema-mysql.sql.

const PLAZO_HORAS = 72;

export interface IncidenteInput {
  fecha_deteccion: string; // 'YYYY-MM-DD HH:mm:ss' o ISO
  descripcion: string;
  datos_afectados: string;
  personas_afectadas_estimado?: number | null;
  acciones_tomadas?: string | null;
}

export async function crearIncidente(condominioId: number, creadoPorUsuarioId: number, input: IncidenteInput) {
  if (!input.fecha_deteccion || !input.descripcion?.trim() || !input.datos_afectados?.trim()) {
    throw new Error("Faltan campos: fecha_deteccion, descripcion, datos_afectados.");
  }
  const insert = await db
    .prepare(
      `INSERT INTO incidente_seguridad
         (condominio_id_condominio, fecha_deteccion, descripcion, datos_afectados, personas_afectadas_estimado, acciones_tomadas, creado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      condominioId,
      input.fecha_deteccion,
      input.descripcion.trim(),
      input.datos_afectados.trim(),
      input.personas_afectadas_estimado ?? null,
      input.acciones_tomadas?.trim() || null,
      creadoPorUsuarioId
    );
  return obtenerIncidente(Number(insert.lastInsertRowid));
}

function conPlazo(fila: any) {
  const vencimiento = new Date(new Date(fila.fecha_deteccion).getTime() + PLAZO_HORAS * 60 * 60 * 1000);
  const horasRestantes = (vencimiento.getTime() - Date.now()) / (60 * 60 * 1000);
  return {
    ...fila,
    plazo_vencimiento: vencimiento.toISOString(),
    horas_restantes: Math.round(horasRestantes * 10) / 10,
    plazo_vencido: horasRestantes < 0 && !fila.notificado_agencia_fecha,
  };
}

async function obtenerIncidente(id: number) {
  const fila = await db.prepare(`SELECT * FROM incidente_seguridad WHERE id_incidenteseguridad = ?`).get(id);
  return fila ? conPlazo(fila) : null;
}

export async function listarIncidentes(condominioId: number) {
  const filas = (await db
    .prepare(
      `SELECT * FROM incidente_seguridad WHERE condominio_id_condominio = ? ORDER BY estado = 'Abierto' DESC, fecha_deteccion DESC`
    )
    .all(condominioId)) as any[];
  return filas.map(conPlazo);
}

export async function marcarNotificadoAgencia(id: number) {
  await db.prepare(`UPDATE incidente_seguridad SET notificado_agencia_fecha = NOW() WHERE id_incidenteseguridad = ?`).run(id);
  return obtenerIncidente(id);
}

export async function marcarNotificadoAfectados(id: number) {
  await db.prepare(`UPDATE incidente_seguridad SET notificado_afectados_fecha = NOW() WHERE id_incidenteseguridad = ?`).run(id);
  return obtenerIncidente(id);
}

export async function cerrarIncidente(id: number, accionesTomadas: string) {
  if (!accionesTomadas?.trim()) {
    throw new Error("Describe las acciones tomadas para poder cerrar el incidente.");
  }
  await db
    .prepare(`UPDATE incidente_seguridad SET estado = 'Cerrado', acciones_tomadas = ? WHERE id_incidenteseguridad = ?`)
    .run(accionesTomadas.trim(), id);
  return obtenerIncidente(id);
}
