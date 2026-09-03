import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { jefeActualizarGuardia, jefeCrearGuardia, jefeGetGuardias } from "../../api/client";
import { Guardia } from "../../api/types";
import { useAuth } from "../../context/AuthContext";

// Ronda 20: CRUD de guardias para el rol JEFE_GUARDIAS — misma lógica que
// AdminGuardiasScreen (reutiliza tal cual los datos de listarGuardias/
// crearGuardia/actualizarGuardia en el backend), solo que por las rutas
// propias de este rol (/jefe-guardias/guardias), que es una de las dos
// únicas cosas a las que este perfil tiene acceso.
export default function JefeGuardiasGuardiasScreen() {
  const { token } = useAuth();
  const [guardias, setGuardias] = useState<Guardia[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [rutNuevo, setRutNuevo] = useState("");
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  // Ronda 53, a pedido explícito del usuario, con referencia visual: RUT y
  // teléfono, editables por guardia ya existente.
  const [perfilEnEdicion, setPerfilEnEdicion] = useState<number | null>(null);
  const [rutEditar, setRutEditar] = useState("");
  const [telefonoEditar, setTelefonoEditar] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setGuardias(await jefeGetGuardias(token));
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
      await jefeCrearGuardia(token, {
        nombre_usuario: nombre,
        usuariocol,
        password,
        rut: rutNuevo.trim() || undefined,
        telefono: telefonoNuevo.trim() || undefined,
      });
      setNombre("");
      setUsuariocol("");
      setPassword("");
      setRutNuevo("");
      setTelefonoNuevo("");
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
      await jefeActualizarGuardia(token, g.id_usuario, { flg_vigencia: g.flg_vigencia ? 0 : 1 });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleAbrirPerfil = (g: Guardia) => {
    setPerfilEnEdicion(g.id_usuario);
    setRutEditar(g.rut ?? "");
    setTelefonoEditar(g.telefono ?? "");
  };

  const handleGuardarPerfil = async (id: number) => {
    if (!token) return;
    setGuardandoPerfil(true);
    try {
      await jefeActualizarGuardia(token, id, { rut: rutEditar.trim() || undefined, telefono: telefonoEditar.trim() || undefined });
      setPerfilEnEdicion(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoPerfil(false);
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
          <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
          <TextInput style={styles.input} placeholder="RUT (opcional)" value={rutNuevo} onChangeText={setRutNuevo} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Teléfono (opcional)" value={telefonoNuevo} onChangeText={setTelefonoNuevo} keyboardType="phone-pad" />
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
              {item.rut && <Text style={styles.detalle}>RUT: {item.rut}</Text>}
              {item.telefono && <Text style={styles.detalle}>Tel: {item.telefono}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
              onPress={() => handleToggle(item)}
            >
              <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
            </TouchableOpacity>
          </View>

          {perfilEnEdicion === item.id_usuario ? (
            <View style={styles.subForm}>
              <TextInput style={styles.input} placeholder="RUT" value={rutEditar} onChangeText={setRutEditar} autoCapitalize="characters" />
              <TextInput style={styles.input} placeholder="Teléfono" value={telefonoEditar} onChangeText={setTelefonoEditar} keyboardType="phone-pad" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarPerfil(item.id_usuario)}
                  disabled={guardandoPerfil}
                >
                  <Text style={styles.botonToggleTexto}>{guardandoPerfil ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botonToggle, { backgroundColor: "#999", flex: 1 }]} onPress={() => setPerfilEnEdicion(null)}>
                  <Text style={styles.botonToggleTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => handleAbrirPerfil(item)}>
              <Text style={styles.enlaceEditarPerfil}>✏️ Editar RUT / teléfono</Text>
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
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 10 },
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center" },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  subForm: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10, gap: 8 },
  enlaceEditarPerfil: { color: "#014BD2", fontWeight: "700", fontSize: 12, marginTop: 10 },
});
