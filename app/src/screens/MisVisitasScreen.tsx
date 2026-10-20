import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getMisVisitas, responderVisita } from "../api/client";
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
      // Ronda 80: se refresca sola para que una visita por autorizar aparezca al toque.
      const id = setInterval(() => {
        if (token) getMisVisitas(token).then(setVisitas).catch(() => {});
      }, 15000);
      return () => clearInterval(id);
    }, [cargar, token])
  );

  const [respondiendo, setRespondiendo] = useState<number | null>(null);
  const responder = async (v: VisitaHogar, accion: "autorizar" | "rechazar") => {
    if (!token) return;
    const hacer = async () => {
      setRespondiendo(v.id_visita);
      try {
        await responderVisita(token, v.id_visita, accion);
        await cargar(true);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setRespondiendo(null);
      }
    };
    if (accion === "rechazar") {
      Alert.alert("Rechazar visita", `¿Confirmas que ${v.nombre_visita} NO debe ingresar?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Rechazar", style: "destructive", onPress: hacer },
      ]);
    } else {
      hacer();
    }
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const adentro = visitas.filter((v) => !v.fecha_salida && v.estado_autorizacion !== "Pendiente").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
    >
      <Text style={styles.titulo}>Mis visitas</Text>
      <Text style={styles.subtitulo}>
        {adentro > 0 ? `${adentro} visita${adentro === 1 ? "" : "s"} dentro del condominio ahora` : "Visitas registradas en tu depto por el guardia"}
      </Text>

      {visitas.length === 0 && <Text style={styles.vacio}>Todavía no hay visitas registradas en tu depto.</Text>}

      {visitas.map((v) => {
        const pendiente = v.estado_autorizacion === "Pendiente";
        const rechazada = v.estado_autorizacion === "Rechazada";
        const dentro = !v.fecha_salida && !pendiente;
        const vehicular = v.gls_tipovisita?.toLowerCase().startsWith("veh");
        return (
          <View key={v.id_visita} style={styles.card}>
            <View style={styles.filaTop}>
              <Text style={styles.nombre} numberOfLines={2}>
                {v.nombre_visita}
              </Text>
              <View style={[styles.badge, { backgroundColor: pendiente ? "#FDE9C8" : rechazada ? "#FEE2E2" : dentro ? "#DCFCE7" : colors.white }]}>
                <Text style={styles.badgeTexto}>
                  {pendiente ? "Por autorizar" : rechazada ? "Rechazada" : dentro ? "Dentro ahora" : "Ya se retiró"}
                </Text>
              </View>
            </View>
            <Text style={styles.detalle}>
              {vehicular ? "🚗 Vehicular" : "🚶 Peatonal"}
              {vehicular && v.patente ? `  ·  Patente ${v.patente}` : ""}
              {vehicular && v.numero_estacionamiento ? `  ·  Estac. ${v.numero_estacionamiento}` : ""}
            </Text>
            <Text style={styles.detalle}>{pendiente ? "Llegó a portería" : "Entró"}: {formatearFechaHoraISO(v.fecha_entrada)}</Text>
            {!dentro && !pendiente && !rechazada && <Text style={styles.detalle}>Salió: {formatearFechaHoraISO(v.fecha_salida)}</Text>}
            {pendiente && (
              <View style={styles.accionesFila}>
                <TouchableOpacity
                  style={[styles.botonAutorizar, respondiendo === v.id_visita && { opacity: 0.5 }]}
                  disabled={respondiendo === v.id_visita}
                  onPress={() => responder(v, "autorizar")}
                >
                  <Text style={styles.botonAutorizarTexto}>✅ Autorizar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonRechazar, respondiendo === v.id_visita && { opacity: 0.5 }]}
                  disabled={respondiendo === v.id_visita}
                  onPress={() => responder(v, "rechazar")}
                >
                  <Text style={styles.botonRechazarTexto}>⛔ Rechazar</Text>
                </TouchableOpacity>
              </View>
            )}
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
  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.md },
  filaTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  nombre: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.textOnNavy },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700", color: colors.textDark },
  detalle: { color: colors.textMutedOnNavy, fontWeight: "700", marginTop: 4, fontSize: 12 },
  accionesFila: { flexDirection: "row", gap: 10, marginTop: 10 },
  botonAutorizar: {
    flex: 1,
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonAutorizarTexto: { color: colors.botonNaranjaTexto, fontWeight: "800" },
  botonRechazar: { flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  botonRechazarTexto: { color: colors.danger, fontWeight: "800" },
});
