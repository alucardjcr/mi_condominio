import { db } from "../db/client";
import { GuardiaAutenticado } from "./auth.service";

// Ronda 32, a pedido explícito del usuario: derechos ARCO de la Ley 21.719
// de Protección de Datos Personales (Chile, vigente desde el 1 de
// diciembre de 2026).
//
// - Acceso y Portabilidad (obtenerMisDatos): autoservicio instantáneo, de
//   solo lectura — cualquier usuario logeado puede ver/descargar TODO lo
//   que el sistema tiene sobre él mismo, sin pedirle permiso a nadie.
// - Rectificación, Cancelación y Oposición: quedan como una SOLICITUD
//   formal (tabla solicitud_arco) que revisa Administrador/Comité — no se
//   pueden resolver solas porque implican borrar/cambiar datos que pueden
//   ser necesarios para la operación del condominio (ej. historial de
//   pagos, bitácora de seguridad), así que requieren criterio humano. Esta
//   tabla es, además, la evidencia operativa que la ley exige poder
//   mostrarle a la Agencia ante una fiscalización.

/**
 * Todo lo que el sistema sabe sobre este usuario, en un solo objeto —
 * pensado para mostrarlo en pantalla ("Ver mis datos") y para exportarlo
 * tal cual como JSON descargable ("Descargar mis datos", derecho de
 * portabilidad). No incluye la contraseña (hasheada) ni tokens de sesión.
 */
export async function obtenerMisDatos(guardia: GuardiaAutenticado) {
  const idUsuario = guardia.id_usuario;

  const identidadRow = (await db
    .prepare(
      `SELECT nombre_usuario, usuariocol, correo_usuario FROM usuario WHERE id_usuario = ?`
    )
    .get(idUsuario)) as { nombre_usuario: string; usuariocol: string | null; correo_usuario: string | null } | undefined;

  const identidad = {
    nombre_usuario: identidadRow?.nombre_usuario ?? guardia.nombre_usuario,
    usuariocol: identidadRow?.usuariocol ?? null,
    correo_usuario: identidadRow?.correo_usuario ?? null,
    rol: guardia.rol,
    condominio_id_condominio: guardia.condominio_id_condominio ?? null,
  };

  // Solo tiene sentido para roles con depto (Residente, incluido comité).
  const vivienda = guardia.unidad_id_unidad
    ? {
        torre: guardia.nombre_torre ?? null,
        numero_unidad: guardia.numero_unidad ?? null,
        es_comite: !!guardia.esComite,
        es_propietario: !!guardia.esPropietario,
      }
    : null;

  const unidadId = guardia.unidad_id_unidad;

  const mascotas = unidadId
    ? await db
        .prepare(
          `SELECT nombre, especie, raza, numero_chip FROM mascota WHERE unidad_id_unidad = ? AND flg_vigencia = 1`
        )
        .all(unidadId)
    : [];

  const patentes = unidadId
    ? await db
        .prepare(
          `SELECT p.patente, tt.gls_tipotenencia
           FROM patente_condominio p
           JOIN tipo_tenencia_patente tt ON tt.id_tipotenencia = p.tipo_tenencia_id_tipotenencia
           WHERE p.unidad_id_unidad = ? AND p.flg_vigencia = 1`
        )
        .all(unidadId)
    : [];

  const reservas = await db
    .prepare(
      `SELECT r.fecha_reserva, r.hora_inicio, r.hora_termino, ec.nombre AS gls_espaciocomun, er.gls_estadoreserva
       FROM reserva_espaciocomun r
       JOIN espacio_comun ec ON ec.id_espaciocomun = r.espacio_comun_id_espaciocomun
       JOIN estado_reserespaciocomun er ON er.id_estadoreserva = r.estado_reserespaciocomun_id_estadoreserva
       WHERE r.solicitante_usuario_id = ?
       ORDER BY r.fecha_reserva DESC
       LIMIT 100`
    )
    .all(idUsuario);

  const paquetes = unidadId
    ? await db
        .prepare(
          `SELECT p.fecha_recepcion, p.nombre_receptor, tp.gls_tipopaquete, ep.gls_estadopaquete
           FROM paquete p
           JOIN tipo_paquete tp ON tp.id_tipopaquete = p.tipo_paquete_id_tipopaquete
           JOIN estado_paquete ep ON ep.id_estadopaquete = p.estado_paquete_id_estadopaquete
           WHERE p.unidad_id_unidad = ?
           ORDER BY p.id_paquete DESC
           LIMIT 100`
        )
        .all(unidadId)
    : [];

  return {
    generado_el: new Date().toISOString(),
    identidad,
    vivienda,
    mascotas,
    patentes,
    reservas,
    paquetes,
  };
}

