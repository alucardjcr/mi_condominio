import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { cancelarReserva, getMisReservas, subirComprobanteReserva } from "../api/client";
import { Reserva } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import FotoCapture from "../components/FotoCapture";

const ESTADOS_CANCELABLES = ["Pendiente", "Aprobado", "Reservado"];

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

function colorEstado(estado: string) {
  switch (estado) {
    case "Pendiente":
      return "#b0730a";
    case "Aprobado":
      return "#1a6fc4";
    case "Reservado":
    case "En uso":
      return "#1a9d5c";
    case "Finalizado":
      return "#555";
    case "Rechazado":
    case "Cancelado":
    case "Expirado":
      return "#c0392b";
    default:
      return "#555";
  }
}

export default function MisReservasScreen() {
  const { token } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [subiendoComprobanteId, setSubiendoComprobanteId] = useState<number | null>(null);
  const [fotoComprobante, setFotoComprobante] = useState<string | null>(null);
  const [enviandoComprobante, setEnviandoComprobante] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setReservas(await getMisReservas(token, CONDOMINIO_ID));
      } catch (e) {
        // silencioso: se puede reintentar con pull-to-refresh
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

  const handleCancelar = (r: Reserva) => {
    if (!token) return;
    Alert.alert("Cancelar reserva", `¿Cancelar la reserva de ${r.nombre_espacio} del ${r.fecha_reserva}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelarReserva(token, r.id_reserva);
            cargar();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const handleSubirComprobante = async (r: Reserva) => {
    if (!token || !fotoComprobante) return;
    setEnviandoComprobante(true);
    try {
      await subirComprobanteReserva(token, r.id_reserva, fotoComprobante);
      setSubiendoComprobanteId(null);
      setFotoComprobante(null);
      cargar();
      Alert.alert("Comprobante enviado", "Queda a la espera de que el administrador valide el pago.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviandoComprobante(false);
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
      data={reservas}
      keyExtractor={(item) => String(item.id_reserva)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
      ListEmptyComponent={<Text style={styles.vacio}>No tienes reservas registradas todavía.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.nombre}>{item.nombre_espacio}</Text>
            <Text style={[styles.estado, { color: colorEstado(item.gls_estadoreserva) }]}>
              {item.gls_estadoreserva}
            </Text>
          </View>
          <Text style={styles.detalleTexto}>
            {item.fecha_reserva} · {item.hora_inicio.slice(0, 5)} a {item.hora_termino.slice(0, 5)}
          </Text>
          {!item.flg_gratuito && (
            <Text style={styles.detalleTexto}>
              Monto: {formatearMonto(item.monto_tarifa)}
              {item.monto_garantia ? ` + garantía ${formatearMonto(item.monto_garantia)}` : ""}
            </Text>
          )}
          {item.gls_estadoreserva === "Rechazado" && item.motivo_rechazo && (
            <Text style={styles.motivoRechazo}>Motivo: {item.motivo_rechazo}</Text>
          )}
          {item.monto_cobro_exceso > 0 && (
            <Text style={styles.motivoRechazo}>
              Cargo por exceso de horario: {formatearMonto(item.monto_cobro_exceso)} ({item.minutos_exceso} min)
            </Text>
          )}

          {item.gls_estadoreserva === "Aprobado" && !item.comprobante_pago_url && (
            <>
              {subiendoComprobanteId === item.id_reserva ? (
                <View style={{ marginTop: 8 }}>
                  <FotoCapture label="Foto del comprobante de pago" value={fotoComprobante} onChange={setFotoComprobante} />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.botonAccion, styles.botonPrimario, { flex: 1 }]}
                      onPress={() => handleSubirComprobante(item)}
                      disabled={enviandoComprobante || !fotoComprobante}
                    >
                      <Text style={styles.botonAccionTexto}>{enviandoComprobante ? "Enviando..." : "Enviar"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.botonAccion, { backgroundColor: "#999", flex: 1 }]}
                      onPress={() => {
                        setSubiendoComprobanteId(null);
                        setFotoComprobante(null);
                      }}
                    >
                      <Text style={styles.botonAccionTexto}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.botonAccion, styles.botonPrimario, { marginTop: 8 }]}
                  onPress={() => setSubiendoComprobanteId(item.id_reserva)}
                >
                  <Text style={styles.botonAccionTexto}>Subir comprobante de pago</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {item.gls_estadoreserva === "Aprobado" && !!item.comprobante_pago_url && (
            <Text style={styles.esperandoValidacion}>Comprobante enviado, esperando validación.</Text>
          )}

          {ESTADOS_CANCELABLES.includes(item.gls_estadoreserva) && subiendoComprobanteId !== item.id_reserva && (
            <TouchableOpacity style={[styles.botonAccion, styles.botonCancelar]} onPress={() => handleCancelar(item)}>
              <Text style={styles.botonAccionTexto}>Cancelar reserva</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nombre: { fontSize: 16, fontWeight: "700" },
  estado: { fontSize: 12, fontWeight: "800" },
  detalleTexto: { color: "#555", marginTop: 4, fontSize: 13 },
  motivoRechazo: { color: "#c0392b", marginTop: 4, fontSize: 12, fontWeight: "600" },
  esperandoValidacion: { color: "#1a6fc4", marginTop: 8, fontSize: 12, fontWeight: "600" },
  botonAccion: { borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonPrimario: { backgroundColor: "#1a6fc4" },
  botonCancelar: { backgroundColor: "#c0392b", marginTop: 10 },
  botonAccionTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
