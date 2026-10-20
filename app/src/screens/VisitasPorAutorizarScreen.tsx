import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { decidirVisita, getAutorizacionesVisita } from "../api/client";
import { AutorizacionVisitaGuardia } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 80, a pedido explícito del usuario: el residente al que visitan
// autoriza o rechaza desde su app. Acá el guardia ve en qué va cada visita;
// si el residente no responde en 5 minutos aparece la opción de llamarlo por
// teléfono (y de dejar pasar a la visita bajo responsabilidad de portería).
// Se refresca sola cada 10 segundos mientras la pantalla está abierta.
export default function VisitasPorAutorizarScreen() {
  const { token } = useAuth();
  const [filas, setFilas] = useState<AutorizacionVisitaGuardia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [decidiendo, setDecidiendo] = useState<number | null>(null);

  const cargar = useCallback(
    async (modo: "inicial" | "pull" | "silencioso" = "silencioso") => {
      if (!token) return;
      if (modo === "inicial") setCargando(true);
      if (modo === "pull") setRefrescando(true);
      try {
        setFilas(await getAutorizacionesVisita(token));
      } catch (e: any) {
        if (modo !== "silencioso") Alert.alert("Error", e.message);
      } finally {
        setCargando(false);
        setRefrescando(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      cargar("inicial");
      const id = setInterval(() => cargar("silencioso"), 10000);
      return () => clearInterval(id);
    }, [cargar])
  );

  const decidir = (f: AutorizacionVisitaGuardia, accion: "permitir" | "denegar") => {
    const permitir = accion === "permitir";
    Alert.alert(
      permitir ? "Dejar pasar sin respuesta" : "No dejar pasar",
      permitir
        ? `¿Dejas pasar a ${f.nombre_visita} aunque ${f.nombre_residente_visitado ?? "el residente"} no respondió? Queda registrado que la decisión fue de portería.`
        : `¿Confirmas que ${f.nombre_visita} NO debe ingresar? Se cancela la visita y se libera su cupo si tenía.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: permitir ? "Dejar pasar" : "No dejar pasar",
          style: permitir ? "default" : "destructive",
          onPress: async () => {
            if (!token) return;
            setDecidiendo(f.id_visita);
            try {
              await decidirVisita(token, f.id_visita, accion);
              await cargar("silencioso");
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setDecidiendo(null);
            }
          },
        },
      ]
    );
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const pendientes = filas.filter((f) => f.estado === "Pendiente").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar("pull")} tintColor={colors.textOnNavy} />}
    >
      <Text style={styles.titulo}>Visitas por autorizar</Text>
      <Text style={styles.subtitulo}>
        {pendientes > 0
          ? `${pendientes} visita${pendientes === 1 ? "" : "s"} esperando respuesta del residente. No las dejes pasar hasta que autorice.`
          : "No hay visitas esperando autorización. Esta lista se actualiza sola."}
      </Text>

      {filas.map((f) => {
        const pendiente = f.estado === "Pendiente";
        const autorizada = f.estado === "Autorizada";
        const color = pendiente ? colors.warning : autorizada ? colors.success : colors.danger;
        const etiqueta = pendiente ? "⏳ Esperando respuesta" : autorizada ? "✅ Autorizada" : "⛔ Rechazada";
        const vehicular = f.gls_tipovisita?.toLowerCase().startsWith("veh");
        const nombreRes = f.nombre_residente_visitado ?? "el residente";
        return (
          <View key={f.id_visita} style={[styles.card, { borderLeftColor: color }]}>
            <View style={styles.filaTop}>
              <Text style={styles.nombre} numberOfLines={2}>
                {f.nombre_visita}
              </Text>
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeTexto}>{etiqueta}</Text>
              </View>
            </View>
            <Text style={styles.detalle}>
              {vehicular ? "🚗 Vehicular" : "🚶 Peatonal"}
              {vehicular && f.patente ? `  ·  Patente ${f.patente}` : ""}
            </Text>
            <Text style={styles.detalle}>
              {f.nombre_torre} · Depto {f.numero_unidad}  ·  Visita a {nombreRes}
            </Text>

            {pendiente && (
              <Text style={styles.detalle}>
                Esperando hace {f.minutos_espera} min{f.minutos_espera === 1 ? "" : "s"}
              </Text>
            )}
            {!pendiente && f.respondida_por && (
              <Text style={styles.detalle}>
                {f.respondida_por === "Residente" ? `Respondió ${nombreRes}` : "Decisión tomada por portería"}
              </Text>
            )}
            {autorizada && <Text style={[styles.aviso, { color: colors.success }]}>Puede ingresar.</Text>}
            {f.estado === "Rechazada" && <Text style={[styles.aviso, { color: colors.danger }]}>NO debe ingresar.</Text>}

            {pendiente && f.puede_llamar && (
              <View style={styles.acciones}>
                <Text style={styles.aviso}>{nombreRes} no respondió en 5 minutos.</Text>
                {f.telefono_residente ? (
                  <TouchableOpacity
                    style={styles.botonNaranja}
                    onPress={() => Linking.openURL(`tel:${f.telefono_residente}`)}
                  >
                    <Text style={styles.botonNaranjaTexto}>📞 Llamar a {nombreRes} ({f.telefono_residente})</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detalle}>
                    {nombreRes} no tiene teléfono registrado. Avisa al administrador para que lo agregue.
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.botonSecundario, decidiendo === f.id_visita && { opacity: 0.5 }]}
                  disabled={decidiendo === f.id_visita}
                  onPress={() => decidir(f, "permitir")}
                >
                  <Text style={styles.botonSecundarioTexto}>✅ Dejar pasar (sin respuesta)</Text>
                </TouchableOpacity>
              </View>
            )}

            {pendiente && (
              <TouchableOpacity
                style={[styles.botonPeligro, decidiendo === f.id_visita && { opacity: 0.5 }]}
                disabled={decidiendo === f.id_visita}
                onPress={() => decidir(f, "denegar")}
              >
                <Text style={styles.botonPeligroTexto}>⛔ No dejar pasar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  titulo: { ...typography.title, color: colors.textOnNavy },
  subtitulo: { ...typography.small, color: colors.textMutedOnNavy, marginBottom: spacing.sm },
  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.md, borderLeftWidth: 5 },
  filaTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  nombre: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.textOnNavy },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  detalle: { color: colors.textMutedOnNavy, fontWeight: "700", marginTop: 4, fontSize: 12 },
  aviso: { color: colors.textOnNavy, fontWeight: "800", marginTop: 6, fontSize: 13 },
  acciones: { gap: 8, marginTop: 6 },
  botonNaranja: {
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonNaranjaTexto: { color: colors.botonNaranjaTexto, fontWeight: "800" },
  botonSecundario: {
    borderWidth: 1,
    borderColor: colors.navy600,
    backgroundColor: colors.navy700,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonSecundarioTexto: { color: colors.textOnNavy, fontWeight: "700" },
  botonPeligro: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonPeligroTexto: { color: colors.danger, fontWeight: "800" },
});
