import { Router } from "express";
import { listarNotificacionesDeUsuario, marcarNotificacionLeida } from "../services/notificaciones.service";

export const notificacionesRouter = Router();

// Bandeja propia (ronda 16): cualquier usuario logeado puede tener
// notificaciones (Guardia/Administrador/Residente), aunque en la práctica
// hoy solo los Residentes reciben paquetes/visitas/comunicados.

// GET /notificaciones -> las propias, más recientes primero
notificacionesRouter.get("/", async (req, res) => {
  res.json(await listarNotificacionesDeUsuario(req.guardia!.id_usuario));
});

// PATCH /notificaciones/:id/leido -> marca UNA como leída (nunca la de otro
// usuario — se revalida server-side, ver el servicio).
notificacionesRouter.patch("/:id/leido", async (req, res) => {
  try {
    res.json(await marcarNotificacionLeida(Number(req.params.id), req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
