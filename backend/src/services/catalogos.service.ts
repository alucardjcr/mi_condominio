import { db } from "../db/client";

export async function listarTorres(condominioId: number) {
  return db
    .prepare(
      `SELECT id_torreblock, nombre_torre FROM torre_block WHERE condominio_id_condominio = ? AND flg_vigencia = 1 ORDER BY nombre_torre`
    )
    .all(condominioId);
}

export async function listarUnidadesPorTorre(torreId: number) {
  return db
    .prepare(
      `SELECT id_unidad, numero_unidad FROM unidad WHERE torre_block_id_torreblock = ? AND flg_vigencia = 1 ORDER BY numero_unidad`
    )
    .all(torreId);
}

export async function listarResidentesPorUnidad(unidadId: number) {
  return db
    .prepare(
      `SELECT id_usuario, nombre_usuario FROM usuario
       WHERE unidad_id_unidad = ? AND tipo_usuario_id_tipousuario = (
         SELECT id_tipousuario FROM tipo_usuario WHERE gls_tipousuario = 'Residente'
       ) AND flg_vigencia = 1
       ORDER BY nombre_usuario`
    )
    .all(unidadId);
}

export async function listarTiposPermiso() {
  return db
    .prepare(
      `SELECT id_tipopermiso, gls_tipopermiso, tiempo_gratis_minutos, tarifa_por_minuto_extra, monto_fijo, sin_limite_tiempo, dias_minimo, dias_maximo
       FROM tipo_permiso_visita WHERE flg_vigencia = 1 ORDER BY id_tipopermiso`
    )
    .all();
}

export async function listarTiposTenenciaPatente() {
  return db.prepare(`SELECT id_tipotenencia, gls_tipotenencia FROM tipo_tenencia_patente ORDER BY id_tipotenencia`).all();
}

// Tipos de paquete (paquetería) — incluye "Bulto", el default cuando el
// guardia no elige ningún tipo al registrar la llegada.
export async function listarTiposPaquete(condominioId: number) {
  return db
    .prepare(
      `SELECT id_tipopaquete, gls_tipopaquete FROM tipo_paquete WHERE condominio_id_condominio = ? AND flg_vigencia = 1 ORDER BY id_tipopaquete`
    )
    .all(condominioId);
}

// Tipos de residente (ronda 14): Propietario, Arrendatario, Pareja del
// propietario, Roomie, Familiar, Otro — a qué título vive alguien en el
// depto (para que el administrador pueda informar a la PDI, si lo piden,
// quién vive en una unidad y a qué título).
export async function listarTiposResidente() {
  return db.prepare(`SELECT id_tiporesidente, gls_tiporesidente FROM tipo_residente WHERE flg_vigencia = 1 ORDER BY id_tiporesidente`).all();
}

// Residentes con carnet de discapacidad vigente — para que el guardia
// pueda buscar/seleccionar quién va a usar el cupo (regla 1 de discapacitados).
// Ronda 61, a pedido explícito del usuario: mismo bug exacto — no
// filtraba por condominio, y encima es información sensible (estado de
// discapacidad), más grave todavía que las otras 3.
export async function listarResidentesConCarnetDiscapacidad(condominioId: number) {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, un.numero_unidad, tb.nombre_torre
       FROM residente_discapacitado rd
       JOIN usuario u ON u.id_usuario = rd.usuario_id_usuario
       JOIN unidad un ON un.id_unidad = u.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE rd.flg_vigencia = 1 AND u.flg_vigencia = 1 AND u.condominio_id_condominio = ?
       ORDER BY u.nombre_usuario`
    )
    .all(condominioId);
}
