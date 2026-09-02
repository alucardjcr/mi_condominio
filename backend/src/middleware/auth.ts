import { NextFunction, Request, Response } from "express";
import { verificarToken, GuardiaAutenticado } from "../services/auth.service";
import { db } from "../db/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      guardia?: GuardiaAutenticado;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Falta autenticación. Inicia sesión primero." });
  }

  try {
    const token = header.slice("Bearer ".length);
    req.guardia = verificarToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada. Vuelve a iniciar sesión." });
  }
}

// Un residente con flg_comite=1 (payload.esComite) tiene, en todo el
// sistema, los mismos permisos que un Administrador — sigue siendo
// Residente (rol="Residente"), así que cualquier chequeo de rol que
// acepte "Administrador" también debe aceptar a un comité. Este helper
// centraliza esa equivalencia para no repetirla en cada middleware.
function calificaParaRol(usuario: GuardiaAutenticado | undefined, roles: string[]): boolean {
  if (!usuario) return false;
  if (roles.includes(usuario.rol)) return true;
  if (roles.includes("Administrador") && usuario.esComite) return true;
  return false;
}

// Usar SIEMPRE después de requireAuth (necesita req.guardia ya seteado).
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!calificaParaRol(req.guardia, ["Administrador"])) {
    return res.status(403).json({ error: "Esta acción requiere el perfil Administrador (o ser miembro del comité)." });
  }
  next();
}

// Restringe una ruta a una lista de roles específicos. Usar SIEMPRE después
// de requireAuth. Con el login de residentes, varias rutas que antes solo
// podían tocar Guardia/Administrador (porque eran los únicos con
// credenciales) ahora necesitan este chequeo explícito. Si la lista incluye
// "Administrador", un residente miembro del comité también pasa el check.
export function requireRol(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!calificaParaRol(req.guardia, roles)) {
      return res.status(403).json({ error: `Esta acción requiere uno de estos perfiles: ${roles.join(", ")}.` });
    }
    next();
  };
}

// Ronda 26 (fase 2): usar SIEMPRE después de requireAuth, en toda ruta que
// lea un condominio_id que mande el cliente (query ?condominio_id= o body
// condominio_id_condominio). Antes de esta ronda no había NINGÚN chequeo
// de esto — daba lo mismo porque solo existía un condominio; ahora que
// cualquier rol puede pertenecer a más de uno, alguien podría en teoría
// pedir ?condominio_id=<uno ajeno> y ver datos de un condominio donde no
// tiene ningún rol.
//
// El chequeo es una simple comparación contra el token, SIN consultar la
// base: el condominio de la sesión (req.guardia.condominio_id_condominio)
// ya quedó validado contra `membresia` en el momento del login/selección
// (ver auth.service.ts) — no hace falta repetir esa validación en cada
// request. Si alguien quiere trabajar con OTRO de sus condominios, tiene
// que pasar por POST /auth/seleccionar-condominio (que sí valida de
// nuevo), no mandar un condominio_id distinto con la misma sesión.
export function requireCondominioAccess(req: Request, res: Response, next: NextFunction) {
  const candidato = Number(req.query.condominio_id ?? req.body?.condominio_id_condominio);
  // Si la ruta no manda condominio_id (algunas no lo necesitan), no hay
  // nada que validar acá — la propia ruta decide si eso es válido o no.
  if (!candidato) return next();

  if (req.guardia?.condominio_id_condominio !== candidato) {
    return res.status(403).json({ error: "No tienes acceso a ese condominio." });
  }
  next();
}

// Ronda 27: usar SIEMPRE después de requireAuth, para las rutas exclusivas
// del dueño del sistema (/super-admin/*: crear cuentas Administrador,
// configurar/marcar facturación). A propósito NO usa calificaParaRol — un
// Residente-comité (que cuenta como Administrador en todo lo demás) NO
// debe pasar acá; este rol es estrictamente "SuperAdmin", sin
// equivalencias.
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.guardia?.rol !== "SuperAdmin") {
    return res.status(403).json({ error: "Esta acción requiere el perfil de administrador del sistema." });
  }
  next();
}

// Ronda 27: usar SIEMPRE después de requireAuth (y después de
// requireCondominioAccess si la ruta también lo usa), en toda ruta
// scopeada a un condominio — corta con 402 si ese condominio tiene la
// mensualidad pendiente (ver facturacion.service.ts ->
// condominioEstaBloqueado). Nunca aplica a SuperAdmin (no está atado a
// ningún condominio) ni a rutas sin condominio en el token.
//
// Por qué este chequeo hace falta ADEMÁS de que los condominios bloqueados
// ya no aparezcan en el selector de login (ver auth.service.ts): un token
// ya emitido dura hasta 30 días — si el condominio se bloquea a mitad de
// ese período, sin este middleware la sesión ya abierta seguiría
// funcionando igual hasta que expirara sola.
export async function requireSuscripcionAlDia(req: Request, res: Response, next: NextFunction) {
  if (req.guardia?.rol === "SuperAdmin") return next();
  const condominioId = req.guardia?.condominio_id_condominio;
  if (!condominioId) return next();

  const { condominioEstaBloqueado } = await import("../services/facturacion.service");
  if (await condominioEstaBloqueado(condominioId)) {
    return res.status(402).json({
      error: "Este condominio tiene la mensualidad pendiente. Regulariza el pago para volver a usar la app.",
      pagoPendiente: true,
    });
  }
  next();
}

// ---------------------------------------------------------------------------
// Ronda 44, a pedido explícito del usuario (revisión de seguridad — IDOR):
// hasta esta ronda, ninguna ruta que recibe un :id directo en la URL (ej.
// PATCH /admin/residentes/:id) verificaba que ESE :id realmente perteneciera
// al condominio de la sesión actual. requireCondominioAccess solo compara
// contra un condominio_id que venga en el query/body de la request — la
// mayoría de estas rutas nunca lo mandan (el :id ya "identifica" el
// recurso), así que quedaban SIN NINGUNA verificación real: un
// Administrador de un condominio podía, con solo adivinar o probar un
// número correlativo, editar/aprobar/notificar un recurso que en realidad
// pertenece a OTRO condominio. Clásico IDOR (Insecure Direct Object
// Reference).
//
// Este middleware genérico cierra ese hueco: antes de que la ruta llegue a
// tocar el service, confirma con una consulta directa que la fila `:id`
// existe Y pertenece al condominio de `req.guardia`. Se usa SIEMPRE
// DESPUÉS de requireAuth (necesita req.guardia.condominio_id_condominio ya
// seteado). Uso: `requirePerteneceAlCondominio("usuario", "id_usuario")`.
export function requirePerteneceAlCondominio(tabla: string, columnaId: string, columnaCondominio = "condominio_id_condominio") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Falta un id válido en la URL." });
    }
    const condominioId = req.guardia?.condominio_id_condominio;
    if (!condominioId) {
      return res.status(403).json({ error: "Tu sesión no tiene un condominio asociado." });
    }
    const fila = await db
      .prepare(`SELECT 1 FROM ${tabla} WHERE ${columnaId} = ? AND ${columnaCondominio} = ?`)
      .get(id, condominioId);
    if (!fila) {
      // A propósito el mismo mensaje que "no existe" (404), NO "no tienes
      // acceso" (403) — no hay que confirmarle a quien está probando ids
      // que el recurso SÍ existe pero en otro condominio; para quien
      // consulta, un id ajeno debe verse igual que un id inexistente.
      return res.status(404).json({ error: "No existe ese recurso." });
    }
    next();
  };
}
