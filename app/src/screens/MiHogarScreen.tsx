import React, { useCallback, useEffect, useState } from "react";
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
import { actualizarResidenteDelHogar, crearResidenteDelHogar, getMisResidentesDelHogar, getTiposResidente } from "../api/client";
import { ResidenteAdmin, TipoResidente } from "../api/types";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";

// Autoadministración del hogar por el dueño del depto (ronda 15, a pedido
// explícito del usuario): solo se llega a esta pantalla si guardia
// .esPropietario es true (ver HomeScreen). El dueño conserva este permiso
// viva o no en el depto — puede tenerlo arrendado y administrar a los
// residentes a distancia. El backend (/mi-depto/*) además valida todo esto
// por su cuenta, así que esta pantalla nunca es la única barrera.
export default function MiHogarScreen() {
  const { token, guardia } = useAuth();
  const [residentes, setResidentes] = useState<ResidenteAdmin[]>([]);
  const [tiposResidente, setTiposResidente] = useState<TipoResidente[]>([]);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState("");
  const [tipoResidenteSel, setTipoResidenteSel] = useState<OpcionSelect | null>(null);
  const [creando, setCreando] = useState(false);

  // Ronda 36, a pedido explícito del usuario: datos adicionales opcionales.
  const [rutNuevo, setRutNuevo] = useState("");
  const [fechaNacimientoNuevo, setFechaNacimientoNuevo] = useState("");
  const [profesionNuevo, setProfesionNuevo] = useState("");

  const [perfilEnEdicion, setPerfilEnEdicion] = useState<number | null>(null);
  const [rutEditar, setRutEditar] = useState("");
  const [fechaNacimientoEditar, setFechaNacimientoEditar] = useState("");
  const [profesionEditar, setProfesionEditar] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [tipoEnEdicion, setTipoEnEdicion] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setResidentes(await getMisResidentesDelHogar(token));
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
    getTiposResidente(token).then(setTiposResidente).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const handleCrear = async () => {
    if (!token || !nombre.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre de la persona que vive en tu depto.");
      return;
    }
    setCreando(true);
    try {
      await crearResidenteDelHogar(token, {
        nombre_usuario: nombre.trim(),
        tipo_residente_id_tiporesidente: tipoResidenteSel ? Number(tipoResidenteSel.id) : undefined,
        rut: rutNuevo.trim() || undefined,
        fecha_nacimiento: fechaNacimientoNuevo.trim() || undefined,
        profesion: profesionNuevo.trim() || undefined,
      });
      setNombre("");
      setTipoResidenteSel(null);
      setRutNuevo("");
      setFechaNacimientoNuevo("");
      setProfesionNuevo("");
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
    setFechaNacimientoEditar(r.fecha_nacimiento ?? "");
    setProfesionEditar(r.profesion ?? "");
  };

  const handleGuardarPerfil = async (id: number) => {
    if (!token) return;
    setGuardandoPerfil(true);
    try {
      await actualizarResidenteDelHogar(token, id, {
        rut: rutEditar.trim() || null,
        fecha_nacimiento: fechaNacimientoEditar.trim() || null,
        profesion: profesionEditar.trim() || null,
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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={residentes}
      keyExtractor={(item) => String(item.id_usuario)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.intro}>
            Acá administras quién vive en {guardia?.nombre_torre ? `${guardia.nombre_torre} · Depto ${guardia.numero_unidad}` : "tu depto"},
            aunque tú no vivas ahí. Puedes agregar personas, cambiar a qué título viven ahí, o darlas de baja.
          </Text>
          <View style={styles.form}>
            <Text style={styles.formTitulo}>Agregar persona</Text>
            <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
            <SelectModal
              label="Tipo de residente"
              placeholder="Ej: Arrendatario, pareja, roomie..."
              opciones={tiposResidente.map((t) => ({ id: t.id_tiporesidente, label: t.gls_tiporesidente }))}
              valorSeleccionado={tipoResidenteSel}
              onSeleccionar={setTipoResidenteSel}
            />
            <TextInput
              style={styles.input}
              placeholder="RUT (opcional)"
              value={rutNuevo}
              onChangeText={setRutNuevo}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Fecha de nacimiento AAAA-MM-DD (opcional)"
              value={fechaNacimientoNuevo}
              onChangeText={setFechaNacimientoNuevo}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={styles.input}
              placeholder="Profesión (opcional)"
              value={profesionNuevo}
              onChangeText={setProfesionNuevo}
            />
            <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
              <Text style={styles.botonCrearTexto}>{creando ? "Agregando..." : "Agregar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no tienes a nadie registrado en tu depto.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>
                {item.nombre_usuario}
                {item.id_usuario === guardia?.id_usuario ? " (tú)" : ""}
              </Text>
              <Text style={styles.detalle}>{item.flg_vigencia ? "Activo" : "Inactivo"}</Text>
              {!!item.flg_propietario && <Text style={styles.propietarioTexto}>🏠 Dueño del depto</Text>}
              {tipoEnEdicion !== item.id_usuario && (
                <TouchableOpacity onPress={() => setTipoEnEdicion(item.id_usuario)}>
                  <Text style={styles.tipoTexto}>🪪 {item.gls_tiporesidente ?? "Sin tipo de residente asignado"}</Text>
                </TouchableOpacity>
              )}
            </View>
            {item.id_usuario !== guardia?.id_usuario && (
              <TouchableOpacity
                style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
                onPress={() => handleToggle(item)}
              >
                <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Quitar" : "Activar"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {tipoEnEdicion === item.id_usuario && (
            <View style={styles.tipoForm}>
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
            <View style={styles.tipoForm}>
              <TextInput
                style={styles.input}
                placeholder="RUT (opcional)"
                value={rutEditar}
                onChangeText={setRutEditar}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.input}
                placeholder="Fecha de nacimiento AAAA-MM-DD (opcional)"
                value={fechaNacimientoEditar}
                onChangeText={setFechaNacimientoEditar}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={styles.input}
                placeholder="Profesión (opcional)"
                value={profesionEditar}
                onChangeText={setProfesionEditar}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.botonToggle, styles.botonActivar, { flex: 1 }]}
                  onPress={() => handleGuardarPerfil(item.id_usuario)}
                  disabled={guardandoPerfil}
                >
                  <Text style={styles.botonToggleTexto}>{guardandoPerfil ? "Guardando..." : "Guardar"}</Text>
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
            <TouchableOpacity onPress={() => handleAbrirPerfil(item)}>
              <Text style={styles.tipoTexto}>
                {item.rut || item.fecha_nacimiento || item.profesion
                  ? `RUT ${item.rut ?? "—"} · Nac. ${item.fecha_nacimiento ?? "—"} · ${item.profesion ?? "Sin profesión"}`
                  : "+ Agregar RUT / fecha de nacimiento / profesión"}
              </Text>
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
  intro: { color: "#666", fontSize: 13, marginBottom: 12, lineHeight: 18 },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  propietarioTexto: { color: "#014BD2", marginTop: 4, fontSize: 12, fontWeight: "600" },
  tipoTexto: { color: "#b0730a", marginTop: 4, fontSize: 12, fontWeight: "600" },
  enlaceCerrar: { color: "#014BD2", fontSize: 12, fontWeight: "600" },
  tipoForm: { marginTop: 10 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
