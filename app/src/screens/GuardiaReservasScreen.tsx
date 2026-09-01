import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getReservasDelDia, marcarLlegadaReserva, marcarSalidaReserva } from "../api/client";
import { Reserva } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";

function hoyComoTexto() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

// Pantalla de portería: reservas del día (solo Reservado / En uso /
// Finalizado, ver listarReservasDelDia — las Pendiente/Aprobado todavía no
// corresponden al guardia). Permite marcar llegada y salida del espacio, lo
// que dispara el cálculo de exceso de horario si corresponde (regla 11).
export default function GuardiaReservasScreen() {
  const { token } = useAuth();
  const [fecha, setFecha] = useState(hoyComoTexto());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        setReservas(await getReservasDelDia(token, CONDOMINIO_ID, fecha));
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
        setRefrescando(false);
      }
    },
    [token, fecha]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const handleLlegada = async (r: Reserva) => {
    if (!token) return;
    setProcesandoId(r.id_reserva);
    try {
      await marcarLlegadaReserva(token, r.id_reserva);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleSalida = async (r: Reserva) => {
    if (!token) return;
    setProcesandoId(r.id_reserva);
    try {
      const actualizada = await marcarSalidaReserva(token, r.id_reserva);
      if (actualizada.monto_cobro_exceso > 0) {
        Alert.alert(
          "Salida registrada",
          `Se excedió el horario por ${actualizada.minutos_exceso} min. Se genera un cargo de ${formatearMonto(
            actualizada.monto_cobro_exceso
          )} en el gasto común del depto.`
        );
      }
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f6f8" }}>
      <View style={styles.filtros}>
        <Text style={styles.label}>Fecha</Text>
        <TextInput
          style={styles.input}
          value={fecha}
          onChangeText={setFecha}
          placeholder="AAAA-MM-DD"
          autoCapitalize="none"
          onSubmitEditing={() => cargar()}
        />
        <TouchableOpacity style={styles.botonBuscar} onPress={() => cargar()}>
          <Text style={styles.botonBuscarTexto}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={reservas}
          keyExtractor={(item) => String(item.id_reserva)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
          ListEmptyComponent={<Text style={styles.vacio}>No hay reservas confirmadas para ese día.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.nombre}>{item.nombre_espacio}</Text>
              <Text style={styles.detalleTexto}>
                {item.nombre_torre} · Depto {item.numero_unidad} · {item.nombre_solicitante}
              </Text>
              <Text style={styles.detalleTexto}>
                {item.hora_inicio.slice(0, 5)} a {item.hora_termino.slice(0, 5)} · {item.gls_estadoreserva}
              </Text>

              {item.gls_estadoreserva === "Reservado" && (
                <TouchableOpacity
                  style={[styles.boton, styles.botonLlegada]}
                  onPress={() => handleLlegada(item)}
                  disabled={procesandoId === item.id_reserva}
                >
                  <Text style={styles.botonTexto}>
                    {procesandoId === item.id_reserva ? "Guardando..." : "Marcar llegada"}
                  </Text>
                </TouchableOpacity>
              )}
              {item.gls_estadoreserva === "En uso" && (
                <TouchableOpacity
                  style={[styles.boton, styles.botonSalida]}
                  onPress={() => handleSalida(item)}
                  disabled={procesandoId === item.id_reserva}
                >
                  <Text style={styles.botonTexto}>
                    {procesandoId === item.id_reserva ? "Guardando..." : "Marcar salida"}
                  </Text>
                </TouchableOpacity>
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
  filtros: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee", backgroundColor: "#fff" },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15 },
  botonBuscar: { backgroundColor: "#333", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  botonBuscarTexto: { color: "#fff", fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  nombre: { fontSize: 16, fontWeight: "700" },
  detalleTexto: { color: "#555", marginTop: 2, fontSize: 13 },
  boton: { borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  botonLlegada: { backgroundColor: "#1a9d5c" },
  botonSalida: { backgroundColor: "#c0392b" },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
