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
import { adminActualizarVetado, adminCrearVetado, adminGetVetados } from "../../api/client";
import { Vetado } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import FotoCapture from "../../components/FotoCapture";
import { fuenteImagenPrivada } from "../../utils/imagenesPrivadas";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ronda 20: listado VETADOS (personas con prohibición de ingreso, ej. orden
// de alejamiento) — información sensible, exclusivo de Administrador/Comité.
// El guardia solo puede BUSCAR por RUT (ver ConsultaVetadoScreen), nunca ver
// esta lista completa ni editarla.
export default function AdminVetadosScreen() {
  const { token } = useAuth();
  const [vetados, setVetados] = useState<Vetado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [rut, setRut] = useState("");
  const [patente, setPatente] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(hoyISO());
  const [observaciones, setObservaciones] = useState("");
  const [fotoPersona, setFotoPersona] = useState<string | null>(null);
  const [fotoVehiculo, setFotoVehiculo] = useState<string | null>(null);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setVetados(await adminGetVetados(token, CONDOMINIO_ID));
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

  const limpiarFormulario = () => {
    setNombreCompleto("");
    setRut("");
    setPatente("");
    setParentesco("");
    setFechaIngreso(hoyISO());
    setObservaciones("");
    setFotoPersona(null);
    setFotoVehiculo(null);
  };

  const handleAgregar = async () => {
    if (!token || !nombreCompleto.trim() || !rut.trim()) {
      Alert.alert("Faltan datos", "Nombre completo y RUT son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      await adminCrearVetado(token, {
        nombre_completo: nombreCompleto,
        rut,
        patente: patente || undefined,
        parentesco: parentesco || undefined,
        fecha_ingreso: fechaIngreso,
        observaciones: observaciones || undefined,
        foto_persona: fotoPersona || undefined,
        foto_vehiculo: fotoVehiculo || undefined,
        condominio_id_condominio: CONDOMINIO_ID,
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

  const handleToggleVigencia = (v: Vetado) => {
    if (!token) return;
    Alert.alert(
      v.flg_vigencia ? "Dar de baja" : "Reactivar",
      v.flg_vigencia
        ? `¿Ya no corresponde vetar a "${v.nombre_completo}"? Se saca del listado activo (queda el historial).`
        : `¿Reactivar la restricción de ingreso de "${v.nombre_completo}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              await adminActualizarVetado(token, v.id_vetado, { flg_vigencia: v.flg_vigencia ? 0 : 1 });
              cargar();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
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
        Personas con prohibición de ingreso (ej. orden de alejamiento). Al registrar una visita con este RUT o
        patente, el guardia recibe una alerta — nunca se bloquea el registro automáticamente, el guardia decide.
      </Text>

      <TouchableOpacity style={styles.botonNuevo} onPress={() => setMostrarForm((v) => !v)}>
        <Text style={styles.botonNuevoTexto}>{mostrarForm ? "Cancelar" : "+ Agregar a VETADOS"}</Text>
      </TouchableOpacity>

      {mostrarForm && (
        <View style={styles.card}>
          <Text style={styles.label}>Nombre completo *</Text>
          <TextInput style={styles.input} value={nombreCompleto} onChangeText={setNombreCompleto} placeholder="Nombre y apellidos" />

          <Text style={styles.label}>RUT *</Text>
          <TextInput style={styles.input} value={rut} onChangeText={setRut} placeholder="Ej: 12.345.678-9" autoCapitalize="none" />

          <Text style={styles.label}>Patente del vehículo (si tiene)</Text>
          <TextInput style={styles.input} value={patente} onChangeText={setPatente} placeholder="Ej: AB-CD-12" autoCapitalize="characters" />

          <Text style={styles.label}>Parentesco / relación con la residente</Text>
          <TextInput
            style={styles.input}
            value={parentesco}
            onChangeText={setParentesco}
            placeholder="Ej: Ex pareja del depto 305"
          />

          <Text style={styles.label}>Fecha de ingreso al listado</Text>
          <TextInput style={styles.input} value={fechaIngreso} onChangeText={setFechaIngreso} placeholder="YYYY-MM-DD" />

          <Text style={styles.label}>Observaciones</Text>
          <TextInput
            style={[styles.input, { minHeight: 70 }]}
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Ej: orden de alejamiento vigente, N° de causa, etc."
            multiline
          />

          <FotoCapture label="Foto de la persona" value={fotoPersona} onChange={setFotoPersona} />
          <FotoCapture label="Foto del vehículo (si tiene)" value={fotoVehiculo} onChange={setFotoVehiculo} />

          <TouchableOpacity style={styles.botonGuardar} onPress={handleAgregar} disabled={guardando}>
            <Text style={styles.botonTexto}>{guardando ? "Guardando..." : "Guardar"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {vetados.length === 0 && !mostrarForm && <Text style={styles.vacio}>No hay nadie en el listado VETADOS.</Text>}
      {vetados.map((v) => (
        <View key={v.id_vetado} style={[styles.card, !v.flg_vigencia && styles.cardInactiva]}>
          <View style={styles.cardHeader}>
            <Text style={styles.nombre}>{v.nombre_completo}</Text>
            {!v.flg_vigencia && <Text style={styles.chipInactiva}>Dado de baja</Text>}
          </View>
          <Text style={styles.detalle}>RUT: {v.rut}</Text>
          {v.patente && <Text style={styles.detalle}>Patente: {v.patente}</Text>}
          {v.parentesco && <Text style={styles.detalle}>{v.parentesco}</Text>}
          <Text style={styles.detalle}>Desde: {v.fecha_ingreso}</Text>
          {v.observaciones && <Text style={styles.observaciones}>{v.observaciones}</Text>}
          <View style={styles.fotosRow}>
            {v.foto_persona_url && <Image source={fuenteImagenPrivada(v.foto_persona_url, token)!} style={styles.foto} />}
            {v.foto_vehiculo_url && <Image source={fuenteImagenPrivada(v.foto_vehiculo_url, token)!} style={styles.foto} />}
          </View>
          <TouchableOpacity style={styles.botonBaja} onPress={() => handleToggleVigencia(v)}>
            <Text style={styles.botonBajaTexto}>{v.flg_vigencia ? "Dar de baja" : "Reactivar"}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  subtitulo: { color: "#888", fontSize: 13 },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  botonNuevo: { backgroundColor: "#c0392b", borderRadius: 10, padding: 14, alignItems: "center" },
  botonNuevoTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardInactiva: { opacity: 0.6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nombre: { fontSize: 16, fontWeight: "700", flex: 1 },
  chipInactiva: { fontSize: 11, color: "#999", fontWeight: "700" },
  detalle: { color: "#555", marginTop: 2, fontSize: 13 },
  observaciones: { color: "#888", marginTop: 6, fontSize: 12, fontStyle: "italic" },
  fotosRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  foto: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#eee" },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff", marginTop: 4 },
  botonGuardar: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  botonBaja: { marginTop: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  botonBajaTexto: { color: "#c0392b", fontWeight: "700", fontSize: 13 },
});
