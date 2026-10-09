import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  adminActualizarPersonal,
  adminCrearPersonal,
  adminGetPersonal,
  adminGetTiposPersonal,
  adminGetJefesDeArea,
} from "../../api/client";
import { PersonalAdmin, TipoPersonal, JefeDeArea } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";
import { colors } from "../../theme/theme";

// Ronda 18, a pedido del usuario: "el personal externo que trabaja en el
// condominio... busca la mejor manera de incorporarlos al sistema". Ficha +
// especialidad con login propio (igual que un guardia): desde acá el
// administrador/comité crea la cuenta, y por cada persona puede asignarle
// una tarea puntual o ver su historial de turno/cumplimiento.
export default function AdminPersonalScreen({ navigation }: any) {
  const { token } = useAuth();
  const [personal, setPersonal] = useState<PersonalAdmin[]>([]);
  const [tipos, setTipos] = useState<TipoPersonal[]>([]);
  const [jefes, setJefes] = useState<JefeDeArea[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [tipoSel, setTipoSel] = useState<OpcionSelect | null>(null);
  const [jefeSel, setJefeSel] = useState<OpcionSelect | null>(null);
  const [esInterno, setEsInterno] = useState<boolean | null>(null);
  const [empresaExterna, setEmpresaExterna] = useState("");
  const [creando, setCreando] = useState(false);

  // Ronda 68, a pedido explícito del usuario: reasignar el jefe de un
  // trabajador ya existente, directo desde su tarjeta.
  const [editandoJefeDeId, setEditandoJefeDeId] = useState<number | null>(null);
  const [jefeEditarSel, setJefeEditarSel] = useState<OpcionSelect | null>(null);
  const [guardandoJefe, setGuardandoJefe] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [listaPersonal, listaTipos, listaJefes] = await Promise.all([
        adminGetPersonal(token),
        adminGetTiposPersonal(token, CONDOMINIO_ID),
        adminGetJefesDeArea(token),
      ]);
      setPersonal(listaPersonal);
      setTipos(listaTipos);
      setJefes(listaJefes);
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
    if (!token || !nombre || !usuariocol || !password) {
      Alert.alert("Faltan datos", "Nombre, usuario y contraseña son obligatorios.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearPersonal(token, {
        nombre_usuario: nombre,
        usuariocol,
        password,
        tipo_personal_id_tipopersonal: tipoSel ? Number(tipoSel.id) : undefined,
        condominio_id_condominio: CONDOMINIO_ID,
        jefe_id_usuario: jefeSel ? Number(jefeSel.id) : undefined,
        flg_interno: esInterno ?? undefined,
        empresa_externa: esInterno === false ? empresaExterna.trim() || undefined : undefined,
      });
      setNombre("");
      setUsuariocol("");
      setPassword("");
      setTipoSel(null);
      setJefeSel(null);
      setEsInterno(null);
      setEmpresaExterna("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (p: PersonalAdmin) => {
    if (!token) return;
    try {
      await adminActualizarPersonal(token, p.id_usuario, { flg_vigencia: p.flg_vigencia ? 0 : 1 });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleAbrirEdicionJefe = (p: PersonalAdmin) => {
    setEditandoJefeDeId(p.id_usuario);
    setJefeEditarSel(p.jefe_id_usuario && p.jefe_nombre ? { id: p.jefe_id_usuario, label: p.jefe_nombre } : null);
  };

  const handleGuardarJefe = async (id: number) => {
    if (!token) return;
    setGuardandoJefe(true);
    try {
      await adminActualizarPersonal(token, id, { jefe_id_usuario: jefeEditarSel ? Number(jefeEditarSel.id) : null });
      setEditandoJefeDeId(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoJefe(false);
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
    <FlatList
      style={styles.container}
      data={personal}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Nuevo personal externo</Text>
          <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={colors.textMutedOnNavy} value={nombre} onChangeText={setNombre} />
          <TextInput
            style={styles.input}
            placeholder="Usuario (para login)"
            placeholderTextColor={colors.textMutedOnNavy}
            value={usuariocol}
            onChangeText={setUsuariocol}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.textMutedOnNavy}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <SelectModal
            label="Especialidad"
            placeholder="Selecciona (opcional)"
            opciones={tipos.map((t) => ({ id: t.id_tipopersonal, label: t.gls_tipopersonal }))}
            valorSeleccionado={tipoSel}
            onSeleccionar={setTipoSel}
          />
          <SelectModal
            label="Reporta a (opcional)"
            placeholder={jefes.length ? "Selecciona un jefe, o deja vacío" : "No hay jefes de área creados todavía"}
            opciones={jefes.map((j) => ({ id: j.id_usuario, label: `${j.nombre_usuario} (${j.rol})` }))}
            valorSeleccionado={jefeSel}
            onSeleccionar={setJefeSel}
            disabled={jefes.length === 0}
          />

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
              placeholder="Nombre de la empresa (ej: Jardines del Sur)"
              placeholderTextColor={colors.textMutedOnNavy}
              value={empresaExterna}
              onChangeText={setEmpresaExterna}
            />
          )}

          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear"}</Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay personal externo registrado.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>{item.nombre_usuario}</Text>
              <Text style={styles.detalle}>
                usuario: {item.usuariocol} · {item.gls_tipopersonal ?? "Sin especialidad"} ·{" "}
                {item.flg_vigencia ? "Activo" : "Inactivo"}
                {item.turno_abierto ? " · En turno ahora" : ""}
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
          <View style={styles.cardAcciones}>
            <TouchableOpacity
              style={styles.botonAccion}
              onPress={() => navigation.navigate("AdminAsignarTarea", { idUsuario: item.id_usuario, nombre: item.nombre_usuario })}
            >
              <Text style={styles.botonAccionTexto}>Asignar tarea</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonAccion, styles.botonAccionSecundario]}
              onPress={() => navigation.navigate("AdminPersonalDetalle", { idUsuario: item.id_usuario, nombre: item.nombre_usuario })}
            >
              <Text style={[styles.botonAccionTexto, styles.botonAccionSecundarioTexto]}>Ver historial</Text>
            </TouchableOpacity>
          </View>

          {editandoJefeDeId === item.id_usuario ? (
            <View style={styles.subForm}>
              <SelectModal
                label="Reporta a"
                placeholder="Selecciona un jefe, o deja vacío para quitar"
                opciones={jefes.map((j) => ({ id: j.id_usuario, label: `${j.nombre_usuario} (${j.rol})` }))}
                valorSeleccionado={jefeEditarSel}
                onSeleccionar={setJefeEditarSel}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.botonAccion, { flex: 1 }]}
                  onPress={() => handleGuardarJefe(item.id_usuario)}
                  disabled={guardandoJefe}
                >
                  <Text style={styles.botonAccionTexto}>{guardandoJefe ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonAccion, styles.botonAccionSecundario, { flex: 1 }]}
                  onPress={() => setEditandoJefeDeId(null)}
                >
                  <Text style={[styles.botonAccionTexto, styles.botonAccionSecundarioTexto]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => handleAbrirEdicionJefe(item)}>
              <Text style={styles.enlaceJefe}>
                {item.jefe_nombre ? `👤 Reporta a: ${item.jefe_nombre}` : "👤 Sin jefe asignado — toca para asignar"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  form: { backgroundColor: colors.navy800, borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: colors.textOnNavy },
  label: { fontSize: 13, fontWeight: "600", color: colors.textOnNavy, marginBottom: 6 },
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
  botonCrear: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  botonCrearTexto: { color: colors.botonNaranjaTexto, fontWeight: "800" },
  vacio: { textAlign: "center", color: colors.textMutedOnNavy, marginTop: 20 },
  card: {
    backgroundColor: colors.navy800,
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700", color: colors.textOnNavy },
  detalle: { color: colors.textMutedOnNavy, marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  cardAcciones: { flexDirection: "row", gap: 8, marginTop: 12 },
  botonAccion: { flex: 1, backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonAccionSecundario: { backgroundColor: colors.navy700, borderColor: colors.navy600 },
  botonAccionTexto: { color: colors.botonNaranjaTexto, fontWeight: "800", fontSize: 13 },
  botonAccionSecundarioTexto: { color: colors.textOnNavy },
  subForm: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.navy600, paddingTop: 12 },
  enlaceJefe: { color: colors.goldSoft, fontWeight: "700", fontSize: 12, marginTop: 12 },
});
