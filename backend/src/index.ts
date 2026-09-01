import "dotenv/config";
import express from "express";
import cors from "cors";
// Parchea Router de Express para que un error lanzado (o una promesa
// rechazada) dentro de un handler `async` se reenvíe solo al middleware de
// error de abajo, en vez de quedar la request colgada — Express 4 no hace
// esto por sí solo con async/await. Debe importarse antes de crear el app.
import "express-async-errors";
import { visitasRouter } from "./routes/visitas";
import { estacionamientosRouter } from "./routes/estacionamientos";
import { authRouter } from "./routes/auth";
import { catalogosRouter } from "./routes/catalogos";
import { patentesRouter } from "./routes/patentes";
import { adminRouter } from "./routes/admin";
import { paquetesRouter } from "./routes/paquetes";
import { reservasRouter } from "./routes/reservas";
import { miDeptoRouter } from "./routes/mi-depto";
import { notificacionesRouter } from "./routes/notificaciones";
import { personalRouter } from "./routes/personal";
import { mantencionesRouter } from "./routes/mantenciones";
import { vetadosRouter } from "./routes/vetados";
import { bitacoraRouter } from "./routes/bitacora";
import { jefeGuardiasRouter } from "./routes/jefe-guardias";
import { mascotasRouter } from "./routes/mascotas";
import { condominiosRouter } from "./routes/condominios";
import { superAdminRouter } from "./routes/super-admin";
import { privacidadRouter } from "./routes/privacidad";
import { requireAuth, requireAdmin, requireCondominioAccess, requireSuperAdmin, requireSuscripcionAlDia } from "./middleware/auth";
import { obtenerArchivo } from "./utils/storage";
import { registrarAuditoria } from "./services/auditoria.service";
import { initSchema } from "./db/client";

const app = express();
app.use(cors());
// Límite subido de 100kb (default) a 8mb: las fotos y firmas de
// paquetería llegan como data URL base64 dentro del JSON.
app.use(express.json({ limit: "8mb" }));

// Ronda 33, a pedido explícito del usuario (Ley 21.719): registra en
// log_auditoria TODA request que modifica algo (POST/PATCH/PUT/DELETE) —
// sin tener que instrumentar cada ruta una por una. Se registra en el
// evento "finish" de la response (después de que ya se respondió, cero
// impacto en el tiempo de respuesta real) para poder leer req.guardia, que
// requireAuth recién deja seteado más abajo en la cadena de middlewares —
// por eso este `app.use` va ANTES de los routers: el orden de ejecución
// del callback de "finish" no depende de dónde esté este middleware, pero
// si fuera DESPUÉS de un router que ya respondió, nunca llegaría a
// engancharse a tiempo. No audita /auth/login (ahí no hay nada que
// "modificar" todavía, y loguear intentos de login con la contraseña en
// el body sería un riesgo en sí mismo) ni GET (las lecturas sensibles se
// auditan puntualmente donde corresponde, ver /uploads/* más abajo y
// vetados.service.ts).
app.use((req, res, next) => {
  res.on("finish", () => {
    if (req.method === "GET" || req.path === "/auth/login") return;
    registrarAuditoria({
      usuarioId: req.guardia?.id_usuario ?? null,
      rol: req.guardia?.rol ?? null,
      condominioId: req.guardia?.condominio_id_condominio ?? null,
      accion: req.method,
      ruta: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
    });
  });
  next();
});

