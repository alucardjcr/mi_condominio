import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/client";
import { verificarTurnoParaLogin } from "./turnos.service";
import { condominioEstaBloqueado } from "./facturacion.service";

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
  // Ronda 26: condominio con el que está trabajando esta sesión — el que
  // el usuario ELIGIÓ en el selector post-login si tiene más de uno (ver
  // seleccionarCondominio), o el único que tiene si solo administra/vive/
  // trabaja en uno. Aplica a TODOS los roles desde la fase 2 (antes solo
  // Administrador podía tener más de un condominio). Ausente únicamente en
  // el token "intermedio" que se entrega cuando alguien con más de un
  // condominio todavía no elige.
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
  // Ronda 26 (fase 2): esta consulta ya NO trae rol/condominio/unidad — eso
  // ahora vive en `membresia`, porque puede haber más de uno por persona
  // (y hasta ser distinto entre condominios). Acá solo se resuelve la
  // identidad (existe la cuenta, la contraseña es correcta).
  const usuario = (await db
    .prepare(`SELECT id_usuario, nombre_usuario, password_usuario FROM usuario WHERE usuariocol = ? AND flg_vigencia = 1`)
    .get(usuariocol)) as { id_usuario: number; nombre_usuario: string; password_usuario: string | null } | undefined;

  if (!usuario || !usuario.password_usuario) {
    throw new Error("Usuario o contraseña incorrectos.");
  }
  if (!bcrypt.compareSync(password, usuario.password_usuario)) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  // Ronda 27: SuperAdmin (el dueño del sistema, no un Administrador de
  // condominio) no está atado a ningún condominio en particular — se
  // detecta ANTES de tocar `membresia` y se salta por completo esa lógica
  // (incluido el filtro de facturación de abajo, que no le aplica).
  const esSuperAdmin = (await db
    .prepare(
      `SELECT 1 FROM usuario u
       JOIN tipo_usuario tu ON tu.id_tipousuario = u.tipo_usuario_id_tipousuario
       WHERE u.id_usuario = ? AND tu.gls_tipousuario = 'SuperAdmin'`
    )
    .get(usuario.id_usuario)) as unknown;
  if (esSuperAdmin) {
    return emitirTokenFinal({ id_usuario: usuario.id_usuario, nombre_usuario: usuario.nombre_usuario, rol: "SuperAdmin" });
  }

  const membresiasCrudas = await obtenerMembresiasDeUsuario(usuario.id_usuario);

  if (membresiasCrudas.length === 0) {
    // No debería pasar (el backfill del schema le da una membresía a todo
    // usuario que ya existía) — solo podría darse en un usuario creado a
    // mano sin pasar por los flujos normales de creación.
    throw new Error("Tu cuenta no tiene ningún condominio asignado. Contacta al administrador.");
  }

  // Ronda 27, a pedido explícito del usuario: un condominio con la
  // mensualidad pendiente simplemente NO APARECE — ni en el selector, ni
  // como login directo si era el único. No es un error de login (la
  // cuenta y la contraseña son correctas), es que ese condominio no está
  // disponible ahora mismo.
  const membresias = [];
  for (const m of membresiasCrudas) {
    if (!(await condominioEstaBloqueado(m.condominio_id_condominio))) membresias.push(m);
  }

  if (membresias.length === 0) {
    // Tenía condominio(s), pero TODOS con la mensualidad pendiente.
    return {
      pagoPendiente: true as const,
      // El rol de la primera membresía (para que el front decida si
      // mostrar el botón de pago — hoy solo Administrador lo verá, ver
      // PagoPendienteScreen) — si tuviera varias con roles distintos, da
      // lo mismo cuál se muestre primero, es solo para el mensaje.
      rol: membresiasCrudas[0].gls_tipousuario,
    };
  }

  if (membresias.length > 1) {
    // Ronda 26 (fase 2): más de un condominio (con cualquier rol,
    // incluso distinto entre ellos) — la sesión queda "a medio
    // autenticar": un token intermedio que solo sirve para
    // POST /auth/seleccionar-condominio, junto con la lista para que la
    // app muestre el selector (con el rol de cada una, ya que puede
    // variar: ej. "Residente en Talca" / "Guardia en Santiago").
    const tokenIntermedio = jwt.sign(
      { id_usuario: usuario.id_usuario, nombre_usuario: usuario.nombre_usuario },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    return {
      requiereSeleccionCondominio: true as const,
      token: tokenIntermedio,
      condominios: membresias.map((m) => ({ id_condominio: m.condominio_id_condominio, nombre: m.gls_condominio, rol: m.gls_tipousuario })),
    };
  }

  // Una sola membresía disponible: se salta el selector y se entra
  // directo, como siempre — sin cambio de comportamiento para el caso más
  // común hoy.
  return await construirSesionDesdeMembresia(usuario.id_usuario, usuario.nombre_usuario, membresias[0]);
}

