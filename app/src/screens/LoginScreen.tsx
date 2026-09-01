import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setCargando(true);
    try {
      await login(usuariocol.trim(), password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.titulo}>Valles de Varoli</Text>
      <Text style={styles.subtitulo}>Control de estacionamientos de visita</Text>

      <Text style={styles.label}>Usuario</Text>
      <TextInput
        style={styles.input}
        value={usuariocol}
        onChangeText={setUsuariocol}
        placeholder="ej: guardia1"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Contraseña</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••"
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.boton} onPress={handleLogin} disabled={cargando}>
        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Ingresar</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  logo: { width: 140, height: 140, alignSelf: "center", marginBottom: 8 },
  titulo: { fontSize: 26, fontWeight: "800", textAlign: "center", color: "#1a1a1a" },
  subtitulo: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 4, marginBottom: 32 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginTop: 4,
  },
  error: { color: "#c0392b", marginTop: 12, textAlign: "center" },
  boton: {
    backgroundColor: "#1a6fc4",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 28,
  },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