// Ronda 31, a pedido explícito del usuario (Ley 21.719 de Protección de
// Datos Personales, vigente desde el 1 de diciembre de 2026): hasta esta
// ronda, `/uploads` se servía completamente público (`express.static`, sin
// login) — cualquiera con la URL podía ver una foto de paquetería, un
// comprobante, la foto de una persona vetada, etc. Ahora exige sesión
// válida (requireAuth) antes de entregar cualquier archivo, sea que esté
// en disco local o en un bucket S3 (ver utils/storage.ts -> obtenerArchivo,
// que resuelve cuál de los dos según STORAGE_DRIVER sin que a esta ruta le
// importe). No hace chequeo fino de "es realmente tuyo este archivo
// puntual" (dejarlo así, exigiendo solo sesión válida, ya cierra la
// exposición pública que era el problema real) — quedaría como mejora
// futura acotar por condominio si hiciera falta.
app.get("/uploads/*", requireAuth, async (req, res) => {
  const rutaRelativa = (req.params as any)[0] as string;
  const archivo = await obtenerArchivo(rutaRelativa);
  registrarAuditoria({
    usuarioId: req.guardia?.id_usuario ?? null,
    rol: req.guardia?.rol ?? null,
    condominioId: req.guardia?.condominio_id_condominio ?? null,
    accion: "GET",
    ruta: "/uploads/*",
    statusCode: archivo ? 200 : 404,
    detalle: `archivo: ${rutaRelativa}`,
  });
  if (!archivo) {
    return res.status(404).json({ error: "Archivo no encontrado." });
  }
  if (archivo.contentType) res.setHeader("Content-Type", archivo.contentType);
  archivo.stream.pipe(res);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/visitas", visitasRouter); // requiere login (ver middleware dentro del router) — ronda 26/27: requireCondominioAccess + requireSuscripcionAlDia también dentro del router, después de su propio requireAuth
app.use("/estacionamientos", estacionamientosRouter);
app.use("/", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, catalogosRouter); // /torres, /torres/:id/unidades, /unidades/:id/residentes, /tipos-permiso, /tipos-paquete, ...
app.use("/patentes", requireAuth, requireSuscripcionAlDia, patentesRouter);
app.use("/paquetes", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, paquetesRouter); // Guardia y Administrador (no es exclusivo de admin)
app.use("/reservas", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, reservasRouter); // Residente reserva, Guardia opera "Reserva Área Común" (ver requireRol dentro del router)
app.use("/admin", requireAuth, requireAdmin, requireCondominioAccess, requireSuscripcionAlDia, adminRouter); // solo perfil Administrador (config de espacios y aprobación de reservas incluida); ronda 26: valida que el condominio pedido sea el de la sesión
app.use("/admin-condominios", requireAuth, requireAdmin, condominiosRouter); // ronda 26: crear un condominio nuevo y listar los del admin logeado — sin requireCondominioAccess/requireSuscripcionAlDia a propósito, ver routes/condominios.ts (crear condominios nuevos no puede depender de que uno YA esté bloqueado)
app.use("/super-admin", requireAuth, requireSuperAdmin, superAdminRouter); // ronda 27: exclusivo del dueño del sistema — crear cuentas Administrador y gestionar facturación
app.use("/mi-depto", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, miDeptoRouter); // solo el dueño del depto, autoadministra el listado de residentes de SU unidad (ver requireRol dentro del router)
app.use("/notificaciones", requireAuth, requireSuscripcionAlDia, notificacionesRouter); // bandeja propia de notificaciones (paquetes/visitas/comunicados) — ronda 27: también se corta si el condominio debe (a pedido del usuario: "ni notificaciones ni avisos ni nada")
app.use("/personal", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, personalRouter); // autoservicio del propio Personal externo: turno + mis tareas (ver requireRol dentro del router)
app.use("/mantenciones", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, mantencionesRouter); // Guardia: marcar ingreso/salida de la empresa externa (ver requireRol dentro del router); programación en /admin/mantenciones
app.use("/vetados", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, vetadosRouter); // ronda 20: listado VETADOS — CRUD solo Administrador/Comité, búsqueda por RUT también Guardia (ver requireRol dentro del router)
app.use("/bitacora", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, bitacoraRouter); // ronda 20: bitácora de novedades del turno — escribe Guardia, lee Guardia y Administrador/Comité (ver requireRol dentro del router)
app.use("/jefe-guardias", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, jefeGuardiasRouter); // ronda 20: rol JEFE_GUARDIAS — calendario de turnos + CRUD de guardias, y SOLO eso (ver requireRol dentro del router)
app.use("/mascotas", requireAuth, requireCondominioAccess, requireSuscripcionAlDia, mascotasRouter); // ronda 20: mascotas por depto — autoservicio del residente de esa unidad, o Administrador/Comité (ver requireAuth dentro del router)
app.use("/privacidad", requireAuth, privacidadRouter); // ronda 32, Ley 21.719: derechos ARCO — autoservicio de cualquier rol sobre sí mismo, ver routes/privacidad.ts. A propósito SIN requireSuscripcionAlDia: es un derecho de la PERSONA, no puede quedar condicionado a si el condominio pagó su mensualidad o no.

// Manejador de errores genérico: cualquier excepción no capturada por un
// try/catch específico (sea síncrona o, gracias a express-async-errors, una
// promesa rechazada dentro de un handler async) termina acá en vez de
// colgar la request o devolver el HTML de error por defecto de Express.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Error interno del servidor." });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// El schema se aplica (CREATE TABLE IF NOT EXISTS...) antes de levantar el
// servidor HTTP — ver db/client.ts. Si la base no está disponible (host mal
// configurado, credenciales incorrectas, etc.), el backend falla rápido acá
// en vez de arrancar y fallar recién en la primera consulta.
initSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend "estacionamientos de visita" escuchando en http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("No se pudo aplicar el schema / conectar a la base de datos:", err);
    process.exit(1);
  });
