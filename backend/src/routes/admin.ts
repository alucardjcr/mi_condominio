import { Router } from "express";
import { requirePerteneceAlCondominio } from "../middleware/auth";
import { obtenerDashboardAdmin, obtenerActividadReciente } from "../services/dashboard.service";
import { revocarSesionesDeUsuario } from "../services/auth.service";
import {
  listarGuardias,
  crearGuardia,
  actualizarGuardia,
  listarResidentes,
  crearResidente,
  actualizarResidente,
  activarAccesoResidente,
  revocarAccesoResidente,
  registrarCarnetDiscapacidad,
  quitarCarnetDiscapacidad,
  listarPatentes,
  crearPatente,
  actualizarPatente,
  auditarPatente,
  listarUnidadesGastoComun,
  actualizarGastoComunUnidad,
  listarEstacionamientosAdmin,
  listarEstadosEstacionamiento,
  listarTiposEstacionamiento,
  crearEstacionamientoAdmin,
  actualizarEstacionamientoAdmin,
} from "../services/admin.service";
import { listarSolicitudesArcoAdmin, resolverSolicitudArco } from "../services/arco.service";
import { listarAuditoria } from "../services/auditoria.service";
import { listarPoliticasRetencion, configurarPoliticaRetencion, ejecutarLimpiezaRetencion, convertirADias } from "../services/retencion.service";
import { crearIncidente, listarIncidentes, marcarNotificadoAgencia, marcarNotificadoAfectados, cerrarIncidente } from "../services/incidentes.service";
import {
  listarTiposAmonestacion,
  crearTipoAmonestacion,
  actualizarTipoAmonestacion,
  listarTiposMulta,
  crearTipoMulta,
  actualizarTipoMulta,
  listarAmonestaciones,
  getAmonestacion,
  crearAmonestacion,
  aprobarMulta,
  rechazarMulta,
  notificarMulta,
} from "../services/amonestaciones.service";
import { reporteGastoComun, generarExcelGastoComun } from "../services/reportes.service";
import { crearComunicado } from "../services/notificaciones.service";
import {
  listarTiposPersonal,
  listarPersonal,
  crearPersonal,
  actualizarPersonal,
  asignarTarea,
  listarTareasAsignadas,
  listarTurnosDePersonal,
} from "../services/personal.service";
import {
  listarEspacios,
  getEspacio,
  crearEspacio,
  actualizarEspacio,
  listarReservas,
  aprobarReserva,
  rechazarReserva,
  validarPago,
  resolverGarantia,
} from "../services/reservas.service";
import {
  listarTiposElementoMantencion,
  crearTipoElementoMantencion,
  actualizarTipoElementoMantencion,
  listarMantenciones,
  getMantencion,
  crearMantencion,
  actualizarMantencion,
  cancelarMantencion,
  actualizarDatosFinalesMantencion,
} from "../services/mantencion.service";
import { guardarImagenBase64 } from "../utils/imagenes";
import { CONDOMINIO_ID_DEFAULT } from "../config";

export const adminRouter = Router();

// MySQL reporta una violación de UNIQUE como error ER_DUP_ENTRY (código
// 1062), a diferencia del mensaje "UNIQUE constraint failed" de SQLite —
// este helper deja el mismo mensaje amigable de antes sin importar el motor.
function esDuplicado(err: any): boolean {
  return err?.code === "ER_DUP_ENTRY";
}

// --- Guardias -----------------------------------------------------------

adminRouter.get("/guardias", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarGuardias(condominioId));
});