// --- Solicitudes formales (Rectificación / Cancelación / Oposición) -------

const TIPOS_VALIDOS = ["Rectificacion", "Cancelacion", "Oposicion"] as const;
export type TipoSolicitudArco = (typeof TIPOS_VALIDOS)[number];

export async function crearSolicitudArco(
  guardia: GuardiaAutenticado,
  input: { tipo: TipoSolicitudArco; detalle: string }
) {
  if (!TIPOS_VALIDOS.includes(input.tipo)) {
    throw new Error("Tipo de solicitud inválido.");
  }
  if (!input.detalle?.trim()) {
    throw new Error("Describe qué dato quieres corregir, eliminar, o a qué te opones.");
  }
  if (!guardia.condominio_id_condominio) {
    throw new Error("Tu sesión no tiene un condominio asociado.");
  }
  const insert = await db
    .prepare(
      `INSERT INTO solicitud_arco (usuario_id_usuario, condominio_id_condominio, tipo, detalle) VALUES (?, ?, ?, ?)`
    )
    .run(guardia.id_usuario, guardia.condominio_id_condominio, input.tipo, input.detalle.trim());
  return obtenerSolicitudArco(Number(insert.lastInsertRowid));
}

async function obtenerSolicitudArco(id: number) {
  return db
    .prepare(
      `SELECT s.id_solicitudarco, s.tipo, s.detalle, s.estado, s.respuesta_admin,
              s.fecha_solicitud, s.fecha_resolucion,
              u.nombre_usuario AS nombre_solicitante
       FROM solicitud_arco s
       JOIN usuario u ON u.id_usuario = s.usuario_id_usuario
       WHERE s.id_solicitudarco = ?`
    )
    .get(id);
}

/** Mis propias solicitudes (para que el residente vea el estado de las que hizo). */
export async function listarMisSolicitudesArco(idUsuario: number) {
  return db
    .prepare(
      `SELECT id_solicitudarco, tipo, detalle, estado, respuesta_admin, fecha_solicitud, fecha_resolucion
       FROM solicitud_arco
       WHERE usuario_id_usuario = ?
       ORDER BY fecha_solicitud DESC`
    )
    .all(idUsuario);
}

/** Todas las del condominio (para el panel de Administrador/Comité). */
export async function listarSolicitudesArcoAdmin(condominioId: number) {
  return db
    .prepare(
      `SELECT s.id_solicitudarco, s.tipo, s.detalle, s.estado, s.respuesta_admin,
              s.fecha_solicitud, s.fecha_resolucion,
              u.nombre_usuario AS nombre_solicitante, u.usuariocol AS usuariocol_solicitante,
              un.numero_unidad, tb.nombre_torre
       FROM solicitud_arco s
       JOIN usuario u ON u.id_usuario = s.usuario_id_usuario
       LEFT JOIN unidad un ON un.id_unidad = u.unidad_id_unidad
       LEFT JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE s.condominio_id_condominio = ?
       ORDER BY (s.estado = 'Pendiente') DESC, s.fecha_solicitud DESC`
    )
    .all(condominioId);
}

export async function resolverSolicitudArco(
  id: number,
  input: { estado: "Resuelta" | "Rechazada"; respuesta_admin: string; resueltoPorUsuarioId: number }
) {
  if (input.estado !== "Resuelta" && input.estado !== "Rechazada") {
    throw new Error("Estado inválido — debe ser 'Resuelta' o 'Rechazada'.");
  }
  if (!input.respuesta_admin?.trim()) {
    throw new Error("Explica cómo se resolvió (o por qué se rechazó) la solicitud.");
  }
  const existente = await db.prepare(`SELECT id_solicitudarco FROM solicitud_arco WHERE id_solicitudarco = ?`).get(id);
  if (!existente) throw new Error(`No existe la solicitud ${id}.`);

  await db
    .prepare(
      `UPDATE solicitud_arco SET estado = ?, respuesta_admin = ?, fecha_resolucion = NOW(), resuelto_por_usuario_id = ? WHERE id_solicitudarco = ?`
    )
    .run(input.estado, input.respuesta_admin.trim(), input.resueltoPorUsuarioId, id);
  return obtenerSolicitudArco(id);
}
