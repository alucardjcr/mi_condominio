import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  adminAprobarReserva,
  adminGetReservas,
  adminRechazarReserva,
  adminResolverGarantia,
  adminValidarPagoReserva,
} from "../../api/client";
import { EstadoReservaGls, Reserva } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

const CHIPS: { label: string; estado?: EstadoReservaGls }[] = [
  { label: "Todas" },
  { label: "Pendiente", estado: "Pendiente" },
  { label: "Aprobado", estado: "Aprobado" },
  { label: "Reservado", estado: "Reservado" },
  { label: "En uso", estado: "En uso" },
  { label: "Finalizado", estado: "Finalizado" },
  { label: "Rechazado", estado: "Rechazado" },
  { label: "Cancelado", estado: "Cancelado" },
  { label: "Expirado", estado: "Expirado" },
];

// Bandeja de gestión de reservas para Administrador/Comité: aprobar,
// rechazar (con motivo), validar el pago una vez subido el comprobante, y
// resolver la garantía después de que el guardia marca la salida. Para
// crear una reserva "a nombre de un residente" se usa el mismo flujo que
// el residente (pantalla ReservasEspacios → ReservaCrear), que ya muestra
// los campos de torre/depto/residente cuando el usuario logeado es
// Admin/Comité.
export default function AdminReservasScreen({ navigation }: any) {
  const { token } = useAuth();
  const [chipSel, setChipSel] = useState(0);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [rechazandoId, setRechazandoId] = useState<number | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [retirandoGarantiaId, setRetirandoGarantiaId] = useState<number | null>(null);
  const [montoRetenido, setMontoRetenido] = useState("");
  const [observacionGarantia, setObservacionGarantia] = useState("");

  const cargar = useCallback(
    async (chipIndex = chipSel) => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await adminGetReservas(token, {
          condominio_id: CONDOMINIO_ID,
          estado: CHIPS[chipIndex].estado,
        });
        setReservas(data);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    },
    [token, chipSel]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const handleSeleccionarChip = (index: number) => {
    setChipSel(index);
    cargar(index);
  };

  const handleAprobar = async (r: Reserva) => {
    if (!token) return;
    setProcesandoId(r.id_reserva);
    try {
      await adminAprobarReserva(token, r.id_reserva);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleConfirmarRechazo = async (r: Reserva) => {
    if (!token) return;
    if (!motivoRechazo.trim()) {
      Alert.alert("Falta el motivo", "El motivo del rechazo es obligatorio.");
      return;
    }
    setProcesandoId(r.id_reserva);
    try {
      await adminRechazarReserva(token, r.id_reserva, motivoRechazo.trim());
      setRechazandoId(null);
      setMotivoRechazo("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleValidarPago = async (r: Reserva) => {
    if (!token) return;
    setProcesandoId(r.id_reserva);
    try {
      await adminValidarPagoReserva(token, r.id_reserva);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDevolverGarantia = async (r: Reserva) => {
    if (!token) return;
    setProcesandoId(r.id_reserva);
    try {
      await adminResolverGarantia(token, r.id_reserva, "Devuelta");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleConfirmarRetencion = async (r: Reserva) => {
    if (!token) return;
    const monto = Number(montoRetenido);
    if (!monto || monto <= 0) {
      Alert.alert("Monto inválido", "Indica cuánto de la garantía se retiene.");
      return;
    }
    setProcesandoId(r.id_reserva);
    try {
      await adminResolverGarantia(token, r.id_reserva, "Retenida", monto, observacionGarantia.trim() || undefined);
      setRetirandoGarantiaId(null);
      setMontoRetenido("");
      setObservacionGarantia("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f6f8" }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {CHIPS.map((c, i) => (
          <TouchableOpacity
            key={c.label}
            style={[styles.chip, chipSel === i && styles.chipActivo]}
            onPress={() => handleSeleccionarChip(i)}
          >
            <Text style={[styles.chipTexto, chipSel === i && styles.chipTextoActivo]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.botonNueva} onPress={() => navigation.navigate("ReservasEspacios")}>
        <Text style={styles.botonNuevaTexto}>+ Reservar a nombre de un residente</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={reservas}
          keyExtractor={(item) => String(item.id_reserva)}
          contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
          ListEmptyComponent={<Text style={styles.vacio}>No hay reservas en ese estado.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.nombre}>{item.nombre_espacio}</Text>
                <Text style={styles.estado}>{item.gls_estadoreserva}</Text>
              </View>
              <Text style={styles.detalleTexto}>
                {item.nombre_torre} · Depto {item.numero_unidad} · {item.nombre_solicitante}
              </Text>
              <Text style={styles.detalleTexto}>
                {item.fecha_reserva} · {item.hora_inicio.slice(0, 5)} a {item.hora_termino.slice(0, 5)}
              </Text>
              {!item.flg_gratuito && (
                <Text style={styles.detalleTexto}>
                  {formatearMonto(item.monto_tarifa)}
                  {item.monto_garantia ? ` + garantía ${formatearMonto(item.monto_garantia)}` : ""}
                  {item.comprobante_pago_url ? " · comprobante subido" : " · sin comprobante"}
                </Text>
              )}
              {item.monto_cobro_exceso > 0 && (
                <Text style={styles.detalleTexto}>
                  Exceso: {item.minutos_exceso} min · {formatearMonto(item.monto_cobro_exceso)}
                </Text>
              )}
              {item.estado_garantia === "Retenida" && (
                <Text style={styles.detalleTexto}>
                  Garantía retenida: {formatearMonto(item.monto_garantia_retenido)}
                  {item.observacion_garantia ? ` (${item.observacion_garantia})` : ""}
                </Text>
              )}

              {item.gls_estadoreserva === "Pendiente" && rechazandoId !== item.id_reserva && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.botonAccion, styles.botonAprobar, { flex: 1 }]}
                    onPress={() => handleAprobar(item)}
                    disabled={procesandoId === item.id_reserva}
                  >
                    <Text style={styles.botonAccionTexto}>Aprobar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.botonAccion, styles.botonRechazar, { flex: 1 }]}
                    onPress={() => setRechazandoId(item.id_reserva)}
                    disabled={procesandoId === item.id_reserva}
                  >
                    <Text style={styles.botonAccionTexto}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {rechazandoId === item.id_reserva && (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Motivo del rechazo"
                    value={motivoRechazo}
                    onChangeText={setMotivoRechazo}
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.botonAccion, styles.botonRechazar, { flex: 1 }]}
                      onPress={() => handleConfirmarRechazo(item)}
                      disabled={procesandoId === item.id_reserva}
                    >
                      <Text style={styles.botonAccionTexto}>Confirmar rechazo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.botonAccion, { backgroundColor: "#999", flex: 1 }]}
                      onPress={() => {
                        setRechazandoId(null);
                        setMotivoRechazo("");
                      }}
                    >
                      <Text style={styles.botonAccionTexto}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {item.gls_estadoreserva === "Aprobado" && (
                <TouchableOpacity
                  style={[styles.botonAccion, styles.botonAprobar, { marginTop: 10 }, !item.comprobante_pago_url && styles.botonDeshabilitado]}
                  onPress={() => handleValidarPago(item)}
                  disabled={procesandoId === item.id_reserva || !item.comprobante_pago_url}
                >
                  <Text style={styles.botonAccionTexto}>
                    {item.comprobante_pago_url ? "Validar pago" : "Esperando comprobante del residente"}
                  </Text>
                </TouchableOpacity>
              )}

              {item.gls_estadoreserva === "Finalizado" &&
                item.estado_garantia === "Pendiente" &&
                item.monto_garantia > 0 &&
                (retirandoGarantiaId === item.id_reserva ? (
                  <View style={{ marginTop: 10 }}>
                    <TextInput
                      style={styles.input}
                      placeholder={`Monto a retener (máx ${formatearMonto(item.monto_garantia)})`}
                      value={montoRetenido}
                      onChangeText={setMontoRetenido}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.input, { marginTop: 8 }]}
                      placeholder="Motivo (opcional)"
                      value={observacionGarantia}
                      onChangeText={setObservacionGarantia}
                    />
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.botonAccion, styles.botonRechazar, { flex: 1 }]}
                        onPress={() => handleConfirmarRetencion(item)}
                        disabled={procesandoId === item.id_reserva}
                      >
                        <Text style={styles.botonAccionTexto}>Confirmar retención</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.botonAccion, { backgroundColor: "#999", flex: 1 }]}
                        onPress={() => {
                          setRetirandoGarantiaId(null);
                          setMontoRetenido("");
                          setObservacionGarantia("");
                        }}
                      >
                        <Text style={styles.botonAccionTexto}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.botonAccion, styles.botonAprobar, { flex: 1 }]}
                      onPress={() => handleDevolverGarantia(item)}
                      disabled={procesandoId === item.id_reserva}
                    >
                      <Text style={styles.botonAccionTexto}>Devolver garantía</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.botonAccion, styles.botonRechazar, { flex: 1 }]}
                      onPress={() => setRetirandoGarantiaId(item.id_reserva)}
                      disabled={procesandoId === item.id_reserva}
                    >
                      <Text style={styles.botonAccionTexto}>Retener garantía</Text>
                    </TouchableOpacity>
                  </View>
                ))}

              {item.gls_estadoreserva === "Rechazado" && item.motivo_rechazo && (
                <Text style={styles.motivoTexto}>Motivo: {item.motivo_rechazo}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  chips: { flexGrow: 0, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: "#ddd", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipActivo: { backgroundColor: "#333", borderColor: "#333" },
  chipTexto: { fontSize: 13, fontWeight: "600", color: "#333" },
  chipTextoActivo: { color: "#fff" },
  botonNueva: { marginHorizontal: 16, marginTop: 12, backgroundColor: "#8e44ad", borderRadius: 10, padding: 12, alignItems: "center" },
  botonNuevaTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nombre: { fontSize: 16, fontWeight: "700" },
  estado: { fontSize: 12, fontWeight: "800", color: "#1a6fc4" },
  detalleTexto: { color: "#555", marginTop: 4, fontSize: 13 },
  motivoTexto: { color: "#c0392b", marginTop: 6, fontSize: 12, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff" },
  botonAccion: { borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonAprobar: { backgroundColor: "#1a9d5c" },
  botonRechazar: { backgroundColor: "#c0392b" },
  botonDeshabilitado: { opacity: 0.5 },
  botonAccionTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
