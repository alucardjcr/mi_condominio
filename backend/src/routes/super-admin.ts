import { Router } from "express";
import {
  crearAdministrador,
  listarAdministradores,
  actualizarAdministrador,
  listarCondominiosParaSuperAdmin,
  listarCondominiosConFacturacion,
  configurarFacturacion,
  marcarPagado,
} from "../services/superadmin.service";

// Ronda 27: montado en index.ts con requireAuth + requireSuperAdmin — el
// dueño del sistema, no un Administrador de condominio. Ver
// middleware/auth.ts -> requireSuperAdmin (chequeo estricto, sin la
// equivalencia de comité que sí tiene requireAdmin).
export const superAdminRouter = Router();

superAdminRouter.get("/condominios", async (_req, res) => {
  try {
    res.json(await listarCondominiosParaSuperAdmin());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

superAdminRouter.get("/administradores", async (_req, res) => {
  try {
    res.json(await listarAdministradores());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

superAdminRouter.post("/administradores", async (req, res) => {
  try {
    const { nombre_usuario, usuariocol, password, condominio_id_condominio } = req.body;
    if (!nombre_usuario || !usuariocol || !password || !condominio_id_condominio) {
      return res.status(400).json({
        error: "Faltan campos: nombre_usuario, usuariocol, password, condominio_id_condominio.",
      });
    }
    const resultado = await crearAdministrador({
      nombre_usuario,
      usuariocol,
      password,
      condominio_id_condominio: Number(condominio_id_condominio),
    });
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

superAdminRouter.patch("/administradores/:id", async (req, res) => {
  try {
    const { password, flg_vigencia } = req.body;
    const resultado = await actualizarAdministrador(Number(req.params.id), { password, flg_vigencia });
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Facturación ---------------------------------------------------------

superAdminRouter.get("/facturacion", async (_req, res) => {
  try {
    res.json(await listarCondominiosConFacturacion());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

superAdminRouter.put("/facturacion/:condominioId", async (req, res) => {
  try {
    const { monto_mensualidad, dia_limite_pago } = req.body;
    await configurarFacturacion(Number(req.params.condominioId), {
      monto_mensualidad: monto_mensualidad === null || monto_mensualidad === "" ? null : Number(monto_mensualidad),
      dia_limite_pago: dia_limite_pago !== undefined ? Number(dia_limite_pago) : undefined,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

superAdminRouter.post("/facturacion/:condominioId/marcar-pagado", async (req, res) => {
  try {
    const { periodo, monto } = req.body;
    if (!monto) {
      return res.status(400).json({ error: "Falta el monto pagado." });
    }
    await marcarPagado(Number(req.params.condominioId), {
      periodo,
      monto: Number(monto),
      registradoPorUsuarioId: req.guardia!.id_usuario,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
