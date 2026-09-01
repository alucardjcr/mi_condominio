import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { superAdminCrearAdministrador, superAdminGetCondominios } from "../../api/client";
import { CondominioSimple } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 27, a pedido explícito del usuario: "solo yo podré crear el rol de
// administrador" — esta pantalla es exclusiva del SuperAdmin (backend la
// rechaza con 403 para cualquier otro rol, ver requireSuperAdmin).
export default function SuperAdminCrearAdminScreen({ navigation }: any) {
  const { token } = useAuth();
  const [condominios, setCondominios] = useState<CondominioSimple[]>([]);
  const [condominioId, setCondominioId] = useState<number | null>(null);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    superAdminGetCondominios(token)
      .then(setCondominios)
      .catch((e) => setError(e.message));
  }, [token]);

  const handleCrear = async () => {
    setError(null);
    setExito(null);
    if (!nombreUsuario.trim() || !usuariocol.trim() || !password) {
      setError("Completa nombre, usuario y contraseña.");
      return;
    }
    if (!condominioId) {
      setError("Elige a qué condominio queda vinculado este Administrador.");
      return;
    }
    if (!token) return;

    setEnviando(true);
    try {
      await superAdminCrearAdministrador(token, {
        nombre_usuario: nombreUsuario.trim(),
        usuariocol: usuariocol.trim(),
        password,
        condominio_id_condominio: condominioId,
      });
      setExito(`Cuenta "${usuariocol.trim()}" creada correctamente.`);
      setNombreUsuario("");
      setUsuariocol("");
      setPassword("");
      setCondominioId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          value={nombreUsuario}
          onChangeText={setNombreUsuario}
          placeholder="ej: María Pérez"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Usuario (para loguearse)</Text>
        <TextInput
          style={styles.input}
          value={usuariocol}
          onChangeText={setUsuariocol}
          placeholder="ej: mperez"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Contraseña inicial</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 4 caracteres"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        <Text style={styles.label}>Condominio al que queda vinculado</Text>
        <View style={styles.listaCondominios}>
          {condominios.map((c) => (
            <TouchableOpacity
              key={c.id_condominio}
              style={[styles.opcionCondominio, condominioId === c.id_condominio && styles.opcionCondominioActiva]}
              onPress={() => setCondominioId(c.id_condominio)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.opcionCondominioTexto,
                  condominioId === c.id_condominio && styles.opcionCondominioTextoActivo,
                ]}
              >
                {c.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ayuda}>
          Si quieres crear el Administrador de un condominio que todavía no existe, primero pídele que él mismo lo
          cree desde su propia cuenta (opción "Crear nuevo condominio"), o crea el condominio a mano y vuelve acá.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {exito && <Text style={styles.exito}>{exito}</Text>}

        <TouchableOpacity
          style={[styles.boton, enviando && styles.botonDeshabilitado]}
          onPress={handleCrear}
          disabled={enviando}
          activeOpacity={0.85}
        >
          {enviando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Crear administrador</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.offWhite },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  ayuda: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
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
  listaCondominios: { gap: spacing.xs, marginTop: 6 },
  opcionCondominio: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm },
  opcionCondominioActiva: { borderColor: colors.navy900, backgroundColor: colors.offWhite },
  opcionCondominioTexto: { color: colors.textMuted, fontWeight: "600" },
  opcionCondominioTextoActivo: { color: colors.navy900 },
  boton: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: 16, alignItems: "center", marginTop: spacing.lg },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: colors.navy900, fontSize: 16, fontWeight: "800" },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  exito: { color: colors.success, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
});
