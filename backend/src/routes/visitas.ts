import { Router } from "express";
import {
  registrarEntrada,
  registrarSalida,
  listarVisitasActivas,
} from "../services/estacionamientoVisita.service";
import { requireAuth, requireRol, requireCondominioAccess } from "../middleware/auth";

export const visitasRouter = Router();

// Con el portal de residentes, "logeado" ya no implica "Guardia o
// Administrador" — hay que restringirlo explícitamente. Un residente no
// registra entradas/salidas de visitas. Ronda 26: requireCondominioAccess
// va DESPUÉS de requireAuth a propósito (necesita req.guardia ya seteado).
visitasRouter.use(requireAuth, requireRol("Guardia", "Administrador"), requireCondominioAccess);

// Debe coincidir con el id sembrado en seed.ts para tipo_visita "Peatonal".
const TIPO_VISITA_PEATONAL_ID = 2;

// POST /visitas -> registrar entrada (asigna cupo si es vehicular; una
// visita peatonal no ocupa cupo).
visitasRouter.post("/", async (req, res) => {
  try {
    const {
      patente,
      nombre_visita,
      rut_visita,
      tipo_visita_id_tipovisita,
      tipo_permiso_id_tipopermiso,
      condominio_id_condominio,
      unidad_id_unidad,
      nombre_residente_visitado,
      residente_visitado_usuario_id,
      tipo_ocupante,
      carnet_discapacidad_confirmado,
      residente_usuario_id,
    } = req.body;

    const esOcupanteResidente = tipo_ocupante === "Residente";
    const esPeatonal = Number(tipo_visita_id_tipovisita) === TIPO_VISITA_PEATONAL_ID;

    if (
      !tipo_visita_id_tipovisita ||
      !tipo_permiso_id_tipopermiso ||
      !condominio_id_condominio ||
      (esPeatonal && (!nombre_visita || !rut_visita || !unidad_id_unidad || !nombre_residente_visitado)) ||
      (!esPeatonal && !esOcupanteResidente && (!nombre_visita || !unidad_id_unidad || !nombre_residente_visitado)) ||
      (!esPeatonal && esOcupanteResidente && !residente_usuario_id)
    ) {
      return res.status(400).json({
        error: esPeatonal
          ? "Faltan campos obligatorios para una visita peatonal: nombre_visita, rut_visita, unidad_id_unidad, nombre_residente_visitado (a quién visita)."
          : esOcupanteResidente
          ? "Falta indicar qué residente va a usar el cupo de discapacitados (residente_usuario_id)."
          : "Faltan campos obligatorios: nombre_visita, tipo_visita_id_tipovisita, tipo_permiso_id_tipopermiso, condominio_id_condominio, unidad_id_unidad, nombre_residente_visitado.",
      });
    }

    const resultado = await registrarEntrada(
      {
        patente,
        nombre_visita,
        rut_visita,
        tipo_visita_id_tipovisita: Number(tipo_visita_id_tipovisita),
        tipo_permiso_id_tipopermiso: Number(tipo_permiso_id_tipopermiso),
        condominio_id_condominio: Number(condominio_id_condominio),
        unidad_id_unidad: unidad_id_unidad ? Number(unidad_id_unidad) : undefined,
        nombre_residente_visitado,
        residente_visitado_usuario_id: residente_visitado_usuario_id
          ? Number(residente_visitado_usuario_id)
          : undefined,
        tipo_ocupante: esOcupanteResidente ? "Residente" : "Visita",
        carnet_discapacidad_confirmado: !!carnet_discapacidad_confirmado,
        residente_usuario_id: residente_usuario_id ? Number(residente_usuario_id) : undefined,
      },
      req.guardia!.id_usuario
    );

    // 201 = registrada (con cupo si correspondía); 202 = vehicular
    // registrada pero sin cupo libre en este momento. Una visita peatonal
    // nunca necesita cupo, así que siempre es 201.
    const status = esPeatonal || resultado.cupoAsignado ? 201 : 202;
    res.status(status).json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /visitas/:id/salida -> registrar salida + liberar cupo
visitasRouter.patch("/:id/salida", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const resultado = await registrarSalida(id);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /visitas/activas?condominio_id=1 -> visitas que siguen dentro
visitasRouter.get("/activas", async (req, res) => {
  try {
    const condominioId = Number(req.query.condominio_id);
    if (!condominioId) {
      return res.status(400).json({ error: "Falta el parámetro condominio_id." });
    }
    const visitas = await listarVisitasActivas(condominioId);
    res.json(visitas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
