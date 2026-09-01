import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminGetAuditoria } from "../../api/client";
import { LogAuditoria } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors, radius, spacing, typography } from "../../theme/theme";

const ACCIONES = ["Todas", "POST", "PATCH", "PUT", "DELETE"] as const;

function colorAccion(accion: string) {
  if (accion === "DELETE") return "#FEE2E2";
  if (accion === "POST") return "#DCFCE7";
  if (accion === "PATCH" || accion === "PUT") return "#FEF3C7";
  return colors.border;
}

// Ronda 33, a pedido explícito del usuario: registro de auditoría — quién
// accedió o modificó qué dato, y cuándo (Ley 21.719 de Protección de
// Datos Personales). Esta pantalla ES la forma de mostrar, ante una
// fiscalización de la Agencia, la evidencia operativa que la ley exige —
// no basta con tener el log guardado en la base, hay que poder revisarlo.
export default function AdminLogAuditoriaScreen() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accionFiltro, setAccionFiltro] = useState<(typeof ACCIONES)[number]>("Todas");
  const [q, setQ] = useState("");

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    adminGetAuditoria(token, CONDOMINIO_ID, {
      accion: accionFiltro === "Todas" ? undefined : accionFiltro,
      q: q.trim() || undefined,
    })
      .then(setLogs)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token, accionFiltro, q]);

  useFocusEffect(cargar);

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <Text style={styles.intro}>
        Registro de accesos y cambios (Ley N° 21.719) — quién hizo qué acción y cuándo, en este condominio. Se
        guardan las últimas 200 coincidencias.
      </Text>

      <View style={styles.filtroAcciones}>
        {ACCIONES.map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.filtroAccion, accionFiltro === a && styles.filtroAccionActivo]}
            onPress={() => setAccionFiltro(a)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filtroAccionTexto, accionFiltro === a && styles.filtroAccionTextoActivo]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar en ruta o detalle (ej: un RUT, un archivo)..."
        placeholderTextColor={colors.textMuted}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={cargar}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colors.navy900} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {logs.length === 0 && <Text style={styles.vacio}>No hay registros con estos filtros.</Text>}
          {logs.map((l) => (
            <View key={l.id_logauditoria} style={styles.tarjeta}>
              <View style={styles.tarjetaHeader}>
                <View style={[styles.badge, { backgroundColor: colorAccion(l.accion) }]}>
                  <Text style={styles.badgeTexto}>{l.accion}</Text>
                </View>
                <Text style={styles.fecha}>{new Date(l.fecha).toLocaleString("es-CL")}</Text>
              </View>
              <Text style={styles.ruta}>{l.ruta}</Text>
              {l.detalle && <Text style={styles.detalle}>{l.detalle}</Text>}
              <Text style={styles.autor}>
                {l.nombre_usuario ? `${l.nombre_usuario} (${l.rol})` : "Sin sesión identificada"}
                {l.status_code ? ` · ${l.status_code}` : ""}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { ...typography.small, color: colors.textMuted, padding: spacing.md, paddingBottom: 0 },
  filtroAcciones: { flexDirection: "row", gap: spacing.xs, padding: spacing.md, paddingBottom: 0 },
  filtroAccion: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 8, alignItems: "center" },
  filtroAccionActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  filtroAccionTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  filtroAccionTextoActivo: { color: colors.textOnNavy },
  buscador: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    margin: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.white,
    color: colors.textDark,
  },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600", marginTop: spacing.sm },
  lista: { padding: spacing.md, paddingTop: spacing.xs, gap: spacing.sm },
  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  tarjeta: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  tarjetaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
  fecha: { fontSize: 11, color: colors.textMuted },
  ruta: { ...typography.body, color: colors.textDark, fontWeight: "700", marginTop: spacing.xs, fontSize: 14 },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  autor: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, fontWeight: "600" },
});
