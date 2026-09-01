import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { consultarPatente } from "../api/client";
import { ConsultaPatenteResponse } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function ConsultaPatenteScreen() {
  const { token } = useAuth();
  const [patente, setPatente] = useState("");
  const [resultado, setResultado] = useState<ConsultaPatenteResponse | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const handleBuscar = async () => {
    if (!token || !patente.trim()) return;
    setBuscando(true);
    setResultado(null);
    setNoEncontrada(false);
    try {
      const data = await consultarPatente(token, patente.trim());
      setResultado(data);
    } catch {
      setNoEncontrada(true);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Patente</Text>
      <TextInput
        style={styles.input}
        value={patente}
        onChangeText={setPatente}
        placeholder="Ej: AABB12"
        autoCapitalize="characters"
        onSubmitEditing={handleBuscar}
      />

      <TouchableOpacity style={styles.boton} onPress={handleBuscar} disabled={buscando}>
        {buscando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>Buscar</Text>
        )}
      </TouchableOpacity>

      {resultado && (
        <View style={styles.resultado}>
          <Text style={styles.resultadoPatente}>{resultado.patente}</Text>
          <Text style={styles.resultadoLinea}>{resultado.gls_tipotenencia}</Text>
          <Text style={styles.resultadoLinea}>
            {resultado.nombre_torre} · {resultado.numero_unidad}
          </Text>
        </View>
      )}

      {noEncontrada && (
        <View style={styles.resultadoVacio}>
          <Text style={styles.resultadoVacioTexto}>
            Esta patente no está registrada como propietario ni arrendatario del condominio.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    marginTop: 4,
    letterSpacing: 1,
  },
  boton: {
    backgroundColor: "#014BD2",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  resultado: {
    marginTop: 28,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#eafaf1",
    borderWidth: 1,
    borderColor: "#1a9d5c",
  },
  resultadoPatente: { fontSize: 22, fontWeight: "800", letterSpacing: 1, color: "#1a1a1a" },
  resultadoLinea: { fontSize: 16, color: "#333", marginTop: 6 },
  resultadoVacio: {
    marginTop: 28,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#fdecea",
    borderWidth: 1,
    borderColor: "#c0392b",
  },
  resultadoVacioTexto: { color: "#a93226", fontSize: 15 },
});
