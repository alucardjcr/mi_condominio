import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { superAdminGetFacturacion } from "../../api/client";
import { CondominioConFacturacion } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

const formatoCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function SuperAdminFacturacionScreen({ navigation }: any) {
  const { token } = useAuth();
  const [condominios, setCondominios] = useState<CondominioConFacturacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    superAdminGetFacturacion(token)
      .then(setCondominios)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {condominios.map((c) => (
        <TouchableOpacity
          key={c.id_condominio}
          style={styles.tarjeta}
          onPress={() => navigation.navigate("SuperAdminFacturacionDetalle", { condominioId: c.id_condominio, nombre: c.nombre })}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>{c.nombre}</Text>
            <Text style={styles.detalle}>
              {c.monto_mensualidad === null
                ? "Sin facturación configurada"
                : `${formatoCLP.format(c.monto_mensualidad)} / mes · día límite ${c.dia_limite_pago}`}
            </Text>
          </View>
          <View style={[styles.badge, c.bloqueado ? styles.badgeBloqueado : c.pagado_periodo_actual ? styles.badgePagado : styles.badgeGracia]}>
            <Text style={styles.badgeTexto}>
              {c.bloqueado ? "Bloqueado" : c.monto_mensualidad === null ? "Sin config." : c.pagado_periodo_actual ? "Al día" : "Pendiente"}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.offWhite },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600", marginBottom: spacing.md },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  nombre: { ...typography.heading, color: colors.textDark },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginLeft: spacing.sm },
  badgePagado: { backgroundColor: "#DCFCE7" },
  badgeGracia: { backgroundColor: "#FEF3C7" },
  badgeBloqueado: { backgroundColor: "#FEE2E2" },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
});
