import { db } from "../db/client";

// Ronda 34, a pedido explícito del usuario: retención de datos (Ley 21.719
// de Protección de Datos Personales — principio de minimización). Ver la
// nota completa en schema-mysql.sql sobre las categorías cubiertas y por
// qué se dejaron afuera los datos financieros/contables y las fichas de
// personas (residentes, guardias, vetados).

export const CATEGORIAS_RETENCION = ["Visitas", "Bitacora", "LogAuditoria"] as const;
export type CategoriaRetencion = (typeof CATEGORIAS_RETENCION)[number];

const NOMBRE_CATEGORIA: Record<CategoriaRetencion, string> = {
  Visitas: "Historial de visitas (entradas/salidas)",
  Bitacora: "Bitácora de novedades del turno",
  LogAuditoria: "Registro de auditoría",
};

export interface PoliticaRetencionItem {
  categoria: CategoriaRetencion;
  nombre: string;
  dias_retencion: number | null; // null = sin configurar, nunca se borra nada de esta categoría
}

// Ronda 35, a pedido explícito del usuario: cada condominio puede definir
// el plazo en la unidad que le acomode (días, semanas o años) — puertas
// adentro sigue viviendo todo en días (dias_retencion, sin tocar el
// schema), pero la API acepta {cantidad, unidad} y hace la conversión acá,
// en un solo lugar, para no duplicar esta cuenta en cada pantalla/ruta.
export type UnidadRetencion = "dias" | "semanas" | "anios";
const DIAS_POR_UNIDAD: Record<UnidadRetencion, number> = { dias: 1, semanas: 7, anios: 365 };

export function convertirADias(cantidad: number, unidad: UnidadRetencion): number {
  const factor = DIAS_POR_UNIDAD[unidad];
  if (!factor) throw new Error("Unidad inválida — debe ser 'dias', 'semanas' o 'anios'.");
  return Math.round(cantidad * factor);
}

export async function listarPoliticasRetencion(condominioId: number): Promise<PoliticaRetencionItem[]> {
  const filas = (await db
    .prepare(`SELECT categoria, dias_retencion FROM politica_retencion WHERE condominio_id_condominio = ?`)
    .all(condominioId)) as { categoria: string; dias_retencion: number }[];

  const configuradas = new Map(filas.map((f) => [f.categoria, f.dias_retencion]));
  return CATEGORIAS_RETENCION.map((categoria) => ({
    categoria,
    nombre: NOMBRE_CATEGORIA[categoria],
    dias_retencion: configuradas.get(categoria) ?? null,
  }));
}

export async function configurarPoliticaRetencion(
  condominioId: number,
  categoria: CategoriaRetencion,
  diasRetencion: number | null
) {
  if (!CATEGORIAS_RETENCION.includes(categoria)) {
    throw new Error("Categoría inválida.");
  }
  if (diasRetencion !== null && (!Number.isInteger(diasRetencion) || diasRetencion < 7)) {
    throw new Error("Los días de retención deben ser un número entero de al menos 7 (o vacío, para desactivar).");
  }

  if (diasRetencion === null) {
    await db
      .prepare(`DELETE FROM politica_retencion WHERE condominio_id_condominio = ? AND categoria = ?`)
      .run(condominioId, categoria);
    return;
  }

  const existente = await db
    .prepare(`SELECT id_politicaretencion FROM politica_retencion WHERE condominio_id_condominio = ? AND categoria = ?`)
    .get(condominioId, categoria);
  if (existente) {
    await db
      .prepare(`UPDATE politica_retencion SET dias_retencion = ? WHERE condominio_id_condominio = ? AND categoria = ?`)
      .run(diasRetencion, condominioId, categoria);
  } else {
    await db
      .prepare(`INSERT INTO politica_retencion (condominio_id_condominio, categoria, dias_retencion) VALUES (?, ?, ?)`)
      .run(condominioId, categoria, diasRetencion);
  }
}

export interface ResultadoLimpieza {
  categoria: CategoriaRetencion;
  nombre: string;
  dias_retencion: number;
  filas_eliminadas: number;
}

/**
 * Borra, para cada categoría CONFIGURADA (las que no tienen política
 * definida se saltan por completo — ver el criterio en la nota del
 * schema), todas las filas más antiguas que su plazo. Ronda 35: se
 * dispara automáticamente todos los días vía cron (ver index.ts ->
 * ejecutarLimpiezaRetencionTodosLosCondominios) — el botón "Ejecutar
 * limpieza ahora" del panel de Administrador sigue existiendo para poder
 * forzarla al toque sin esperar al cron.
 */
export async function ejecutarLimpiezaRetencion(condominioId: number): Promise<ResultadoLimpieza[]> {
  const politicas = await listarPoliticasRetencion(condominioId);
  const resultados: ResultadoLimpieza[] = [];

  for (const politica of politicas) {
    if (politica.dias_retencion === null) continue;
    const cortada = new Date(Date.now() - politica.dias_retencion * 24 * 60 * 60 * 1000).toISOString();
    let filasEliminadas = 0;

    if (politica.categoria === "Bitacora") {
      const r = await db
        .prepare(`DELETE FROM bitacora_guardia WHERE condominio_id_condominio = ? AND fecha_hora < ?`)
        .run(condominioId, cortada);
      filasEliminadas = r.changes;
    } else if (politica.categoria === "LogAuditoria") {
      const r = await db
        .prepare(`DELETE FROM log_auditoria WHERE condominio_id_condominio = ? AND fecha < ?`)
        .run(condominioId, cortada);
      filasEliminadas = r.changes;
    } else if (politica.categoria === "Visitas") {
      // No borra una visita que tenga una constancia de exceso de tiempo
      // asociada (registro financiero/de cobro) — ese dato tiene su propio
      // ciclo de vida contable, no el operativo de "cuánto dura una
      // entrada/salida guardada". fecha_entrada es VARCHAR con fecha ISO
      // (ver la nota en db/client.ts), así que la comparación es de texto,
      // pero funciona igual que una comparación de fecha porque el formato
      // ISO 8601 ordena bien alfabéticamente.
      const r = await db
        .prepare(
          `DELETE FROM visita
           WHERE condominio_id_condominio = ? AND fecha_entrada < ?
             AND NOT EXISTS (SELECT 1 FROM constancia_exceso_tiempo WHERE visita_id_visita = visita.id_visita)`
        )
        .run(condominioId, cortada);
      filasEliminadas = r.changes;
    }

    resultados.push({
      categoria: politica.categoria,
      nombre: politica.nombre,
      dias_retencion: politica.dias_retencion,
      filas_eliminadas: filasEliminadas,
    });
  }

  return resultados;
}

/**
 * Ronda 35: corre ejecutarLimpiezaRetencion() para TODOS los condominios
 * que tengan al menos una categoría configurada — es lo que dispara el
 * cron diario (ver index.ts). Un condominio sin ninguna política
 * configurada ni siquiera se toca (no aparece en la consulta).
 */
export async function ejecutarLimpiezaRetencionTodosLosCondominios(): Promise<
  { condominioId: number; resultados: ResultadoLimpieza[] }[]
> {
  const condominios = (await db
    .prepare(`SELECT DISTINCT condominio_id_condominio FROM politica_retencion`)
    .all()) as { condominio_id_condominio: number }[];

  const salida: { condominioId: number; resultados: ResultadoLimpieza[] }[] = [];
  for (const c of condominios) {
    const resultados = await ejecutarLimpiezaRetencion(c.condominio_id_condominio);
    salida.push({ condominioId: c.condominio_id_condominio, resultados });
  }
  return salida;
}
