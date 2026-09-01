import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { resetearPassword, solicitarRecuperacion } from "../api/client";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 25: "olvidé mi contraseña", accesible desde el link en LoginScreen
// (sin sesión). Flujo de 2 pasos en una sola pantalla:
//   1) el usuario escribe su usuariocol o su correo registrado -> se le
//      "envía" un código de 6 dígitos (por ahora simulado, ver
//      auth.service.ts -> enviarCodigoPorCorreo: queda logueado en el
//      servidor mientras no se conecte un proveedor de correo real).
//   2) el usuario ingresa el código + su contraseña nueva -> si el código
//      es válido y no expiró (15 min), la contraseña queda actualizada y
//      vuelve al Login para entrar con la nueva.
// El backend responde siempre con un mensaje genérico en el paso 1 (exista
// o no el usuario/correo) para no filtrar esa información — ver
// solicitarRecuperacion en auth.service.ts.
export default function RecuperarPasswordScreen({ navigation }: any) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [identificador, setIdentificador] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSolicitar = async () => {
    setError(null);
    if (!identificador.trim()) {
      setError("Ingresa tu usuario o tu correo registrado.");
      return;
    }
    setCargando(true);
    try {
      const resp = await solicitarRecuperacion(identificador.trim());
      setMensaje(resp.mensaje);
      setPaso(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const handleResetear = async () => {
    setError(null);
    if (!codigo.trim() || !nueva || !confirmacion) {
      setError("Completa el código y la contraseña nueva.");
      return;
    }
    if (nueva !== confirmacion) {
      setError("La contraseña nueva y su confirmación deben ser iguales.");
      return;
    }
    setCargando(true);
    try {
      await resetearPassword(identificador.trim(), codigo.trim(), nueva);
      setMensaje("Tu contraseña se actualizó. Ya puedes iniciar sesión con la nueva.");
      setTimeout(() => navigation.navigate("Login"), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.titulo}>Recuperar contraseña</Text>
      <Text style={styles.subtitulo}>
        {paso === 1
          ? "Escribe tu usuario o tu correo registrado. Te enviaremos un código de 6 dígitos."
          : "Ingresa el código que recibiste y tu contraseña nueva."}
      </Text>

      <View style={styles.card}>
        {paso === 1 ? (
          <>
            <Text style={styles.label}>Usuario o correo</Text>
            <TextInput
              style={styles.input}
              value={identificador}
              onChangeText={setIdentificador}
              placeholder="ej: guardia1 o tucorreo@ejemplo.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.boton, cargando && styles.botonDeshabilitado]}
              onPress={handleSolicitar}
              disabled={cargando}
              activeOpacity={0.85}
            >
              {cargando ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <Text style={styles.botonTexto}>Enviar código</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}

            <Text style={styles.label}>Código de 6 dígitos</Text>
            <TextInput
              style={styles.input}
              value={codigo}
              onChangeText={setCodigo}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Text style={styles.label}>Contraseña nueva</Text>
            <TextInput
              style={styles.input}
              value={nueva}
              onChangeText={setNueva}
              secureTextEntry
              placeholder="Mínimo 4 caracteres"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Confirmar contraseña nueva</Text>
            <TextInput
              style={styles.input}
              value={confirmacion}
              onChangeText={setConfirmacion}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.boton, cargando && styles.botonDeshabilitado]}
              onPress={handleResetear}
              disabled={cargando}
              activeOpacity={0.85}
            >
              {cargando ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <Text style={styles.botonTexto}>Restablecer contraseña</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reenviarWrap}
              onPress={() => {
                setPaso(1);
                setCodigo("");
                setNueva("");
                setConfirmacion("");
                setError(null);
                setMensaje(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.reenviarTexto}>¿No te llegó? Solicitar otro código</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.volverWrap} onPress={() => navigation.navigate("Login")} activeOpacity={0.7}>
          <Text style={styles.volverTexto}>Volver a iniciar sesión</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.navy900 },
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
  mensaje: { color: colors.success, marginBottom: spacing.md, textAlign: "center", fontWeight: "600" },
  boton: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonTexto: { color: colors.navy900, fontSize: 16, fontWeight: "800" },
  reenviarWrap: { marginTop: spacing.md, alignItems: "center" },
  reenviarTexto: { color: colors.info, fontSize: 14, fontWeight: "700" },
  volverWrap: { marginTop: spacing.sm, alignItems: "center" },
  volverTexto: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
});
