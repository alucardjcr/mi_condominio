import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { buscarPaquetes } from "../api/client";
import { Paquete } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import PaqueteResidenteCard, { ESTADOS_PENDIENTES } from "../components/PaqueteResidenteCard";
import { colors } from "../theme/theme";

const CANTIDAD_RETIRADOS = 5;

type Fila =
  | { tipo: "paquete"; paquete: Paquete }
  | { tipo: "separador" };

// Pantalla del residente: primero los paquetes pendientes de retiro, luego un
// separador y los últimos 5 ya retirados. Para ver más antiguos hay un botón
// que lleva a la búsqueda por fechas. El backend ya acota el resultado al depto
// (y a los paquetes dirigidos a este residente), ver GET /paquetes.
export default function MisPaquetesScreen({ navigation }: any) {
  const { token, guardia } = useAuth();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setPaquetes(await buscarPaquetes(token, { condominio_id: CONDOMINIO_ID }));
      } catch (e) {
        // silencioso: se puede reintentar con pull-to-refresh
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
  const retirados = paquetes
    .filter((p) => !ESTADOS_PENDIENTES.includes(p.gls_estadopaquete))
    .sort((a, b) => String(b.fecha_entrega ?? b.fecha_recepcion).localeCompare(String(a.fecha_entrega ?? a.fecha_recepcion)))
    .slice(0, CANTIDAD_RETIRADOS);

  const filas: Fila[] = [
    ...pendientes.map((p) => ({ tipo: "paquete" as const, paquete: p })),
    ...(retirados.length > 0 ? [{ tipo: "separador" as const }] : []),
    ...retirados.map((p) => ({ tipo: "paquete" as const, paquete: p })),
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={filas}
      keyExtractor={(f, i) => (f.tipo === "paquete" ? String(f.paquete.id_paquete) : `sep-${i}`)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.subtitulo}>
            {guardia?.nombre_torre ? `${guardia.nombre_torre} · Depto ${guardia.numero_unidad}` : ""}
          </Text>
          <Text style={styles.seccionTitulo}>
            {pendientes.length > 0
              ? `Tienes ${pendientes.length} paquete${pendientes.length === 1 ? "" : "s"} pendiente${pendientes.length === 1 ? "" : "s"} de retiro`
              : "No tienes paquetes pendientes de retiro"}
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>No tienes paquetes registrados todavía.</Text>}
      renderItem={({ item }) =>
        item.tipo === "separador" ? (
          <View style={styles.separador}>
            <View style={styles.linea} />
            <Text style={styles.separadorTexto}>Últimos {CANTIDAD_RETIRADOS} retirados</Text>
            <View style={styles.linea} />
          </View>
        ) : (
          <PaqueteResidenteCard item={item.paquete} />
        )
      }
      ListFooterComponent={
        <TouchableOpacity style={styles.botonBuscar} onPress={() => navigation.navigate("MisPaquetesBusqueda")}>
          <Text style={styles.botonBuscarTexto}>🔎 Buscar paquete por fechas</Text>
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  subtitulo: { color: colors.textMutedOnNavy, fontSize: 13, marginBottom: 6 },
  seccionTitulo: { fontSize: 14, fontWeight: "700", color: colors.textOnNavy, marginTop: 6, marginBottom: 6 },
  vacio: { textAlign: "center", color: colors.textMutedOnNavy, marginTop: 30 },
  separador: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 },
  linea: { flex: 1, height: 1, backgroundColor: colors.navy600 },
  separadorTexto: { color: colors.textMutedOnNavy, fontSize: 12, fontWeight: "700" },
  botonBuscar: {
    marginTop: 14,
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  botonBuscarTexto: { color: colors.botonNaranjaTexto, fontWeight: "700" },
});
