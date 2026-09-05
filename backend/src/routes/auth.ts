import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, cambiarPassword, solicitarRecuperacion, resetearPassword, seleccionarCondominio, completarOnboardingResidente, crearCondominioInicial } from "../services/auth.service";
import { registrarPushToken, eliminarPushToken } from "../services/notificaciones.service";
import { requireAuth } from "../middleware/auth";
import { registrarEventoSeguridad } from "../services/eventosSeguridad.service";

export const authRouter = Router();

// Ronda 43, a pedido explícito del usuario ("antibot"): sin esto, nada
// impedía probar miles de contraseñas seguidas contra /auth/login — ni
// siquiera hacía falta automatizar mucho, un script simple bastaba. Este
// límite es por IP, no por usuario (adrede: limitar solo por usuariocol
// dejaría abierta la puerta a probar contraseñas contra MUCHOS usuarios
// distintos desde la misma IP sin frenarse). 10 intentos cada 15 minutos
// es generoso para alguien que se equivoca tipeando, pero corta en seco
// cualquier ataque de fuerza bruta automatizado.
//
// Ronda 45: cada vez que el límite se dispara, además de responder 429,
// queda un registro en evento_seguridad (ver eventosSeguridad.service.ts)
// — antes esto pasaba en silencio, sin que nadie se enterara de que algo
// estaba pasando.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." },
  handler: async (req, res) => {
    await registrarEventoSeguridad("rate_limit_login", {
      ip: req.ip,
      usuariocolIntentado: req.body?.usuariocol ? String(req.body.usuariocol) : null,
      detalle: `${req.method} ${req.path}`,
    });
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." });
  },
});

// Recuperación de contraseña: límite más estricto — cada solicitud manda
// un código nuevo (hoy simulado en el log del servidor, pero el día que
// se conecte un proveedor de correo real, esto evita que alguien use el
// endpoint para spamear a un residente con decenas de correos).
const limitadorRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Espera unos minutos antes de volver a intentar." },
  handler: async (req, res) => {
    await registrarEventoSeguridad("rate_limit_recuperacion", {
      ip: req.ip,
      usuariocolIntentado: req.body?.identificador ? String(req.body.identificador) : null,
      detalle: `${req.method} ${req.path}`,
    });
    res.status(429).json({ error: "Demasiadas solicitudes. Espera unos minutos antes de volver a intentar." });
  },
});

authRouter.post("/login", limitadorLogin, async (req, res) => {
  try {
    const { usuariocol, password } = req.body;
    if (!usuariocol || !password) {
      return res.status(400).json({ error: "Falta usuario o contraseña." });
    }
    // Ronda 26: si el usuario es Administrador de más de un condominio,
    // login() devuelve { requiereSeleccionCondominio: true, token, condominios }
    // en vez del { token, guardia, rol } de siempre — mismo status 200 en
    // ambos casos (no es un error, es un paso intermedio del login).
    const resultado = await login(usuariocol, password, req.ip);
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
authRouter.post("/seleccionar-condominio", limitadorLogin, async (req, res) => {
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

// Ronda 66, a pedido explícito del usuario: un Administrador sin ningún
// condominio todavía crea el primero por acá (ver
// auth.service.ts -> resolverSesionParaUsuario, caso
// requiereCrearCondominioInicial). Mismo limitador que login/selección,
// por las dudas — es una acción de una sola vez, no debería necesitar
// muchos intentos seguidos.
authRouter.post("/crear-condominio-inicial", limitadorLogin, async (req, res) => {
  try {
    const { token, ...datosCondominio } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Falta el campo: token." });
    }
    const resultado = await crearCondominioInicial(token, datosCondominio);
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /auth/completar-onboarding -> paso 2 de un residente al que el
// administrador le activó el acceso (ver login() -> requiereOnboarding).
// Recibe el token intermedio que devolvió /auth/login junto con el
// usuario y la clave que la persona eligió, y entrega el token final —
// entra directo, sin tener que loguearse de nuevo desde cero.
authRouter.post("/completar-onboarding", limitadorLogin, async (req, res) => {
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
// app). Ronda 40: ahora soporta más de un dispositivo por usuario (ver
// notificaciones.service.ts -> registrarPushToken). Necesita una
// development build para funcionar de verdad en Expo Go desde el SDK 53
// (ver "Supuestos" en el README) — igual se guarda sin problema aunque no
// llegue push real, porque la notificación siempre queda en la bandeja
// dentro de la app.
authRouter.post("/push-token", requireAuth, async (req, res) => {
  try {
    const { push_token } = req.body;
    await registrarPushToken(req.guardia!.id_usuario, push_token);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /auth/push-token -> se llama al cerrar sesión (best-effort) para
// que ESTE dispositivo deje de recibir push apenas la persona sale — ver
// eliminarPushToken en notificaciones.service.ts.
authRouter.delete("/push-token", requireAuth, async (req, res) => {
  try {
    const { push_token } = req.body;
    await eliminarPushToken(req.guardia!.id_usuario, push_token);
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
authRouter.post("/solicitar-recuperacion", limitadorRecuperacion, async (req, res) => {
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
authRouter.post("/resetear-password", limitadorRecuperacion, async (req, res) => {
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
