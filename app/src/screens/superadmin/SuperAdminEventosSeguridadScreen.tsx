import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { superAdminGetEventosSeguridad, superAdminGetResumenEventosSeguridad } from "../../api/client";
import { EventoSeguridad, ResumenEventoSeguridad, TipoEventoSeguridad } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

const ETIQUETA_TIPO: Record<TipoEventoSeguridad, string> = {
  rate_limit_login: "Límite de intentos de login",
  rate_limit_recuperacion: "Límite de recuperación de clave",
  login_fallido: "Login fallido",
};

const COLOR_TIPO: Record<TipoEventoSeguridad, string> = {
  rate_limit_login: "#FEE2E2",
  rate_limit_recuperacion: "#FDE68A",
  login_fallido: "#FEF3C7",
};

function formatFecha(fecha: string) {
  // fecha llega como "YYYY-MM-DD HH:MM:SS" desde MySQL.
  const [f, h] = fecha.split(" ");
  return `${f} ${h?.slice(0, 5) ?? ""}`;
}

// Ronda 45, a pedido explícito del usuario (revisión de seguridad — punto
// 3, "sin monitoreo activo"): antes, si alguien atacaba el login por
// fuerza bruta, todo eso pasaba en silencio — se bloqueaba correctamente,
// pero nadie se enteraba. Exclusivo del SuperAdmin (no es por
// condominio — ver la nota completa en schema-mysql.sql sobre
// evento_seguridad).
export default function SuperAdminEventosSeguridadScreen() {
  const { token } = useAuth();
  const [resumen, setResumen] = useState<ResumenEventoSeguridad[]>([]);
  const [eventos, setEventos] = useState<EventoSeguridad[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([
      superAdminGetResumenEventosSeguridad(token),
      superAdminGetEventosSeguridad(token, filtroTipo !== "Todos" ? { tipo: filtroTipo } : undefined),
    ])
      .then(([r, e]) => {
        setResumen(r);
        setEventos(e);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [token, filtroTipo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const totalUltimas24h = resumen.reduce((acc, r) => acc + Number(r.ultimas_24h), 0);

  if (cargando && eventos.length === 0) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.resumenCard}>
        <Text style={styles.resumenNumero}>{totalUltimas24h}</Text>
        <Text style={styles.resumenTexto}>eventos en las últimas 24 horas</Text>
      </View>

      {resumen.length > 0 && (
        <View style={styles.filaResumenTipos}>
          {resumen.map((r) => (
            <View key={r.tipo} style={styles.chipResumen}>
              <Text style={styles.chipResumenTitulo}>{ETIQUETA_TIPO[r.tipo] ?? r.tipo}</Text>
              <Text style={styles.chipResumenNumeros}>
                {r.ultimas_24h} hoy · {r.ultimos_7dias} en 7 días
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.filtros}>
        {(["Todos", "rate_limit_login", "rate_limit_recuperacion", "login_fallido"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filtroChip, filtroTipo === t && styles.filtroChipActivo]}
            onPress={() => setFiltroTipo(t)}
          >
            <Text style={[styles.filtroChipTexto, filtroTipo === t && styles.filtroChipTextoActivo]} numberOfLines={1}>
              {t === "Todos" ? "Todos" : ETIQUETA_TIPO[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {eventos.length === 0 && <Text style={styles.vacio}>Sin eventos registrados con este filtro.</Text>}

      {eventos.map((e) => (
        <View key={e.id_eventoseguridad} style={styles.card}>
          <View style={[styles.badge, { backgroundColor: COLOR_TIPO[e.tipo] ?? colors.border }]}>
            <Text style={styles.badgeTexto}>{ETIQUETA_TIPO[e.tipo] ?? e.tipo}</Text>
          </View>
          <Text style={styles.fecha}>{formatFecha(e.fecha)}</Text>
          {e.usuariocol_intentado && <Text style={styles.detalle}>Usuario intentado: {e.usuariocol_intentado}</Text>}
          {e.ip && <Text style={styles.detalle}>IP: {e.ip}</Text>}
          {e.detalle && <Text style={styles.detalle}>{e.detalle}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: spacing.sm },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600" },

  resumenCard: { backgroundColor: colors.navy900, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center" },
  resumenNumero: { fontSize: 40, fontWeight: "800", color: colors.textOnNavy },
  resumenTexto: { ...typography.small, color: colors.textMutedOnNavy, marginTop: 2 },

  filaResumenTipos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chipResumen: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, flexGrow: 1, borderWidth: 1, borderColor: colors.border },
  chipResumenTitulo: { fontSize: 12, fontWeight: "700", color: colors.textDark },
  chipResumenNumeros: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  filtros: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  filtroChip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  filtroChipActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  filtroChipTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 11 },
  filtroChipTextoActivo: { color: colors.textOnNavy },

  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: spacing.xs },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
  fecha: { fontSize: 12, color: colors.textMuted },
  detalle: { fontSize: 12, color: colors.textDark, marginTop: 2 },
});