interface MembresiaFila {
  id_membresia: number;
  condominio_id_condominio: number;
  gls_condominio: string;
  gls_tipousuario: string;
  unidad_id_unidad: number | null;
  numero_unidad: string | null;
  nombre_torre: string | null;
  flg_comite: number;
  flg_propietario: number;
}

async function obtenerMembresiasDeUsuario(idUsuario: number): Promise<MembresiaFila[]> {
  return (await db
    .prepare(
      `SELECT m.id_membresia, m.condominio_id_condominio, c.gls_condominio, tu.gls_tipousuario,
              m.unidad_id_unidad, un.numero_unidad, tb.nombre_torre, m.flg_comite, m.flg_propietario
       FROM membresia m
       JOIN condominio c ON c.id_condominio = m.condominio_id_condominio
       JOIN tipo_usuario tu ON tu.id_tipousuario = m.tipo_usuario_id_tipousuario
       LEFT JOIN unidad un ON un.id_unidad = m.unidad_id_unidad
       LEFT JOIN torre_block tb ON tb.id_torreblock = un.torre_block_id_torreblock
       WHERE m.usuario_id_usuario = ? AND m.flg_vigencia = 1 AND c.flg_vigencia = 1
       ORDER BY c.gls_condominio`
    )
    .all(idUsuario)) as MembresiaFila[];
}

// Arma el payload final + corre las validaciones que dependen de CUÁL
// condominio quedó elegido (hoy: el chequeo de turno de Guardia, ronda 20
// — antes se hacía con el condominio "de siempre" del usuario; ahora tiene
// que ser el de la membresía elegida, porque un mismo guardia puede tener
// turnos distintos en cada condominio donde trabaja).
async function construirSesionDesdeMembresia(idUsuario: number, nombreUsuario: string, m: MembresiaFila) {
  if (m.gls_tipousuario === "Guardia") {
    const { permitido, motivo } = await verificarTurnoParaLogin(idUsuario, m.condominio_id_condominio);
    if (!permitido) {
      throw new Error(motivo || "No puedes iniciar sesión fuera de tu turno asignado.");
    }
  }

  const payload: GuardiaAutenticado = {
    id_usuario: idUsuario,
    nombre_usuario: nombreUsuario,
    rol: m.gls_tipousuario,
    condominio_id_condominio: m.condominio_id_condominio,
    ...(m.unidad_id_unidad
      ? {
          unidad_id_unidad: m.unidad_id_unidad,
          numero_unidad: m.numero_unidad ?? undefined,
          nombre_torre: m.nombre_torre ?? undefined,
        }
      : {}),
    ...(m.flg_comite ? { esComite: true } : {}),
    ...(m.flg_propietario ? { esPropietario: true } : {}),
  };
  return emitirTokenFinal(payload);
}

/**
 * Paso 2 del login cuando el usuario tiene más de una membresía: recibe el
 * token intermedio que devolvió login() (identidad únicamente, sin rol ni
 * condominio) y el condominio elegido, busca SU membresía para ese
 * condominio (nunca confía en un rol/depto que mande el cliente) y entrega
 * el token final. También sirve para que alguien YA logeado se pase a otro
 * de sus condominios sin desloguearse (ver AuthContext.cambiarCondominio en
 * la app): en ese caso el "token intermedio" es directamente el token de
 * la sesión activa — igual de válido acá, porque esta función solo lee
 * id_usuario del token, ignora cualquier otro campo que pueda traer.
 */
export async function seleccionarCondominio(token: string, condominioId: number) {
  let payload: { id_usuario: number; nombre_usuario: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { id_usuario: number; nombre_usuario: string };
  } catch {
    throw new Error("Sesión inválida o expirada. Vuelve a iniciar sesión.");
  }

  const membresias = await obtenerMembresiasDeUsuario(payload.id_usuario);
  const elegida = membresias.find((m) => m.condominio_id_condominio === condominioId);
  if (!elegida) {
    throw new Error("No tienes acceso a ese condominio.");
  }
  // Defensa en profundidad: aunque el selector del front nunca debería
  // mostrar un condominio bloqueado (login() ya los filtra), por si el
  // condominio se bloqueó justo entre que se armó la lista y se hizo clic.
  if (await condominioEstaBloqueado(condominioId)) {
    throw new Error("No tienes acceso a ese condominio.");
  }

  return construirSesionDesdeMembresia(payload.id_usuario, payload.nombre_usuario, elegida);
}

