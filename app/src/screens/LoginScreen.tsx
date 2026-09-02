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
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 46, a pedido explícito del usuario: rediseño completo con los
// colores institucionales, siguiendo una referencia visual que mandó — la
// tarjeta de inputs pasa de blanca a translúcida sobre el mismo azul
// (en vez de "una tarjeta blanca flotando"), con íconos dentro de cada
// campo, mostrar/ocultar contraseña, y un botón claro con flecha en vez
// del dorado de antes. Todos los íconos son SVG propios (react-native-svg
// ya estaba instalado, no hace falta agregar ninguna librería de íconos
// nueva) — simples a propósito, no buscan ser pixel-perfect, solo
// reconocibles.
const ANCHO_PANTALLA = Dimensions.get("window").width;

function IconoUsuario() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={colors.textMutedOnNavy} strokeWidth={2} />
      <Path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke={colors.textMutedOnNavy} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconoCandado() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={10} rx={2} stroke={colors.textMutedOnNavy} strokeWidth={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={colors.textMutedOnNavy} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconoOjo({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
          stroke={colors.textMutedOnNavy}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={12} r={3} stroke={colors.textMutedOnNavy} strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.6 6.9C4.4 8.3 3 10.5 2 12c0 0 3.6 7 10 7 1.9 0 3.5-.5 4.9-1.3M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7-.5 1-1.3 2.2-2.4 3.4"
        stroke={colors.textMutedOnNavy}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Skyline decorativo al pie de la pantalla — mismo espíritu que el fondo
// de la referencia, en un tono apenas más claro que el navy de fondo para
// que se note sutil, sin competir con la tarjeta de arriba.
function SkylineDecorativo() {
  const alto = 140;
  return (
    <Svg
      width={ANCHO_PANTALLA}
      height={alto}
      viewBox={`0 0 ${ANCHO_PANTALLA} ${alto}`}
      style={styles.skyline}
      pointerEvents="none"
    >
      <Rect x={ANCHO_PANTALLA * 0.05} y={alto * 0.35} width={ANCHO_PANTALLA * 0.14} height={alto * 0.65} fill={colors.navy700} />
      <Rect x={ANCHO_PANTALLA * 0.22} y={alto * 0.15} width={ANCHO_PANTALLA * 0.16} height={alto * 0.85} fill={colors.navy700} />
      <Rect x={ANCHO_PANTALLA * 0.62} y={alto * 0.3} width={ANCHO_PANTALLA * 0.14} height={alto * 0.7} fill={colors.navy700} />
      <Rect x={ANCHO_PANTALLA * 0.8} y={alto * 0.45} width={ANCHO_PANTALLA * 0.14} height={alto * 0.55} fill={colors.navy700} />
      <Path
        d={`M${ANCHO_PANTALLA * 0.4} ${alto} V${alto * 0.55} L${ANCHO_PANTALLA * 0.48} ${alto * 0.42} L${ANCHO_PANTALLA * 0.56} ${alto * 0.55} V${alto}`}
        fill={colors.navy700}
      />
    </Svg>
  );
}

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
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
    <View style={styles.container}>
      <SkylineDecorativo />
      <KeyboardAvoidingView style={styles.contenido} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Image source={require("../../assets/logo-login.png")} style={styles.logo} resizeMode="contain" />

        <View style={styles.card}>
          <Text style={styles.label}>Usuario</Text>
          <View style={[styles.inputWrap, usuarioEnFoco && styles.inputWrapEnFoco]}>
            <IconoUsuario />
            <TextInput
              style={styles.input}
              value={usuariocol}
              onChangeText={setUsuariocol}
              onFocus={() => setUsuarioEnFoco(true)}
              onBlur={() => setUsuarioEnFoco(false)}
              placeholder="Ingresa tu usuario"
              placeholderTextColor={colors.textMutedOnNavy}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.inputWrap, passwordEnFoco && styles.inputWrapEnFoco]}>
            <IconoCandado />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordEnFoco(true)}
              onBlur={() => setPasswordEnFoco(false)}
              placeholder="Ingresa tu contraseña"
              placeholderTextColor={colors.textMutedOnNavy}
              secureTextEntry={!passwordVisible}
            />
            <TouchableOpacity onPress={() => setPasswordVisible((v) => !v)} hitSlop={10}>
              <IconoOjo visible={passwordVisible} />
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.boton, cargando && styles.botonDeshabilitado]}
            onPress={handleLogin}
            disabled={cargando}
            activeOpacity={0.85}
          >
            {cargando ? (
              <ActivityIndicator color={colors.navy900} />
            ) : (
              <View style={styles.botonContenido}>
                <Text style={styles.botonTexto}>Ingresar</Text>
                <Text style={styles.botonFlecha}>→</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.olvideWrap}
            onPress={() => navigation.navigate("RecuperarPassword")}
            activeOpacity={0.7}
          >
            <Text style={styles.olvideTexto}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.privacidadWrap}
          onPress={() => navigation.navigate("AvisoPrivacidad")}
          activeOpacity={0.7}
        >
          <View style={styles.linea} />
          <Text style={styles.privacidadTexto}>Aviso de privacidad</Text>
          <View style={styles.linea} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  contenido: { flex: 1, justifyContent: "center", padding: spacing.lg },
  skyline: { position: "absolute", bottom: 0, left: 0, opacity: 0.5 },
  logo: {
    alignSelf: "center",
    width: ANCHO_PANTALLA * 0.75,
    height: ANCHO_PANTALLA * 0.75,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { ...typography.label, color: colors.textOnNavy, marginTop: spacing.sm, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  inputWrapEnFoco: { borderColor: colors.gold },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textOnNavy,
  },
  error: { color: "#FF8A80", marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  boton: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonContenido: { flexDirection: "row", alignItems: "center", gap: 8 },
  botonTexto: { color: colors.navy900, fontSize: 16, fontWeight: "800" },
  botonFlecha: { color: colors.navy900, fontSize: 18, fontWeight: "800" },
  olvideWrap: { marginTop: spacing.md, alignItems: "center" },
  olvideTexto: { color: colors.textOnNavy, fontSize: 14, fontWeight: "700" },
  privacidadWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.lg, paddingHorizontal: spacing.md },
  linea: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  privacidadTexto: { color: colors.textMutedOnNavy, fontSize: 12, fontWeight: "600" },
});
