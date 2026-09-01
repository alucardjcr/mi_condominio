import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Bitácora de guardias (ronda 20): libro de novedades de portería
// tradicional — compartida entre todos los guardias del condominio (el que
// entra de turno lee lo que anotó el anterior). fecha_hora y el nombre del
// guardia se auto-registran (nunca editables a mano). Administrador/Comité
// puede leerla (supervisión) pero no escribir — reforzado en
// routes/bitacora.ts (solo Guardia puede hacer POST).
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export async function crearEntradaBitacora(input: { texto: string; condominioId: number }, guardiaId: number) {
  if (!input.texto?.trim()) {
    throw new Error("El texto de la novedad no puede estar vacío.");
  }
  const ahora = formatDateTime(new Date());
  const insert = await db
    .prepare(
      `INSERT INTO bitacora_guardia (texto, fecha_hora, usuario_id_usuario_guardia, condominio_id_condominio)
       VALUES (?, ?, ?, ?)`
    )
    .run(input.texto.trim(), ahora, guardiaId, input.condominioId);
  return db
    .prepare(
      `SELECT b.id_bitacora, b.texto, b.fecha_hora, u.nombre_usuario AS nombre_guardia
       FROM bitacora_guardia b
       JOIN usuario u ON u.id_usuario = b.usuario_id_usuario_guardia
       WHERE b.id_bitacora = ?`
    )
    .get(Number(insert.lastInsertRowid));
}

export async function listarBitacora(condominioId: number, opts?: { fechaInicio?: string; fechaTermino?: string }) {
  let sql = `SELECT b.id_bitacora, b.texto, b.fecha_hora, u.nombre_usuario AS nombre_guardia
             FROM bitacora_guardia b
             JOIN usuario u ON u.id_usuario = b.usuario_id_usuario_guardia
             WHERE b.condominio_id_condominio = ?`;
  const params: any[] = [condominioId];
  if (opts?.fechaInicio) {
    sql += ` AND b.fecha_hora >= ?`;
    params.push(`${opts.fechaInicio} 00:00:00`);
  }
  if (opts?.fechaTermino) {
    sql += ` AND b.fecha_hora <= ?`;
    params.push(`${opts.fechaTermino} 23:59:59`);
  }
  sql += ` ORDER BY b.fecha_hora DESC`;
  return db.prepare(sql).all(...params);
}
