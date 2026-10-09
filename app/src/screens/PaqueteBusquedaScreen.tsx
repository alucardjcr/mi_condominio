import React, { useState } from "react";
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
import { buscarPaquetes } from "../api/client";
import { EstadoPaqueteGls, Paquete } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/theme";
import SelectModal, { OpcionSelect } from "../components/SelectModal";

const ESTADOS: EstadoPaqueteGls[] = [
  "Recepcionado",
  "Notificado",
  "En portería",
  "Entregado a residente",
  "Rechazado por el residente",
  "Devuelto al remitente",
  "Perdido",
];

function primerDiaDelMes() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function hoyComoTexto() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PaqueteBusquedaScreen() {
  const { token } = useAuth();
  const [fechaInicio, setFechaInicio] = useState(primerDiaDelMes());
  const [fechaTermino, setFechaTermino] = useState(hoyComoTexto());
  const [q, setQ] = useState("");
  const [estadoSel, setEstadoSel] = useState<OpcionSelect | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [resultados, setResultados] = useState<Paquete[]>([]);

  const handleBuscar = async () => {
    if (!token) return;
    if (
      (fechaInicio && !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) ||
      (fechaTermino && !/^\d{4}-\d{2}-\d{2}$/.test(fechaTermino))
    ) {
      Alert.alert("Fechas inválidas", "Usa el formato AAAA-MM-DD, por ejemplo 2026-08-01.");
      return;
    }
    setBuscando(true);
    try {
      const data = await buscarPaquetes(token, {
        fecha_inicio: fechaInicio || undefined,
        fecha_termino: fechaTermino || undefined,
        q: q.trim() || undefined,
        estado: (estadoSel?.label as EstadoPaqueteGls) || undefined,
        condominio_id: CONDOMINIO_ID,
      });
      setResultados(data);
      setBuscado(true);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy900 }}>
      <View style={styles.filtros}>
        <View style={styles.filaFechas}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fecha inicio</Text>
            <TextInput style={styles.input} value={fechaInicio} onChangeText={setFechaInicio} placeholder="AAAA-MM-DD" placeholderTextColor={colors.textMutedOnNavy} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fecha término</Text>
            <TextInput style={styles.input} value={fechaTermino} onChangeText={setFechaTermino} placeholder="AAAA-MM-DD" placeholderTextColor={colors.textMutedOnNavy} autoCapitalize="none" />
          </View>
        </View>

        <Text style={styles.label}>Nombre o RUT del residente</Text>
        <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder="Ej: Juan Pérez o 12345678-9" placeholderTextColor={colors.textMutedOnNavy} />

        <SelectModal
          label="Estado (opcional)"
          placeholder="Todos"
          opciones={ESTADOS.map((e, i) => ({ id: i, label: e }))}
          valorSeleccionado={estadoSel}
          onSeleccionar={setEstadoSel}
        />
        {estadoSel && (
          <TouchableOpacity onPress={() => setEstadoSel(null)}>
            <Text style={styles.limpiarEstado}>Quitar filtro de estado</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.boton} onPress={handleBuscar} disabled={buscando}>
          {buscando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Buscar</Text>}
        </TouchableOpacity>

        {buscado && (
          <Text style={styles.totalGeneral}>
            {resultados.length} paquete{resultados.length === 1 ? "" : "s"} encontrado{resultados.length === 1 ? "" : "s"}
          </Text>
        )}
      </View>

      {buscado && (
        <FlatList
          data={resultados}
          keyExtractor={(item) => String(item.id_paquete)}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<Text style={styles.vacio}>No se encontraron paquetes con esos filtros.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.tipo}>{item.gls_tipopaquete}</Text>
                <Text style={styles.estado}>{item.gls_estadopaquete}</Text>
              </View>
              <Text style={styles.receptor}>{item.nombre_receptor}</Text>
              <Text style={styles.detalleTexto}>
                {item.nombre_torre} · Depto {item.numero_unidad}
                {item.rut_receptor ? ` · RUT ${item.rut_receptor}` : ""}
              </Text>
              <Text style={styles.detalleTexto}>
                Recibido: {formatearFecha(item.fecha_recepcion)} · por {item.nombre_guardia_creador}
              </Text>
              {item.fecha_entrega && (
                <Text style={styles.detalleTexto}>
                  Entregado: {formatearFecha(item.fecha_entrega)} a {item.entregado_a} · por {item.nombre_guardia_entrega}
                </Text>
              )}
              {item.observaciones && <Text style={styles.observaciones}>Nota: {item.observaciones}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filtros: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.navy600 },
  filaFechas: { flexDirection: "row", gap: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textOnNavy, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: colors.navy600, borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: colors.navy700, color: colors.textOnNavy },
  limpiarEstado: { color: colors.goldSoft, fontSize: 12, marginTop: 4 },
  boton: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  botonTexto: { color: colors.botonNaranjaTexto, fontSize: 16, fontWeight: "700" },
  totalGeneral: { marginTop: 12, fontSize: 14, fontWeight: "700", color: colors.goldSoft },
  vacio: { textAlign: "center", color: colors.textMutedOnNavy, marginTop: 30 },
  card: { backgroundColor: colors.navy800, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.navy600 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  tipo: { fontSize: 12, color: colors.textMutedOnNavy, fontWeight: "600" },
  estado: { fontSize: 12, color: colors.goldSoft, fontWeight: "700" },
  receptor: { fontSize: 16, fontWeight: "700", color: colors.textOnNavy, marginTop: 2 },
  detalleTexto: { color: colors.textMutedOnNavy, marginTop: 2, fontSize: 13 },
  observaciones: { color: colors.danger, marginTop: 4, fontSize: 12, fontStyle: "italic" },
});
