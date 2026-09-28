import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

interface OpcionesFoto {
  /** Si es true, deja recortar la foto antes de aceptarla (ej. foto de perfil tipo carnet). */
  editable?: boolean;
  /** Relación de aspecto del recorte, ej. [1, 1] para una foto cuadrada. Solo aplica si editable=true. */
  aspecto?: [number, number];
}

// Ronda 72, a pedido explícito del usuario: fotos elegidas desde la
// galería de un iPhone suelen venir en formato HEIC, que el backend
// rechaza ("Formato de imagen no soportado ... image/heic" — solo acepta
// jpg/png/webp). Para no repetir este bug en cada pantalla que use fotos,
// TODA foto (venga de cámara o de galería, con o sin recorte) pasa por acá
// antes de convertirse a data URL: siempre se normaliza a JPEG, sin
// importar el formato de origen.
async function procesarResultado(resultado: ImagePicker.ImagePickerResult): Promise<string | null> {
  if (resultado.canceled) return null;
  const asset = resultado.assets?.[0];
  if (!asset?.uri) return null;

  const manipulado = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 640 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!manipulado.base64) return null;
  return `data:image/jpeg;base64,${manipulado.base64}`;
}

/**
 * Abre la cámara y devuelve la foto como data URL base64
 * ("data:image/jpeg;base64,...."), lista para mandar al backend. Devuelve
 * null si la persona canceló la foto. Con `editable`/`aspecto` deja
 * recortarla antes de aceptarla (ver `elegirDeGaleria`, mismas opciones).
 */
export async function tomarFoto(opciones: OpcionesFoto = {}): Promise<string | null> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) {
    throw new Error("Se necesita permiso de cámara para tomar la foto.");
  }

  const resultado = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    mediaTypes: "images",
    allowsEditing: opciones.editable ?? false,
    aspect: opciones.aspecto,
  });

  return procesarResultado(resultado);
}

/**
 * Abre la galería del teléfono y devuelve la foto elegida como data URL
 * base64, mismo formato que `tomarFoto()`. Devuelve null si la persona
 * canceló la selección.
 *
 * `editable: true` + `aspecto: [1, 1]` (ronda 72, a pedido explícito del
 * usuario) muestra el recorte nativo cuadrado antes de aceptar la foto —
 * pensado para fotos de perfil tipo carnet, donde antes la imagen quedaba
 * rectangular y descentrada. El resto de los usos (fotos de paquetes,
 * etc.) sigue sin recorte por defecto, a propósito.
 */
export async function elegirDeGaleria(opciones: OpcionesFoto = {}): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    throw new Error("Se necesita permiso para acceder a tus fotos.");
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    mediaTypes: "images",
    allowsEditing: opciones.editable ?? false,
    aspect: opciones.aspecto,
  });

  return procesarResultado(resultado);
}
