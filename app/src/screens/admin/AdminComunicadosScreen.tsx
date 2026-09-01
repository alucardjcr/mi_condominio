import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { adminCrearComunicado } from "../../api/client";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

// Comunicados (ronda 16), a pedido explícito del usuario: "el administrador
// o el comité podrá emitir un comunicado y debería llegarles a todos como
// notificación" — le llega a TODOS los residentes activos con acceso del
// condominio (no solo a un depto), tanto a su bandeja de notificaciones
// dentro de la app como, si tienen push_token registrado, un push real.
export default function AdminComunicadosScreen() {
  const { token } = useAuth();
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = () => {
    if (!token || !titulo.trim() || !cuerpo.trim()) {
      Alert.alert("Faltan datos", "Título y mensaje son obligatorios.");
      return;
    }
    Alert.alert(
      "Enviar comunicado",
      "Le va a llegar como notificación a TODOS los residentes activos del condominio. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            setEnviando(true);
            try {
              const resultado = await adminCrearComunicado(token, {
                titulo: titulo.trim(),
                cuerpo: cuerpo.trim(),
                condominio_id_condominio: CONDOMINIO_ID,
              });
              setTitulo("");
              setCuerpo("");
              Alert.alert(
                "Comunicado enviado",
                resultado.destinatarios > 0
                  ? `Le llegó a ${resultado.destinatarios} residente${resultado.destinatarios === 1 ? "" : "s"} con acceso activo.`
                  : "No hay todavía ningún residente con acceso activo a la app en este condominio, así que no se lo notificó a nadie."
              );
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setEnviando(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.intro}>
        Redacta un mensaje y le llega como notificación a todos los residentes con acceso activo a la app en este
        condominio (dueños y ocupantes de todos los deptos) — a su bandeja de notificaciones, y como push real si ya
        tienen su teléfono registrado.
      </Text>
      <View style={styles.form}>
        <Text style={styles.label}>Título</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Corte de agua programado"
          value={titulo}
          onChangeText={setTitulo}
        />
        <Text style={styles.label}>Mensaje</Text>
        <TextInput
          style={[styles.input, styles.inputMultilinea]}
          placeholder="Detalle del comunicado..."
          value={cuerpo}
          onChangeText={setCuerpo}
          multiline
          numberOfLines={5}
        />
        <TouchableOpacity style={styles.boton} onPress={handleEnviar} disabled={enviando}>
          <Text style={styles.botonTexto}>{enviando ? "Enviando..." : "Enviar comunicado a todos"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  intro: { color: "#666", fontSize: 13, marginBottom: 14, lineHeight: 18 },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  label: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  inputMultilinea: { minHeight: 110, textAlignVertical: "top" },
  boton: { backgroundColor: "#b0730a", borderRadius: 10, padding: 14, alignItems: "center" },
  botonTexto: { color: "#fff", fontWeight: "700" },
});
