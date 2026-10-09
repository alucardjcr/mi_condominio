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
    if (esInterno === false && !empresaExterna.trim()) {
      Alert.alert("Falta la empresa", "Si el guardia es externo, indica el nombre de la empresa a la que pertenece.");
      return;
    }
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
      setFechaNac("");
      setOs10(null);
      setFoto(null);
      setEsInterno(null);
      setEmpresaExterna("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
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
        fecha_nacimiento: editFechaNac || null,
        os10_vigente: editOs10,
        foto: editFoto ?? undefined,
        flg_interno: editInterno,
        empresa_externa: editInterno === false ? editEmpresa.trim() || null : null,
      });
      setEditandoId(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoInterno(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={guardias}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
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
              placeholder="12345678-9 (opcional)"
              value={rut}
              onChangeText={setRut}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Nombres</Text>
            <TextInput style={styles.input} placeholder="Nombres" value={nombres} onChangeText={setNombres} />
            <Text style={styles.label}>Apellido paterno</Text>
            <TextInput style={styles.input} placeholder="Apellido paterno" value={apPaterno} onChangeText={setApPaterno} />
            <Text style={styles.label}>Apellido materno (opcional)</Text>
            <TextInput style={styles.input} placeholder="Apellido materno" value={apMaterno} onChangeText={setApMaterno} />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              placeholder="+56 9 1234 5678 (opcional)"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
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
                placeholder="Nombre de la empresa a la que pertenece *"
                value={empresaExterna}
                onChangeText={setEmpresaExterna}
              />
            )}
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Usuario (para entrar a la app)</Text>
            <TextInput
              style={styles.input}
              placeholder="Usuario"
              value={usuariocol}
              onChangeText={setUsuariocol}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.campo}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear guardia"}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {fuenteImagenPrivada(item.foto_url, token) ? (
              <Image source={fuenteImagenPrivada(item.foto_url, token)!} style={styles.avatar} />
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
              <Text style={styles.detalle}>
                {item.rut ? `RUT: ${item.rut}` : "RUT: sin registrar"} ·{" "}
                {item.telefono ? `Tel: ${item.telefono}` : "Tel: sin registrar"}
              </Text>
              <Text style={styles.detalle}>
                {item.fecha_nacimiento
                  ? `Nac.: ${item.fecha_nacimiento.split("-").reverse().join("/")}${
                      calcularEdad(item.fecha_nacimiento) !== null ? ` (${calcularEdad(item.fecha_nacimiento)} años)` : ""
                    }`
                  : "Nac.: sin registrar"}
              </Text>
              <Text style={styles.detalle}>
                Curso OS10:{" "}
                {item.os10_vigente === null || item.os10_vigente === undefined
                  ? "sin definir"
                  : item.os10_vigente
                  ? "Vigente"
                  : "No vigente"}
              </Text>
              <Text style={styles.detalle}>
                {item.flg_interno === null || item.flg_interno === undefined
                  ? "Interno/externo: sin definir"
                  : item.flg_interno
                  ? "Interno"
                  : `Externo${item.empresa_externa ? ` — ${item.empresa_externa}` : ""}`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
              onPress={() => handleToggle(item)}
            >
              <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
            </TouchableOpacity>
          </View>

          {editandoId === item.id_usuario ? (
            <View style={styles.subForm}>
              <Text style={styles.detalle}>Nombre (déjalo vacío si no quieres cambiarlo):</Text>
              <TextInput style={styles.input} placeholder="Nombres" value={editNombres} onChangeText={setEditNombres} />
              <TextInput style={styles.input} placeholder="Apellido paterno" value={editApPaterno} onChangeText={setEditApPaterno} />
              <TextInput style={styles.input} placeholder="Apellido materno (opcional)" value={editApMaterno} onChangeText={setEditApMaterno} />
              <DateField label="Fecha de nacimiento" value={editFechaNac} onChange={setEditFechaNac} maximumDate={new Date()} opcional />
              <View style={styles.filaChips}>
                <TouchableOpacity style={[styles.chip, editOs10 === true && styles.chipActivo]} onPress={() => setEditOs10(true)}>
                  <Text style={[styles.chipTexto, editOs10 === true && styles.chipTextoActivo]}>OS10 vigente</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, editOs10 === false && styles.chipActivo]} onPress={() => setEditOs10(false)}>
                  <Text style={[styles.chipTexto, editOs10 === false && styles.chipTextoActivo]}>OS10 no vigente</Text>
                </TouchableOpacity>
              </View>
              <FotoCapture label="Cambiar foto (solo Administrador/Comité)" value={editFoto} onChange={setEditFoto} recorteCuadrado />
              <TextInput style={styles.input} placeholder="RUT" value={editRut} onChangeText={setEditRut} autoCapitalize="characters" />
              <TextInput
                style={styles.input}
                placeholder="Teléfono"
                value={editTelefono}
                onChangeText={setEditTelefono}
                keyboardType="phone-pad"
              />
              <View style={styles.filaChips}>
                <TouchableOpacity style={[styles.chip, editInterno === true && styles.chipActivo]} onPress={() => setEditInterno(true)}>
                  <Text style={[styles.chipTexto, editInterno === true && styles.chipTextoActivo]}>Interno</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, editInterno === false && styles.chipActivo]} onPress={() => setEditInterno(false)}>
                  <Text style={[styles.chipTexto, editInterno === false && styles.chipTextoActivo]}>Externo</Text>
                </TouchableOpacity>
              </View>
              {editInterno === false && (
                <TextInput style={styles.input} placeholder="Nombre de la empresa a la que pertenece *" value={editEmpresa} onChangeText={setEditEmpresa} />
              )}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarInterno(item.id_usuario)}
                  disabled={guardandoInterno}
                >
                  <Text style={styles.botonToggleTexto}>{guardandoInterno ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]} onPress={() => setEditandoId(null)}>
                  <Text style={styles.botonToggleTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => handleAbrirEdicionInterno(item)}>
              <Text style={styles.enlaceEditar}>✏️ Editar datos</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  filaChips: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1.5, borderColor: "#ddd", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActivo: { borderColor: "#014BD2", backgroundColor: "#EEF2FF" },
  chipTexto: { color: "#666", fontWeight: "600", fontSize: 13 },
  chipTextoActivo: { color: "#014BD2" },
  campo: { marginBottom: 18 },
  fotoVacia: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6e8ee",
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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#e6e8ee", marginRight: 12, overflow: "hidden" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  subForm: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10, gap: 8 },
  enlaceEditar: { color: "#014BD2", fontWeight: "700", fontSize: 12, marginTop: 10 },
});
