import { Router } from "express";
import {
  listarTorres,
  listarUnidadesPorTorre,
  listarResidentesPorUnidad,
  listarTiposPermiso,
  listarTiposTenenciaPatente,
  listarResidentesConCarnetDiscapacidad,
  listarTiposPaquete,
  listarTiposResidente,
} from "../services/catalogos.service";
import { CONDOMINIO_ID_DEFAULT } from "../config";

export const catalogosRouter = Router();

catalogosRouter.get("/torres", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarTorres(condominioId));
});

catalogosRouter.get("/torres/:id/unidades", async (req, res) => {
  res.json(await listarUnidadesPorTorre(Number(req.params.id)));
});

catalogosRouter.get("/unidades/:id/residentes", async (req, res) => {
  res.json(await listarResidentesPorUnidad(Number(req.params.id)));
});

catalogosRouter.get("/tipos-permiso", async (_req, res) => {
  res.json(await listarTiposPermiso());
});

catalogosRouter.get("/tipos-tenencia-patente", async (_req, res) => {
  res.json(await listarTiposTenenciaPatente());
});

catalogosRouter.get("/residentes-discapacitados", async (req, res) => {
  res.json(await listarResidentesConCarnetDiscapacidad(req.guardia!.condominio_id_condominio!));
});

catalogosRouter.get("/tipos-paquete", async (req, res) => {
  const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
  res.json(await listarTiposPaquete(condominioId));
});

catalogosRouter.get("/tipos-residente", async (_req, res) => {
  res.json(await listarTiposResidente());
});
