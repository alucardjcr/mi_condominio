import { db } from "../db/client";

// ---------------------------------------------------------------------------
// Ronda 68, a pedido explícito del usuario: JefeAseo y JefeJardineria
// funcionan igual que JefeGuardias con sus guardias, pero con horarios
// SEMANALES RECURRENTES simples en vez del patrón rotativo día/noche con
// fechas específicas que tienen los guardias — porque cada trabajador de
// aseo o jardinería puede tener una necesidad totalmente distinta (ej.
// aseo: lunes a sábado 4 horas; jardinero: 2 veces por semana, 5 horas
// cada vez) y cada Jefe de área define eso a su criterio, sin un patrón
// fijo impuesto por el sistema.
//
// Un solo servicio compartido por los 2 roles: el "equipo" de un Jefe es,
// simplemente, todo el Personal cuyo usuario.jefe_id_usuario apunta a
// este Jefe — el Administrador es quien hizo esa asignación al crear o
// editar a cada trabajador (ver personal.service.ts).
// ---------------------------------------------------------------------------

export async function listarMiEquipo(jefeId: number) {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia,
              u.tipo_personal_id_tipopersonal, tp.gls_tipopersonal,
              EXISTS(SELECT 1 FROM turno_personal t WHERE t.usuario_id_usuario = u.id_usuario AND t.fecha_termino IS NULL) as turno_abierto,
              (SELECT COUNT(*) FROM horario_personal hp WHERE hp.usuario_id_usuario = u.id_usuario) as dias_con_horario
       FROM usuario u
       LEFT JOIN tipo_personal tp ON tp.id_tipopersonal = u.tipo_personal_id_tipopersonal
       WHERE u.jefe_id_usuario = ?
       ORDER BY u.nombre_usuario`
    )
    .all(jefeId);
}

// Confirma que este trabajador realmente reporte a este Jefe — evita que
// un Jefe vea u opere el horario de un trabajador de otro equipo (mismo
// criterio IDOR de siempre en este proyecto).
async function validarPerteneceAMiEquipo(usuarioId: number, jefeId: number) {
  const pertenece = await db.prepare(`SELECT id_usuario FROM usuario WHERE id_usuario = ? AND jefe_id_usuario = ?`).get(usuarioId, jefeId);
  if (!pertenece) {
    throw new Error("Ese trabajador no pertenece a tu equipo.");
  }
}

export async function listarHorarioDe(usuarioId: number, jefeId: number) {
  await validarPerteneceAMiEquipo(usuarioId, jefeId);
  return db
    .prepare(`SELECT id_horariopersonal, dia_semana, hora_inicio, hora_termino FROM horario_personal WHERE usuario_id_usuario = ? ORDER BY dia_semana, hora_inicio`)
    .all(usuarioId);
}

// Reemplaza TODO el horario semanal de un trabajador de una sola vez (más
// simple para el Jefe que ir agregando/borrando de a un día — manda la
// semana completa como la quiere dejar, y acá se sincroniza).
export async function definirHorarioSemanal(
  usuarioId: number,
  jefeId: number,
  condominioId: number,
  dias: { dia_semana: number; hora_inicio: string; hora_termino: string }[]
) {
  await validarPerteneceAMiEquipo(usuarioId, jefeId);
  for (const d of dias) {
    if (d.dia_semana < 1 || d.dia_semana > 7) {
      throw new Error("Día de la semana inválido (debe ser 1=Lunes a 7=Domingo).");
    }
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(d.hora_inicio) || !/^\d{2}:\d{2}(:\d{2})?$/.test(d.hora_termino)) {
      throw new Error("Formato de hora inválido (usa HH:MM).");
    }
  }
  await db.prepare(`DELETE FROM horario_personal WHERE usuario_id_usuario = ?`).run(usuarioId);
  for (const d of dias) {
    await db
      .prepare(`INSERT INTO horario_personal (usuario_id_usuario, dia_semana, hora_inicio, hora_termino, condominio_id_condominio) VALUES (?, ?, ?, ?, ?)`)
      .run(usuarioId, d.dia_semana, d.hora_inicio, d.hora_termino, condominioId);
  }
  return listarHorarioDe(usuarioId, jefeId);
}
