import { db } from "../db/client";

// Ronda 45, a pedido explícito del usuario: ver la nota completa sobre
// monitoreo de actividad sospechosa en schema-mysql.sql, sobre la tabla
// evento_seguridad.

export type TipoEventoSeguridad = "rate_limit_login" | "rate_limit_recuperacion" | "login_fallido";

export async function registrarEventoSeguridad(
  tipo: TipoEventoSeguridad,
  input: { ip?: string | null; usuariocolIntentado?: string | null; detalle?: string | null }
) {
  try {
    await db
      .prepare(`INSERT INTO evento_seguridad (tipo, ip, usuariocol_intentado, detalle) VALUES (?, ?, ?, ?)`)
      .run(tipo, input.ip ?? null, input.usuariocolIntentado ?? null, input.detalle ?? null);
  } catch {
    // Best-effort: nunca debe interrumpir el flujo real (un login fallido,
    // un rate limit) por un problema al escribir el log de seguridad.
  }
}

export interface FiltroEventoSeguridad {
  tipo?: string;
  desde?: string; // 'YYYY-MM-DD'
}

export async function listarEventosSeguridad(filtro?: FiltroEventoSeguridad) {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro?.tipo) {
    condiciones.push("tipo = ?");
    params.push(filtro.tipo);
  }
  if (filtro?.desde) {
    condiciones.push("fecha >= ?");
    params.push(filtro.desde);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  return db
    .prepare(`SELECT id_eventoseguridad, tipo, ip, usuariocol_intentado, detalle, fecha FROM evento_seguridad ${where} ORDER BY fecha DESC LIMIT 500`)
    .all(...params);
}

// Resumen para el panel: cuántos eventos de cada tipo en las últimas 24h y
// últimos 7 días — permite detectar de un vistazo si algo está pasando
// AHORA, sin tener que leer fila por fila.
export async function resumenEventosSeguridad() {
  const filas = (await db
    .prepare(
      `SELECT tipo,
              SUM(CASE WHEN fecha >= NOW() - INTERVAL 24 HOUR THEN 1 ELSE 0 END) AS ultimas_24h,
              SUM(CASE WHEN fecha >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS ultimos_7dias
       FROM evento_seguridad
       GROUP BY tipo`
    )
    .all()) as { tipo: string; ultimas_24h: number; ultimos_7dias: number }[];
  return filas;
}
