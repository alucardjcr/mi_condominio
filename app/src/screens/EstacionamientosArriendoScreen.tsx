import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { actualizarEstadoArriendo, getPizarronArriendo } from "../api/client";
import { CupoArriendo } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

const GLS_DISPONIBLE_ARRIENDO = "Disponible para arriendo";

// Ronda 20: "pizarrón" de estacionamientos para arriendo entre residentes.
// Guardia lo consulta para informar al vecino interesado (solo lectura);
// cada residente cambia el estado de SU PROPIO cupo (el que tenga
// unidad_id_unidad = su unidad); Administrador/Comité, el de cualquiera. Sin
// flujo de solicitud/aprobación dentro de la app — a pedido explícito del
// usuario, es solo informativo.
export default function EstacionamientosArriendoScreen() {
  const { token, guardia, rol, esAdmin } = useAuth();
  const [cupos, setCupos] = useState<CupoArriendo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [precioEditado, setPrecioEditado] = useState("");
  const [guardando, setGuardando] = useState<number | null>(null);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setCupos(await getPizarronArriendo(token, CONDOMINIO_ID));
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

  const puedeEditar = (cupo: CupoArriendo) =>
    esAdmin || (rol === "Residente" && guardia?.unidad_id_unidad != null && guardia.unidad_id_unidad === cupo.unidad_id_unidad);

  const empezarEdicion = (cupo: CupoArriendo) => {
    setEditandoId(cupo.id_estacionamiento);
    setPrecioEditado(cupo.precio_arriendo ? String(cupo.precio_arriendo) : "");
  };

  const handleGuardarDisponible = async (cupo: CupoArriendo) => {
    if (!token) return;
    const precio = Number(precioEditado);
    if (!precio || precio <= 0) {
      Alert.alert("Falta el precio", "Indica un precio de arriendo mayor a 0.");
      return;
    }
    setGuardando(cupo.id_estacionamiento);
    try {
      await actualizarEstadoArriendo(token, cupo.id_estacionamiento, { disponible: true, precio_arriendo: precio });
      setEditandoId(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(null);
    }
  };

  const handleMarcarOcupado = async (cupo: CupoArriendo) => {
    if (!token) return;
    setGuardando(cupo.id_estacionamiento);
    try {
      await actualizarEstadoArriendo(token, cupo.id_estacionamiento, { disponible: false });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(null);
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
      <Text style={styles.subtitulo}>
        Cupos de residente del condominio. Los que aparecen "Disponible para arriendo" tienen precio — puedes
        avisarle al vecino interesado.
      </Text>
      {cupos.length === 0 && <Text style={styles.vacio}>No hay cupos de residente registrados.</Text>}
      {cupos.map((cupo) => {
        const disponible = cupo.gls_estadoestacionamiento === GLS_DISPONIBLE_ARRIENDO;
        const editable = puedeEditar(cupo);
        const editandoEste = editandoId === cupo.id_estacionamiento;
        return (
          <View key={cupo.id_estacionamiento} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.numero}>{cupo.numero_estacionamiento}</Text>
              <View style={[styles.badge, disponible ? styles.badgeDisponible : styles.badgeOcupado]}>
                <Text style={styles.badgeTexto}>{disponible ? "Disponible" : "Ocupado"}</Text>
              </View>
            </View>
            <Text style={styles.detalle}>
              {cupo.nombre_torre ? `${cupo.nombre_torre} · Depto ${cupo.numero_unidad}` : "Sin depto asignado"}
            </Text>
            {disponible && cupo.precio_arriendo && (
              <Text style={styles.precio}>${cupo.precio_arriendo.toLocaleString("es-CL")} / mes</Text>
            )}

            {editable && (
              <View style={styles.editorWrap}>
                {editandoEste ? (
                  <>
                    <Text style={styles.label}>Precio de arriendo</Text>
                    <TextInput
                      style={styles.input}
                      value={precioEditado}
                      onChangeText={setPrecioEditado}
                      placeholder="Ej: 45000"
                      keyboardType="numeric"
                    />
                    <View style={styles.botonesRow}>
                      <TouchableOpacity
                        style={[styles.boton, styles.botonGuardar, { flex: 1 }]}
                        onPress={() => handleGuardarDisponible(cupo)}
                        disabled={guardando === cupo.id_estacionamiento}
                      >
                        <Text style={styles.botonTexto}>
                          {guardando === cupo.id_estacionamiento ? "Guardando..." : "Publicar"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.boton, { backgroundColor: "#999", flex: 1 }]}
                        onPress={() => setEditandoId(null)}
                      >
                        <Text style={styles.botonTexto}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Disponible para arriendo</Text>
                    <Switch
                      value={disponible}
                      onValueChange={(v) => (v ? empezarEdicion(cupo) : handleMarcarOcupado(cupo))}
                      disabled={guardando === cupo.id_estacionamiento}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  subtitulo: { color: "#888", fontSize: 13, marginBottom: 4 },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  numero: { fontSize: 18, fontWeight: "800", color: "#222" },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDisponible: { backgroundColor: "#e6f7ee" },
  badgeOcupado: { backgroundColor: "#f0f0f0" },
  badgeTexto: { fontSize: 12, fontWeight: "700", color: "#333" },
  detalle: { color: "#555", marginTop: 4, fontSize: 13 },
  precio: { color: "#1a9d5c", fontWeight: "800", fontSize: 15, marginTop: 6 },
  editorWrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { fontSize: 14, color: "#333", fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff" },
  botonesRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  boton: { borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonGuardar: { backgroundColor: "#1a9d5c" },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
