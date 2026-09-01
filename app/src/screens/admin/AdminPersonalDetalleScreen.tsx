import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminGetTareasPersonal, adminGetTurnosPersonal } from "../../api/client";
import { TareaPersonal, TurnoPersonal } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";

// Ronda 18: historial de cumplimiento de UN trabajador — solo
// Administrador/Comité lo ve (decisión explícita del usuario). Junta turno
// (fecha/hora en que estuvo en el condominio) y tareas (qué se le pidió y
// si lo completó).
function formatearFecha(fechaMysql: string | null) {
  if (!fechaMysql) return "—";
  const iso = fechaMysql.replace(" ", "T");
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Fila = { tipo: "turno"; data: TurnoPersonal } | { tipo: "tarea"; data: TareaPersonal };

export default function AdminPersonalDetalleScreen({ route }: any) {
  const { idUsuario, nombre } = route.params as { idUsuario: number; nombre: string };
  const { token } = useAuth();
  const [turnos, setTurnos] = useState<TurnoPersonal[]>([]);
  const [tareas, setTareas] = useState<TareaPersonal[]>([]);
  const [vista, setVista] = useState<"tareas" | "turnos">("tareas");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [listaTurnos, listaTareas] = await Promise.all([
        adminGetTurnosPersonal(token, idUsuario),
        adminGetTareasPersonal(token, CONDOMINIO_ID, idUsuario),
      ]);
      setTurnos(listaTurnos);
      setTareas(listaTareas);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [token, idUsuario]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const datos: Fila[] =
    vista === "tareas" ? tareas.map((t) => ({ tipo: "tarea" as const, data: t })) : turnos.map((t) => ({ tipo: "turno" as const, data: t }));

  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>{nombre}</Text>
      <View style={styles.tabs}>
        <Text
          style={[styles.tab, vista === "tareas" && styles.tabActivo]}
          onPress={() => setVista("tareas")}
        >
          Tareas ({tareas.length})
        </Text>
        <Text
          style={[styles.tab, vista === "turnos" && styles.tabActivo]}
          onPress={() => setVista("turnos")}
        >
          Turnos ({turnos.length})
        </Text>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={datos}
        keyExtractor={(item, idx) => `${item.tipo}-${idx}`}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay nada acá.</Text>}
        renderItem={({ item }) =>
          item.tipo === "tarea" ? (
            <View style={styles.card}>
              <Text style={styles.cuerpo}>{item.data.descripcion}</Text>
              <Text style={[styles.estado, item.data.estado === "Completada" ? styles.estadoOk : styles.estadoPendiente]}>
                {item.data.estado === "Completada" ? "✓ Completada" : "Pendiente"}
              </Text>
              <Text style={styles.fecha}>
                Asignada: {formatearFecha(item.data.fecha_creacion)}
                {item.data.fecha_completada ? ` · Completada: ${formatearFecha(item.data.fecha_completada)}` : ""}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cuerpo}>Entrada: {formatearFecha(item.data.fecha_inicio)}</Text>
              <Text style={styles.fecha}>
                {item.data.fecha_termino ? `Salida: ${formatearFecha(item.data.fecha_termino)}` : "Turno todavía en curso"}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  subtitulo: { fontSize: 16, fontWeight: "700", padding: 16, paddingBottom: 8 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 16, marginBottom: 4 },
  tab: { fontSize: 14, color: "#888", paddingBottom: 8 },
  tabActivo: { color: "#2e7d32", fontWeight: "700", borderBottomWidth: 2, borderBottomColor: "#2e7d32" },
  vacio: { textAlign: "center", color: "#888", marginTop: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cuerpo: { fontSize: 14, color: "#222" },
  estado: { marginTop: 6, fontSize: 12, fontWeight: "700" },
  estadoOk: { color: "#1a9d5c" },
  estadoPendiente: { color: "#d97706" },
  fecha: { color: "#999", marginTop: 6, fontSize: 11 },
});
