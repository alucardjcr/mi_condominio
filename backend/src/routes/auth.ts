import { Router } from "express";
import { login, cambiarPassword, solicitarRecuperacion, resetearPassword, seleccionarCondominio, completarOnboardingResidente } from "../services/auth.service";
import { registrarPushToken } from "../services/notificaciones.service";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const { usuariocol, password } = req.body;
    if (!usuariocol || !password) {
      return res.status(400).json({ error: "Falta usuario o contraseña." });
    }
    // Ronda 26: si el usuario es Administrador de más de un condominio,
    // login() devuelve { requiereSeleccionCondominio: true, token, condominios }
    // en vez del { token, guardia, rol } de siempre — mismo status 200 en
    // ambos casos (no es un error, es un paso intermedio del login).
    const resultado = await login(usuariocol, password);
    res.json(resultado);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// POST /auth/seleccionar-condominio -> paso 2 del login de un Administrador
// con más de un condominio (ver login() -> requiereSeleccionCondominio).
// Recibe, en el body, el token intermedio que devolvió /auth/login (no en
// el header Authorization — ese token todavía no autoriza nada más que
// esto) junto con el condominio elegido, y entrega el token final.
authRouter.post("/seleccionar-condominio", async (req, res) => {
  try {
    const { token, condominio_id } = req.body;
    if (!token || !condominio_id) {
      return res.status(400).json({ error: "Faltan campos: token, condominio_id." });
    }
    const resultado = await seleccionarCondominio(token, Number(condominio_id));
    res.json(resultado);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// POST /auth/completar-onboarding -> paso 2 de un residente al que el
// administrador le activó el acceso (ver login() -> requiereOnboarding).
// Recibe el token intermedio que devolvió /auth/login junto con el
// usuario y la clave que la persona eligió, y entrega el token final —
// entra directo, sin tener que loguearse de nuevo desde cero.
authRouter.post("/completar-onboarding", async (req, res) => {
  try {
    const { token, usuariocol_nuevo, password_nuevo } = req.body;
    if (!token || !usuariocol_nuevo || !password_nuevo) {
      return res.status(400).json({ error: "Faltan campos: token, usuariocol_nuevo, password_nuevo." });
    }
    const resultado = await completarOnboardingResidente(token, usuariocol_nuevo, password_nuevo);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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

// POST /auth/solicitar-recuperacion -> paso 1 de "olvidé mi contraseña"
// (sin login: quien la olvidó no puede autenticarse). El "identificador"
// acepta tanto usuariocol como correo_usuario en el mismo campo. Responde
// SIEMPRE con el mismo mensaje genérico, exista o no el usuario/correo, para
// no filtrar esa información a quien llame al endpoint (ver
// auth.service.ts -> solicitarRecuperacion).
authRouter.post("/solicitar-recuperacion", async (req, res) => {
  try {
    const { identificador } = req.body;
    if (!identificador) {
      return res.status(400).json({ error: "Falta el usuario o correo." });
    }
    await solicitarRecuperacion(String(identificador).trim());
    res.json({ ok: true, mensaje: "Si el dato ingresado es válido, te llegará un código a tu correo registrado." });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/resetear-password -> paso 2: valida el código de 6 dígitos
// recibido por correo y, si es válido y no expiró, define la contraseña
// nueva. Tampoco requiere login.
authRouter.post("/resetear-password", async (req, res) => {
  try {
    const { identificador, codigo, password_nueva } = req.body;
    if (!identificador || !codigo || !password_nueva) {
      return res.status(400).json({ error: "Faltan campos: identificador, codigo, password_nueva." });
    }
    await resetearPassword(String(identificador).trim(), String(codigo).trim(), password_nueva);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
