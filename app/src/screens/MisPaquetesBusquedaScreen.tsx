import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { buscarPaquetes } from "../api/client";
import { Paquete } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import DateField from "../components/DateField";
import PaqueteResidenteCard from "../components/PaqueteResidenteCard";
import { colors } from "../theme/theme";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Búsqueda de los paquetes del residente por rango de fechas (fecha en que
// llegaron a portería). Por defecto propone los últimos 30 días.
export default function MisPaquetesBusquedaScreen() {
  const { token } = useAuth();
  const hoy = new Date();
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const [desde, setDesde] = useState(iso(hace30));
  const [hasta, setHasta] = useState(iso(hoy));
  const [resultados, setResultados] = useState<Paquete[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const handleBuscar = async () => {
    if (!token) return;
    if (!desde || !hasta) {
      Alert.alert("Faltan fechas", "Indica la fecha de inicio y la fecha de fin.");
      return;
    }
    if (desde > hasta) {
      Alert.alert("Fechas inválidas", "La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    setBuscando(true);
    try {
      setResultados(await buscarPaquetes(token, { condominio_id: CONDOMINIO_ID, fecha_inicio: desde, fecha_termino: hasta }));
    } catch (e: any) {
      Alert.alert("No se pudo buscar", e.message);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <FlatList
      style={styles.container}
      data={resultados ?? []}
      keyExtractor={(p) => String(p.id_paquete)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.form}>
          <Text style={styles.titulo}>Buscar paquete por fechas</Text>
          <DateField label="Fecha de inicio" value={desde} onChange={setDesde} maximumDate={new Date()} />
          <View style={{ height: 10 }} />
          <DateField label="Fecha de fin" value={hasta} onChange={setHasta} maximumDate={new Date()} />
          <TouchableOpacity style={styles.boton} onPress={handleBuscar} disabled={buscando}>
            {buscando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Buscar</Text>}
          </TouchableOpacity>
          {resultados && (
            <Text style={styles.contador}>
              {resultados.length === 0
                ? "No hay paquetes en ese rango de fechas."
                : `${resultados.length} paquete${resultados.length === 1 ? "" : "s"} encontrado${resultados.length === 1 ? "" : "s"}`}
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => <PaqueteResidenteCard item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  form: { backgroundColor: colors.navy800, borderRadius: 12, padding: 16, marginBottom: 6 },
  titulo: { fontSize: 16, fontWeight: "700", color: colors.textOnNavy, marginBottom: 12 },
  boton: {
    marginTop: 16,
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  botonTexto: { color: colors.botonNaranjaTexto, fontWeight: "700" },
  contador: { color: colors.textMutedOnNavy, marginTop: 12, fontSize: 13 },
});