/** Lista los condominios de un usuario (sin los bloqueados por falta de pago) — usada por la pantalla de selección/cambio para poder refrescarla (ej. recién creó un condominio nuevo). */
export async function listarCondominiosDeUsuario(idUsuario: number) {
  const membresias = await obtenerMembresiasDeUsuario(idUsuario);
  const resultado = [];
  for (const m of membresias) {
    if (await condominioEstaBloqueado(m.condominio_id_condominio)) continue;
    resultado.push({ id_condominio: m.condominio_id_condominio, nombre: m.gls_condominio, rol: m.gls_tipousuario });
  }
  return resultado;
}

/**
 * Ronda 26 (fase 2): mantiene sincronizada la membresía "principal" de un
 * usuario (la del condominio guardado en usuario.condominio_id_condominio,
 * su condominio "de siempre") con lo que diga la fila `usuario` en este
 * momento. Se llama al final de cada función que crea o edita un Guardia/
 * Residente/Personal (ver admin.service.ts / personal.service.ts) — así
 * evitamos duplicar cada UPDATE de `usuario` en `membresia` por separado
 * (fácil de olvidar alguno) y centralizamos la sincronización acá.
 *
 * Solo toca la membresía de SU condominio de siempre — si ese usuario
 * además tiene membresías en OTROS condominios (agregado ahí por el
 * administrador de ese otro condominio), esta función nunca las toca: las
 * pantallas de admin.service.ts siempre operan sobre el condominio de la
 * sesión actual, nunca sobre condominios ajenos a ella.
 */
export async function sincronizarMembresiaPrincipal(idUsuario: number) {
  const u = (await db
    .prepare(
      `SELECT tipo_usuario_id_tipousuario, condominio_id_condominio, unidad_id_unidad, flg_comite,
              flg_propietario, tipo_residente_id_tiporesidente, tipo_personal_id_tipopersonal, flg_vigencia
       FROM usuario WHERE id_usuario = ?`
    )
    .get(idUsuario)) as
    | {
        tipo_usuario_id_tipousuario: number;
        condominio_id_condominio: number;
        unidad_id_unidad: number | null;
        flg_comite: number;
        flg_propietario: number;
        tipo_residente_id_tiporesidente: number | null;
        tipo_personal_id_tipopersonal: number | null;
        flg_vigencia: number;
      }
    | undefined;
  if (!u) return;

  const existente = (await db
    .prepare(`SELECT id_membresia FROM membresia WHERE usuario_id_usuario = ? AND condominio_id_condominio = ?`)
    .get(idUsuario, u.condominio_id_condominio)) as { id_membresia: number } | undefined;

  if (existente) {
    await db
      .prepare(
        `UPDATE membresia SET tipo_usuario_id_tipousuario = ?, unidad_id_unidad = ?, flg_comite = ?,
                flg_propietario = ?, tipo_residente_id_tiporesidente = ?, tipo_personal_id_tipopersonal = ?,
                flg_vigencia = ?
         WHERE id_membresia = ?`
      )
      .run(
        u.tipo_usuario_id_tipousuario,
        u.unidad_id_unidad,
        u.flg_comite,
        u.flg_propietario,
        u.tipo_residente_id_tiporesidente,
        u.tipo_personal_id_tipopersonal,
        u.flg_vigencia,
        existente.id_membresia
      );
  } else {
    await db
      .prepare(
        `INSERT INTO membresia (usuario_id_usuario, condominio_id_condominio, tipo_usuario_id_tipousuario,
                unidad_id_unidad, flg_comite, flg_propietario, tipo_residente_id_tiporesidente,
                tipo_personal_id_tipopersonal, flg_vigencia)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        idUsuario,
        u.condominio_id_condominio,
        u.tipo_usuario_id_tipousuario,
        u.unidad_id_unidad,
        u.flg_comite,
        u.flg_propietario,
        u.tipo_residente_id_tiporesidente,
        u.tipo_personal_id_tipopersonal,
        u.flg_vigencia
      );
  }
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
