import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { verificarTurnoParaLogin } from "./turnos.service";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-cambiar-en-produccion";

// Duración del token, distinta por rol (ronda 17). Guardia mantiene 12h
// ("dura un turno de guardia" — además suele ser un dispositivo compartido
// del condominio, no conviene dejarlo logeado por semanas). Residente y
// Administrador ahora usan su propio teléfono y la app persiste la sesión
// (expo-secure-store) para no tener que loguearse cada vez que se cierra —
// un token de solo 12h haría inútil esa persistencia, así que se extendió a
// 30 días para esos dos roles. Personal (ronda 18: personal externo — aseo,
// jardinería, mantención) también cae en la rama de 30 días: es su propio
// teléfono, igual que Residente/Administrador, no un dispositivo compartido
// de portería como el de Guardia. JefeGuardias (ronda 20) también: es su
// propio teléfono, no un dispositivo compartido de portería.
function expiresInPorRol(rol: string): "12h" | "30d" {
  return rol === "Guardia" ? "12h" : "30d";
}

// El nombre "GuardiaAutenticado" quedó de cuando solo Guardia/Administrador
// tenían login; ahora con el portal de residentes cualquier rol puede venir
// acá (Guardia, Administrador o Residente) — se mantiene el nombre para no
// tocar todos los archivos que ya usan req.guardia, pero represta a
// "cualquier usuario autenticado".
export interface GuardiaAutenticado {
  id_usuario: number;
  nombre_usuario: string;
  rol: string; // 'Guardia' | 'Administrador' | 'Residente' | 'Personal' (ronda 18) | 'JefeGuardias' (ronda 20)
  // Ronda 26: condominio con el que está trabajando esta sesión.
  // - Para Guardia/Residente/Personal/JefeGuardias: siempre su único
  //   condominio (usuario.condominio_id_condominio) — sin cambios de
  //   comportamiento, se agrega solo para dejar la base lista para cuando
  //   esos roles también tengan multi-condominio (fase futura).
  // - Para Administrador: el condominio que ELIGIÓ en el selector
  //   post-login (ver seleccionarCondominio más abajo) — puede ser
  //   distinto entre dos sesiones del mismo admin si administra más de
  //   uno. Ausente únicamente en el token "intermedio" que se entrega
  //   cuando un admin con más de un condominio todavía no elige (ver
  //   login() -> requiereSeleccionCondominio).
  condominio_id_condominio?: number;
  // Solo presente cuando rol = 'Residente': su depto, para poder acotar
  // server-side qué puede ver (sus propios paquetes/reservas, nunca los de
  // otro depto) sin depender de lo que mande el cliente.
  unidad_id_unidad?: number;
  numero_unidad?: string;
  nombre_torre?: string;
  // Solo puede venir en true cuando rol = 'Residente': es además miembro
  // del comité de administración, con los mismos permisos que un
  // Administrador en todo el sistema (ver requireAdmin/requireRol en
  // middleware/auth.ts). Sigue siendo Residente — conserva su depto.
  esComite?: boolean;
  // Solo puede venir en true cuando rol = 'Residente' (ronda 15): es el
  // dueño registrado de unidad_id_unidad, viva ahí o no (puede tenerlo
  // arrendado). Da derecho a administrar el listado de residentes de esa
  // unidad desde /mi-depto/* — ver middleware/auth.ts y routes/mi-depto.ts.
  esPropietario?: boolean;
}

// Ronda 26: forma de firmar el token una vez que ya se sabe con qué
// condominio va a trabajar la sesión (para Administrador, el que eligió;
// para los demás roles, siempre el mismo — ver GuardiaAutenticado). Se
// extrajo de login() para reutilizarla también en seleccionarCondominio().
async function emitirTokenFinal(payload: GuardiaAutenticado) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInPorRol(payload.rol) });
  const condominioNombre = payload.condominio_id_condominio
    ? await nombreDeCondominio(payload.condominio_id_condominio)
    : undefined;
  return { token, guardia: payload, rol: payload.rol, condominio_nombre: condominioNombre };
}

async function nombreDeCondominio(condominioId: number): Promise<string | undefined> {
  const row = (await db
    .prepare(`SELECT gls_condominio FROM condominio WHERE id_condominio = ?`)
    .get(condominioId)) as { gls_condominio: string } | undefined;
  return row?.gls_condominio;
}

