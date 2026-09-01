import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getVisitasActivas, registrarSalida } from "../api/client";
import { Visita } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

export default function SalidaScreen() {
  const { token } = useAuth();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getVisitasActivas(token, CONDOMINIO_ID);
      setVisitas(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
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

  const visitasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return visitas;
    const q = busqueda.trim().toLowerCase();
    return visitas.filter(
      (v) =>
        v.patente?.toLowerCase().includes(q) ||
        v.nombre_visita.toLowerCase().includes(q) ||
        v.numero_unidad.toLowerCase().includes(q)
    );
  }, [visitas, busqueda]);

  const handleSalida = async (idVisita: number) => {
    if (!token) return;
    setProcesandoId(idVisita);
    try {
      const resultado = await registrarSalida(token, idVisita);
      if (resultado.constancia) {
        Alert.alert(
          "Salida registrada con exceso de tiempo",
          `Minutos extra: ${resultado.constancia.minutos_extras}\nMonto a cobrar: $${resultado.constancia.monto_cobrar.toLocaleString(
            "es-CL"
          )} (se factura en el gasto común del depto)`
        );
      } else {
        Alert.alert("Salida registrada", "El cupo quedó liberado.");
      }
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={styles.buscador}
        placeholder="Buscar por patente, nombre o depto..."
        value={busqueda}
        onChangeText={setBusqueda}
      />
      <FlatList
        style={styles.container}
        data={visitasFiltradas}
        keyExtractor={(item) => String(item.id_visita)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              cargar();
            }}
          />
        }
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <Text style={styles.vacio}>No hay visitas dentro del condominio en este momento.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>
                {item.gls_tipopermiso === "Discapacitado"
                  ? "♿ "
                  : item.gls_tipovisita === "Peatonal"
                  ? "🚶 "
                  : ""}
                {item.nombre_visita}
              </Text>
              <Text style={styles.detalle}>
                {item.nombre_torre} {item.numero_unidad}
                {item.patente ? ` · ${item.patente}` : ""}
                {item.gls_tipovisita === "Peatonal"
                  ? " · Peatonal (sin cupo)"
                  : item.numero_estacionamiento
                  ? ` · Cupo ${item.numero_estacionamiento}`
                  : " · sin cupo"}
              </Text>
              {item.tipo_ocupante === "Residente" ? (
                <Text style={styles.detalle}>Residente usando cupo de discapacitados</Text>
              ) : item.nombre_residente_visitado ? (
                <Text style={styles.detalle}>
                  Visita a {item.nombre_residente_visitado}
                  {!item.residente_coincide ? " ⚠️ no coincide con residente registrado" : ""}
                </Text>
              ) : (
                <Text style={styles.detalle}>No quedó registrado a quién visita</Text>
              )}
              <Text style={styles.hora}>
                {item.gls_tipopermiso} · entró a las {formatearHora(item.hora_entrada)} · anotó{" "}
                {item.nombre_guardia_creador}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.boton}
              onPress={() => handleSalida(item.id_visita)}
              disabled={procesandoId === item.id_visita}
            >
              <Text style={styles.botonTexto}>
                {procesandoId === item.id_visita ? "..." : "Salida"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  buscador: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#fff",
  },
  vacio: { textAlign: "center", color: "#888", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  nombre: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#555", marginTop: 2 },
  hora: { color: "#999", marginTop: 2, fontSize: 12 },
  boton: {
    backgroundColor: "#c0392b",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botonTexto: { color: "#fff", fontWeight: "700" },
});
