import bcrypt from "bcryptjs";
import { db } from "../db/client";

async function getIdByGls(table: string, idColumn: string, glsColumn: string, valor: string): Promise<number> {
  const row = (await db
    .prepare(`SELECT ${idColumn} as id FROM ${table} WHERE ${glsColumn} = ?`)
    .get(valor)) as { id: number } | undefined;
  if (!row) throw new Error(`No se encontró "${valor}" en ${table}.`);
  return row.id;
}

// ---------------------------------------------------------------------------
// Guardias
// ---------------------------------------------------------------------------

export async function listarGuardias() {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE tu.gls_tipousuario = 'Guardia'
       ORDER BY u.nombre_usuario`
    )
    .all();
}

export async function crearGuardia(input: { nombre_usuario: string; usuariocol: string; password: string; condominio_id_condominio: number }) {
  const tipoGuardiaId = await getIdByGls("tipo_usuario", "id_tipousuario", "gls_tipousuario", "Guardia");
  const passwordHash = bcrypt.hashSync(input.password, 10);
  const insert = await db
    .prepare(
      `INSERT INTO usuario (nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.nombre_usuario, input.usuariocol, passwordHash, tipoGuardiaId, input.condominio_id_condominio);
  return db.prepare(`SELECT id_usuario, nombre_usuario, usuariocol, flg_vigencia FROM usuario WHERE id_usuario = ?`).get(Number(insert.lastInsertRowid));
}

export async function actualizarGuardia(id: number, input: { nombre_usuario?: string; password?: string; flg_vigencia?: number }) {
  if (input.nombre_usuario !== undefined) {
    await db.prepare(`UPDATE usuario SET nombre_usuario = ? WHERE id_usuario = ?`).run(input.nombre_usuario, id);
  }
  if (input.password) {
    const hash = bcrypt.hashSync(input.password, 10);
    await db.prepare(`UPDATE usuario SET password_usuario = ? WHERE id_usuario = ?`).run(hash, id);
  }
  if (input.flg_vigencia !== undefined) {
    await db.prepare(`UPDATE usuario SET flg_vigencia = ? WHERE id_usuario = ?`).run(input.flg_vigencia, id);
  }
  return db.prepare(`SELECT id_usuario, nombre_usuario, usuariocol, flg_vigencia FROM usuario WHERE id_usuario = ?`).get(id);
}

// ---------------------------------------------------------------------------
// Residentes
// ---------------------------------------------------------------------------

export async function listarResidentes(unidadId?: number) {
  const base = `SELECT u.id_usuario, u.nombre_usuario, u.unidad_id_unidad, u.flg_vigencia, u.usuariocol, u.flg_comite, u.flg_propietario,
                       un.numero_unidad, tb.nombre_torre,
                       rd.id_residentediscapacitado, rd.numero_carnet,
                       u.tipo_residente_id_tiporesidente, tr.gls_tiporesidente
                FROM usuario u
                JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
                JOIN unidad un ON un.id_unidad = u.unidad_id_unidad
                JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
                LEFT JOIN residente_discapacitado rd ON rd.usuario_id_usuario = u.id_usuario AND rd.flg_vigencia = 1
                LEFT JOIN tipo_residente tr ON tr.id_tiporesidente = u.tipo_residente_id_tiporesidente
                WHERE tu.gls_tipousuario = 'Residente'`;
  if (unidadId) {
    return db.prepare(`${base} AND u.unidad_id_unidad = ? ORDER BY u.nombre_usuario`).all(unidadId);
  }
  return db.prepare(`${base} ORDER BY tb.nombre_torre, un.numero_unidad, u.nombre_usuario`).all();
}

