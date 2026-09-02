import { db } from "../db/client";
import { GuardiaAutenticado } from "./auth.service";

// ---------------------------------------------------------------------------
// Estacionamientos para arriendo entre residentes (ronda 20). El schema ya
// traía anticipado el tipo_estacionamiento "Residente" y
// estacionamiento.unidad_id_unidad ("cupo fijo de residente") desde antes —
// este módulo solo agrega precio_arriendo (columna nueva) y un estado
// "Disponible para arriendo" (fila nueva en estado_estacionamiento) para
// reutilizar el mismo mecanismo de catálogo que ya usa el resto del cupo.
//
// Reglas cerradas con el usuario: es un "pizarrón" informativo (el guardia
// solo consulta, no arrienda desde la app — sin flujo de solicitud/
// aprobación). Cada residente cambia el estado de SU PROPIO cupo (el que
// tenga unidad_id_unidad = su unidad); Administrador/Comité pueden cambiar
// el de cualquier unidad.
// ---------------------------------------------------------------------------

const GLS_ESTADO_DISPONIBLE_ARRIENDO = "Disponible para arriendo";
const GLS_ESTADO_OCUPADO = "Ocupado";
const GLS_TIPOEST_RESIDENTE = "Residente";

async function getIdByGls(table: string, idColumn: string, glsColumn: string, valor: string): Promise<number> {
  const row = (await db.prepare(`SELECT ${idColumn} as id FROM ${table} WHERE ${glsColumn} = ?`).get(valor)) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`No se encontró "${valor}" en ${table}. Revisa el seed de catálogos.`);
  return row.id;
}

/** Pizarrón completo de cupos de residente del condominio (visible para Guardia/Administrador/Residente). */
export async function listarPizarronArriendo(condominioId: number) {
  return db
    .prepare(
      `SELECT
         e.id_estacionamiento, e.numero_estacionamiento, e.precio_arriendo, e.unidad_id_unidad,
         ee.gls_estadoestacionamiento,
         un.numero_unidad, tb.nombre_torre
       FROM estacionamiento e
       JOIN estado_estacionamiento ee ON ee.id_estadoestacionamiento = e.estado_estacionamiento_id_estadoestacionamiento
       JOIN tipo_estacionamiento te ON te.id_tipoestacionamiento = e.tipo_estacionamiento_id_tipoestacionamiento
       LEFT JOIN unidad un ON un.id_unidad = e.unidad_id_unidad
       LEFT JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE e.condominio_id_condominio = ? AND te.gls_tipoestacionamiento = ?`
    )
    .all(condominioId, GLS_TIPOEST_RESIDENTE);
}

export async function actualizarEstadoArriendo(
  id: number,
  input: { disponible: boolean; precioArriendo: number | null },
  usuario: GuardiaAutenticado
) {
  const spot = (await db
    .prepare(
      `SELECT e.id_estacionamiento, e.unidad_id_unidad, e.condominio_id_condominio
       FROM estacionamiento e
       JOIN tipo_estacionamiento te ON te.id_tipoestacionamiento = e.tipo_estacionamiento_id_tipoestacionamiento
       WHERE e.id_estacionamiento = ? AND te.gls_tipoestacionamiento = ?`
    )
    .get(id, GLS_TIPOEST_RESIDENTE)) as { id_estacionamiento: number; unidad_id_unidad: number | null; condominio_id_condominio: number } | undefined;
  if (!spot) throw new Error(`No existe un cupo de residente con id ${id}.`);

  // Ronda 44, a pedido explícito del usuario (revisión de seguridad —
  // IDOR): antes "esAdminOComite" dejaba pasar sin verificar que el cupo
  // fuera de SU condominio — un Administrador/Comité de un condominio
  // podía cambiar el estado de arriendo de un cupo de OTRO condominio con
  // solo adivinar el id. Mismo patrón encontrado y corregido en
  // mascotas.ts y reservas.ts en esta misma ronda.
  const esAdminOComite =
    (usuario.rol === "Administrador" || !!usuario.esComite) && usuario.condominio_id_condominio === spot.condominio_id_condominio;
  const esDueño = usuario.rol === "Residente" && usuario.unidad_id_unidad != null && usuario.unidad_id_unidad === spot.unidad_id_unidad;
  if (!esAdminOComite && !esDueño) {
    const err: any = new Error(
      "Solo el residente dueño de este cupo, el Administrador o el Comité pueden cambiar su estado de arriendo."
    );
    err.status = 403;
    throw err;
  }

  if (input.disponible && (!input.precioArriendo || input.precioArriendo <= 0)) {
    throw new Error("Debes indicar un precio de arriendo mayor a 0 para marcar el cupo disponible.");
  }

  const estadoGls = input.disponible ? GLS_ESTADO_DISPONIBLE_ARRIENDO : GLS_ESTADO_OCUPADO;
  const estadoId = await getIdByGls("estado_estacionamiento", "id_estadoestacionamiento", "gls_estadoestacionamiento", estadoGls);

  await db
    .prepare(`UPDATE estacionamiento SET estado_estacionamiento_id_estadoestacionamiento = ?, precio_arriendo = ? WHERE id_estacionamiento = ?`)
    .run(estadoId, input.disponible ? input.precioArriendo : null, id);

  return db
    .prepare(
      `SELECT e.id_estacionamiento, e.numero_estacionamiento, e.precio_arriendo, ee.gls_estadoestacionamiento
       FROM estacionamiento e
       JOIN estado_estacionamiento ee ON ee.id_estadoestacionamiento = e.estado_estacionamiento_id_estadoestacionamiento
       WHERE e.id_estacionamiento = ?`
    )
    .get(id);
}
