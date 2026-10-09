import { Router } from "express";
import { db } from "../db/client";
import { guardarImagenBase64 } from "../utils/imagenes";

// Perfil propio del ADMINISTRADOR (pantalla "Mis datos"): ver y editar su foto,
// correo, fecha de nacimiento, telefono, profesion y N° de registro nacional
// (RNAC). Montado en index.ts solo con requireAuth; todo se resuelve desde el
// token, nunca desde un id que mande el cliente. Un residente del comite NO
// entra aqui: este perfil es de la cuenta Administrador. El RUT se muestra
// pero no se edita desde la app.
export const miPerfilRouter = Router();

function soloAdministrador(req: any, res: any): boolean {
  if (req.guardia?.rol !== "Administrador") {
    res.status(403).json({ error: "Este perfil es solo para la cuenta Administrador." });
    return false;
  }
  return true;
}

async function leerPerfil(idUsuario: number) {
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, u.correo_usuario,
              ap.foto_url, ap.rut, ap.fecha_nacimiento, ap.telefono, ap.profesion, ap.numero_registro_rnac
         FROM usuario u
         LEFT JOIN administrador_perfil ap ON ap.usuario_id_usuario = u.id_usuario
        WHERE u.id_usuario = ?`
    )
    .get(idUsuario);
}

// Perfil propio del GUARDIA (solo lectura): nombre corto y foto para el Inicio.
miPerfilRouter.get("/guardia", async (req, res) => {
  if (req.guardia?.rol !== "Guardia") {
    return res.status(403).json({ error: "Este perfil es solo para la cuenta Guardia." });
  }
  const fila = await db
    .prepare(
      `SELECT u.id_usuario, u.nombre_usuario, gp.nombres, gp.apellido_paterno, gp.foto_url
         FROM usuario u
         LEFT JOIN guardia_perfil gp ON gp.usuario_id_usuario = u.id_usuario
        WHERE u.id_usuario = ?`
    )
    .get(req.guardia!.id_usuario);
  res.json(fila);
});

miPerfilRouter.get("/", async (req, res) => {
  if (!soloAdministrador(req, res)) return;
  res.json(await leerPerfil(req.guardia!.id_usuario));
});

miPerfilRouter.patch("/", async (req, res) => {
  if (!soloAdministrador(req, res)) return;
  try {
    const id = req.guardia!.id_usuario;
    const { correo_usuario, fecha_nacimiento, telefono, profesion, numero_registro_rnac, foto } = req.body;

    if (correo_usuario !== undefined) {
      const correo = String(correo_usuario ?? "").trim();
      if (correo) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
          return res.status(400).json({ error: "El correo no tiene un formato válido." });
        }
        const otro = await db
          .prepare(`SELECT id_usuario FROM usuario WHERE correo_usuario = ? AND id_usuario <> ?`)
          .get(correo, id);
        if (otro) return res.status(400).json({ error: "Ese correo ya está en uso por otra cuenta." });
      }
      await db.prepare(`UPDATE usuario SET correo_usuario = ? WHERE id_usuario = ?`).run(correo || null, id);
    }

    const campos: string[] = [];
    const valores: unknown[] = [];
    const texto = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);
    if (fecha_nacimiento !== undefined) {
      campos.push("fecha_nacimiento");
      valores.push(texto(fecha_nacimiento));
    }
    if (telefono !== undefined) {
      campos.push("telefono");
      valores.push(texto(telefono));
    }
    if (profesion !== undefined) {
      campos.push("profesion");
      valores.push(texto(profesion));
    }
    if (numero_registro_rnac !== undefined) {
      campos.push("numero_registro_rnac");
      valores.push(texto(numero_registro_rnac));
    }
    if (foto) {
      campos.push("foto_url");
      valores.push(await guardarImagenBase64(foto, "administrador", "administradores"));
    }
    if (campos.length > 0) {
      const existente = await db.prepare(`SELECT 1 FROM administrador_perfil WHERE usuario_id_usuario = ?`).get(id);
      if (existente) {
        await db
          .prepare(`UPDATE administrador_perfil SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE usuario_id_usuario = ?`)
          .run(...valores, id);
      } else {
        await db
          .prepare(`INSERT INTO administrador_perfil (usuario_id_usuario, ${campos.join(", ")}) VALUES (?, ${campos.map(() => "?").join(", ")})`)
          .run(id, ...valores);
      }
    }
    res.json(await leerPerfil(id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
