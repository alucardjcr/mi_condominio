import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminConfigurarRetencion, adminEjecutarLimpiezaRetencion, adminGetRetencion, UnidadRetencion } from "../../api/client";
import { PoliticaRetencionItem } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors, radius, spacing, typography } from "../../theme/theme";

const UNIDADES: { valor: UnidadRetencion; label: string; dias: number }[] = [
  { valor: "dias", label: "Días", dias: 1 },
  { valor: "semanas", label: "Semanas", dias: 7 },
  { valor: "anios", label: "Años", dias: 365 },
];

// Convierte los días guardados a la unidad más natural para mostrar (ej.
// 730 días se ve mejor como "2 años" que como "730 días").
function unidadNaturalPara(dias: number): { cantidad: number; unidad: UnidadRetencion } {
  if (dias % 365 === 0) return { cantidad: dias / 365, unidad: "anios" };
  if (dias % 7 === 0) return { cantidad: dias / 7, unidad: "semanas" };
  return { cantidad: dias, unidad: "dias" };
}

interface EstadoCategoria {
  cantidad: string;
  unidad: UnidadRetencion;
}

// Ronda 34/35, a pedido explícito del usuario: retención de datos — Ley N°
// 21.719 exige minimización (no guardar datos más tiempo del necesario).
// Cada categoría empieza SIN configurar (nunca se borra nada) hasta que el
// Administrador/Comité le pone un plazo a propósito, en la unidad que le
// acomode (días, semanas o años — puertas adentro siempre se guarda en
// días, ver retencion.service.ts -> convertirADias). Desde la ronda 35 la
// limpieza además corre sola todos los días por un cron — este botón
// "Ejecutar limpieza ahora" sigue sirviendo para forzarla al toque.
export default function AdminRetencionScreen() {
  const { token } = useAuth();
  const [politicas, setPoliticas] = useState<PoliticaRetencionItem[]>([]);
  const [valores, setValores] = useState<Record<string, EstadoCategoria>>({});
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
        const iniciales: Record<string, EstadoCategoria> = {};
        lista.forEach((p) => {
          if (p.dias_retencion !== null) {
            const { cantidad, unidad } = unidadNaturalPara(p.dias_retencion);
            iniciales[p.categoria] = { cantidad: String(cantidad), unidad };
          } else {
            iniciales[p.categoria] = { cantidad: "", unidad: "dias" };
          }
        });
        setValores(iniciales);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const handleGuardar = async (categoria: PoliticaRetencionItem["categoria"]) => {
    if (!token) return;
    const estado = valores[categoria];
    const texto = estado?.cantidad.trim() ?? "";
    setGuardandoCategoria(categoria);
    try {
      await adminConfigurarRetencion(
        token,
        CONDOMINIO_ID,
        categoria,
        texto === "" ? null : Number(texto),
        estado.unidad
      );
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
        Define cuánto tiempo quieres conservar cada tipo de dato operativo antes de poder borrarlo — en días,
        semanas o años, como prefieras. Vacío = nunca se borra nada de esa categoría. La limpieza corre sola todos
        los días a las 3 AM; también puedes forzarla ahora con el botón de abajo.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {politicas.map((p) => {
        const estado = valores[p.categoria] ?? { cantidad: "", unidad: "dias" as UnidadRetencion };
        return (
          <View key={p.categoria} style={styles.card}>
            <Text style={styles.nombreCategoria}>{p.nombre}</Text>
            <View style={styles.filaInput}>
              <TextInput
                style={styles.input}
                value={estado.cantidad}
                onChangeText={(t) => setValores((prev) => ({ ...prev, [p.categoria]: { ...estado, cantidad: t } }))}
                placeholder="Sin configurar"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
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
            <View style={styles.filaUnidades}>
              {UNIDADES.map((u) => (
                <TouchableOpacity
                  key={u.valor}
                  style={[styles.opcionUnidad, estado.unidad === u.valor && styles.opcionUnidadActiva]}
                  onPress={() => setValores((prev) => ({ ...prev, [p.categoria]: { ...estado, unidad: u.valor } }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.opcionUnidadTexto, estado.unidad === u.valor && styles.opcionUnidadTextoActivo]}>
                    {u.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

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
        La limpieza automática corre todos los días a las 3 AM (hora de Chile). Este botón la fuerza al toque, sin
        esperar.
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
  botonGuardar: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  botonGuardarTexto: { color: colors.navy900, fontWeight: "800", fontSize: 13 },
  botonDeshabilitado: { opacity: 0.6 },
  filaUnidades: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  opcionUnidad: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 8, alignItems: "center" },
  opcionUnidadActiva: { borderColor: colors.navy900, backgroundColor: colors.offWhite },
  opcionUnidadTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  opcionUnidadTextoActivo: { color: colors.navy900 },
  botonEjecutar: { backgroundColor: colors.danger, borderRadius: radius.sm, padding: 16, alignItems: "center", marginTop: spacing.md },
  botonEjecutarTexto: { color: colors.white, fontWeight: "800" },
  ayudaEjecutar: { ...typography.small, color: colors.textMuted, textAlign: "center" },
});

