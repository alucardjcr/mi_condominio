import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { personalCompletarTarea, personalGetTareas } from "../api/client";
import { TareaPersonal } from "../api/types";
import { useAuth } from "../context/AuthContext";

// Ronda 18: bandeja de tareas del propio trabajador de personal externo —
// mensajes puntuales que le escribió administrador/comité (ej. "cortar
// árboles costado sur"), que marca como completadas él mismo.
function formatearFecha(fechaMysql: string) {
  const iso = fechaMysql.replace(" ", "T");
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PersonalTareasScreen() {
  const { token } = useAuth();
  const [tareas, setTareas] = useState<TareaPersonal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [completando, setCompletando] = useState<number | null>(null);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setTareas(await personalGetTareas(token));
      } catch {
        // silencioso: pull-to-refresh reintenta
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

  const handleCompletar = async (tarea: TareaPersonal) => {
    if (!token) return;
    setCompletando(tarea.id_tareapersonal);
    try {
      await personalCompletarTarea(token, tarea.id_tareapersonal);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCompletando(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const pendientes = tareas.filter((t) => t.estado === "Pendiente").length;

  return (
    <FlatList
      style={styles.container}
      data={tareas}
      keyExtractor={(item) => String(item.id_tareapersonal)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
      ListHeaderComponent={
        pendientes > 0 ? (
          <Text style={styles.subtitulo}>
            {pendientes} tarea{pendientes === 1 ? "" : "s"} pendiente{pendientes === 1 ? "" : "s"}
          </Text>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no tienes tareas asignadas.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.card, item.estado === "Completada" && styles.cardCompletada]}>
          <Text style={styles.cuerpo}>{item.descripcion}</Text>
          <Text style={styles.fecha}>{formatearFecha(item.fecha_creacion)}</Text>
          {item.estado === "Pendiente" ? (
            <TouchableOpacity
              style={styles.boton}
              onPress={() => handleCompletar(item)}
              disabled={completando === item.id_tareapersonal}
            >
              <Text style={styles.botonTexto}>
                {completando === item.id_tareapersonal ? "..." : "Marcar completada"}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.completadaTexto}>✓ Completada</Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  subtitulo: { color: "#888", fontSize: 13, marginBottom: 6 },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardCompletada: { opacity: 0.7 },
  cuerpo: { fontSize: 15, color: "#222", fontWeight: "600" },
  fecha: { color: "#999", marginTop: 6, fontSize: 11 },
  boton: { backgroundColor: "#2e7d32", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 12 },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
  completadaTexto: { color: "#1a9d5c", fontWeight: "700", marginTop: 10, fontSize: 13 },
});
