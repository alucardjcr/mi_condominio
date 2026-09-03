import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { sincronizarMembresiaPrincipal } from "./auth.service";

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

// Ronda 44, a pedido explícito del usuario (revisión de seguridad — IDOR):
// antes esta función no filtraba por condominio en absoluto — cualquier
// Administrador o JefeGuardias, de cualquier condominio, veía la lista
// COMPLETA de guardias de TODO el sistema (nombre, usuario, vigencia).
// Ahora exige el condominioId de quien pregunta.
export async function listarGuardias(condominioId: number) {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia, gp.rut, gp.telefono
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       LEFT JOIN guardia_perfil gp ON gp.usuario_id_usuario = u.id_usuario
       WHERE tu.gls_tipousuario = 'Guardia' AND u.condominio_id_condominio = ?
       ORDER BY u.nombre_usuario`
    )
    .all(condominioId);
}

async function upsertGuardiaPerfil(usuarioId: number, rut?: string | null, telefono?: string | null) {
  if (rut === undefined && telefono === undefined) return;
  const existente = await db.prepare(`SELECT id_guardiaperfil FROM guardia_perfil WHERE usuario_id_usuario = ?`).get(usuarioId);
  if (existente) {
    const campos: string[] = [];
    const valores: unknown[] = [];
    if (rut !== undefined) {
      campos.push("rut = ?");
      valores.push(rut?.trim() || null);
    }
    if (telefono !== undefined) {
      campos.push("telefono = ?");
      valores.push(telefono?.trim() || null);
    }
    if (campos.length > 0) {
      valores.push(usuarioId);
      await db.prepare(`UPDATE guardia_perfil SET ${campos.join(", ")} WHERE usuario_id_usuario = ?`).run(...valores);
    }
  } else {
    await db
      .prepare(`INSERT INTO guardia_perfil (usuario_id_usuario, rut, telefono) VALUES (?, ?, ?)`)
      .run(usuarioId, rut?.trim() || null, telefono?.trim() || null);
  }
}

export async function crearGuardia(input: {
  nombre_usuario: string;
  usuariocol: string;
  password: string;
  condominio_id_condominio: number;
  rut?: string;
  telefono?: string;
}) {
  const tipoGuardiaId = await getIdByGls("tipo_usuario", "id_tipousuario", "gls_tipousuario", "Guardia");
  const passwordHash = bcrypt.hashSync(input.password, 10);
  const insert = await db
    .prepare(
      `INSERT INTO usuario (nombre_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.nombre_usuario, input.usuariocol, passwordHash, tipoGuardiaId, input.condominio_id_condominio);
  const id = Number(insert.lastInsertRowid);
  // Ronda 26 (fase 2): sin esto, un Guardia recién creado no tendría
  // ninguna membresía y no podría loguearse (ver auth.service.ts -> login).
  await sincronizarMembresiaPrincipal(id);
  if (input.rut || input.telefono) {
    await upsertGuardiaPerfil(id, input.rut, input.telefono);
  }
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia, gp.rut, gp.telefono
       FROM usuario u LEFT JOIN guardia_perfil gp ON gp.usuario_id_usuario = u.id_usuario WHERE u.id_usuario = ?`
    )
    .get(id);
}

export async function actualizarGuardia(id: number, input: { nombre_usuario?: string; password?: string; flg_vigencia?: number; rut?: string | null; telefono?: string | null }) {
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
  await upsertGuardiaPerfil(id, input.rut, input.telefono);
  await sincronizarMembresiaPrincipal(id);
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.flg_vigencia, gp.rut, gp.telefono
       FROM usuario u LEFT JOIN guardia_perfil gp ON gp.usuario_id_usuario = u.id_usuario WHERE u.id_usuario = ?`
    )
    .get(id);
}

// ---------------------------------------------------------------------------
// Residentes
// ---------------------------------------------------------------------------

export async function listarResidentes(unidadId?: number) {
  const base = `SELECT u.id_usuario, u.nombre_usuario, u.unidad_id_unidad, u.flg_vigencia, u.usuariocol, u.flg_comite, u.flg_propietario,
                       un.numero_unidad, tb.nombre_torre,
                       rd.id_residentediscapacitado, rd.numero_carnet,
                       u.tipo_residente_id_tiporesidente, tr.gls_tiporesidente,
                       rp.rut, rp.fecha_nacimiento, rp.profesion
                FROM usuario u
                JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
                JOIN unidad un ON un.id_unidad = u.unidad_id_unidad
                JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
                LEFT JOIN residente_discapacitado rd ON rd.usuario_id_usuario = u.id_usuario AND rd.flg_vigencia = 1
                LEFT JOIN tipo_residente tr ON tr.id_tiporesidente = u.tipo_residente_id_tiporesidente
                LEFT JOIN residente_perfil rp ON rp.usuario_id_usuario = u.id_usuario
                WHERE tu.gls_tipousuario = 'Residente'`;
  if (unidadId) {
    return db.prepare(`${base} AND u.unidad_id_unidad = ? ORDER BY u.nombre_usuario`).all(unidadId);
  }
  return db.prepare(`${base} ORDER BY tb.nombre_torre, un.numero_unidad, u.nombre_usuario`).all();
}

