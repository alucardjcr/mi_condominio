import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getEspaciosComunes } from "../api/client";
import { EspacioComun } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/theme";

// Pantalla compartida por Residente/Comité/Administrador: catálogo de
// espacios comunes reservables. Se usa tanto para que un residente reserve
// para su propio depto como para que Admin/Comité reserve "a nombre de un
// residente" (regla 4/12) — la pantalla de creación (ReservaCrear) decide
// qué campos mostrar según el rol.
function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

export default function ReservasEspaciosScreen({ navigation }: any) {
  const { token } = useAuth();
  const [espacios, setEspacios] = useState<EspacioComun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        const data = await getEspaciosComunes(token, CONDOMINIO_ID);
        setEspacios(data.filter((e) => e.flg_reservable));
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={espacios}
      keyExtractor={(item) => String(item.id_espaciocomun)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
      ListEmptyComponent={
        <Text style={styles.vacio}>
          Todavía no hay espacios comunes reservables configurados en el condominio.
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate("ReservaCrear", { espacio: item })}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <Text style={styles.detalleTexto}>{item.gls_tipoespaciocomun}</Text>
            <Text style={styles.detalleTexto}>
              Horario: {item.hora_apertura.slice(0, 5)} a {item.hora_cierre.slice(0, 5)}
              {item.capacidad ? ` · Capacidad: ${item.capacidad}` : ""}
            </Text>
            {!!item.monto_garantia && (
              <Text style={styles.detalleTexto}>Garantía: {formatearMonto(item.monto_garantia)}</Text>
            )}
          </View>
          <Text style={item.flg_gratuito ? styles.precioGratis : styles.precio}>
            {item.flg_gratuito
              ? "Gratuito"
              : `${formatearMonto(item.precio_bloque)} / ${item.bloque_horas}h`}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  vacio: { textAlign: "center", color: colors.textMutedOnNavy, marginTop: 30 },
  card: {
    backgroundColor: colors.navy800,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.navy600,
  },
  nombre: { fontSize: 16, fontWeight: "700", color: colors.textOnNavy },
  detalleTexto: { color: colors.textMutedOnNavy, marginTop: 2, fontSize: 13 },
  precio: { fontSize: 14, fontWeight: "800", color: colors.goldSoft, marginLeft: 8, textAlign: "right" },
  precioGratis: { fontSize: 14, fontWeight: "800", color: "#1a9d5c", marginLeft: 8, textAlign: "right" },
});
