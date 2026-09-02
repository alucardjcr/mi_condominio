import { Router } from "express";
import { actualizarResidente, crearResidente, listarResidentes, residentePerteneceAUnidad } from "../services/admin.service";
import { CONDOMINIO_ID_DEFAULT } from "../config";
import { requireRol } from "../middleware/auth";

export const miDeptoRouter = Router();

// Autoadministración del hogar por el DUEÑO del depto (ronda 15, a pedido
// explícito del usuario): un residente marcado como propietario
// (flg_propietario, ver login/auth.service.ts) puede administrar el
// listado de residentes de SU PROPIA unidad — agregarlos, editarlos, darlos
// de baja — sin depender del Administrador para el día a día. El dueño
// conserva este permiso viva o no en el depto (puede tenerlo arrendado y
// vivir en otra ciudad): la propiedad es lo que da el derecho a
// administrar, no la ocupación. Sigue existiendo, sin cambios, la vía
// paralela de que Administrador/Comité gestionen cualquier depto desde
// /admin/residentes.
//
// Nombrar a un nuevo propietario (flg_propietario) NO se puede hacer desde
// acá — eso sigue siendo exclusivo de Administrador/Comité vía
// /admin/residentes (ver admin.ts), igual que flg_comite.
const soloResidente = requireRol("Residente");

function esPropietarioLogeado(req: any): boolean {
  return req.guardia?.rol === "Residente" && !!req.guardia?.esPropietario && !!req.guardia?.unidad_id_unidad;
}

function rechazarSiNoEsPropietario(req: any, res: any): boolean {
  if (!esPropietarioLogeado(req)) {
    res.status(403).json({ error: "Esta acción requiere ser el propietario de un depto registrado." });
    return true;
  }
  return false;
}

miDeptoRouter.get("/residentes", soloResidente, async (req, res) => {
  if (rechazarSiNoEsPropietario(req, res)) return;
  res.json(await listarResidentes(req.guardia!.unidad_id_unidad));
});

miDeptoRouter.post("/residentes", soloResidente, async (req, res) => {
  try {
    if (rechazarSiNoEsPropietario(req, res)) return;
    const { nombre_usuario, tipo_residente_id_tiporesidente, rut, fecha_nacimiento, profesion } = req.body;
    if (!nombre_usuario) {
      return res.status(400).json({ error: "Falta el campo nombre_usuario." });
    }
    const condominioId = Number(req.body.condominio_id_condominio) || CONDOMINIO_ID_DEFAULT;
    // La unidad siempre es la propia del dueño logeado — se ignora
    // cualquier unidad_id_unidad que intente mandar el cliente (mismo
    // patrón defensivo que "a quién visita" en estacionamientos/paquetería
    // y que crearReserva en reservas.ts).
    res.status(201).json(
      await crearResidente({
        nombre_usuario,
        unidad_id_unidad: req.guardia!.unidad_id_unidad!,
        condominio_id_condominio: condominioId,
        tipo_residente_id_tiporesidente:
          tipo_residente_id_tiporesidente !== undefined ? Number(tipo_residente_id_tiporesidente) : undefined,
        rut: rut || undefined,
        fecha_nacimiento: fecha_nacimiento || undefined,
        profesion: profesion || undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

miDeptoRouter.patch("/residentes/:id", soloResidente, async (req, res) => {
  try {
    if (rechazarSiNoEsPropietario(req, res)) return;
    const idResidente = Number(req.params.id);
    if (!(await residentePerteneceAUnidad(idResidente, req.guardia!.unidad_id_unidad!))) {
      return res.status(403).json({ error: "Ese residente no pertenece a tu depto." });
    }
    if (idResidente === req.guardia!.id_usuario && Number(req.body.flg_vigencia) === 0) {
      return res
        .status(400)
        .json({ error: "No puedes desactivarte a ti mismo desde acá. Pide al Administrador que lo haga si corresponde." });
    }
    const { nombre_usuario, flg_vigencia, tipo_residente_id_tiporesidente, rut, fecha_nacimiento, profesion } = req.body;
    // Deliberadamente NO se aceptan acá flg_comite ni flg_propietario: el
    // dueño administra a quién vive en su depto y a qué título, pero no
    // puede otorgarse (ni quitarle a otro) permisos de comité o de
    // propiedad — eso sigue siendo exclusivo del panel de Administrador/
    // Comité (ver admin.ts).
    res.json(
      await actualizarResidente(idResidente, {
        nombre_usuario,
        flg_vigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
        tipo_residente_id_tiporesidente:
          tipo_residente_id_tiporesidente !== undefined
            ? tipo_residente_id_tiporesidente === null
              ? null
              : Number(tipo_residente_id_tiporesidente)
            : undefined,
        rut: "rut" in req.body ? rut : undefined,
        fecha_nacimiento: "fecha_nacimiento" in req.body ? fecha_nacimiento : undefined,
        profesion: "profesion" in req.body ? profesion : undefined,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
