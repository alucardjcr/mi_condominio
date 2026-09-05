import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminActualizarJefeDeArea, adminCrearJefeDeArea, adminGetJefesDeArea } from "../../api/client";
import { JefeDeArea, RolJefeDeArea } from "../../api/types";
import { useAuth } from "../../context/AuthContext";

// Ronda 68, a pedido explícito del usuario: el Administrador arma su
// condominio según cómo se organice — puede crear un Jefe para
// supervisar guardias externos, aseo o jardinería, o no crear ninguno y
// supervisar a esos trabajadores él mismo directo (queda a su criterio).
// Antes de esta ronda no existía NINGUNA forma de crear una cuenta
// JefeGuardias desde la app (solo se podía sembrar por script) — esta
// pantalla lo resuelve también, junto con los 2 roles nuevos.
const OPCIONES_ROL: { valor: RolJefeDeArea; label: string; icono: string }[] = [
  { valor: "JefeGuardias", label: "Jefe de Guardias", icono: "🛡️" },
  { valor: "JefeAseo", label: "Jefe de Aseo", icono: "🧹" },
  { valor: "JefeJardineria", label: "Jefe de Jardinería", icono: "🌳" },
];

export default function AdminJefesAreaScreen() {
  const { token } = useAuth();
  const [jefes, setJefes] = useState<JefeDeArea[]>([]);
  const [loading, setLoading] = useState(true);

  const [rolSel, setRolSel] = useState<RolJefeDeArea | null>(null);
  const [nombre, setNombre] = useState("");
  const [usuariocol, setUsuariocol] = useState("");
  const [password, setPassword] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setJefes(await adminGetJefesDeArea(token));
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
    if (!token || !rolSel || !nombre.trim() || !usuariocol.trim() || !password) {
      Alert.alert("Faltan datos", "Elige el tipo de jefe, y completa nombre, usuario y contraseña.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearJefeDeArea(token, { rol: rolSel, nombre_usuario: nombre.trim(), usuariocol: usuariocol.trim(), password });
      setRolSel(null);
      setNombre("");
      setUsuariocol("");
      setPassword("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (j: JefeDeArea) => {
    if (!token) return;
    try {
      await adminActualizarJefeDeArea(token, j.id_usuario, { flg_vigencia: j.flg_vigencia ? 0 : 1 });
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
      data={jefes}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View style={styles.form}>
          <Text style={styles.formTitulo}>Nuevo jefe de área</Text>
          <Text style={styles.ayuda}>
            Solo hace falta si el condominio necesita un supervisor para guardias externos, aseo o jardinería. Si
            no, esos trabajadores quedan bajo tu supervisión directa.
          </Text>

          <View style={styles.filaRoles}>
            {OPCIONES_ROL.map((opcion) => (
              <TouchableOpacity
                key={opcion.valor}
                style={[styles.chipRol, rolSel === opcion.valor && styles.chipRolActivo]}
                onPress={() => setRolSel(opcion.valor)}
              >
                <Text style={[styles.chipRolTexto, rolSel === opcion.valor && styles.chipRolTextoActivo]}>
                  {opcion.icono} {opcion.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={styles.input} placeholder="Nombre completo" value={nombre} onChangeText={setNombre} />
          <TextInput
            style={styles.input}
            placeholder="Usuario (para login)"
            value={usuariocol}
            onChangeText={setUsuariocol}
            autoCapitalize="none"
          />
          <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
            <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear jefe"}</Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay ningún jefe de área creado.</Text>}
      renderItem={({ item }) => {
        const opcion = OPCIONES_ROL.find((o) => o.valor === item.rol);
        return (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>
                {opcion?.icono} {item.nombre_usuario}
              </Text>
              <Text style={styles.detalle}>
                usuario: {item.usuariocol} · {opcion?.label ?? item.rol} · {item.flg_vigencia ? "Activo" : "Inactivo"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
              onPress={() => handleToggle(item)}
            >
              <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  ayuda: { color: "#888", fontSize: 12, marginBottom: 12, lineHeight: 17 },
  filaRoles: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chipRol: { borderWidth: 1.5, borderColor: "#ddd", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipRolActivo: { borderColor: "#014BD2", backgroundColor: "#EEF2FF" },
  chipRolTexto: { color: "#666", fontWeight: "600", fontSize: 12 },
  chipRolTextoActivo: { color: "#014BD2" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  botonCrear: { backgroundColor: "#2e7d32", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
