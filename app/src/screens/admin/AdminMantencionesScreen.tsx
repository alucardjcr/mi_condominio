import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminCrearMantencion, adminGetElementosMantencion, adminGetMantenciones } from "../../api/client";
import { EstadoMantencionGls, Mantencion, TipoElementoMantencion } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

function colorEstado(estado: EstadoMantencionGls) {
  switch (estado) {
    case "Programada":
      return "#b0730a";
    case "En curso":
      return "#014BD2";
    case "Realizada":
      return "#1a9d5c";
    case "Cancelada":
      return "#c0392b";
    default:
      return "#555";
  }
}

const CHIPS: { label: string; estado?: EstadoMantencionGls }[] = [
  { label: "Todas" },
  { label: "Programada", estado: "Programada" },
  { label: "En curso", estado: "En curso" },
  { label: "Realizada", estado: "Realizada" },
  { label: "Cancelada", estado: "Cancelada" },
];

// Bandeja de programación de mantenciones para Administrador/Comité: crear
// (puntual, sin recurrencia automática — regla del usuario), editar (solo
// mientras Programada) y ver detalle/comprobantes. El guardia opera el día
// a día (marcar ingreso/salida de la empresa) desde su propia pantalla.
export default function AdminMantencionesScreen({ navigation }: any) {
  const { token } = useAuth();
  const [chipSel, setChipSel] = useState(0);
  const [mantenciones, setMantenciones] = useState<Mantencion[]>([]);
  const [elementos, setElementos] = useState<TipoElementoMantencion[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [elementoSel, setElementoSel] = useState<OpcionSelect | null>(null);
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [costoEstimado, setCostoEstimado] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    async (chipIndex = chipSel) => {
      if (!token) return;
      setLoading(true);
      try {
        const [listaMantenciones, listaElementos] = await Promise.all([
          adminGetMantenciones(token, { condominio_id: CONDOMINIO_ID, estado: CHIPS[chipIndex].estado }),
          adminGetElementosMantencion(token, CONDOMINIO_ID),
        ]);
        setMantenciones(listaMantenciones);
        setElementos(listaElementos);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    },
    [token, chipSel]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const handleSeleccionarChip = (index: number) => {
    setChipSel(index);
    cargar(index);
  };

  const limpiarFormulario = () => {
    setTitulo("");
    setDescripcion("");
    setElementoSel(null);
    setFechaProgramada("");
    setCostoEstimado("");
  };

  const handleCrear = async () => {
    if (!token || !titulo.trim() || !descripcion.trim() || !elementoSel || !/^\d{4}-\d{2}-\d{2}$/.test(fechaProgramada)) {
      Alert.alert(
        "Faltan datos",
        "Título, descripción, elemento de infraestructura y fecha programada (AAAA-MM-DD) son obligatorios."
      );
      return;
    }
    setGuardando(true);
    try {
      await adminCrearMantencion(token, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tipo_elemento_mantencion_id_tipoelementomantencion: elementoSel.id,
        fecha_programada: fechaProgramada,
        costo_estimado: costoEstimado.trim() ? Number(costoEstimado) : null,
        condominio_id_condominio: CONDOMINIO_ID,
      });
      limpiarFormulario();
      setFormVisible(false);
      cargar();
      Alert.alert("Mantención programada", "Se avisó a todos los residentes del condominio.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f6f8" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {CHIPS.map((c, i) => (
          <TouchableOpacity
            key={c.label}
            style={[styles.chip, chipSel === i && styles.chipActivo]}
            onPress={() => handleSeleccionarChip(i)}
          >
            <Text style={[styles.chipTexto, chipSel === i && styles.chipTextoActivo]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.botonSecundario, { flex: 1 }]}
          onPress={() => navigation.navigate("AdminElementosMantencion")}
        >
          <Text style={styles.botonSecundarioTexto}>Catálogo de infraestructura</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={mantenciones}
          keyExtractor={(item) => String(item.id_mantencion)}
          contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
          ListHeaderComponent={
            <View>
              {formVisible ? (
                <View style={styles.form}>
                  <Text style={styles.formTitulo}>Nueva mantención</Text>

                  <Text style={styles.label}>Título *</Text>
                  <TextInput
                    style={styles.input}
                    value={titulo}
                    onChangeText={setTitulo}
                    placeholder="Ej: Limpieza de techos Torre 1-3"
                  />

                  <SelectModal
                    label="Elemento de infraestructura *"
                    placeholder="Selecciona un elemento"
                    opciones={elementos.map((e) => ({ id: e.id_tipoelementomantencion, label: e.gls_tipoelementomantencion }))}
                    valorSeleccionado={elementoSel}
                    onSeleccionar={setElementoSel}
                  />

                  <Text style={styles.label}>Descripción del trabajo *</Text>
                  <TextInput
                    style={[styles.input, { height: 80 }]}
                    value={descripcion}
                    onChangeText={setDescripcion}
                    placeholder="Qué se va a hacer"
                    multiline
                  />

                  <Text style={styles.label}>Fecha programada *</Text>
                  <TextInput
                    style={styles.input}
                    value={fechaProgramada}
                    onChangeText={setFechaProgramada}
                    placeholder="AAAA-MM-DD"
                    autoCapitalize="none"
                  />

                  <Text style={styles.label}>Costo estimado (opcional, solo informativo)</Text>
                  <TextInput
                    style={styles.input}
                    value={costoEstimado}
                    onChangeText={setCostoEstimado}
                    keyboardType="numeric"
                  />

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <TouchableOpacity style={[styles.botonCrear, { flex: 1 }]} onPress={handleCrear} disabled={guardando}>
                      <Text style={styles.botonCrearTexto}>{guardando ? "Guardando..." : "Programar"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.botonCrear, { flex: 1, backgroundColor: "#999" }]}
                      onPress={() => {
                        limpiarFormulario();
                        setFormVisible(false);
                      }}
                    >
                      <Text style={styles.botonCrearTexto}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.botonCrear} onPress={() => setFormVisible(true)}>
                  <Text style={styles.botonCrearTexto}>+ Programar mantención</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={<Text style={styles.vacio}>No hay mantenciones en ese estado.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("AdminMantencionDetalle", { id: item.id_mantencion })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.nombre}>{item.titulo}</Text>
                <Text style={[styles.estado, { color: colorEstado(item.gls_estadomantencion) }]}>
                  {item.gls_estadomantencion}
                </Text>
              </View>
              <Text style={styles.detalleTexto}>{item.gls_tipoelementomantencion}</Text>
              <Text style={styles.detalleTexto}>Programada: {item.fecha_programada}</Text>
              {item.costo_estimado != null && (
                <Text style={styles.detalleTexto}>Costo estimado: {formatearMonto(item.costo_estimado)}</Text>
              )}
              {item.empresa_nombre && <Text style={styles.detalleTexto}>Empresa: {item.empresa_nombre}</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  chips: { flexGrow: 0, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: "#ddd", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipActivo: { backgroundColor: "#333", borderColor: "#333" },
  chipTexto: { fontSize: 13, fontWeight: "600", color: "#333" },
  chipTextoActivo: { color: "#fff" },
  botonSecundario: { backgroundColor: "#eef1f5", borderRadius: 10, padding: 12, alignItems: "center" },
  botonSecundarioTexto: { color: "#333", fontWeight: "700", fontSize: 13 },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, marginTop: 4 },
  botonCrear: { backgroundColor: "#795548", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#eee" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nombre: { fontSize: 16, fontWeight: "700", flex: 1 },
  estado: { fontSize: 12, fontWeight: "800" },
  detalleTexto: { color: "#555", marginTop: 4, fontSize: 13 },
});
