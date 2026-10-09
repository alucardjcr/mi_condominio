import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { adminAsignarTareaPersonal } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors } from "../../theme/theme";

// Ronda 18, a pedido explícito del usuario: tarea de texto libre (no una
// plantilla de checklist — "en realidad ellos saben sus deberes"), que le
// llega al trabajador como notificación (bandeja + push best-effort).
export default function AdminAsignarTareaScreen({ route, navigation }: any) {
  const { idUsuario, nombre } = route.params as { idUsuario: number; nombre: string };
  const { token } = useAuth();
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (!token || !descripcion.trim()) {
      Alert.alert("Falta la tarea", "Escribe qué necesitas que haga.");
      return;
    }
    setEnviando(true);
    try {
      await adminAsignarTareaPersonal(token, idUsuario, descripcion.trim(), CONDOMINIO_ID);
      Alert.alert("Listo", `Le llegó como notificación a ${nombre}.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>Para: {nombre}</Text>
      <Text style={styles.label}>¿Qué necesitas que haga?</Text>
      <TextInput
        style={styles.input}
        placeholder='Ej: "Cortar árboles costado sur"'
        placeholderTextColor={colors.textMutedOnNavy}
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />
      <Text style={styles.ayuda}>
        Le va a llegar como notificación (dentro de la app, y como push si tiene el celular
        habilitado) — no es una lista de tareas, solo este mensaje.
      </Text>
      <TouchableOpacity style={styles.boton} onPress={handleEnviar} disabled={enviando}>
        <Text style={styles.botonTexto}>{enviando ? "Enviando..." : "Enviar tarea"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900, padding: 16 },
  subtitulo: { fontSize: 14, color: colors.textMutedOnNavy, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textOnNavy, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    backgroundColor: colors.navy700,
    color: colors.textOnNavy,
  },
  ayuda: { color: colors.textMutedOnNavy, fontSize: 12, marginTop: 10, lineHeight: 17 },
  boton: {
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },
  botonTexto: { color: colors.botonNaranjaTexto, fontWeight: "700", fontSize: 16 },
});
