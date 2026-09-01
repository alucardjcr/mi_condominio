import { db } from "../db/client";

// Ronda 33, a pedido explícito del usuario (Ley 21.719 de Protección de
// Datos Personales): registro de auditoría — quién accedió o modificó qué
// dato, y cuándo. Ver la nota completa en schema-mysql.sql sobre las dos
// formas en que se alimenta esta tabla (middleware genérico para
// mutaciones + llamadas puntuales para lecturas sensibles).

export interface RegistrarAuditoriaInput {
  usuarioId: number | null;
  rol: string | null;
  condominioId: number | null;
  accion: string; // método HTTP: GET/POST/PATCH/PUT/DELETE
  ruta: string;
  statusCode?: number | null;
  detalle?: string | null;
}

/**
 * Inserta una fila de auditoría. A PROPÓSITO nunca lanza — un fallo acá
 * (ej. la base momentáneamente caída) jamás debe tumbar la request real
 * que se estaba auditando, solo queda como error en el log del servidor
 * (que a su vez es el respaldo de última instancia si esta tabla fallara).
 */
export async function registrarAuditoria(input: RegistrarAuditoriaInput): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO log_auditoria (usuario_id_usuario, rol, condominio_id_condominio, accion, ruta, status_code, detalle)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.usuarioId,
        input.rol,
        input.condominioId,
        input.accion,
        // Recorta por si acaso — la columna es VARCHAR(255) y una ruta con
        // muchos query params podría pasarse.
        input.ruta.slice(0, 255),
        input.statusCode ?? null,
        input.detalle ? input.detalle.slice(0, 255) : null
      );
  } catch (err) {
    console.error("[auditoria] No se pudo registrar (no afecta la request original):", err);
  }
}

export interface FiltroAuditoria {
  usuarioId?: number;
  accion?: string;
  desde?: string; // 'YYYY-MM-DD'
  hasta?: string; // 'YYYY-MM-DD'
  q?: string; // busca en ruta/detalle
}

/** Para el panel de Administrador/Comité — siempre acotado a SU condominio. */
export async function listarAuditoria(condominioId: number, filtro: FiltroAuditoria = {}) {
  const condiciones = ["l.condominio_id_condominio = ?"];
  const params: unknown[] = [condominioId];

  if (filtro.usuarioId) {
    condiciones.push("l.usuario_id_usuario = ?");
    params.push(filtro.usuarioId);
  }
  if (filtro.accion) {
    condiciones.push("l.accion = ?");
    params.push(filtro.accion);
  }
  if (filtro.desde) {
    condiciones.push("l.fecha >= ?");
    params.push(`${filtro.desde} 00:00:00`);
  }
  if (filtro.hasta) {
    condiciones.push("l.fecha <= ?");
    params.push(`${filtro.hasta} 23:59:59`);
  }
  if (filtro.q?.trim()) {
    condiciones.push("(l.ruta LIKE ? OR l.detalle LIKE ?)");
    const like = `%${filtro.q.trim()}%`;
    params.push(like, like);
  }

  return db
    .prepare(
      `SELECT l.id_logauditoria, l.accion, l.ruta, l.status_code, l.detalle, l.fecha,
              l.rol, u.nombre_usuario, u.usuariocol
       FROM log_auditoria l
       LEFT JOIN usuario u ON u.id_usuario = l.usuario_id_usuario
       WHERE ${condiciones.join(" AND ")}
       ORDER BY l.id_logauditoria DESC
       LIMIT 200`
    )
    .all(...params);
}
