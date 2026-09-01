import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { adminAsignarTareaPersonal } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";

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
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  subtitulo: { fontSize: 14, color: "#666", marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  ayuda: { color: "#888", fontSize: 12, marginTop: 10, lineHeight: 17 },
  boton: { backgroundColor: "#2e7d32", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
