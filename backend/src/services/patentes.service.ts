import { db } from "../db/client";

export async function consultarPatente(patente: string) {
  const normalizada = patente.trim().toUpperCase();

  return db
    .prepare(
      `SELECT
         p.patente,
         tt.gls_tipotenencia,
         u.numero_unidad,
         tb.nombre_torre
       FROM patente_condominio p
       JOIN tipo_tenencia_patente tt ON tt.id_tipotenencia = p.tipo_tenencia_id_tipotenencia
       JOIN unidad u ON u.id_unidad = p.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = u.torre_block_id_torreblock
       WHERE UPPER(p.patente) = ? AND p.flg_vigencia = 1`
    )
    .get(normalizada);
}
