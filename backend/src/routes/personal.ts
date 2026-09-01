import { Router } from "express";
import { iniciarTurno, finalizarTurno, getTurnoActual, listarMisTareas, completarTarea } from "../services/personal.service";
import { CONDOMINIO_ID_DEFAULT } from "../config";
import { requireRol } from "../middleware/auth";

// Ronda 18: autoservicio del propio trabajador de personal externo (aseo,
// jardinería, mantención, etc.) — marca su turno y ve/completa sus propias
// tareas. Todo este router es exclusivo del rol "Personal", así que el
// chequeo se aplica una sola vez acá arriba en vez de repetirlo ruta por
// ruta (mismo patrón que soloConserjeria en routes/reservas.ts).
export const personalRouter = Router();
const soloPersonal = requireRol("Personal");
personalRouter.use(soloPersonal);

personalRouter.post("/turno/iniciar", async (req, res) => {
  try {
    // Personal no tiene unidad — el body puede mandar condominio_id_condominio
    // si algún día hay más de uno; por ahora este MVP es de un solo
    // condominio, así que se usa el default (mismo criterio que el resto de
    // las rutas de este proyecto).
    const condominioId = Number(req.body?.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(await iniciarTurno(req.guardia!.id_usuario, condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

personalRouter.post("/turno/finalizar", async (req, res) => {
  try {
    res.json(await finalizarTurno(req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

personalRouter.get("/turno/actual", async (req, res) => {
  res.json(await getTurnoActual(req.guardia!.id_usuario));
});

personalRouter.get("/tareas", async (req, res) => {
  res.json(await listarMisTareas(req.guardia!.id_usuario));
});

personalRouter.patch("/tareas/:id/completar", async (req, res) => {
  try {
    res.json(await completarTarea(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
