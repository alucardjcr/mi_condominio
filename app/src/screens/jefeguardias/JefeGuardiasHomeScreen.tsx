import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { jefeGetGuardias, jefeGetResumenTurnosMes } from "../../api/client";
import { Guardia, ResumenTurnoGuardia } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 53, a pedido explícito del usuario, con referencia visual: Home del
// JefeGuardias — antes entraba a un Home genérico con solo 2 botones
// ("Turnos de la semana" / "Guardias"). TODO lo mostrado acá es dato real
// (RUT/teléfono desde guardia_perfil, ronda 53; conteo de turnos desde
// turno_asignado_guardia agregado por mes) — nada inventado. Se omite "Ver
// reglamento" de la referencia (no existe esa funcionalidad en el sistema)
// y la tarjeta de foto del condominio (no hay ese campo en el modelo).

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatFecha(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
const PALETA_AVATAR = ["#DCEBFF", "#FFE8CC", "#E4F7D8", "#FBE0E8", "#EAE0FB", "#FFF3B0"];
function colorAvatar(id: number) {
  return PALETA_AVATAR[id % PALETA_AVATAR.length];
}

export default function JefeGuardiasHomeScreen({ navigation }: any) {
  const { token, nombreCondominioActual } = useAuth();
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [resumen, setResumen] = useState<ResumenTurnoGuardia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const hoy = new Date();
  const [mesVisible, setMesVisible] = useState(hoy.getMonth());
  const [anioVisible, setAnioVisible] = useState(hoy.getFullYear());
  const primerDiaMes = useMemo(() => formatFecha(new Date(anioVisible, mesVisible, 1)), [anioVisible, mesVisible]);
  const ultimoDiaMes = useMemo(() => formatFecha(new Date(anioVisible, mesVisible + 1, 0)), [anioVisible, mesVisible]);

  const cargar = useCallback(
    (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      Promise.all([jefeGetGuardias(token), jefeGetResumenTurnosMes(token, CONDOMINIO_ID, primerDiaMes, ultimoDiaMes)])
        .then(([g, r]) => {
          setGuardias(g);
          setResumen(r);
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
          setRefrescando(false);
        });
    },
    [token, primerDiaMes, ultimoDiaMes]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const cambiarMes = (delta: number) => {
    let m = mesVisible + delta;
    let a = anioVisible;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMesVisible(m);
    setAnioVisible(a);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const guardiasActivos = guardias.filter((g) => g.flg_vigencia);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
    >
      <View style={styles.filaTitulo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tituloPagina}>Guardias</Text>
          <Text style={styles.subtituloPagina}>Equipo de seguridad</Text>
        </View>
        <TouchableOpacity style={styles.botonAgregar} onPress={() => navigation.navigate("JefeGuardiasGuardias")}>
          <Text style={styles.botonAgregarTexto}>+ Agregar guardia</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardResumen}>
        <Text style={styles.cardResumenTitulo}>{nombreCondominioActual ?? "Mi condominio"}</Text>
        <Text style={styles.cardResumenSubtitulo}>🛡️ {guardiasActivos.length} guardias activos</Text>
      </View>

      <View style={styles.filaMes}>
        <View style={styles.navMes}>
          <TouchableOpacity onPress={() => cambiarMes(-1)} style={styles.botonNav}>
            <Text style={styles.botonNavTexto}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.tituloMes}>
            {NOMBRES_MES[mesVisible]} {anioVisible}
          </Text>
          <TouchableOpacity onPress={() => cambiarMes(1)} style={styles.botonNav}>
            <Text style={styles.botonNavTexto}>›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.botonGenerar}
          onPress={() => navigation.navigate("JefeGuardiasTurnos", { vistaInicial: "patron" })}
        >
          <Text style={styles.botonGenerarTexto}>📅 Generar turnos</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.seccionTitulo}>Guardias del condominio</Text>
      {guardias.length === 0 && <Text style={styles.vacio}>Todavía no hay guardias registrados.</Text>}
      {guardias.map((g) => {
        const turnosDelGuardia = resumen.filter((r) => r.guardia_usuario_id === g.id_usuario);
        return (
          <View key={g.id_usuario} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.avatar, { backgroundColor: colorAvatar(g.id_usuario) }]}>
                <Text style={styles.avatarTexto}>{iniciales(g.nombre_usuario)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.filaNombreBadge}>
                  <Text style={styles.nombreItem}>{g.nombre_usuario}</Text>
                  <View style={[styles.badge, { backgroundColor: g.flg_vigencia ? "#DCFCE7" : "#FEE2E2" }]}>
                    <Text style={[styles.badgeTexto, { color: g.flg_vigencia ? "#166534" : "#991B1B" }]}>
                      {g.flg_vigencia ? "Activo" : "Inactivo"}
                    </Text>
                  </View>
                </View>
                {g.rut && <Text style={styles.detalle}>👤 {g.rut}</Text>}
                {g.telefono && <Text style={styles.detalle}>📞 {g.telefono}</Text>}
              </View>
            </View>

            {turnosDelGuardia.length > 0 && (
              <View style={styles.bloqueTurnos}>
                <Text style={styles.turnosTitulo}>Turnos {NOMBRES_MES[mesVisible].toLowerCase()}</Text>
                {turnosDelGuardia.map((t) => (
                  <View key={t.id_turnobloque} style={styles.filaTurno}>
                    <Text style={styles.turnoHorario}>
                      {t.hora_inicio.slice(0, 5)} - {t.hora_termino.slice(0, 5)} ({t.gls_turnobloque})
                    </Text>
                    <View style={styles.badgeCantidad}>
                      <Text style={styles.badgeCantidadTexto}>{t.cantidad}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.filaEditar} onPress={() => navigation.navigate("JefeGuardiasGuardias")}>
              <Text style={styles.enlaceEditar}>✏️ Editar</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.banner}>
        <Text style={styles.bannerTexto}>
          ℹ️ Acá puedes ver los turnos mensuales de cada guardia. Para asignar o generar turnos nuevos, usa "Generar
          turnos" arriba.
        </Text>
      </View>

      <View style={styles.accesosRapidos}>
        <Pressable style={styles.accesoRapido} onPress={() => navigation.navigate("Home")}>
          <Text style={styles.accesoRapidoTexto}>🏠 Inicio</Text>
        </Pressable>
        <Pressable style={styles.accesoRapido} onPress={() => navigation.navigate("JefeGuardiasTurnos")}>
          <Text style={styles.accesoRapidoTexto}>📅 Turnos</Text>
        </Pressable>
        <Pressable style={styles.accesoRapido} onPress={() => navigation.navigate("Notificaciones")}>
          <Text style={styles.accesoRapidoTexto}>🔔 Avisos</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },

  filaTitulo: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  tituloPagina: { ...typography.title, color: colors.textOnNavy },
  subtituloPagina: { ...typography.small, color: colors.textMutedOnNavy, marginTop: 2 },
  botonAgregar: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  botonAgregarTexto: { color: colors.navy900, fontWeight: "800", fontSize: 12 },

  cardResumen: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  cardResumenTitulo: { ...typography.heading, color: colors.textDark },
  cardResumenSubtitulo: { ...typography.small, color: colors.textMuted, marginTop: 4, fontWeight: "700" },

  filaMes: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  navMes: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 10 },
  botonNav: { paddingHorizontal: 10 },
  botonNavTexto: { fontSize: 20, color: colors.navy900, fontWeight: "700" },
  tituloMes: { color: colors.navy900, fontWeight: "800", fontSize: 14, minWidth: 120, textAlign: "center" },
  botonGenerar: { backgroundColor: colors.navy700, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 12 },
  botonGenerarTexto: { color: colors.textOnNavy, fontWeight: "700", fontSize: 12 },

  seccionTitulo: { ...typography.heading, color: colors.textOnNavy, marginTop: spacing.sm, fontSize: 16 },
  vacio: { color: colors.textMutedOnNavy, fontStyle: "italic" },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontWeight: "800", fontSize: 16, color: colors.navy900 },
  filaNombreBadge: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nombreItem: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700" },
  detalle: { color: colors.textMuted, marginTop: 2, fontSize: 12 },

  bloqueTurnos: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  turnosTitulo: { fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 4 },
  filaTurno: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 3 },
  turnoHorario: { fontSize: 13, color: colors.textDark },
  badgeCantidad: { backgroundColor: colors.offWhite, borderRadius: radius.pill, minWidth: 26, alignItems: "center", paddingVertical: 2 },
  badgeCantidadTexto: { fontSize: 12, fontWeight: "800", color: colors.navy900 },

  filaEditar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  enlaceEditar: { color: colors.info, fontSize: 13, fontWeight: "700" },
  chevron: { color: colors.info, fontSize: 16, fontWeight: "700" },

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },

  accesosRapidos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm, marginBottom: spacing.lg },
  accesoRapido: { backgroundColor: colors.navy700, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  accesoRapidoTexto: { color: colors.textOnNavy, fontSize: 12, fontWeight: "700" },
});
