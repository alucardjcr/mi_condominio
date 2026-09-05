import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { jefeEquipoGetMiEquipo, jefeEquipoGetHorario, jefeEquipoDefinirHorario } from "../../api/client";
import { MiembroEquipo, DiaHorarioPersonal } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 68, a pedido explícito del usuario: pantalla ÚNICA compartida por
// JefeAseo y JefeJardineria (son estructuralmente idénticos — solo cambia
// a quién ve cada uno, y eso ya lo resuelve el backend filtrando por
// jefe_id_usuario). A diferencia de los guardias (patrón rotativo día/
// noche con fechas específicas), acá el horario es SEMANAL RECURRENTE
// simple: cada Jefe marca en qué días trabaja cada persona y el rango de
// horas de ese día — porque las necesidades son muy distintas entre un
// trabajador de aseo (ej. lunes a sábado, 4 horas) y un jardinero (ej. 2
// veces por semana, 5 horas cada vez), sin ningún patrón fijo impuesto
// por el sistema.

const DIAS_SEMANA = [
  { valor: 1, corto: "Lun", label: "Lunes" },
  { valor: 2, corto: "Mar", label: "Martes" },
  { valor: 3, corto: "Mié", label: "Miércoles" },
  { valor: 4, corto: "Jue", label: "Jueves" },
  { valor: 5, corto: "Vie", label: "Viernes" },
  { valor: 6, corto: "Sáb", label: "Sábado" },
  { valor: 7, corto: "Dom", label: "Domingo" },
];

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

// Estado local del editor: un slot por día de la semana (activo o no, con
// su rango horario si está activo).
interface SlotDia {
  activo: boolean;
  hora_inicio: string;
  hora_termino: string;
}

function armarSlotsVacios(): Record<number, SlotDia> {
  const slots: Record<number, SlotDia> = {};
  for (const d of DIAS_SEMANA) {
    slots[d.valor] = { activo: false, hora_inicio: "08:00", hora_termino: "12:00" };
  }
  return slots;
}

