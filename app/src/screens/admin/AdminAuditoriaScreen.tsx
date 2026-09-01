import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { adminAuditarPatente } from "../../api/client";
import { AuditoriaPatenteItem } from "../../api/types";
import { useAuth } from "../../context/AuthContext";

function formatear(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminAuditoriaScreen() {
  const { token } = useAuth();
  const [patente, setPatente] = useState("");
  const [resultados, setResultados] = useState<AuditoriaPatenteItem[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const handleBuscar = async () => {
    if (!token || !patente.trim()) return;
    setBuscando(true);
    try {
      setResultados(await adminAuditarPatente(token, patente.trim()));
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Patente</Text>
      <TextInput
        style={styles.input}
        value={patente}
        onChangeText={setPatente}
        placeholder="Ej: AABB12"
        autoCapitalize="characters"
        onSubmitEditing={handleBuscar}
      />
      <TouchableOpacity style={styles.boton} onPress={handleBuscar} disabled={buscando}>
        {buscando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Buscar historial</Text>}
      </TouchableOpacity>

      {resultados !== null && (
        <FlatList
          style={{ marginTop: 20 }}
          data={resultados}
          keyExtractor={(item) => String(item.id_visita)}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={
            <Text style={styles.vacio}>Esta patente no tiene registros de entrada/salida.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.nombreItem}>{item.nombre_visita}</Text>
              <Text style={styles.detalle}>
                {item.nombre_torre} {item.numero_unidad} · {item.gls_tipopermiso}
                {item.numero_estacionamiento ? ` · Cupo ${item.numero_estacionamiento}` : ""}
              </Text>
              <Text style={styles.detalle}>
                Entrada: {formatear(item.hora_entrada)}
                {item.hora_salida ? ` · Salida: ${formatear(item.hora_salida)}` : " · aún dentro"}
              </Text>
              <Text style={styles.guardia}>
                Registrado por {item.nombre_guardia_creador} ({item.usuariocol_guardia_creador})
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    marginTop: 4,
    letterSpacing: 1,
  },
  boton: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 20 },
  card: { backgroundColor: "#f5f6f8", borderRadius: 12, padding: 14 },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#555", marginTop: 2 },
  guardia: { color: "#1a6fc4", marginTop: 6, fontSize: 12, fontWeight: "600" },
});
