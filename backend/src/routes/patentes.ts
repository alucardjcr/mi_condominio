import { Router } from "express";
import { consultarPatente } from "../services/patentes.service";
import { requireRol } from "../middleware/auth";

export const patentesRouter = Router();

// Montado con requireAuth en index.ts. Se restringe a Guardia/Administrador
// porque revela a qué depto pertenece cada patente del condominio — un
// residente no necesita esta consulta (no hay pantalla para eso en su
// portal) y no debería poder mirar la de otros deptos.
patentesRouter.use(requireRol("Guardia", "Administrador"));

// GET /patentes/AB1234 -> datos del propietario/arrendatario si está registrada
patentesRouter.get("/:patente", async (req, res) => {
  const resultado = await consultarPatente(req.params.patente);
  if (!resultado) {
    return res.status(404).json({ error: "Esta patente no está registrada en el condominio." });
  }
  res.json(resultado);
});
