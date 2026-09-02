import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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

// Ronda 39, a pedido explícito del usuario: la app ya no es de un
// condominio en particular (antes decía "Valles de Varoli / Control de
// estacionamientos de visita" acá) — es un producto que sirve para
// cualquier condominio, así que el login ya no menciona ninguno en
// especial. El nombre del condominio real de cada quien ya se ve después,
// dentro de la app (menú lateral, Home, etc.).
const ANCHO_PANTALLA = Dimensions.get("window").width;

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [usuarioEnFoco, setUsuarioEnFoco] = useState(false);
  const [passwordEnFoco, setPasswordEnFoco] = useState(false);

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

      <View style={styles.card}>
        <Text style={styles.label}>Usuario</Text>
        <TextInput
          style={[styles.input, usuarioEnFoco && styles.inputEnFoco]}
          value={usuariocol}
          onChangeText={setUsuariocol}
          onFocus={() => setUsuarioEnFoco(true)}
          onBlur={() => setUsuarioEnFoco(false)}
          placeholder="ej: guardia1"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={[styles.input, passwordEnFoco && styles.inputEnFoco]}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordEnFoco(true)}
          onBlur={() => setPasswordEnFoco(false)}
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

        <TouchableOpacity
          style={styles.privacidadWrap}
          onPress={() => navigation.navigate("AvisoPrivacidad")}
          activeOpacity={0.7}
        >
          <Text style={styles.privacidadTexto}>Aviso de privacidad</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.navy900 },
  // Antes 140x140 — a pedido del usuario, ahora ocupa buena parte del
  // ancho de pantalla (75%), escalado desde Dimensions para verse bien
  // tanto en un iPhone chico como en una tablet.
  logo: {
    alignSelf: "center",
    width: ANCHO_PANTALLA * 0.75,
    height: ANCHO_PANTALLA * 0.75,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  // Ronda 39, a pedido explícito del usuario: el borde cambia de color
  // cuando el campo tiene el foco (onFocus/onBlur más arriba), para que
  // quede claro en cuál se está escribiendo.
  inputEnFoco: { borderColor: colors.navy900, borderWidth: 2 },
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
  privacidadWrap: { marginTop: spacing.sm, alignItems: "center" },
  privacidadTexto: { color: colors.textMutedOnNavy, fontSize: 12, fontWeight: "600" },
});
