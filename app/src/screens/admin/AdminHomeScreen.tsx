import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminGetActividadReciente, adminGetDashboard, getNotificaciones } from "../../api/client";
import { ActividadRecienteItem, DashboardAdmin } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 47, a pedido explícito del usuario, con una referencia visual que
// mandó: el Home de Administrador pasa de un aviso genérico + contador de
// notificaciones a un dashboard real — condominio, gasto común,
// estacionamientos, solicitudes pendientes, seguridad, accesos rápidos, y
// actividad reciente. TODO lo que se muestra acá es dato real (ver la nota
// completa de qué se adaptó y por qué en dashboard.service.ts, en el
// backend) — nada de los números es inventado.

function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatFechaHora(fecha: string | null): string {
  if (!fecha) return "Sin registros";
  const [f, h] = fecha.split(" ");
  return `${f} ${h?.slice(0, 5) ?? ""}`;
}

function TarjetaStat({ titulo, valor, subtitulo, colorSubtitulo }: { titulo: string; valor: string; subtitulo: string; colorSubtitulo?: string }) {
  return (
    <View style={styles.tarjetaStat}>
      <Text style={styles.tarjetaStatTitulo}>{titulo}</Text>
      <Text style={styles.tarjetaStatValor}>{valor}</Text>
      <Text style={[styles.tarjetaStatSubtitulo, colorSubtitulo ? { color: colorSubtitulo } : null]}>{subtitulo}</Text>
    </View>
  );
}

function BotonAccionRapida({ label, icono, onPress }: { label: string; icono: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.accionRapida, pressed && { opacity: 0.8 }]}>
      <Text style={styles.accionRapidaIcono}>{icono}</Text>
      <Text style={styles.accionRapidaTexto}>{label}</Text>
    </Pressable>
  );
}

