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

// Ronda 26: condominio con el que está trabajando la sesión actual. Deja
// de ser un valor fijo — ahora AuthContext lo actualiza (vía
// setCondominioIdActual) apenas se resuelve el login (o el residente/
// admin elige un condominio, en el caso de Administrador con más de
// uno). Se mantiene como `export let` a propósito: TODAS las pantallas
// que ya hacían `import { CONDOMINIO_ID } from "../config/api"` (más de
// 20 en este proyecto) siguen funcionando sin tocarlas una por una,
// porque los imports de ES modules son "live bindings" — leen el valor
// actual de la variable en el momento en que se usa, no el que tenía al
// importarla. Arranca en 1 (compatibilidad con el condominio único que
// existía antes de esta ronda) hasta que AuthContext lo actualice.
export let CONDOMINIO_ID = 1;

export function setCondominioIdActual(id: number) {
  CONDOMINIO_ID = id;
}
