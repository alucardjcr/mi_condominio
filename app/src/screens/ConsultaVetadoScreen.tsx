import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { buscarVetadoPorRut } from "../api/client";
import { Vetado } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";

// Ronda 20: consulta proactiva del guardia por RUT — para revisar antes de
// dejar entrar a alguien si está en la lista VETADOS (ej. persona con orden
// de alejamiento). Esta pantalla es aparte de la alerta automática que ya
// aparece al registrar una visita (ver EntradaScreen); sirve para consultar
// ANTES, sin tener que registrar nada.
export default function ConsultaVetadoScreen() {
  const { token } = useAuth();
  const [rut, setRut] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Vetado | null | undefined>(undefined); // undefined = todavía no se buscó

  const handleBuscar = async () => {
    if (!token || !rut.trim()) return;
    setBuscando(true);
    try {
      const { vetado } = await buscarVetadoPorRut(token, rut.trim(), CONDOMINIO_ID);
      setResultado(vetado);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>RUT a consultar</Text>
      <TextInput
        style={styles.input}
        value={rut}
        onChangeText={setRut}
        placeholder="Ej: 12.345.678-9"
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.boton} onPress={handleBuscar} disabled={buscando || !rut.trim()}>
        <Text style={styles.botonTexto}>{buscando ? "Buscando..." : "Consultar"}</Text>
      </TouchableOpacity>

      {buscando && <ActivityIndicator style={{ marginTop: 24 }} />}

      {!buscando && resultado === null && (
        <View style={styles.cardOk}>
          <Text style={styles.cardOkTexto}>✅ No está en la lista VETADOS. Puede ingresar normalmente.</Text>
        </View>
      )}

      {!buscando && resultado && (
        <View style={styles.cardAlerta}>
          <Text style={styles.cardAlertaTitulo}>⚠️ PERSONA VETADA — no debe ingresar</Text>
          <Text style={styles.cardAlertaNombre}>{resultado.nombre_completo}</Text>
          <Text style={styles.cardAlertaDetalle}>RUT: {resultado.rut}</Text>
          {resultado.patente && <Text style={styles.cardAlertaDetalle}>Patente: {resultado.patente}</Text>}
          {resultado.parentesco && <Text style={styles.cardAlertaDetalle}>Motivo/relación: {resultado.parentesco}</Text>}
          {resultado.nombre_torre && (
            <Text style={styles.cardAlertaDetalle}>
              Asociado a: {resultado.nombre_torre} · Depto {resultado.numero_unidad}
            </Text>
          )}
          <Text style={styles.cardAlertaNota}>Si se presenta en portería, avisa a administración y/o Carabineros.</Text>
          <View style={styles.fotosRow}>
            {resultado.foto_persona_url && <Image source={fuenteImagenPrivada(resultado.foto_persona_url, token)!} style={styles.foto} />}
            {resultado.foto_vehiculo_url && <Image source={fuenteImagenPrivada(resultado.foto_vehiculo_url, token)!} style={styles.foto} />}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: "#fff", marginTop: 4 },
  boton: { backgroundColor: "#014BD2", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 16 },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cardOk: { backgroundColor: "#e6f7ee", borderRadius: 12, padding: 16, marginTop: 24 },
  cardOkTexto: { color: "#1a9d5c", fontWeight: "700", fontSize: 15 },
  cardAlerta: { backgroundColor: "#fdecea", borderRadius: 12, padding: 16, marginTop: 24, borderWidth: 2, borderColor: "#c0392b" },
  cardAlertaTitulo: { color: "#c0392b", fontWeight: "800", fontSize: 16, marginBottom: 8 },
  cardAlertaNombre: { fontSize: 18, fontWeight: "700", color: "#222" },
  cardAlertaDetalle: { color: "#555", marginTop: 4, fontSize: 14 },
  cardAlertaNota: { color: "#c0392b", marginTop: 10, fontSize: 13, fontStyle: "italic" },
  fotosRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  foto: { width: 100, height: 100, borderRadius: 8, backgroundColor: "#eee" },
});
