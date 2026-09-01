import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { actualizarEstadoEstacionamiento, getEstacionamientosAdmin, getEstadosEstacionamiento } from "../../api/client";
import { EstacionamientoAdmin, EstadoEstacionamiento } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { CONDOMINIO_ID } from "../../config/api";
import { colors, radius, spacing, typography } from "../../theme/theme";

const TIPOS = ["Visita", "Discapacitado", "Residente"] as const;

function colorEstado(estado: string) {
  if (estado === "Disponible") return "#DCFCE7";
  if (estado === "Ocupado") return "#FEF3C7";
  if (estado === "Fuera de servicio") return "#FEE2E2";
  if (estado === "Disponible para arriendo") return "#DBEAFE";
  return colors.border;
}

// Ronda 28, a pedido explícito del usuario: caso real que lo motivó — el
// cupo de residente 84 de Valles de Varoli "quedó mal hecho" y no se puede
// usar. Acá se marca cualquier estacionamiento (Visita, Discapacitado o
// Residente) como "Fuera de servicio" — desde ese momento la asignación
// automática de cupo al registrar una entrada deja de ofrecerlo (ver
// admin.service.ts -> listarEstacionamientosAdmin, que explica por qué no
// hizo falta tocar esa lógica).
export default function AdminEstacionamientosScreen() {
  const { token } = useAuth();
  const [estacionamientos, setEstacionamientos] = useState<EstacionamientoAdmin[]>([]);
  const [estados, setEstados] = useState<EstadoEstacionamiento[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<(typeof TIPOS)[number]>("Visita");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([getEstacionamientosAdmin(token, CONDOMINIO_ID), getEstadosEstacionamiento(token)])
      .then(([lista, estadosLista]) => {
        setEstacionamientos(lista);
        setEstados(estadosLista);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(cargar);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return estacionamientos.filter((e) => {
      if (e.tipo !== tipoFiltro) return false;
      if (!q) return true;
      return (
        e.numero_estacionamiento.toLowerCase().includes(q) ||
        e.numero_unidad?.toLowerCase().includes(q) ||
        e.nombre_torre?.toLowerCase().includes(q)
      );
    });
  }, [estacionamientos, tipoFiltro, busqueda]);

  const handleCambiarEstado = (cupo: EstacionamientoAdmin) => {
    const opciones = estados
      .filter((e) => e.id_estadoestacionamiento !== cupo.estado_id)
      .map((e) => ({
        text: e.gls_estadoestacionamiento,
        onPress: async () => {
          if (!token) return;
          setActualizandoId(cupo.id_estacionamiento);
          try {
            await actualizarEstadoEstacionamiento(token, cupo.id_estacionamiento, e.id_estadoestacionamiento);
            cargar();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          } finally {
            setActualizandoId(null);
          }
        },
      }));
    Alert.alert(`Cupo ${cupo.numero_estacionamiento}`, "Cambiar estado a:", [
      ...opciones,
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <View style={styles.filtroTipos}>
        {TIPOS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filtroTipo, tipoFiltro === t && styles.filtroTipoActivo]}
            onPress={() => setTipoFiltro(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filtroTipoTexto, tipoFiltro === t && styles.filtroTipoTextoActivo]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar por número o depto..."
        placeholderTextColor={colors.textMuted}
        value={busqueda}
        onChangeText={setBusqueda}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.lista}>
        {filtrados.length === 0 && <Text style={styles.vacio}>No hay cupos de este tipo.</Text>}
        {filtrados.map((e) => (
          <TouchableOpacity
            key={e.id_estacionamiento}
            style={styles.tarjeta}
            onPress={() => handleCambiarEstado(e)}
            disabled={actualizandoId === e.id_estacionamiento}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.numero}>Cupo {e.numero_estacionamiento}</Text>
              {e.numero_unidad && (
                <Text style={styles.detalle}>
                  {e.nombre_torre} {e.numero_unidad}
                </Text>
              )}
              {e.ubicacion && <Text style={styles.detalle}>{e.ubicacion}</Text>}
            </View>
            {actualizandoId === e.id_estacionamiento ? (
              <ActivityIndicator color={colors.navy900} />
            ) : (
              <View style={[styles.badge, { backgroundColor: colorEstado(e.estado) }]}>
                <Text style={styles.badgeTexto}>{e.estado}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  filtroTipos: { flexDirection: "row", gap: spacing.xs, padding: spacing.md, paddingBottom: 0 },
  filtroTipo: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  filtroTipoActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  filtroTipoTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  filtroTipoTextoActivo: { color: colors.textOnNavy },
  buscador: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    margin: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.white,
    color: colors.textDark,
  },
  error: { color: colors.danger, textAlign: "center", fontWeight: "600", marginTop: spacing.sm },
  lista: { padding: spacing.md, paddingTop: spacing.xs, gap: spacing.sm },
  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  numero: { ...typography.heading, color: colors.textDark, fontSize: 16 },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
});
