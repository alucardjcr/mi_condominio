import { Router } from "express";
import { crearSolicitudArco, listarMisSolicitudesArco, obtenerMisDatos } from "../services/arco.service";

// Ronda 32: montado en index.ts con requireAuth (+ requireSuscripcionAlDia)
// — CUALQUIER usuario logeado, de cualquier rol, puede ejercer sus propios
// derechos ARCO sobre sí mismo. No pasa por requireCondominioAccess porque
// no recibe ningún condominio_id del cliente — todo se resuelve desde el
// propio token (req.guardia), nunca de lo que mande el cliente.
export const privacidadRouter = Router();

// Acceso + Portabilidad: instantáneo, no requiere revisión de nadie.
privacidadRouter.get("/mis-datos", async (req, res) => {
  try {
    res.json(await obtenerMisDatos(req.guardia!));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 32: derecho de Portabilidad — mismos datos que /mis-datos, pero
// como archivo JSON descargable (Content-Disposition: attachment), para
// que la app pueda ofrecer "Descargar mis datos" con el mismo mecanismo
// que ya usa para el Excel de gasto común (ver descargas.ts en la app).
privacidadRouter.get("/mis-datos/descargar", async (req, res) => {
  try {
    const datos = await obtenerMisDatos(req.guardia!);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mis-datos-mi-condominio.json"`);
    res.send(JSON.stringify(datos, null, 2));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

privacidadRouter.get("/mis-solicitudes", async (req, res) => {
  try {
    res.json(await listarMisSolicitudesArco(req.guardia!.id_usuario));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Rectificación / Cancelación / Oposición: queda pendiente hasta que
// Administrador/Comité la revise (ver /admin/privacidad/solicitudes/:id).
privacidadRouter.post("/solicitudes", async (req, res) => {
  try {
    const { tipo, detalle } = req.body;
    const resultado = await crearSolicitudArco(req.guardia!, { tipo, detalle });
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
