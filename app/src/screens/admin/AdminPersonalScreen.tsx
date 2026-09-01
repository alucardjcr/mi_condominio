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
} from "../../api/client";
import { PersonalAdmin, TipoPersonal } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";

// Ronda 18, a pedido del usuario: "el personal externo que trabaja en el
// condominio... busca la mejor manera de incorporarlos al sistema". Ficha +
// especialidad con login propio (igual que un guardia): desde acá el
// administrador/comité crea la cuenta, y por cada persona puede asignarle
// una tarea puntual o ver su historial de turno/cumplimiento.
export default function AdminPersonalScreen({ navigation }: any) {
  const { token } = useAuth();
  const [personal, setPersonal] = useState<PersonalAdmin[]>([]);
  const [tipos, setTipos] = useState<TipoPersonal[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [tipoSel, setTipoSel] = useState<OpcionSelect | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [listaPersonal, listaTipos] = await Promise.all([adminGetPersonal(token), adminGetTiposPersonal(token, CONDOMINIO_ID)]);
      setPersonal(listaPersonal);
      setTipos(listaTipos);
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
      });
      setNombre("");
      setUsuariocol("");
      setPassword("");
      setTipoSel(null);
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
      data={personal}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Nuevo personal externo</Text>
          <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
          <TextInput
            style={styles.input}
            placeholder="Usuario (para login)"
            value={usuariocol}
            onChangeText={setUsuariocol}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
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
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  botonCrear: { backgroundColor: "#2e7d32", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  cardAcciones: { flexDirection: "row", gap: 8, marginTop: 12 },
  botonAccion: { flex: 1, backgroundColor: "#2e7d32", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  botonAccionSecundario: { backgroundColor: "#eef1f5" },
  botonAccionTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
  botonAccionSecundarioTexto: { color: "#333" },
});
