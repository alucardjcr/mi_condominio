import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getQuienVieneHoy } from "../api/client";
import { QuienVieneHoy } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

const ESTADO_COLOR: Record<string, string> = {
  Programada: "#FEF3C7",
  "En curso": "#DBEAFE",
  Realizada: "#DCFCE7",
  Cancelada: "#FEE2E2",
};

function formatHora(fechaHora: string | null) {
  if (!fechaHora) return null;
  const partes = fechaHora.split(" ");
  return partes[1]?.slice(0, 5) ?? fechaHora;
}

// Ronda 40, a pedido explícito del usuario: vista para que CUALQUIER
// residente sepa qué personal externo (aseo, jardinería, mantención) tiene
// turno hoy en el condominio, y qué mantenciones están programadas hoy —
// antes esta información solo la veía Administrador/Comité/Guardia.
export default function QuienVieneHoyScreen() {
  const { token } = useAuth();
  const [datos, setDatos] = useState<QuienVieneHoy | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setCargando(true);
      getQuienVieneHoy(token, CONDOMINIO_ID)
        .then(setDatos)
        .catch((e) => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  const personal = datos?.personal_externo ?? [];
  const mantenciones = datos?.mantenciones ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} />}
    >
      <Text style={styles.intro}>Quién tiene turno o visita programada hoy en el condominio.</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.seccionTitulo}>Personal externo</Text>
      {personal.length === 0 && <Text style={styles.vacio}>Nadie ha marcado turno hoy todavía.</Text>}
      {personal.map((p) => (
        <View key={p.id_turnopersonal} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>{p.nombre_usuario}</Text>
            {p.gls_tipopersonal && <Text style={styles.detalle}>{p.gls_tipopersonal}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: p.fecha_termino ? colors.border : "#DCFCE7" }]}>
            <Text style={styles.badgeTexto}>
              {p.fecha_termino ? `Se retiró ${formatHora(p.fecha_termino)}` : `Entró ${formatHora(p.fecha_inicio)}`}
            </Text>
          </View>
        </View>
      ))}

      <Text style={styles.seccionTitulo}>Mantenciones de hoy</Text>
      {mantenciones.length === 0 && <Text style={styles.vacio}>No hay mantenciones programadas para hoy.</Text>}
      {mantenciones.map((m) => (
        <View key={m.id_mantencion} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>{m.titulo}</Text>
            <Text style={styles.detalle}>{m.gls_tipoelementomantencion}</Text>
            {m.empresa_nombre && <Text style={styles.detalle}>{m.empresa_nombre}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[m.gls_estadomantencion] ?? colors.border }]}>
            <Text style={styles.badgeTexto}>{m.gls_estadomantencion}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: spacing.xs },
  intro: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600", marginBottom: spacing.sm },
  seccionTitulo: { ...typography.heading, color: colors.textDark, marginTop: spacing.md, marginBottom: spacing.xs },
  vacio: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  nombre: { ...typography.body, color: colors.textDark, fontWeight: "700" },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, marginLeft: spacing.sm },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
});