export async function crearResidente(input: {
  nombre_usuario: string;
  unidad_id_unidad: number;
  condominio_id_condominio: number;
  tipo_residente_id_tiporesidente?: number;
  flg_propietario?: number;
}) {
  const tipoResidenteUsuarioId = await getIdByGls("tipo_usuario", "id_tipousuario", "gls_tipousuario", "Residente");
  // A lo más un dueño por unidad (ronda 15): si se crea directamente como
  // propietario, se le transfiere la condición a quien la tuviera antes en
  // la misma unidad — ver la misma lógica en actualizarResidente.
  if (input.flg_propietario) {
    await db.prepare(`UPDATE usuario SET flg_propietario = 0 WHERE unidad_id_unidad = ?`).run(input.unidad_id_unidad);
  }
  const insert = await db
    .prepare(
      `INSERT INTO usuario (nombre_usuario, tipo_usuario_id_tipousuario, unidad_id_unidad, condominio_id_condominio, tipo_residente_id_tiporesidente, flg_propietario)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.nombre_usuario,
      tipoResidenteUsuarioId,
      input.unidad_id_unidad,
      input.condominio_id_condominio,
      input.tipo_residente_id_tiporesidente ?? null,
      input.flg_propietario ?? 0
    );
  return db
    .prepare(
      `SELECT id_usuario, nombre_usuario, unidad_id_unidad, flg_vigencia, tipo_residente_id_tiporesidente, flg_propietario FROM usuario WHERE id_usuario = ?`
    )
    .get(Number(insert.lastInsertRowid));
}

// ¿Este residente pertenece a esta unidad? Usado por /mi-depto/* para
// verificar que un dueño solo edite residentes de SU PROPIO depto, nunca
// de otro (mismo patrón defensivo que esDueñoDeLaReserva en reservas.ts).
export async function residentePerteneceAUnidad(idResidente: number, unidadId: number): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS ok FROM usuario WHERE id_usuario = ? AND unidad_id_unidad = ?`).get(idResidente, unidadId);
  return !!row;
}

export async function actualizarResidente(
  id: number,
  input: {
    nombre_usuario?: string;
    unidad_id_unidad?: number;
    flg_vigencia?: number;
    password?: string;
    flg_comite?: number;
    tipo_residente_id_tiporesidente?: number | null;
    flg_propietario?: number;
  }
) {
  if (input.nombre_usuario !== undefined) {
    await db.prepare(`UPDATE usuario SET nombre_usuario = ? WHERE id_usuario = ?`).run(input.nombre_usuario, id);
  }
  if (input.unidad_id_unidad !== undefined) {
    await db.prepare(`UPDATE usuario SET unidad_id_unidad = ? WHERE id_usuario = ?`).run(input.unidad_id_unidad, id);
  }
  if (input.flg_vigencia !== undefined) {
    await db.prepare(`UPDATE usuario SET flg_vigencia = ? WHERE id_usuario = ?`).run(input.flg_vigencia, id);
  }
  if (input.flg_comite !== undefined) {
    await db.prepare(`UPDATE usuario SET flg_comite = ? WHERE id_usuario = ?`).run(input.flg_comite, id);
  }
  if (input.tipo_residente_id_tiporesidente !== undefined) {
    await db
      .prepare(`UPDATE usuario SET tipo_residente_id_tiporesidente = ? WHERE id_usuario = ?`)
      .run(input.tipo_residente_id_tiporesidente, id);
  }
  if (input.flg_propietario !== undefined) {
    // A lo más un dueño por unidad (ronda 15): al asignar el flag a
    // alguien, se lo quitamos automáticamente a cualquier otro usuario de
    // la misma unidad que lo tuviera antes — cubre el caso de venta/
    // transferencia de propiedad sin un paso manual aparte.
    if (input.flg_propietario) {
      const fila = (await db.prepare(`SELECT unidad_id_unidad FROM usuario WHERE id_usuario = ?`).get(id)) as
        | { unidad_id_unidad: number | null }
        | undefined;
      if (fila?.unidad_id_unidad) {
        await db
          .prepare(`UPDATE usuario SET flg_propietario = 0 WHERE unidad_id_unidad = ? AND id_usuario != ?`)
          .run(fila.unidad_id_unidad, id);
      }
    }
    await db.prepare(`UPDATE usuario SET flg_propietario = ? WHERE id_usuario = ?`).run(input.flg_propietario, id);
  }
  // Restablecer la contraseña de un residente que YA tiene acceso activado
  // (usuariocol asignado). Para activar el acceso por primera vez se usa
  // activarAccesoResidente, que también fija el usuariocol.
  if (input.password) {
    const residente = (await db.prepare(`SELECT usuariocol FROM usuario WHERE id_usuario = ?`).get(id)) as
      | { usuariocol: string | null }
      | undefined;
    if (!residente?.usuariocol) {
      throw new Error("Este residente todavía no tiene acceso activado; usa 'Activar acceso' primero.");
    }
    const hash = bcrypt.hashSync(input.password, 10);
    await db.prepare(`UPDATE usuario SET password_usuario = ? WHERE id_usuario = ?`).run(hash, id);
  }
  return db
    .prepare(
      `SELECT id_usuario, nombre_usuario, unidad_id_unidad, flg_vigencia, usuariocol, flg_comite, tipo_residente_id_tiporesidente, flg_propietario FROM usuario WHERE id_usuario = ?`
    )
    .get(id);
}

