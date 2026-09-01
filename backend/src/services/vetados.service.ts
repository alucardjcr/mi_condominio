import { db, DbLike } from "../db/client";

// ---------------------------------------------------------------------------
// VETADOS (ronda 20): personas con prohibición de ingreso al condominio —
// caso típico, orden de alejamiento contra la pareja de una residente. Solo
// Administrador/Comité agrega o edita (información sensible); cualquier
// guardia puede consultarla (búsqueda por RUT, ver buscarVetadoPorRut) y el
// sistema la revisa automáticamente al registrar una visita — ver
// verificarAlertaVetado, usada desde estacionamientoVisita.service.ts. A
// pedido explícito del usuario la alerta NUNCA bloquea el registro, solo se
// muestra al guardia.
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// Normaliza un RUT chileno para comparar sin importar puntos/espacios ni
// mayúsculas ("12.345.678-9" y "12345678-9" deben matchear).
export function normalizarRut(rut: string): string {
  return rut.trim().toUpperCase().replace(/\./g, "").replace(/\s/g, "");
}
function normalizarPatente(patente: string): string {
  return patente.trim().toUpperCase().replace(/\s/g, "");
}

export async function listarVetados(condominioId: number) {
  return db
    .prepare(
      `SELECT id_vetado, nombre_completo, rut, patente, parentesco, fecha_ingreso,
              foto_persona_url, foto_vehiculo_url, observaciones, flg_vigencia
       FROM vetado
       WHERE condominio_id_condominio = ?
       ORDER BY flg_vigencia DESC, nombre_completo`
    )
    .all(condominioId);
}

export async function crearVetado(
  input: {
    nombreCompleto: string;
    rut: string;
    patente?: string;
    parentesco?: string;
    fechaIngreso: string;
    fotoPersonaUrl?: string;
    fotoVehiculoUrl?: string;
    observaciones?: string;
    condominioId: number;
  },
  creadoPorUsuarioId: number
) {
  if (!input.nombreCompleto?.trim() || !input.rut?.trim() || !input.fechaIngreso) {
    throw new Error("Faltan campos obligatorios: nombre completo, RUT y fecha de ingreso.");
  }
  const insert = await db
    .prepare(
      `INSERT INTO vetado
         (nombre_completo, rut, patente, parentesco, fecha_ingreso, foto_persona_url, foto_vehiculo_url, observaciones,
          condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.nombreCompleto.trim(),
      normalizarRut(input.rut),
      input.patente ? normalizarPatente(input.patente) : null,
      input.parentesco?.trim() || null,
      input.fechaIngreso,
      input.fotoPersonaUrl || null,
      input.fotoVehiculoUrl || null,
      input.observaciones?.trim() || null,
      input.condominioId,
      creadoPorUsuarioId,
      formatDateTime(new Date())
    );
  return db.prepare(`SELECT * FROM vetado WHERE id_vetado = ?`).get(Number(insert.lastInsertRowid));
}

export async function actualizarVetado(
  id: number,
  input: {
    nombreCompleto?: string;
    rut?: string;
    patente?: string | null;
    parentesco?: string | null;
    fechaIngreso?: string;
    fotoPersonaUrl?: string;
    fotoVehiculoUrl?: string;
    observaciones?: string | null;
    flgVigencia?: number;
  }
) {
  if (input.nombreCompleto !== undefined) {
    await db.prepare(`UPDATE vetado SET nombre_completo = ? WHERE id_vetado = ?`).run(input.nombreCompleto.trim(), id);
  }
  if (input.rut !== undefined) {
    await db.prepare(`UPDATE vetado SET rut = ? WHERE id_vetado = ?`).run(normalizarRut(input.rut), id);
  }
  if (input.patente !== undefined) {
    await db.prepare(`UPDATE vetado SET patente = ? WHERE id_vetado = ?`).run(input.patente ? normalizarPatente(input.patente) : null, id);
  }
  if (input.parentesco !== undefined) {
    await db.prepare(`UPDATE vetado SET parentesco = ? WHERE id_vetado = ?`).run(input.parentesco?.trim() || null, id);
  }
  if (input.fechaIngreso !== undefined) {
    await db.prepare(`UPDATE vetado SET fecha_ingreso = ? WHERE id_vetado = ?`).run(input.fechaIngreso, id);
  }
  if (input.fotoPersonaUrl !== undefined) {
    await db.prepare(`UPDATE vetado SET foto_persona_url = ? WHERE id_vetado = ?`).run(input.fotoPersonaUrl, id);
  }
  if (input.fotoVehiculoUrl !== undefined) {
    await db.prepare(`UPDATE vetado SET foto_vehiculo_url = ? WHERE id_vetado = ?`).run(input.fotoVehiculoUrl, id);
  }
  if (input.observaciones !== undefined) {
    await db.prepare(`UPDATE vetado SET observaciones = ? WHERE id_vetado = ?`).run(input.observaciones?.trim() || null, id);
  }
  if (input.flgVigencia !== undefined) {
    await db.prepare(`UPDATE vetado SET flg_vigencia = ? WHERE id_vetado = ?`).run(input.flgVigencia, id);
  }
  return db.prepare(`SELECT * FROM vetado WHERE id_vetado = ?`).get(id);
}

/** Búsqueda proactiva del guardia por RUT (pantalla "Consulta VETADOS"). */
export async function buscarVetadoPorRut(condominioId: number, rut: string) {
  return db
    .prepare(
      `SELECT id_vetado, nombre_completo, rut, patente, parentesco, foto_persona_url, foto_vehiculo_url
       FROM vetado
       WHERE condominio_id_condominio = ? AND flg_vigencia = 1 AND rut = ?`
    )
    .get(condominioId, normalizarRut(rut));
}

/**
 * Revisión automática al registrar una visita (vehicular o peatonal) — se
 * llama SIEMPRE que haya RUT y/o patente, dentro de la misma transacción de
 * registrarEntrada (ver estacionamientoVisita.service.ts). Nunca bloquea:
 * si encuentra coincidencia, devuelve los datos para que el guardia decida
 * (alertaVetado en la respuesta); si no, devuelve null.
 */
export async function verificarAlertaVetado(conn: DbLike, condominioId: number, rut?: string | null, patente?: string | null) {
  if (!rut && !patente) return null;

  const condiciones: string[] = [];
  const params: any[] = [condominioId];
  if (rut) {
    condiciones.push("rut = ?");
    params.push(normalizarRut(rut));
  }
  if (patente) {
    condiciones.push("patente = ?");
    params.push(normalizarPatente(patente));
  }

  return (
    (await conn
      .prepare(
        `SELECT id_vetado, nombre_completo, rut, patente, parentesco
         FROM vetado
         WHERE condominio_id_condominio = ? AND flg_vigencia = 1 AND (${condiciones.join(" OR ")})
         LIMIT 1`
      )
      .get(...params)) ?? null
  );
}
