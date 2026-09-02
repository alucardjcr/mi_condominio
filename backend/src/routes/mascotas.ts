import { Router } from "express";
import { listarMascotasDeUnidad, listarMascotasDelCondominio, crearMascota, actualizarMascota, getUnidadDeMascota, getCondominioDeMascota } from "../services/mascotas.service";
import { requireAuth } from "../middleware/auth";
import { guardarImagenBase64 } from "../utils/imagenes";
import { CONDOMINIO_ID_DEFAULT } from "../config";

// Ronda 20: mascotas por depto. Autoservicio de cualquier residente activo
// de la unidad (no exclusivo del propietario); Administrador/Comité tiene
// acceso total, igual criterio que el resto del sistema.
export const mascotasRouter = Router();
mascotasRouter.use(requireAuth);

function esAdminOComite(req: any): boolean {
  return req.guardia?.rol === "Administrador" || !!req.guardia?.esComite;
}

// GET /mascotas -> las de mi propia unidad (Residente) o todas del
// condominio (Administrador/Comité, vía ?condominio_id=).
mascotasRouter.get("/", async (req, res) => {
  if (esAdminOComite(req)) {
    const condominioId = Number(req.query.condominio_id) || CONDOMINIO_ID_DEFAULT;
    return res.json(await listarMascotasDelCondominio(condominioId));
  }
  if (req.guardia?.rol !== "Residente" || !req.guardia.unidad_id_unidad) {
    return res.status(403).json({ error: "Solo un residente o Administrador/Comité pueden ver mascotas." });
  }
  res.json(await listarMascotasDeUnidad(req.guardia.unidad_id_unidad));
});

mascotasRouter.post("/", async (req, res) => {
  try {
    const { nombre, especie, raza, numero_chip, foto } = req.body;
    let unidadId: number | undefined;
    if (esAdminOComite(req)) {
      unidadId = req.body.unidad_id_unidad ? Number(req.body.unidad_id_unidad) : undefined;
      if (!unidadId) return res.status(400).json({ error: "Falta unidad_id_unidad." });
    } else if (req.guardia?.rol === "Residente" && req.guardia.unidad_id_unidad) {
      unidadId = req.guardia.unidad_id_unidad; // siempre su propia unidad, nunca la que mande el cliente
    } else {
      return res.status(403).json({ error: "Solo un residente o Administrador/Comité pueden registrar mascotas." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    const fotoUrl = foto ? await guardarImagenBase64(foto, "mascota", "mascotas") : undefined;
    const mascota = await crearMascota(
      { nombre, especie, raza, numeroChip: numero_chip, fotoUrl, unidadId: unidadId!, condominioId },
      req.guardia!.id_usuario
    );
    res.status(201).json(mascota);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ronda 44, a pedido explícito del usuario (revisión de seguridad — IDOR):
// antes, esta función dejaba pasar a CUALQUIER Administrador/Comité para
// editar/eliminar CUALQUIER mascota, sin verificar que fuera de su propio
// condominio — un admin del condominio A podía tocar la mascota de
// alguien del condominio B solo adivinando el id. Ahora se verifica
// también en ese caso.
async function puedeEditar(req: any, idMascota: number): Promise<boolean> {
  if (esAdminOComite(req)) {
    const condominioDeLaMascota = await getCondominioDeMascota(idMascota);
    return condominioDeLaMascota !== undefined && condominioDeLaMascota === req.guardia?.condominio_id_condominio;
  }
  if (req.guardia?.rol !== "Residente" || !req.guardia.unidad_id_unidad) return false;
  const unidadDeLaMascota = await getUnidadDeMascota(idMascota);
  return unidadDeLaMascota === req.guardia.unidad_id_unidad;
}

mascotasRouter.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await puedeEditar(req, id))) {
      return res.status(403).json({ error: "Solo un residente de esa unidad o Administrador/Comité pueden editar esta mascota." });
    }
    const { nombre, especie, raza, numero_chip, foto, flg_vigencia } = req.body;
    const fotoUrl = foto ? await guardarImagenBase64(foto, "mascota", "mascotas") : undefined;
    res.json(
      await actualizarMascota(id, {
        nombre,
        especie,
        raza,
        numeroChip: numero_chip,
        fotoUrl,
        flgVigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// "Eliminar" = baja lógica (flg_vigencia = 0) — mismo criterio que el
// resto de las bajas del sistema (residentes, patentes, personal, etc.).
mascotasRouter.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await puedeEditar(req, id))) {
      return res.status(403).json({ error: "Solo un residente de esa unidad o Administrador/Comité pueden eliminar esta mascota." });
    }
    await actualizarMascota(id, { flgVigencia: 0 });
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
