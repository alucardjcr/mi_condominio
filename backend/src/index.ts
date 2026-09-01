import "dotenv/config";
import path from "node:path";
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
import { requireAuth, requireAdmin, requireCondominioAccess } from "./middleware/auth";
import { initSchema } from "./db/client";

const app = express();
app.use(cors());
// Límite subido de 100kb (default) a 8mb: las fotos y firmas de
// paquetería llegan como data URL base64 dentro del JSON.
app.use(express.json({ limit: "8mb" }));

// Fotos/firmas de paquetería servidas como archivos estáticos. En este MVP
// es disco local (ver src/utils/imagenes.ts); antes de tener más de un
// backend corriendo en producción esto debe migrar a un storage tipo S3.
app.use("/uploads", express.static(process.env.UPLOADS_DIR || path.join(__dirname, "../uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/visitas", visitasRouter); // requiere login (ver middleware dentro del router) — ronda 26: requireCondominioAccess también dentro del router, después de su propio requireAuth
app.use("/estacionamientos", estacionamientosRouter);
app.use("/", requireAuth, requireCondominioAccess, catalogosRouter); // /torres, /torres/:id/unidades, /unidades/:id/residentes, /tipos-permiso, /tipos-paquete, ...
app.use("/patentes", requireAuth, patentesRouter);
app.use("/paquetes", requireAuth, requireCondominioAccess, paquetesRouter); // Guardia y Administrador (no es exclusivo de admin)
app.use("/reservas", requireAuth, requireCondominioAccess, reservasRouter); // Residente reserva, Guardia opera "Reserva Área Común" (ver requireRol dentro del router)
app.use("/admin", requireAuth, requireAdmin, requireCondominioAccess, adminRouter); // solo perfil Administrador (config de espacios y aprobación de reservas incluida); ronda 26: valida que el condominio pedido sea el de la sesión
app.use("/admin-condominios", requireAuth, requireAdmin, condominiosRouter); // ronda 26: crear un condominio nuevo y listar los del admin logeado — sin requireCondominioAccess a propósito, ver routes/condominios.ts
app.use("/mi-depto", requireAuth, requireCondominioAccess, miDeptoRouter); // solo el dueño del depto, autoadministra el listado de residentes de SU unidad (ver requireRol dentro del router)
app.use("/notificaciones", requireAuth, notificacionesRouter); // bandeja propia de notificaciones (paquetes/visitas/comunicados)
app.use("/personal", requireAuth, requireCondominioAccess, personalRouter); // autoservicio del propio Personal externo: turno + mis tareas (ver requireRol dentro del router)
app.use("/mantenciones", requireAuth, requireCondominioAccess, mantencionesRouter); // Guardia: marcar ingreso/salida de la empresa externa (ver requireRol dentro del router); programación en /admin/mantenciones
app.use("/vetados", requireAuth, requireCondominioAccess, vetadosRouter); // ronda 20: listado VETADOS — CRUD solo Administrador/Comité, búsqueda por RUT también Guardia (ver requireRol dentro del router)
app.use("/bitacora", requireAuth, requireCondominioAccess, bitacoraRouter); // ronda 20: bitácora de novedades del turno — escribe Guardia, lee Guardia y Administrador/Comité (ver requireRol dentro del router)
app.use("/jefe-guardias", requireAuth, requireCondominioAccess, jefeGuardiasRouter); // ronda 20: rol JEFE_GUARDIAS — calendario de turnos + CRUD de guardias, y SOLO eso (ver requireRol dentro del router)
app.use("/mascotas", requireAuth, requireCondominioAccess, mascotasRouter); // ronda 20: mascotas por depto — autoservicio del residente de esa unidad, o Administrador/Comité (ver requireAuth dentro del router)

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
