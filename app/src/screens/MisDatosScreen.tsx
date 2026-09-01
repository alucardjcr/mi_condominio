import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { crearSolicitudArco, getMisDatos, getMisSolicitudesArco } from "../api/client";
import { MisDatos, SolicitudArco, TipoSolicitudArco } from "../api/types";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { descargarYCompartirArchivo } from "../utils/descargas";
import { colors, radius, spacing, typography } from "../theme/theme";

const OPCIONES_SOLICITUD: { valor: TipoSolicitudArco; titulo: string; ayuda: string }[] = [
  { valor: "Rectificacion", titulo: "Corregir un dato", ayuda: "Ej: mi nombre está mal escrito, mi patente cambió." },
  { valor: "Cancelacion", titulo: "Eliminar un dato", ayuda: "Ej: quiero que borren la patente de mi auto anterior." },
  { valor: "Oposicion", titulo: "Oponerme a un uso", ayuda: "Ej: no quiero aparecer en algún listado o reporte." },
];

const ESTADO_COLOR: Record<string, string> = {
  Pendiente: "#FEF3C7",
  Resuelta: "#DCFCE7",
  Rechazada: "#FEE2E2",
};

// Ronda 32, a pedido explícito del usuario: derechos ARCO de la Ley 21.719
// de Protección de Datos Personales — cualquier persona logeada (Guardia,
// Residente, Personal, JefeGuardias, Administrador) puede ver/descargar
// TODO lo que el sistema tiene sobre ella (Acceso + Portabilidad,
// instantáneo) y pedir que se corrija, elimine, o se oponga a algo
// (Rectificación/Cancelación/Oposición — queda pendiente hasta que
// Administrador/Comité la revise, ver AdminPrivacidadScreen).
export default function MisDatosScreen() {
  const { token } = useAuth();
  const [datos, setDatos] = useState<MisDatos | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudArco[]>([]);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [tipoSel, setTipoSel] = useState<TipoSolicitudArco | null>(null);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([getMisDatos(token), getMisSolicitudesArco(token)])
      .then(([d, s]) => {
        setDatos(d);
        setSolicitudes(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const handleDescargar = async () => {
    if (!token) return;
    setDescargando(true);
    try {
      await descargarYCompartirArchivo(
        `${API_BASE_URL}/privacidad/mis-datos/descargar`,
        token,
        "mis-datos-mi-condominio.json",
        "application/json",
        "Descargar mis datos"
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setDescargando(false);
    }
  };

  const handleEnviarSolicitud = async () => {
    if (!token || !tipoSel) return;
    if (!detalle.trim()) {
      Alert.alert("Falta la descripción", "Cuéntanos qué dato quieres corregir, eliminar, o a qué te opones.");
      return;
    }
    setEnviando(true);
    try {
      await crearSolicitudArco(token, { tipo: tipoSel, detalle: detalle.trim() });
      setFormularioAbierto(false);
      setTipoSel(null);
      setDetalle("");
      cargar();
      Alert.alert("Solicitud enviada", "El administrador o comité la va a revisar y te va a responder acá mismo.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Acá puedes ver toda la información que Mi Condominio tiene sobre ti, descargarla, o pedir que se corrija,
        elimine, o te opongas a algún uso — según la Ley N° 21.719 de Protección de Datos Personales.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {datos && (
        <View style={styles.card}>
          <Text style={styles.tituloCard}>Mis datos</Text>

          <Text style={styles.label}>Identidad</Text>
          <Text style={styles.dato}>{datos.identidad.nombre_usuario}</Text>
          {datos.identidad.usuariocol && <Text style={styles.datoChico}>Usuario: {datos.identidad.usuariocol}</Text>}
          {datos.identidad.correo_usuario && <Text style={styles.datoChico}>Correo: {datos.identidad.correo_usuario}</Text>}
          <Text style={styles.datoChico}>Rol: {datos.identidad.rol}</Text>

          {datos.vivienda && (
            <>
              <Text style={styles.label}>Vivienda</Text>
              <Text style={styles.dato}>
                {datos.vivienda.torre} {datos.vivienda.numero_unidad}
              </Text>
              {datos.vivienda.es_propietario && <Text style={styles.datoChico}>Propietario</Text>}
              {datos.vivienda.es_comite && <Text style={styles.datoChico}>Miembro del comité</Text>}
            </>
          )}

          {datos.mascotas.length > 0 && (
            <>
              <Text style={styles.label}>Mascotas ({datos.mascotas.length})</Text>
              {datos.mascotas.map((m, i) => (
                <Text key={i} style={styles.datoChico}>
                  {m.nombre} {m.especie ? `· ${m.especie}` : ""}
                </Text>
              ))}
            </>
          )}

          {datos.patentes.length > 0 && (
            <>
              <Text style={styles.label}>Patentes ({datos.patentes.length})</Text>
              {datos.patentes.map((p, i) => (
                <Text key={i} style={styles.datoChico}>
                  {p.patente} · {p.gls_tipotenencia}
                </Text>
              ))}
            </>
          )}

          <Text style={styles.label}>Reservas de espacios comunes ({datos.reservas.length})</Text>
          <Text style={styles.datoChico}>
            {datos.reservas.length > 0 ? "Últimas 100 mostradas al descargar." : "No tienes reservas registradas."}
          </Text>

          <Text style={styles.label}>Paquetes recibidos en tu depto ({datos.paquetes.length})</Text>
          <Text style={styles.datoChico}>
            {datos.paquetes.length > 0 ? "Últimos 100 mostrados al descargar." : "No hay paquetes registrados."}
          </Text>

          <TouchableOpacity
            style={[styles.boton, descargando && styles.botonDeshabilitado]}
            onPress={handleDescargar}
            disabled={descargando}
            activeOpacity={0.85}
          >
            {descargando ? (
              <ActivityIndicator color={colors.navy900} />
            ) : (
              <Text style={styles.botonTexto}>Descargar mis datos (JSON)</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.tituloCard}>Solicitar corrección, eliminación u oposición</Text>

        {!formularioAbierto ? (
          <TouchableOpacity style={styles.botonSecundario} onPress={() => setFormularioAbierto(true)} activeOpacity={0.85}>
            <Text style={styles.botonSecundarioTexto}>+ Nueva solicitud</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {OPCIONES_SOLICITUD.map((op) => (
                <TouchableOpacity
                  key={op.valor}
                  style={[styles.opcionLarga, tipoSel === op.valor && styles.opcionLargaActiva]}
                  onPress={() => setTipoSel(op.valor)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.opcionLargaTitulo, tipoSel === op.valor && styles.opcionLargaTituloActivo]}>
                    {op.titulo}
                  </Text>
                  <Text style={styles.opcionLargaAyuda}>{op.ayuda}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Cuéntanos con detalle</Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={detalle}
              onChangeText={setDetalle}
              placeholder="Describe qué dato y qué necesitas..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TouchableOpacity
              style={[styles.boton, (!tipoSel || enviando) && styles.botonDeshabilitado]}
              onPress={handleEnviarSolicitud}
              disabled={!tipoSel || enviando}
              activeOpacity={0.85}
            >
              {enviando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Enviar solicitud</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setFormularioAbierto(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {solicitudes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.tituloCard}>Mis solicitudes</Text>
          {solicitudes.map((s) => (
            <View key={s.id_solicitudarco} style={styles.solicitudItem}>
              <View style={styles.solicitudHeader}>
                <Text style={styles.solicitudTipo}>
                  {OPCIONES_SOLICITUD.find((o) => o.valor === s.tipo)?.titulo ?? s.tipo}
                </Text>
                <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[s.estado] }]}>
                  <Text style={styles.badgeTexto}>{s.estado}</Text>
                </View>
              </View>
              <Text style={styles.solicitudDetalle}>{s.detalle}</Text>
              {s.respuesta_admin && <Text style={styles.solicitudRespuesta}>Respuesta: {s.respuesta_admin}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: spacing.md },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  intro: { ...typography.small, color: colors.textMuted },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600" },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  tituloCard: { ...typography.heading, color: colors.textDark, marginBottom: spacing.xs },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  dato: { ...typography.body, color: colors.textDark, fontWeight: "700" },
  datoChico: { ...typography.small, color: colors.textMuted },
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
  inputMultilinea: { minHeight: 90, textAlignVertical: "top" },
  boton: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.lg },
  botonTexto: { color: colors.navy900, fontWeight: "800" },
  botonDeshabilitado: { opacity: 0.6 },
  botonSecundario: {
    borderWidth: 1.5,
    borderColor: colors.navy900,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  botonSecundarioTexto: { color: colors.navy900, fontWeight: "700" },
  botonCancelar: { alignItems: "center", marginTop: spacing.sm },
  botonCancelarTexto: { color: colors.textMuted, fontWeight: "600" },
  opcionLarga: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  opcionLargaActiva: { borderColor: colors.navy900, backgroundColor: colors.offWhite },
  opcionLargaTitulo: { color: colors.textDark, fontWeight: "800", fontSize: 14 },
  opcionLargaTituloActivo: { color: colors.navy900 },
  opcionLargaAyuda: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  solicitudItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  solicitudHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  solicitudTipo: { color: colors.textDark, fontWeight: "700", fontSize: 14 },
  solicitudDetalle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  solicitudRespuesta: { color: colors.textDark, fontSize: 13, marginTop: 4, fontStyle: "italic" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
});
