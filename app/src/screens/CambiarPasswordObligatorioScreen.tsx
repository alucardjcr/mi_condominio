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

// Ronda 72, a pedido explícito del usuario: cuando el SuperAdmin crea un
// Administrador, le pone una contraseña inicial que solo tiene que cumplir
// el mínimo de seguridad (12 caracteres, mayúscula, número, símbolo) — pero
// sigue siendo una clave elegida por OTRA persona, no por el propio
// Administrador. La PRIMERA vez que esa cuenta hace login, la app lo trae
// ACÁ antes que a cualquier otra pantalla (ver App.tsx ->
// requiereCambioPasswordInicial) y lo obliga a elegir su propia contraseña.
// A diferencia de OnboardingResidenteScreen, acá el usuario (usuariocol) NO
// cambia — ya lo eligió el SuperAdmin al crear la cuenta — solo la clave.
export default function CambiarPasswordObligatorioScreen() {
  const { guardia, completarCambioPasswordInicial, logout } = useAuth();
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleContinuar = async () => {
    setError(null);
    const errorPassword = validarPassword(passwordNueva);
    if (errorPassword) {
      setError(errorPassword);
      return;
    }
    if (passwordNueva !== confirmacion) {
      setError("La contraseña y su confirmación deben ser iguales.");
      return;
    }
    setCargando(true);
    try {
      await completarCambioPasswordInicial(passwordNueva);
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
        Es tu primera vez entrando a Mi Condominio. Por seguridad, antes de continuar debes cambiar la contraseña
        que te asignaron por una propia.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Tu nueva contraseña</Text>
        <Text style={styles.ayuda}>{AYUDA_PASSWORD}</Text>
        <TextInput
          style={styles.input}
          value={passwordNueva}
          onChangeText={setPasswordNueva}
          placeholder="ej: Matimania1500!"
          placeholderTextColor={colors.textMutedOnNavy}
          secureTextEntry
        />

        <Text style={styles.label}>Confirmar contraseña</Text>
        <TextInput
          style={styles.input}
          value={confirmacion}
          onChangeText={setConfirmacion}
          placeholder="••••••"
          placeholderTextColor={colors.textMutedOnNavy}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.boton, cargando && styles.botonDeshabilitado]}
          onPress={handleContinuar}
          disabled={cargando}
          activeOpacity={0.85}
        >
          {cargando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Continuar</Text>}
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
  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg },
  label: { ...typography.label, color: colors.textOnNavy, marginTop: spacing.sm },
  ayuda: { ...typography.small, color: colors.textMutedOnNavy, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textOnNavy,
    backgroundColor: colors.navy700,
  },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  boton: {
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTexto: { color: colors.botonNaranjaTexto, fontSize: 16, fontWeight: "800" },
  salirWrap: { marginTop: spacing.md, alignItems: "center" },
  salirTexto: { color: colors.textMutedOnNavy, fontSize: 13, fontWeight: "600" },
});
