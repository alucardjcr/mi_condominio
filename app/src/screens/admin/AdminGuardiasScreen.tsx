import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminActualizarGuardia, adminCrearGuardia, adminGetGuardias } from "../../api/client";
import { Guardia } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/theme";
import { calcularEdad, esRutValido, formatearRut } from "../../utils/validarRut";
import { fuenteImagenPrivada } from "../../utils/imagenesPrivadas";
import DateField from "../../components/DateField";
import FotoCapture from "../../components/FotoCapture";

// Ronda 69, a pedido explícito del usuario: "¿tenemos si los guardias o
// conserjes... son internos?" — antes no existía este dato. `esInterno`
// usa null como "sin definir" a propósito (no todo guardia cargado antes
// de esta ronda tiene por qué tener esto contestado todavía).
export default function AdminGuardiasScreen() {
  const { token } = useAuth();
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombres, setNombres] = useState("");
  const [apPaterno, setApPaterno] = useState("");
  const [apMaterno, setApMaterno] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [rut, setRut] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [fechaNac, setFechaNac] = useState("");
  const [os10, setOs10] = useState<boolean | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [esInterno, setEsInterno] = useState<boolean | null>(null);
  const [empresaExterna, setEmpresaExterna] = useState("");
  const [creando, setCreando] = useState(false);

  // Edición de interno/externo de un guardia ya existente, inline.
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editInterno, setEditInterno] = useState<boolean | null>(null);
  const [editEmpresa, setEditEmpresa] = useState("");
  const [editNombres, setEditNombres] = useState("");
  const [editApPaterno, setEditApPaterno] = useState("");
  const [editApMaterno, setEditApMaterno] = useState("");
  const [editRut, setEditRut] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editCorreo, setEditCorreo] = useState("");
  const [editFechaNac, setEditFechaNac] = useState("");
  const [editOs10, setEditOs10] = useState<boolean | null>(null);
  const [editFoto, setEditFoto] = useState<string | null>(null);
  const [guardandoInterno, setGuardandoInterno] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setGuardias(await adminGetGuardias(token));
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

  const handleCrear = async () => {
    if (!token || !nombres.trim() || !apPaterno.trim() || !usuariocol || !password) {
      Alert.alert("Faltan datos", "Nombres, apellido paterno, usuario y contraseña son obligatorios.");
      return;
    }
    if (rut.trim() && !esRutValido(rut)) {
      Alert.alert("RUT inválido", "Revisa el RUT del guardia.");
      return;
    }
    if (correo.trim() && !/^\S+@\S+\.\S+$/.test(correo.trim())) {
      Alert.alert("Correo inválido", "Revisa el correo del guardia.");
      return;
    }
    if (esInterno === false && !empresaExterna.trim()) {
      Alert.alert("Falta la empresa", "Si el guardia es externo, indica el nombre de la empresa a la que pertenece.");
      return;
    }
    const nombreCreado = [nombres, apPaterno, apMaterno].map((x) => x.trim()).filter(Boolean).join(" ");
    const usuarioCreado = usuariocol;
    setCreando(true);
    try {
      await adminCrearGuardia(token, {
        nombres: nombres.trim(),
        apellido_paterno: apPaterno.trim(),
        apellido_materno: apMaterno.trim() || undefined,
        usuariocol,
        password,
        rut: rut.trim() ? formatearRut(rut) : undefined,
        telefono: telefono.trim() || undefined,
        correo_usuario: correo.trim() || undefined,
        fecha_nacimiento: fechaNac || undefined,
        os10_vigente: os10,
        foto: foto ?? undefined,
        flg_interno: esInterno ?? undefined,
        empresa_externa: esInterno === false ? empresaExterna.trim() || undefined : undefined,
      });
      setNombres("");
      setApPaterno("");
      setApMaterno("");
      setUsuariocol("");
      setPassword("");
      setRut("");
      setTelefono("");
      setCorreo("");
      setFechaNac("");
      setOs10(null);
      setFoto(null);
      setEsInterno(null);
      setEmpresaExterna("");
      setMostrarForm(false);
      cargar();
      Alert.alert("✅ Guardia creado", `${nombreCreado} quedó registrado. Ya puede entrar a la app con el usuario "${usuarioCreado}".`);
    } catch (e: any) {
      Alert.alert("No se pudo crear el guardia", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (g: Guardia) => {
    if (!token) return;
    try {
      await adminActualizarGuardia(token, g.id_usuario, { flg_vigencia: g.flg_vigencia ? 0 : 1 });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleAbrirEdicionInterno = (g: Guardia) => {
    setEditandoId(g.id_usuario);
    setEditInterno(g.flg_interno === null || g.flg_interno === undefined ? null : Boolean(g.flg_interno));
    setEditEmpresa(g.empresa_externa ?? "");
    // Guardias cargados antes de separar el nombre no tienen las partes: se
    // dejan vacías y el nombre solo se toca si se completan.
    setEditNombres(g.nombres ?? "");
    setEditApPaterno(g.apellido_paterno ?? "");
    setEditApMaterno(g.apellido_materno ?? "");
    setEditRut(g.rut ?? "");
    setEditTelefono(g.telefono ?? "");
    setEditCorreo(g.correo_usuario ?? "");
    setEditFechaNac(g.fecha_nacimiento ?? "");
    setEditOs10(g.os10_vigente === null || g.os10_vigente === undefined ? null : Boolean(g.os10_vigente));
    setEditFoto(null);
  };

  const handleGuardarInterno = async (id: number) => {
    if (!token) return;
    if (editRut.trim() && !esRutValido(editRut)) {
      Alert.alert("RUT inválido", "Revisa el RUT del guardia.");
      return;
    }
    if (editCorreo.trim() && !/^\S+@\S+\.\S+$/.test(editCorreo.trim())) {
      Alert.alert("Correo inválido", "Revisa el correo del guardia.");
      return;
    }
    if (editInterno === false && !editEmpresa.trim()) {
      Alert.alert("Falta la empresa", "Si el guardia es externo, indica el nombre de la empresa a la que pertenece.");
      return;
    }
    const tocoNombre = !!(editNombres.trim() || editApPaterno.trim() || editApMaterno.trim());
    if (tocoNombre && (!editNombres.trim() || !editApPaterno.trim())) {
      Alert.alert("Falta el nombre", "Para cambiar el nombre indica Nombres y Apellido paterno (el materno es opcional).");
      return;
    }
    setGuardandoInterno(true);
    try {
      await adminActualizarGuardia(token, id, {
        ...(tocoNombre
          ? { nombres: editNombres.trim(), apellido_paterno: editApPaterno.trim(), apellido_materno: editApMaterno.trim() || null }
          : {}),
        rut: editRut.trim() ? formatearRut(editRut) : null,
        telefono: editTelefono.trim() || null,
        correo_usuario: editCorreo.trim() || null,
        fecha_nacimiento: editFechaNac || null,
        os10_vigente: editOs10,
        foto: editFoto ?? undefined,
        flg_interno: editInterno,
        empresa_externa: editInterno === false ? editEmpresa.trim() || null : null,
      });
      setEditandoId(null);
      cargar();
      Alert.alert("✅ Datos guardados", "Los datos del guardia quedaron actualizados.");
    } catch (e: any) {
      Alert.alert("No se pudieron guardar los datos", e.message);
    } finally {
      setGuardandoInterno(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <FlatList automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      style={styles.container}
      data={guardias}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={<Text style={styles.detalle}>Aún no hay guardias creados.</Text>}
      ListFooterComponent={
        <View style={{ marginTop: 6 }}>
          {!mostrarForm ? (
            <TouchableOpacity style={styles.botonCrear} onPress={() => setMostrarForm(true)}>
              <Text style={styles.botonCrearTexto}>➕ Crear guardia</Text>
            </TouchableOpacity>
          ) : (
            <>
        <View style={styles.form}>
              <Text style={styles.formTitulo}>Nuevo guardia</Text>
    
              {/* Orden pedido por el usuario: foto (redonda), RUT, nombre,
                  teléfono, fecha de nacimiento, curso OS10 y, al final,
                  usuario y contraseña. */}
              <View style={styles.campo}>
                {!foto && (
                  <View style={styles.fotoVacia}>
                    <Text style={{ fontSize: 56 }}>👤</Text>
                  </View>
                )}
                <FotoCapture label="Foto del guardia (solo la carga el Administrador)" value={foto} onChange={setFoto} recorteCuadrado />
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>RUT</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12345678-9 (opcional)" placeholderTextColor={colors.textMutedOnNavy}
                  value={rut}
                  onChangeText={setRut}
                  autoCapitalize="characters"
                />
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>Nombres</Text>
                <TextInput style={styles.input} placeholder="Nombres" placeholderTextColor={colors.textMutedOnNavy} value={nombres} onChangeText={setNombres} />
                <Text style={styles.label}>Apellido paterno</Text>
                <TextInput style={styles.input} placeholder="Apellido paterno" placeholderTextColor={colors.textMutedOnNavy} value={apPaterno} onChangeText={setApPaterno} />
                <Text style={styles.label}>Apellido materno (opcional)</Text>
                <TextInput style={styles.input} placeholder="Apellido materno" placeholderTextColor={colors.textMutedOnNavy} value={apMaterno} onChangeText={setApMaterno} />
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+56 9 1234 5678 (opcional)" placeholderTextColor={colors.textMutedOnNavy}
                  value={telefono}
                  onChangeText={setTelefono}
                  keyboardType="phone-pad"
                />
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>Correo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="correo@ejemplo.cl (opcional)" placeholderTextColor={colors.textMutedOnNavy}
                  value={correo}
                  onChangeText={setCorreo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
    
              <View style={styles.campo}>
                <DateField label="Fecha de nacimiento (opcional)" value={fechaNac} onChange={setFechaNac} maximumDate={new Date()} opcional />
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>Curso OS10</Text>
                <View style={styles.filaChips}>
                  <TouchableOpacity style={[styles.chip, os10 === true && styles.chipActivo]} onPress={() => setOs10(true)}>
                    <Text style={[styles.chipTexto, os10 === true && styles.chipTextoActivo]}>Vigente</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, os10 === false && styles.chipActivo]} onPress={() => setOs10(false)}>
                    <Text style={[styles.chipTexto, os10 === false && styles.chipTextoActivo]}>No vigente</Text>
                  </TouchableOpacity>
                </View>
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>¿Es personal interno del condominio o externo?</Text>
                <View style={styles.filaChips}>
                  <TouchableOpacity style={[styles.chip, esInterno === true && styles.chipActivo]} onPress={() => setEsInterno(true)}>
                    <Text style={[styles.chipTexto, esInterno === true && styles.chipTextoActivo]}>Interno</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, esInterno === false && styles.chipActivo]} onPress={() => setEsInterno(false)}>
                    <Text style={[styles.chipTexto, esInterno === false && styles.chipTextoActivo]}>Externo</Text>
                  </TouchableOpacity>
                </View>
                {esInterno === false && (
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre de la empresa a la que pertenece *" placeholderTextColor={colors.textMutedOnNavy}
                    value={empresaExterna}
                    onChangeText={setEmpresaExterna}
                  />
                )}
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>Usuario (para entrar a la app)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Usuario" placeholderTextColor={colors.textMutedOnNavy}
                  value={usuariocol}
                  onChangeText={setUsuariocol}
                  autoCapitalize="none"
                />
              </View>
    
              <View style={styles.campo}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña" placeholderTextColor={colors.textMutedOnNavy}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
    
              <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
                <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear guardia"}</Text>
              </TouchableOpacity>
            </View>
    
              <TouchableOpacity style={styles.botonCancelarForm} onPress={() => setMostrarForm(false)} disabled={creando}>
                <Text style={styles.botonCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const edad = item.fecha_nacimiento ? calcularEdad(item.fecha_nacimiento) : null;
        const foto = fuenteImagenPrivada(item.foto_url, token);
        return (
          <View style={styles.card}>
            <View style={styles.cabeza}>
              {foto ? (
                <Image source={foto} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.nombreItem}>{item.nombre_usuario}</Text>
                <Text style={styles.detalle}>
                  usuario: {item.usuariocol} · {item.flg_vigencia ? "Activo" : "Inactivo"}
                </Text>
              </View>
            </View>

            <View style={styles.lineas}>
              <Text style={styles.linea}>
                <Text style={styles.lineaEtq}>RUT: </Text>
                {item.rut || "sin registrar"}
              </Text>
              <Text style={styles.linea}>
                <Text style={styles.lineaEtq}>Teléfono: </Text>
                {item.telefono || "sin registrar"}
              </Text>
              <Text style={styles.linea}>
                <Text style={styles.lineaEtq}>Correo: </Text>
                {item.correo_usuario || "sin registrar"}
              </Text>
              <Text style={styles.linea}>
                <Text style={styles.lineaEtq}>Curso OS10: </Text>
                {item.os10_vigente === null || item.os10_vigente === undefined
                  ? "sin definir"
                  : item.os10_vigente
                  ? "Vigente"
                  : "No vigente"}
              </Text>
              <Text style={styles.linea}>
                <Text style={styles.lineaEtq}>Tipo: </Text>
                {item.flg_interno === null || item.flg_interno === undefined
                  ? "sin definir"
                  : item.flg_interno
                  ? "Interno"
                  : `Externo${item.empresa_externa ? ` — ${item.empresa_externa}` : ""}`}
              </Text>
              <Text style={styles.linea}>
                <Text style={styles.lineaEtq}>Nacimiento: </Text>
                {item.fecha_nacimiento
                  ? `${item.fecha_nacimiento.split("-").reverse().join("/")}${edad !== null ? ` (${edad} años)` : ""}`
                  : "sin registrar"}
              </Text>
            </View>

            {editandoId === item.id_usuario ? (
              <View style={styles.subForm}>
                <Text style={styles.formTitulo}>Editar datos</Text>
                <FotoCapture label="Cambiar foto (solo Administrador/Comité)" value={editFoto} onChange={setEditFoto} recorteCuadrado />
                <Text style={styles.label}>RUT</Text>
                <TextInput style={styles.input} placeholder="RUT" placeholderTextColor={colors.textMutedOnNavy} value={editRut} onChangeText={setEditRut} autoCapitalize="characters" />
                <Text style={styles.detalle}>Nombre (déjalo vacío si no quieres cambiarlo):</Text>
                <Text style={styles.label}>Nombres</Text>
                <TextInput style={styles.input} placeholder="Nombres" placeholderTextColor={colors.textMutedOnNavy} value={editNombres} onChangeText={setEditNombres} />
                <Text style={styles.label}>Apellido paterno</Text>
                <TextInput style={styles.input} placeholder="Apellido paterno" placeholderTextColor={colors.textMutedOnNavy} value={editApPaterno} onChangeText={setEditApPaterno} />
                <Text style={styles.label}>Apellido materno (opcional)</Text>
                <TextInput style={styles.input} placeholder="Apellido materno" placeholderTextColor={colors.textMutedOnNavy} value={editApMaterno} onChangeText={setEditApMaterno} />
                <Text style={styles.label}>Teléfono</Text>
                <TextInput style={styles.input} placeholder="Teléfono" placeholderTextColor={colors.textMutedOnNavy} value={editTelefono} onChangeText={setEditTelefono} keyboardType="phone-pad" />
                <Text style={styles.label}>Correo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="correo@ejemplo.cl"
                  placeholderTextColor={colors.textMutedOnNavy}
                  value={editCorreo}
                  onChangeText={setEditCorreo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <DateField label="Fecha de nacimiento" value={editFechaNac} onChange={setEditFechaNac} maximumDate={new Date()} opcional />
                <Text style={styles.label}>Curso OS10</Text>
                <View style={styles.filaChips}>
                  <TouchableOpacity style={[styles.chip, editOs10 === true && styles.chipActivo]} onPress={() => setEditOs10(true)}>
                    <Text style={[styles.chipTexto, editOs10 === true && styles.chipTextoActivo]}>Vigente</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, editOs10 === false && styles.chipActivo]} onPress={() => setEditOs10(false)}>
                    <Text style={[styles.chipTexto, editOs10 === false && styles.chipTextoActivo]}>No vigente</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Interno o externo</Text>
                <View style={styles.filaChips}>
                  <TouchableOpacity style={[styles.chip, editInterno === true && styles.chipActivo]} onPress={() => setEditInterno(true)}>
                    <Text style={[styles.chipTexto, editInterno === true && styles.chipTextoActivo]}>Interno</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chip, editInterno === false && styles.chipActivo]} onPress={() => setEditInterno(false)}>
                    <Text style={[styles.chipTexto, editInterno === false && styles.chipTextoActivo]}>Externo</Text>
                  </TouchableOpacity>
                </View>
                {editInterno === false && (
                  <TextInput style={styles.input} placeholder="Nombre de la empresa a la que pertenece *" placeholderTextColor={colors.textMutedOnNavy} value={editEmpresa} onChangeText={setEditEmpresa} />
                )}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.botonToggle, styles.botonGuardar, { flex: 1 }]}
                    onPress={() => handleGuardarInterno(item.id_usuario)}
                    disabled={guardandoInterno}
                  >
                    <Text style={styles.botonGuardarTexto}>{guardandoInterno ? "Guardando..." : "Guardar"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.botonToggle, styles.botonCancelar, { flex: 1 }]} onPress={() => setEditandoId(null)}>
                    <Text style={styles.botonCancelarTexto}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.filaBotones}>
                <TouchableOpacity style={[styles.botonAccion, styles.botonGuardar]} onPress={() => handleAbrirEdicionInterno(item)}>
                  <Text style={styles.botonGuardarTexto}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonAccion, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
                  onPress={() => handleToggle(item)}
                >
                  <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  form: { backgroundColor: colors.navy800, borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: colors.textOnNavy },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMutedOnNavy, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: colors.navy700,
    color: colors.textOnNavy,
  },
  filaChips: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1.5, borderColor: colors.navy600, backgroundColor: colors.navy700, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActivo: { borderColor: colors.botonNaranja, backgroundColor: colors.navy900 },
  chipTexto: { color: colors.textMutedOnNavy, fontWeight: "600", fontSize: 13 },
  chipTextoActivo: { color: colors.goldSoft },
  campo: { marginBottom: 18 },
  fotoVacia: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.navy700,
  },
  botonCrear: {
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  botonCrearTexto: { color: colors.botonNaranjaTexto, fontWeight: "700" },
  card: {
    backgroundColor: colors.navy800,
    borderRadius: 12,
    padding: 14,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy700, marginRight: 12, overflow: "hidden" },
  nombreItem: { fontSize: 16, fontWeight: "700", color: colors.textOnNavy },
  detalle: { color: colors.textMutedOnNavy, marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  botonGuardar: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde },
  botonGuardarTexto: { color: colors.botonNaranjaTexto, fontWeight: "700", fontSize: 12 },
  botonCancelar: { backgroundColor: colors.navy700, borderWidth: 1, borderColor: colors.navy600 },
  botonCancelarTexto: { color: colors.textOnNavy, fontWeight: "700", fontSize: 12 },
  subForm: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.navy600, paddingTop: 10, gap: 8 },
  cabeza: { flexDirection: "row", alignItems: "center" },
  lineas: { marginTop: 12, gap: 6 },
  linea: { color: colors.textOnNavy, fontSize: 14 },
  lineaEtq: { color: colors.textMutedOnNavy, fontWeight: "700" },
  filaBotones: { flexDirection: "row", gap: 10, marginTop: 14 },
  botonAccion: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonCancelarForm: { backgroundColor: colors.navy700, borderWidth: 1, borderColor: colors.navy600, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  enlaceEditar: { color: colors.goldSoft, fontWeight: "700", fontSize: 12, marginTop: 10 },
});
