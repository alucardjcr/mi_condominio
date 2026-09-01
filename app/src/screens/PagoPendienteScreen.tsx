import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 27, a pedido explícito del usuario: se muestra cuando la cuenta
// que se logeó tiene TODOS sus condominios con la mensualidad pendiente
// (ver AuthContext.pagoPendiente / auth.service.ts -> login()). No hay
// acceso a ningún módulo — ni notificaciones, ni avisos, nada — solo este
// mensaje y (para el Administrador) el botón de pago.
export default function PagoPendienteScreen() {
  const { rolPagoPendiente, logout } = useAuth();
  const esAdministrador = rolPagoPendiente === "Administrador";

  const handlePagar = () => {
    // TODO: acá se conecta la pasarela de pago (Webpay u otra) cuando esté
    // lista — por ahora es un placeholder a pedido del usuario ("por ahora
    // solo manual, pero déjalo preparado para conectar una pasarela
    // después"). El pago se sigue marcando a mano desde el panel del
    // SuperAdmin mientras tanto (ver SuperAdminFacturacionScreen).
    Alert.alert(
      "Pago en línea",
      "El pago en línea todavía no está disponible. Contacta a la administración del sistema para regularizar tu mensualidad."
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icono}>⏸️</Text>
      <Text style={styles.titulo}>Mensualidad pendiente</Text>
      <Text style={styles.texto}>
        {esAdministrador
          ? "El condominio que administras tiene la mensualidad de este mes pendiente. La app queda bloqueada hasta regularizar el pago."
          : "El condominio no está disponible en este momento. Contacta a tu administración para más información."}
      </Text>

      {esAdministrador && (
        <TouchableOpacity style={styles.botonPagar} onPress={handlePagar} activeOpacity={0.85}>
          <Text style={styles.botonPagarTexto}>Pagar ahora</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.salirWrap} onPress={logout} activeOpacity={0.7}>
        <Text style={styles.salirTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg, backgroundColor: colors.navy900 },
  icono: { fontSize: 48, marginBottom: spacing.md },
  titulo: { ...typography.title, color: colors.textOnNavy, textAlign: "center", marginBottom: spacing.sm },
  texto: { ...typography.body, color: colors.textMutedOnNavy, textAlign: "center", marginBottom: spacing.xl },
  botonPagar: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    width: "100%",
    alignItems: "center",
  },
  botonPagarTexto: { color: colors.navy900, fontSize: 16, fontWeight: "800" },
  salirWrap: { marginTop: spacing.xl, alignItems: "center" },
  salirTexto: { color: colors.textMutedOnNavy, fontSize: 14, fontWeight: "600" },
});
