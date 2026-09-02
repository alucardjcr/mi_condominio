import { db, DbLike } from "../db/client";

// Ronda 41, a pedido explícito del usuario: "cada condominio puede definir
// sus tipos de amonestaciones... por defecto todas tendrán las principales".
// Estas son las listas EXACTAS del ERD original (tipo_amonestacion con 11
// filas, tipo_multa con 20, ambas ya traían "fk_idcondominio" desde el
// diseño original — solo faltaba construir el módulo). Se siembran una vez
// por condominio: acá para condominios nuevos (ver
// condominios.service.ts -> crearCondominioConEstructura) y en seed.ts
// para el condominio de demo/pruebas.

export const TIPOS_AMONESTACION_DEFAULT: { gls: string; esMulta: boolean }[] = [
  { gls: "Verbal", esMulta: false },
  { gls: "Escrita", esMulta: false },
  { gls: "Multa económica", esMulta: true },
  { gls: "Suspensión de uso de espacios comunes", esMulta: false },
  { gls: "Prohibición temporal de visitas", esMulta: false },
  { gls: "Retiro de vehículo por mal uso de estacionamiento", esMulta: false },
  { gls: "Retiro de mascota por incumplimiento de normas", esMulta: false },
  { gls: "Reporte a juntas de copropietarios", esMulta: false },
  { gls: "Denuncia a autoridades competentes", esMulta: false },
  { gls: "Retiro de basura acumulada a costa del residente", esMulta: false },
  { gls: "Costo de reparación por daño a bienes comunes", esMulta: false },
];

export const TIPOS_MULTA_DEFAULT: { gls: string; monto: number; unidad: "UF" | "UTM" }[] = [
  { gls: "Ruidos molestos", monto: 1, unidad: "UF" },
  { gls: "Mascota sin supervisión", monto: 1, unidad: "UF" },
  { gls: "Uso no autorizado de espacios comunes", monto: 2, unidad: "UF" },
  { gls: "Derrame de basura en áreas comunes", monto: 1, unidad: "UF" },
  { gls: "Estacionamiento en zona no permitida", monto: 1, unidad: "UF" },
  { gls: "Mal uso del ascensor", monto: 1, unidad: "UF" },
  { gls: "Daño a bienes comunes", monto: 3, unidad: "UF" },
  { gls: "Orinar o defecar mascota en áreas comunes", monto: 1, unidad: "UF" },
  { gls: "No respetar horario de uso de quincho", monto: 1, unidad: "UF" },
  { gls: "Realizar modificaciones sin autorización", monto: 5, unidad: "UF" },
  { gls: "Obstruir pasillos o escaleras con objetos", monto: 0, unidad: "UF" },
  { gls: "Acumulación de basura en balcones", monto: 1, unidad: "UF" },
  { gls: "Violación de normas sanitarias", monto: 2, unidad: "UF" },
  { gls: "Mal uso de piscina comunitaria", monto: 1, unidad: "UF" },
  { gls: "Arrojar objetos desde altura", monto: 2, unidad: "UF" },
  { gls: "No pago de gastos comunes", monto: 1, unidad: "UTM" },
  { gls: "No cumplir resolución comité de administración", monto: 2, unidad: "UF" },
  { gls: "Realizar fiestas sin autorización", monto: 2, unidad: "UF" },
  { gls: "Invitados no registrados en conserjería", monto: 0, unidad: "UF" },
  { gls: "Actitud agresiva con personal del condominio", monto: 2, unidad: "UF" },
];

// Ronda 41: se aprovecha para sembrar también tipo_notificacion con
// "Amonestación" y "Multa" — nuevos tipos que necesita este módulo para
// avisarle al residente (ver notificaciones.service.ts).
export const GLS_TIPONOTIF_AMONESTACION = "Amonestación";
export const GLS_TIPONOTIF_MULTA = "Multa";

/**
 * Siembra los catálogos por defecto de amonestaciones/multas (y los 2
 * tipos de notificación nuevos) para UN condominio — idempotente (no
 * duplica si ya existían, así que es seguro llamarla más de una vez sobre
 * el mismo condominio).
 */
export async function sembrarCatalogosAmonestacionMulta(condominioId: number, conn: DbLike = db) {
  const yaTieneAmonestacion = await conn
    .prepare(`SELECT 1 FROM tipo_amonestacion WHERE condominio_id_condominio = ? LIMIT 1`)
    .get(condominioId);
  if (!yaTieneAmonestacion) {
    for (const t of TIPOS_AMONESTACION_DEFAULT) {
      await conn
        .prepare(`INSERT INTO tipo_amonestacion (gls_tipoamonestacion, flg_es_multa, condominio_id_condominio) VALUES (?, ?, ?)`)
        .run(t.gls, t.esMulta ? 1 : 0, condominioId);
    }
  }

  const yaTieneMulta = await conn.prepare(`SELECT 1 FROM tipo_multa WHERE condominio_id_condominio = ? LIMIT 1`).get(condominioId);
  if (!yaTieneMulta) {
    for (const t of TIPOS_MULTA_DEFAULT) {
      await conn
        .prepare(`INSERT INTO tipo_multa (gls_tipomulta, monto_sugerido, unidad_monto, condominio_id_condominio) VALUES (?, ?, ?, ?)`)
        .run(t.gls, t.monto, t.unidad, condominioId);
    }
  }

  for (const gls of [GLS_TIPONOTIF_AMONESTACION, GLS_TIPONOTIF_MULTA]) {
    const existe = await conn
      .prepare(`SELECT 1 FROM tipo_notificacion WHERE gls_tiponotificacion = ? AND condominio_id_condominio = ?`)
      .get(gls, condominioId);
    if (!existe) {
      await conn.prepare(`INSERT INTO tipo_notificacion (gls_tiponotificacion, condominio_id_condominio) VALUES (?, ?)`).run(gls, condominioId);
    }
  }
}
