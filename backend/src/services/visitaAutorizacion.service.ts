import { db, withTransaction, DbLike } from "../db/client";

// Ronda 80: autorización de visitas por el residente visitado. Ver la
// migración 20261020010000 para el modelo (tabla visita_autorizacion).

export const MINUTOS_ESPERA_PARA_LLAMAR = 5;

function nowIso() {
  return new Date().toISOString();
}

function minutosDesde(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

export async function crearSolicitudAutorizacion(conn: DbLike, idVisita: number) {
  await conn
    .prepare(`INSERT INTO visita_autorizacion (visita_id_visita, estado, fecha_solicitud) VALUES (?, 'Pendiente', ?)`)
    .run(idVisita, nowIso());
}

// Una visita rechazada no entra: se cierra en el acto (queda con salida) y,
// si ya tenía cupo de estacionamiento asignado, el cupo se libera.
async function cerrarVisitaRechazada(conn: DbLike, idVisita: number) {
  const visita = (await conn
    .prepare(`SELECT estacionamiento_id_estacionamiento AS est FROM visita WHERE id_visita = ?`)
    .get(idVisita)) as { est: number | null } | undefined;
  const ahora = nowIso();
  await conn
    .prepare(`UPDATE visita SET fecha_salida = ?, hora_salida = ? WHERE id_visita = ? AND fecha_salida IS NULL`)
    .run(ahora, ahora, idVisita);
  if (visita?.est) {
    const disponible = (await conn
      .prepare(`SELECT id_estadoestacionamiento AS id FROM estado_estacionamiento WHERE gls_estadoestacionamiento = 'Disponible'`)
      .get()) as { id: number } | undefined;
    if (disponible) {
      await conn
        .prepare(`UPDATE estacionamiento SET estado_estacionamiento_id_estadoestacionamiento = ? WHERE id_estacionamiento = ?`)
        .run(disponible.id, visita.est);
    }
  }
}

async function resolver(
  conn: DbLike,
  idVisita: number,
  estado: "Autorizada" | "Rechazada",
  por: "Residente" | "Guardia",
  usuarioId: number
) {
  await conn
    .prepare(
      `UPDATE visita_autorizacion SET estado = ?, fecha_respuesta = ?, respondida_por = ?, usuario_id_respondio = ?
       WHERE visita_id_visita = ? AND estado = 'Pendiente'`
    )
    .run(estado, nowIso(), por, usuarioId, idVisita);
  if (estado === "Rechazada") await cerrarVisitaRechazada(conn, idVisita);
}

export async function responderComoResidente(idVisita: number, usuarioId: number, accion: string) {
  if (accion !== "autorizar" && accion !== "rechazar") {
    throw new Error('La acción debe ser "autorizar" o "rechazar".');
  }
  return withTransaction(async (tx) => {
    const fila = (await tx
      .prepare(
        `SELECT va.estado, v.residente_visitado_usuario_id AS residente_id
         FROM visita_autorizacion va JOIN visita v ON v.id_visita = va.visita_id_visita
         WHERE va.visita_id_visita = ?`
      )
      .get(idVisita)) as { estado: string; residente_id: number | null } | undefined;
    if (!fila || fila.residente_id !== usuarioId) throw new Error("Esta visita no está dirigida a ti.");
    if (fila.estado !== "Pendiente") throw new Error(`Esta visita ya fue ${fila.estado.toLowerCase()}.`);
    const estado = accion === "autorizar" ? "Autorizada" : "Rechazada";
    await resolver(tx, idVisita, estado, "Residente", usuarioId);
    return { id_visita: idVisita, estado };
  });
}

// El guardia decide cuando el residente no contesta. "permitir" solo se
// habilita pasados MINUTOS_ESPERA_PARA_LLAMAR minutos de espera; "denegar"
// puede hacerse en cualquier momento.
export async function decidirComoGuardia(idVisita: number, condominioId: number, guardiaId: number, accion: string) {
  if (accion !== "permitir" && accion !== "denegar") {
    throw new Error('La acción debe ser "permitir" o "denegar".');
  }
  return withTransaction(async (tx) => {
    const fila = (await tx
      .prepare(
        `SELECT va.estado, va.fecha_solicitud, v.condominio_id_condominio AS condominio_id
         FROM visita_autorizacion va JOIN visita v ON v.id_visita = va.visita_id_visita
         WHERE va.visita_id_visita = ?`
      )
      .get(idVisita)) as { estado: string; fecha_solicitud: string; condominio_id: number } | undefined;
    if (!fila || fila.condominio_id !== condominioId) throw new Error("No existe esa visita en este condominio.");
    if (fila.estado !== "Pendiente") throw new Error(`Esta visita ya fue ${fila.estado.toLowerCase()}.`);
    if (accion === "permitir" && minutosDesde(fila.fecha_solicitud) < MINUTOS_ESPERA_PARA_LLAMAR) {
      throw new Error(`Hay que esperar ${MINUTOS_ESPERA_PARA_LLAMAR} minutos la respuesta del residente antes de dejar pasar a la visita.`);
    }
    const estado = accion === "permitir" ? "Autorizada" : "Rechazada";
    await resolver(tx, idVisita, estado, "Guardia", guardiaId);
    return { id_visita: idVisita, estado };
  });
}

// Lista para la pantalla "Visitas por autorizar" del guardia: las pendientes
// (hasta 12 h) y las resueltas en los últimos 30 minutos. El teléfono del
// residente solo se entrega cuando ya se puede llamar (>= 5 min esperando).
export async function listarAutorizacionesGuardia(condominioId: number) {
  const hace12h = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const hace30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const filas = (await db
    .prepare(
      `SELECT v.id_visita, v.nombre_visita, v.patente, v.nombre_residente_visitado,
              tv.gls_tipovisita, un.numero_unidad, tb.nombre_torre,
              va.estado, va.fecha_solicitud, va.fecha_respuesta, va.respondida_por,
              rp.telefono AS telefono_residente
       FROM visita_autorizacion va
       JOIN visita v ON v.id_visita = va.visita_id_visita
       JOIN tipo_visita tv ON tv.id_tipovisita = v.tipo_visita_id_tipovisita
       JOIN unidad un ON un.id_unidad = v.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       LEFT JOIN residente_perfil rp ON rp.usuario_id_usuario = v.residente_visitado_usuario_id
       WHERE v.condominio_id_condominio = ?
         AND ((va.estado = 'Pendiente' AND va.fecha_solicitud > ?) OR (va.estado <> 'Pendiente' AND va.fecha_respuesta > ?))
       ORDER BY (va.estado = 'Pendiente') DESC, va.fecha_solicitud DESC
       LIMIT 50`
    )
    .all(condominioId, hace12h, hace30m)) as any[];

  return filas.map((f) => {
    const minutos = minutosDesde(f.fecha_solicitud);
    const puedeLlamar = f.estado === "Pendiente" && minutos >= MINUTOS_ESPERA_PARA_LLAMAR;
    return {
      ...f,
      minutos_espera: minutos,
      puede_llamar: puedeLlamar,
      sin_telefono: puedeLlamar && !f.telefono_residente,
      telefono_residente: puedeLlamar ? f.telefono_residente ?? null : null,
    };
  });
}
