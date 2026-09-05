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
import { adminActualizarGuardia, adminCrearGuardia, adminGetGuardias } from "../../api/client";
import { Guardia } from "../../api/types";
import { useAuth } from "../../context/AuthContext";

// Ronda 69, a pedido explícito del usuario: "¿tenemos si los guardias o
// conserjes... son internos?" — antes no existía este dato. `esInterno`
// usa null como "sin definir" a propósito (no todo guardia cargado antes
// de esta ronda tiene por qué tener esto contestado todavía).
export default function AdminGuardiasScreen() {
  const { token } = useAuth();
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [esInterno, setEsInterno] = useState<boolean | null>(null);
  const [empresaExterna, setEmpresaExterna] = useState("");
  const [creando, setCreando] = useState(false);

  // Edición de interno/externo de un guardia ya existente, inline.
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editInterno, setEditInterno] = useState<boolean | null>(null);
  const [editEmpresa, setEditEmpresa] = useState("");
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
    if (!token || !nombre || !usuariocol || !password) {
      Alert.alert("Faltan datos", "Nombre, usuario y contraseña son obligatorios.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearGuardia(token, {
        nombre_usuario: nombre,
        usuariocol,
        password,
        flg_interno: esInterno ?? undefined,
        empresa_externa: esInterno === false ? empresaExterna.trim() || undefined : undefined,
      });
      setNombre("");
      setUsuariocol("");
      setPassword("");
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
  };

  const handleGuardarInterno = async (id: number) => {
    if (!token) return;
    setGuardandoInterno(true);
    try {
      await adminActualizarGuardia(token, id, {
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
              placeholder="Nombre de la empresa (ej: Vigilancia Segura SPA)"
              value={empresaExterna}
              onChangeText={setEmpresaExterna}
            />
          )}

          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear guardia"}</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>{item.nombre_usuario}</Text>
              <Text style={styles.detalle}>
                usuario: {item.usuariocol} · {item.flg_vigencia ? "Activo" : "Inactivo"}
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
              <View style={styles.filaChips}>
                <TouchableOpacity style={[styles.chip, editInterno === true && styles.chipActivo]} onPress={() => setEditInterno(true)}>
                  <Text style={[styles.chipTexto, editInterno === true && styles.chipTextoActivo]}>Interno</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, editInterno === false && styles.chipActivo]} onPress={() => setEditInterno(false)}>
                  <Text style={[styles.chipTexto, editInterno === false && styles.chipTextoActivo]}>Externo</Text>
                </TouchableOpacity>
              </View>
              {editInterno === false && (
                <TextInput style={styles.input} placeholder="Nombre de la empresa" value={editEmpresa} onChangeText={setEditEmpresa} />
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
              <Text style={styles.enlaceEditar}>✏️ Editar interno/externo</Text>
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
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center" },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  subForm: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10, gap: 8 },
  enlaceEditar: { color: "#014BD2", fontWeight: "700", fontSize: 12, marginTop: 10 },
});
