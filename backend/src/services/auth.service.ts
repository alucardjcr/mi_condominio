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

  const payload: GuardiaAutenticado = {
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

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInPorRol(usuario.gls_tipousuario) });
  return { token, guardia: payload, rol: usuario.gls_tipousuario };
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
