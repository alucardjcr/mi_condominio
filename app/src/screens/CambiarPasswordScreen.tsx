import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../theme/theme";
import { cambiarPassword } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { validarPassword, AYUDA_PASSWORD } from "../utils/validarPassword";

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
    const errorPassword = validarPassword(nueva);
    if (errorPassword) {
      Alert.alert("Contraseña insegura", errorPassword);
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
      <TextInput style={styles.input} value={actual} onChangeText={setActual} secureTextEntry placeholder="••••••" placeholderTextColor={colors.textMutedOnNavy} />

      <Text style={styles.label}>Contraseña nueva</Text>
      <Text style={styles.ayuda}>{AYUDA_PASSWORD}</Text>
      <TextInput style={styles.input} value={nueva} onChangeText={setNueva} secureTextEntry placeholder="ej: Matimania1500!" placeholderTextColor={colors.textMutedOnNavy} />

      <Text style={styles.label}>Confirmar contraseña nueva</Text>
      <TextInput style={styles.input} value={confirmacion} onChangeText={setConfirmacion} secureTextEntry placeholder="••••••" placeholderTextColor={colors.textMutedOnNavy} />

      <TouchableOpacity style={styles.boton} onPress={handleGuardar} disabled={guardando}>
        {guardando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.navy900 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textOnNavy, marginTop: 16 },
  ayuda: { fontSize: 12, color: colors.textMutedOnNavy, marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.navy600, borderRadius: 10, padding: 14, fontSize: 16, marginTop: 4, backgroundColor: colors.navy700, color: colors.textOnNavy },
  boton: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  botonTexto: { color: colors.botonNaranjaTexto, fontSize: 16, fontWeight: "700" },
});
