import { Router } from "express";
import { crearCondominioConEstructura, listarCondominiosDeUsuario } from "../services/condominios.service";

// Ronda 26: montado en index.ts SOLO con requireAuth + requireAdmin (sin
// requireAdminCondominioAccess) a propósito — estas dos rutas son las
// únicas de /admin-condominios que por naturaleza no pueden estar
// scopeadas a un condominio ya elegido: "crear uno nuevo" todavía no
// existe, y "listar los míos" es justamente la lista completa que le
// puede tocar a un admin con más de un condominio (ver
// SeleccionarCondominioScreen en la app).
export const condominiosRouter = Router();

// Ronda 26 (fase 1): estas dos rutas son exclusivas del rol "Administrador"
// real — a diferencia del resto de /admin/*, NO se abren también a un
// Residente-comité (que normalmente cuenta como Administrador en todo lo
// demás, ver calificaParaRol en middleware/auth.ts). Un comité está atado
// a un único condominio a través de su unidad, no de usuario_condominio;
// login() nunca consulta esa tabla para un comité, así que si pudiera
// crear un condominio acá quedaría vinculado a uno al que después nunca
// podría volver a entrar.
function soloAdministradorReal(req: any, res: any, next: any) {
  if (req.guardia?.rol !== "Administrador") {
    return res.status(403).json({ error: "Esta acción requiere el perfil Administrador." });
  }
  next();
}
condominiosRouter.use(soloAdministradorReal);

condominiosRouter.get("/mios", async (req, res) => {
  try {
    const condominios = await listarCondominiosDeUsuario(req.guardia!.id_usuario);
    res.json(condominios);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

condominiosRouter.post("/", async (req, res) => {
  try {
    const resultado = await crearCondominioConEstructura(req.guardia!.id_usuario, req.body);
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
