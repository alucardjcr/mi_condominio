import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getNotificaciones, marcarNotificacionLeida } from "../api/client";
import { Notificacion, TipoNotificacionGls } from "../api/types";
import { useAuth } from "../context/AuthContext";

// Bandeja de notificaciones (ronda 16): paquetes, visitas y comunicados que
// le llegaron a este usuario. Esta pantalla es la que SIEMPRE funciona
// (guardada en el backend), independiente de si el push real al celular
// llegó o no — ver la nota sobre Expo Go/development build en el README.
function formatearFecha(fechaMysql: string) {
  // "YYYY-MM-DD HH:MM:SS" (DATETIME de MySQL, dateStrings:true) -> Date
  const iso = fechaMysql.replace(" ", "T");
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ICONOS: Record<TipoNotificacionGls, string> = {
  "Paquete recibido": "📦",
  "Paquete en portería": "📦",
  "Alerta paquete sin retirar": "⏰",
  "Visita registrada": "🚶",
  Comunicado: "📣",
  "Tarea asignada": "🧹",
  "Mantención programada": "🔧",
  "Mantención en curso": "🛠️",
};

export default function NotificacionesScreen() {
  const { token } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setNotificaciones(await getNotificaciones(token));
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

  const handlePress = async (item: Notificacion) => {
    if (item.flg_leido || !token) return;
    // Optimista: se marca en la lista al toque, sin esperar la respuesta.
    setNotificaciones((prev) =>
      prev.map((n) => (n.id_notificacionusuario === item.id_notificacionusuario ? { ...n, flg_leido: 1 } : n))
    );
    try {
      await marcarNotificacionLeida(token, item.id_notificacionusuario);
    } catch {
      cargar(); // si falló, se resincroniza con lo que diga el backend
    }
  };

  const noLeidas = notificaciones.filter((n) => !n.flg_leido).length;

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
      data={notificaciones}
      keyExtractor={(item) => String(item.id_notificacionusuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
      ListHeaderComponent={
        noLeidas > 0 ? (
          <Text style={styles.subtitulo}>
            {noLeidas} notificaci{noLeidas === 1 ? "ón" : "ones"} sin leer
          </Text>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no tienes notificaciones.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, !item.flg_leido && styles.cardNoLeida]}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.titulo}>
              {ICONOS[item.gls_tiponotificacion] ?? "🔔"} {item.titulo}
            </Text>
            {!item.flg_leido && <View style={styles.puntoNoLeido} />}
          </View>
          <Text style={styles.cuerpo}>{item.cuerpo}</Text>
          <Text style={styles.fecha}>{formatearFecha(item.fecha_creacion)}</Text>
        </TouchableOpacity>
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
  cardNoLeida: { borderColor: "#014BD2", borderWidth: 1.5, backgroundColor: "#f3f8ff" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titulo: { fontSize: 15, fontWeight: "700", color: "#222", flex: 1 },
  puntoNoLeido: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#014BD2", marginLeft: 8 },
  cuerpo: { color: "#555", marginTop: 4, fontSize: 13, lineHeight: 18 },
  fecha: { color: "#999", marginTop: 6, fontSize: 11 },
});
