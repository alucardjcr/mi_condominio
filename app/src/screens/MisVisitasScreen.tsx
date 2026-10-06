import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getMisVisitas } from "../api/client";
import { VisitaHogar } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { formatearFechaHoraISO } from "../utils/fechas";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 79, a pedido explícito del usuario: el residente ve las visitas que
// el guardia registró para su depto — las que están adentro ahora arriba, y
// después las más recientes (el servidor entrega hasta las últimas 100).
export default function MisVisitasScreen() {
  const { token } = useAuth();
  const [visitas, setVisitas] = useState<VisitaHogar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setCargando(true);
      try {
        setVisitas(await getMisVisitas(token));
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const adentro = visitas.filter((v) => !v.fecha_salida).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.gold} />}
    >
      <Text style={styles.titulo}>Mis visitas</Text>
      <Text style={styles.subtitulo}>
        {adentro > 0 ? `${adentro} visita${adentro === 1 ? "" : "s"} dentro del condominio ahora` : "Visitas registradas en tu depto por el guardia"}
      </Text>

      {visitas.length === 0 && <Text style={styles.vacio}>Todavía no hay visitas registradas en tu depto.</Text>}

      {visitas.map((v) => {
        const dentro = !v.fecha_salida;
        const vehicular = v.gls_tipovisita?.toLowerCase().startsWith("veh");
        return (
          <View key={v.id_visita} style={styles.card}>
            <View style={styles.filaTop}>
              <Text style={styles.nombre} numberOfLines={2}>
                {v.nombre_visita}
              </Text>
              <View style={[styles.badge, { backgroundColor: dentro ? "#DCFCE7" : colors.white }]}>
                <Text style={styles.badgeTexto}>{dentro ? "Dentro ahora" : "Ya se retiró"}</Text>
              </View>
            </View>
            <Text style={styles.detalle}>
              {vehicular ? "🚗 Vehicular" : "🚶 Peatonal"}
              {vehicular && v.patente ? `  ·  Patente ${v.patente}` : ""}
              {vehicular && v.numero_estacionamiento ? `  ·  Estac. ${v.numero_estacionamiento}` : ""}
            </Text>
            <Text style={styles.detalle}>Entró: {formatearFechaHoraISO(v.fecha_entrada)}</Text>
            {!dentro && <Text style={styles.detalle}>Salió: {formatearFechaHoraISO(v.fecha_salida)}</Text>}
            {v.nombre_residente_visitado ? <Text style={styles.detalle}>Visitó a: {v.nombre_residente_visitado}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  titulo: { ...typography.title, color: colors.textOnNavy },
  subtitulo: { ...typography.small, color: colors.textMutedOnNavy, marginBottom: spacing.sm },
  vacio: { color: colors.textMutedOnNavy, fontStyle: "italic", marginTop: spacing.md },
  card: { backgroundColor: colors.cardBlue, borderRadius: radius.lg, padding: spacing.md },
  filaTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  nombre: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.textDark },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700", color: colors.textDark },
  detalle: { color: "#344054", fontWeight: "700", marginTop: 4, fontSize: 12 },
});
