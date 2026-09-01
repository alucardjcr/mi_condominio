import { Router } from "express";
import {
  listarTiposElementoMantencion,
  listarMantencionesProgramadas,
  listarMantencionesEnCurso,
  getMantencion,
  registrarIngresoEmpresa,
  registrarSalidaEmpresa,
} from "../services/mantencion.service";
import { CONDOMINIO_ID_DEFAULT } from "../config";
import { requireRol } from "../middleware/auth";

// Ronda 19: mantenciones (limpieza de techo, piscina, ascensores, etc.) —
// trabajo hecho por una empresa externa SIN cuenta en el sistema. Este
// router es donde el guardia opera el día que la empresa llega: elige de
// la lista cuál mantención programada está realizando y marca su
// ingreso/salida (mismo patrón que el módulo "Reserva Área Común" de
// reservas.ts). El CRUD de programación (crear/editar/cancelar/
// comprobantes) es exclusivo de Administrador/Comité — ver
// /admin/mantenciones y /admin/elementos-mantencion en admin.ts.
export const mantencionesRouter = Router();

const soloConserjeria = requireRol("Guardia", "Administrador");
mantencionesRouter.use(soloConserjeria);

mantencionesRouter.get("/elementos", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarTiposElementoMantencion(condominioId));
});

mantencionesRouter.get("/programadas", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarMantencionesProgramadas(condominioId));
});

mantencionesRouter.get("/en-curso", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarMantencionesEnCurso(condominioId));
});

// PATCH /mantenciones/:id/ingreso -> el guardia registra la llegada de la
// empresa (empresa + persona + RUT). Solo válido si la mantención está
// Programada — nunca se crea un registro "suelto" sin programación previa.
mantencionesRouter.patch("/:id/ingreso", async (req, res) => {
  try {
    const { empresa_nombre, persona_nombre, persona_rut } = req.body;
    if (!empresa_nombre || !persona_nombre) {
      return res.status(400).json({ error: "Faltan campos: empresa_nombre, persona_nombre." });
    }
    res.json(
      await registrarIngresoEmpresa(
        Number(req.params.id),
        { empresaNombre: empresa_nombre, personaNombre: persona_nombre, personaRut: persona_rut },
        req.guardia!.id_usuario
      )
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /mantenciones/:id/salida -> el guardia marca que la empresa se
// retiró; la mantención pasa sola a "Realizada".
mantencionesRouter.patch("/:id/salida", async (req, res) => {
  try {
    res.json(await registrarSalidaEmpresa(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /mantenciones/:id -> detalle. Va al final para que "elementos",
// "programadas" y "en-curso" no se confundan con un :id.
mantencionesRouter.get("/:id", async (req, res) => {
  try {
    res.json(await getMantencion(Number(req.params.id)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});
