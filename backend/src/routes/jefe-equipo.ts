import { Router } from "express";
import { requireRol } from "../middleware/auth";
import { listarMiEquipo, listarHorarioDe, definirHorarioSemanal } from "../services/jefe-equipo.service";

// Ronda 68, a pedido explícito del usuario: un solo router compartido por
// JefeAseo y JefeJardineria (son estructuralmente idénticos — la única
// diferencia es a qué trabajadores ve cada uno, y eso ya lo resuelve
// jefe_id_usuario, no hace falta separar el código por rol).
export const jefeEquipoRouter = Router();

jefeEquipoRouter.use(requireRol("JefeAseo", "JefeJardineria"));

jefeEquipoRouter.get("/", async (req, res) => {
  res.json(await listarMiEquipo(req.guardia!.id_usuario));
});

jefeEquipoRouter.get("/:id/horario", async (req, res) => {
  try {
    res.json(await listarHorarioDe(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

jefeEquipoRouter.put("/:id/horario", async (req, res) => {
  try {
    const { dias } = req.body;
    if (!Array.isArray(dias)) {
      return res.status(400).json({ error: "Falta el campo: dias (arreglo)." });
    }
    const resultado = await definirHorarioSemanal(
      Number(req.params.id),
      req.guardia!.id_usuario,
      req.guardia!.condominio_id_condominio!,
      dias
    );
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
