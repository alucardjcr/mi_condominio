import { Router } from "express";
import {
  registrarLlegada,
  cambiarEstado,
  registrarEntrega,
  listarPendientes,
  buscarPaquetes,
  getPaquete,
} from "../services/paquetes.service";
import { requireRol } from "../middleware/auth";

export const paquetesRouter = Router();

// Solo Guardia/Administrador reciben, cambian de estado o entregan
// paquetes. La búsqueda/consulta (más abajo) sí queda abierta a Residente,
// pero acotada a su propio depto.
const soloConserjeria = requireRol("Guardia", "Administrador");

// POST /paquetes -> registrar la llegada de un paquete (foto obligatoria)
paquetesRouter.post("/", soloConserjeria, async (req, res) => {
  try {
    const {
      unidad_id_unidad,
      nombre_receptor,
      residente_receptor_usuario_id,
      rut_receptor,
      tipo_paquete_id_tipopaquete,
      foto_recepcion,
    } = req.body;

    if (!unidad_id_unidad || !nombre_receptor || !foto_recepcion) {
      return res.status(400).json({
        error:
          "Faltan campos obligatorios: unidad_id_unidad, nombre_receptor y foto_recepcion (foto obligatoria al recibir el paquete).",
      });
    }

    const condominioId = req.guardia!.condominio_id_condominio!;
    const resultado = await registrarLlegada(
      {
        unidad_id_unidad: Number(unidad_id_unidad),
        nombre_receptor,
        residente_receptor_usuario_id: residente_receptor_usuario_id ? Number(residente_receptor_usuario_id) : undefined,
        rut_receptor,
        tipo_paquete_id_tipopaquete: tipo_paquete_id_tipopaquete ? Number(tipo_paquete_id_tipopaquete) : undefined,
        foto_recepcion,
        condominio_id_condominio: condominioId,
      },
      req.guardia!.id_usuario
    );

    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /paquetes/pendientes?condominio_id=1 -> lo que hay guardado en portería
paquetesRouter.get("/pendientes", soloConserjeria, async (req, res) => {
  try {
    const condominioId = req.guardia!.condominio_id_condominio!;
    res.json(await listarPendientes(condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /paquetes?fecha_inicio=&fecha_termino=&q=&unidad_id=&estado=&condominio_id=
// -> búsqueda/auditoría. Guardia/Administrador ven todos los deptos (con
// los filtros que manden); un Residente solo ve los suyos — su unidad se
// toma del token, ignorando cualquier unidad_id que mande el cliente, para
// que no pueda mirar los paquetes de otro depto cambiando el parámetro. Un
// Residente que además es del comité (esComite) ve todos los deptos, igual
// que Administrador.
paquetesRouter.get("/", async (req, res) => {
  try {
    const esResidente = req.guardia!.rol === "Residente" && !req.guardia!.esComite;
    if (esResidente && !req.guardia!.unidad_id_unidad) {
      return res.status(403).json({ error: "Tu usuario no tiene un depto asociado." });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    const resultado = await buscarPaquetes({
      condominioId,
      fechaInicio: req.query.fecha_inicio ? String(req.query.fecha_inicio) : undefined,
      fechaTermino: req.query.fecha_termino ? String(req.query.fecha_termino) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      unidadId: esResidente ? req.guardia!.unidad_id_unidad : req.query.unidad_id ? Number(req.query.unidad_id) : undefined,
      estadoGls: req.query.estado ? String(req.query.estado) : undefined,
    });
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /paquetes/:id -> detalle. Un Residente solo puede ver el detalle de un
// paquete de su propio depto (salvo que sea del comité, que ve cualquiera).
paquetesRouter.get("/:id", async (req, res) => {
  try {
    const paquete: any = await getPaquete(Number(req.params.id));
    if (
      req.guardia!.rol === "Residente" &&
      !req.guardia!.esComite &&
      paquete.unidad_id_unidad !== req.guardia!.unidad_id_unidad
    ) {
      return res.status(403).json({ error: "No puedes ver un paquete de otro depto." });
    }
    res.json(paquete);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// PATCH /paquetes/:id/estado -> Notificado | En portería | Rechazado por el
// residente | Devuelto al remitente | Perdido (no la entrega)
paquetesRouter.patch("/:id/estado", soloConserjeria, async (req, res) => {
  try {
    const { nuevo_estado, observacion } = req.body;
    if (!nuevo_estado) return res.status(400).json({ error: "Falta nuevo_estado." });
    const condominioId = req.guardia!.condominio_id_condominio!;
    res.json(await cambiarEstado(Number(req.params.id), nuevo_estado, observacion, condominioId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /paquetes/:id/entrega -> registrar retiro (firma siempre, foto si
// quien retira no es el receptor original)
paquetesRouter.patch("/:id/entrega", soloConserjeria, async (req, res) => {
  try {
    const { entregado_a, firma_retiro, foto_retiro } = req.body;
    if (!entregado_a || !firma_retiro) {
      return res.status(400).json({ error: "Faltan campos: entregado_a y firma_retiro son obligatorios." });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    const resultado = await registrarEntrega(
      Number(req.params.id),
      { entregado_a, firma_retiro, foto_retiro },
      req.guardia!.id_usuario,
      condominioId
    );
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
