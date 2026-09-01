import { db } from "../db/client";

// Ronda 27: facturación por condominio, a pedido explícito del usuario —
// ver la tabla condominio_facturacion/pago_condominio en schema-mysql.sql
// para el modelo de datos completo.

// Todo el cálculo de "en qué día del mes estamos" usa SIEMPRE la hora de
// Chile (America/Santiago), sin importar en qué huso horario esté
// corriendo el servidor (Railway suele correr en UTC) — así el día límite
// de pago (ej. "día 5") coincide con el día 5 en Chile, no en UTC.
function hoyEnChile(): { periodo: string; dia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  const year = obtener("year");
  const month = obtener("month");
  const day = obtener("day");
  return { periodo: `${year}-${month}`, dia: Number(day) };
}

interface FacturacionCondominio {
  monto_mensualidad: number | null;
  dia_limite_pago: number;
}

async function obtenerFacturacion(condominioId: number): Promise<FacturacionCondominio | null> {
  const fila = (await db
    .prepare(`SELECT monto_mensualidad, dia_limite_pago FROM condominio_facturacion WHERE condominio_id_condominio = ?`)
    .get(condominioId)) as FacturacionCondominio | undefined;
  return fila ?? null;
}

/**
 * ¿Este condominio está bloqueado AHORA MISMO por falta de pago?
 *
 * - Sin fila de facturación, o con monto_mensualidad NULL (todavía sin
 *   configurar) -> nunca bloqueado. Así ningún condominio existente queda
 *   bloqueado de sorpresa el día que se desplegó esta ronda; el SuperAdmin
 *   tiene que configurarle un precio a propósito primero.
 * - Dentro de los primeros `dia_limite_pago` días del mes (hora de Chile)
 *   -> nunca bloqueado, esté pagado o no (período de gracia).
 * - Pasado ese día: bloqueado, A MENOS que ya exista un pago_condominio
 *   con fecha_pago para el período actual.
 */
export async function condominioEstaBloqueado(condominioId: number): Promise<boolean> {
  const facturacion = await obtenerFacturacion(condominioId);
  if (!facturacion || facturacion.monto_mensualidad === null) return false;

  const { periodo, dia } = hoyEnChile();
  if (dia <= facturacion.dia_limite_pago) return false;

  const pago = (await db
    .prepare(
      `SELECT 1 FROM pago_condominio WHERE condominio_id_condominio = ? AND periodo = ? AND fecha_pago IS NOT NULL`
    )
    .get(condominioId, periodo)) as unknown;
  return !pago;
}

// --- Panel del SuperAdmin --------------------------------------------------

export interface CondominioConFacturacion {
  id_condominio: number;
  nombre: string;
  monto_mensualidad: number | null;
  dia_limite_pago: number;
  bloqueado: boolean;
  periodo_actual: string;
  pagado_periodo_actual: boolean;
}

export async function listarCondominiosConFacturacion(): Promise<CondominioConFacturacion[]> {
  const condominios = (await db
    .prepare(
      `SELECT c.id_condominio, c.gls_condominio AS nombre, cf.monto_mensualidad, cf.dia_limite_pago
       FROM condominio c
       LEFT JOIN condominio_facturacion cf ON cf.condominio_id_condominio = c.id_condominio
       WHERE c.flg_vigencia = 1
       ORDER BY c.gls_condominio`
    )
    .all()) as { id_condominio: number; nombre: string; monto_mensualidad: number | null; dia_limite_pago: number | null }[];

  const { periodo } = hoyEnChile();
  const resultado: CondominioConFacturacion[] = [];
  for (const c of condominios) {
    const pago = (await db
      .prepare(
        `SELECT 1 FROM pago_condominio WHERE condominio_id_condominio = ? AND periodo = ? AND fecha_pago IS NOT NULL`
      )
      .get(c.id_condominio, periodo)) as unknown;
    resultado.push({
      id_condominio: c.id_condominio,
      nombre: c.nombre,
      monto_mensualidad: c.monto_mensualidad,
      dia_limite_pago: c.dia_limite_pago ?? 5,
      bloqueado: await condominioEstaBloqueado(c.id_condominio),
      periodo_actual: periodo,
      pagado_periodo_actual: !!pago,
    });
  }
  return resultado;
}

export async function configurarFacturacion(
  condominioId: number,
  input: { monto_mensualidad: number | null; dia_limite_pago?: number }
) {
  const existente = (await db
    .prepare(`SELECT id_condominiofacturacion FROM condominio_facturacion WHERE condominio_id_condominio = ?`)
    .get(condominioId)) as { id_condominiofacturacion: number } | undefined;

  const diaLimite = input.dia_limite_pago ?? 5;
  if (existente) {
    await db
      .prepare(`UPDATE condominio_facturacion SET monto_mensualidad = ?, dia_limite_pago = ? WHERE id_condominiofacturacion = ?`)
      .run(input.monto_mensualidad, diaLimite, existente.id_condominiofacturacion);
  } else {
    await db
      .prepare(
        `INSERT INTO condominio_facturacion (condominio_id_condominio, monto_mensualidad, dia_limite_pago) VALUES (?, ?, ?)`
      )
      .run(condominioId, input.monto_mensualidad, diaLimite);
  }
}

/**
 * Marca como pagado el período actual (o el que se indique) de un
 * condominio — hoy siempre a mano por el SuperAdmin (transferencia,
 * efectivo, etc.), pero pensado para que en el futuro lo llame un webhook
 * de una pasarela de pago en vez de un botón: ninguna otra parte del
 * sistema tendría que cambiar para eso.
 */
export async function marcarPagado(
  condominioId: number,
  input: { periodo?: string; monto: number; registradoPorUsuarioId: number | null }
) {
  const periodo = input.periodo ?? hoyEnChile().periodo;
  await db
    .prepare(
      `INSERT INTO pago_condominio (condominio_id_condominio, periodo, monto, fecha_pago, registrado_por_usuario_id)
       VALUES (?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE monto = VALUES(monto), fecha_pago = NOW(), registrado_por_usuario_id = VALUES(registrado_por_usuario_id)`
    )
    .run(condominioId, periodo, input.monto, input.registradoPorUsuarioId);
}
