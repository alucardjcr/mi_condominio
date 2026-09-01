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
import { colors, radius, spacing, typography } from "../theme/theme";

export default function LoginScreen({ navigation }: any) {
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
      <Image source={require("../../assets/logo-login.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.titulo}>Valles de Varoli</Text>
      <Text style={styles.subtitulo}>Control de estacionamientos de visita</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Usuario</Text>
        <TextInput
          style={styles.input}
          value={usuariocol}
          onChangeText={setUsuariocol}
          placeholder="ej: guardia1"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={handleLogin}
          disabled={cargando}
          activeOpacity={0.85}
        >
          {cargando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Ingresar</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.olvideWrap}
          onPress={() => navigation.navigate("RecuperarPassword")}
          activeOpacity={0.7}
        >
          <Text style={styles.olvideTexto}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.navy900 },
  logo: { alignSelf: "center", width: 140, height: 140, marginBottom: spacing.md },
  titulo: { ...typography.title, textAlign: "center", color: colors.textOnNavy },
  subtitulo: {
    ...typography.body,
    color: colors.textMutedOnNavy,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  boton: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTexto: { color: colors.navy900, fontSize: 16, fontWeight: "800" },
  olvideWrap: { marginTop: spacing.md, alignItems: "center" },
  olvideTexto: { color: colors.info, fontSize: 14, fontWeight: "700" },
});
