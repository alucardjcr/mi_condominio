import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { sincronizarMembresiaPrincipal } from "./auth.service";

// Ronda 27, a pedido explícito del usuario: "solo yo podré crear el rol de
// administrador". Estas funciones solo las expone routes/super-admin.ts,
// montado con requireSuperAdmin (rol === 'SuperAdmin' estricto, sin la
// equivalencia de comité que tiene requireAdmin) — ver middleware/auth.ts.

export async function listarCondominiosParaSuperAdmin() {
  return db
    .prepare(`SELECT id_condominio, gls_condominio AS nombre FROM condominio WHERE flg_vigencia = 1 ORDER BY gls_condominio`)
    .all();
}

/**
 * Crea una cuenta nueva con rol Administrador. `condominio_id_condominio`
 * es OPCIONAL desde la ronda 66, a pedido explícito del usuario: un
 * Administrador puede empezar sin ningún condominio todavía, y crear el
 * suyo propio la primera vez que entra (ver auth.service.ts ->
 * resolverSesionParaUsuario, caso "Administrador sin membresías" — lo
 * manda a un flujo especial de creación inicial, en vez del error de
 * "no tienes ningún condominio asignado" que se tira para cualquier otro
 * rol en esa misma situación).
 *
 * Ronda 67, a pedido explícito del usuario: además de nombre/usuario/
 * contraseña, ahora pide el perfil completo del Administrador — foto,
 * RUT, nombre completo, fecha de nacimiento, N° de registro RNAC
 * (Registro Nacional de Administradores de Condominios, opcional),
 * correo electrónico y teléfono. Todos obligatorios salvo el número de
 * registro. El correo va al `usuario.correo_usuario` que ya existía
 * desde el principio del proyecto (no se duplicó); el resto va a la
 * tabla nueva `administrador_perfil`.
 */
export async function crearAdministrador(input: {
  nombre_usuario: string;
  usuariocol: string;
  password: string;
  condominio_id_condominio?: number;
  foto_url?: string;
  rut: string;
  fecha_nacimiento: string;
  numero_registro_rnac?: string;
  correo: string;
  telefono: string;
}) {
  if (!input.rut?.trim()) throw new Error("Falta el RUT del administrador.");
  if (!input.fecha_nacimiento?.trim()) throw new Error("Falta la fecha de nacimiento del administrador.");
  if (!input.correo?.trim()) throw new Error("Falta el correo electrónico del administrador.");
  if (!input.telefono?.trim()) throw new Error("Falta el teléfono del administrador.");

  const tipoAdminId = (await db
    .prepare(`SELECT id_tipousuario FROM tipo_usuario WHERE gls_tipousuario = 'Administrador'`)
    .get()) as { id_tipousuario: number } | undefined;
  if (!tipoAdminId) throw new Error('No se encontró el tipo de usuario "Administrador".');

  let condominioId: number | null = null;
  if (input.condominio_id_condominio) {
    const condominio = await db
      .prepare(`SELECT id_condominio FROM condominio WHERE id_condominio = ? AND flg_vigencia = 1`)
      .get(input.condominio_id_condominio);
    if (!condominio) throw new Error("Ese condominio no existe.");
    condominioId = input.condominio_id_condominio;
  }

  const passwordHash = bcrypt.hashSync(input.password, 10);
  const insert = await db
    .prepare(
      `INSERT INTO usuario (nombre_usuario, correo_usuario, usuariocol, password_usuario, tipo_usuario_id_tipousuario, condominio_id_condominio)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(input.nombre_usuario, input.correo.trim(), input.usuariocol, passwordHash, tipoAdminId.id_tipousuario, condominioId);
  const id = Number(insert.lastInsertRowid);

  await db
    .prepare(
      `INSERT INTO administrador_perfil (usuario_id_usuario, foto_url, rut, fecha_nacimiento, numero_registro_rnac, telefono)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, input.foto_url || null, input.rut.trim(), input.fecha_nacimiento.trim(), input.numero_registro_rnac?.trim() || null, input.telefono.trim());

  // Si tiene condominio asignado, esto le arma la membresía correspondiente
  // (sin esto no podría loguearse). Si NO tiene condominio, no hace nada
  // — entrará por el flujo de "crear mi primer condominio" en su lugar.
  if (condominioId) {
    await sincronizarMembresiaPrincipal(id);
  }
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.correo_usuario, u.flg_vigencia,
              ap.foto_url, ap.rut, ap.fecha_nacimiento, ap.numero_registro_rnac, ap.telefono
       FROM usuario u
       LEFT JOIN administrador_perfil ap ON ap.usuario_id_usuario = u.id_usuario
       WHERE u.id_usuario = ?`
    )
    .get(id);
}

export async function listarAdministradores() {
  return db
    .prepare(
      // Ronda 67: LEFT JOIN a condominio (antes era JOIN normal, y por
      // error hacía desaparecer de la lista a cualquier Administrador
      // que todavía no tuviera ningún condominio asignado — un caso que
      // ahora es válido desde la ronda 66). Se agregan los campos de
      // administrador_perfil.
      `SELECT u.id_usuario, u.nombre_usuario, u.usuariocol, u.correo_usuario, u.flg_vigencia, c.gls_condominio AS condominio_home,
              ap.foto_url, ap.rut, ap.fecha_nacimiento, ap.numero_registro_rnac, ap.telefono
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       LEFT JOIN condominio c ON c.id_condominio = u.condominio_id_condominio
       LEFT JOIN administrador_perfil ap ON ap.usuario_id_usuario = u.id_usuario
       WHERE tu.gls_tipousuario = 'Administrador'
       ORDER BY u.nombre_usuario`
    )
    .all();
}

export async function actualizarAdministrador(id: number, input: { password?: string; flg_vigencia?: number }) {
  if (input.password) {
    const hash = bcrypt.hashSync(input.password, 10);
    await db.prepare(`UPDATE usuario SET password_usuario = ? WHERE id_usuario = ?`).run(hash, id);
  }
  if (input.flg_vigencia !== undefined) {
    await db.prepare(`UPDATE usuario SET flg_vigencia = ? WHERE id_usuario = ?`).run(input.flg_vigencia, id);
    await sincronizarMembresiaPrincipal(id);
  }
  return db
    .prepare(`SELECT id_usuario, nombre_usuario, usuariocol, flg_vigencia FROM usuario WHERE id_usuario = ?`)
    .get(id);
}

export {
  listarCondominiosConFacturacion,
  configurarFacturacion,
  marcarPagado,
} from "./facturacion.service";
