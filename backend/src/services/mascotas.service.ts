import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Mascotas (ronda 20): cada unidad puede tener cero, una o varias mascotas.
// Autoservicio de cualquier residente activo de esa unidad (no exclusivo
// del propietario) — Administrador/Comité tiene acceso total, igual que el
// resto del sistema. Campos: nombre + foto (mínimo pedido por el usuario),
// más especie/raza/número de chip (opcionales, sugeridos a partir del "por
// ejemplo" del usuario — ver ronda 20 en el doc del proyecto).
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export async function listarMascotasDeUnidad(unidadId: number) {
  return db
    .prepare(
      `SELECT id_mascota, nombre, especie, raza, numero_chip, foto_url, unidad_id_unidad, flg_vigencia
       FROM mascota
       WHERE unidad_id_unidad = ? AND flg_vigencia = 1
       ORDER BY nombre`
    )
    .all(unidadId);
}

export async function listarMascotasDelCondominio(condominioId: number) {
  return db
    .prepare(
      `SELECT m.id_mascota, m.nombre, m.especie, m.raza, m.numero_chip, m.foto_url, m.unidad_id_unidad,
              un.numero_unidad, tb.nombre_torre
       FROM mascota m
       JOIN unidad un ON un.id_unidad = m.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE m.condominio_id_condominio = ? AND m.flg_vigencia = 1
       ORDER BY tb.nombre_torre, un.numero_unidad, m.nombre`
    )
    .all(condominioId);
}

export async function crearMascota(input: {
  nombre: string;
  especie?: string;
  raza?: string;
  numeroChip?: string;
  fotoUrl?: string;
  unidadId: number;
  condominioId: number;
}, creadoPorUsuarioId: number) {
  if (!input.nombre?.trim()) {
    throw new Error("Falta el nombre de la mascota.");
  }
  const insert = await db
    .prepare(
      `INSERT INTO mascota (nombre, especie, raza, numero_chip, foto_url, unidad_id_unidad, condominio_id_condominio, creado_por_usuario_id, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.nombre.trim(),
      input.especie?.trim() || null,
      input.raza?.trim() || null,
      input.numeroChip?.trim() || null,
      input.fotoUrl || null,
      input.unidadId,
      input.condominioId,
      creadoPorUsuarioId,
      formatDateTime(new Date())
    );
  return db.prepare(`SELECT * FROM mascota WHERE id_mascota = ?`).get(Number(insert.lastInsertRowid));
}

async function getUnidadDeMascota(id: number): Promise<number | undefined> {
  const fila = (await db.prepare(`SELECT unidad_id_unidad FROM mascota WHERE id_mascota = ?`).get(id)) as
    | { unidad_id_unidad: number }
    | undefined;
  return fila?.unidad_id_unidad;
}

export async function actualizarMascota(
  id: number,
  input: { nombre?: string; especie?: string | null; raza?: string | null; numeroChip?: string | null; fotoUrl?: string; flgVigencia?: number }
) {
  if (input.nombre !== undefined) {
    await db.prepare(`UPDATE mascota SET nombre = ? WHERE id_mascota = ?`).run(input.nombre.trim(), id);
  }
  if (input.especie !== undefined) {
    await db.prepare(`UPDATE mascota SET especie = ? WHERE id_mascota = ?`).run(input.especie?.trim() || null, id);
  }
  if (input.raza !== undefined) {
    await db.prepare(`UPDATE mascota SET raza = ? WHERE id_mascota = ?`).run(input.raza?.trim() || null, id);
  }
  if (input.numeroChip !== undefined) {
    await db.prepare(`UPDATE mascota SET numero_chip = ? WHERE id_mascota = ?`).run(input.numeroChip?.trim() || null, id);
  }
  if (input.fotoUrl !== undefined) {
    await db.prepare(`UPDATE mascota SET foto_url = ? WHERE id_mascota = ?`).run(input.fotoUrl, id);
  }
  if (input.flgVigencia !== undefined) {
    await db.prepare(`UPDATE mascota SET flg_vigencia = ? WHERE id_mascota = ?`).run(input.flgVigencia, id);
  }
  return db.prepare(`SELECT * FROM mascota WHERE id_mascota = ?`).get(id);
}

export { getUnidadDeMascota };
