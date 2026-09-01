import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getPaquetesPendientes, paqueteCambiarEstado } from "../api/client";
import { EstadoPaqueteGls, PaquetePendiente } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

const OPCIONES_ESTADO_EXCEPCION: { gls: EstadoPaqueteGls; label: string }[] = [
  { gls: "Rechazado por el residente", label: "Rechazado por el residente" },
  { gls: "Devuelto al remitente", label: "Devuelto al remitente" },
  { gls: "Perdido", label: "Perdido" },
];

function formatearFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function colorEstado(gls: string) {
  switch (gls) {
    case "Recepcionado":
      return "#8a8a8a";
    case "Notificado":
      return "#c98a1a";
    case "En portería":
      return "#1a6fc4";
    default:
      return "#8a8a8a";
  }
}

export default function PaquetePendientesScreen({ navigation }: any) {
  const { token } = useAuth();
  const [paquetes, setPaquetes] = useState<PaquetePendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Flujo de 2 pasos para Rechazado/Devuelto/Perdido: elegir estado -> observación.
  const [paqueteParaEstado, setPaqueteParaEstado] = useState<PaquetePendiente | null>(null);
  const [estadoElegido, setEstadoElegido] = useState<EstadoPaqueteGls | null>(null);
  const [observacion, setObservacion] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getPaquetesPendientes(token, CONDOMINIO_ID);
      setPaquetes(data);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const marcarEstadoRapido = async (paquete: PaquetePendiente, nuevoEstado: EstadoPaqueteGls) => {
    if (!token) return;
    try {
      await paqueteCambiarEstado(token, paquete.id_paquete, nuevoEstado, undefined, CONDOMINIO_ID);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const cerrarModalEstado = () => {
    setPaqueteParaEstado(null);
    setEstadoElegido(null);
    setObservacion("");
  };

  const confirmarEstadoExcepcion = async () => {
    if (!token || !paqueteParaEstado || !estadoElegido) return;
    setGuardandoEstado(true);
    try {
      await paqueteCambiarEstado(token, paqueteParaEstado.id_paquete, estadoElegido, observacion.trim() || undefined, CONDOMINIO_ID);
      cerrarModalEstado();
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoEstado(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#1a6fc4" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.acciones}>
        <TouchableOpacity style={styles.botonTop} onPress={() => navigation.navigate("PaqueteRegistrar")}>
          <Text style={styles.botonTopTexto}>+ Registrar paquete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.enlace} onPress={() => navigation.navigate("PaqueteBusqueda")}>
          <Text style={styles.enlaceTexto}>Buscar / historial</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={paquetes}
        keyExtractor={(p) => String(p.id_paquete)}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} />}
        ListEmptyComponent={<Text style={styles.vacio}>No hay paquetes pendientes de retiro.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.tipo}>{item.gls_tipopaquete}</Text>
              <View style={[styles.badgeEstado, { backgroundColor: colorEstado(item.gls_estadopaquete) }]}>
                <Text style={styles.badgeEstadoTexto}>{item.gls_estadopaquete}</Text>
              </View>
            </View>
            <Text style={styles.receptor}>{item.nombre_receptor}</Text>
            <Text style={styles.detalle}>
              {item.nombre_torre} · Depto {item.numero_unidad}
              {item.rut_receptor ? ` · RUT ${item.rut_receptor}` : ""}
            </Text>
            <Text style={styles.detalle}>Recibido: {formatearFecha(item.fecha_recepcion)}</Text>
            <View style={styles.filaDias}>
              <Text style={styles.dias}>{item.diasPendiente === 0 ? "Llegó hoy" : `${item.diasPendiente} día(s) sin retirar`}</Text>
              {item.alerta7dias && <Text style={styles.alertaBadge}>⚠ 7+ días — avisar al comité</Text>}
            </View>
            {!item.receptor_coincide && item.residente_receptor_usuario_id === null && (
              <Text style={styles.alertaTexto}>No coincide con un residente precargado.</Text>
            )}

            <View style={styles.botones}>
              {item.gls_estadopaquete === "Recepcionado" && (
                <TouchableOpacity style={styles.botonSecundario} onPress={() => marcarEstadoRapido(item, "Notificado")}>
                  <Text style={styles.botonSecundarioTexto}>Marcar notificado</Text>
                </TouchableOpacity>
              )}
              {item.gls_estadopaquete !== "En portería" && (
                <TouchableOpacity style={styles.botonSecundario} onPress={() => marcarEstadoRapido(item, "En portería")}>
                  <Text style={styles.botonSecundarioTexto}>Marcar en portería</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.botonEntregar}
                onPress={() => navigation.navigate("PaqueteEntrega", { idPaquete: item.id_paquete })}
              >
                <Text style={styles.botonEntregarTexto}>Entregar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botonOtro} onPress={() => setPaqueteParaEstado(item)}>
                <Text style={styles.botonOtroTexto}>Otro estado ▾</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Paso 1: elegir Rechazado / Devuelto / Perdido */}
      <Modal visible={!!paqueteParaEstado && !estadoElegido} transparent animationType="fade" onRequestClose={cerrarModalEstado}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>¿Qué pasó con este paquete?</Text>
            {OPCIONES_ESTADO_EXCEPCION.map((op) => (
              <TouchableOpacity key={op.gls} style={styles.opcionModal} onPress={() => setEstadoElegido(op.gls)}>
                <Text style={styles.opcionModalTexto}>{op.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelar} onPress={cerrarModalEstado}>
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Paso 2: observación opcional + confirmar */}
      <Modal visible={!!estadoElegido} transparent animationType="fade" onRequestClose={cerrarModalEstado}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>{estadoElegido}</Text>
            <TextInput
              style={styles.observacionInput}
              placeholder="Observación (opcional)"
              value={observacion}
              onChangeText={setObservacion}
              multiline
            />
            <TouchableOpacity
              style={[styles.confirmar, guardandoEstado && styles.botonDeshabilitado]}
              onPress={confirmarEstadoExcepcion}
              disabled={guardandoEstado}
            >
              <Text style={styles.confirmarTexto}>{guardandoEstado ? "Guardando..." : "Confirmar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelar} onPress={cerrarModalEstado}>
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  acciones: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
  botonTop: { backgroundColor: "#1a9d5c", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  botonTopTexto: { color: "#fff", fontWeight: "700" },
  enlace: { paddingVertical: 10 },
  enlaceTexto: { color: "#1a6fc4", fontWeight: "600" },
  lista: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  vacio: { textAlign: "center", color: "#888", marginTop: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tipo: { fontSize: 13, color: "#888", fontWeight: "600" },
  badgeEstado: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeEstadoTexto: { color: "#fff", fontSize: 11, fontWeight: "700" },
  receptor: { fontSize: 17, fontWeight: "700", color: "#222", marginTop: 4 },
  detalle: { fontSize: 13, color: "#555", marginTop: 2 },
  filaDias: { flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 8 },
  dias: { fontSize: 12, color: "#555" },
  alertaBadge: { fontSize: 12, color: "#c0392b", fontWeight: "700" },
  alertaTexto: { color: "#c0392b", fontSize: 12, marginTop: 4 },
  botones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  botonSecundario: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  botonSecundarioTexto: { color: "#333", fontSize: 12, fontWeight: "600" },
  botonEntregar: { backgroundColor: "#1a9d5c", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  botonEntregarTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
  botonOtro: { borderWidth: 1, borderColor: "#c0392b", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  botonOtroTexto: { color: "#c0392b", fontSize: 12, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  modalTitulo: { fontSize: 16, fontWeight: "700", color: "#222", marginBottom: 12 },
  opcionModal: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  opcionModalTexto: { fontSize: 15, color: "#333" },
  observacionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  confirmar: { backgroundColor: "#1a6fc4", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 14 },
  confirmarTexto: { color: "#fff", fontWeight: "700" },
  botonDeshabilitado: { opacity: 0.6 },
  cancelar: { alignItems: "center", marginTop: 10 },
  cancelarTexto: { color: "#999", fontWeight: "600" },
});
