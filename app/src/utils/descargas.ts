// Ronda 20: descarga y comparte un archivo binario (el Excel del reporte de
// gasto común, y desde la ronda 32 también el JSON de "mis datos" para el
// derecho de portabilidad) que llega desde el backend con autenticación por
// header. La API "nueva" de expo-file-system (SDK 57, clases File/Paths)
// permite pasar headers directo a File.downloadFileAsync(), así que no
// hace falta manejar el token como query param ni convertir blobs a mano.
// expo-sharing abre el selector nativo ("Compartir/Guardar en...") para
// que el usuario lo mande por WhatsApp/mail o lo guarde en el teléfono,
// según lo que tenga instalado.
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function descargarYCompartirArchivo(
  url: string,
  token: string,
  nombreArchivo: string,
  mimeType: string = MIME_XLSX,
  dialogTitle: string = "Exportar archivo"
): Promise<void> {
  const destino = new File(Paths.cache as Directory, nombreArchivo);
  // Si quedó un archivo de una descarga anterior con el mismo nombre,
  // idempotent:true lo sobreescribe en vez de fallar con "ya existe".
  const archivo = await File.downloadFileAsync(url, destino, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });

  const disponible = await Sharing.isAvailableAsync();
  if (!disponible) {
    // No debería pasar en Android/iOS reales; queda como aviso claro si
    // se prueba en un entorno donde compartir no está disponible (ej. web).
    throw new Error(`Archivo descargado en ${archivo.uri}, pero compartir no está disponible en este dispositivo.`);
  }

  await Sharing.shareAsync(archivo.uri, { mimeType, dialogTitle });
}
