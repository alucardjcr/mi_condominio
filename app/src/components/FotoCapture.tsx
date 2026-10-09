import React, { useState } from "react";
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { elegirDeGaleria, tomarFoto } from "../utils/camara";
import { colors } from "../theme/theme";

interface Props {
  label: string;
  value: string | null; // data URL ya capturado, o null
  onChange: (dataUrl: string | null) => void;
  /**
   * Ronda 72, a pedido explícito del usuario: true muestra el recorte
   * cuadrado nativo (estilo foto carnet) antes de aceptar la foto — pensado
   * para fotos de perfil. Por defecto queda igual que siempre (sin
   * recorte), para no cambiar el comportamiento en paquetes/evidencias.
   */
  recorteCuadrado?: boolean;
}

// Botón de "tomar foto"/"elegir de galería" con preview + opción de
// repetirla. Se usa tanto para la foto obligatoria al recibir un paquete
// como para la foto de quien lo retira, y para fotos de perfil (ronda 67:
// se agregó la opción de galería; ronda 72: recorte cuadrado opcional +
// toda foto se normaliza a JPEG, antes fallaba con HEIC desde iPhone).
// Si el error es por permiso denegado, iOS no vuelve a preguntar: se ofrece
// abrir los Ajustes del teléfono para activarlo.
function avisarError(mensaje: string) {
  if (/permiso/i.test(mensaje)) {
    Alert.alert("Falta el permiso", mensaje, [
      { text: "Cancelar", style: "cancel" },
      { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
    ]);
  } else {
    Alert.alert("Error", mensaje);
  }
}

export default function FotoCapture({ label, value, onChange, recorteCuadrado }: Props) {
  const [cargando, setCargando] = useState<"camara" | "galeria" | null>(null);
  const opcionesRecorte = recorteCuadrado ? { editable: true as const, aspecto: [1, 1] as [number, number] } : {};

  const handleTomarFoto = async () => {
    setCargando("camara");
    try {
      const foto = await tomarFoto(opcionesRecorte);
      if (foto) onChange(foto);
    } catch (e: any) {
      avisarError(e.message);
    } finally {
      setCargando(null);
    }
  };

  const handleElegirDeGaleria = async () => {
    setCargando("galeria");
    try {
      const foto = await elegirDeGaleria(opcionesRecorte);
      if (foto) onChange(foto);
    } catch (e: any) {
      avisarError(e.message);
    } finally {
      setCargando(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {value && (
        <View style={[styles.previewWrap, recorteCuadrado && styles.previewWrapCuadrada]}>
          <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
        </View>
      )}
      <View style={styles.filaBotones}>
        <TouchableOpacity
          style={[styles.boton, value ? styles.botonSecundario : styles.botonPrimario, { flex: 1 }]}
          onPress={handleTomarFoto}
          disabled={cargando !== null}
        >
          <Text style={value ? styles.botonSecundarioTexto : styles.botonPrimarioTexto}>
            {cargando === "camara" ? "Abriendo cámara..." : value ? "Repetir foto" : "📷 Tomar foto"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.boton, styles.botonSecundario, { flex: 1 }]}
          onPress={handleElegirDeGaleria}
          disabled={cargando !== null}
        >
          <Text style={styles.botonSecundarioTexto}>
            {cargando === "galeria" ? "Abriendo galería..." : "🖼️ Elegir de galería"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textOnNavy, marginBottom: 4 },
  previewWrap: { height: 160, borderRadius: 10, overflow: "hidden", backgroundColor: colors.navy700, marginBottom: 8 },
  previewWrapCuadrada: { height: 180, width: 180, alignSelf: "center", borderRadius: 90 },
  preview: { flex: 1 },
  filaBotones: { flexDirection: "row", gap: 8 },
  boton: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  botonPrimario: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde },
  botonPrimarioTexto: { color: colors.botonNaranjaTexto, fontWeight: "700", fontSize: 15 },
  botonSecundario: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde },
  botonSecundarioTexto: { color: colors.botonNaranjaTexto, fontWeight: "700", fontSize: 13 },
});