export default function AdminHomeScreen({ navigation }: any) {
  const { token, guardia, rol, nombreCondominioActual } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardAdmin | null>(null);
  const [actividad, setActividad] = useState<ActividadRecienteItem[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setCargando(true);
      Promise.all([
        adminGetDashboard(token, CONDOMINIO_ID),
        adminGetActividadReciente(token, CONDOMINIO_ID),
        getNotificaciones(token),
      ])
        .then(([d, a, n]) => {
          setDashboard(d);
          setActividad(a);
          setNoLeidas(n.filter((x) => !x.flg_leido).length);
        })
        .catch(() => {})
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

  if (cargando || !dashboard) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const operacionNormal = dashboard.seguridad.incidentes_abiertos === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
    >
      <Text style={styles.saludo}>
        ¡{saludoSegunHora()}, {guardia?.nombre_usuario?.split(" ")[0]}!
      </Text>
      <Text style={styles.subtitulo}>{nombreCondominioActual ?? dashboard.condominio.nombre}</Text>

      <View style={styles.cardCondominio}>
        <View style={styles.filaTitulo}>
          <Text style={styles.cardCondominioTitulo}>{dashboard.condominio.nombre}</Text>
        </View>
        <View style={styles.filaDato}>
          <Text style={styles.datoIcono}>🏢</Text>
          <Text style={styles.datoTexto}>{dashboard.condominio.total_deptos} departamentos</Text>
        </View>
        <View style={styles.filaDato}>
          <Text style={styles.datoIcono}>👥</Text>
          <Text style={styles.datoTexto}>{dashboard.condominio.residentes_activos} residentes activos</Text>
        </View>
        <View style={styles.filaDato}>
          <Text style={styles.datoIcono}>✂️</Text>
          <Text style={styles.datoTexto}>{dashboard.condominio.espacios_comunes} espacios comunes</Text>
        </View>
        <View style={styles.filaDato}>
          <Text style={styles.datoIcono}>🛡️</Text>
          <Text style={styles.datoTexto}>{dashboard.condominio.guardias_activos} guardias activos</Text>
        </View>
        <View style={[styles.badgeEstado, { backgroundColor: operacionNormal ? colors.success : colors.danger }]}>
          <Text style={styles.badgeEstadoTexto}>{operacionNormal ? "Operación normal" : "Atención requerida"}</Text>
        </View>
      </View>

      <View style={styles.filaTarjetas}>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("AdminGastoComun")}>
          <TarjetaStat
            titulo="Gastos comunes"
            valor={`${dashboard.gasto_comun.porcentaje_pagado}%`}
            subtitulo={`${dashboard.gasto_comun.deptos_pagados}/${dashboard.gasto_comun.deptos_total} deptos pagados`}
          />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("AdminEstacionamientos")}>
          <TarjetaStat
            titulo="Estacionamientos"
            valor={`${dashboard.estacionamientos.total_cupos} cupos`}
            subtitulo={`${dashboard.estacionamientos.visitas_dentro} visitas dentro ahora`}
          />
        </Pressable>
      </View>
      <View style={styles.filaTarjetas}>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("AdminMultas")}>
          <TarjetaStat
            titulo="Solicitudes"
            valor={String(dashboard.solicitudes.abiertas)}
            subtitulo={dashboard.solicitudes.urgentes > 0 ? `${dashboard.solicitudes.urgentes} urgentes` : "abiertas"}
            colorSubtitulo={dashboard.solicitudes.urgentes > 0 ? colors.danger : undefined}
          />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate("AdminIncidentes")}>
          <TarjetaStat
            titulo="Seguridad"
            valor={`${dashboard.seguridad.incidentes_abiertos} incidentes`}
            subtitulo={`Último evento: ${formatFechaHora(dashboard.seguridad.ultimo_evento)}`}
          />
        </Pressable>
      </View>

      <Text style={styles.seccionTitulo}>Acciones rápidas</Text>
      <View style={styles.gridAcciones}>
        <BotonAccionRapida label="Registrar residente" icono="🧑" onPress={() => navigation.navigate("AdminResidentes")} />
        <BotonAccionRapida label="Enviar comunicado" icono="📣" onPress={() => navigation.navigate("AdminComunicados")} />
        <BotonAccionRapida label="Gastos comunes" icono="👥" onPress={() => navigation.navigate("AdminGastoComun")} />
        <BotonAccionRapida label="Visitas y estacionamientos" icono="🚗" onPress={() => navigation.navigate("AdminEstacionamientos")} />
        <BotonAccionRapida label="Reservas de espacios" icono="📅" onPress={() => navigation.navigate("AdminReservas")} />
        <BotonAccionRapida label="Revisar solicitudes" icono="📋" onPress={() => navigation.navigate("AdminMultas")} />
      </View>

      <View style={styles.filaSeccionActividad}>
        <Text style={styles.seccionTitulo}>Actividad reciente</Text>
        <Pressable onPress={() => navigation.navigate("Bitacora")}>
          <Text style={styles.verTodas}>Ver todas</Text>
        </Pressable>
      </View>
      {actividad.length === 0 && <Text style={styles.sinActividad}>Sin registros de bitácora todavía.</Text>}
      {actividad.map((a) => (
        <View key={a.id_bitacora} style={styles.filaActividad}>
          <Text style={styles.actividadIcono}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actividadTexto} numberOfLines={2}>
              {a.texto}
            </Text>
            <Text style={styles.actividadMeta}>
              {a.nombre_usuario} · {formatFechaHora(a.fecha_hora)}
            </Text>
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => navigation.navigate("Notificaciones")}
        style={({ pressed }) => [styles.filaResumen, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.filaResumenTexto}>Notificaciones</Text>
        <View style={[styles.badge, noLeidas === 0 && styles.badgeVacio]}>
          <Text style={styles.badgeTexto}>{noLeidas}</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.navy900, gap: spacing.sm },
  saludo: { ...typography.heading, color: colors.textOnNavy, marginTop: spacing.xs },
  subtitulo: { ...typography.small, color: colors.textMutedOnNavy, marginBottom: spacing.sm },

  cardCondominio: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg, gap: 6 },
  filaTitulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardCondominioTitulo: { ...typography.heading, color: colors.textOnNavy },
  filaDato: { flexDirection: "row", alignItems: "center", gap: 8 },
  datoIcono: { fontSize: 14 },
  datoTexto: { ...typography.small, color: colors.textMutedOnNavy },
  badgeEstado: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6 },
  badgeEstadoTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },

  filaTarjetas: { flexDirection: "row", gap: spacing.sm },
  tarjetaStat: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.md, minHeight: 90 },
  tarjetaStatTitulo: { ...typography.small, color: colors.textMutedOnNavy },
  tarjetaStatValor: { ...typography.heading, color: colors.textOnNavy, marginTop: 4, fontSize: 22 },
  tarjetaStatSubtitulo: { fontSize: 11, color: colors.textMutedOnNavy, marginTop: 4 },

  seccionTitulo: { ...typography.heading, color: colors.textOnNavy, marginTop: spacing.md, fontSize: 16 },
  gridAcciones: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  accionRapida: {
    width: "31%",
    backgroundColor: colors.navy800,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 6,
  },
  accionRapidaIcono: { fontSize: 22 },
  accionRapidaTexto: { color: colors.textOnNavy, fontSize: 11, fontWeight: "700", textAlign: "center" },

  filaSeccionActividad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verTodas: { color: colors.goldSoft, fontSize: 13, fontWeight: "700", marginTop: spacing.md },
  sinActividad: { color: colors.textMutedOnNavy, fontSize: 13, fontStyle: "italic" },
  filaActividad: { flexDirection: "row", gap: 10, backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.sm, alignItems: "center" },
  actividadIcono: { fontSize: 18 },
  actividadTexto: { color: colors.textOnNavy, fontSize: 13, fontWeight: "600" },
  actividadMeta: { color: colors.textMutedOnNavy, fontSize: 11, marginTop: 2 },

  filaResumen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.navy800,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  filaResumenTexto: { ...typography.body, color: colors.textOnNavy },
  badge: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    minWidth: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeVacio: { backgroundColor: colors.navy700 },
  badgeTexto: { color: colors.navy900, fontWeight: "800", fontSize: 12 },
});
