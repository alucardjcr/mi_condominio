import { NextFunction, Request, Response } from "express";
import { verificarToken, GuardiaAutenticado } from "../services/auth.service";

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
