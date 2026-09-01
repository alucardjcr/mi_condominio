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

// Ronda 26: usar SIEMPRE después de requireAuth + requireAdmin, en
// TODAS las rutas de /admin/*. Con multi-condominio, un token de
// Administrador válido ya no basta para garantizar que puede ver los
// datos de CUALQUIER condominio — antes de esta ronda no había ningún
// chequeo server-side de esto (cualquier admin logeado podía, en teoría,
// pedir ?condominio_id=2 aunque no administrara ese condominio). Cada ruta
// de /admin/* sigue mandando su condominio_id por query o por body como
// siempre (no se tocó ninguno de esos ~30 endpoints); este middleware
// central solo verifica, antes de llegar a la ruta, que el condominio
// pedido sea uno de los que el admin logeado realmente tiene vinculados
// (ver usuario_condominio / auth.service.ts).
export async function requireAdminCondominioAccess(req: Request, res: Response, next: NextFunction) {
  const candidato = Number(req.query.condominio_id ?? req.body?.condominio_id_condominio);
  // Si la ruta no manda condominio_id (algunas no lo necesitan, ej. listar
  // guardias sin filtro), no hay nada que validar acá — la propia ruta
  // decide si eso es válido o no.
  if (!candidato) return next();

  // Un residente-comité está atado a un único condominio (el de su
  // unidad), ya presente en el token — no usa usuario_condominio.
  if (req.guardia?.esComite) {
    if (req.guardia.condominio_id_condominio !== candidato) {
      return res.status(403).json({ error: "No tienes acceso a ese condominio." });
    }
    return next();
  }

  const acceso = await db
    .prepare(
      `SELECT 1 FROM usuario_condominio WHERE usuario_id_usuario = ? AND condominio_id_condominio = ? AND flg_vigencia = 1`
    )
    .get(req.guardia!.id_usuario, candidato);
  if (!acceso) {
    return res.status(403).json({ error: "No tienes acceso a ese condominio." });
  }
  next();
}
