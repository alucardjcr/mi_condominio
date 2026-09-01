import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getPaquete, paqueteRegistrarEntrega } from "../api/client";
import { Paquete } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import FotoCapture from "../components/FotoCapture";
import SignaturePad from "../components/SignaturePad";

export default function PaqueteEntregaScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const idPaquete: number = route.params.idPaquete;

  const [paquete, setPaquete] = useState<Paquete | null>(null);
  const [cargando, setCargando] = useState(true);

  const [retiraElMismo, setRetiraElMismo] = useState(true);
  const [nombreQuienRetira, setNombreQuienRetira] = useState("");
  const [fotoRetiro, setFotoRetiro] = useState<string | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPaquete(token, idPaquete)
      .then(setPaquete)
      .catch((e: any) => Alert.alert("Error", e.message))
      .finally(() => setCargando(false));
  }, [token, idPaquete]);

  if (cargando || !paquete) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#014BD2" />
      </View>
    );
  }

  const entregadoAFinal = retiraElMismo ? paquete.nombre_receptor : nombreQuienRetira;

  const handleSubmit = async () => {
    if (!token) return;
    if (!retiraElMismo && !nombreQuienRetira.trim()) {
      Alert.alert("Faltan datos", "Indica el nombre de quién retira el paquete.");
      return;
    }
    if (!retiraElMismo && !fotoRetiro) {
      Alert.alert("Falta la foto", "Como no es la persona a la que venía dirigido el paquete, su foto es obligatoria.");
      return;
    }
    if (!firma) {
      Alert.alert("Falta la firma", "La firma de quien retira es obligatoria para registrar la entrega.");
      return;
    }

    setEnviando(true);
    try {
      await paqueteRegistrarEntrega(token, idPaquete, {
        entregado_a: entregadoAFinal.trim(),
        firma_retiro: firma,
        foto_retiro: retiraElMismo ? undefined : fotoRetiro ?? undefined,
        condominio_id_condominio: CONDOMINIO_ID,
      });
      Alert.alert("Entrega registrada", `Paquete entregado a ${entregadoAFinal}.`);
      navigation.navigate("PaquetePendientes");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.resumen}>
          <Text style={styles.resumenTipo}>{paquete.gls_tipopaquete}</Text>
          <Text style={styles.resumenReceptor}>{paquete.nombre_receptor}</Text>
          <Text style={styles.resumenDetalle}>
            {paquete.nombre_torre} · Depto {paquete.numero_unidad}
          </Text>
        </View>

        <View style={styles.tipoCupoSelector}>
          <TouchableOpacity
            style={[styles.tipoCupoBoton, retiraElMismo && styles.tipoCupoBotonActivo]}
            onPress={() => setRetiraElMismo(true)}
          >
            <Text style={[styles.tipoCupoTexto, retiraElMismo && styles.tipoCupoTextoActivo]}>
              Retira {paquete.nombre_receptor}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tipoCupoBoton, !retiraElMismo && styles.tipoCupoBotonActivo]}
            onPress={() => setRetiraElMismo(false)}
          >
            <Text style={[styles.tipoCupoTexto, !retiraElMismo && styles.tipoCupoTextoActivo]}>
              Retira otra persona
            </Text>
          </TouchableOpacity>
        </View>

        {!retiraElMismo && (
          <>
            <Text style={styles.alerta}>
              Quien retira no es la persona a la que venía dirigido el paquete: su nombre y una foto son
              obligatorios.
            </Text>
            <Text style={styles.label}>Nombre de quien retira *</Text>
            <TextInput
              style={styles.input}
              value={nombreQuienRetira}
              onChangeText={setNombreQuienRetira}
              placeholder="Ej: Pedro Soto (conserje del turno)"
            />
            <FotoCapture label="Foto de quien retira *" value={fotoRetiro} onChange={setFotoRetiro} />
          </>
        )}

        <SignaturePad value={firma} onChange={setFirma} />

        <TouchableOpacity
          style={[styles.boton, enviando && styles.botonDeshabilitado]}
          onPress={handleSubmit}
          disabled={enviando}
        >
          <Text style={styles.botonTexto}>{enviando ? "Registrando..." : "Registrar entrega"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 20, paddingBottom: 60 },
  resumen: { backgroundColor: "#eef6ff", borderRadius: 10, padding: 14, marginBottom: 8 },
  resumenTipo: { fontSize: 12, color: "#014BD2", fontWeight: "700" },
  resumenReceptor: { fontSize: 18, fontWeight: "700", color: "#222", marginTop: 2 },
  resumenDetalle: { fontSize: 13, color: "#555", marginTop: 2 },
  tipoCupoSelector: { flexDirection: "row", gap: 10, marginTop: 12 },
  tipoCupoBoton: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  tipoCupoBotonActivo: { backgroundColor: "#014BD2", borderColor: "#014BD2" },
  tipoCupoTexto: { fontWeight: "600", color: "#333", textAlign: "center" },
  tipoCupoTextoActivo: { color: "#fff" },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#fff", marginTop: 4 },
  alerta: { color: "#c0392b", fontSize: 12, marginTop: 10 },
  boton: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
