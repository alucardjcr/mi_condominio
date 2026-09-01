import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { crearEntradaBitacora, getBitacora } from "../api/client";
import { EntradaBitacora } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

function formatearFecha(fechaMysql: string) {
  const iso = fechaMysql.replace(" ", "T");
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Ronda 20: bitácora de novedades del turno de portería — libro tradicional
// compartido entre todos los guardias (el que entra de turno lee lo que
// dejó anotado el anterior). Solo Guardia puede escribir (fecha/hora/nombre
// se auto-registran, nunca editables a mano); Administrador/Comité solo lee
// (supervisión).
export default function BitacoraScreen() {
  const { token, rol } = useAuth();
  const esGuardia = rol === "Guardia";
  const [entradas, setEntradas] = useState<EntradaBitacora[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setEntradas(await getBitacora(token, CONDOMINIO_ID));
      } catch (e: any) {
        Alert.alert("Error", e.message);
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

  const handleEnviar = async () => {
    if (!token || !texto.trim()) return;
    setEnviando(true);
    try {
      await crearEntradaBitacora(token, texto.trim(), CONDOMINIO_ID);
      setTexto("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
    >
      {esGuardia && (
        <View style={styles.formCard}>
          <Text style={styles.label}>Nueva novedad</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej: Se revisaron accesos, todo en orden."
            multiline
          />
          <TouchableOpacity style={styles.boton} onPress={handleEnviar} disabled={enviando || !texto.trim()}>
            <Text style={styles.botonTexto}>{enviando ? "Guardando..." : "Agregar novedad"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {entradas.length === 0 && <Text style={styles.vacio}>Todavía no hay novedades registradas.</Text>}
      {entradas.map((e) => (
        <View key={e.id_bitacora} style={styles.card}>
          <Text style={styles.texto}>{e.texto}</Text>
          <Text style={styles.meta}>
            {e.nombre_guardia} · {formatearFecha(e.fecha_hora)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  formCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff", marginTop: 4 },
  boton: { backgroundColor: "#014BD2", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  botonTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  texto: { fontSize: 14, color: "#333", lineHeight: 20 },
  meta: { color: "#999", marginTop: 8, fontSize: 12, fontWeight: "600" },
});
