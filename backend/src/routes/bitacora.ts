import { Router } from "express";
import { crearEntradaBitacora, listarBitacora } from "../services/bitacora.service";
import { requireRol } from "../middleware/auth";
import { CONDOMINIO_ID_DEFAULT } from "../config";

// Ronda 20: bitácora de novedades del turno de portería. Lectura
// compartida entre Guardia y Administrador/Comité (decisión explícita del
// usuario: supervisión); escritura exclusiva de Guardia (auto-timestamp de
// fecha/hora y nombre, nunca editable).
export const bitacoraRouter = Router();

bitacoraRouter.get("/", requireRol("Guardia", "Administrador"), async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(
    await listarBitacora(condominioId, {
      fechaInicio: req.query.fecha_inicio ? String(req.query.fecha_inicio) : undefined,
      fechaTermino: req.query.fecha_termino ? String(req.query.fecha_termino) : undefined,
    })
  );
});

bitacoraRouter.post("/", requireRol("Guardia"), async (req, res) => {
  try {
    const { texto } = req.body;
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(await crearEntradaBitacora({ texto, condominioId }, req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
