import React, { useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tomarFoto } from "../utils/camara";

interface Props {
  label: string;
  value: string | null; // data URL ya capturado, o null
  onChange: (dataUrl: string | null) => void;
}

// Botón de "tomar foto" con la cámara + preview + opción de repetirla.
// Se usa tanto para la foto obligatoria al recibir un paquete como para la
// foto de quien lo retira (cuando no es la persona a la que venía dirigido).
export default function FotoCapture({ label, value, onChange }: Props) {
  const [tomando, setTomando] = useState(false);

  const handleTomarFoto = async () => {
    setTomando(true);
    try {
      const foto = await tomarFoto();
      if (foto) onChange(foto);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setTomando(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <>
          <View style={styles.previewWrap}>
            <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
          </View>
          <TouchableOpacity style={styles.botonSecundario} onPress={handleTomarFoto} disabled={tomando}>
            <Text style={styles.botonSecundarioTexto}>{tomando ? "Abriendo cámara..." : "Repetir foto"}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.botonPrimario} onPress={handleTomarFoto} disabled={tomando}>
          <Text style={styles.botonPrimarioTexto}>{tomando ? "Abriendo cámara..." : "📷 Tomar foto"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 4 },
  previewWrap: { height: 160, borderRadius: 10, overflow: "hidden", backgroundColor: "#fafafa" },
  preview: { flex: 1 },
  botonPrimario: { backgroundColor: "#1a6fc4", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  botonPrimarioTexto: { color: "#fff", fontWeight: "700", fontSize: 16 },
  botonSecundario: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  botonSecundarioTexto: { color: "#555", fontWeight: "600" },
});
