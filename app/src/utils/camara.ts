import * as ImagePicker from "expo-image-picker";

/**
 * Abre la cámara y devuelve la foto como data URL base64
 * ("data:image/jpeg;base64,...."), lista para mandar al backend. Devuelve
 * null si el guardia canceló la foto.
 */
export async function tomarFoto(): Promise<string | null> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) {
    throw new Error("Se necesita permiso de cámara para tomar la foto.");
  }

  const resultado = await ImagePicker.launchCameraAsync({
    base64: true,
    quality: 0.5,
    mediaTypes: "images",
  });

  if (resultado.canceled) return null;
  const asset = resultado.assets?.[0];
  if (!asset?.base64) return null;

  const mime = asset.mimeType && asset.mimeType.startsWith("image/") ? asset.mimeType : "image/jpeg";
  return `data:${mime};base64,${asset.base64}`;
}
