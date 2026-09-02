import { Router } from "express";
import { listarPersonalEnTurnoHoy } from "../services/personal.service";
import { listarMantenciones } from "../services/mantencion.service";
import { CONDOMINIO_ID_DEFAULT } from "../config";

// Ronda 40, a pedido explícito del usuario: "quién viene hoy" — pantalla
// para que CUALQUIER residente (no solo Administrador/Comité, a diferencia
// del resto de los módulos de personal/mantención) sepa qué personal
// externo tiene turno hoy y qué mantenciones están programadas hoy. Router
// aparte, sin requireRol — montado en index.ts con el mismo criterio de
// acceso que el resto (cualquier rol autenticado del condominio).
export const hoyRouter = Router();

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

hoyRouter.get("/", async (req, res) => {
  try {
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    const hoy = hoyISO();
    const [personalExterno, mantenciones] = await Promise.all([
      listarPersonalEnTurnoHoy(condominioId),
      listarMantenciones(condominioId, { fechaInicio: hoy, fechaTermino: hoy }),
    ]);
    res.json({ personal_externo: personalExterno, mantenciones });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
