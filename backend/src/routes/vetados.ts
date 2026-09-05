import { Router } from "express";
import { listarVetados, crearVetado, actualizarVetado, buscarVetadoPorRut } from "../services/vetados.service";
import { requireRol, requirePerteneceAlCondominio } from "../middleware/auth";
import { guardarImagenBase64 } from "../utils/imagenes";
import { registrarAuditoria } from "../services/auditoria.service";

// Ronda 20: listado VETADOS. Información sensible (puede involucrar
// órdenes de alejamiento) — solo Administrador/Comité administra la lista
// completa; el guardia solo puede BUSCAR por RUT desde su propia pantalla
// (ver /buscar), nunca listar ni editar. La revisión automática al
// registrar una visita vive en estacionamientoVisita.service.ts.
export const vetadosRouter = Router();

vetadosRouter.get("/buscar", requireRol("Guardia", "Administrador"), async (req, res) => {
  try {
    const rut = String(req.query.rut || "").trim();
    if (!rut) {
      return res.status(400).json({ error: "Falta el parámetro rut." });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    const resultado = await buscarVetadoPorRut(condominioId, rut);
    // Ronda 33, Ley 21.719: consultar la lista VETADOS por RUT es una
    // lectura sensible (puede involucrar una orden de alejamiento) —
    // queda registrada aparte del middleware genérico (que solo cubre
    // mutaciones), con el RUT consultado en el detalle.
    registrarAuditoria({
      usuarioId: req.guardia?.id_usuario ?? null,
      rol: req.guardia?.rol ?? null,
      condominioId: req.guardia?.condominio_id_condominio ?? null,
      accion: "GET",
      ruta: "/vetados/buscar",
      statusCode: 200,
      detalle: `RUT consultado: ${rut}${resultado ? " (encontrado)" : " (sin coincidencia)"}`,
    });
    res.json({ vetado: resultado ?? null });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

vetadosRouter.get("/", requireRol("Administrador"), async (req, res) => {
  const condominioId = req.guardia!.condominio_id_condominio!;
  res.json(await listarVetados(condominioId));
});

vetadosRouter.post("/", requireRol("Administrador"), async (req, res) => {
  try {
    const { nombre_completo, rut, patente, parentesco, fecha_ingreso, foto_persona, foto_vehiculo, observaciones, unidad_id_unidad } = req.body;
    if (!nombre_completo || !rut || !fecha_ingreso) {
      return res.status(400).json({ error: "Faltan campos: nombre_completo, rut, fecha_ingreso." });
    }
    const condominioId = req.guardia!.condominio_id_condominio!;
    const fotoPersonaUrl = foto_persona ? await guardarImagenBase64(foto_persona, "persona", "vetados") : undefined;
    const fotoVehiculoUrl = foto_vehiculo ? await guardarImagenBase64(foto_vehiculo, "vehiculo", "vetados") : undefined;
    const vetado = await crearVetado(
      {
        nombreCompleto: nombre_completo,
        rut,
        patente,
        parentesco,
        fechaIngreso: fecha_ingreso,
        fotoPersonaUrl,
        fotoVehiculoUrl,
        observaciones,
        condominioId,
        unidadId: unidad_id_unidad ? Number(unidad_id_unidad) : undefined,
      },
      req.guardia!.id_usuario
    );
    res.status(201).json(vetado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

vetadosRouter.patch("/:id", requireRol("Administrador"), requirePerteneceAlCondominio("vetado", "id_vetado"), async (req, res) => {
  try {
    const { nombre_completo, rut, patente, parentesco, fecha_ingreso, foto_persona, foto_vehiculo, observaciones, flg_vigencia, unidad_id_unidad } =
      req.body;
    const fotoPersonaUrl = foto_persona ? await guardarImagenBase64(foto_persona, "persona", "vetados") : undefined;
    const fotoVehiculoUrl = foto_vehiculo ? await guardarImagenBase64(foto_vehiculo, "vehiculo", "vetados") : undefined;
    res.json(
      await actualizarVetado(Number(req.params.id), {
        nombreCompleto: nombre_completo,
        rut,
        patente,
        parentesco,
        fechaIngreso: fecha_ingreso,
        fotoPersonaUrl,
        fotoVehiculoUrl,
        observaciones,
        flgVigencia: flg_vigencia !== undefined ? Number(flg_vigencia) : undefined,
        unidadId: unidad_id_unidad !== undefined ? (unidad_id_unidad === null ? null : Number(unidad_id_unidad)) : undefined,
        condominioId: req.guardia?.condominio_id_condominio,
      })
    );
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
