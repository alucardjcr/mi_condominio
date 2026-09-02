import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";
import { validarPassword, AYUDA_PASSWORD } from "../utils/validarPassword";

// Ronda 37, a pedido explícito del usuario: cuando el administrador activa
// el acceso de un residente, le da un usuario y clave TEMPORALES (ver
// admin.service.ts -> activarAccesoResidente). La primera vez que ese
// residente entra, la app lo trae ACÁ antes que a cualquier otra pantalla
// (ver App.tsx -> requiereOnboarding) y lo obliga a elegir su usuario
// definitivo (único en todo el sistema) y su propia contraseña. Recién
// después de esto entra normal a la app — no puede "saltarse" este paso.
export default function OnboardingResidenteScreen() {
  const { guardia, completarOnboarding, logout } = useAuth();
  const [usuarioNuevo, setUsuarioNuevo] = useState("");
  const [passwordNuevo, setPasswordNuevo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleContinuar = async () => {
    setError(null);
    if (!usuarioNuevo.trim() || usuarioNuevo.trim().length < 4) {
      setError("El usuario debe tener al menos 4 caracteres.");
      return;
    }
    const errorPassword = validarPassword(passwordNuevo);
    if (errorPassword) {
      setError(errorPassword);
      return;
    }
    if (passwordNuevo !== confirmacion) {
      setError("La contraseña y su confirmación deben ser iguales.");
      return;
    }
    setCargando(true);
    try {
      await completarOnboarding(usuarioNuevo.trim(), passwordNuevo);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.titulo}>¡Bienvenido{guardia?.nombre_usuario ? `, ${guardia.nombre_usuario}` : ""}!</Text>
      <Text style={styles.subtitulo}>
        Es tu primera vez entrando a Mi Condominio. Antes de continuar, elige tu propio usuario y contraseña — el
        que te dio el administrador era solo temporal.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Tu usuario (mínimo 4 caracteres)</Text>
        <TextInput
          style={styles.input}
          value={usuarioNuevo}
          onChangeText={setUsuarioNuevo}
          placeholder="ej: juan.perez"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Tu nueva contraseña</Text>
        <Text style={styles.ayuda}>{AYUDA_PASSWORD}</Text>
        <TextInput
          style={styles.input}
          value={passwordNuevo}
          onChangeText={setPasswordNuevo}
          placeholder="ej: Matimania1500!"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        <Text style={styles.label}>Confirmar contraseña</Text>
        <TextInput
          style={styles.input}
          value={confirmacion}
          onChangeText={setConfirmacion}
          placeholder="••••••"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={handleContinuar}
          disabled={cargando}
          activeOpacity={0.85}
        >
          {cargando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Continuar</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.salirWrap} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.salirTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.navy900 },
  titulo: { ...typography.title, color: colors.textOnNavy, textAlign: "center", marginBottom: spacing.sm },
  subtitulo: {
    ...typography.body,
    color: colors.textMutedOnNavy,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  ayuda: { ...typography.small, color: colors.textMuted, marginTop: 2 },
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
  salirWrap: { marginTop: spacing.md, alignItems: "center" },
  salirTexto: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
});
