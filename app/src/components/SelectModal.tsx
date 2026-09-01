import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface OpcionSelect {
  id: number;
  label: string;
}

interface Props {
  label: string;
  placeholder: string;
  opciones: OpcionSelect[];
  valorSeleccionado: OpcionSelect | null;
  onSeleccionar: (opcion: OpcionSelect) => void;
  disabled?: boolean;
  extraFooterLabel?: string; // ej: "Otro / no está en la lista"
  onExtraFooter?: () => void;
}

// Selector genérico con búsqueda, pensado para listas largas (ej: 112
// unidades). Evita depender de un picker nativo aparte.
export default function SelectModal({
  label,
  placeholder,
  opciones,
  valorSeleccionado,
  onSeleccionar,
  disabled,
  extraFooterLabel,
  onExtraFooter,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return opciones;
    const q = busqueda.trim().toLowerCase();
    return opciones.filter((o) => o.label.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.campo, disabled && styles.campoDeshabilitado]}
        onPress={() => !disabled && setAbierto(true)}
        disabled={disabled}
      >
        <Text style={valorSeleccionado ? styles.valorTexto : styles.placeholderTexto}>
          {valorSeleccionado ? valorSeleccionado.label : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View style={styles.modalContainer}>
          <TextInput
            style={styles.buscador}
            placeholder="Buscar..."
            value={busqueda}
            onChangeText={setBusqueda}
            autoFocus
          />
          <FlatList
            data={filtradas}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.opcion}
                onPress={() => {
                  onSeleccionar(item);
                  setBusqueda("");
                  setAbierto(false);
                }}
              >
                <Text style={styles.opcionTexto}>{item.label}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.vacio}>Sin resultados.</Text>}
            ListFooterComponent={
              extraFooterLabel ? (
                <TouchableOpacity
                  style={[styles.opcion, styles.opcionExtra]}
                  onPress={() => {
                    onExtraFooter?.();
                    setBusqueda("");
                    setAbierto(false);
                  }}
                >
                  <Text style={styles.opcionExtraTexto}>{extraFooterLabel}</Text>
                </TouchableOpacity>
              ) : null
            }
          />
          <TouchableOpacity style={styles.cerrar} onPress={() => setAbierto(false)}>
            <Text style={styles.cerrarTexto}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  campo: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  campoDeshabilitado: { backgroundColor: "#f0f0f0" },
  valorTexto: { fontSize: 16, color: "#222" },
  placeholderTexto: { fontSize: 16, color: "#999" },
  modalContainer: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: "#fff" },
  buscador: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  opcion: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  opcionTexto: { fontSize: 16 },
  opcionExtra: { backgroundColor: "#fafafa" },
  opcionExtraTexto: { fontSize: 16, color: "#1a6fc4", fontWeight: "600" },
  vacio: { textAlign: "center", color: "#888", marginTop: 20 },
  cerrar: { padding: 16, alignItems: "center" },
  cerrarTexto: { color: "#c0392b", fontWeight: "700", fontSize: 16 },
});
