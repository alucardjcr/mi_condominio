import { Router } from "express";
import {
  listarBloques,
  crearBloque,
  actualizarBloque,
  eliminarBloque,
  listarPersonalParaTurno,
  listarTurnos,
  asignarTurno,
  quitarTurno,
  generarPatronTurnos,
  resumenTurnosDelMes,
} from "../services/turnos.service";
import { listarGuardias, crearGuardia, actualizarGuardia } from "../services/admin.service";
import { requireRol, requirePerteneceAlCondominio } from "../middleware/auth";

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

// --- Calendario de turnos ---------------------------------------------

jefeGuardiasRouter.get("/bloques", async (req, res) => {
  const condominioId = req.guardia!.condominio_id_condominio!;
  res.json(await listarBloques(condominioId));
});

// Ronda 39, a pedido explícito del usuario: bloques editables (antes 3
// fijos, sembrados una vez, sin forma de cambiarlos desde la app).
jefeGuardiasRouter.post("/bloques", async (req, res) => {
  try {
    const { gls_turnobloque, hora_inicio, hora_termino } = req.body;
    const condominioId = req.guardia!.condominio_id_condominio!;
    res.status(201).json(await crearBloque(condominioId, { gls_turnobloque, hora_inicio, hora_termino }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

jefeGuardiasRouter.patch("/bloques/:id", requirePerteneceAlCondominio("turno_bloque", "id_turnobloque"), async (req, res) => {
  try {
    const { gls_turnobloque, hora_inicio, hora_termino } = req.body;
    res.json(await actualizarBloque(Number(req.params.id), { gls_turnobloque, hora_inicio, hora_termino }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

jefeGuardiasRouter.delete("/bloques/:id", requirePerteneceAlCondominio("turno_bloque", "id_turnobloque"), async (req, res) => {
  try {
    await eliminarBloque(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 39: personal asignable a un turno — Guardia + JefeGuardias (antes
// solo se podía elegir un Guardia; el jefe de guardias no aparecía acá
// aunque en la práctica también hace turno).
jefeGuardiasRouter.get("/personal", async (req, res) => {
  const condominioId = req.guardia!.condominio_id_condominio!;
  res.json(await listarPersonalParaTurno(condominioId));
});

// GET /jefe-guardias/turnos?fecha_inicio=YYYY-MM-DD&fecha_termino=YYYY-MM-DD
// Sin fechas, devuelve la semana en curso — con fechas, cualquier rango
// (ronda 39: el front ahora pide un mes completo para la vista de
// calendario mensual).
jefeGuardiasRouter.get("/turnos", async (req, res) => {
  const condominioId = req.guardia!.condominio_id_condominio!;
  res.json(
    await listarTurnos(
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
    const condominioId = req.guardia!.condominio_id_condominio!;
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

jefeGuardiasRouter.delete("/turnos/:id", requirePerteneceAlCondominio("turno_asignado_guardia", "id_turnoasignado"), async (req, res) => {
  try {
    await quitarTurno(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 39, a pedido explícito del usuario: generador de patrón tipo
// "4x4" — ver la explicación completa en turnos.service.ts.
jefeGuardiasRouter.post("/turnos/generar-patron", async (req, res) => {
  try {
    const { fecha_inicio, fecha_termino, bloque_dia_id, bloque_noche_id, dias_por_bloque, duplas } = req.body;
    if (!fecha_inicio || !fecha_termino || !bloque_dia_id || !bloque_noche_id || !Array.isArray(duplas)) {
      return res.status(400).json({
        error: "Faltan campos: fecha_inicio, fecha_termino, bloque_dia_id, bloque_noche_id, duplas.",
      });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    const resultado = await generarPatronTurnos(
      {
        condominioId,
        fechaInicio: String(fecha_inicio),
        fechaTermino: String(fecha_termino),
        bloqueDiaId: Number(bloque_dia_id),
        bloqueNocheId: Number(bloque_noche_id),
        diasPorBloque: Number(dias_por_bloque) || 4,
        duplas: duplas.map((d: any) => ({ guardiaDiaId: Number(d.guardia_dia_id), guardiaNocheId: Number(d.guardia_noche_id) })),
      },
      req.guardia!.id_usuario
    );
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- CRUD de guardias (reutiliza admin.service.ts tal cual) ----------------

jefeGuardiasRouter.get("/guardias", async (req, res) => {
  res.json(await listarGuardias(req.guardia!.condominio_id_condominio!));
});

jefeGuardiasRouter.post("/guardias", async (req, res) => {
  try {
    const { nombre_usuario, usuariocol, password, rut, telefono } = req.body;
    if (!nombre_usuario || !usuariocol || !password) {
      return res.status(400).json({ error: "Faltan campos: nombre_usuario, usuariocol, password." });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    res.status(201).json(await crearGuardia({ nombre_usuario, usuariocol, password, condominio_id_condominio: condominioId, rut, telefono }));
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Ese nombre de usuario ya existe." : err.message });
  }
});

jefeGuardiasRouter.patch("/guardias/:id", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    const { nombre_usuario, password, flg_vigencia, rut, telefono } = req.body;
    res.json(
      await actualizarGuardia(Number(req.params.id), {
        nombre_usuario,
        password,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
        rut,
        telefono,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 53, a pedido explícito del usuario, con referencia visual: resumen
// de turnos por guardia y bloque en un rango (para el dashboard).
jefeGuardiasRouter.get("/turnos/resumen-mes", async (req, res) => {
  try {
    const condominioId = req.guardia!.condominio_id_condominio!;
    const fechaInicio = String(req.query.fecha_inicio);
    const fechaTermino = String(req.query.fecha_termino);
    if (!fechaInicio || !fechaTermino) {
      return res.status(400).json({ error: "Faltan parámetros: fecha_inicio, fecha_termino." });
    }
    res.json(await resumenTurnosDelMes(condominioId, fechaInicio, fechaTermino));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
