import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { cambiarPassword } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Disponible para cualquier rol logeado (Guardia, Administrador o
// Residente) — pide la contraseña actual para confirmar identidad. Útil en
// particular para que un residente cambie la contraseña inicial que le
// asignó el administrador al activarle el acceso.
export default function CambiarPasswordScreen({ navigation }: any) {
  const { token, logout } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!token) return;
    if (!actual || !nueva || !confirmacion) {
      Alert.alert("Faltan datos", "Completa los tres campos.");
      return;
    }
    if (nueva !== confirmacion) {
      Alert.alert("No coinciden", "La contraseña nueva y su confirmación deben ser iguales.");
      return;
    }
    setGuardando(true);
    try {
      await cambiarPassword(token, actual, nueva);
      Alert.alert("Listo", "Tu contraseña se actualizó. Vuelve a iniciar sesión con la nueva.", [
        { text: "OK", onPress: logout },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Contraseña actual</Text>
      <TextInput style={styles.input} value={actual} onChangeText={setActual} secureTextEntry placeholder="••••••" />

      <Text style={styles.label}>Contraseña nueva</Text>
      <TextInput style={styles.input} value={nueva} onChangeText={setNueva} secureTextEntry placeholder="Mínimo 4 caracteres" />

      <Text style={styles.label}>Confirmar contraseña nueva</Text>
      <TextInput style={styles.input} value={confirmacion} onChangeText={setConfirmacion} secureTextEntry placeholder="••••••" />

      <TouchableOpacity style={styles.boton} onPress={handleGuardar} disabled={guardando}>
        {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 16 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 14, fontSize: 16, marginTop: 4 },
  boton: { backgroundColor: "#1a6fc4", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
