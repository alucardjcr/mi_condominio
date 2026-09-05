import { Router } from "express";
import { listarDisponibilidad } from "../services/estacionamientoVisita.service";
import { listarPizarronArriendo, actualizarEstadoArriendo } from "../services/estacionamientosArriendo.service";
import { requireAuth, requireCondominioAccess, requireSuscripcionAlDia } from "../middleware/auth";

export const estacionamientosRouter = Router();

// GET /estacionamientos/disponibilidad?condominio_id=1
// Devuelve todos los cupos de tipo "Visita" del condominio con su estado
// actual (disponible/ocupado) y, si está ocupado, la visita activa asociada.
estacionamientosRouter.get("/disponibilidad", async (req, res) => {
  try {
    const condominioId = Number(req.query.condominio_id);
    if (!condominioId) {
      return res.status(400).json({ error: "Falta el parámetro condominio_id." });
    }
    const data = await listarDisponibilidad(condominioId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Estacionamientos para arriendo entre residentes (ronda 20). A diferencia
// de /disponibilidad (pública, la usa el guardia sin login), este "pizarrón"
// sí requiere sesión: el guardia lo consulta para informar a un vecino
// interesado, y cada residente cambia el estado de SU PROPIO cupo (o
// Administrador/Comité, el de cualquiera) — ver
// estacionamientosArriendo.service.ts.
// ---------------------------------------------------------------------------

estacionamientosRouter.get("/arriendo", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, async (req, res) => {
  try {
    const condominioId = req.guardia!.condominio_id_condominio!;
    res.json(await listarPizarronArriendo(condominioId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

estacionamientosRouter.patch("/arriendo/:id", requireAuth, requireSuscripcionAlDia, async (req, res) => {
  try {
    const { disponible, precio_arriendo } = req.body;
    if (disponible === undefined) {
      return res.status(400).json({ error: "Falta el campo 'disponible' (true/false)." });
    }
    const resultado = await actualizarEstadoArriendo(
      Number(req.params.id),
      {
        disponible: !!disponible,
        precioArriendo: precio_arriendo !== undefined && precio_arriendo !== null && precio_arriendo !== "" ? Number(precio_arriendo) : null,
      },
      req.guardia!
    );
    res.json(resultado);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});
