// Dirección del backend del módulo de estacionamientos de visita.
//
// - En el emulador Android, "localhost" del backend se ve como
//   "10.0.2.2" desde la app.
// - En un iPhone/Android físico, tiene que ser la IP de tu computador
//   en la red local (ej: "http://192.168.1.10:3000") o la URL pública
//   una vez que el backend esté desplegado.
//
// Por ahora está fijo para poder probar rápido; en la próxima iteración
// conviene moverlo a variables de entorno de Expo (app.config.ts + EAS).
export const API_BASE_URL = "http://localhost:3000";

// Condominio con el que trabaja este MVP (todavía no hay login/selector
// de condominio — se agrega cuando construyamos el módulo de usuarios).
export const CONDOMINIO_ID = 1;