export async function login(usuariocol: string, password: string) {
  const usuario = (await db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.password_usuario, tu.gls_tipousuario,
              u.unidad_id_unidad, un.numero_unidad, tb.nombre_torre, u.flg_comite, u.flg_propietario,
              u.condominio_id_condominio
       FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       LEFT JOIN unidad un ON un.id_unidad = u.unidad_id_unidad
       LEFT JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE u.usuariocol = ? AND u.flg_vigencia = 1`
    )
    .get(usuariocol)) as
    | {
        id_usuario: number;
        nombre_usuario: string;
        password_usuario: string | null;
        gls_tipousuario: string;
        unidad_id_unidad: number | null;
        numero_unidad: string | null;
        nombre_torre: string | null;
        flg_comite: number;
        flg_propietario: number;
        condominio_id_condominio: number;
      }
    | undefined;

  if (!usuario || !usuario.password_usuario) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  const passwordOk = bcrypt.compareSync(password, usuario.password_usuario);
  if (!passwordOk) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  // Ronda 20: JEFE_GUARDIAS gestiona un calendario semanal de turnos que,
  // a pedido explícito del usuario, restringe cuándo puede loguearse un
  // Guardia (ver verificarTurnoParaLogin — nunca aplica a otros roles).
  if (usuario.gls_tipousuario === "Guardia") {
    const { permitido, motivo } = await verificarTurnoParaLogin(usuario.id_usuario, usuario.condominio_id_condominio);
    if (!permitido) {
      throw new Error(motivo || "No puedes iniciar sesión fuera de tu turno asignado.");
    }
  }

  const payloadBase: GuardiaAutenticado = {
    id_usuario: usuario.id_usuario,
    nombre_usuario: usuario.nombre_usuario,
    rol: usuario.gls_tipousuario,
    ...(usuario.unidad_id_unidad
      ? {
          unidad_id_unidad: usuario.unidad_id_unidad,
          numero_unidad: usuario.numero_unidad ?? undefined,
          nombre_torre: usuario.nombre_torre ?? undefined,
        }
      : {}),
    ...(usuario.flg_comite ? { esComite: true } : {}),
    ...(usuario.flg_propietario ? { esPropietario: true } : {}),
  };

  // Ronda 26: solo Administrador (y nunca un Residente-comité, que sigue
  // atado a un único condominio vía su unidad) puede tener más de un
  // condominio. Si tiene más de uno, la sesión queda "a medio autenticar"
  // — se entrega un token SIN condominio_id_condominio (no sirve para
  // /admin/* ni /condominios, solo para POST /auth/seleccionar-condominio)
  // junto con la lista para que la app muestre el selector.
  if (usuario.gls_tipousuario === "Administrador") {
    const condominios = (await db
      .prepare(
        `SELECT c.id_condominio, c.gls_condominio
         FROM usuario_condominio uc
         JOIN condominio c ON c.id_condominio = uc.condominio_id_condominio
         WHERE uc.usuario_id_usuario = ? AND uc.flg_vigencia = 1 AND c.flg_vigencia = 1
         ORDER BY c.gls_condominio`
      )
      .all(usuario.id_usuario)) as { id_condominio: number; gls_condominio: string }[];

    if (condominios.length === 0) {
      // No debería pasar (el backfill del schema vincula a todo admin
      // existente con su condominio original) — pero si de algún modo
      // ocurre, se autorepara vinculándolo a ese condominio en vez de
      // dejarlo sin poder entrar.
      await db
        .prepare(
          `INSERT IGNORE INTO usuario_condominio (usuario_id_usuario, condominio_id_condominio) VALUES (?, ?)`
        )
        .run(usuario.id_usuario, usuario.condominio_id_condominio);
      condominios.push({ id_condominio: usuario.condominio_id_condominio, gls_condominio: "" });
    }

    if (condominios.length > 1) {
      const tokenIntermedio = jwt.sign(payloadBase, JWT_SECRET, { expiresIn: "10m" });
      return {
        requiereSeleccionCondominio: true as const,
        token: tokenIntermedio,
        condominios: condominios.map((c) => ({ id_condominio: c.id_condominio, nombre: c.gls_condominio })),
      };
    }

    // Un solo condominio: se salta el selector y se entra directo, como
    // siempre — sin cambio de comportamiento para el caso más común hoy.
    return await emitirTokenFinal({ ...payloadBase, condominio_id_condominio: condominios[0].id_condominio });
  }

  return await emitirTokenFinal({ ...payloadBase, condominio_id_condominio: usuario.condominio_id_condominio });
}

/**
 * Paso 2 del login de un Administrador con más de un condominio: recibe el
 * token intermedio (sin condominio_id_condominio) que devolvió login() y el
 * id del condominio elegido, valida que el admin realmente tenga acceso a
 * ese condominio (nunca confía en el id que mande el cliente sin
 * verificarlo contra usuario_condominio) y entrega el token final.
 */
export async function seleccionarCondominio(tokenIntermedio: string, condominioId: number) {
  let payload: GuardiaAutenticado;
  try {
    payload = jwt.verify(tokenIntermedio, JWT_SECRET) as GuardiaAutenticado;
  } catch {
    throw new Error("Sesión inválida o expirada. Vuelve a iniciar sesión.");
  }
  if (payload.rol !== "Administrador") {
    throw new Error("Esta acción es solo para el perfil Administrador.");
  }

  const acceso = (await db
    .prepare(
      `SELECT 1 FROM usuario_condominio WHERE usuario_id_usuario = ? AND condominio_id_condominio = ? AND flg_vigencia = 1`
    )
    .get(payload.id_usuario, condominioId)) as unknown;
  if (!acceso) {
    throw new Error("No tienes acceso a ese condominio.");
  }

  return await emitirTokenFinal({ ...payload, condominio_id_condominio: condominioId });
}

/** Lista los condominios de un Administrador — usada por la pantalla de selección para poder refrescarla (ej. recién creó uno nuevo). */
export async function listarCondominiosDeAdmin(idUsuario: number) {
  return db
    .prepare(
      `SELECT c.id_condominio, c.gls_condominio AS nombre
       FROM usuario_condominio uc
       JOIN condominio c ON c.id_condominio = uc.condominio_id_condominio
       WHERE uc.usuario_id_usuario = ? AND uc.flg_vigencia = 1 AND c.flg_vigencia = 1
       ORDER BY c.gls_condominio`
    )
    .all(idUsuario);
}

export function verificarToken(token: string): GuardiaAutenticado {
  return jwt.verify(token, JWT_SECRET) as GuardiaAutenticado;
}

/**
 * Cambio de contraseña por el propio usuario logeado (Guardia, Administrador
 * o Residente) — pide la contraseña actual para confirmar identidad. Sirve
 * en particular para que un residente cambie la contraseña inicial que le
 * asignó el administrador al activarle el acceso.
 */
export async function cambiarPassword(idUsuario: number, passwordActual: string, passwordNueva: string) {
  const usuario = (await db
    .prepare(`SELECT password_usuario FROM usuario WHERE id_usuario = ? AND flg_vigencia = 1`)
    .get(idUsuario)) as { password_usuario: string | null } | undefined;

  if (!usuario || !usuario.password_usuario) {
    throw new Error("Usuario no encontrado.");
  }
  if (!bcrypt.compareSync(passwordActual, usuario.password_usuario)) {
    throw new Error("La contraseña actual no es correcta.");
  }
  if (!passwordNueva || passwordNueva.length < 4) {
    throw new Error("La contraseña nueva debe tener al menos 4 caracteres.");
  }

  const hash = bcrypt.hashSync(passwordNueva, 10);
  await db.prepare(`UPDATE usuario SET password_usuario = ? WHERE id_usuario = ?`).run(hash, idUsuario);
}

// Cuántos minutos dura un código de recuperación antes de expirar.
const MINUTOS_VIGENCIA_CODIGO = 15;

function generarCodigoNumerico(): string {
  // 6 dígitos, con ceros a la izquierda si hace falta (ej. "004821").
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

/**
 * TODO (pendiente de decidir proveedor SMTP/API, ej. Resend/SendGrid/Gmail):
 * por ahora el "envío" del código es simulado — solo queda en el log del
 * servidor (ver Railway → Logs) para poder probar el flujo completo de
 * extremo a extremo sin depender de credenciales de correo todavía. Cuando
 * se conecte un proveedor real, solo hay que reemplazar el console.log de
 * abajo por la llamada de envío; el resto del flujo (generar código, hash,
 * expiración, validación) no cambia.
 */
async function enviarCodigoPorCorreo(correo: string, nombreUsuario: string, codigo: string) {
  console.log(
    `[recuperacion-password] (SIMULADO — sin envío real de correo todavía) ` +
      `Código para ${nombreUsuario} <${correo}>: ${codigo} (vence en ${MINUTOS_VIGENCIA_CODIGO} min)`
  );
}

/**
 * Paso 1 del flujo "olvidé mi contraseña": el usuario se identifica con su
 * usuariocol (el mismo que usa para loguearse) o con su correo_usuario
 * registrado — puede escribir cualquiera de los dos en el mismo campo. Si
 * existe, se genera un código de 6 dígitos, se invalidan códigos previos
 * sin usar, y se "envía" por correo (ver enviarCodigoPorCorreo).
 *
 * Por seguridad, esta función SIEMPRE resuelve sin lanzar error aunque el
 * identificador no exista o el usuario no tenga correo registrado — así el
 * endpoint no revela a quien lo llame si un usuario/correo existe o no en
 * el sistema. El caller (routes/auth.ts) siempre responde con un mensaje
 * genérico tipo "si el dato es válido, te llegará un código".
 */
export async function solicitarRecuperacion(identificador: string) {
  const usuario = (await db
    .prepare(
      `SELECT id_usuario, nombre_usuario, correo_usuario
       FROM usuario
       WHERE (usuariocol = ? OR correo_usuario = ?) AND flg_vigencia = 1`
    )
    .get(identificador, identificador)) as
    | { id_usuario: number; nombre_usuario: string; correo_usuario: string | null }
    | undefined;

  // Usuario no encontrado, o encontrado pero sin correo registrado (no hay
  // a dónde enviar el código) — en ambos casos no se hace nada más, pero
  // tampoco se informa el motivo a quien llamó al endpoint.
  if (!usuario || !usuario.correo_usuario) {
    return;
  }

  // Invalida cualquier código anterior sin usar de este usuario: solo el
  // más reciente debe servir.
  await db
    .prepare(`UPDATE password_reset_token SET flg_usado = 1 WHERE usuario_id_usuario = ? AND flg_usado = 0`)
    .run(usuario.id_usuario);

  const codigo = generarCodigoNumerico();
  const codigoHash = bcrypt.hashSync(codigo, 10);
  const fechaExpiracion = new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  await db
    .prepare(
      `INSERT INTO password_reset_token (usuario_id_usuario, codigo_hash, fecha_expiracion) VALUES (?, ?, ?)`
    )
    .run(usuario.id_usuario, codigoHash, fechaExpiracion);

  await enviarCodigoPorCorreo(usuario.correo_usuario, usuario.nombre_usuario, codigo);
}

/**
 * Paso 2 del flujo "olvidé mi contraseña": valida el código de 6 dígitos
 * contra el más reciente emitido para ese usuario (no usado y no expirado)
 * y, si coincide, actualiza la contraseña y marca el código como usado.
 */
export async function resetearPassword(identificador: string, codigo: string, passwordNueva: string) {
  if (!passwordNueva || passwordNueva.length < 4) {
    throw new Error("La contraseña nueva debe tener al menos 4 caracteres.");
  }

  const usuario = (await db
    .prepare(`SELECT id_usuario FROM usuario WHERE (usuariocol = ? OR correo_usuario = ?) AND flg_vigencia = 1`)
    .get(identificador, identificador)) as { id_usuario: number } | undefined;

  // Mensaje genérico también acá: no distingue "usuario no existe" de
  // "código incorrecto" para no dar pistas a quien intente adivinar.
  const mensajeError = "El código ingresado no es válido o ya expiró.";
  if (!usuario) {
    throw new Error(mensajeError);
  }

  const tokenVigente = (await db
    .prepare(
      `SELECT id_passwordresettoken, codigo_hash
       FROM password_reset_token
       WHERE usuario_id_usuario = ? AND flg_usado = 0 AND fecha_expiracion > NOW()
       ORDER BY id_passwordresettoken DESC
       LIMIT 1`
    )
    .get(usuario.id_usuario)) as { id_passwordresettoken: number; codigo_hash: string } | undefined;

  if (!tokenVigente || !bcrypt.compareSync(codigo, tokenVigente.codigo_hash)) {
    throw new Error(mensajeError);
  }

  const hash = bcrypt.hashSync(passwordNueva, 10);
  await db.prepare(`UPDATE usuario SET password_usuario = ? WHERE id_usuario = ?`).run(hash, usuario.id_usuario);
  await db
    .prepare(`UPDATE password_reset_token SET flg_usado = 1 WHERE id_passwordresettoken = ?`)
    .run(tokenVigente.id_passwordresettoken);
}