export default function MiEquipoScreen() {
  const { token, rol } = useAuth();
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [slots, setSlots] = useState<Record<number, SlotDia>>(armarSlotsVacios());
  const [cargandoHorario, setCargandoHorario] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      jefeEquipoGetMiEquipo(token)
        .then(setEquipo)
        .catch((e: any) => Alert.alert("Error", e.message))
        .finally(() => {
          setLoading(false);
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

  const handleAbrirHorario = async (miembro: MiembroEquipo) => {
    if (!token) return;
    setEditandoId(miembro.id_usuario);
    setCargandoHorario(true);
    try {
      const horario = await jefeEquipoGetHorario(token, miembro.id_usuario);
      const nuevosSlots = armarSlotsVacios();
      for (const h of horario) {
        nuevosSlots[h.dia_semana] = {
          activo: true,
          hora_inicio: h.hora_inicio.slice(0, 5),
          hora_termino: h.hora_termino.slice(0, 5),
        };
      }
      setSlots(nuevosSlots);
    } catch (e: any) {
      Alert.alert("Error", e.message);
      setEditandoId(null);
    } finally {
      setCargandoHorario(false);
    }
  };

  const handleToggleDia = (dia: number) => {
    setSlots((prev) => ({ ...prev, [dia]: { ...prev[dia], activo: !prev[dia].activo } }));
  };

  const handleCambiarHora = (dia: number, campo: "hora_inicio" | "hora_termino", valor: string) => {
    setSlots((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }));
  };

  const handleGuardarHorario = async (usuarioId: number) => {
    if (!token) return;
    const formatoValido = /^([01]\d|2[0-3]):[0-5]\d$/;
    const diasActivos = DIAS_SEMANA.filter((d) => slots[d.valor].activo);
    for (const d of diasActivos) {
      const slot = slots[d.valor];
      if (!formatoValido.test(slot.hora_inicio) || !formatoValido.test(slot.hora_termino)) {
        Alert.alert("Hora inválida", `Revisa el horario de ${d.label} (formato HH:MM, ej. 08:00).`);
        return;
      }
    }
    const dias: DiaHorarioPersonal[] = diasActivos.map((d) => ({
      dia_semana: d.valor,
      hora_inicio: slots[d.valor].hora_inicio,
      hora_termino: slots[d.valor].hora_termino,
    }));
    setGuardando(true);
    try {
      await jefeEquipoDefinirHorario(token, usuarioId, dias);
      setEditandoId(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const tituloRol = rol === "JefeAseo" ? "de Aseo" : rol === "JefeJardineria" ? "de Jardinería" : "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} tintColor={colors.textOnNavy} />}
    >
      <Text style={styles.tituloPagina}>Mi equipo {tituloRol}</Text>
      <Text style={styles.subtituloPagina}>
        {equipo.length} trabajador{equipo.length === 1 ? "" : "es"} a tu cargo
      </Text>

      {equipo.length === 0 && (
        <View style={styles.cardVacio}>
          <Text style={styles.vacioTexto}>
            Todavía no tienes ningún trabajador asignado. El administrador del condominio es quien asigna qué
            personal reporta a cada jefe.
          </Text>
        </View>
      )}

      {equipo.map((m) => (
        <View key={m.id_usuario} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>{iniciales(m.nombre_usuario)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.filaNombreBadge}>
                <Text style={styles.nombreItem}>{m.nombre_usuario}</Text>
                <View style={[styles.badge, { backgroundColor: m.flg_vigencia ? "#DCFCE7" : "#FEE2E2" }]}>
                  <Text style={[styles.badgeTexto, { color: m.flg_vigencia ? "#166534" : "#991B1B" }]}>
                    {m.flg_vigencia ? "Activo" : "Inactivo"}
                  </Text>
                </View>
              </View>
              {m.gls_tipopersonal && <Text style={styles.detalle}>{m.gls_tipopersonal}</Text>}
              <Text style={styles.detalle}>
                {m.dias_con_horario > 0
                  ? `Horario definido — ${m.dias_con_horario} día(s) por semana`
                  : "Sin horario definido todavía"}
              </Text>
            </View>
          </View>

          {editandoId === m.id_usuario ? (
            cargandoHorario ? (
              <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.gold} />
            ) : (
              <View style={styles.editorHorario}>
                {DIAS_SEMANA.map((d) => {
                  const slot = slots[d.valor];
                  return (
                    <View key={d.valor} style={styles.filaDia}>
                      <TouchableOpacity
                        style={[styles.chipDia, slot.activo && styles.chipDiaActivo]}
                        onPress={() => handleToggleDia(d.valor)}
                      >
                        <Text style={[styles.chipDiaTexto, slot.activo && styles.chipDiaTextoActivo]}>{d.corto}</Text>
                      </TouchableOpacity>
                      {slot.activo && (
                        <View style={styles.horasFila}>
                          <TextInput
                            style={styles.inputHora}
                            value={slot.hora_inicio}
                            onChangeText={(v) => handleCambiarHora(d.valor, "hora_inicio", v)}
                            placeholder="08:00"
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                          />
                          <Text style={styles.horaGuion}>—</Text>
                          <TextInput
                            style={styles.inputHora}
                            value={slot.hora_termino}
                            onChangeText={(v) => handleCambiarHora(d.valor, "hora_termino", v)}
                            placeholder="12:00"
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={styles.filaBotones}>
                  <TouchableOpacity
                    style={[styles.boton, styles.botonGuardar]}
                    onPress={() => handleGuardarHorario(m.id_usuario)}
                    disabled={guardando}
                  >
                    {guardando ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.botonGuardarTexto}>Guardar horario</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.boton, styles.botonCancelar]} onPress={() => setEditandoId(null)}>
                    <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          ) : (
            <TouchableOpacity style={styles.botonEditarHorario} onPress={() => handleAbrirHorario(m)}>
              <Text style={styles.botonEditarHorarioTexto}>📅 Definir horario semanal</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <View style={styles.banner}>
        <Text style={styles.bannerTexto}>
          ℹ️ El horario es semanal y se repite todas las semanas (ej. "lunes a sábado, 08:00-12:00"). Si un
          trabajador tiene horario irregular que cambia seguido, actualízalo acá cada vez que corresponda.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },

  tituloPagina: { ...typography.title, color: colors.textOnNavy },
  subtituloPagina: { ...typography.small, color: colors.textMutedOnNavy, marginBottom: spacing.sm },

  cardVacio: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  vacioTexto: { color: colors.textMuted, lineHeight: 20 },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.offWhite, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontWeight: "800", color: colors.navy900 },
  filaNombreBadge: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nombreItem: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700" },
  detalle: { color: colors.textMuted, marginTop: 2, fontSize: 12 },

  botonEditarHorario: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    alignItems: "center",
  },
  botonEditarHorarioTexto: { color: colors.info, fontWeight: "700", fontSize: 13 },

  editorHorario: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 8 },
  filaDia: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chipDia: { width: 52, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" },
  chipDiaActivo: { borderColor: colors.navy900, backgroundColor: colors.offWhite },
  chipDiaTexto: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  chipDiaTextoActivo: { color: colors.navy900 },
  horasFila: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  inputHora: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.textDark,
    width: 68,
    textAlign: "center",
  },
  horaGuion: { color: colors.textMuted },

  filaBotones: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  boton: { flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: "center" },
  botonGuardar: { backgroundColor: colors.navy900 },
  botonGuardarTexto: { color: colors.white, fontWeight: "700" },
  botonCancelar: { backgroundColor: colors.offWhite },
  botonCancelarTexto: { color: colors.textMuted, fontWeight: "700" },

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },
});