// Ronda 36, a pedido explícito del usuario: datos adicionales opcionales
// del residente (RUT, fecha de nacimiento, profesión) — ver la nota
// completa en schema-mysql.sql sobre por qué es una tabla aparte. Todos
// los campos son independientes entre sí: mandar solo uno no borra los
// otros dos (mismo patrón que actualizarEstacionamientoAdmin con
// patente/flg_arrendado/tipo_ocupante).
export interface PerfilResidenteInput {
  rut?: string | null;
  fecha_nacimiento?: string | null; // 'YYYY-MM-DD'
  profesion?: string | null;
}

async function actualizarPerfilResidente(idUsuario: number, input: PerfilResidenteInput) {
  const tocaAlgo = input.rut !== undefined || input.fecha_nacimiento !== undefined || input.profesion !== undefined;
  if (!tocaAlgo) return;

  const existente = (await db
    .prepare(`SELECT id_residenteperfil, rut, fecha_nacimiento, profesion FROM residente_perfil WHERE usuario_id_usuario = ?`)
    .get(idUsuario)) as { id_residenteperfil: number; rut: string | null; fecha_nacimiento: string | null; profesion: string | null } | undefined;

  const rut = input.rut !== undefined ? input.rut : existente?.rut ?? null;
  const fechaNacimiento = input.fecha_nacimiento !== undefined ? input.fecha_nacimiento : existente?.fecha_nacimiento ?? null;
  const profesion = input.profesion !== undefined ? input.profesion : existente?.profesion ?? null;

  if (existente) {
    await db
      .prepare(`UPDATE residente_perfil SET rut = ?, fecha_nacimiento = ?, profesion = ? WHERE id_residenteperfil = ?`)
      .run(rut, fechaNacimiento, profesion, existente.id_residenteperfil);
  } else {
    await db
      .prepare(`INSERT INTO residente_perfil (usuario_id_usuario, rut, fecha_nacimiento, profesion) VALUES (?, ?, ?, ?)`)
      .run(idUsuario, rut, fechaNacimiento, profesion);
  }
}

