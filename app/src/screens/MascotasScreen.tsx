import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { crearMascota, eliminarMascota, getMascotas } from "../api/client";
import { Mascota } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import FotoCapture from "../components/FotoCapture";

// Ronda 20: mascotas por depto. Autoservicio de cualquier residente activo
// de la unidad (no exclusivo del propietario) — Administrador/Comité ve
// todas las del condominio, con acceso total, igual criterio que el resto
// del sistema.
export default function MascotasScreen() {
  const { token, esAdmin } = useAuth();
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [especie, setEspecie] = useState("");
  const [raza, setRaza] = useState("");
  const [numeroChip, setNumeroChip] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setMascotas(await getMascotas(token, esAdmin ? CONDOMINIO_ID : undefined));
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
        setRefrescando(false);
      }
    },
    [token, esAdmin]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const limpiarFormulario = () => {
    setNombre("");
    setEspecie("");
    setRaza("");
    setNumeroChip("");
    setFoto(null);
  };

  const handleAgregar = async () => {
    if (!token || !nombre.trim()) {
      Alert.alert("Falta el nombre", "El nombre de la mascota es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      await crearMascota(token, {
        nombre,
        especie: especie || undefined,
        raza: raza || undefined,
        numero_chip: numeroChip || undefined,
        foto: foto || undefined,
      });
      limpiarFormulario();
      setMostrarForm(false);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (m: Mascota) => {
    if (!token) return;
    Alert.alert("Eliminar mascota", `¿Quitar a "${m.nombre}" del registro?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarMascota(token, m.id_mascota);
            cargar();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
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
      {!esAdmin && (
        <TouchableOpacity style={styles.botonNuevo} onPress={() => setMostrarForm((v) => !v)}>
          <Text style={styles.botonNuevoTexto}>{mostrarForm ? "Cancelar" : "+ Agregar mascota"}</Text>
        </TouchableOpacity>
      )}

      {mostrarForm && (
        <View style={styles.card}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Firulais" />

          <Text style={styles.label}>Especie</Text>
          <TextInput style={styles.input} value={especie} onChangeText={setEspecie} placeholder="Ej: Perro, Gato" />

          <Text style={styles.label}>Raza</Text>
          <TextInput style={styles.input} value={raza} onChangeText={setRaza} placeholder="Ej: Mestizo, Labrador" />

          <Text style={styles.label}>Número de chip</Text>
          <TextInput style={styles.input} value={numeroChip} onChangeText={setNumeroChip} placeholder="Si tiene chip identificatorio" />

          <FotoCapture label="Foto de la mascota" value={foto} onChange={setFoto} />

          <TouchableOpacity style={styles.botonGuardar} onPress={handleAgregar} disabled={guardando}>
            <Text style={styles.botonTexto}>{guardando ? "Guardando..." : "Guardar"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mascotas.length === 0 && !mostrarForm && (
        <Text style={styles.vacio}>{esAdmin ? "No hay mascotas registradas en el condominio." : "Todavía no registras ninguna mascota."}</Text>
      )}
      {mascotas.map((m) => (
        <View key={m.id_mascota} style={styles.card}>
          <View style={styles.cardHeader}>
            {m.foto_url ? (
              <Image source={{ uri: m.foto_url }} style={styles.foto} />
            ) : (
              <View style={[styles.foto, styles.fotoVacia]}>
                <Text style={{ fontSize: 24 }}>🐾</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{m.nombre}</Text>
              {esAdmin && m.nombre_torre && (
                <Text style={styles.detalle}>
                  {m.nombre_torre} · Depto {m.numero_unidad}
                </Text>
              )}
              {m.especie && <Text style={styles.detalle}>{m.especie}{m.raza ? ` · ${m.raza}` : ""}</Text>}
              {m.numero_chip && <Text style={styles.detalle}>Chip: {m.numero_chip}</Text>}
            </View>
          </View>
          <TouchableOpacity style={styles.botonEliminar} onPress={() => handleEliminar(m)}>
            <Text style={styles.botonEliminarTexto}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  botonNuevo: { backgroundColor: "#0f766e", borderRadius: 10, padding: 14, alignItems: "center" },
  botonNuevoTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  foto: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#eee" },
  fotoVacia: { alignItems: "center", justifyContent: "center" },
  nombre: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff", marginTop: 4 },
  botonGuardar: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  botonEliminar: { marginTop: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  botonEliminarTexto: { color: "#c0392b", fontWeight: "700", fontSize: 13 },
});
