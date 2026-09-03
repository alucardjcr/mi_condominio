import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import {
  actualizarMascota,
  actualizarVacunaMascota,
  crearVacunaMascota,
  eliminarVacunaMascota,
  getMascotas,
  getVacunasMascota,
} from "../api/client";
import { Mascota, VacunaMascota } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { tomarFoto } from "../utils/camara";
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
  const [especie, setEspecie] = useState(mascota.especie ?? "");
  const [raza, setRaza] = useState(mascota.raza ?? "");
  const [numeroChip, setNumeroChip] = useState(mascota.numero_chip ?? "");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

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

  const handleCambiarFoto = async () => {
    if (!token) return;
    setSubiendoFoto(true);
    try {
      const foto = await tomarFoto();
      if (!foto) return;
      const actualizada = await actualizarMascota(token, mascota.id_mascota, { foto });
      setMascota(actualizada);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleGuardarEdicion = async () => {
    if (!token || !nombre.trim()) {
      Alert.alert("Falta el nombre", "El nombre de la mascota es obligatorio.");
      return;
    }
    setGuardandoEdicion(true);
    try {
      const actualizada = await actualizarMascota(token, mascota.id_mascota, {
        nombre: nombre.trim(),
        especie: especie.trim() || undefined,
        raza: raza.trim() || undefined,
        numero_chip: numeroChip.trim() || undefined,
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
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
            {subiendoFoto ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 16 }}>📷</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filaNombreEditar}>
        <Text style={styles.nombreGrande}>{mascota.nombre} 🐾</Text>
        <TouchableOpacity style={styles.botonEditar} onPress={() => setEditando((v) => !v)}>
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
          <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Firulais" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Especie</Text>
          <TextInput style={styles.input} value={especie} onChangeText={setEspecie} placeholder="Ej: Perro, Gato" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>Raza</Text>
          <TextInput style={styles.input} value={raza} onChangeText={setRaza} placeholder="Ej: Golden Retriever" placeholderTextColor={colors.textMuted} />
          <Text style={styles.label}>N° de chip</Text>
          <TextInput
            style={styles.input}
            value={numeroChip}
            onChangeText={setNumeroChip}
            placeholder="Si tiene chip identificatorio"
            placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              value={nombreVacuna}
              onChangeText={setNombreVacuna}
            />
            <TextInput
              style={styles.input}
              placeholder="Descripción (opcional)"
              placeholderTextColor={colors.textMuted}
              value={descripcionVacuna}
              onChangeText={setDescripcionVacuna}
            />
            <Text style={styles.label}>Fecha de aplicación</Text>
            <TextInput style={styles.input} placeholder="AAAA-MM-DD" value={fechaAplicacion} onChangeText={setFechaAplicacion} />
            <Text style={styles.label}>Fecha de vencimiento (opcional)</Text>
            <TextInput style={styles.input} placeholder="AAAA-MM-DD" value={fechaVencimiento} onChangeText={setFechaVencimiento} />
            <TouchableOpacity style={styles.botonGuardar} onPress={handleGuardarVacuna} disabled={guardandoVacuna}>
              <Text style={styles.botonGuardarTexto}>
                {guardandoVacuna ? "Guardando..." : vacunaEditandoId ? "Guardar cambios" : "Guardar vacuna"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {cargandoVacunas ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.navy900} />
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
                <Text style={styles.vacunaFecha}>📅 {v.fecha_aplicacion}</Text>
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
    backgroundColor: colors.navy900,
    borderWidth: 3,
    borderColor: colors.white,
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

  cardInfo: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  filaInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  infoIcono: { fontSize: 16 },
  infoLabel: { color: colors.textMutedOnNavy, fontSize: 11 },
  infoTexto: { color: colors.textOnNavy, fontWeight: "700", fontSize: 14 },
  infoTextoSecundario: { color: colors.textMutedOnNavy, fontSize: 12, marginTop: 4 },
  divisor: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 6 },
  sinDato: { color: colors.textMutedOnNavy, fontStyle: "italic", fontSize: 12 },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: colors.textDark, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    marginTop: 4,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  botonGuardar: { backgroundColor: colors.success, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.md },
  botonGuardarTexto: { color: "#fff", fontWeight: "700" },

  cardVacunas: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  filaSeccionVacunas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seccionVacunasTitulo: { fontSize: 17, fontWeight: "800", color: colors.textDark },
  botonAgregarVacuna: { backgroundColor: "#DBEAFE", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  botonAgregarVacunaTexto: { color: colors.navy900, fontWeight: "700", fontSize: 12 },
  formVacuna: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  formVacunaTitulo: { fontSize: 14, fontWeight: "800", color: colors.textDark, marginBottom: 4 },

  filaVacuna: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  vacunaNombre: { fontWeight: "700", color: colors.textDark, fontSize: 14 },
  vacunaDescripcion: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  vacunaFecha: { color: colors.textMuted, fontSize: 11 },
  badgeVigencia: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeVigenciaTexto: { fontSize: 10, fontWeight: "800" },

  banner: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md },
  bannerTexto: { color: colors.textOnNavy, fontSize: 12, lineHeight: 18 },
  botonOpciones: { paddingHorizontal: 4, paddingVertical: 4, marginLeft: 4 },
  botonOpcionesTexto: { color: colors.textMuted, fontSize: 20, fontWeight: "800" },
});
