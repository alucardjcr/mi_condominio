import { Router } from "express";
import { crearCondominioConEstructura, eliminarCondominioVacio } from "../services/condominios.service";
import { listarCondominiosDeUsuario } from "../services/auth.service";

// Ronda 26: montado en index.ts SOLO con requireAuth + requireAdmin (sin
// requireCondominioAccess) a propósito — estas dos rutas son las únicas
// que por naturaleza no pueden estar scopeadas a un condominio ya elegido:
// "crear uno nuevo" todavía no existe, y "listar los míos" es justamente
// la lista completa que le puede tocar a alguien con más de un condominio
// (ver SeleccionarCondominioScreen en la app).
export const condominiosRouter = Router();

// Ronda 26 (fase 2): estas dos rutas son exclusivas del rol "Administrador"
// real — a diferencia del resto de /admin/*, NO se abren también a un
// Residente-comité (que normalmente cuenta como Administrador en todo lo
// demás, ver calificaParaRol en middleware/auth.ts). Un comité sí tiene su
// propia fila en `membresia` como cualquier otro rol desde esta fase, así
// que técnicamente PODRÍA crear un condominio sin quedar "atrapado" — pero
// dar de alta un condominio nuevo es una acción de nivel organización (la
// persona que administra varias propiedades), no algo que le corresponda a
// alguien cuyo rol es representar a los vecinos de UN depto en particular.
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

// Ronda 56, a pedido explícito del usuario: deshacer un condominio creado
// por error (ej. nombre mal escrito), siempre que todavía no se le haya
// agregado nada real — ver la nota completa en eliminarCondominioVacio().
condominiosRouter.delete("/:id", async (req, res) => {
  try {
    await eliminarCondominioVacio(Number(req.params.id), req.guardia!.id_usuario);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
