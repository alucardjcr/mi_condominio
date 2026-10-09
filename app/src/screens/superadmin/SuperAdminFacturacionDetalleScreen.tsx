import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { superAdminConfigurarFacturacion, superAdminGetFacturacion, superAdminMarcarPagado } from "../../api/client";
import { CondominioConFacturacion } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { colors, radius, spacing, typography } from "../../theme/theme";

const formatoCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function SuperAdminFacturacionDetalleScreen({ route }: any) {
  const { condominioId, nombre } = route.params as { condominioId: number; nombre: string };
  const { token } = useAuth();

  const [datos, setDatos] = useState<CondominioConFacturacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [monto, setMonto] = useState("");
  const [diaLimite, setDiaLimite] = useState("5");
  const [montoPago, setMontoPago] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [marcandoPago, setMarcandoPago] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    superAdminGetFacturacion(token)
      .then((lista) => {
        const propio = lista.find((c) => c.id_condominio === condominioId);
        if (propio) {
          setDatos(propio);
          setMonto(propio.monto_mensualidad !== null ? String(propio.monto_mensualidad) : "");
          setDiaLimite(String(propio.dia_limite_pago));
          setMontoPago(propio.monto_mensualidad !== null ? String(propio.monto_mensualidad) : "");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token, condominioId]);

  useFocusEffect(cargar);

  const handleGuardarPrecio = async () => {
    if (!token) return;
    setError(null);
    setGuardando(true);
    try {
      await superAdminConfigurarFacturacion(token, condominioId, {
        monto_mensualidad: monto.trim() === "" ? null : Number(monto),
        dia_limite_pago: Number(diaLimite) || 5,
      });
      cargar();
      Alert.alert("Listo", "La facturación de este condominio quedó actualizada.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleMarcarPagado = async () => {
    if (!token) return;
    if (!montoPago.trim()) {
      setError("Ingresa el monto pagado.");
      return;
    }
    setError(null);
    setMarcandoPago(true);
    try {
      await superAdminMarcarPagado(token, condominioId, { monto: Number(montoPago) });
      cargar();
      Alert.alert("Listo", `Se marcó el período ${datos?.periodo_actual} como pagado.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMarcandoPago(false);
    }
  };

  if (cargando || !datos) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>{nombre}</Text>

      <View style={styles.card}>
        <Text style={styles.subtitulo}>Precio mensual</Text>
        <Text style={styles.label}>Monto mensual (CLP)</Text>
        <TextInput
          style={styles.input}
          value={monto}
          onChangeText={setMonto}
          placeholder="ej: 250000 (vacío = sin facturación configurada)"
          placeholderTextColor={colors.textMutedOnNavy}
          keyboardType="number-pad"
        />
        <Text style={styles.label}>Día límite de pago del mes</Text>
        <TextInput
          style={styles.input}
          value={diaLimite}
          onChangeText={setDiaLimite}
          placeholder="5"
          placeholderTextColor={colors.textMutedOnNavy}
          keyboardType="number-pad"
        />
        <TouchableOpacity
          style={[styles.boton, guardando && styles.botonDeshabilitado]}
          onPress={handleGuardarPrecio}
          disabled={guardando}
          activeOpacity={0.85}
        >
          {guardando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitulo}>Período actual: {datos.periodo_actual}</Text>
        <Text style={styles.estadoLinea}>
          Estado:{" "}
          <Text style={{ fontWeight: "800" }}>
            {datos.bloqueado ? "Bloqueado" : datos.pagado_periodo_actual ? "Pagado" : "Pendiente (en gracia)"}
          </Text>
        </Text>

        <Text style={styles.label}>Marcar como pagado — monto recibido</Text>
        <TextInput
          style={styles.input}
          value={montoPago}
          onChangeText={setMontoPago}
          placeholder="Monto"
          placeholderTextColor={colors.textMutedOnNavy}
          keyboardType="number-pad"
        />
        <TouchableOpacity
          style={[styles.botonSecundario, marcandoPago && styles.botonDeshabilitado]}
          onPress={handleMarcarPagado}
          disabled={marcandoPago}
          activeOpacity={0.85}
        >
          {marcandoPago ? (
            <ActivityIndicator color={colors.success} />
          ) : (
            <Text style={styles.botonSecundarioTexto}>Marcar {datos.periodo_actual} como pagado</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, backgroundColor: colors.navy900, gap: spacing.md },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy900 },
  titulo: { ...typography.title, color: colors.textOnNavy, textAlign: "center" },
  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg },
  subtitulo: { ...typography.heading, color: colors.textOnNavy, marginBottom: spacing.sm },
  estadoLinea: { ...typography.body, color: colors.textMutedOnNavy, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textMutedOnNavy, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textOnNavy,
    backgroundColor: colors.navy700,
  },
  boton: { backgroundColor: colors.botonNaranja, borderWidth: 1, borderColor: colors.botonNaranjaBorde, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.md },
  botonTexto: { color: colors.botonNaranjaTexto, fontWeight: "800" },
  botonSecundario: {
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  botonSecundarioTexto: { color: colors.success, fontWeight: "700" },
  botonDeshabilitado: { opacity: 0.6 },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600" },
});