// ---------------------------------------------------------------------------
// Acceso a la app para residentes (login/portal de residentes).
//
// Los residentes se precargan sin login (ver crearResidente) porque hoy se
// usan solo como referencia para "a quién visita"/"a quién viene dirigido"
// en estacionamientos y paquetería. Activar el acceso les asigna
// usuariocol + contraseña para que puedan entrar a la app con el mismo
// endpoint /auth/login que ya usan guardias y administrador.
// ---------------------------------------------------------------------------

export async function activarAccesoResidente(id: number, input: { usuariocol: string; password: string }) {
  const residente = await db
    .prepare(
      `SELECT u.id_usuario FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE u.id_usuario = ? AND tu.gls_tipousuario = 'Residente'`
    )
    .get(id);
  if (!residente) throw new Error("No existe ese residente.");

  const usuariocol = input.usuariocol.trim();
  if (!usuariocol || !input.password) {
    throw new Error("Faltan campos: usuariocol, password.");
  }

  const hash = bcrypt.hashSync(input.password, 10);
  await db.prepare(`UPDATE usuario SET usuariocol = ?, password_usuario = ? WHERE id_usuario = ?`).run(usuariocol, hash, id);
  return db
    .prepare(`SELECT id_usuario, nombre_usuario, unidad_id_unidad, flg_vigencia, usuariocol FROM usuario WHERE id_usuario = ?`)
    .get(id);
}

export async function revocarAccesoResidente(id: number) {
  await db.prepare(`UPDATE usuario SET usuariocol = NULL, password_usuario = NULL WHERE id_usuario = ?`).run(id);
}

export async function registrarCarnetDiscapacidad(usuarioId: number, numeroCarnet: string | undefined) {
  const existente = (await db
    .prepare(`SELECT id_residentediscapacitado FROM residente_discapacitado WHERE usuario_id_usuario = ?`)
    .get(usuarioId)) as { id_residentediscapacitado: number } | undefined;

  if (existente) {
    await db.prepare(
      `UPDATE residente_discapacitado SET numero_carnet = ?, flg_vigencia = 1 WHERE id_residentediscapacitado = ?`
    ).run(numeroCarnet ?? null, existente.id_residentediscapacitado);
    return existente.id_residentediscapacitado;
  }

  const insert = await db
    .prepare(`INSERT INTO residente_discapacitado (usuario_id_usuario, numero_carnet) VALUES (?, ?)`)
    .run(usuarioId, numeroCarnet ?? null);
  return Number(insert.lastInsertRowid);
}

export async function quitarCarnetDiscapacidad(usuarioId: number) {
  await db.prepare(`UPDATE residente_discapacitado SET flg_vigencia = 0 WHERE usuario_id_usuario = ?`).run(usuarioId);
}

// ---------------------------------------------------------------------------
// Patentes de residentes
// ---------------------------------------------------------------------------

export async function listarPatentes(unidadId?: number) {
  const base = `SELECT p.id_patente, p.patente, p.flg_vigencia,
                       tt.gls_tipotenencia, p.unidad_id_unidad, un.numero_unidad, tb.nombre_torre
                FROM patente_condominio p
                JOIN tipo_tenencia_patente tt ON tt.id_tipotenencia = p.tipo_tenencia_id_tipotenencia
                JOIN unidad un ON un.id_unidad = p.unidad_id_unidad
                JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock`;
  if (unidadId) {
    return db.prepare(`${base} WHERE p.unidad_id_unidad = ? ORDER BY p.patente`).all(unidadId);
  }
  return db.prepare(`${base} ORDER BY tb.nombre_torre, un.numero_unidad, p.patente`).all();
}

