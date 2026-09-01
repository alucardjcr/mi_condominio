import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  crearReserva,
  getDisponibilidadEspacio,
  getResidentesPorUnidad,
  getTorres,
  getUnidadesPorTorre,
} from "../api/client";
import { HorarioOcupado, Residente, Torre, Unidad } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";

function hoyComoTexto() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

// Pantalla de creación de una reserva. La usan tanto un Residente (reserva
// para su propio depto, sin elegir torre/depto/solicitante) como
// Admin/Comité reservando "a nombre de un residente" (regla 4/12) — en ese
// caso se muestran los mismos selectores torre → depto → residente que ya
// se usan en Paquetería, y el residente elegido queda como
// solicitante_usuario_id.
export default function ReservaCrearScreen({ navigation, route }: any) {
  const { token, esAdmin } = useAuth();
  const espacio = route.params.espacio;

  const [torres, setTorres] = useState<Torre[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [unidadSel, setUnidadSel] = useState<OpcionSelect | null>(null);
  const [solicitanteSel, setSolicitanteSel] = useState<OpcionSelect | null>(null);

  const [fecha, setFecha] = useState(hoyComoTexto());
  const [horaInicio, setHoraInicio] = useState("");
  const [horaTermino, setHoraTermino] = useState("");
  const [ocupados, setOcupados] = useState<HorarioOcupado[]>([]);
  const [cargandoOcupados, setCargandoOcupados] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token || !esAdmin) return;
    getTorres(token, CONDOMINIO_ID).then(setTorres).catch((e) => Alert.alert("Error", e.message));
  }, [token, esAdmin]);

  useEffect(() => {
    if (!token || !espacio || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    setCargandoOcupados(true);
    getDisponibilidadEspacio(token, espacio.id_espaciocomun, fecha)
      .then(setOcupados)
      .catch(() => setOcupados([]))
      .finally(() => setCargandoOcupados(false));
  }, [token, espacio, fecha]);

  const handleSeleccionarTorre = async (opcion: OpcionSelect) => {
    setTorreSel(opcion);
    setUnidadSel(null);
    setSolicitanteSel(null);
    setUnidades([]);
    setResidentes([]);
    if (!token) return;
    setUnidades(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleSeleccionarUnidad = async (opcion: OpcionSelect) => {
    setUnidadSel(opcion);
    setSolicitanteSel(null);
    setResidentes([]);
    if (!token) return;
    setResidentes(await getResidentesPorUnidad(token, opcion.id));
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert("Fecha inválida", "Usa el formato AAAA-MM-DD, por ejemplo 2026-09-15.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(horaInicio) || !/^\d{2}:\d{2}$/.test(horaTermino)) {
      Alert.alert("Horario inválido", "Usa el formato HH:MM, por ejemplo 18:00.");
      return;
    }
    if (esAdmin && (!unidadSel || !solicitanteSel)) {
      Alert.alert("Faltan datos", "Elige la torre, el depto y a nombre de qué residente se reserva.");
      return;
    }

    setEnviando(true);
    try {
      const reserva = await crearReserva(token, {
        espacio_comun_id_espaciocomun: espacio.id_espaciocomun,
        fecha,
        hora_inicio: horaInicio,
        hora_termino: horaTermino,
        unidad_id_unidad: esAdmin ? unidadSel!.id : undefined,
        solicitante_usuario_id: esAdmin ? solicitanteSel!.id : undefined,
      });
      Alert.alert(
        "Reserva creada",
        espacio.flg_gratuito
          ? "Queda pendiente de aprobación."
          : `Queda pendiente de aprobación. Monto a pagar: ${formatearMonto(reserva.monto_tarifa)}${
              reserva.monto_garantia ? ` + garantía ${formatearMonto(reserva.monto_garantia)}` : ""
            }.`
      );
      navigation.navigate(esAdmin ? "AdminReservas" : "MisReservas");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.resumen}>
          <Text style={styles.resumenNombre}>{espacio.nombre}</Text>
          <Text style={styles.resumenDetalle}>
            {espacio.gls_tipoespaciocomun} · {espacio.hora_apertura.slice(0, 5)} a {espacio.hora_cierre.slice(0, 5)}
          </Text>
          <Text style={styles.resumenDetalle}>
            {espacio.flg_gratuito
              ? "Gratuito"
              : `${formatearMonto(espacio.precio_bloque)} cada ${espacio.bloque_horas}h`}
            {espacio.monto_garantia ? ` · Garantía ${formatearMonto(espacio.monto_garantia)}` : ""}
          </Text>
        </View>

        {esAdmin && (
          <>
            <Text style={styles.seccionTitulo}>A nombre de qué residente</Text>
            <SelectModal
              label="Torre *"
              placeholder="Selecciona una torre"
              opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
              valorSeleccionado={torreSel}
              onSeleccionar={handleSeleccionarTorre}
            />
            <SelectModal
              label="Depto *"
              placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
              opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
              valorSeleccionado={unidadSel}
              onSeleccionar={handleSeleccionarUnidad}
              disabled={!torreSel}
            />
            <SelectModal
              label="Residente que reserva *"
              placeholder={unidadSel ? "Selecciona un residente" : "Primero elige el depto"}
              opciones={residentes.map((r) => ({ id: r.id_usuario, label: r.nombre_usuario }))}
              valorSeleccionado={solicitanteSel}
              onSeleccionar={setSolicitanteSel}
              disabled={!unidadSel}
            />
          </>
        )}

        <Text style={styles.seccionTitulo}>Fecha y horario</Text>
        <Text style={styles.label}>Fecha *</Text>
        <TextInput
          style={styles.input}
          value={fecha}
          onChangeText={setFecha}
          placeholder="AAAA-MM-DD"
          autoCapitalize="none"
        />

        {cargandoOcupados ? (
          <ActivityIndicator style={{ marginTop: 10 }} />
        ) : ocupados.length > 0 ? (
          <View style={styles.ocupadosBox}>
            <Text style={styles.ocupadosTitulo}>Horarios ya tomados ese día:</Text>
            {ocupados.map((o, i) => (
              <Text key={i} style={styles.ocupadosItem}>
                {o.hora_inicio.slice(0, 5)} - {o.hora_termino.slice(0, 5)} ({o.gls_estadoreserva})
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.sinOcupados}>Sin reservas ese día todavía.</Text>
        )}

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hora inicio *</Text>
            <TextInput
              style={styles.input}
              value={horaInicio}
              onChangeText={setHoraInicio}
              placeholder="HH:MM"
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hora término *</Text>
            <TextInput
              style={styles.input}
              value={horaTermino}
              onChangeText={setHoraTermino}
              placeholder="HH:MM"
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.boton, enviando && styles.botonDeshabilitado]}
          onPress={handleSubmit}
          disabled={enviando}
        >
          <Text style={styles.botonTexto}>{enviando ? "Reservando..." : "Reservar"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  resumen: { backgroundColor: "#eef6ff", borderRadius: 10, padding: 14, marginBottom: 8 },
  resumenNombre: { fontSize: 18, fontWeight: "700", color: "#222" },
  resumenDetalle: { fontSize: 13, color: "#555", marginTop: 2 },
  seccionTitulo: { fontSize: 14, fontWeight: "700", color: "#333", marginTop: 18, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  ocupadosBox: { backgroundColor: "#fff5f5", borderRadius: 10, padding: 10, marginTop: 8 },
  ocupadosTitulo: { fontSize: 12, fontWeight: "700", color: "#c0392b" },
  ocupadosItem: { fontSize: 12, color: "#c0392b", marginTop: 2 },
  sinOcupados: { fontSize: 12, color: "#1a9d5c", marginTop: 8 },
  boton: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
