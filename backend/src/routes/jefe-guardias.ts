import { Router } from "express";
import { listarBloques, listarTurnosSemana, asignarTurno, quitarTurno } from "../services/turnos.service";
import { listarGuardias, crearGuardia, actualizarGuardia } from "../services/admin.service";
import { requireRol } from "../middleware/auth";
import { CONDOMINIO_ID_DEFAULT } from "../config";

// Ronda 20: rol JEFE_GUARDIAS. A pedido explícito del usuario, este perfil
// SOLO tiene acceso a dos cosas: el calendario semanal de turnos y un CRUD
// de guardias para su propio control ("Solo tendra acceso a eso este
// perfil") — por eso este router va montado aparte (no dentro de /admin) y
// el CRUD de guardias reutiliza tal cual listarGuardias/crearGuardia/
// actualizarGuardia de admin.service.ts en vez de duplicar esa lógica.
export const jefeGuardiasRouter = Router();

jefeGuardiasRouter.use(requireRol("JefeGuardias"));

function esDuplicado(err: any): boolean {
  return err?.code === "ER_DUP_ENTRY";
}

// --- Calendario semanal de turnos ------------------------------------------

jefeGuardiasRouter.get("/bloques", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarBloques(condominioId));
});

// GET /jefe-guardias/turnos?fecha_inicio=YYYY-MM-DD&fecha_termino=YYYY-MM-DD
// Sin fechas, devuelve la semana en curso (lunes a domingo) — ver
// turnos.service.ts.
jefeGuardiasRouter.get("/turnos", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(
    await listarTurnosSemana(
      condominioId,
      req.query.fecha_inicio ? String(req.query.fecha_inicio) : undefined,
      req.query.fecha_termino ? String(req.query.fecha_termino) : undefined
    )
  );
});

jefeGuardiasRouter.post("/turnos", async (req, res) => {
  try {
    const { guardia_usuario_id, turno_bloque_id_turnobloque, fecha } = req.body;
    if (!guardia_usuario_id || !turno_bloque_id_turnobloque || !fecha) {
      return res.status(400).json({ error: "Faltan campos: guardia_usuario_id, turno_bloque_id_turnobloque, fecha." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const turno = await asignarTurno(
      {
        guardiaUsuarioId: Number(guardia_usuario_id),
        turnoBloqueId: Number(turno_bloque_id_turnobloque),
        fecha: String(fecha),
        condominioId,
      },
      req.guardia!.id_usuario
    );
    res.status(201).json(turno);
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Ese guardia ya tiene asignado ese bloque ese día." : err.message });
  }
});

jefeGuardiasRouter.delete("/turnos/:id", async (req, res) => {
  try {
    await quitarTurno(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- CRUD de guardias (reutiliza admin.service.ts tal cual) ----------------

jefeGuardiasRouter.get("/guardias", async (_req, res) => {
  res.json(await listarGuardias());
});

jefeGuardiasRouter.post("/guardias", async (req, res) => {
  try {
    const { nombre_usuario, usuariocol, password } = req.body;
    if (!nombre_usuario || !usuariocol || !password) {
      return res.status(400).json({ error: "Faltan campos: nombre_usuario, usuariocol, password." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(await crearGuardia({ nombre_usuario, usuariocol, password, condominio_id_condominio: condominioId }));
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Ese nombre de usuario ya existe." : err.message });
  }
});

jefeGuardiasRouter.patch("/guardias/:id", async (req, res) => {
  try {
    const { nombre_usuario, password, flg_vigencia } = req.body;
    res.json(
      await actualizarGuardia(Number(req.params.id), {
        nombre_usuario,
        password,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
