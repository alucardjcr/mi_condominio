import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getDisponibilidad } from "../api/client";
import { Estacionamiento } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

const COLOR_POR_ESTADO: Record<string, string> = {
  Disponible: "#1a9d5c",
  Ocupado: "#c0392b",
  "Fuera de servicio": "#888",
};

export default function DisponibilidadScreen() {
  const { token } = useAuth();
  const [cupos, setCupos] = useState<Estacionamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await getDisponibilidad(token, CONDOMINIO_ID);
      setCupos(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  const cuposVisita = cupos.filter((c) => c.gls_tipoestacionamiento === "Visita");
  const cuposDiscapacitado = cupos.filter((c) => c.gls_tipoestacionamiento === "Discapacitado");
  const disponiblesVisita = cuposVisita.filter((c) => c.gls_estadoestacionamiento === "Disponible").length;
  const disponiblesDiscapacitado = cuposDiscapacitado.filter(
    (c) => c.gls_estadoestacionamiento === "Disponible"
  ).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.resumen}>
        <Text style={styles.resumenTexto}>
          {disponiblesVisita} de {cuposVisita.length} cupos de visita disponibles
        </Text>
        <Text style={styles.resumenTexto}>
          ♿ {disponiblesDiscapacitado} de {cuposDiscapacitado.length} cupos de discapacitados disponibles
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={cupos}
        keyExtractor={(item) => String(item.id_estacionamiento)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              cargar();
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.numero}>
                {item.gls_tipoestacionamiento === "Discapacitado" ? "♿ " : ""}
                {item.numero_estacionamiento}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: COLOR_POR_ESTADO[item.gls_estadoestacionamiento] || "#888" },
                ]}
              >
                <Text style={styles.badgeTexto}>{item.gls_estadoestacionamiento}</Text>
              </View>
            </View>
            {item.ubicacion && <Text style={styles.ubicacion}>{item.ubicacion}</Text>}
            {item.visita_activa_nombre && (
              <Text style={styles.ocupante}>
                {item.visita_activa_nombre}
                {item.visita_activa_patente ? ` · ${item.visita_activa_patente}` : ""}
              </Text>
            )}
          </View>
        )}
        contentContainerStyle={{ padding: 16, gap: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  resumen: { padding: 16, paddingBottom: 4 },
  resumenTexto: { fontSize: 16, fontWeight: "600", color: "#222" },
  error: { color: "#c0392b", paddingHorizontal: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  numero: { fontSize: 18, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTexto: { color: "#fff", fontSize: 12, fontWeight: "600" },
  ubicacion: { color: "#666", marginTop: 4 },
  ocupante: { color: "#333", marginTop: 6, fontWeight: "500" },
});
