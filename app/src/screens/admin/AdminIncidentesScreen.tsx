import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  adminCerrarIncidente,
  adminCrearIncidente,
  adminGetIncidentes,
  adminNotificarAfectados,
  adminNotificarAgencia,
} from "../../api/client";
import { IncidenteSeguridad } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors, radius, spacing, typography } from "../../theme/theme";

function badgePlazo(inc: IncidenteSeguridad) {
  if (inc.notificado_agencia_fecha) return { texto: "Agencia notificada", color: "#DCFCE7" };
  if (inc.plazo_vencido) return { texto: "Plazo de 72h vencido", color: "#FEE2E2" };
  if (inc.horas_restantes < 24) return { texto: `Quedan ${inc.horas_restantes}h`, color: "#FEE2E2" };
  return { texto: `Quedan ${inc.horas_restantes}h`, color: "#FEF3C7" };
}

// Ronda 34, a pedido explícito del usuario: registro de incidentes de
// seguridad — la Ley 21.719 exige notificar a la Agencia de Protección de
// Datos dentro de 72 HORAS desde que se detecta un incidente que
// comprometa datos personales. Esta pantalla es el registro formal
// (evidencia de cumplimiento del plazo) y un recordatorio visual mientras
// el plazo sigue corriendo.
export default function AdminIncidentesScreen() {
  const { token } = useAuth();
  const [incidentes, setIncidentes] = useState<IncidenteSeguridad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accionando, setAccionando] = useState<number | null>(null);

  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [fechaDeteccion, setFechaDeteccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [datosAfectados, setDatosAfectados] = useState("");
  const [personasAfectadas, setPersonasAfectadas] = useState("");
  const [creando, setCreando] = useState(false);

  const [incidenteCerrando, setIncidenteCerrando] = useState<IncidenteSeguridad | null>(null);
  const [accionesCierre, setAccionesCierre] = useState("");

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    adminGetIncidentes(token, CONDOMINIO_ID)
      .then(setIncidentes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const handleAbrirCrear = () => {
    const ahora = new Date();
    const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFechaDeteccion(local.replace("T", " "));
    setDescripcion("");
    setDatosAfectados("");
    setPersonasAfectadas("");
    setModalCrearAbierto(true);
  };

  const handleCrear = async () => {
    if (!token) return;
    if (!fechaDeteccion.trim() || !descripcion.trim() || !datosAfectados.trim()) {
      Alert.alert("Faltan datos", "Completa fecha de detección, descripción, y qué datos se vieron afectados.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearIncidente(token, CONDOMINIO_ID, {
        fecha_deteccion: fechaDeteccion.trim(),
        descripcion: descripcion.trim(),
        datos_afectados: datosAfectados.trim(),
        personas_afectadas_estimado: personasAfectadas.trim() ? Number(personasAfectadas.trim()) : null,
      });
      setModalCrearAbierto(false);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleNotificarAgencia = async (id: number) => {
    if (!token) return;
    setAccionando(id);
    try {
      await adminNotificarAgencia(token, id);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAccionando(null);
    }
  };

  const handleNotificarAfectados = async (id: number) => {
    if (!token) return;
    setAccionando(id);
    try {
      await adminNotificarAfectados(token, id);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAccionando(null);
    }
  };

  const handleAbrirCierre = (inc: IncidenteSeguridad) => {
    setIncidenteCerrando(inc);
    setAccionesCierre(inc.acciones_tomadas ?? "");
  };

  const handleConfirmarCierre = async () => {
    if (!token || !incidenteCerrando) return;
    if (!accionesCierre.trim()) {
      Alert.alert("Falta la descripción", "Describe las acciones tomadas para resolver el incidente.");
      return;
    }
    setAccionando(incidenteCerrando.id_incidenteseguridad);
    try {
      await adminCerrarIncidente(token, incidenteCerrando.id_incidenteseguridad, accionesCierre.trim());
      setIncidenteCerrando(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAccionando(null);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <ScrollView contentContainerStyle={styles.lista}>
        <Text style={styles.intro}>
          Si detectas un incidente que compromete datos personales (ej. una fuga, acceso indebido), regístralo acá —
          tienes 72 horas desde la detección para notificar a la Agencia de Protección de Datos.
        </Text>

        <TouchableOpacity style={styles.botonCrear} onPress={handleAbrirCrear} activeOpacity={0.85}>
          <Text style={styles.botonCrearTexto}>+ Registrar incidente</Text>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
        {incidentes.length === 0 && <Text style={styles.vacio}>No hay incidentes registrados.</Text>}

        {incidentes.map((inc) => {
          const badge = badgePlazo(inc);
          return (
            <View key={inc.id_incidenteseguridad} style={styles.tarjeta}>
              <View style={styles.tarjetaHeader}>
                <Text style={styles.fecha}>{new Date(inc.fecha_deteccion).toLocaleString("es-CL")}</Text>
                <View style={[styles.badge, { backgroundColor: inc.estado === "Cerrado" ? colors.border : badge.color }]}>
                  <Text style={styles.badgeTexto}>{inc.estado === "Cerrado" ? "Cerrado" : badge.texto}</Text>
                </View>
              </View>
              <Text style={styles.descripcion}>{inc.descripcion}</Text>
              <Text style={styles.datosAfectados}>Datos afectados: {inc.datos_afectados}</Text>
              {inc.personas_afectadas_estimado !== null && (
                <Text style={styles.datosAfectados}>~{inc.personas_afectadas_estimado} persona(s) afectada(s)</Text>
              )}

              {inc.estado === "Abierto" && (
                <View style={styles.acciones}>
                  {!inc.notificado_agencia_fecha ? (
                    <TouchableOpacity
                      style={styles.botonAccion}
                      onPress={() => handleNotificarAgencia(inc.id_incidenteseguridad)}
                      disabled={accionando === inc.id_incidenteseguridad}
                    >
                      <Text style={styles.botonAccionTexto}>Marcar Agencia notificada</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.notificadoTexto}>
                      Agencia notificada {new Date(inc.notificado_agencia_fecha).toLocaleString("es-CL")}
                    </Text>
                  )}
                  {!inc.notificado_afectados_fecha ? (
                    <TouchableOpacity
                      style={styles.botonAccion}
                      onPress={() => handleNotificarAfectados(inc.id_incidenteseguridad)}
                      disabled={accionando === inc.id_incidenteseguridad}
                    >
                      <Text style={styles.botonAccionTexto}>Marcar afectados notificados</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.notificadoTexto}>
                      Afectados notificados {new Date(inc.notificado_afectados_fecha).toLocaleString("es-CL")}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.botonCerrar}
                    onPress={() => handleAbrirCierre(inc)}
                    disabled={accionando === inc.id_incidenteseguridad}
                  >
                    <Text style={styles.botonCerrarTexto}>Cerrar incidente</Text>
                  </TouchableOpacity>
                </View>
              )}
              {inc.acciones_tomadas && <Text style={styles.accionesTomadasTexto}>Acciones: {inc.acciones_tomadas}</Text>}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalCrearAbierto} animationType="slide" transparent onRequestClose={() => setModalCrearAbierto(false)}>
        <View style={styles.overlay}>
          <ScrollView style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Registrar incidente</Text>

            <Text style={styles.label}>Fecha/hora de detección</Text>
            <TextInput
              style={styles.input}
              value={fechaDeteccion}
              onChangeText={setFechaDeteccion}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Descripción del incidente</Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="¿Qué pasó?"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={styles.label}>Datos personales afectados</Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={datosAfectados}
              onChangeText={setDatosAfectados}
              placeholder="Ej: nombres, RUT y patentes de residentes"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <Text style={styles.label}>Personas afectadas (estimado, opcional)</Text>
            <TextInput
              style={styles.input}
              value={personasAfectadas}
              onChangeText={setPersonasAfectadas}
              placeholder="Número"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />

            <TouchableOpacity style={[styles.boton, creando && styles.botonDeshabilitado]} onPress={handleCrear} disabled={creando}>
              {creando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Registrar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalCrearAbierto(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!incidenteCerrando} animationType="slide" transparent onRequestClose={() => setIncidenteCerrando(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Cerrar incidente</Text>
            <Text style={styles.label}>Acciones tomadas para resolverlo</Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={accionesCierre}
              onChangeText={setAccionesCierre}
              placeholder="Describe qué se hizo..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              style={[styles.boton, accionando !== null && styles.botonDeshabilitado]}
              onPress={handleConfirmarCierre}
              disabled={accionando !== null}
            >
              {accionando !== null ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Cerrar incidente</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setIncidenteCerrando(null)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  lista: { padding: spacing.md, gap: spacing.sm },
  intro: { ...typography.small, color: colors.textMuted, marginBottom: spacing.xs },
  botonCrear: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: 14, alignItems: "center", marginBottom: spacing.sm },
  botonCrearTexto: { color: colors.navy900, fontWeight: "800" },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600" },
  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  tarjeta: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  tarjetaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fecha: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
  descripcion: { ...typography.body, color: colors.textDark, marginTop: spacing.xs },
  datosAfectados: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  acciones: { marginTop: spacing.sm, gap: spacing.xs },
  botonAccion: { borderWidth: 1.5, borderColor: colors.navy900, borderRadius: radius.sm, padding: 10, alignItems: "center" },
  botonAccionTexto: { color: colors.navy900, fontWeight: "700", fontSize: 13 },
  notificadoTexto: { color: colors.success, fontSize: 12, fontWeight: "700" },
  botonCerrar: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.sm, padding: 10, alignItems: "center" },
  botonCerrarTexto: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  accionesTomadasTexto: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, fontStyle: "italic" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "85%" },
  modalTitulo: { ...typography.heading, color: colors.textDark },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  inputMultilinea: { minHeight: 70, textAlignVertical: "top" },
  boton: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.lg },
  botonTexto: { color: colors.navy900, fontWeight: "800" },
  botonDeshabilitado: { opacity: 0.6 },
  botonCancelar: { alignItems: "center", marginTop: spacing.md, paddingBottom: spacing.sm },
  botonCancelarTexto: { color: colors.textMuted, fontWeight: "600" },
});
