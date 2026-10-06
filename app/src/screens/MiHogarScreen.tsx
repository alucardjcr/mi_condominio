import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  actualizarResidenteDelHogar,
  crearResidenteDelHogar,
  getMascotas,
  getMisResidentesDelHogar,
  getNacionalidades,
  getProfesiones,
  getTiposResidente,
  getVacunasMascota,
} from "../api/client";
import { Mascota, Nacionalidad, Profesion, ResidenteAdmin, TipoResidente, VacunaMascota } from "../api/types";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";
import FotoCapture from "../components/FotoCapture";
import DateField from "../components/DateField";
import { esRutValido, formatearRut, calcularEdad } from "../utils/validarRut";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";
import { nacionalidadConBandera } from "../utils/banderas";
import { textoEdadMascota } from "../utils/edadMascota";
import { formatearFecha } from "../utils/fechas";
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

// Campo de formulario con su nombre arriba y el recuadro debajo, con aire
// entre un campo y el siguiente (a pedido explícito del usuario).
function Campo({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.campo}>
      {label ? <Text style={styles.campoLabel}>{label}</Text> : null}
      {children}
    </View>
  );
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
  const [vacunasPorMascota, setVacunasPorMascota] = useState<Record<number, VacunaMascota[]>>({});
  const [tiposResidente, setTiposResidente] = useState<TipoResidente[]>([]);
  const [loading, setLoading] = useState(true);

  const [mostrarFormAgregar, setMostrarFormAgregar] = useState(false);
  const [nombresNuevo, setNombresNuevo] = useState("");
  const [apPaternoNuevo, setApPaternoNuevo] = useState("");
  const [apMaternoNuevo, setApMaternoNuevo] = useState("");
  const [nacionalidadNuevaSel, setNacionalidadNuevaSel] = useState<OpcionSelect | null>(null);
  const [profesionNuevaSel, setProfesionNuevaSel] = useState<OpcionSelect | null>(null);
  const [profesiones, setProfesiones] = useState<Profesion[]>([]);
  const [nacionalidades, setNacionalidades] = useState<Nacionalidad[]>([]);
  const [tipoResidenteSel, setTipoResidenteSel] = useState<OpcionSelect | null>(null);
  const [creando, setCreando] = useState(false);

  const [rutNuevo, setRutNuevo] = useState("");
  const [rutNuevoError, setRutNuevoError] = useState(false);
  const [fechaNacimientoNuevo, setFechaNacimientoNuevo] = useState("");
  const [fotoNuevo, setFotoNuevo] = useState<string | null>(null);

  const [perfilEnEdicion, setPerfilEnEdicion] = useState<number | null>(null);
  const [rutEditar, setRutEditar] = useState("");
  const [rutEditarError, setRutEditarError] = useState(false);
  const [fechaNacimientoEditar, setFechaNacimientoEditar] = useState("");
  const [nombresEditar, setNombresEditar] = useState("");
  const [apPaternoEditar, setApPaternoEditar] = useState("");
  const [apMaternoEditar, setApMaternoEditar] = useState("");
  const [nacionalidadEditarSel, setNacionalidadEditarSel] = useState<OpcionSelect | null>(null);
  const [profesionEditarSel, setProfesionEditarSel] = useState<OpcionSelect | null>(null);
  // RUT del perfil que se está editando (solo se puede escribir si todavía
  // no tiene uno cargado — ver nota en handleAbrirPerfil).
  const [rutYaCargado, setRutYaCargado] = useState(false);
  const [fotoEditar, setFotoEditar] = useState<string | null>(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [tipoEnEdicion, setTipoEnEdicion] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [r, m] = await Promise.all([getMisResidentesDelHogar(token), getMascotas(token)]);
      setResidentes(r);
      setMascotas(m);
      // Vacunas de cada mascota para mostrarlas en su tarjeta (si alguna
      // falla, esa mascota simplemente queda sin lista).
      const vacunas = await Promise.all(m.map((x) => getVacunasMascota(token, x.id_mascota).catch(() => [] as VacunaMascota[])));
      const mapa: Record<number, VacunaMascota[]> = {};
      m.forEach((x, i) => (mapa[x.id_mascota] = vacunas[i]));
      setVacunasPorMascota(mapa);
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
    getProfesiones(token).then(setProfesiones).catch(() => {});
    getNacionalidades(token).then(setNacionalidades).catch(() => {});
  }, [token]);

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
    if (!token || !nombresNuevo.trim() || !apPaternoNuevo.trim()) {
      Alert.alert("Faltan datos", "Ingresa los nombres y el apellido paterno de la persona que vive en tu depto.");
      return;
    }
    if (rutNuevo.trim() && !esRutValido(rutNuevo)) {
      Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo antes de continuar.");
      return;
    }
    setCreando(true);
    try {
      await crearResidenteDelHogar(token, {
        nombres: nombresNuevo.trim(),
        apellido_paterno: apPaternoNuevo.trim(),
        apellido_materno: apMaternoNuevo.trim() || undefined,
        nacionalidad_id_nacionalidad: nacionalidadNuevaSel ? Number(nacionalidadNuevaSel.id) : undefined,
        tipo_residente_id_tiporesidente: tipoResidenteSel ? Number(tipoResidenteSel.id) : undefined,
        rut: rutNuevo.trim() ? formatearRut(rutNuevo) : undefined,
        fecha_nacimiento: fechaNacimientoNuevo.trim() || undefined,
        profesion: profesionNuevaSel?.label || undefined,
        foto: fotoNuevo || undefined,
      });
      setNombresNuevo("");
      setApPaternoNuevo("");
      setApMaternoNuevo("");
      setNacionalidadNuevaSel(null);
      setProfesionNuevaSel(null);
      setTipoResidenteSel(null);
      setRutNuevo("");
      setFechaNacimientoNuevo("");
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
    // Solo el Administrador/Comité puede cambiar un RUT ya cargado; acá solo
    // se puede completar si todavía está vacío.
    setRutYaCargado(!!r.rut);
    setFechaNacimientoEditar(r.fecha_nacimiento ?? "");
    setNombresEditar(r.nombres ?? "");
    setApPaternoEditar(r.apellido_paterno ?? "");
    setApMaternoEditar(r.apellido_materno ?? "");
    setNacionalidadEditarSel(r.nacionalidad_id_nacionalidad && r.gls_nacionalidad ? { id: r.nacionalidad_id_nacionalidad, label: r.gls_nacionalidad } : null);
    const prof = r.profesion ? profesiones.find((p) => p.gls_profesion === r.profesion) : null;
    setProfesionEditarSel(r.profesion ? { id: prof ? prof.id_profesion : 0, label: r.profesion } : null);
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
    if (!rutYaCargado && rutEditar.trim() && !esRutValido(rutEditar)) {
      Alert.alert("RUT inválido", "El RUT ingresado no es correcto. Revísalo antes de guardar.");
      return;
    }
    if (!nombresEditar.trim() || !apPaternoEditar.trim()) {
      Alert.alert("Faltan datos", "Los nombres y el apellido paterno no pueden quedar vacíos.");
      return;
    }
    setGuardandoPerfil(true);
    try {
      await actualizarResidenteDelHogar(token, id, {
        // Con RUT ya cargado no se manda (el backend también lo ignora).
        ...(rutYaCargado ? {} : { rut: rutEditar.trim() ? formatearRut(rutEditar) : null }),
        fecha_nacimiento: fechaNacimientoEditar.trim() || null,
        profesion: profesionEditarSel?.label || null,
        nombres: nombresEditar.trim(),
        apellido_paterno: apPaternoEditar.trim(),
        apellido_materno: apMaternoEditar.trim() || null,
        nacionalidad_id_nacionalidad: nacionalidadEditarSel ? Number(nacionalidadEditarSel.id) : null,
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
  // El propietario siempre va primero; el resto conserva su orden.
  const residentesOrdenados = [...residentes].sort((a, b) => Number(!!b.flg_propietario) - Number(!!a.flg_propietario));

  // Tipo de condominio, deducido del nombre de la torre (la estructura no
  // se guarda como columna): "Casas" = condominio de casas; torre con el
  // mismo nombre que el condominio = un solo edificio (ahí repetir el
  // nombre no aporta); cualquier otro nombre = condominio de torres.
  const norm = (t?: string | null) => (t ?? "").trim().toLowerCase();
  const esCasas = norm(guardia?.nombre_torre) === "casas";
  const esEdificioUnico = !esCasas && norm(guardia?.nombre_torre) === norm(nombreCondominioActual);
  const iconoHogar = esCasas ? "🏠" : "🏢";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text style={styles.nombreCondominioArriba}>{nombreCondominioActual ?? "Mi condominio"}</Text>
      <View style={styles.filaTitulo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tituloPagina}>Mi hogar</Text>
          <Text style={styles.subtituloPagina}>{esCasas ? "Integrantes de la casa" : "Integrantes del departamento"}</Text>
        </View>
        <TouchableOpacity style={styles.botonAgregar} onPress={() => setMostrarFormAgregar((v) => !v)}>
          <Text style={styles.botonAgregarTexto}>{mostrarFormAgregar ? "✕ Cerrar" : "+ Agregar integrante"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardResumen}>
        {guardia?.nombre_torre ? (
          <>
            {!esCasas && !esEdificioUnico && <Text style={styles.cardResumenSubtitulo}>{guardia.nombre_torre}</Text>}
            <Text style={styles.cardResumenUnidad}>
              {esCasas ? "Casa" : "Departamento"} {guardia.numero_unidad}
            </Text>
          </>
        ) : (
          <Text style={styles.cardResumenSubtitulo}>Sin depto asociado</Text>
        )}
        <View style={styles.filaStats}>
          <Text style={styles.statTexto}>{iconoHogar} {activos.length} personas</Text>
          <Text style={styles.statTexto}>🐾 {mascotas.length} mascota{mascotas.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      {mostrarFormAgregar && (
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Agregar persona</Text>
          <FotoCapture label="Foto (opcional)" value={fotoNuevo} onChange={setFotoNuevo} recorteCuadrado />
          <SelectModal
            label="Tipo de residente"
            placeholder="Ej: Cónyuge, hijo/a, arrendatario..."
            opciones={tiposResidente.map((t) => ({ id: t.id_tiporesidente, label: t.gls_tiporesidente }))}
            valorSeleccionado={tipoResidenteSel}
            onSeleccionar={setTipoResidenteSel}
          />
          <Campo label="RUT (opcional)">
            <TextInput
              style={[styles.input, { marginBottom: 0 }, rutNuevoError && styles.inputConError]}
              placeholder="Ej: 12345678-9"
              placeholderTextColor={colors.textMuted}
              value={rutNuevo}
              onChangeText={(t) => {
                setRutNuevo(t);
                setRutNuevoError(false);
              }}
              onBlur={handleBlurRutNuevo}
              autoCapitalize="characters"
            />
          </Campo>
          <Campo label="Nombres">
            <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Ej: María José" placeholderTextColor={colors.textMuted} value={nombresNuevo} onChangeText={setNombresNuevo} />
          </Campo>
          <Campo label="Apellido paterno">
            <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Apellido paterno" placeholderTextColor={colors.textMuted} value={apPaternoNuevo} onChangeText={setApPaternoNuevo} />
          </Campo>
          <Campo label="Apellido materno (opcional)">
            <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Apellido materno" placeholderTextColor={colors.textMuted} value={apMaternoNuevo} onChangeText={setApMaternoNuevo} />
          </Campo>
          <SelectModal
            label="Nacionalidad"
            placeholder="Selecciona una nacionalidad (opcional)"
            opciones={nacionalidades.map((n) => ({ id: n.id_nacionalidad, label: n.gls_nacionalidad }))}
            valorSeleccionado={nacionalidadNuevaSel}
            onSeleccionar={setNacionalidadNuevaSel}
          />
          <DateField label="Fecha de nacimiento (opcional)" value={fechaNacimientoNuevo} onChange={setFechaNacimientoNuevo} maximumDate={new Date()} opcional />
          <SelectModal
            label="Profesión"
            placeholder="Selecciona una profesión (opcional)"
            opciones={profesiones.map((p) => ({ id: p.id_profesion, label: p.gls_profesion }))}
            valorSeleccionado={profesionNuevaSel}
            onSeleccionar={setProfesionNuevaSel}
          />
          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Agregando..." : "Agregar"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.seccionTitulo}>Personas del hogar</Text>
      {residentes.length === 0 && <Text style={styles.vacio}>Todavía no tienes a nadie registrado en tu depto.</Text>}
      {residentesOrdenados.map((item) => (
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
              {(item.rut || calcularEdad(item.fecha_nacimiento) !== null) && (
                <Text style={styles.detalle}>
                  {[item.rut ? `👤 ${item.rut}` : null, calcularEdad(item.fecha_nacimiento) !== null ? `${calcularEdad(item.fecha_nacimiento)} años` : null]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              )}
              {(item.gls_nacionalidad || item.profesion) && (
                <Text style={styles.detalle}>
                  {[nacionalidadConBandera(item.gls_nacionalidad), item.profesion ? `💼 ${item.profesion}` : null].filter(Boolean).join("  ·  ")}
                </Text>
              )}
            </View>
            {item.id_usuario !== guardia?.id_usuario && (
              <TouchableOpacity
                style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
                onPress={() => handleToggle(item)}
              >
                <Text style={[styles.botonToggleTexto, !item.flg_vigencia && styles.botonActivarTexto]}>{item.flg_vigencia ? "Quitar" : "Activar"}</Text>
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
              <FotoCapture label="Foto nueva (opcional, reemplaza la actual)" value={fotoEditar} onChange={setFotoEditar} recorteCuadrado />
              {rutYaCargado ? (
                <Campo label="RUT">
                  <View style={[styles.input, styles.inputBloqueado, { marginBottom: 0 }]}>
                    <Text style={{ color: colors.textDark, fontSize: 15, fontWeight: "700" }}>{rutEditar}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Solo el Administrador o el Comité puede cambiarlo</Text>
                  </View>
                </Campo>
              ) : (
                <Campo label="RUT (opcional)">
                  <TextInput
                    style={[styles.input, { marginBottom: 0 }, rutEditarError && styles.inputConError]}
                    placeholder="Ej: 12345678-9"
                    placeholderTextColor={colors.textMuted}
                    value={rutEditar}
                    onChangeText={(t) => {
                      setRutEditar(t);
                      setRutEditarError(false);
                    }}
                    onBlur={handleBlurRutEditar}
                    autoCapitalize="characters"
                  />
                </Campo>
              )}
              <Campo label="Nombres">
                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Nombres" placeholderTextColor={colors.textMuted} value={nombresEditar} onChangeText={setNombresEditar} />
              </Campo>
              <Campo label="Apellido paterno">
                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Apellido paterno" placeholderTextColor={colors.textMuted} value={apPaternoEditar} onChangeText={setApPaternoEditar} />
              </Campo>
              <Campo label="Apellido materno (opcional)">
                <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Apellido materno" placeholderTextColor={colors.textMuted} value={apMaternoEditar} onChangeText={setApMaternoEditar} />
              </Campo>
              <SelectModal
                label="Nacionalidad"
                placeholder="Selecciona una nacionalidad (opcional)"
                opciones={nacionalidades.map((n) => ({ id: n.id_nacionalidad, label: n.gls_nacionalidad }))}
                valorSeleccionado={nacionalidadEditarSel}
                onSeleccionar={setNacionalidadEditarSel}
              />
              <DateField label="Fecha de nacimiento (opcional)" value={fechaNacimientoEditar} onChange={setFechaNacimientoEditar} maximumDate={new Date()} opcional />
              <SelectModal
                label="Profesión"
                placeholder="Selecciona una profesión (opcional)"
                opciones={profesiones.map((p) => ({ id: p.id_profesion, label: p.gls_profesion }))}
                valorSeleccionado={profesionEditarSel}
                onSeleccionar={setProfesionEditarSel}
              />
              <View style={{ height: spacing.md }} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarPerfil(item.id_usuario)}
                  disabled={guardandoPerfil}
                >
                  <Text style={[styles.botonToggleTexto, styles.botonActivarTexto]}>{guardandoPerfil ? "Guardando..." : "Guardar"}</Text>
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
            {fuenteImagenPrivada(m.foto_url, token) ? (
              <Image source={fuenteImagenPrivada(m.foto_url, token)!} style={styles.avatarFoto} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colorAvatar(m.id_mascota) }]}>
                <Text style={styles.avatarTexto}>🐾</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>{m.nombre}</Text>
              <View style={styles.filaBadges}>
                {m.especie && (
                  <View style={[styles.badge, { backgroundColor: "#FFE8CC" }]}>
                    <Text style={styles.badgeTexto}>{m.especie}</Text>
                  </View>
                )}
              </View>
              {!!m.numero_chip && <Text style={styles.detalle}>Chip: {m.numero_chip}</Text>}
              {(m.raza || textoEdadMascota(m.fecha_nacimiento)) && (
                <Text style={styles.detalle}>
                  {[m.raza, textoEdadMascota(m.fecha_nacimiento) ? `🎂 ${textoEdadMascota(m.fecha_nacimiento)}` : null].filter(Boolean).join("  ·  ")}
                </Text>
              )}
              {(vacunasPorMascota[m.id_mascota] ?? []).map((v) => (
                <Text key={v.id_mascotavacuna} style={styles.detalle}>
                  💉 {v.nombre_vacuna} · {formatearFecha(v.fecha_aplicacion)} · {v.vigente ? "Vigente" : "Vencida"}
                </Text>
              ))}
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
  botonAgregar: { backgroundColor: colors.botonNaranja, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.botonNaranjaBorde, elevation: 3, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  botonAgregarTexto: { color: colors.botonNaranjaTexto, fontWeight: "800", fontSize: 12 },

  cardResumen: { backgroundColor: colors.cardBlue, borderRadius: radius.lg, padding: spacing.lg },
  nombreCondominioArriba: { ...typography.heading, color: colors.textOnNavy, textAlign: "center" },
  cardResumenTitulo: { ...typography.heading, color: colors.textDark },
  cardResumenUnidad: { fontSize: 24, fontWeight: "800", color: colors.textDark, marginTop: 4 },
  cardResumenSubtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  filaStats: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  statTexto: { ...typography.small, color: colors.textDark, fontWeight: "700" },

  seccionTitulo: { ...typography.heading, color: colors.textOnNavy, marginTop: spacing.sm, fontSize: 16 },
  vacio: { color: colors.textMutedOnNavy, fontStyle: "italic" },

  form: { backgroundColor: colors.cardBlue, borderRadius: radius.lg, padding: spacing.lg },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: colors.textDark },
  campo: { marginTop: spacing.md },
  campoLabel: { ...typography.label, color: colors.textDark, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBlueBorder,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
    color: colors.textDark,
    backgroundColor: colors.white,
  },
  inputBloqueado: { backgroundColor: colors.cardBlueBorder, opacity: 0.8 },
  inputConError: { borderColor: colors.danger, borderWidth: 1.5 },
  botonCrear: { backgroundColor: colors.success, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.lg },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },

  card: { backgroundColor: colors.cardBlue, borderRadius: radius.lg, padding: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarTexto: { fontWeight: "800", fontSize: 16, color: colors.navy900 },
  avatarFoto: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.offWhite },
  nombreItem: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  filaBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTexto: { fontSize: 11, fontWeight: "700", color: colors.textDark },
  detalle: { color: "#344054", fontWeight: "700", marginTop: 4, fontSize: 12 },

  botonToggle: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: colors.success },
  botonActivarTexto: { color: "#fff" },
  botonDesactivar: { backgroundColor: colors.danger },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },

  subForm: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBlueBorder, paddingTop: spacing.sm },
  enlaceCerrar: { color: colors.info, fontSize: 12, fontWeight: "600" },
  filaEditar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBlueBorder,
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
