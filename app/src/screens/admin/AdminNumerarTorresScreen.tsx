import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { adminGetUnidadesParaNumerar, adminNumerarUnidadesTorre, getTorres } from "../../api/client";
import { UnidadParaNumerar } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";
import { colors, radius, spacing, typography } from "../../theme/theme";

// Ronda 73, a pedido explícito del usuario: reemplaza la numeración
// automática (101, 102... 201, 202...) que antes generaba
// crearCondominioConEstructura. Después de crear las torres/pisos, cada
// unidad nace "sin numerar" (placeholder tipo "Piso 1 · #1") y acá el
// administrador le pone el número real a cada depto, piso por piso, en el
// orden real del edificio — sin depender de ningún patrón fijo.
export default function AdminNumerarTorresScreen() {
  const { token } = useAuth();

  const [torres, setTorres] = useState<OpcionSelect[]>([]);
  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [cargandoTorres, setCargandoTorres] = useState(true);

  const [unidades, setUnidades] = useState<UnidadParaNumerar[]>([]);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [cargandoUnidades, setCargandoUnidades] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarTorres = useCallback(async () => {
    if (!token) return;
    try {
      const lista = await getTorres(token, CONDOMINIO_ID);
      setTorres(lista.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre })));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCargandoTorres(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setCargandoTorres(true);
      cargarTorres();
    }, [cargarTorres])
  );

  const cargarUnidades = useCallback(
    async (idTorre: number) => {
      if (!token) return;
      setCargandoUnidades(true);
      setError(null);
      try {
        const { unidades: lista } = await adminGetUnidadesParaNumerar(token, idTorre);
        setUnidades(lista);
        const iniciales: Record<number, string> = {};
        for (const u of lista) iniciales[u.id_unidad] = u.numero_unidad;
        setValores(iniciales);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setCargandoUnidades(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (torreSel) {
      cargarUnidades(torreSel.id);
    } else {
      setUnidades([]);
      setValores({});
    }
  }, [torreSel, cargarUnidades]);

  const porPiso = useMemo(() => {
    const grupos = new Map<number, UnidadParaNumerar[]>();
    for (const u of unidades) {
      const piso = u.piso ?? 0;
      if (!grupos.has(piso)) grupos.set(piso, []);
      grupos.get(piso)!.push(u);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[0] - b[0]);
  }, [unidades]);

  const handleGuardar = async () => {
    if (!token || !torreSel) return;
    setError(null);

    const asignaciones = unidades.map((u) => ({
      id_unidad: u.id_unidad,
      numero_unidad: (valores[u.id_unidad] ?? "").trim(),
    }));

    if (asignaciones.some((a) => !a.numero_unidad)) {
      setError("Todos los deptos necesitan un número.");
      return;
    }
    const vistos = new Set<string>();
    for (const a of asignaciones) {
      if (vistos.has(a.numero_unidad)) {
        setError(`El número "${a.numero_unidad}" está repetido.`);
        return;
      }
      vistos.add(a.numero_unidad);
    }

    setGuardando(true);
    try {
      await adminNumerarUnidadesTorre(token, torreSel.id, asignaciones);
      Alert.alert("Listo", `Se guardó la numeración de ${torreSel.label}.`);
      cargarUnidades(torreSel.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>Numerar torres</Text>
        <Text style={styles.intro}>
          Pon el número real de cada depto, piso por piso, en el orden en que están en el edificio.
        </Text>

        <View style={styles.card}>
          {cargandoTorres ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <SelectModal
              label="Torre / Block"
              placeholder="Selecciona una torre"
              opciones={torres}
              valorSeleccionado={torreSel}
              onSeleccionar={setTorreSel}
            />
          )}
        </View>

        {torreSel && cargandoUnidades && (
          <View style={styles.card}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}

        {torreSel && !cargandoUnidades && porPiso.length > 0 && (
          <View style={styles.card}>
            {porPiso.map(([piso, unidadesPiso]) => (
              <View key={piso} style={styles.grupoPiso}>
                <Text style={styles.pisoTitulo}>Piso {piso}</Text>
                {unidadesPiso.map((u) => (
                  <View key={u.id_unidad} style={styles.filaUnidad}>
                    <TextInput
                      style={styles.inputNumero}
                      value={valores[u.id_unidad] ?? ""}
                      onChangeText={(texto) => setValores((prev) => ({ ...prev, [u.id_unidad]: texto }))}
                      placeholder="ej: 101"
                      placeholderTextColor={colors.textMutedOnNavy}
                    />
                  </View>
                ))}
              </View>
            ))}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.boton, guardando && styles.botonDeshabilitado]}
              onPress={handleGuardar}
              disabled={guardando}
              activeOpacity={0.85}
            >
              {guardando ? <ActivityIndicator color={colors.botonNaranjaTexto} /> : <Text style={styles.botonTexto}>Guardar numeración</Text>}
            </TouchableOpacity>
          </View>
        )}

        {torreSel && !cargandoUnidades && porPiso.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.ayuda}>Esta torre no tiene deptos cargados.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl },
  titulo: { ...typography.title, textAlign: "center", color: colors.textOnNavy, marginBottom: spacing.xs },
  intro: { ...typography.small, textAlign: "center", color: colors.textMutedOnNavy, marginBottom: spacing.lg },
  card: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  ayuda: { ...typography.small, color: colors.textMutedOnNavy, textAlign: "center" },
  grupoPiso: { marginBottom: spacing.md },
  pisoTitulo: { ...typography.label, color: colors.textOnNavy, fontWeight: "800", marginBottom: spacing.xs },
  filaUnidad: { marginBottom: spacing.xs },
  inputNumero: {
    borderWidth: 1,
    borderColor: colors.navy600,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 16,
    color: colors.textOnNavy,
    backgroundColor: colors.navy700,
  },
  boton: {
    backgroundColor: colors.botonNaranja,
    borderWidth: 1,
    borderColor: colors.botonNaranjaBorde,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: colors.botonNaranjaTexto, fontSize: 16, fontWeight: "800" },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
});
