import { Router } from "express";
import {
  listarTiposEspacioComun,
  listarEspacios,
  getEspacio,
  listarHorariosOcupados,
  crearReserva,
  listarReservasDeUnidad,
  cancelarReserva,
  subirComprobante,
  getReserva,
  listarReservasDelDia,
  marcarLlegada,
  marcarSalida,
} from "../services/reservas.service";
import { guardarImagenBase64 } from "../utils/imagenes";
import { requireRol, requirePerteneceAlCondominio } from "../middleware/auth";

export const reservasRouter = Router();

// Cualquier usuario logeado (Guardia, Administrador o Residente) puede ver
// el catálogo de espacios y su disponibilidad — es información, no una
// acción. El guardia la necesita para orientar a un residente que pregunta
// en portería; el residente, para elegir dónde y cuándo reservar.

reservasRouter.get("/espacios/tipos", async (req, res) => {
  const condominioId = req.guardia!.condominio_id_condominio!;
  res.json(await listarTiposEspacioComun(condominioId));
});

reservasRouter.get("/espacios", async (req, res) => {
  const condominioId = req.guardia!.condominio_id_condominio!;
  res.json(await listarEspacios(condominioId));
});

reservasRouter.get("/espacios/:id", async (req, res) => {
  try {
    res.json(await getEspacio(Number(req.params.id)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

reservasRouter.get("/espacios/:id/disponibilidad", async (req, res) => {
  try {
    const fecha = String(req.query.fecha || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "Falta el parámetro fecha (formato YYYY-MM-DD)." });
    }
    res.json(await listarHorariosOcupados(Number(req.params.id), fecha));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Reservas: crear / listar propias / cancelar / subir comprobante ------
//
// El guardia NO puede reservar (regla de negocio explícita) — por eso este
// bloque usa requireRol("Residente", "Administrador"), que además deja
// pasar a un comité vía la equivalencia esComite -> Administrador
// (calificaParaRol en middleware/auth.ts).
const puedeReservar = requireRol("Residente", "Administrador");

reservasRouter.post("/", puedeReservar, async (req, res) => {
  try {
    const esAdminOComite = req.guardia!.rol === "Administrador" || !!req.guardia!.esComite;
    const { espacio_comun_id_espaciocomun, fecha, hora_inicio, hora_termino } = req.body;
    if (!espacio_comun_id_espaciocomun || !fecha || !hora_inicio || !hora_termino) {
      return res.status(400).json({ error: "Faltan campos: espacio_comun_id_espaciocomun, fecha, hora_inicio, hora_termino." });
    }

    // Un residente (no comité) solo puede reservar para su propio depto, a
    // su propio nombre — se ignora cualquier unidad_id/solicitante que
    // intente mandar, igual que en paquetería/"a quién visita". Admin/
    // comité SÍ deben indicar para qué depto y a nombre de qué residente
    // (regla 4: "a nombre de un residente", ej. por teléfono).
    let unidadId: number;
    let solicitanteUsuarioId: number;
    if (esAdminOComite) {
      const { unidad_id_unidad, solicitante_usuario_id } = req.body;
      if (!unidad_id_unidad || !solicitante_usuario_id) {
        return res.status(400).json({ error: "Como Administrador/Comité debes indicar unidad_id_unidad y solicitante_usuario_id (a nombre de qué residente)." });
      }
      unidadId = Number(unidad_id_unidad);
      solicitanteUsuarioId = Number(solicitante_usuario_id);
    } else {
      if (!req.guardia!.unidad_id_unidad) {
        return res.status(403).json({ error: "Tu usuario no tiene un depto asociado." });
      }
      unidadId = req.guardia!.unidad_id_unidad;
      solicitanteUsuarioId = req.guardia!.id_usuario;
    }

    const reserva = await crearReserva(
      {
        espacioComunId: Number(espacio_comun_id_espaciocomun),
        unidadId,
        fecha: String(fecha),
        horaInicio: String(hora_inicio),
        horaTermino: String(hora_termino),
        solicitanteUsuarioId,
      },
      { id: req.guardia!.id_usuario, esAdminOComite }
    );
    res.status(201).json(reserva);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /reservas/mias -> las reservas del propio depto (residente); un
// comité también puede usarla para ver las de su propio depto, aunque para
// ver/gestionar TODAS las del condominio use /admin/reservas.
reservasRouter.get("/mias", requireRol("Residente"), async (req, res) => {
  try {
    if (!req.guardia!.unidad_id_unidad) {
      return res.status(403).json({ error: "Tu usuario no tiene un depto asociado." });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    res.json(await listarReservasDeUnidad(req.guardia!.unidad_id_unidad, condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

function esDueñoDeLaReserva(reserva: any, req: any): boolean {
  const esAdminOComite = req.guardia.rol === "Administrador" || !!req.guardia.esComite;
  return esAdminOComite || reserva.unidad_id_unidad === req.guardia.unidad_id_unidad;
}

reservasRouter.patch("/:id/cancelar", puedeReservar, requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    const reservaActual: any = await getReserva(Number(req.params.id));
    if (!esDueñoDeLaReserva(reservaActual, req)) {
      return res.status(403).json({ error: "No puedes cancelar una reserva de otro depto." });
    }
    const esAdminOComite = req.guardia!.rol === "Administrador" || !!req.guardia!.esComite;
    res.json(await cancelarReserva(Number(req.params.id), req.guardia!.id_usuario, esAdminOComite));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /reservas/:id/comprobante -> subir el comprobante de transferencia
// (foto/imagen, igual que las de paquetería) una vez que la reserva está
// Aprobada y esperando pago.
reservasRouter.post("/:id/comprobante", puedeReservar, requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    const reservaActual: any = await getReserva(Number(req.params.id));
    if (!esDueñoDeLaReserva(reservaActual, req)) {
      return res.status(403).json({ error: "No puedes subir el comprobante de una reserva de otro depto." });
    }
    const { comprobante } = req.body;
    if (!comprobante) {
      return res.status(400).json({ error: "Falta el comprobante (imagen)." });
    }
    const url = await guardarImagenBase64(comprobante, "comprobante", "reservas");
    res.json(await subirComprobante(Number(req.params.id), url));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Guardia: módulo "Reserva Área Común" ----------------------------------

const soloConserjeria = requireRol("Guardia", "Administrador");

reservasRouter.get("/dia", soloConserjeria, async (req, res) => {
  try {
    const condominioId = req.guardia!.condominio_id_condominio!;
    const fecha = String(req.query.fecha || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "Falta el parámetro fecha (formato YYYY-MM-DD)." });
    }
    res.json(await listarReservasDelDia(condominioId, fecha));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

reservasRouter.patch("/:id/llegada", soloConserjeria, requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    res.json(await marcarLlegada(Number(req.params.id)));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

reservasRouter.patch("/:id/salida", soloConserjeria, requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    res.json(await marcarSalida(Number(req.params.id)));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /reservas/:id -> detalle de una reserva (Residente solo la propia).
reservasRouter.get("/:id", requirePerteneceAlCondominio("reserva_espaciocomun", "id_reserva"), async (req, res) => {
  try {
    const reserva: any = await getReserva(Number(req.params.id));
    if (req.guardia!.rol === "Residente" && !req.guardia!.esComite && reserva.unidad_id_unidad !== req.guardia!.unidad_id_unidad) {
      return res.status(403).json({ error: "No puedes ver una reserva de otro depto." });
    }
    res.json(reserva);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});
