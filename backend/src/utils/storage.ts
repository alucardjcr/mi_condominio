import fs from "node:fs";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Abstracción de almacenamiento (ronda 17) — a pedido del usuario, que
// preguntó cómo migrar las fotos/firmas de paquetería y los comprobantes de
// transferencia de Reservas del disco local a un storage tipo S3 antes de
// desplegar en un hosting real con más de una instancia del backend
// corriendo (un disco local no se comparte entre instancias — ver el
// análisis de hosting en el README/Project doc).
//
// Driver elegido con STORAGE_DRIVER en el .env:
//   - "local" (default, sin cambiar nada de lo que ya funcionaba): guarda
//     en disco bajo UPLOADS_DIR, tal como desde el MVP original.
//   - "s3": sube a cualquier storage compatible con la API de S3 — AWS S3,
//     Cloudflare R2, Backblaze B2, DigitalOcean Spaces, MinIO, etc. — usando
//     el SDK oficial de AWS con un `endpoint` configurable, así que no ata
//     el proyecto a un proveedor específico (el usuario todavía no contrató
//     hosting ni decidió dónde va a vivir esto).
//
// Variables de entorno para el driver "s3" (ver backend/.env.example):
//   S3_BUCKET               (obligatoria)
//   S3_REGION                (default "auto" — Cloudflare R2 y varios
//                              compatibles usan ese valor; AWS S3 real
//                              necesita la región real, ej. "us-east-1")
//   S3_ENDPOINT               (opcional — necesaria para todo lo que no sea
//                              AWS S3 directo: R2, Spaces, B2, MinIO, etc.)
//   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY   (obligatorias)
//   S3_FORCE_PATH_STYLE       (opcional, "true" para MinIO y algunos
//                              compatibles que lo requieren)
//
// Ronda 31, a pedido explícito del usuario (Ley 21.719 de Protección de
// Datos Personales — entra en plena vigencia el 1 de diciembre de 2026):
// se cerró el hueco de seguridad que había hasta esta ronda, donde
// `/uploads` se servía completamente público (`express.static`, sin login)
// sin importar el driver. Ahora, sea local o S3, `guardarArchivo` SIEMPRE
// devuelve una URL propia `/uploads/<ruta>` (nunca la URL directa del
// bucket) — el archivo real se sirve a través de `obtenerArchivo` desde
// una ruta autenticada en index.ts (requireAuth), que en el caso S3 lo
// trae del bucket puerta adentro (el bucket ya no necesita ser público —
// ver S3_PUBLIC_BASE_URL, que quedó sin uso y se puede quitar del .env).
const DRIVER = (process.env.STORAGE_DRIVER || "local").toLowerCase();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads");

let s3ClientSingleton: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3ClientSingleton) {
    s3ClientSingleton = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3ClientSingleton;
}

/**
 * Guarda un archivo ya decodificado (buffer) bajo `rutaRelativa` (ej.
 * "paquetes/recepcion-123-uuid.jpg") usando el driver configurado, y
 * devuelve la URL para guardar en la base de datos — SIEMPRE `/uploads/...`
 * propia, nunca la URL directa del bucket (ver nota de seguridad arriba).
 */
export async function guardarArchivo(buffer: Buffer, rutaRelativa: string, contentType: string): Promise<string> {
  if (DRIVER === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error("STORAGE_DRIVER=s3 pero falta configurar S3_BUCKET en las variables de entorno.");
    }
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: rutaRelativa,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return `/uploads/${rutaRelativa}`;
  }

  // Driver local (default) — mismo comportamiento que existía antes de esta
  // ronda, solo reorganizado detrás de la misma función.
  const destino = path.join(UPLOADS_DIR, rutaRelativa);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, buffer);
  return `/uploads/${rutaRelativa}`;
}

export function driverActivo(): "local" | "s3" {
  return DRIVER === "s3" ? "s3" : "local";
}

/**
 * Ronda 31: lee un archivo ya guardado (por su ruta relativa, ej.
 * "paquetes/recepcion-123-uuid.jpg") para servirlo desde la ruta
 * autenticada `/uploads/*` de index.ts — nunca se expone directo. Devuelve
 * null si no existe (la ruta responde 404 en ese caso). Sanitiza la ruta
 * contra path traversal (ej. "../../etc/passwd") antes de tocar el disco o
 * el bucket.
 */
export async function obtenerArchivo(
  rutaRelativa: string
): Promise<{ stream: NodeJS.ReadableStream; contentType?: string } | null> {
  const normalizada = path.normalize(rutaRelativa).replace(/^([.]{2}[/\\])+/, "");
  if (normalizada.includes("..")) return null;

  if (DRIVER === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return null;
    try {
      const obj = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: normalizada }));
      if (!obj.Body) return null;
      return { stream: obj.Body as unknown as NodeJS.ReadableStream, contentType: obj.ContentType };
    } catch {
      return null;
    }
  }

  const destino = path.join(UPLOADS_DIR, normalizada);
  if (!destino.startsWith(UPLOADS_DIR) || !fs.existsSync(destino)) return null;
  return { stream: fs.createReadStream(destino) };
}
