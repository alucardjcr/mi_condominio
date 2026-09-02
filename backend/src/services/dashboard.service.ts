import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Ronda 47, a pedido explícito del usuario: dashboard real para el Home del
// Administrador (antes solo tenía un aviso genérico + contador de
// notificaciones). Referencia visual: tarjetas con datos del condominio,
// gasto común, estacionamientos, solicitudes pendientes, seguridad, y
// actividad reciente.
//
// TODO lo que devuelve esta función es dato REAL de tablas que ya existen
// — nada inventado. Un par de conceptos de la referencia no tienen un
// campo 1 a 1 en el modelo actual, así que se adaptaron a lo que sí existe
// (documentado en cada punto):
//   - No hay foto propia del condominio en el modelo (`condominio` solo
//     tiene el nombre) — no se inventa una URL de foto.
//   - "Gasto común" en este sistema es un flag booleano por depto
//     (flg_gastocomun, sin monto ni período) — no un monto en pesos con
//     % pagado del mes; se calcula el % de deptos marcados como pagados,
//     sin inventar un monto total que no existe en ningún lado.
//   - "Conserjes conectados" se traduce a guardias con cuenta ACTIVA
//     (flg_vigencia=1) — no hay tracking de presencia en tiempo real en
//     este sistema.
//   - "Visitas pendientes" se traduce a visitas actualmente DENTRO del
//     condominio (con entrada registrada y sin salida todavía).
//   - "Solicitudes abiertas/urgentes" combina lo que en este sistema sí
//     son solicitudes reales pendientes de que el Administrador actúe:
//     multas pendientes de aprobación + solicitudes ARCO pendientes
//     (abiertas), e incidentes de seguridad con el plazo de 72h vencido
//     (urgentes).
// ---------------------------------------------------------------------------

export async function obtenerDashboardAdmin(condominioId: number) {
  const [
    condominio,
    deptos,
    residentesActivos,
    espaciosComunes,
    guardiasActivos,
    gastoComun,
    estacionamientos,
    visitasDentro,
    multasPendientes,
    arcoPendientes,
    incidentesAbiertos,
    incidentesVencidos,
    ultimoEventoBitacora,
  ] = await Promise.all([
    db.prepare(`SELECT gls_condominio FROM condominio WHERE id_condominio = ?`).get(condominioId) as Promise<{ gls_condominio: string } | undefined>,
    db.prepare(`SELECT COUNT(*) AS n FROM unidad WHERE condominio_id_condominio = ? AND flg_vigencia = 1`).get(condominioId) as Promise<{ n: number }>,
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM usuario u JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
         WHERE u.condominio_id_condominio = ? AND tu.gls_tipousuario = 'Residente' AND u.flg_vigencia = 1`
      )
      .get(condominioId) as Promise<{ n: number }>,
    db.prepare(`SELECT COUNT(*) AS n FROM espacio_comun WHERE condominio_id_condominio = ?`).get(condominioId) as Promise<{ n: number }>,
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM usuario u JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
         WHERE u.condominio_id_condominio = ? AND tu.gls_tipousuario = 'Guardia' AND u.flg_vigencia = 1`
      )
      .get(condominioId) as Promise<{ n: number }>,
    db
      .prepare(`SELECT COUNT(*) AS total, SUM(flg_gastocomun) AS pagados FROM unidad WHERE condominio_id_condominio = ? AND flg_vigencia = 1`)
      .get(condominioId) as Promise<{ total: number; pagados: number | null }>,
    db.prepare(`SELECT COUNT(*) AS n FROM estacionamiento WHERE condominio_id_condominio = ?`).get(condominioId) as Promise<{ n: number }>,
    db.prepare(`SELECT COUNT(*) AS n FROM visita WHERE condominio_id_condominio = ? AND fecha_salida IS NULL`).get(condominioId) as Promise<{
      n: number;
    }>,
    db
      .prepare(`SELECT COUNT(*) AS n FROM amonestacion WHERE condominio_id_condominio = ? AND estado = 'Pendiente de aprobación'`)
      .get(condominioId) as Promise<{ n: number }>,
    db.prepare(`SELECT COUNT(*) AS n FROM solicitud_arco WHERE condominio_id_condominio = ? AND estado = 'Pendiente'`).get(condominioId) as Promise<{
      n: number;
    }>,
    db.prepare(`SELECT COUNT(*) AS n FROM incidente_seguridad WHERE condominio_id_condominio = ? AND estado = 'Abierto'`).get(condominioId) as Promise<{
      n: number;
    }>,
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM incidente_seguridad
         WHERE condominio_id_condominio = ? AND estado = 'Abierto' AND fecha_deteccion < NOW() - INTERVAL 72 HOUR`
      )
      .get(condominioId) as Promise<{ n: number }>,
    db
      .prepare(`SELECT fecha_hora FROM bitacora_guardia WHERE condominio_id_condominio = ? ORDER BY id_bitacora DESC LIMIT 1`)
      .get(condominioId) as Promise<{ fecha_hora: string } | undefined>,
  ]);

  const pagados = gastoComun.pagados ?? 0;
  const porcentajePagado = gastoComun.total > 0 ? Math.round((pagados / gastoComun.total) * 100) : 0;

  return {
    condominio: {
      nombre: condominio?.gls_condominio ?? "",
      total_deptos: deptos.n,
      residentes_activos: residentesActivos.n,
      espacios_comunes: espaciosComunes.n,
      guardias_activos: guardiasActivos.n,
    },
    gasto_comun: {
      deptos_pagados: pagados,
      deptos_total: gastoComun.total,
      porcentaje_pagado: porcentajePagado,
    },
    estacionamientos: {
      total_cupos: estacionamientos.n,
      visitas_dentro: visitasDentro.n,
    },
    solicitudes: {
      abiertas: multasPendientes.n + arcoPendientes.n,
      urgentes: incidentesVencidos.n,
    },
    seguridad: {
      incidentes_abiertos: incidentesAbiertos.n,
      ultimo_evento: ultimoEventoBitacora?.fecha_hora ?? null,
    },
  };
}

// Actividad reciente: últimas entradas de bitácora (registro cronológico
// que ya llevan los guardias de cada evento relevante) — reutiliza esa
// misma fuente en vez de inventar un feed de actividad aparte.
export async function obtenerActividadReciente(condominioId: number, limite = 8) {
  return db
    .prepare(
      `SELECT bg.id_bitacora, bg.texto, bg.fecha_hora, u.nombre_usuario
       FROM bitacora_guardia bg
       JOIN usuario u ON u.id_usuario = bg.usuario_id_usuario_guardia
       WHERE bg.condominio_id_condominio = ?
       ORDER BY bg.id_bitacora DESC LIMIT ?`
    )
    .all(condominioId, limite);
}
