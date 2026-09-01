import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminGetSolicitudesArco, adminResolverSolicitudArco } from "../../api/client";
import { SolicitudArcoAdmin } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors, radius, spacing, typography } from "../../theme/theme";

const TITULO_TIPO: Record<string, string> = {
  Rectificacion: "Corregir un dato",
  Cancelacion: "Eliminar un dato",
  Oposicion: "Oponerse a un uso",
};

const ESTADO_COLOR: Record<string, string> = {
  Pendiente: "#FEF3C7",
  Resuelta: "#DCFCE7",
  Rechazada: "#FEE2E2",
};

// Ronda 32, Ley 21.719: acá Administrador/Comité revisa y resuelve las
// solicitudes de Rectificación/Cancelación/Oposición que mandaron
// residentes/guardias/personal desde "Mis datos" (ver MisDatosScreen).
// Esta pantalla ES, junto con la tabla solicitud_arco, la evidencia
// operativa que la ley exige poder mostrarle a la Agencia de Protección de
// Datos ante una fiscalización.
export default function AdminPrivacidadScreen() {
  const { token } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudArcoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resolviendo, setResolviendo] = useState<SolicitudArcoAdmin | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    adminGetSolicitudesArco(token, CONDOMINIO_ID)
      .then(setSolicitudes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const handleAbrirResolucion = (s: SolicitudArcoAdmin) => {
    setResolviendo(s);
    setRespuesta("");
  };

  const handleResolver = async (estado: "Resuelta" | "Rechazada") => {
    if (!token || !resolviendo) return;
    if (!respuesta.trim()) {
      Alert.alert("Falta la respuesta", "Explica cómo se resolvió (o por qué se rechazó) la solicitud.");
      return;
    }
    setGuardando(true);
    try {
      await adminResolverSolicitudArco(token, resolviendo.id_solicitudarco, { estado, respuesta_admin: respuesta.trim() });
      setResolviendo(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
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
          Solicitudes de derechos ARCO (Ley N° 21.719) que mandaron residentes, guardias o personal desde "Mis
          datos". Las pendientes van primero.
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {solicitudes.length === 0 && <Text style={styles.vacio}>No hay solicitudes.</Text>}
        {solicitudes.map((s) => (
          <TouchableOpacity
            key={s.id_solicitudarco}
            style={styles.tarjeta}
            onPress={() => s.estado === "Pendiente" && handleAbrirResolucion(s)}
            activeOpacity={s.estado === "Pendiente" ? 0.8 : 1}
          >
            <View style={styles.tarjetaHeader}>
              <Text style={styles.tipo}>{TITULO_TIPO[s.tipo] ?? s.tipo}</Text>
              <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[s.estado] }]}>
                <Text style={styles.badgeTexto}>{s.estado}</Text>
              </View>
            </View>
            <Text style={styles.solicitante}>
              {s.nombre_solicitante}
              {s.nombre_torre ? ` · ${s.nombre_torre} ${s.numero_unidad}` : ""}
            </Text>
            <Text style={styles.detalle}>{s.detalle}</Text>
            {s.respuesta_admin && <Text style={styles.respuesta}>Respuesta: {s.respuesta_admin}</Text>}
            <Text style={styles.fecha}>{new Date(s.fecha_solicitud).toLocaleDateString("es-CL")}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!resolviendo} animationType="slide" transparent onRequestClose={() => setResolviendo(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>{resolviendo && (TITULO_TIPO[resolviendo.tipo] ?? resolviendo.tipo)}</Text>
            <Text style={styles.modalSubtitulo}>{resolviendo?.nombre_solicitante}</Text>
            <Text style={styles.modalDetalle}>{resolviendo?.detalle}</Text>

            <Text style={styles.label}>Respuesta</Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={respuesta}
              onChangeText={setRespuesta}
              placeholder="Explica qué se hizo (o por qué no corresponde)..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TouchableOpacity
              style={[styles.boton, guardando && styles.botonDeshabilitado]}
              onPress={() => handleResolver("Resuelta")}
              disabled={guardando}
            >
              {guardando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Marcar resuelta</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonRechazar, guardando && styles.botonDeshabilitado]}
              onPress={() => handleResolver("Rechazada")}
              disabled={guardando}
            >
              <Text style={styles.botonRechazarTexto}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setResolviendo(null)}>
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
  error: { color: colors.danger, textAlign: "center", fontWeight: "600" },
  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  tarjeta: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  tarjetaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tipo: { ...typography.heading, fontSize: 15, color: colors.textDark },
  solicitante: { ...typography.small, color: colors.textMuted, marginTop: 2, fontWeight: "700" },
  detalle: { ...typography.small, color: colors.textDark, marginTop: 4 },
  respuesta: { ...typography.small, color: colors.textMuted, marginTop: 4, fontStyle: "italic" },
  fecha: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  modalTitulo: { ...typography.heading, color: colors.textDark },
  modalSubtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2, fontWeight: "700" },
  modalDetalle: { ...typography.body, color: colors.textDark, marginTop: spacing.sm },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.md },
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
  inputMultilinea: { minHeight: 80, textAlignVertical: "top" },
  boton: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.lg },
  botonTexto: { color: colors.navy900, fontWeight: "800" },
  botonDeshabilitado: { opacity: 0.6 },
  botonRechazar: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.sm, padding: 12, alignItems: "center", marginTop: spacing.sm },
  botonRechazarTexto: { color: colors.danger, fontWeight: "700" },
  botonCancelar: { alignItems: "center", marginTop: spacing.md, paddingBottom: spacing.sm },
  botonCancelarTexto: { color: colors.textMuted, fontWeight: "600" },
});
