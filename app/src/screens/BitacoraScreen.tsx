import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { crearEntradaBitacora, getBitacora } from "../api/client";
import { EntradaBitacora } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/theme";

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
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
    >
      {esGuardia && (
        <View style={styles.formCard}>
          <Text style={styles.label}>Nueva novedad</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej: Se revisaron accesos, todo en orden."
            placeholderTextColor={colors.textMutedOnNavy}
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
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  vacio: { textAlign: "center", color: colors.textMutedOnNavy, marginTop: 30 },
  formCard: { backgroundColor: colors.navy800, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.navy600 },
  label: { fontSize: 14, fontWeight: "600", color: colors.textOnNavy },
  input: { borderWidth: 1, borderColor: colors.navy600, borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: colors.navy700, color: colors.textOnNavy, marginTop: 4 },
  boton: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  botonTexto: { color: colors.botonNaranjaTexto, fontWeight: "700" },
  card: { backgroundColor: colors.navy800, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.navy600 },
  texto: { fontSize: 14, color: colors.textOnNavy, lineHeight: 20 },
  meta: { color: colors.textMutedOnNavy, marginTop: 8, fontSize: 12, fontWeight: "600" },
});
