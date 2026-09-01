import { Router } from "express";
import { login, cambiarPassword } from "../services/auth.service";
import { registrarPushToken } from "../services/notificaciones.service";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const { usuariocol, password } = req.body;
    if (!usuariocol || !password) {
      return res.status(400).json({ error: "Falta usuario o contraseña." });
    }
    const resultado = await login(usuariocol, password);
    res.json(resultado);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// POST /auth/cambiar-password -> el propio usuario logeado (Guardia,
// Administrador o Residente) cambia su contraseña. Útil sobre todo para que
// un residente reemplace la contraseña inicial que le dio el administrador.
authRouter.post("/cambiar-password", requireAuth, async (req, res) => {
  try {
    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: "Faltan campos: password_actual, password_nueva." });
    }
    await cambiarPassword(req.guardia!.id_usuario, password_actual, password_nueva);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/push-token -> el propio usuario logeado registra el token de
// push de Expo de su teléfono (ronda 16 — ver expo-notifications en la
// app). Se sobreescribe en cada registro; un usuario, un token a la vez en
// este MVP. Necesita una development build para funcionar de verdad en
// Expo Go desde el SDK 53 (ver "Supuestos" en el README) — igual se guarda
// sin problema aunque no llegue push real, porque la notificación siempre
// queda en la bandeja dentro de la app.
authRouter.post("/push-token", requireAuth, async (req, res) => {
  try {
    const { push_token } = req.body;
    await registrarPushToken(req.guardia!.id_usuario, push_token);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
