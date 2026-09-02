import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

function BotonAccion({ label, ayuda, onPress }: { label: string; ayuda: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.boton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={styles.botonTitulo}>{label}</Text>
      <Text style={styles.botonAyuda}>{ayuda}</Text>
    </Pressable>
  );
}

// Ronda 27: panel exclusivo del dueño del sistema (rol SuperAdmin, a pedido
// explícito del usuario: "solo yo podré crear el rol de administrador").
export default function SuperAdminHomeScreen({ navigation }: any) {
  const { guardia, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.saludo}>Hola, {guardia?.nombre_usuario}</Text>
      <Text style={styles.subtitulo}>Panel del sistema</Text>

      <BotonAccion
        label="Facturación de condominios"
        ayuda="Configurar mensualidad, marcar pagos, ver quién está bloqueado"
        onPress={() => navigation.navigate("SuperAdminFacturacion")}
      />
      <BotonAccion
        label="Crear administrador"
        ayuda="Dar de alta una cuenta Administrador nueva para un condominio"
        onPress={() => navigation.navigate("SuperAdminCrearAdmin")}
      />
      <BotonAccion
        label="Administradores"
        ayuda="Ver todas las cuentas Administrador del sistema"
        onPress={() => navigation.navigate("SuperAdminAdministradores")}
      />
      <BotonAccion
        label="Actividad sospechosa"
        ayuda="Intentos de login fallidos y límites de fuerza bruta disparados"
        onPress={() => navigation.navigate("SuperAdminEventosSeguridad")}
      />

      <Pressable onPress={logout} style={({ pressed }) => [styles.cerrarSesion, pressed && { opacity: 0.6 }]}>
        <Text style={styles.cerrarSesionTexto}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.navy900 },
  saludo: { ...typography.heading, textAlign: "center", marginTop: spacing.sm, marginBottom: 4, color: colors.textOnNavy },
  subtitulo: { ...typography.small, textAlign: "center", marginBottom: spacing.lg, color: colors.textMutedOnNavy },
  boton: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  botonTitulo: { ...typography.heading, color: colors.textDark },
  botonAyuda: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  cerrarSesion: { marginTop: spacing.xl, alignItems: "center" },
  cerrarSesionTexto: { color: colors.textMutedOnNavy, fontSize: 13 },
});
