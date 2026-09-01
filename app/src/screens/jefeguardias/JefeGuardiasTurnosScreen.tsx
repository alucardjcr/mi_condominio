import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { jefeAsignarTurno, jefeGetBloques, jefeGetGuardias, jefeGetTurnosSemana, jefeQuitarTurno } from "../../api/client";
import { Guardia, TurnoAsignado, TurnoBloque } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ronda 20: calendario semanal de turnos ("bloques fijos por día" —
// Mañana/Tarde/Noche) que gestiona JEFE_GUARDIAS. Sin fechas explícitas
// trae la semana en curso (lunes a domingo) — ver turnos.service.ts. A
// pedido explícito del usuario, este calendario SÍ restringe el login del
// guardia (ver auth.service.ts): sin ningún turno cargado nunca se
// bloquea, así que asignar acá es lo que activa la restricción para ese
// guardia.
export default function JefeGuardiasTurnosScreen() {
  const { token } = useAuth();
  const [bloques, setBloques] = useState<TurnoBloque[]>([]);
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [turnos, setTurnos] = useState<TurnoAsignado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const [guardiaSel, setGuardiaSel] = useState<OpcionSelect | null>(null);
  const [bloqueSel, setBloqueSel] = useState<OpcionSelect | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        const [b, g, t] = await Promise.all([
          jefeGetBloques(token, CONDOMINIO_ID),
          jefeGetGuardias(token),
          jefeGetTurnosSemana(token, CONDOMINIO_ID),
        ]);
        setBloques(b);
        setGuardias(g);
        setTurnos(t);
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

  const handleAsignar = async () => {
    if (!token || !guardiaSel || !bloqueSel || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert("Faltan datos", "Elige el guardia, el bloque y una fecha válida (YYYY-MM-DD).");
      return;
    }
    setAsignando(true);
    try {
      await jefeAsignarTurno(token, {
        guardia_usuario_id: guardiaSel.id,
        turno_bloque_id_turnobloque: bloqueSel.id,
        fecha,
        condominio_id_condominio: CONDOMINIO_ID,
      });
      setGuardiaSel(null);
      setBloqueSel(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAsignando(false);
    }
  };

  const handleQuitar = (t: TurnoAsignado) => {
    if (!token) return;
    Alert.alert("Quitar turno", `¿Quitar a ${t.nombre_guardia} del bloque ${t.gls_turnobloque} del ${t.fecha}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: async () => {
          try {
            await jefeQuitarTurno(token, t.id_turnoasignado);
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

  // Agrupado por fecha, para que se lea como un calendario de la semana.
  const porFecha = turnos.reduce<Record<string, TurnoAsignado[]>>((acc, t) => {
    (acc[t.fecha] ??= []).push(t);
    return acc;
  }, {});
  const fechas = Object.keys(porFecha).sort();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
    >
      <View style={styles.card}>
        <Text style={styles.formTitulo}>Asignar turno</Text>
        <SelectModal
          label="Guardia"
          placeholder="Selecciona un guardia"
          opciones={guardias.map((g) => ({ id: g.id_usuario, label: g.nombre_usuario }))}
          valorSeleccionado={guardiaSel}
          onSeleccionar={setGuardiaSel}
        />
        <SelectModal
          label="Bloque"
          placeholder="Selecciona un bloque"
          opciones={bloques.map((b) => ({ id: b.id_turnobloque, label: `${b.gls_turnobloque} (${b.hora_inicio.slice(0, 5)}–${b.hora_termino.slice(0, 5)})` }))}
          valorSeleccionado={bloqueSel}
          onSeleccionar={setBloqueSel}
        />
        <Text style={styles.label}>Fecha</Text>
        <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />
        <TouchableOpacity style={styles.botonCrear} onPress={handleAsignar} disabled={asignando}>
          <Text style={styles.botonCrearTexto}>{asignando ? "Asignando..." : "Asignar"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.seccionTitulo}>Semana en curso</Text>
      {fechas.length === 0 && (
        <Text style={styles.vacio}>Nadie tiene turno asignado esta semana — el login de los guardias no está restringido.</Text>
      )}
      {fechas.map((f) => (
        <View key={f} style={styles.card}>
          <Text style={styles.fecha}>{f}</Text>
          {porFecha[f].map((t) => (
            <View key={t.id_turnoasignado} style={styles.turnoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.turnoGuardia}>{t.nombre_guardia}</Text>
                <Text style={styles.turnoBloque}>
                  {t.gls_turnobloque} · {t.hora_inicio.slice(0, 5)}–{t.hora_termino.slice(0, 5)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleQuitar(t)}>
                <Text style={styles.quitar}>Quitar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff", marginTop: 4 },
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  seccionTitulo: { fontSize: 14, fontWeight: "700", color: "#666", textTransform: "uppercase", marginTop: 6 },
  vacio: { textAlign: "center", color: "#888", marginTop: 8, marginBottom: 8 },
  fecha: { fontSize: 15, fontWeight: "800", color: "#222" },
  turnoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  turnoGuardia: { fontSize: 14, fontWeight: "600", color: "#333" },
  turnoBloque: { fontSize: 12, color: "#888", marginTop: 2 },
  quitar: { color: "#c0392b", fontWeight: "700", fontSize: 13 },
});