export async function crearResidente(input: {
  nombre_usuario: string;
  unidad_id_unidad: number;
  condominio_id_condominio: number;
  tipo_residente_id_tiporesidente?: number;
  flg_propietario?: number;
  rut?: string;
  fecha_nacimiento?: string;
  profesion?: string;
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
  const id = Number(insert.lastInsertRowid);
  // Ronda 26 (fase 2): el residente todavía no puede loguearse (falta
  // usuariocol/password, ver activarAccesoResidente) pero ya le dejamos
  // lista su membresía a este condominio para cuando se active.
  await sincronizarMembresiaPrincipal(id);
  if (input.rut || input.fecha_nacimiento || input.profesion) {
    await actualizarPerfilResidente(id, {
      rut: input.rut ?? null,
      fecha_nacimiento: input.fecha_nacimiento ?? null,
      profesion: input.profesion ?? null,
    });
  }
  return db
    .prepare(
      `SELECT id_usuario, nombre_usuario, unidad_id_unidad, flg_vigencia, tipo_residente_id_tiporesidente, flg_propietario FROM usuario WHERE id_usuario = ?`
    )
    .get(id);
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
    rut?: string | null;
    fecha_nacimiento?: string | null;
    profesion?: string | null;
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
        const otrosDuenos = (await db
          .prepare(`SELECT id_usuario FROM usuario WHERE unidad_id_unidad = ? AND id_usuario != ? AND flg_propietario = 1`)
          .all(fila.unidad_id_unidad, id)) as { id_usuario: number }[];
        await db
          .prepare(`UPDATE usuario SET flg_propietario = 0 WHERE unidad_id_unidad = ? AND id_usuario != ?`)
          .run(fila.unidad_id_unidad, id);
        // A quien se le quitó el flag también hay que sincronizarle la
        // membresía — si no, quedaría con flg_propietario desactualizado
        // ahí (ver sincronizarMembresiaPrincipal más abajo).
        for (const otro of otrosDuenos) {
          await sincronizarMembresiaPrincipal(otro.id_usuario);
        }
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
  await sincronizarMembresiaPrincipal(id);
  await actualizarPerfilResidente(id, {
    rut: input.rut,
    fecha_nacimiento: input.fecha_nacimiento,
    profesion: input.profesion,
  });
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

export async function activarAccesoResidente(id: number, input?: { usuariocol?: string }) {
  const residente = (await db
    .prepare(
      `SELECT u.id_usuario, u.usuariocol, un.numero_unidad, c.gls_condominio
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       JOIN unidad un ON un.id_unidad = u.unidad_id_unidad
       JOIN condominio c ON c.id_condominio = u.condominio_id_condominio
       WHERE u.id_usuario = ? AND tu.gls_tipousuario = 'Residente'`
    )
    .get(id)) as { id_usuario: number; usuariocol: string | null; numero_unidad: string; gls_condominio: string } | undefined;
  if (!residente) throw new Error("No existe ese residente.");

  // Ronda 37, a pedido explícito del usuario: en vez de que el
  // administrador escriba a mano un usuario y clave definitivos, el
  // sistema genera un usuario TEMPORAL — "<siglas del condominio>_
  // residente_<depto>" (ej. "VDV_residente_419" para Valles de Varoli,
  // depto 419) — y una clave aleatoria de un solo uso. La primera vez que
  // el residente entra, la app lo obliga a elegir su usuario definitivo
  // (único) y su propia clave (ver login()/completarOnboardingResidente en
  // auth.service.ts). El administrador puede opcionalmente pasar un
  // usuariocol propio (input?.usuariocol) si por algún motivo no quiere el
  // generado — igual queda sujeto al onboarding obligatorio.
  //
  // Esta MISMA función sirve tanto para "activar por primera vez" como
  // para "restablecer contraseña" (usada así desde AdminResidentesScreen):
  // si el residente YA tenía un usuariocol (elegido por él mismo en un
  // onboarding anterior, o generado antes) y el administrador no mandó uno
  // explícito, se CONSERVA — un restablecimiento de clave no debería
  // forzarlo a aprenderse un usuario nuevo también.
  let usuariocol = input?.usuariocol?.trim();
  if (usuariocol) {
    const enUso = await db.prepare(`SELECT 1 FROM usuario WHERE usuariocol = ? AND id_usuario != ?`).get(usuariocol, id);
    if (enUso) throw new Error(`El usuario "${usuariocol}" ya está en uso.`);
  } else if (residente.usuariocol) {
    usuariocol = residente.usuariocol;
  } else {
    const sigla = generarSiglaCondominio(residente.gls_condominio);
    const base = `${sigla}_residente_${residente.numero_unidad}`;
    usuariocol = base;
    let sufijo = 2;
    while (await db.prepare(`SELECT 1 FROM usuario WHERE usuariocol = ?`).get(usuariocol)) {
      usuariocol = `${base}_${sufijo}`;
      sufijo++;
    }
  }

  const passwordTemporal = generarPasswordTemporal();
  const hash = bcrypt.hashSync(passwordTemporal, 10);
  await db.prepare(`UPDATE usuario SET usuariocol = ?, password_usuario = ? WHERE id_usuario = ?`).run(usuariocol, hash, id);
  await db.prepare(`INSERT IGNORE INTO residente_onboarding_pendiente (usuario_id_usuario) VALUES (?)`).run(id);

  const fila = await db
    .prepare(`SELECT id_usuario, nombre_usuario, unidad_id_unidad, flg_vigencia, usuariocol FROM usuario WHERE id_usuario = ?`)
    .get(id);
  // password_temporal SOLO se devuelve en esta respuesta — no se puede
  // volver a consultar después (se guarda hasheada, como cualquier otra
  // contraseña). El administrador tiene que comunicársela al residente
  // ahora, o generar una nueva más adelante si se pierde.
  return { ...(fila as object), password_temporal: passwordTemporal };
}

// Siglas de un condominio a partir de su nombre — "Valles de Varoli" ->
// "VDV" (primera letra de cada palabra, mayúscula). Se recalcula cada vez
// a partir de condominio.gls_condominio en vez de guardarse aparte — no
// hay ninguna otra parte del sistema que necesite esta sigla, así que no
// vale la pena otra tabla/columna solo para cachearla.
function generarSiglaCondominio(nombreCondominio: string): string {
  const sigla = nombreCondominio
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => palabra[0].toUpperCase())
    .join("");
  return sigla || "COND";
}

// Contraseña temporal aleatoria de 8 caracteres — sin 0/O/1/I (se
// confunden fácil al leerla/tipearla desde un papel o un WhatsApp).
function generarPasswordTemporal(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let resultado = "";
  for (let i = 0; i < 8; i++) {
    resultado += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return resultado;
}

export async function revocarAccesoResidente(id: number) {
  await db.prepare(`UPDATE usuario SET usuariocol = NULL, password_usuario = NULL WHERE id_usuario = ?`).run(id);
  await db.prepare(`DELETE FROM residente_onboarding_pendiente WHERE usuario_id_usuario = ?`).run(id);
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

// ---------------------------------------------------------------------------
// Ronda 28, a pedido explícito del usuario: administrar el estado de CADA
// estacionamiento (Visita, Discapacitado y Residente) — hasta ahora no
// existía ninguna pantalla para esto, solo se sembraban por seed.ts. El
// caso concreto que lo motivó: en Valles de Varoli el cupo de residente 84
// "quedó mal hecho" y no se puede usar — se marca "Fuera de servicio" acá
// y automáticamente deja de ofrecerse (ver estacionamientoVisita.service.ts:
// la asignación automática de cupo al registrar una entrada YA filtraba
// por estado = 'Disponible', así que un cupo Fuera de servicio nunca se
// asigna solo con este cambio, sin tocar esa lógica).
// ---------------------------------------------------------------------------

export async function listarEstacionamientosAdmin(condominioId: number) {
  return db
    .prepare(
      `SELECT e.id_estacionamiento, e.numero_estacionamiento, e.ubicacion,
              te.id_tipoestacionamiento AS tipo_id, te.gls_tipoestacionamiento AS tipo,
              ee.id_estadoestacionamiento AS estado_id, ee.gls_estadoestacionamiento AS estado,
              e.unidad_id_unidad, un.numero_unidad, tb.nombre_torre,
              eo.patente, eo.flg_arrendado, eo.tipo_ocupante
       FROM estacionamiento e
       JOIN tipo_estacionamiento te ON te.id_tipoestacionamiento = e.tipo_estacionamiento_id_tipoestacionamiento
       JOIN estado_estacionamiento ee ON ee.id_estadoestacionamiento = e.estado_estacionamiento_id_estadoestacionamiento
       LEFT JOIN unidad un ON un.id_unidad = e.unidad_id_unidad
       LEFT JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       LEFT JOIN estacionamiento_ocupacion eo ON eo.estacionamiento_id_estacionamiento = e.id_estacionamiento
       WHERE e.condominio_id_condominio = ?
       ORDER BY te.gls_tipoestacionamiento, e.numero_estacionamiento`
    )
    .all(condominioId);
}

export async function listarEstadosEstacionamiento() {
  return db
    .prepare(`SELECT id_estadoestacionamiento, gls_estadoestacionamiento FROM estado_estacionamiento WHERE flg_vigencia = 1 ORDER BY id_estadoestacionamiento`)
    .all();
}

export async function listarTiposEstacionamiento() {
  return db
    .prepare(`SELECT id_tipoestacionamiento, gls_tipoestacionamiento FROM tipo_estacionamiento WHERE flg_vigencia = 1 ORDER BY id_tipoestacionamiento`)
    .all();
}

const ESTADO_DISPONIBLE_ID = 1; // ver seed.ts / schema — coincide con lo sembrado en toda la app.

// Ronda 29, a pedido explícito del usuario: no todos los deptos tienen un
// estacionamiento propio (varios quedaron sin vender) — el comité es quien
// arrienda esos cupos "sueltos" a residentes con más de un auto o
// interesados. Por eso `unidad_id_unidad` es OPCIONAL acá: un cupo tipo
// Residente puede crearse (o quedar) sin depto asignado, listo para que el
// comité lo asigne después — y un mismo depto puede terminar con más de un
// cupo (el propio + uno arrendado), la tabla ya lo permitía (sin UNIQUE en
// unidad_id_unidad), solo faltaba esta pantalla para poder hacerlo desde
// la app en vez de a mano por SQL.
export async function crearEstacionamientoAdmin(
  condominioId: number,
  input: {
    numero_estacionamiento: string;
    ubicacion?: string;
    tipo_estacionamiento_id_tipoestacionamiento: number;
    unidad_id_unidad?: number | null;
  }
) {
  if (!input.numero_estacionamiento?.trim()) {
    throw new Error("Falta el número del estacionamiento.");
  }
  const insert = await db
    .prepare(
      `INSERT INTO estacionamiento
         (numero_estacionamiento, ubicacion, tipo_estacionamiento_id_tipoestacionamiento, estado_estacionamiento_id_estadoestacionamiento, condominio_id_condominio, unidad_id_unidad)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.numero_estacionamiento.trim(),
      input.ubicacion?.trim() || null,
      input.tipo_estacionamiento_id_tipoestacionamiento,
      ESTADO_DISPONIBLE_ID,
      condominioId,
      input.unidad_id_unidad ?? null
    );
  return obtenerEstacionamientoAdmin(Number(insert.lastInsertRowid));
}

async function obtenerEstacionamientoAdmin(id: number) {
  return db
    .prepare(
      `SELECT e.id_estacionamiento, e.numero_estacionamiento, e.ubicacion,
              te.id_tipoestacionamiento AS tipo_id, te.gls_tipoestacionamiento AS tipo,
              ee.id_estadoestacionamiento AS estado_id, ee.gls_estadoestacionamiento AS estado,
              e.unidad_id_unidad, un.numero_unidad, tb.nombre_torre,
              eo.patente, eo.flg_arrendado, eo.tipo_ocupante
       FROM estacionamiento e
       JOIN tipo_estacionamiento te ON te.id_tipoestacionamiento = e.tipo_estacionamiento_id_tipoestacionamiento
       JOIN estado_estacionamiento ee ON ee.id_estadoestacionamiento = e.estado_estacionamiento_id_estadoestacionamiento
       LEFT JOIN unidad un ON un.id_unidad = e.unidad_id_unidad
       LEFT JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       LEFT JOIN estacionamiento_ocupacion eo ON eo.estacionamiento_id_estacionamiento = e.id_estacionamiento
       WHERE e.id_estacionamiento = ?`
    )
    .get(id);
}

// Antes solo cambiaba el estado; ahora también permite asignar/reasignar/
// desasignar el depto (unidad_id_unidad) y — ronda 30, a pedido explícito
// del usuario — el registro formal de ocupación (patente, si está
// arrendado, propietario/arrendatario) que lleva el comité de cada cupo
// de residente. Todos los campos son independientes: se puede mandar solo
// alguno de ellos.
export async function actualizarEstacionamientoAdmin(
  id: number,
  input: {
    estado_id?: number;
    unidad_id_unidad?: number | null;
    patente?: string | null;
    flg_arrendado?: number;
    tipo_ocupante?: string | null;
  }
) {
  const cupo = await db.prepare(`SELECT id_estacionamiento FROM estacionamiento WHERE id_estacionamiento = ?`).get(id);
  if (!cupo) throw new Error(`No existe el estacionamiento ${id}.`);

  if (input.estado_id !== undefined) {
    await db
      .prepare(`UPDATE estacionamiento SET estado_estacionamiento_id_estadoestacionamiento = ? WHERE id_estacionamiento = ?`)
      .run(input.estado_id, id);
  }
  if (input.unidad_id_unidad !== undefined) {
    await db.prepare(`UPDATE estacionamiento SET unidad_id_unidad = ? WHERE id_estacionamiento = ?`).run(input.unidad_id_unidad, id);
  }

  const tocaOcupacion = input.patente !== undefined || input.flg_arrendado !== undefined || input.tipo_ocupante !== undefined;
  if (tocaOcupacion) {
    const existente = (await db
      .prepare(`SELECT id_estacionamientoocupacion, patente, flg_arrendado, tipo_ocupante FROM estacionamiento_ocupacion WHERE estacionamiento_id_estacionamiento = ?`)
      .get(id)) as { id_estacionamientoocupacion: number; patente: string | null; flg_arrendado: number; tipo_ocupante: string | null } | undefined;

    const patente = input.patente !== undefined ? input.patente : existente?.patente ?? null;
    const flgArrendado = input.flg_arrendado !== undefined ? input.flg_arrendado : existente?.flg_arrendado ?? 0;
    const tipoOcupante = input.tipo_ocupante !== undefined ? input.tipo_ocupante : existente?.tipo_ocupante ?? null;

    if (existente) {
      await db
        .prepare(`UPDATE estacionamiento_ocupacion SET patente = ?, flg_arrendado = ?, tipo_ocupante = ? WHERE id_estacionamientoocupacion = ?`)
        .run(patente, flgArrendado, tipoOcupante, existente.id_estacionamientoocupacion);
    } else {
      await db
        .prepare(`INSERT INTO estacionamiento_ocupacion (estacionamiento_id_estacionamiento, patente, flg_arrendado, tipo_ocupante) VALUES (?, ?, ?, ?)`)
        .run(id, patente, flgArrendado, tipoOcupante);
    }
  }

  return obtenerEstacionamientoAdmin(id);
}
