import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { buscarPaquetes } from "../api/client";
import { Paquete } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

// Pantalla del residente: sus propios paquetes (pendientes y ya
// entregados). No hay filtro de depto acá porque el backend ya acota el
// resultado a la unidad del residente logeado (ver GET /paquetes en
// paquetes.ts) — el residente no puede ver los de otro depto aunque
// intente forzar un parámetro.
function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ESTADOS_PENDIENTES = ["Recepcionado", "Notificado", "En portería"];

export default function MisPaquetesScreen() {
  const { token, guardia } = useAuth();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        const data = await buscarPaquetes(token, { condominio_id: CONDOMINIO_ID });
        setPaquetes(data);
      } catch (e) {
        // silencioso: la pantalla igual queda usable, se puede reintentar con pull-to-refresh
      } finally {
        setLoading(false);
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

  const pendientes = paquetes.filter((p) => ESTADOS_PENDIENTES.includes(p.gls_estadopaquete));
  const historial = paquetes.filter((p) => !ESTADOS_PENDIENTES.includes(p.gls_estadopaquete));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={[...pendientes, ...historial]}
      keyExtractor={(item) => String(item.id_paquete)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.subtitulo}>
            {guardia?.nombre_torre ? `${guardia.nombre_torre} · Depto ${guardia.numero_unidad}` : ""}
          </Text>
          {pendientes.length > 0 && (
            <Text style={styles.seccionTitulo}>
              {pendientes.length} paquete{pendientes.length === 1 ? "" : "s"} esperando retiro
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>No tienes paquetes registrados todavía.</Text>}
      renderItem={({ item, index }) => (
        <View>
          {index === pendientes.length && historial.length > 0 && (
            <Text style={styles.seccionTitulo}>Ya retirados</Text>
          )}
          <View style={[styles.card, ESTADOS_PENDIENTES.includes(item.gls_estadopaquete) && styles.cardPendiente]}>
            <View style={styles.cardHeader}>
              <Text style={styles.tipo}>{item.gls_tipopaquete}</Text>
              <Text style={styles.estado}>{item.gls_estadopaquete}</Text>
            </View>
            <Text style={styles.detalleTexto}>Recibido: {formatearFecha(item.fecha_recepcion)}</Text>
            {item.fecha_entrega && (
              <Text style={styles.detalleTexto}>
                Retirado: {formatearFecha(item.fecha_entrega)} por {item.entregado_a}
              </Text>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  subtitulo: { color: "#888", fontSize: 13, marginBottom: 6 },
  seccionTitulo: { fontSize: 13, fontWeight: "700", color: "#555", marginTop: 10, marginBottom: 6 },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardPendiente: { borderColor: "#8e44ad", borderWidth: 1.5 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  tipo: { fontSize: 12, color: "#888", fontWeight: "600" },
  estado: { fontSize: 12, color: "#8e44ad", fontWeight: "700" },
  detalleTexto: { color: "#555", marginTop: 4, fontSize: 13 },
});
