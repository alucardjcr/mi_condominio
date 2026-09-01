import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getMantencionesEnCurso, getMantencionesProgramadas, registrarIngresoMantencion, registrarSalidaMantencion } from "../api/client";
import { Mantencion } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

// Ronda 19: pantalla de portería para mantenciones — el guardia SIEMPRE
// elige de la lista de mantenciones ya programadas cuál está llegando a
// realizar (nunca registra una "suelta", regla explícita del usuario) y
// anota empresa + persona + RUT. Al marcar la salida, pasa sola a
// "Realizada" (mismo patrón que Reserva Área Común).
export default function GuardiaMantencionesScreen() {
  const { token } = useAuth();
  const [programadas, setProgramadas] = useState<Mantencion[]>([]);
  const [enCurso, setEnCurso] = useState<Mantencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const [ingresandoId, setIngresandoId] = useState<number | null>(null);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [personaNombre, setPersonaNombre] = useState("");
  const [personaRut, setPersonaRut] = useState("");

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        const [listaProgramadas, listaEnCurso] = await Promise.all([
          getMantencionesProgramadas(token, CONDOMINIO_ID),
          getMantencionesEnCurso(token, CONDOMINIO_ID),
        ]);
        setProgramadas(listaProgramadas);
        setEnCurso(listaEnCurso);
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

  const limpiarFormularioIngreso = () => {
    setIngresandoId(null);
    setEmpresaNombre("");
    setPersonaNombre("");
    setPersonaRut("");
  };

  const handleConfirmarIngreso = async (m: Mantencion) => {
    if (!token) return;
    if (!empresaNombre.trim() || !personaNombre.trim()) {
      Alert.alert("Faltan datos", "Nombre de la empresa y de la persona son obligatorios.");
      return;
    }
    setProcesandoId(m.id_mantencion);
    try {
      await registrarIngresoMantencion(token, m.id_mantencion, {
        empresa_nombre: empresaNombre.trim(),
        persona_nombre: personaNombre.trim(),
        persona_rut: personaRut.trim() || undefined,
      });
      limpiarFormularioIngreso();
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleSalida = async (m: Mantencion) => {
    if (!token) return;
    setProcesandoId(m.id_mantencion);
    try {
      await registrarSalidaMantencion(token, m.id_mantencion);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
    >
      <Text style={styles.seccionTitulo}>Programadas</Text>
      {programadas.length === 0 && <Text style={styles.vacio}>No hay mantenciones programadas pendientes.</Text>}
      {programadas.map((m) => (
        <View key={m.id_mantencion} style={styles.card}>
          <Text style={styles.nombre}>{m.titulo}</Text>
          <Text style={styles.detalleTexto}>{m.gls_tipoelementomantencion}</Text>
          <Text style={styles.detalleTexto}>Programada: {m.fecha_programada}</Text>

          {ingresandoId === m.id_mantencion ? (
            <View style={{ marginTop: 10 }}>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la empresa"
                value={empresaNombre}
                onChangeText={setEmpresaNombre}
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="Nombre de la persona"
                value={personaNombre}
                onChangeText={setPersonaNombre}
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="RUT (opcional)"
                value={personaRut}
                onChangeText={setPersonaRut}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.boton, styles.botonLlegada, { flex: 1 }]}
                  onPress={() => handleConfirmarIngreso(m)}
                  disabled={procesandoId === m.id_mantencion}
                >
                  <Text style={styles.botonTexto}>
                    {procesandoId === m.id_mantencion ? "Guardando..." : "Confirmar ingreso"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.boton, { backgroundColor: "#999", flex: 1 }]} onPress={limpiarFormularioIngreso}>
                  <Text style={styles.botonTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={[styles.boton, styles.botonLlegada]} onPress={() => setIngresandoId(m.id_mantencion)}>
              <Text style={styles.botonTexto}>Marcar ingreso</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Text style={[styles.seccionTitulo, { marginTop: 16 }]}>En curso</Text>
      {enCurso.length === 0 && <Text style={styles.vacio}>No hay mantenciones en curso ahora mismo.</Text>}
      {enCurso.map((m) => (
        <View key={m.id_mantencion} style={styles.card}>
          <Text style={styles.nombre}>{m.titulo}</Text>
          <Text style={styles.detalleTexto}>{m.gls_tipoelementomantencion}</Text>
          <Text style={styles.detalleTexto}>
            {m.empresa_nombre} · {m.persona_nombre}
            {m.persona_rut ? ` · RUT ${m.persona_rut}` : ""}
          </Text>
          <TouchableOpacity
            style={[styles.boton, styles.botonSalida]}
            onPress={() => handleSalida(m)}
            disabled={procesandoId === m.id_mantencion}
          >
            <Text style={styles.botonTexto}>{procesandoId === m.id_mantencion ? "Guardando..." : "Marcar salida"}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  seccionTitulo: { fontSize: 14, fontWeight: "700", color: "#666", textTransform: "uppercase" },
  vacio: { textAlign: "center", color: "#888", marginTop: 8, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  nombre: { fontSize: 16, fontWeight: "700" },
  detalleTexto: { color: "#555", marginTop: 2, fontSize: 13 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff" },
  boton: { borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  botonLlegada: { backgroundColor: "#1a9d5c" },
  botonSalida: { backgroundColor: "#c0392b" },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