adminRouter.post("/guardias", async (req, res) => {
  try {
    const { nombre_usuario, usuariocol, password, rut, telefono } = req.body;
    if (!nombre_usuario || !usuariocol || !password) {
      return res.status(400).json({ error: "Faltan campos: nombre_usuario, usuariocol, password." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(await crearGuardia({ nombre_usuario, usuariocol, password, condominio_id_condominio: condominioId, rut, telefono }));
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Ese nombre de usuario ya existe." : err.message });
  }
});

adminRouter.patch("/guardias/:id", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
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

// --- Residentes -----------------------------------------------------------

adminRouter.get("/residentes", async (req, res) => {
  const unidadId = req.query.unidad_id ? Number(req.query.unidad_id) : undefined;
  res.json(await listarResidentes(unidadId));
});

adminRouter.post("/residentes", async (req, res) => {
  try {
    const { nombre_usuario, unidad_id_unidad, tipo_residente_id_tiporesidente, flg_propietario, rut, fecha_nacimiento, profesion } = req.body;
    if (!nombre_usuario || !unidad_id_unidad) {
      return res.status(400).json({ error: "Faltan campos: nombre_usuario, unidad_id_unidad." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(
      await crearResidente({
        nombre_usuario,
        unidad_id_unidad: Number(unidad_id_unidad),
        condominio_id_condominio: condominioId,
        tipo_residente_id_tiporesidente: tipo_residente_id_tiporesidente !== undefined ? Number(tipo_residente_id_tiporesidente) : undefined,
        flg_propietario: flg_propietario !== undefined ? Number(flg_propietario) : undefined,
        // Ronda 36: los 3 son opcionales a propósito — no todo residente
        // los va a tener cargados.
        rut: rut || undefined,
        fecha_nacimiento: fecha_nacimiento || undefined,
        profesion: profesion || undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/residentes/:id", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    const { nombre_usuario, unidad_id_unidad, flg_vigencia, password, flg_comite, tipo_residente_id_tiporesidente, flg_propietario, rut, fecha_nacimiento, profesion } =
      req.body;
    // Nombrar/quitar gente del comité es una potestad exclusiva del
    // Administrador real (rol === "Administrador"), aunque el resto de esta
    // ruta también quede habilitada para un miembro del comité (vía
    // requireAdmin + calificaParaRol) — un comité no puede nombrar a otro
    // comité ni quitarse a sí mismo el permiso.
    if (flg_comite !== undefined && req.guardia?.rol !== "Administrador") {
      return res
        .status(403)
        .json({ error: "Solo el Administrador puede asignar o quitar la condición de comité." });
    }
    // Designar al dueño de un depto (ronda 15), en cambio, SÍ queda
    // habilitado también para el comité — es administración normal de una
    // unidad, no una escalada de permisos sobre todo el condominio como sí
    // lo es el comité.
    res.json(
      await actualizarResidente(Number(req.params.id), {
        nombre_usuario,
        unidad_id_unidad: unidad_id_unidad !== undefined ? Number(unidad_id_unidad) : undefined,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
        password,
        flg_comite: flg_comite !== undefined ? Number(flg_comite) : undefined,
        tipo_residente_id_tiporesidente:
          tipo_residente_id_tiporesidente !== undefined
            ? tipo_residente_id_tiporesidente === null
              ? null
              : Number(tipo_residente_id_tiporesidente)
            : undefined,
        flg_propietario: flg_propietario !== undefined ? Number(flg_propietario) : undefined,
        // Ronda 36: 'rut'/'fecha_nacimiento'/'profesion' en 'in req.body'
        // porque pueden venir como null explícito (borrar el dato) — con
        // !== undefined se perdería ese caso, igual que ya se cuida en
        // /admin/estacionamientos/:id.
        rut: "rut" in req.body ? rut : undefined,
        fecha_nacimiento: "fecha_nacimiento" in req.body ? fecha_nacimiento : undefined,
        profesion: "profesion" in req.body ? profesion : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Acceso a la app (login) para residentes -------------------------------

// Ronda 37, a pedido explícito del usuario: ya no se le pide al
// administrador escribir un usuario/clave — el sistema genera un usuario
// temporal ("<siglas>_residente_<depto>") y una clave aleatoria de un solo
// uso (ver activarAccesoResidente en admin.service.ts), que quedan en la
// respuesta UNA sola vez para que el administrador se los pase al
// residente. La primera vez que entre, la app lo va a obligar a elegir su
// usuario/clave definitivos. `usuariocol` en el body es opcional, por si
// el administrador igual quiere fijar uno a mano.
adminRouter.post("/residentes/:id/acceso", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    const { usuariocol } = req.body;
    res.status(201).json(await activarAccesoResidente(Number(req.params.id), { usuariocol }));
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Ese nombre de usuario ya existe." : err.message });
  }
});

adminRouter.delete("/residentes/:id/acceso", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  await revocarAccesoResidente(Number(req.params.id));
  res.status(204).send();
});

adminRouter.post("/residentes/:id/discapacidad", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    const id = await registrarCarnetDiscapacidad(Number(req.params.id), req.body.numero_carnet);
    res.status(201).json({ id_residentediscapacitado: id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.delete("/residentes/:id/discapacidad", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  await quitarCarnetDiscapacidad(Number(req.params.id));
  res.status(204).send();
});

// --- Patentes de residentes -----------------------------------------------

adminRouter.get("/patentes", async (req, res) => {
  const unidadId = req.query.unidad_id ? Number(req.query.unidad_id) : undefined;
  res.json(await listarPatentes(unidadId));
});

adminRouter.post("/patentes", async (req, res) => {
  try {
    const { patente, tipo_tenencia_id_tipotenencia, unidad_id_unidad } = req.body;
    if (!patente || !tipo_tenencia_id_tipotenencia || !unidad_id_unidad) {
      return res.status(400).json({ error: "Faltan campos: patente, tipo_tenencia_id_tipotenencia, unidad_id_unidad." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(
      await crearPatente({
        patente,
        tipo_tenencia_id_tipotenencia: Number(tipo_tenencia_id_tipotenencia),
        unidad_id_unidad: Number(unidad_id_unidad),
        condominio_id_condominio: condominioId,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Esa patente ya está registrada." : err.message });
  }
});

adminRouter.patch("/patentes/:id", requirePerteneceAlCondominio("patente_condominio", "id_patente"), async (req, res) => {
  try {
    const { patente, tipo_tenencia_id_tipotenencia, flg_vigencia } = req.body;
    res.json(
      await actualizarPatente(Number(req.params.id), {
        patente,
        tipo_tenencia_id_tipotenencia:
          tipo_tenencia_id_tipotenencia !== undefined ? Number(tipo_tenencia_id_tipotenencia) : undefined,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Auditoría --------------------------------------------------------------

adminRouter.get("/auditoria/patente/:patente", async (req, res) => {
  res.json(await auditarPatente(req.params.patente));
});

// --- Reporte de gasto común -------------------------------------------------

adminRouter.get("/reportes/gasto-comun", async (req, res) => {
  try {
    const { fecha_inicio, fecha_termino } = req.query;
    if (!fecha_inicio || !fecha_termino) {
      return res.status(400).json({ error: "Faltan fecha_inicio y fecha_termino (formato YYYY-MM-DD)." });
    }
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    res.json(
      await reporteGastoComun({
        condominioId,
        fechaInicio: String(fecha_inicio),
        fechaTermino: String(fecha_termino),
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Exportación a Excel del reporte de gasto común, pensada para subirse en
// ComunidadFeliz (Cobranza y recaudación → Cargos → Importar desde Excel) —
// ver el comentario en reportes.service.ts, generarExcelGastoComun().
adminRouter.get("/reportes/gasto-comun/excel", async (req, res) => {
  try {
    const { fecha_inicio, fecha_termino } = req.query;
    if (!fecha_inicio || !fecha_termino) {
      return res.status(400).json({ error: "Faltan fecha_inicio y fecha_termino (formato YYYY-MM-DD)." });
    }
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    const buffer = await generarExcelGastoComun({
      condominioId,
      fechaInicio: String(fecha_inicio),
      fechaTermino: String(fecha_termino),
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="gasto-comun-${fecha_inicio}-a-${fecha_termino}.xlsx"`
    );
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Espacios comunes: configuración (Administrador/Comité) ----------------
// Regla 7: días/horarios, minutos de aseo, anticipación máxima, tarifa,
// garantía y tarifa de atraso los define administrador y comité, mismos
// permisos (ya cubierto por requireAdmin + calificaParaRol sobre todo este
// router — ver index.ts).

adminRouter.get("/espacios", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarEspacios(condominioId, true));
});

adminRouter.post("/espacios", async (req, res) => {
  try {
    const { nombre, tipo_espaciocomun_id_tipoespaciocomun, flg_reservable, flg_gratuito } = req.body;
    if (!nombre || !tipo_espaciocomun_id_tipoespaciocomun) {
      return res.status(400).json({ error: "Faltan campos: nombre, tipo_espaciocomun_id_tipoespaciocomun." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const espacio = await crearEspacio({
      nombre,
      tipo_espaciocomun_id_tipoespaciocomun: Number(tipo_espaciocomun_id_tipoespaciocomun),
      condominio_id_condominio: condominioId,
      capacidad: req.body.capacidad !== undefined ? Number(req.body.capacidad) : null,
      flg_reservable: flg_reservable !== undefined ? Number(flg_reservable) : 1,
      flg_gratuito: flg_gratuito !== undefined ? Number(flg_gratuito) : 1,
      precio_bloque: req.body.precio_bloque !== undefined ? Number(req.body.precio_bloque) : undefined,
      bloque_horas: req.body.bloque_horas !== undefined ? Number(req.body.bloque_horas) : undefined,
      monto_garantia: req.body.monto_garantia !== undefined ? Number(req.body.monto_garantia) : undefined,
      tarifa_atraso_minuto: req.body.tarifa_atraso_minuto !== undefined ? Number(req.body.tarifa_atraso_minuto) : undefined,
      hora_apertura: req.body.hora_apertura,
      hora_cierre: req.body.hora_cierre,
      dias_disponibles: req.body.dias_disponibles ?? null,
      minutos_separacion: req.body.minutos_separacion !== undefined ? Number(req.body.minutos_separacion) : undefined,
      dias_max_anticipacion: req.body.dias_max_anticipacion !== undefined ? Number(req.body.dias_max_anticipacion) : undefined,
      dias_min_cancelacion_residente:
        req.body.dias_min_cancelacion_residente !== undefined ? Number(req.body.dias_min_cancelacion_residente) : undefined,
      mes_dia_inicio_temporada: req.body.mes_dia_inicio_temporada ?? null,
      mes_dia_termino_temporada: req.body.mes_dia_termino_temporada ?? null,
    });
    res.status(201).json(espacio);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/espacios/:id", requirePerteneceAlCondominio("espacio_comun", "id_espaciocomun"), async (req, res) => {
  try {
    const CAMPOS = [
      "nombre",
      "tipo_espaciocomun_id_tipoespaciocomun",
      "capacidad",
      "flg_reservable",
      "flg_gratuito",
      "precio_bloque",
      "bloque_horas",
      "monto_garantia",
      "tarifa_atraso_minuto",
      "hora_apertura",
      "hora_cierre",
      "dias_disponibles",
      "minutos_separacion",
      "dias_max_anticipacion",
      "dias_min_cancelacion_residente",
      "mes_dia_inicio_temporada",
      "mes_dia_termino_temporada",
      "flg_vigencia",
    ] as const;
    const input: Record<string, any> = {};
    for (const campo of CAMPOS) {
      if (req.body[campo] !== undefined) input[campo] = req.body[campo];
    }
    res.json(await actualizarEspacio(Number(req.params.id), input));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get("/espacios/:id", async (req, res) => {
  try {
    res.json(await getEspacio(Number(req.params.id)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// --- Reservas de Espacios Comunes: aprobación, pago y garantía -------------

adminRouter.get("/reservas", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(
    await listarReservas(condominioId, {
      estado: req.query.estado ? String(req.query.estado) : undefined,
      espacioId: req.query.espacio_id ? Number(req.query.espacio_id) : undefined,
      fechaInicio: req.query.fecha_inicio ? String(req.query.fecha_inicio) : undefined,
      fechaTermino: req.query.fecha_termino ? String(req.query.fecha_termino) : undefined,
    })
  );
});

adminRouter.patch("/reservas/:id/aprobar", requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    res.json(await aprobarReserva(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/reservas/:id/rechazar", requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    const { motivo } = req.body;
    res.json(await rechazarReserva(Number(req.params.id), motivo, req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/reservas/:id/validar-pago", requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    res.json(await validarPago(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Comunicados (ronda 16) -------------------------------------------------
// A pedido del usuario: "el administrador o el comité podrá emitir un
// comunicado y debería llegarles a todos como notificación". Ya está
// habilitado para comité porque todo este router pasa por requireAdmin
// (que acepta comité vía calificaParaRol — ver index.ts/middleware/auth.ts).

adminRouter.post("/comunicados", async (req, res) => {
  try {
    const { titulo, cuerpo } = req.body;
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const resultado = await crearComunicado({
      titulo,
      cuerpo,
      condominioId,
      creadoPorUsuarioId: req.guardia!.id_usuario,
    });
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Gasto común por depto (ronda 17) — abierto a Administrador y Comité, no
// solo Administrador: administrar la deuda de un depto puntual se consideró
// administración rutinaria a nivel de depto (mismo criterio ya usado para
// flg_propietario en la ronda 15), no una escalada de poder sobre todo el
// sistema.
adminRouter.get("/unidades/gasto-comun", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarUnidadesGastoComun(condominioId));
});

adminRouter.patch("/unidades/:id/gasto-comun", requirePerteneceAlCondominio("unidad", "id_unidad"), async (req, res) => {
  try {
    const { flg_gastocomun } = req.body;
    if (flg_gastocomun !== 0 && flg_gastocomun !== 1) {
      return res.status(400).json({ error: "flg_gastocomun debe ser 0 o 1." });
    }
    res.json(await actualizarGastoComunUnidad(Number(req.params.id), flg_gastocomun));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 28, a pedido explícito del usuario: administrar el estado de cada
// estacionamiento (ej. marcar el cupo 84 como "Fuera de servicio" porque
// quedó mal hecho y nadie lo puede usar). Ver la nota completa en
// admin.service.ts -> listarEstacionamientosAdmin.
adminRouter.get("/estacionamientos", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarEstacionamientosAdmin(condominioId));
});

adminRouter.get("/estacionamientos/estados", async (_req, res) => {
  res.json(await listarEstadosEstacionamiento());
});

adminRouter.get("/estacionamientos/tipos", async (_req, res) => {
  res.json(await listarTiposEstacionamiento());
});

adminRouter.post("/estacionamientos", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const { numero_estacionamiento, ubicacion, tipo_estacionamiento_id_tipoestacionamiento, unidad_id_unidad } = req.body;
    if (!numero_estacionamiento || !tipo_estacionamiento_id_tipoestacionamiento) {
      return res.status(400).json({ error: "Faltan campos: numero_estacionamiento, tipo_estacionamiento_id_tipoestacionamiento." });
    }
    res.status(201).json(
      await crearEstacionamientoAdmin(condominioId, {
        numero_estacionamiento,
        ubicacion,
        tipo_estacionamiento_id_tipoestacionamiento: Number(tipo_estacionamiento_id_tipoestacionamiento),
        // Ronda 29: opcional a propósito — un cupo puede crearse sin depto
        // asignado (ver la nota completa en admin.service.ts).
        unidad_id_unidad: unidad_id_unidad ? Number(unidad_id_unidad) : null,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/estacionamientos/:id", requirePerteneceAlCondominio("estacionamiento", "id_estacionamiento"), async (req, res) => {
  try {
    const { estado_id, unidad_id_unidad, patente, flg_arrendado, tipo_ocupante } = req.body;
    const input: {
      estado_id?: number;
      unidad_id_unidad?: number | null;
      patente?: string | null;
      flg_arrendado?: number;
      tipo_ocupante?: string | null;
    } = {};
    if (estado_id !== undefined) input.estado_id = Number(estado_id);
    // "unidad_id_unidad"/"patente"/"tipo_ocupante" pueden venir como null
    // explícito (desasignar depto / borrar patente / borrar tipo de
    // ocupante) — por eso se chequea con 'in' en vez de !== undefined.
    if ("unidad_id_unidad" in req.body) {
      input.unidad_id_unidad = unidad_id_unidad === null || unidad_id_unidad === "" ? null : Number(unidad_id_unidad);
    }
    if ("patente" in req.body) {
      input.patente = patente === null || patente === "" ? null : String(patente).trim();
    }
    if (flg_arrendado !== undefined) input.flg_arrendado = flg_arrendado ? 1 : 0;
    if ("tipo_ocupante" in req.body) {
      input.tipo_ocupante = tipo_ocupante === null || tipo_ocupante === "" ? null : String(tipo_ocupante);
    }
    res.json(await actualizarEstacionamientoAdmin(Number(req.params.id), input));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Personal externo (ronda 18) ---------------------------------------
// Aseo, jardinería, mantención, etc. — abierto a Administrador y Comité
// (mismo criterio que guardias/residentes: administración rutinaria, no una
// escalada de permisos). Login propio: se crea con usuariocol/password
// desde el día uno, igual que un Guardia (no "activar acceso" aparte).

adminRouter.get("/personal/tipos", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarTiposPersonal(condominioId));
});

adminRouter.get("/personal", async (_req, res) => {
  res.json(await listarPersonal());
});

adminRouter.post("/personal", async (req, res) => {
  try {
    const { nombre_usuario, usuariocol, password, tipo_personal_id_tipopersonal } = req.body;
    if (!nombre_usuario || !usuariocol || !password) {
      return res.status(400).json({ error: "Faltan campos: nombre_usuario, usuariocol, password." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(
      await crearPersonal({
        nombre_usuario,
        usuariocol,
        password,
        condominio_id_condominio: condominioId,
        tipo_personal_id_tipopersonal: tipo_personal_id_tipopersonal !== undefined ? Number(tipo_personal_id_tipopersonal) : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: esDuplicado(err) ? "Ese nombre de usuario ya existe." : err.message });
  }
});

adminRouter.patch("/personal/:id", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    const { nombre_usuario, password, flg_vigencia, tipo_personal_id_tipopersonal } = req.body;
    res.json(
      await actualizarPersonal(Number(req.params.id), {
        nombre_usuario,
        password,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
        tipo_personal_id_tipopersonal:
          tipo_personal_id_tipopersonal !== undefined
            ? tipo_personal_id_tipopersonal === null
              ? null
              : Number(tipo_personal_id_tipopersonal)
            : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Tarea puntual (texto libre) que administrador/comité le escribe a un
// trabajador — le llega como notificación (bandeja + push best-effort), no
// es una plantilla de checklist (decisión explícita del usuario).
adminRouter.post("/personal/:id/tarea", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    const { descripcion } = req.body;
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(
      await asignarTarea({
        usuarioId: Number(req.params.id),
        descripcion,
        creadoPorUsuarioId: req.guardia!.id_usuario,
        condominioId,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Historial de cumplimiento — solo Administrador/Comité (decisión explícita
// del usuario), de un trabajador puntual o de todos.
adminRouter.get("/personal/tareas", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  const usuarioId = req.query.usuario_id ? Number(req.query.usuario_id) : undefined;
  res.json(await listarTareasAsignadas({ condominioId, usuarioId }));
});

// Historial de turnos de un trabajador puntual — así se sabe en qué fecha y
// horario estuvo en el condominio (pedido explícito del usuario).
adminRouter.get("/personal/:id/turnos", async (req, res) => {
  res.json(await listarTurnosDePersonal(Number(req.params.id)));
});

// --- Mantenciones (ronda 19) -------------------------------------------
// Limpieza de techo, piscina, ascensores, etc. — trabajo de una empresa
// externa SIN cuenta en el sistema. Abierto a Administrador y Comité
// (mismo criterio que el resto de la administración rutinaria de este
// router). El guardia opera el día a día (marcar ingreso/salida de la
// empresa) desde /mantenciones — ver routes/mantenciones.ts.

adminRouter.get("/elementos-mantencion", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  const incluirInactivos = req.query.incluir_inactivos === "1";
  res.json(await listarTiposElementoMantencion(condominioId, incluirInactivos));
});

adminRouter.post("/elementos-mantencion", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.status(201).json(await crearTipoElementoMantencion(condominioId, req.body.gls_tipoelementomantencion));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/elementos-mantencion/:id", requirePerteneceAlCondominio("tipo_elemento_mantencion", "id_tipoelementomantencion"), async (req, res) => {
  try {
    const { gls_tipoelementomantencion, flg_vigencia } = req.body;
    res.json(
      await actualizarTipoElementoMantencion(Number(req.params.id), {
        gls_tipoelementomantencion,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get("/mantenciones", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(
    await listarMantenciones(condominioId, {
      estado: req.query.estado ? String(req.query.estado) : undefined,
      tipoElementoId: req.query.tipo_elemento_id ? Number(req.query.tipo_elemento_id) : undefined,
      fechaInicio: req.query.fecha_inicio ? String(req.query.fecha_inicio) : undefined,
      fechaTermino: req.query.fecha_termino ? String(req.query.fecha_termino) : undefined,
    })
  );
});

adminRouter.get("/mantenciones/:id", async (req, res) => {
  try {
    res.json(await getMantencion(Number(req.params.id)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

adminRouter.post("/mantenciones", async (req, res) => {
  try {
    const { titulo, descripcion, tipo_elemento_mantencion_id_tipoelementomantencion, fecha_programada, costo_estimado } = req.body;
    if (!titulo || !descripcion || !tipo_elemento_mantencion_id_tipoelementomantencion || !fecha_programada) {
      return res.status(400).json({
        error: "Faltan campos: titulo, descripcion, tipo_elemento_mantencion_id_tipoelementomantencion, fecha_programada.",
      });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const mantencion = await crearMantencion(
      {
        titulo,
        descripcion,
        tipoElementoMantencionId: Number(tipo_elemento_mantencion_id_tipoelementomantencion),
        condominioId,
        fechaProgramada: String(fecha_programada),
        costoEstimado: costo_estimado !== undefined && costo_estimado !== null && costo_estimado !== "" ? Number(costo_estimado) : null,
      },
      req.guardia!.id_usuario
    );
    res.status(201).json(mantencion);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/mantenciones/:id", requirePerteneceAlCondominio("mantencion", "id_mantencion"), async (req, res) => {
  try {
    const CAMPOS = ["titulo", "descripcion", "tipo_elemento_mantencion_id_tipoelementomantencion", "fecha_programada", "costo_estimado"] as const;
    const input: Record<string, any> = {};
    for (const campo of CAMPOS) {
      if (req.body[campo] !== undefined) input[campo] = req.body[campo];
    }
    res.json(await actualizarMantencion(Number(req.params.id), input));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/mantenciones/:id/cancelar", requirePerteneceAlCondominio("mantencion", "id_mantencion"), async (req, res) => {
  try {
    const { motivo } = req.body;
    res.json(await cancelarMantencion(Number(req.params.id), motivo, req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Comprobante/factura + foto del resultado + costo real — los sube
// Administrador/Comité después, al recibirlos de la empresa (nunca el
// guardia). `comprobante`/`foto` llegan como data URL base64, igual que las
// fotos de paquetería y el comprobante de Reservas.
adminRouter.post("/mantenciones/:id/comprobante", requirePerteneceAlCondominio("mantencion", "id_mantencion"), async (req, res) => {
  try {
    const { comprobante, foto, costo_real } = req.body;
    const comprobanteUrl = comprobante ? await guardarImagenBase64(comprobante, "comprobante", "mantenciones") : undefined;
    const fotoUrl = foto ? await guardarImagenBase64(foto, "foto", "mantenciones") : undefined;
    res.json(
      await actualizarDatosFinalesMantencion(Number(req.params.id), {
        costoReal: costo_real !== undefined && costo_real !== null && costo_real !== "" ? Number(costo_real) : undefined,
        comprobanteUrl,
        fotoResultadoUrl: fotoUrl,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/reservas/:id/garantia", requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    const { decision, monto_retenido, observacion } = req.body;
    if (decision !== "Devuelta" && decision !== "Retenida") {
      return res.status(400).json({ error: "decision debe ser 'Devuelta' o 'Retenida'." });
    }
    res.json(
      await resolverGarantia(Number(req.params.id), decision, monto_retenido !== undefined ? Number(monto_retenido) : undefined, observacion)
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 32, Ley 21.719: solicitudes de derechos ARCO (Rectificación/
// Cancelación/Oposición) que un residente/guardia/personal mandó — acá las
// revisa Administrador/Comité. Ver arco.service.ts para el porqué del
// diseño (Acceso/Portabilidad son autoservicio instantáneo, no pasan por
// acá — ver routes/privacidad.ts).
adminRouter.get("/privacidad/solicitudes", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarSolicitudesArcoAdmin(condominioId));
});

adminRouter.patch("/privacidad/solicitudes/:id", requirePerteneceAlCondominio("solicitud_arco", "id_solicitudarco"), async (req, res) => {
  try {
    const { estado, respuesta_admin } = req.body;
    res.json(
      await resolverSolicitudArco(Number(req.params.id), {
        estado,
        respuesta_admin,
        resueltoPorUsuarioId: req.guardia!.id_usuario,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 33, Ley 21.719: consulta del registro de auditoría — la evidencia
// operativa que la ley exige poder mostrarle a la Agencia de Protección de
// Datos ante una fiscalización. Filtros opcionales por usuario, acción
// (GET/POST/PATCH/PUT/DELETE), rango de fechas, y texto libre.
adminRouter.get("/auditoria", async (req, res) => {
  try {
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    const { usuario_id, accion, desde, hasta, q } = req.query;
    res.json(
      await listarAuditoria(condominioId, {
        usuarioId: usuario_id ? Number(usuario_id) : undefined,
        accion: accion ? String(accion) : undefined,
        desde: desde ? String(desde) : undefined,
        hasta: hasta ? String(hasta) : undefined,
        q: q ? String(q) : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 34, Ley 21.719: retención de datos — configurar cuántos días se
// guarda cada categoría operativa, y disparar la limpieza (ver la nota
// completa en retencion.service.ts).
adminRouter.get("/retencion", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarPoliticasRetencion(condominioId));
});

adminRouter.put("/retencion/:categoria", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const { cantidad, unidad, dias_retencion } = req.body;
    // Ronda 35: la app ya manda {cantidad, unidad} (días/semanas/años) —
    // se deja también dias_retencion como respaldo por si algún cliente
    // viejo todavía lo manda así.
    let dias: number | null;
    if (cantidad === null || cantidad === "" || cantidad === undefined) {
      dias = null;
    } else if (unidad) {
      dias = convertirADias(Number(cantidad), unidad);
    } else {
      dias = dias_retencion === null || dias_retencion === "" ? null : Number(dias_retencion);
    }
    await configurarPoliticaRetencion(condominioId, req.params.categoria as any, dias);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post("/retencion/ejecutar", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    res.json(await ejecutarLimpiezaRetencion(condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 34, Ley 21.719: notificación de brechas de seguridad — plazo de 72
// horas desde la detección para avisar a la Agencia de Protección de
// Datos. Ver incidentes.service.ts.
adminRouter.get("/incidentes", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarIncidentes(condominioId));
});

adminRouter.post("/incidentes", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const { fecha_deteccion, descripcion, datos_afectados, personas_afectadas_estimado, acciones_tomadas } = req.body;
    res.status(201).json(
      await crearIncidente(condominioId, req.guardia!.id_usuario, {
        fecha_deteccion,
        descripcion,
        datos_afectados,
        personas_afectadas_estimado: personas_afectadas_estimado ? Number(personas_afectadas_estimado) : null,
        acciones_tomadas,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post("/incidentes/:id/notificar-agencia", requirePerteneceAlCondominio("incidente_seguridad", "id_incidenteseguridad"), async (req, res) => {
  res.json(await marcarNotificadoAgencia(Number(req.params.id)));
});

adminRouter.post("/incidentes/:id/notificar-afectados", requirePerteneceAlCondominio("incidente_seguridad", "id_incidenteseguridad"), async (req, res) => {
  res.json(await marcarNotificadoAfectados(Number(req.params.id)));
});

adminRouter.post("/incidentes/:id/cerrar", requirePerteneceAlCondominio("incidente_seguridad", "id_incidenteseguridad"), async (req, res) => {
  try {
    const { acciones_tomadas } = req.body;
    res.json(await cerrarIncidente(Number(req.params.id), acciones_tomadas));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Amonestaciones y multas (ronda 41), a pedido explícito del usuario. Todo
// este bloque ya está detrás de requireAdmin (Administrador o Comité) por
// el montaje del router en index.ts — igual que el resto de /admin/*. La
// ÚNICA restricción adicional (exclusiva del Administrador, ni siquiera el
// Comité) es notificar una multa ya aprobada, chequeada a mano en esa ruta.
// ---------------------------------------------------------------------------

adminRouter.get("/tipos-amonestacion", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarTiposAmonestacion(condominioId, req.query.incluir_inactivos === "true"));
});

adminRouter.post("/tipos-amonestacion", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const { gls_tipoamonestacion, flg_es_multa } = req.body;
    res.status(201).json(await crearTipoAmonestacion(condominioId, { gls_tipoamonestacion, flg_es_multa: flg_es_multa ? 1 : 0 }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/tipos-amonestacion/:id", requirePerteneceAlCondominio("tipo_amonestacion", "id_tipoamonestacion"), async (req, res) => {
  try {
    const { gls_tipoamonestacion, flg_es_multa, flg_vigencia } = req.body;
    res.json(
      await actualizarTipoAmonestacion(Number(req.params.id), {
        gls_tipoamonestacion,
        flg_es_multa: flg_es_multa !== undefined ? (flg_es_multa ? 1 : 0) : undefined,
        flg_vigencia,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get("/tipos-multa", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarTiposMulta(condominioId, req.query.incluir_inactivos === "true"));
});

adminRouter.post("/tipos-multa", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const { gls_tipomulta, monto_sugerido, unidad_monto } = req.body;
    res.status(201).json(
      await crearTipoMulta(condominioId, {
        gls_tipomulta,
        monto_sugerido: monto_sugerido !== undefined ? Number(monto_sugerido) : undefined,
        unidad_monto,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch("/tipos-multa/:id", requirePerteneceAlCondominio("tipo_multa", "id_tipomulta"), async (req, res) => {
  try {
    const { gls_tipomulta, monto_sugerido, unidad_monto, flg_vigencia } = req.body;
    res.json(
      await actualizarTipoMulta(Number(req.params.id), {
        gls_tipomulta,
        monto_sugerido: monto_sugerido !== undefined ? (monto_sugerido === null ? null : Number(monto_sugerido)) : undefined,
        unidad_monto,
        flg_vigencia,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get("/amonestaciones", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(
    await listarAmonestaciones(condominioId, {
      estado: req.query.estado ? String(req.query.estado) : undefined,
      unidadId: req.query.unidad_id ? Number(req.query.unidad_id) : undefined,
    })
  );
});

adminRouter.get("/amonestaciones/:id", async (req, res) => {
  try {
    res.json(await getAmonestacion(Number(req.params.id)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Cualquiera de Administrador o Comité puede crear — si el tipo elegido
// implica multa, queda pendiente de aprobación; si no, se envía y notifica
// sola en el acto (ver amonestaciones.service.ts -> crearAmonestacion).
adminRouter.post("/amonestaciones", async (req, res) => {
  try {
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const { unidad_id_unidad, tipo_amonestacion_id_tipoamonestacion, descripcion, fecha_hecho, tipo_multa_id_tipomulta, monto, unidad_monto } =
      req.body;
    if (!unidad_id_unidad || !tipo_amonestacion_id_tipoamonestacion) {
      return res.status(400).json({ error: "Faltan campos: unidad_id_unidad, tipo_amonestacion_id_tipoamonestacion." });
    }
    const resultado = await crearAmonestacion(
      {
        condominioId,
        unidadId: Number(unidad_id_unidad),
        tipoAmonestacionId: Number(tipo_amonestacion_id_tipoamonestacion),
        descripcion,
        fechaHecho: fecha_hecho,
        tipoMultaId: tipo_multa_id_tipomulta ? Number(tipo_multa_id_tipomulta) : undefined,
        monto: monto !== undefined ? Number(monto) : undefined,
        unidadMonto: unidad_monto,
      },
      req.guardia!.id_usuario
    );
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Aprobar/rechazar: Comité o Administrador (regla explícita del usuario —
// "el comité aprueba las multas"; se deja también al Administrador porque
// en el resto del sistema siempre tiene autoridad al menos igual que el
// comité, y un condominio chico podría no tener comité activo todavía).
adminRouter.post("/amonestaciones/:id/aprobar", requirePerteneceAlCondominio("amonestacion", "id_amonestacion"), async (req, res) => {
  try {
    res.json(await aprobarMulta(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post("/amonestaciones/:id/rechazar", requirePerteneceAlCondominio("amonestacion", "id_amonestacion"), async (req, res) => {
  try {
    const { motivo } = req.body;
    res.json(await rechazarMulta(Number(req.params.id), req.guardia!.id_usuario, motivo));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Notificar: EXCLUSIVO del Administrador real — regla explícita del
// usuario: "es el administrador quien le envía la notificación al
// residente de una multa". Un miembro del comité, aunque haya sido quien
// la aprobó, no puede completar este paso.
adminRouter.post("/amonestaciones/:id/notificar", requirePerteneceAlCondominio("amonestacion", "id_amonestacion"), async (req, res) => {
  if (req.guardia?.rol !== "Administrador") {
    return res.status(403).json({ error: "Solo el Administrador puede notificar una multa al residente." });
  }
  try {
    res.json(await notificarMulta(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 44, a pedido explícito del usuario (revisión de seguridad — "sin
// revocación de sesión"): permite forzar el cierre de cualquier sesión ya
// abierta de un usuario del condominio — caso de uso real: un celular con
// la app logeada se pierde o se lo roban, y hay que "cortar" el acceso sin
// esperar a que el token expire solo (hasta 30 días para Residente/
// Administrador). requirePerteneceAlCondominio evita que se pueda cerrar
// la sesión de alguien de OTRO condominio.
adminRouter.post("/usuarios/:id/cerrar-sesion", requirePerteneceAlCondominio("usuario", "id_usuario"), async (req, res) => {
  try {
    await revocarSesionesDeUsuario(Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 47, a pedido explícito del usuario: dashboard real del Home de
// Administrador — ver la nota completa en dashboard.service.ts sobre qué
// datos son reales y cómo se adaptaron los conceptos de la referencia
// visual que no tienen un campo 1 a 1 en el modelo actual.
adminRouter.get("/dashboard", async (req, res) => {
  try {
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    res.json(await obtenerDashboardAdmin(condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get("/dashboard/actividad-reciente", async (req, res) => {
  try {
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    res.json(await obtenerActividadReciente(condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