export async function crearPatente(input: {
  patente: string;
  tipo_tenencia_id_tipotenencia: number;
  unidad_id_unidad: number;
  condominio_id_condominio: number;
}) {
  const insert = await db
    .prepare(
      `INSERT INTO patente_condominio (patente, tipo_tenencia_id_tipotenencia, unidad_id_unidad, condominio_id_condominio)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      input.patente.trim().toUpperCase(),
      input.tipo_tenencia_id_tipotenencia,
      input.unidad_id_unidad,
      input.condominio_id_condominio
    );
  return db.prepare(`SELECT id_patente, patente FROM patente_condominio WHERE id_patente = ?`).get(Number(insert.lastInsertRowid));
}

export async function actualizarPatente(id: number, input: { patente?: string; tipo_tenencia_id_tipotenencia?: number; flg_vigencia?: number }) {
  if (input.patente !== undefined) {
    await db.prepare(`UPDATE patente_condominio SET patente = ? WHERE id_patente = ?`).run(input.patente.trim().toUpperCase(), id);
  }
  if (input.tipo_tenencia_id_tipotenencia !== undefined) {
    await db.prepare(`UPDATE patente_condominio SET tipo_tenencia_id_tipotenencia = ? WHERE id_patente = ?`).run(input.tipo_tenencia_id_tipotenencia, id);
  }
  if (input.flg_vigencia !== undefined) {
    await db.prepare(`UPDATE patente_condominio SET flg_vigencia = ? WHERE id_patente = ?`).run(input.flg_vigencia, id);
  }
  return db.prepare(`SELECT id_patente, patente, flg_vigencia FROM patente_condominio WHERE id_patente = ?`).get(id);
}

// ---------------------------------------------------------------------------
// Auditoría: historial de una patente (visitas + qué guardia la registró)
// ---------------------------------------------------------------------------

export async function auditarPatente(patente: string) {
  const normalizada = patente.trim().toUpperCase();
  return db
    .prepare(
      `SELECT
         v.id_visita, v.fecha_entrada, v.hora_entrada, v.fecha_salida, v.hora_salida,
         v.nombre_visita, v.tipo_ocupante,
         tb.nombre_torre, un.numero_unidad,
         tp.gls_tipopermiso,
         e.numero_estacionamiento,
         g.nombre_usuario as nombre_guardia_creador, g.usuariocol as usuariocol_guardia_creador
       FROM visita v
       JOIN unidad un ON un.id_unidad = v.unidad_id_unidad
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       JOIN tipo_permiso_visita tp ON tp.id_tipopermiso = v.tipo_permiso_id_tipopermiso
       LEFT JOIN estacionamiento e ON e.id_estacionamiento = v.estacionamiento_id_estacionamiento
       JOIN usuario g ON g.id_usuario = v.usuario_id_usuario_creador
       WHERE UPPER(v.patente) = ?
       ORDER BY v.fecha_entrada DESC`
    )
    .all(normalizada);
}

// ---------------------------------------------------------------------------
// Gasto común por depto (ronda 17)
// ---------------------------------------------------------------------------
//
// `unidad.flg_gastocomun` ya existía desde la ronda 14 (Reservas de Espacios
// Comunes) y ya bloqueaba a un residente con deuda de reservar un espacio
// reservable (ver crearReserva en reservas.service.ts) — pero no existía
// ninguna forma de que el administrador/comité lo marcara desde la app, solo
// a mano por SQL. El usuario pidió en la ronda 17 poder "saber qué deptos
// están al día o no" desde la app: esta sección agrega esa superficie de
// administración, sin tocar la regla de negocio que ya funcionaba.

export async function listarUnidadesGastoComun(condominioId: number) {
  return db
    .prepare(
      `SELECT un.id_unidad, un.numero_unidad, un.flg_gastocomun, tb.nombre_torre
       FROM unidad un
       JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE un.condominio_id_condominio = ? AND un.flg_vigencia = 1
       ORDER BY tb.nombre_torre, un.numero_unidad`
    )
    .all(condominioId);
}

export async function actualizarGastoComunUnidad(unidadId: number, flgGastocomun: number) {
  const unidad = await db.prepare(`SELECT id_unidad FROM unidad WHERE id_unidad = ?`).get(unidadId);
  if (!unidad) throw new Error(`No existe la unidad ${unidadId}.`);
  await db.prepare(`UPDATE unidad SET flg_gastocomun = ? WHERE id_unidad = ?`).run(flgGastocomun ? 1 : 0, unidadId);
  return db
    .prepare(`SELECT id_unidad, numero_unidad, flg_gastocomun FROM unidad WHERE id_unidad = ?`)
    .get(unidadId);
}
