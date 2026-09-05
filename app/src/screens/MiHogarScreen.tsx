import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  actualizarResidenteDelHogar,
  crearResidenteDelHogar,
  getMascotas,
  getMisResidentesDelHogar,
  getTiposResidente,
} from "../api/client";
import { Mascota, ResidenteAdmin, TipoResidente } from "../api/types";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";
import FotoCapture from "../components/FotoCapture";
import { esRutValido, formatearRut, calcularEdad } from "../utils/validarRut";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 49, a pedido explícito del usuario, con referencia visual: rediseño
// completo de "Mi hogar" — mismo estilo institucional que el resto de la
// app (fondo navy, tarjetas claras), pero SOLO con datos que existen de
// verdad en el modelo. La referencia mostraba algunas cosas que este
// sistema no guarda (foto real de personas/condominio, email visible,
// fechas de vacunas de la mascota) — se omiten en vez de inventarse.

const PALETA_AVATAR = ["#DCEBFF", "#FFE8CC", "#E4F7D8", "#FBE0E8", "#EAE0FB", "#FFF3B0"];
function colorAvatar(id: number) {
  return PALETA_AVATAR[id % PALETA_AVATAR.length];
}
function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

// Autoadministración del hogar por el dueño del depto (ronda 15, a pedido
// explícito del usuario): cualquier residente del hogar puede VER esta
// pantalla (ronda 48, ahora es la pantalla de entrada de todo Residente),
// pero solo el dueño puede editar — el backend (/mi-depto/*) valida esto
// por su cuenta, así que esta pantalla nunca es la única barrera.
export default function MiHogarScreen({ navigation }: any) {
  const { token, guardia, nombreCondominioActual } = useAuth();
  const [residentes, setResidentes] = useState<ResidenteAdmin[]>([]);
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [tiposResidente, setTiposResidente] = useState<TipoResidente[]>([]);
  const [loading, setLoading] = useState(true);

  const [mostrarFormAgregar, setMostrarFormAgregar] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipoResidenteSel, setTipoResidenteSel] = useState<OpcionSelect | null>(null);
  const [creando, setCreando] = useState(false);

  const [rutNuevo, setRutNuevo] = useState("");
  const [rutNuevoError, setRutNuevoError] = useState(false);
  const [fechaNacimientoNuevo, setFechaNacimientoNuevo] = useState("");
  const [profesionNuevo, setProfesionNuevo] = useState("");
  const [fotoNuevo, setFotoNuevo] = useState<string | null>(null);

  const [perfilEnEdicion, setPerfilEnEdicion] = useState<number | null>(null);
  const [rutEditar, setRutEditar] = useState("");
  const [rutEditarError, setRutEditarError] = useState(false);
  const [fechaNacimientoEditar, setFechaNacimientoEditar] = useState("");
  const [profesionEditar, setProfesionEditar] = useState("");
  const [fotoEditar, setFotoEditar] = useState<string | null>(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [tipoEnEdicion, setTipoEnEdicion] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [r, m] = await Promise.all([getMisResidentesDelHogar(token), getMascotas(token)]);
      setResidentes(r);
      setMascotas(m);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  useEffect(() => {
    if (!token) return;
    getTiposResidente(token).then(setTiposResidente).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const handleBlurRutNuevo = () => {
    if (!rutNuevo.trim()) {
      setRutNuevoError(false);
      return;
    }
    if (!esRutValido(rutNuevo)) {
      setRutNuevoError(true);
      Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo (formato: 12345678-9).");
      return;
    }
    setRutNuevoError(false);
    setRutNuevo(formatearRut(rutNuevo));
  };

  const handleCrear = async () => {
    if (!token || !nombre.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre de la persona que vive en tu depto.");
      return;
    }
    if (rutNuevo.trim() && !esRutValido(rutNuevo)) {
      Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo antes de continuar.");
      return;
    }
    setCreando(true);
    try {
      await crearResidenteDelHogar(token, {
        nombre_usuario: nombre.trim(),
        tipo_residente_id_tiporesidente: tipoResidenteSel ? Number(tipoResidenteSel.id) : undefined,
        rut: rutNuevo.trim() ? formatearRut(rutNuevo) : undefined,
        fecha_nacimiento: fechaNacimientoNuevo.trim() || undefined,
        profesion: profesionNuevo.trim() || undefined,
        foto: fotoNuevo || undefined,
      });
      setNombre("");
      setTipoResidenteSel(null);
      setRutNuevo("");
      setFechaNacimientoNuevo("");
      setProfesionNuevo("");
      setFotoNuevo(null);
      setMostrarFormAgregar(false);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleAbrirPerfil = (r: ResidenteAdmin) => {
    setPerfilEnEdicion(r.id_usuario);
    setRutEditar(r.rut ?? "");
    setRutEditarError(false);
    setFechaNacimientoEditar(r.fecha_nacimiento ?? "");
    setProfesionEditar(r.profesion ?? "");
    setFotoEditar(null);
  };

  const handleBlurRutEditar = () => {
    if (!rutEditar.trim()) {
      setRutEditarError(false);
      return;
    }
    if (!esRutValido(rutEditar)) {
      setRutEditarError(true);
      Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo (formato: 12345678-9).");
      return;
    }
    setRutEditarError(false);
    setRutEditar(formatearRut(rutEditar));
  };

  const handleGuardarPerfil = async (id: number) => {
    if (!token) return;
    if (rutEditar.trim() && !esRutValido(rutEditar)) {
      Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo antes de guardar.");
      return;
    }
    setGuardandoPerfil(true);
    try {
      await actualizarResidenteDelHogar(token, id, {
        rut: rutEditar.trim() ? formatearRut(rutEditar) : null,
        fecha_nacimiento: fechaNacimientoEditar.trim() || null,
        profesion: profesionEditar.trim() || null,
        foto: fotoEditar || undefined,
      });
      setPerfilEnEdicion(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const handleGuardarTipo = async (r: ResidenteAdmin, opcion: OpcionSelect | null) => {
    if (!token) return;
    try {
      await actualizarResidenteDelHogar(token, r.id_usuario, {
        tipo_residente_id_tiporesidente: opcion ? Number(opcion.id) : null,
      });
      setTipoEnEdicion(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleToggle = (r: ResidenteAdmin) => {
    if (!token) return;
    if (r.id_usuario === guardia?.id_usuario) {
      Alert.alert("No puedes desactivarte a ti mismo", "Pide al Administrador que lo haga si corresponde.");
      return;
    }
    const activando = !r.flg_vigencia;
    const confirmar = () =>
      actualizarResidenteDelHogar(token, r.id_usuario, { flg_vigencia: activando ? 1 : 0 })
        .then(cargar)
        .catch((e: any) => Alert.alert("Error", e.message));
    if (!activando) {
      Alert.alert("Quitar del hogar", `${r.nombre_usuario} va a quedar dado de baja de tu depto. ¿Continuar?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Quitar", style: "destructive", onPress: confirmar },
      ]);
    } else {
      confirmar();
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const activos = residentes.filter((r) => r.flg_vigencia);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <View style={styles.filaTitulo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tituloPagina}>Mi hogar</Text>
          <Text style={styles.subtituloPagina}>Integrantes del departamento</Text>
        </View>
        <TouchableOpacity style={styles.botonAgregar} onPress={() => setMostrarFormAgregar((v) => !v)}>
          <Text style={styles.botonAgregarTexto}>{mostrarFormAgregar ? "✕ Cerrar" : "+ Agregar integrante"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardResumen}>
        <Text style={styles.cardResumenTitulo}>{nombreCondominioActual ?? "Mi condominio"}</Text>
        <Text style={styles.cardResumenSubtitulo}>
          {guardia?.nombre_torre ? `${guardia.nombre_torre} | Departamento ${guardia.numero_unidad}` : "Sin depto asociado"}
        </Text>
        <View style={styles.filaStats}>
          <Text style={styles.statTexto}>🏠 {activos.length} personas</Text>
          <Text style={styles.statTexto}>🐾 {mascotas.length} mascota{mascotas.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      {mostrarFormAgregar && (
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Agregar persona</Text>
          <FotoCapture label="Foto (opcional)" value={fotoNuevo} onChange={setFotoNuevo} />
          <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={colors.textMuted} value={nombre} onChangeText={setNombre} />
          <SelectModal
            label="Tipo de residente"
            placeholder="Ej: Cónyuge, hijo/a, arrendatario..."
            opciones={tiposResidente.map((t) => ({ id: t.id_tiporesidente, label: t.gls_tiporesidente }))}
            valorSeleccionado={tipoResidenteSel}
            onSeleccionar={setTipoResidenteSel}
          />
          <TextInput
            style={[styles.input, rutNuevoError && styles.inputConError]}
            placeholder="RUT (opcional) — ej: 12345678-9"
            placeholderTextColor={colors.textMuted}
            value={rutNuevo}
            onChangeText={(t) => {
              setRutNuevo(t);
              setRutNuevoError(false);
            }}
            onBlur={handleBlurRutNuevo}
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            placeholder="Fecha de nacimiento AAAA-MM-DD (opcional)"
            placeholderTextColor={colors.textMuted}
            value={fechaNacimientoNuevo}
            onChangeText={setFechaNacimientoNuevo}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={styles.input}
            placeholder="Profesión (opcional)"
            placeholderTextColor={colors.textMuted}
            value={profesionNuevo}
            onChangeText={setProfesionNuevo}
          />
          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Agregando..." : "Agregar"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.seccionTitulo}>Personas del hogar</Text>
      {residentes.length === 0 && <Text style={styles.vacio}>Todavía no tienes a nadie registrado en tu depto.</Text>}
      {residentes.map((item) => (
        <View key={item.id_usuario} style={styles.card}>
          <View style={styles.cardHeader}>
            {fuenteImagenPrivada(item.foto_url, token) ? (
              <Image source={fuenteImagenPrivada(item.foto_url, token)!} style={styles.avatarFoto} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colorAvatar(item.id_usuario) }]}>
                <Text style={styles.avatarTexto}>{iniciales(item.nombre_usuario)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem} numberOfLines={1}>
                {item.nombre_usuario}
                {item.id_usuario === guardia?.id_usuario ? " (tú)" : ""}
              </Text>
              <View style={styles.filaBadges}>
                {!!item.flg_propietario && (
                  <View style={[styles.badge, { backgroundColor: "#DBEAFE" }]}>
                    <Text style={styles.badgeTexto}>Propietario/a</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setTipoEnEdicion(item.id_usuario)}>
                  <View style={[styles.badge, { backgroundColor: "#E4F7D8" }]}>
                    <Text style={styles.badgeTexto}>{item.gls_tiporesidente ?? "Sin tipo asignado"}</Text>
                  </View>
                </TouchableOpacity>
                {!item.flg_vigencia && (
                  <View style={[styles.badge, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={styles.badgeTexto}>Inactivo</Text>
                  </View>
                )}
              </View>
              {(item.rut || calcularEdad(item.fecha_nacimiento)) && (
                <Text style={styles.detalle}>
                  {[item.rut ? `👤 ${item.rut}` : null, calcularEdad(item.fecha_nacimiento) !== null ? `${calcularEdad(item.fecha_nacimiento)} años` : null]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              )}
            </View>
            {item.id_usuario !== guardia?.id_usuario && (
              <TouchableOpacity
                style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
                onPress={() => handleToggle(item)}
              >
                <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Quitar" : "Activar"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {tipoEnEdicion === item.id_usuario && (
            <View style={styles.subForm}>
              <SelectModal
                label="Tipo de residente"
                placeholder="Selecciona un tipo"
                opciones={tiposResidente.map((t) => ({ id: t.id_tiporesidente, label: t.gls_tiporesidente }))}
                valorSeleccionado={
                  item.tipo_residente_id_tiporesidente && item.gls_tiporesidente
                    ? { id: item.tipo_residente_id_tiporesidente, label: item.gls_tiporesidente }
                    : null
                }
                onSeleccionar={(opcion) => handleGuardarTipo(item, opcion)}
              />
              <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setTipoEnEdicion(null)}>
                <Text style={styles.enlaceCerrar}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}

          {perfilEnEdicion === item.id_usuario ? (
            <View style={styles.subForm}>
              <FotoCapture label="Foto nueva (opcional, reemplaza la actual)" value={fotoEditar} onChange={setFotoEditar} />
              <TextInput
                style={[styles.input, rutEditarError && styles.inputConError]}
                placeholder="RUT (opcional) — ej: 12345678-9"
                placeholderTextColor={colors.textMuted}
                value={rutEditar}
                onChangeText={(t) => {
                  setRutEditar(t);
                  setRutEditarError(false);
                }}
                onBlur={handleBlurRutEditar}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.input}
                placeholder="Fecha de nacimiento AAAA-MM-DD (opcional)"
                placeholderTextColor={colors.textMuted}
                value={fechaNacimientoEditar}
                onChangeText={setFechaNacimientoEditar}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={styles.input}
                placeholder="Profesión (opcional)"
                placeholderTextColor={colors.textMuted}
                value={profesionEditar}
                onChangeText={setProfesionEditar}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarPerfil(item.id_usuario)}
                  disabled={guardandoPerfil}
                >
                  <Text style={styles.botonToggleTexto}>{guardandoPerfil ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]}
                  onPress={() => setPerfilEnEdicion(null)}
                >
                  <Text style={styles.botonToggleTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.filaEditar} onPress={() => handleAbrirPerfil(item)}>
              <Text style={styles.enlaceEditar}>✏️ Editar</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Text style={styles.seccionTitulo}>Mascotas del hogar</Text>
      {mascotas.length === 0 && <Text style={styles.vacio}>Todavía no tienes mascotas registradas.</Text>}
      {mascotas.map((m) => (
        <View key={m.id_mascota} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.avatar, { backgroundColor: colorAvatar(m.id_mascota) }]}>
              <Text style={styles.avatarTexto}>🐾</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>{m.nombre}</Text>
              <View style={styles.filaBadges}>
                {m.especie && (
                  <View style={[styles.badge, { backgroundColor: "#FFE8CC" }]}>
                    <Text style={styles.badgeTexto}>{m.especie}</Text>
                  </View>
                )}
              </View>
              {(m.raza || m.numero_chip) && (
                <Text style={styles.detalle}>
                  {m.raza ?? ""}
                  {m.raza && m.numero_chip ? " · " : ""}
                  {m.numero_chip ? `Chip: ${m.numero_chip}` : ""}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.filaEditar} onPress={() => navigation?.navigate("MascotaDetalle", { mascota: m })}>
            <Text style={styles.enlaceEditar}>✏️ Editar</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.banner}>
        <Text style={styles.bannerTexto}>
          ℹ️ Cada persona del hogar puede tener su propio usuario para entrar a la app — pídele al Administrador que
          le active el acceso.
        </Text>
      </View>

      <View style={styles.accesosRapidos}>
        <TouchableOpacity style={styles.accesoRapido} onPress={() => navigation?.navigate("Home")}>
          <Text style={styles.accesoRapidoTexto}>🏠 Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.accesoRapido} onPress={() => navigation?.navigate("MisPaquetes")}>
          <Text style={styles.accesoRapidoTexto}>📦 Paquetes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.accesoRapido} onPress={() => navigation?.navigate("ReservasEspacios")}>
          <Text style={styles.accesoRapidoTexto}>📅 Reservas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.accesoRapido} onPress={() => navigation?.navigate("Notificaciones")}>
          <Text style={styles.accesoRapidoTexto}>🔔 Avisos</Text>
        </TouchableOpacity>
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
  cardResumenSubtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  filaStats: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  statTexto: { ...typography.small, color: colors.textDark, fontWeight: "700" },

  seccionTitulo: { ...typography.heading, color: colors.textOnNavy, marginTop: spacing.sm, fontSize: 16 },
  vacio: { color: colors.textMutedOnNavy, fontStyle: "italic" },

  form: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: colors.textDark },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  inputConError: { borderColor: colors.danger, borderWidth: 1.5 },
  botonCrear: { backgroundColor: colors.success, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontWeight: "800", fontSize: 16, color: colors.navy900 },
  avatarFoto: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.offWhite },
  nombreItem: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  filaBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700", color: colors.textDark },
  detalle: { color: colors.textMuted, marginTop: 4, fontSize: 12 },

  botonToggle: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: colors.success },
  botonDesactivar: { backgroundColor: colors.danger },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },

  subForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  enlaceCerrar: { color: colors.info, fontSize: 12, fontWeight: "600" },
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

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },

  accesosRapidos: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md, marginBottom: spacing.lg },
  accesoRapido: { backgroundColor: colors.navy700, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  accesoRapidoTexto: { color: colors.textOnNavy, fontSize: 12, fontWeight: "700" },
});
