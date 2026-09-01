import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminConfigurarRetencion, adminEjecutarLimpiezaRetencion, adminGetRetencion } from "../../api/client";
import { PoliticaRetencionItem } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 34, a pedido explícito del usuario: retención de datos — Ley N°
// 21.719 exige minimización (no guardar datos más tiempo del necesario).
// Cada categoría empieza SIN configurar (nunca se borra nada) hasta que el
// Administrador/Comité le pone un plazo a propósito.
export default function AdminRetencionScreen() {
  const { token } = useAuth();
  const [politicas, setPoliticas] = useState<PoliticaRetencionItem[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardandoCategoria, setGuardandoCategoria] = useState<string | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    adminGetRetencion(token, CONDOMINIO_ID)
      .then((lista) => {
        setPoliticas(lista);
        const iniciales: Record<string, string> = {};
        lista.forEach((p) => {
          iniciales[p.categoria] = p.dias_retencion !== null ? String(p.dias_retencion) : "";
        });
        setValores(iniciales);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const handleGuardar = async (categoria: PoliticaRetencionItem["categoria"]) => {
    if (!token) return;
    const texto = valores[categoria]?.trim() ?? "";
    setGuardandoCategoria(categoria);
    try {
      await adminConfigurarRetencion(token, CONDOMINIO_ID, categoria, texto === "" ? null : Number(texto));
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardandoCategoria(null);
    }
  };

  const handleEjecutarLimpieza = () => {
    Alert.alert(
      "Ejecutar limpieza ahora",
      "Se borrarán definitivamente los datos más antiguos que el plazo configurado en cada categoría. Esta acción no se puede deshacer. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Ejecutar",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setEjecutando(true);
            try {
              const resultado = await adminEjecutarLimpiezaRetencion(token, CONDOMINIO_ID);
              const resumen = resultado.map((r) => `${r.nombre}: ${r.filas_eliminadas} registro(s)`).join("\n");
              Alert.alert(
                "Limpieza completada",
                resultado.length > 0 ? resumen : "No hay ninguna categoría con plazo configurado."
              );
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setEjecutando(false);
            }
          },
        },
      ]
    );
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Define cuántos días quieres conservar cada tipo de dato operativo antes de poder borrarlo. Vacío = nunca se
        borra nada de esa categoría automáticamente.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {politicas.map((p) => (
        <View key={p.categoria} style={styles.card}>
          <Text style={styles.nombreCategoria}>{p.nombre}</Text>
          <View style={styles.filaInput}>
            <TextInput
              style={styles.input}
              value={valores[p.categoria] ?? ""}
              onChangeText={(t) => setValores((prev) => ({ ...prev, [p.categoria]: t }))}
              placeholder="Sin configurar"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <Text style={styles.diasTexto}>días</Text>
            <TouchableOpacity
              style={[styles.botonGuardar, guardandoCategoria === p.categoria && styles.botonDeshabilitado]}
              onPress={() => handleGuardar(p.categoria)}
              disabled={guardandoCategoria === p.categoria}
            >
              {guardandoCategoria === p.categoria ? (
                <ActivityIndicator color={colors.navy900} size="small" />
              ) : (
                <Text style={styles.botonGuardarTexto}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.botonEjecutar, ejecutando && styles.botonDeshabilitado]}
        onPress={handleEjecutarLimpieza}
        disabled={ejecutando}
      >
        {ejecutando ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.botonEjecutarTexto}>Ejecutar limpieza ahora</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.ayudaEjecutar}>
        Hoy se ejecuta a mano desde acá. Para que sea automático, conviene programarlo para correr una vez al día
        (ej. desde un cron externo).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: spacing.md },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  intro: { ...typography.small, color: colors.textMuted },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600" },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  nombreCategoria: { ...typography.heading, color: colors.textDark, fontSize: 15 },
  filaInput: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  diasTexto: { color: colors.textMuted, fontSize: 13 },
  botonGuardar: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  botonGuardarTexto: { color: colors.navy900, fontWeight: "800", fontSize: 13 },
  botonDeshabilitado: { opacity: 0.6 },
  botonEjecutar: { backgroundColor: colors.danger, borderRadius: radius.sm, padding: 16, alignItems: "center", marginTop: spacing.md },
  botonEjecutarTexto: { color: colors.white, fontWeight: "800" },
  ayudaEjecutar: { ...typography.small, color: colors.textMuted, textAlign: "center" },
});
