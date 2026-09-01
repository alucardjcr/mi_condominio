import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  actualizarEstacionamiento,
  crearEstacionamiento,
  getEstacionamientosAdmin,
  getEstadosEstacionamiento,
  getTiposEstacionamiento,
  getTorres,
  getUnidadesPorTorre,
} from "../../api/client";
import { EstacionamientoAdmin, EstadoEstacionamiento, TipoEstacionamiento, Torre, Unidad } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";
import { colors, radius, spacing, typography } from "../../theme/theme";

function colorEstado(estado: string) {
  if (estado === "Disponible") return "#DCFCE7";
  if (estado === "Ocupado") return "#FEF3C7";
  if (estado === "Fuera de servicio") return "#FEE2E2";
  if (estado === "Disponible para arriendo") return "#DBEAFE";
  return colors.border;
}

// Ronda 28/29, a pedido explícito del usuario:
// - Marcar un cupo como "Fuera de servicio" (caso real: el 84 de Valles de
//   Varoli "quedó mal hecho") — la asignación automática al registrar una
//   entrada ya filtraba por estado "Disponible", así que no hizo falta
//   tocar esa lógica, solo agregar esta pantalla.
// - No todos los deptos tienen estacionamiento propio (varios quedaron sin
//   vender) — el comité arrienda esos cupos sueltos. Por eso asignar un
//   depto a un cupo tipo Residente es OPCIONAL: se puede crear/dejar sin
//   asignar, y asignarlo/reasignarlo/quitarlo después desde acá.
export default function AdminEstacionamientosScreen() {
  const { token } = useAuth();
  const [estacionamientos, setEstacionamientos] = useState<EstacionamientoAdmin[]>([]);
  const [estados, setEstados] = useState<EstadoEstacionamiento[]>([]);
  const [tipos, setTipos] = useState<TipoEstacionamiento[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<string>("Visita");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [numeroNuevo, setNumeroNuevo] = useState("");
  const [ubicacionNueva, setUbicacionNueva] = useState("");
  const [torreNuevo, setTorreNuevo] = useState<OpcionSelect | null>(null);
  const [unidadNueva, setUnidadNueva] = useState<OpcionSelect | null>(null);
  const [torres, setTorres] = useState<Torre[]>([]);
  const [unidadesNuevo, setUnidadesNuevo] = useState<Unidad[]>([]);
  const [creando, setCreando] = useState(false);

  const [cupoAsignando, setCupoAsignando] = useState<EstacionamientoAdmin | null>(null);
  const [torreAsignar, setTorreAsignar] = useState<OpcionSelect | null>(null);
  const [unidadAsignar, setUnidadAsignar] = useState<OpcionSelect | null>(null);
  const [unidadesAsignar, setUnidadesAsignar] = useState<Unidad[]>([]);
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([
      getEstacionamientosAdmin(token, CONDOMINIO_ID),
      getEstadosEstacionamiento(token),
      getTiposEstacionamiento(token),
      getTorres(token, CONDOMINIO_ID),
    ])
      .then(([lista, estadosLista, tiposLista, torresLista]) => {
        setEstacionamientos(lista);
        setEstados(estadosLista);
        setTipos(tiposLista);
        setTorres(torresLista);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return estacionamientos.filter((e) => {
      if (e.tipo !== tipoFiltro) return false;
      if (!q) return true;
      return (
        e.numero_estacionamiento.toLowerCase().includes(q) ||
        e.numero_unidad?.toLowerCase().includes(q) ||
        e.nombre_torre?.toLowerCase().includes(q)
      );
    });
  }, [estacionamientos, tipoFiltro, busqueda]);

  const handleCambiarEstado = (cupo: EstacionamientoAdmin) => {
    const opciones = estados
      .filter((e) => e.id_estadoestacionamiento !== cupo.estado_id)
      .map((e) => ({
        text: e.gls_estadoestacionamiento,
        onPress: async () => {
          if (!token) return;
          setActualizandoId(cupo.id_estacionamiento);
          try {
            await actualizarEstacionamiento(token, cupo.id_estacionamiento, { estado_id: e.id_estadoestacionamiento });
            cargar();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          } finally {
            setActualizandoId(null);
          }
        },
      }));
    Alert.alert(`Cupo ${cupo.numero_estacionamiento}`, "Cambiar estado a:", [
      ...opciones,
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleAbrirCrear = () => {
    setNumeroNuevo("");
    setUbicacionNueva("");
    setTorreNuevo(null);
    setUnidadNueva(null);
    setUnidadesNuevo([]);
    setModalCrearAbierto(true);
  };

  const handleSeleccionarTorreNuevo = async (opcion: OpcionSelect) => {
    setTorreNuevo(opcion);
    setUnidadNueva(null);
    if (!token) return;
    setUnidadesNuevo(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleCrear = async () => {
    if (!token) return;
    const tipoObj = tipos.find((t) => t.gls_tipoestacionamiento === tipoFiltro);
    if (!numeroNuevo.trim() || !tipoObj) {
      Alert.alert("Faltan datos", "Ingresa el número del cupo.");
      return;
    }
    setCreando(true);
    try {
      await crearEstacionamiento(token, {
        numero_estacionamiento: numeroNuevo.trim(),
        ubicacion: ubicacionNueva.trim() || undefined,
        tipo_estacionamiento_id_tipoestacionamiento: tipoObj.id_tipoestacionamiento,
        unidad_id_unidad: unidadNueva?.id ?? null,
        condominio_id_condominio: CONDOMINIO_ID,
      });
      setModalCrearAbierto(false);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleAbrirAsignar = (cupo: EstacionamientoAdmin) => {
    setCupoAsignando(cupo);
    setTorreAsignar(null);
    setUnidadAsignar(null);
    setUnidadesAsignar([]);
  };

  const handleSeleccionarTorreAsignar = async (opcion: OpcionSelect) => {
    setTorreAsignar(opcion);
    setUnidadAsignar(null);
    if (!token) return;
    setUnidadesAsignar(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleConfirmarAsignacion = async () => {
    if (!token || !cupoAsignando || !unidadAsignar) return;
    setAsignando(true);
    try {
      await actualizarEstacionamiento(token, cupoAsignando.id_estacionamiento, { unidad_id_unidad: unidadAsignar.id });
      setCupoAsignando(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAsignando(false);
    }
  };

  const handleQuitarAsignacion = async () => {
    if (!token || !cupoAsignando) return;
    setAsignando(true);
    try {
      await actualizarEstacionamiento(token, cupoAsignando.id_estacionamiento, { unidad_id_unidad: null });
      setCupoAsignando(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAsignando(false);
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
      <View style={styles.filtroTipos}>
        {tipos.map((t) => (
          <TouchableOpacity
            key={t.id_tipoestacionamiento}
            style={[styles.filtroTipo, tipoFiltro === t.gls_tipoestacionamiento && styles.filtroTipoActivo]}
            onPress={() => setTipoFiltro(t.gls_tipoestacionamiento)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filtroTipoTexto, tipoFiltro === t.gls_tipoestacionamiento && styles.filtroTipoTextoActivo]}>
              {t.gls_tipoestacionamiento}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filaBuscadorBoton}>
        <TextInput
          style={styles.buscador}
          placeholder="Buscar por número o depto..."
          placeholderTextColor={colors.textMuted}
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity style={styles.botonAgregar} onPress={handleAbrirCrear} activeOpacity={0.85}>
          <Text style={styles.botonAgregarTexto}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {tipoFiltro === "Residente" && (
        <Text style={styles.ayudaResidente}>
          No todos los deptos tienen estacionamiento propio — puedes dejar un cupo sin asignar y asignárselo después a
          quien lo arriende, incluso a un depto que ya tenga uno.
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.lista}>
        {filtrados.length === 0 && <Text style={styles.vacio}>No hay cupos de este tipo.</Text>}
        {filtrados.map((e) => (
          <View key={e.id_estacionamiento} style={styles.tarjeta}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => handleCambiarEstado(e)}
              disabled={actualizandoId === e.id_estacionamiento}
              activeOpacity={0.8}
            >
              <Text style={styles.numero}>Cupo {e.numero_estacionamiento}</Text>
              {e.numero_unidad ? (
                <Text style={styles.detalle}>
                  {e.nombre_torre} {e.numero_unidad}
                </Text>
              ) : e.tipo === "Residente" ? (
                <Text style={styles.detalleSinAsignar}>Sin depto asignado</Text>
              ) : null}
              {e.ubicacion && <Text style={styles.detalle}>{e.ubicacion}</Text>}
            </TouchableOpacity>

            <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
              {actualizandoId === e.id_estacionamiento ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <TouchableOpacity onPress={() => handleCambiarEstado(e)}>
                  <View style={[styles.badge, { backgroundColor: colorEstado(e.estado) }]}>
                    <Text style={styles.badgeTexto}>{e.estado}</Text>
                  </View>
                </TouchableOpacity>
              )}
              {e.tipo === "Residente" && (
                <TouchableOpacity onPress={() => handleAbrirAsignar(e)}>
                  <Text style={styles.linkAsignar}>{e.numero_unidad ? "Cambiar depto" : "Asignar depto"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalCrearAbierto} animationType="slide" transparent onRequestClose={() => setModalCrearAbierto(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Nuevo cupo — {tipoFiltro}</Text>

            <Text style={styles.label}>Número del cupo *</Text>
            <TextInput style={styles.input} value={numeroNuevo} onChangeText={setNumeroNuevo} placeholder="ej: V-12" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Ubicación (opcional)</Text>
            <TextInput
              style={styles.input}
              value={ubicacionNueva}
              onChangeText={setUbicacionNueva}
              placeholder="ej: Subterráneo -1"
              placeholderTextColor={colors.textMuted}
            />

            {tipoFiltro === "Residente" && (
              <>
                <Text style={styles.label}>Depto (opcional — puede quedar sin asignar)</Text>
                <SelectModal
                  label="Torre"
                  placeholder="Selecciona una torre"
                  opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
                  valorSeleccionado={torreNuevo}
                  onSeleccionar={handleSeleccionarTorreNuevo}
                />
                <SelectModal
                  label="Depto"
                  placeholder={torreNuevo ? "Selecciona un depto" : "Primero elige la torre"}
                  opciones={unidadesNuevo.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
                  valorSeleccionado={unidadNueva}
                  onSeleccionar={setUnidadNueva}
                  disabled={!torreNuevo}
                />
              </>
            )}

            <TouchableOpacity style={[styles.boton, creando && styles.botonDeshabilitado]} onPress={handleCrear} disabled={creando}>
              {creando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Crear cupo</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonCancelar} onPress={() => setModalCrearAbierto(false)}>
              <Text style={styles.botonCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!cupoAsignando} animationType="slide" transparent onRequestClose={() => setCupoAsignando(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Cupo {cupoAsignando?.numero_estacionamiento}</Text>
            <Text style={styles.modalSubtitulo}>
              {cupoAsignando?.numero_unidad
                ? `Asignado a ${cupoAsignando.nombre_torre} ${cupoAsignando.numero_unidad}`
                : "Sin depto asignado"}
            </Text>

            <Text style={styles.label}>Nuevo depto</Text>
            <SelectModal
              label="Torre"
              placeholder="Selecciona una torre"
              opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
              valorSeleccionado={torreAsignar}
              onSeleccionar={handleSeleccionarTorreAsignar}
            />
            <SelectModal
              label="Depto"
              placeholder={torreAsignar ? "Selecciona un depto" : "Primero elige la torre"}
              opciones={unidadesAsignar.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
              valorSeleccionado={unidadAsignar}
              onSeleccionar={setUnidadAsignar}
              disabled={!torreAsignar}
            />

            <TouchableOpacity
              style={[styles.boton, (!unidadAsignar || asignando) && styles.botonDeshabilitado]}
              onPress={handleConfirmarAsignacion}
              disabled={!unidadAsignar || asignando}
            >
              {asignando ? <ActivityIndicator color={colors.navy900} /> : <Text style={styles.botonTexto}>Asignar</Text>}
            </TouchableOpacity>

            {cupoAsignando?.numero_unidad && (
              <TouchableOpacity style={styles.botonQuitar} onPress={handleQuitarAsignacion} disabled={asignando}>
                <Text style={styles.botonQuitarTexto}>Quitar asignación (dejar sin depto)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.botonCancelar} onPress={() => setCupoAsignando(null)}>
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
  filtroTipos: { flexDirection: "row", gap: spacing.xs, padding: spacing.md, paddingBottom: 0 },
  filtroTipo: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  filtroTipoActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  filtroTipoTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  filtroTipoTextoActivo: { color: colors.textOnNavy },
  filaBuscadorBoton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.xs },
  buscador: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.textDark,
  },
  botonAgregar: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12 },
  botonAgregarTexto: { color: colors.navy900, fontWeight: "800", fontSize: 13 },
  ayudaResidente: { ...typography.small, color: colors.textMuted, marginHorizontal: spacing.md, marginTop: spacing.sm },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600", marginTop: spacing.sm },
  lista: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  numero: { ...typography.heading, color: colors.textDark, fontSize: 16 },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  detalleSinAsignar: { ...typography.small, color: colors.warning, marginTop: 2, fontWeight: "700" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
  linkAsignar: { color: colors.info, fontSize: 12, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "85%" },
  modalTitulo: { ...typography.heading, color: colors.textDark },
  modalSubtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
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
  boton: { backgroundColor: colors.gold, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.lg },
  botonTexto: { color: colors.navy900, fontWeight: "800" },
  botonDeshabilitado: { opacity: 0.5 },
  botonQuitar: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.sm, padding: 12, alignItems: "center", marginTop: spacing.sm },
  botonQuitarTexto: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  botonCancelar: { alignItems: "center", marginTop: spacing.md, paddingBottom: spacing.sm },
  botonCancelarTexto: { color: colors.textMuted, fontWeight: "600" },
});
