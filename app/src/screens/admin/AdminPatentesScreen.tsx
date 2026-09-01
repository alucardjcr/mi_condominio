import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  adminActualizarPatente,
  adminCrearPatente,
  adminGetPatentes,
  getTiposTenenciaPatente,
  getTorres,
  getUnidadesPorTorre,
} from "../../api/client";
import { PatenteAdmin, TipoTenenciaPatente, Torre, Unidad } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";

export default function AdminPatentesScreen() {
  const { token } = useAuth();
  const [patentes, setPatentes] = useState<PatenteAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [torres, setTorres] = useState<Torre[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [tenencias, setTenencias] = useState<TipoTenenciaPatente[]>([]);
  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [unidadSel, setUnidadSel] = useState<OpcionSelect | null>(null);
  const [tenenciaSel, setTenenciaSel] = useState<OpcionSelect | null>(null);
  const [patente, setPatente] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setPatentes(await adminGetPatentes(token));
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
    getTorres(token, CONDOMINIO_ID).then(setTorres).catch((e) => Alert.alert("Error", e.message));
    getTiposTenenciaPatente(token).then(setTenencias).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const handleSeleccionarTorre = async (opcion: OpcionSelect) => {
    setTorreSel(opcion);
    setUnidadSel(null);
    setUnidades([]);
    if (!token) return;
    setUnidades(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleCrear = async () => {
    if (!token || !patente || !unidadSel || !tenenciaSel) {
      Alert.alert("Faltan datos", "Patente, torre/depto y tipo de tenencia son obligatorios.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearPatente(token, {
        patente,
        unidad_id_unidad: unidadSel.id,
        tipo_tenencia_id_tipotenencia: tenenciaSel.id,
      });
      setPatente("");
      setTorreSel(null);
      setUnidadSel(null);
      setTenenciaSel(null);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (p: PatenteAdmin) => {
    if (!token) return;
    try {
      await adminActualizarPatente(token, p.id_patente, { flg_vigencia: p.flg_vigencia ? 0 : 1 });
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const patentesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return patentes;
    const q = busqueda.trim().toLowerCase();
    return patentes.filter((p) => p.patente.toLowerCase().includes(q) || p.numero_unidad.includes(q));
  }, [patentes, busqueda]);

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
      data={patentesFiltradas}
      keyExtractor={(item) => String(item.id_patente)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View>
          <View style={styles.form}>
            <Text style={styles.formTitulo}>Nueva patente</Text>
            <TextInput
              style={styles.input}
              placeholder="Patente"
              value={patente}
              onChangeText={setPatente}
              autoCapitalize="characters"
            />
            <SelectModal
              label="Tipo de tenencia"
              placeholder="Propietario / Arrendatario"
              opciones={tenencias.map((t) => ({ id: t.id_tipotenencia, label: t.gls_tipotenencia }))}
              valorSeleccionado={tenenciaSel}
              onSeleccionar={setTenenciaSel}
            />
            <SelectModal
              label="Torre"
              placeholder="Selecciona una torre"
              opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
              valorSeleccionado={torreSel}
              onSeleccionar={handleSeleccionarTorre}
            />
            <SelectModal
              label="Depto"
              placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
              opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
              valorSeleccionado={unidadSel}
              onSeleccionar={setUnidadSel}
              disabled={!torreSel}
            />
            <TouchableOpacity style={styles.botonCrear} onPress={handleCrear} disabled={creando}>
              <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear patente"}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.buscador}
            placeholder="Buscar por patente o depto..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombreItem}>{item.patente}</Text>
            <Text style={styles.detalle}>
              {item.gls_tipotenencia} · {item.nombre_torre} {item.numero_unidad} ·{" "}
              {item.flg_vigencia ? "Activa" : "Inactiva"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
            onPress={() => handleToggle(item)}
          >
            <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  buscador: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
