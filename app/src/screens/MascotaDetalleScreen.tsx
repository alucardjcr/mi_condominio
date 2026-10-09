import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import {
  actualizarMascota,
  actualizarVacunaMascota,
  crearVacunaMascota,
  eliminarVacunaMascota,
  getEspeciesMascota,
  getMascotas,
  getVacunasMascota,
} from "../api/client";
import { EspecieMascota, Mascota, VacunaMascota } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { elegirDeGaleria, tomarFoto } from "../utils/camara";
import DateField from "../components/DateField";
import SelectModal, { OpcionSelect } from "../components/SelectModal";
import { OPCION_OTRA, opcionesEspeciesDesde, opcionesRazasDesde, opcionParaValor } from "../utils/catalogoMascotas";
import { fechaNacimientoMascotaValida, textoEdadMascota } from "../utils/edadMascota";
import { formatearFecha } from "../utils/fechas";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 50, a pedido explícito del usuario, con referencia visual: detalle
// de una mascota — foto grande, datos del depto, y registro de vacunas
// (nuevo, no existía antes este concepto). Se llega acá tocando una
// mascota en MascotasScreen, mandando el objeto completo por parámetro
// (evita un endpoint GET /mascotas/:id que hoy no existe) — igual se
// refresca solo, buscándola de nuevo en la lista, cada vez que la pantalla
// vuelve a tener foco (por si se editó algo).
export default function MascotaDetalleScreen({ navigation }: any) {
  const { token, esAdmin } = useAuth();
  const route = useRoute<any>();
  const [mascota, setMascota] = useState<Mascota>(route.params.mascota);
  const [vacunas, setVacunas] = useState<VacunaMascota[]>([]);
  const [cargandoVacunas, setCargandoVacunas] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(mascota.nombre);
  const [especieSel, setEspecieSel] = useState<OpcionSelect | null>(null);
  const [especieOtra, setEspecieOtra] = useState("");
  const [razaSel, setRazaSel] = useState<OpcionSelect | null>(null);
  const [razaOtra, setRazaOtra] = useState("");
  const [numeroChip, setNumeroChip] = useState(mascota.numero_chip ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(mascota.fecha_nacimiento ?? "");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [especies, setEspecies] = useState<EspecieMascota[]>([]);

  useEffect(() => {
    if (!token) return;
    getEspeciesMascota(token).then(setEspecies).catch(() => {});
  }, [token]);

  const opcionesEspecies = opcionesEspeciesDesde(especies);
  const opcionesRazas = especieSel && especieSel.label !== "Otra" ? opcionesRazasDesde(especies, especieSel.label) : [];

  // Ronda 78: la especie/raza preseleccionada se calcula recién al abrir el
  // formulario de edición (no al montar la pantalla), porque depende del
  // catálogo que llega de la API (`especies`) — si se calculara antes de
  // que llegue, todo quedaría marcado como "Otra".
  const abrirEdicion = () => {
    setNombre(mascota.nombre);
    setNumeroChip(mascota.numero_chip ?? "");
    setFechaNacimiento(mascota.fecha_nacimiento ?? "");
    const ei = opcionParaValor(mascota.especie, opcionesEspeciesDesde(especies));
    setEspecieSel(ei.sel);
    setEspecieOtra(ei.otro);
    const ri = opcionParaValor(mascota.raza, opcionesRazasDesde(especies, ei.sel?.label));
    setRazaSel(ri.sel);
    setRazaOtra(ri.otro);
    setEditando(true);
  };

  const [mostrarFormVacuna, setMostrarFormVacuna] = useState(false);
  const [vacunaEditandoId, setVacunaEditandoId] = useState<number | null>(null);
  const [nombreVacuna, setNombreVacuna] = useState("");
  const [descripcionVacuna, setDescripcionVacuna] = useState("");
  const [fechaAplicacion, setFechaAplicacion] = useState(new Date().toISOString().slice(0, 10));
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [guardandoVacuna, setGuardandoVacuna] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargandoVacunas(true);
    Promise.all([getMascotas(token, esAdmin ? mascota.unidad_id_unidad : undefined), getVacunasMascota(token, mascota.id_mascota)])
      .then(([lista, v]) => {
        const actualizada = lista.find((m) => m.id_mascota === mascota.id_mascota);
        if (actualizada) setMascota(actualizada);
        setVacunas(v);
      })
      .catch((e: any) => Alert.alert("Error", e.message))
      .finally(() => setCargandoVacunas(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  // Ronda 78, a pedido explícito del usuario: la foto de la mascota se
  // cambia igual que la foto de perfil de un residente — cámara O galería,
  // ambas con recorte cuadrado nativo antes de aceptar la foto.
  const obtenerYSubirFoto = async (obtenerFoto: () => Promise<string | null>) => {
    if (!token) return;
    setSubiendoFoto(true);
    try {
      const foto = await obtenerFoto();
      if (!foto) return;
      const actualizada = await actualizarMascota(token, mascota.id_mascota, { foto });
      setMascota(actualizada);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleCambiarFoto = () => {
    Alert.alert("Foto de la mascota", undefined, [
      { text: "📷 Tomar foto", onPress: () => obtenerYSubirFoto(() => tomarFoto({ editable: true, aspecto: [1, 1] })) },
      { text: "🖼️ Elegir de galería", onPress: () => obtenerYSubirFoto(() => elegirDeGaleria({ editable: true, aspecto: [1, 1] })) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleGuardarEdicion = async () => {
    if (!token || !nombre.trim()) {
      Alert.alert("Falta el nombre", "El nombre de la mascota es obligatorio.");
      return;
    }
    if (!fechaNacimientoMascotaValida(fechaNacimiento)) {
      Alert.alert("Fecha inválida", "Escribe la fecha de nacimiento como DD/MM/AAAA (ej: 15/03/2022), sin fechas futuras.");
      return;
    }
    const especieFinal = especieSel?.label === "Otra" ? especieOtra.trim() : especieSel?.label ?? "";
    const razaFinal = razaSel?.label === "Otra" ? razaOtra.trim() : razaSel?.label ?? "";
    setGuardandoEdicion(true);
    try {
      const actualizada = await actualizarMascota(token, mascota.id_mascota, {
        nombre: nombre.trim(),
        especie: especieFinal || undefined,
        raza: razaFinal || undefined,
        numero_chip: numeroChip.trim() || undefined,
        fecha_nacimiento: fechaNacimiento.trim() || null,
      });
      setMascota(actualizada);
      setEditando(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const limpiarFormVacuna = () => {
    setNombreVacuna("");
    setDescripcionVacuna("");
    setFechaAplicacion(new Date().toISOString().slice(0, 10));
    setFechaVencimiento("");
    setVacunaEditandoId(null);
    setMostrarFormVacuna(false);
  };

  const handleGuardarVacuna = async () => {
    if (!token || !nombreVacuna.trim() || !fechaAplicacion.trim()) {
      Alert.alert("Faltan datos", "El nombre de la vacuna y la fecha de aplicación son obligatorios.");
      return;
    }
    setGuardandoVacuna(true);
    try {
      if (vacunaEditandoId) {
        await actualizarVacunaMascota(token, mascota.id_mascota, vacunaEditandoId, {
          nombre_vacuna: nombreVacuna.trim(),
          descripcion: descripcionVacuna.trim() || null,
          fecha_aplicacion: fechaAplicacion.trim(),
          fecha_vencimiento: fechaVencimiento.trim() || null,
        });
      } else {
        await crearVacunaMascota(token, mascota.id_mascota, {
          nombre_vacuna: nombreVacuna.trim(),
          descripcion: descripcionVacuna.trim() || undefined,
          fecha_aplicacion: fechaAplicacion.trim(),
          fecha_vencimiento: fechaVencimiento.trim() || undefined,
        });
      }
      limpiarFormVacuna();
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoVacuna(false);
    }
  };

  const handleAbrirEdicionVacuna = (v: VacunaMascota) => {
    setVacunaEditandoId(v.id_mascotavacuna);
    setNombreVacuna(v.nombre_vacuna);
    setDescripcionVacuna(v.descripcion ?? "");
    setFechaAplicacion(v.fecha_aplicacion);
    setFechaVencimiento(v.fecha_vencimiento ?? "");
    setMostrarFormVacuna(true);
  };

  const handleEliminarVacuna = (v: VacunaMascota) => {
    if (!token) return;
    Alert.alert("Eliminar vacuna", `¿Eliminar el registro de "${v.nombre_vacuna}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminarVacunaMascota(token, mascota.id_mascota, v.id_mascotavacuna);
            cargar();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  // Ronda 51, a pedido explícito del usuario: menú "⋮" por vacuna (antes
  // solo se podía eliminar manteniendo presionado, y no existía forma de
  // editar una vacuna ya cargada).
  const handleOpcionesVacuna = (v: VacunaMascota) => {
    Alert.alert(v.nombre_vacuna, "¿Qué quieres hacer con esta vacuna?", [
      { text: "Editar", onPress: () => handleAbrirEdicionVacuna(v) },
      { text: "Eliminar", style: "destructive", onPress: () => handleEliminarVacuna(v) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleCopiarChip = async () => {
    if (!mascota.numero_chip) return;
    await Clipboard.setStringAsync(mascota.numero_chip);
    Alert.alert("Copiado", "El N° de chip se copió al portapapeles.");
  };

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <View style={styles.filaFoto}>
        <View style={styles.fotoWrap}>
          {mascota.foto_url ? (
            <Image source={fuenteImagenPrivada(mascota.foto_url, token)!} style={styles.foto} />
          ) : (
            <View style={[styles.foto, styles.fotoVacia]}>
              <Text style={{ fontSize: 40 }}>🐾</Text>
            </View>
          )}
          <TouchableOpacity style={styles.botonCamara} onPress={handleCambiarFoto} disabled={subiendoFoto}>
            {subiendoFoto ? <ActivityIndicator size="small" color={colors.botonNaranjaTexto} /> : <Text style={{ fontSize: 16 }}>📷</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filaNombreEditar}>
        <Text style={styles.nombreGrande}>{mascota.nombre} 🐾</Text>
        <TouchableOpacity style={styles.botonEditar} onPress={() => (editando ? setEditando(false) : abrirEdicion())}>
          <Text style={styles.botonEditarTexto}>{editando ? "✕ Cerrar" : "✏️ Editar"}</Text>
        </TouchableOpacity>
      </View>

      {mascota.especie && !editando && (
        <View style={styles.filaCentrada}>
          <View style={styles.badgeEspecie}>
            <Text style={styles.badgeEspecieTexto}>🐕 {mascota.especie}</Text>
          </View>
        </View>
      )}

      {editando ? (
        <View style={styles.card}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Firulais" placeholderTextColor={colors.textMutedOnNavy} />
          <SelectModal
            label="Especie"
            placeholder="Selecciona una especie"
            opciones={opcionesEspecies}
            valorSeleccionado={especieSel}
            onSeleccionar={(o) => {
              setEspecieSel(o);
              setEspecieOtra("");
              setRazaSel(null);
              setRazaOtra("");
            }}
            extraFooterLabel="Otra especie / no está en la lista"
            onExtraFooter={() => {
              setEspecieSel(OPCION_OTRA);
              setEspecieOtra("");
              setRazaSel(null);
              setRazaOtra("");
            }}
          />
          {especieSel?.label === "Otra" && (
            <TextInput style={styles.input} value={especieOtra} onChangeText={setEspecieOtra} placeholder="Escribe la especie" placeholderTextColor={colors.textMutedOnNavy} />
          )}

          <SelectModal
            label="Raza"
            placeholder={especieSel ? "Selecciona una raza" : "Primero elige una especie"}
            opciones={opcionesRazas}
            valorSeleccionado={razaSel}
            onSeleccionar={(o) => {
              setRazaSel(o);
              setRazaOtra("");
            }}
            disabled={!especieSel}
            extraFooterLabel="Otra raza / no está en la lista"
            onExtraFooter={() => {
              setRazaSel(OPCION_OTRA);
              setRazaOtra("");
            }}
          />
          {razaSel?.label === "Otra" && (
            <TextInput style={styles.input} value={razaOtra} onChangeText={setRazaOtra} placeholder="Escribe la raza" placeholderTextColor={colors.textMutedOnNavy} />
          )}
          <DateField label="Fecha de nacimiento (opcional)" value={fechaNacimiento} onChange={setFechaNacimiento} maximumDate={new Date()} opcional />
          <Text style={styles.label}>N° de chip</Text>
          <TextInput
            style={styles.input}
            value={numeroChip}
            onChangeText={setNumeroChip}
            placeholder="Si tiene chip identificatorio"
            placeholderTextColor={colors.textMutedOnNavy}
          />
          <TouchableOpacity style={styles.botonGuardar} onPress={handleGuardarEdicion} disabled={guardandoEdicion}>
            <Text style={styles.botonGuardarTexto}>{guardandoEdicion ? "Guardando..." : "Guardar cambios"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardInfo}>
          {esAdmin && mascota.nombre_torre && (
            <>
              <View style={styles.filaInfo}>
                <Text style={styles.infoIcono}>🏢</Text>
                <View>
                  <Text style={styles.infoTexto}>
                    {mascota.nombre_torre} | Departamento {mascota.numero_unidad}
                  </Text>
                </View>
              </View>
              <View style={styles.divisor} />
            </>
          )}
          {mascota.numero_chip ? (
            <View style={styles.filaInfo}>
              <Text style={styles.infoIcono}>🔖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>N° de chip</Text>
                <Text style={styles.infoTexto}>{mascota.numero_chip}</Text>
              </View>
              <TouchableOpacity onPress={handleCopiarChip}>
                <Text style={styles.infoIcono}>📋</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.sinDato}>Sin chip identificatorio registrado.</Text>
          )}
          {mascota.raza && <Text style={styles.infoTextoSecundario}>Raza: {mascota.raza}</Text>}
          {textoEdadMascota(mascota.fecha_nacimiento) && (
            <Text style={styles.infoTextoSecundario}>
              Edad: {textoEdadMascota(mascota.fecha_nacimiento)} (nació el {formatearFecha(mascota.fecha_nacimiento)})
            </Text>
          )}
        </View>
      )}

      <View style={styles.cardVacunas}>
        <View style={styles.filaSeccionVacunas}>
          <Text style={styles.seccionVacunasTitulo}>💉 Vacunas</Text>
          <TouchableOpacity
            style={styles.botonAgregarVacuna}
            onPress={() => (mostrarFormVacuna ? limpiarFormVacuna() : setMostrarFormVacuna(true))}
          >
            <Text style={styles.botonAgregarVacunaTexto}>{mostrarFormVacuna ? "✕ Cerrar" : "+ Agregar vacuna"}</Text>
          </TouchableOpacity>
        </View>

        {mostrarFormVacuna && (
          <View style={styles.formVacuna}>
            <Text style={styles.formVacunaTitulo}>{vacunaEditandoId ? "Editar vacuna" : "Nueva vacuna"}</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de la vacuna (ej: Antirrábica)"
              placeholderTextColor={colors.textMutedOnNavy}
              value={nombreVacuna}
              onChangeText={setNombreVacuna}
            />
            <TextInput
              style={styles.input}
              placeholder="Descripción (opcional)"
              placeholderTextColor={colors.textMutedOnNavy}
              value={descripcionVacuna}
              onChangeText={setDescripcionVacuna}
            />
            <DateField key={`aplic-${vacunaEditandoId ?? "nueva"}`} label="Fecha de aplicación" value={fechaAplicacion} onChange={setFechaAplicacion} maximumDate={new Date()} />
            <DateField key={`venc-${vacunaEditandoId ?? "nueva"}`} label="Fecha de vencimiento (opcional)" value={fechaVencimiento} onChange={setFechaVencimiento} opcional />
            <TouchableOpacity style={styles.botonGuardar} onPress={handleGuardarVacuna} disabled={guardandoVacuna}>
              <Text style={styles.botonGuardarTexto}>
                {guardandoVacuna ? "Guardando..." : vacunaEditandoId ? "Guardar cambios" : "Guardar vacuna"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {cargandoVacunas ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.gold} />
        ) : vacunas.length === 0 ? (
          <Text style={styles.sinDato}>Todavía no hay vacunas registradas.</Text>
        ) : (
          vacunas.map((v) => (
            <View key={v.id_mascotavacuna} style={styles.filaVacuna}>
              <Text style={styles.infoIcono}>🐾</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.vacunaNombre}>{v.nombre_vacuna}</Text>
                {v.descripcion && (
                  <Text style={styles.vacunaDescripcion} numberOfLines={2}>
                    {v.descripcion}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={styles.vacunaFecha}>📅 {formatearFecha(v.fecha_aplicacion)}</Text>
                <View style={[styles.badgeVigencia, { backgroundColor: v.vigente ? "#DCFCE7" : "#FEE2E2" }]}>
                  <Text style={[styles.badgeVigenciaTexto, { color: v.vigente ? "#166534" : "#991B1B" }]}>
                    {v.vigente ? "Vigente" : "Vencida"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.botonOpciones} onPress={() => handleOpcionesVacuna(v)} hitSlop={10}>
                <Text style={styles.botonOpcionesTexto}>⋮</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTexto}>
          ℹ️ Recuerda mantener las vacunas de tu mascota al día. Es parte de una convivencia segura para todos.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },

  filaFoto: { alignItems: "center" },
  fotoWrap: { width: 160, height: 160 },
  foto: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: colors.white, backgroundColor: colors.navy700 },
  fotoVacia: { alignItems: "center", justifyContent: "center" },
  botonCamara: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.botonNaranja,
    borderWidth: 3,
    borderColor: colors.navy900,
    alignItems: "center",
    justifyContent: "center",
  },

  filaNombreEditar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  nombreGrande: { ...typography.title, color: colors.textOnNavy },
  botonEditar: { position: "absolute", right: 0, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  botonEditarTexto: { color: colors.textOnNavy, fontSize: 12, fontWeight: "700" },

  filaCentrada: { alignItems: "center" },
  badgeEspecie: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  badgeEspecieTexto: { color: colors.textOnNavy, fontWeight: "700", fontSize: 13 },

  cardInfo: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  filaInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  infoIcono: { fontSize: 16 },
  infoLabel: { color: colors.textMutedOnNavy, fontSize: 11 },
  infoTexto: { color: colors.textOnNavy, fontWeight: "700", fontSize: 14 },
  infoTextoSecundario: { color: colors.textMutedOnNavy, fontSize: 12, marginTop: 4 },
  divisor: { height: 1, backgroundColor: colors.navy600, marginVertical: 6 },
  sinDato: { color: colors.textMutedOnNavy, fontStyle: "italic", fontSize: 12 },

  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: colors.textOnNavy, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    marginTop: 4,
    color: colors.textOnNavy,
    backgroundColor: colors.navy700,
  },
  botonGuardar: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.md },
  botonGuardarTexto: { color: colors.botonNaranjaTexto, fontWeight: "700" },

  cardVacunas: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  filaSeccionVacunas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seccionVacunasTitulo: { fontSize: 17, fontWeight: "800", color: colors.textOnNavy },
  botonAgregarVacuna: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  botonAgregarVacunaTexto: { color: colors.botonNaranjaTexto, fontWeight: "700", fontSize: 12 },
  formVacuna: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.navy600, paddingTop: spacing.sm },
  formVacunaTitulo: { fontSize: 14, fontWeight: "800", color: colors.textOnNavy, marginBottom: 4 },

  filaVacuna: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.navy600,
    marginTop: spacing.sm,
  },
  vacunaNombre: { fontWeight: "700", color: colors.textOnNavy, fontSize: 14 },
  vacunaDescripcion: { color: colors.textMutedOnNavy, fontSize: 12, marginTop: 2 },
  vacunaFecha: { color: colors.textMutedOnNavy, fontSize: 11 },
  badgeVigencia: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeVigenciaTexto: { fontSize: 10, fontWeight: "800" },

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },
  botonOpciones: { paddingHorizontal: 4, paddingVertical: 4, marginLeft: 4 },
  botonOpcionesTexto: { color: colors.textMutedOnNavy, fontSize: 20, fontWeight: "800" },
});
