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

// Ronda 44, a pedido explícito del usuario (revisión de seguridad — IDOR):
// hace falta para que Administrador/Comité no pueda tocar la mascota de
// OTRO condominio solo adivinando el id — ver la nota completa en
// mascotas.ts -> puedeEditar.
async function getCondominioDeMascota(id: number): Promise<number | undefined> {
  const fila = (await db
    .prepare(
      `SELECT un.condominio_id_condominio
       FROM mascota m
       JOIN unidad un ON un.id_unidad = m.unidad_id_unidad
       WHERE m.id_mascota = ?`
    )
    .get(id)) as { condominio_id_condominio: number } | undefined;
  return fila?.condominio_id_condominio;
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

// ---------------------------------------------------------------------------
// Vacunas (ronda 50, a pedido explícito del usuario, con referencia
// visual) — ver la nota completa de la regla "Vigente/Vencida" en
// schema-mysql.sql, sobre la tabla mascota_vacuna.
// ---------------------------------------------------------------------------

export async function listarVacunas(mascotaId: number) {
  const filas = (await db
    .prepare(
      `SELECT id_mascotavacuna, nombre_vacuna, descripcion, fecha_aplicacion, fecha_vencimiento
       FROM mascota_vacuna WHERE mascota_id_mascota = ? ORDER BY fecha_aplicacion DESC`
    )
    .all(mascotaId)) as {
    id_mascotavacuna: number;
    nombre_vacuna: string;
    descripcion: string | null;
    fecha_aplicacion: string;
    fecha_vencimiento: string | null;
  }[];

  const hoyISO = new Date().toISOString().slice(0, 10);
  return filas.map((f) => ({
    ...f,
    // Sin fecha de vencimiento cargada = se asume vigente (no se inventa
    // una duración estándar por tipo de vacuna).
    vigente: !f.fecha_vencimiento || f.fecha_vencimiento >= hoyISO,
  }));
}

export async function crearVacuna(
  mascotaId: number,
  input: { nombreVacuna: string; descripcion?: string | null; fechaAplicacion: string; fechaVencimiento?: string | null },
  creadoPorUsuarioId: number
) {
  if (!input.nombreVacuna?.trim()) throw new Error("Falta el nombre de la vacuna.");
  if (!input.fechaAplicacion) throw new Error("Falta la fecha en que se aplicó la vacuna.");
  const insert = await db
    .prepare(
      `INSERT INTO mascota_vacuna (mascota_id_mascota, nombre_vacuna, descripcion, fecha_aplicacion, fecha_vencimiento, creado_por_usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(mascotaId, input.nombreVacuna.trim(), input.descripcion?.trim() || null, input.fechaAplicacion, input.fechaVencimiento || null, creadoPorUsuarioId);
  return { id_mascotavacuna: Number(insert.lastInsertRowid) };
}

export async function actualizarVacuna(
  id: number,
  input: { nombreVacuna?: string; descripcion?: string | null; fechaAplicacion?: string; fechaVencimiento?: string | null }
) {
  const campos: string[] = [];
  const valores: unknown[] = [];
  if (input.nombreVacuna !== undefined) {
    if (!input.nombreVacuna.trim()) throw new Error("El nombre de la vacuna no puede quedar vacío.");
    campos.push("nombre_vacuna = ?");
    valores.push(input.nombreVacuna.trim());
  }
  if (input.descripcion !== undefined) {
    campos.push("descripcion = ?");
    valores.push(input.descripcion?.trim() || null);
  }
  if (input.fechaAplicacion !== undefined) {
    if (!input.fechaAplicacion) throw new Error("La fecha de aplicación no puede quedar vacía.");
    campos.push("fecha_aplicacion = ?");
    valores.push(input.fechaAplicacion);
  }
  if (input.fechaVencimiento !== undefined) {
    campos.push("fecha_vencimiento = ?");
    valores.push(input.fechaVencimiento || null);
  }
  if (campos.length > 0) {
    valores.push(id);
    await db.prepare(`UPDATE mascota_vacuna SET ${campos.join(", ")} WHERE id_mascotavacuna = ?`).run(...valores);
  }
}

export async function eliminarVacuna(id: number) {
  await db.prepare(`DELETE FROM mascota_vacuna WHERE id_mascotavacuna = ?`).run(id);
}

// Para el chequeo de pertenencia en la ruta (¿esta vacuna es de una
// mascota de este residente/condominio?).
export async function getMascotaDeVacuna(idVacuna: number): Promise<number | undefined> {
  const fila = (await db.prepare(`SELECT mascota_id_mascota FROM mascota_vacuna WHERE id_mascotavacuna = ?`).get(idVacuna)) as
    | { mascota_id_mascota: number }
    | undefined;
  return fila?.mascota_id_mascota;
}

export { getUnidadDeMascota, getCondominioDeMascota };
