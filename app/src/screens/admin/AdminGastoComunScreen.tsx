import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminActualizarGastoComunUnidad, adminGetUnidadesGastoComun } from "../../api/client";
import { UnidadGastoComun } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

// Gasto común por depto (ronda 17), a pedido del usuario: "el flg_gastocomun
// por ahora solo lo usaremos para identificar quien tiene el gasto comun al
// dia... y que puedan acceder a areas comunes para arriendos". El flag ya
// existía sobre `unidad` desde la ronda 14 y ya bloqueaba reservar espacios
// reservables si el depto está con deuda — esta pantalla es la primera
// forma de administrarlo desde la app (antes solo se podía por SQL directo).
export default function AdminGastoComunScreen() {
  const { token } = useAuth();
  const [unidades, setUnidades] = useState<UnidadGastoComun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [actualizando, setActualizando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setUnidades(await adminGetUnidadesGastoComun(token, CONDOMINIO_ID));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  const handleToggle = async (u: UnidadGastoComun) => {
    if (!token) return;
    setActualizando(u.id_unidad);
    try {
      await adminActualizarGastoComunUnidad(token, u.id_unidad, u.flg_gastocomun ? 0 : 1);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActualizando(null);
    }
  };

  const unidadesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return unidades;
    const q = busqueda.trim().toLowerCase();
    return unidades.filter(
      (u) => u.numero_unidad.toLowerCase().includes(q) || u.nombre_torre.toLowerCase().includes(q)
    );
  }, [unidades, busqueda]);

  const conDeuda = unidades.filter((u) => !u.flg_gastocomun).length;

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
      data={unidadesFiltradas}
      keyExtractor={(item) => String(item.id_unidad)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.intro}>
            Marca qué deptos tienen el gasto común al día. Un depto con deuda no puede reservar espacios comunes
            reservables (quincho, salón, etc.) hasta que se regularice.
          </Text>
          {conDeuda > 0 && (
            <Text style={styles.resumenDeuda}>
              {conDeuda} depto{conDeuda === 1 ? "" : "s"} con deuda
            </Text>
          )}
          <TextInput
            style={styles.buscador}
            placeholder="Buscar por torre o depto..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombreItem}>
              {item.nombre_torre} {item.numero_unidad}
            </Text>
            <Text style={[styles.estado, item.flg_gastocomun ? styles.estadoAlDia : styles.estadoConDeuda]}>
              {item.flg_gastocomun ? "Al día" : "Con deuda"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.botonToggle, item.flg_gastocomun ? styles.botonMarcarDeuda : styles.botonMarcarAlDia]}
            onPress={() => handleToggle(item)}
            disabled={actualizando === item.id_unidad}
          >
            <Text style={styles.botonToggleTexto}>
              {actualizando === item.id_unidad
                ? "..."
                : item.flg_gastocomun
                ? "Marcar con deuda"
                : "Marcar al día"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: "#666", fontSize: 13, marginBottom: 8, lineHeight: 18 },
  resumenDeuda: { color: "#c0392b", fontWeight: "700", fontSize: 13, marginBottom: 10 },
  buscador: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  estado: { marginTop: 2, fontSize: 13, fontWeight: "600" },
  estadoAlDia: { color: "#1a9d5c" },
  estadoConDeuda: { color: "#c0392b" },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonMarcarDeuda: { backgroundColor: "#c0392b" },
  botonMarcarAlDia: { backgroundColor: "#1a9d5c" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
