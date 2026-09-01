import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminActualizarElementoMantencion, adminCrearElementoMantencion, adminGetElementosMantencion } from "../../api/client";
import { TipoElementoMantencion } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

// Ronda 19, a pedido del usuario: "cada condominio puede elegir su
// catálogo" — a diferencia de otros catálogos cerrados del MVP (tipo de
// personal, tipo de notificación), el catálogo de infraestructura (techo,
// piscina, ascensor, etc.) lo administra cada condominio libremente acá.
export default function AdminElementosMantencionScreen() {
  const { token } = useAuth();
  const [elementos, setElementos] = useState<TipoElementoMantencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setElementos(await adminGetElementosMantencion(token, CONDOMINIO_ID, true));
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

  const handleCrear = async () => {
    if (!token || !nombre.trim()) {
      Alert.alert("Falta el nombre", "Indica el nombre del elemento (ej: Techo Torre A).");
      return;
    }
    setCreando(true);
    try {
      await adminCrearElementoMantencion(token, CONDOMINIO_ID, nombre.trim());
      setNombre("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (item: TipoElementoMantencion) => {
    if (!token) return;
    try {
      await adminActualizarElementoMantencion(token, item.id_tipoelementomantencion, {
        flg_vigencia: item.flg_vigencia ? 0 : 1,
      });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
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
    <FlatList
      style={styles.container}
      data={elementos}
      keyExtractor={(item) => String(item.id_tipoelementomantencion)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Nuevo elemento de infraestructura</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Techo Torre A, Piscina, Ascensor 1"
            value={nombre}
            onChangeText={setNombre}
          />
          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear"}</Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay elementos de infraestructura configurados.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombreItem}>{item.gls_tipoelementomantencion}</Text>
            <Text style={styles.detalle}>{item.flg_vigencia ? "Activo" : "Inactivo"}</Text>
          </View>
          <TouchableOpacity
            style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
            onPress={() => handleToggle(item)}
          >
            <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 16 },
  botonCrear: { backgroundColor: "#795548", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
