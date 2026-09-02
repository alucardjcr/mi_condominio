import crypto from "node:crypto";
import { guardarArchivo } from "./storage";

// Fotos/firmas de paquetería y comprobantes de transferencia de Reservas de
// Espacios Comunes. Hasta la ronda 16 esto escribía directo a disco local;
// desde la ronda 17 pasa por `storage.ts`, que decide (vía STORAGE_DRIVER)
// si guarda en disco local (default, mismo comportamiento de siempre) o en
// un storage S3-compatible — ver la nota completa en storage.ts.

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Ronda 44, a pedido explícito del usuario (revisión de seguridad —
// validación de subidas): antes solo se confiaba en el mimetype que el
// propio cliente declara en el data URL ("data:image/jpeg;base64,...") —
// nada impedía que alguien mandara CUALQUIER archivo (un ejecutable, un
// script) etiquetado como si fuera una imagen; el servidor lo guardaba
// igual y después lo servía de vuelta con Content-Type: image/jpeg. Ahora
// se valida además la firma real de los primeros bytes del archivo
// ("magic bytes") — no se puede falsificar solo cambiando el nombre/mime
// declarado, porque el formato real del archivo tiene que coincidir.
const MAGIC_BYTES: Record<string, (buffer: Buffer) => boolean> = {
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/jpg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  "image/webp": (b) =>
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP",
};

/**
 * Recibe un data URL ("data:image/jpeg;base64,....") como los que entrega
 * la cámara/firma en la app, lo decodifica y lo guarda (disco local o S3,
 * según STORAGE_DRIVER). Devuelve la URL para guardar en la BD.
 * `carpeta` elige la subcarpeta/prefijo ("paquetes" por defecto, "reservas"
 * para los comprobantes de pago de espacios comunes, "mantenciones" para
 * el comprobante/factura y la foto del trabajo terminado (ronda 19),
 * "vetados" para la foto de la persona/vehículo vetado y "mascotas" para
 * la foto de la mascota registrada (ronda 20).
 */
export async function guardarImagenBase64(
  dataUrl: string,
  prefijo: string,
  carpeta: "paquetes" | "reservas" | "mantenciones" | "vetados" | "mascotas" = "paquetes"
): Promise<string> {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error(
      `La imagen de "${prefijo}" no viene en el formato esperado (data:image/...;base64,...).`
    );
  }
  const [, mime, base64] = match;
  const extension = EXTENSION_POR_MIME[mime.toLowerCase()];
  if (!extension) {
    throw new Error(`Formato de imagen no soportado para "${prefijo}": ${mime}`);
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error(`La imagen de "${prefijo}" llegó vacía.`);
  }
  // El contenido real del archivo tiene que coincidir con el mime que
  // declaró — ver la nota completa sobre MAGIC_BYTES más arriba.
  const validador = MAGIC_BYTES[mime.toLowerCase()];
  if (!validador || !validador(buffer)) {
    throw new Error(
      `El archivo de "${prefijo}" no es una imagen ${mime} válida (el contenido no coincide con el formato declarado).`
    );
  }
  // Límite generoso (8 MB) para evitar que una foto sin comprimir llene el
  // disco (driver local) o genere un costo de storage innecesario (driver S3).
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error(`La imagen de "${prefijo}" es demasiado grande (máximo 8 MB).`);
  }

  const nombreArchivo = `${prefijo}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  return guardarArchivo(buffer, `${carpeta}/${nombreArchivo}`, mime.toLowerCase());
}
