// Dirección del backend del módulo de estacionamientos de visita.
//
// Ronda 22: backend desplegado en Railway (repo alucardjcr/mi_condominio,
// servicio con Root Directory=backend + MySQL administrado en el mismo
// proyecto) — la app ahora apunta directo a esa URL pública en vez de
// localhost, así que funciona igual desde el emulador y desde un
// teléfono físico sin configuración adicional.
//
// Para volver a apuntar a un backend local durante desarrollo, cambia
// esto temporalmente a:
// - "http://10.0.2.2:3000" en el emulador Android (localhost del host
//   se ve así desde el emulador).
// - "http://<IP-de-tu-computador-en-la-red-local>:3000" en un teléfono
//   físico conectado al mismo Wi-Fi que el backend.
//
// En la próxima iteración conviene mover esto a variables de entorno de
// Expo (app.config.ts + EAS) en vez de un valor fijo en el código.
export const API_BASE_URL = "https://micondominio-production.up.railway.app";

// Condominio con el que trabaja este MVP (todavía no hay login/selector
// de condominio — se agrega cuando construyamos el módulo de usuarios).
export const CONDOMINIO_ID = 1;
