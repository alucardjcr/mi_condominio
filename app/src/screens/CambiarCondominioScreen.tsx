import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getMisCondominios } from "../api/client";
import { CondominioOpcion } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 26: para un Administrador ya logeado que quiere pasarse a OTRO de
// sus condominios sin desloguearse — a diferencia de
// SeleccionarCondominioScreen (que se ve solo en el login inicial, con la
// lista que ya trajo el login), acá la lista se pide de nuevo porque puede
// haber cambiado (ej. recién creó un condominio nuevo).
export default function CambiarCondominioScreen({ navigation }: any) {
  const { token, guardia, cambiarCondominio, nombreCondominioActual } = useAuth();
  const [condominios, setCondominios] = useState<CondominioOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cambiandoId, setCambiandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getMisCondominios(token)
      .then(setCondominios)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  const handleElegir = async (id: number) => {
    setError(null);
    setCambiandoId(id);
    try {
      await cambiarCondominio(id);
    } catch (e: any) {
      setError(e.message);
      setCambiandoId(null);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>Condominio actual: {nombreCondominioActual ?? "—"}</Text>

      {condominios.map((c) => {
        const esActual = c.id_condominio === guardia?.condominio_id_condominio;
        return (
          <TouchableOpacity
            key={c.id_condominio}
            style={[styles.tarjeta, esActual && styles.tarjetaActiva]}
            onPress={() => handleElegir(c.id_condominio)}
            disabled={cambiandoId !== null || esActual}
            activeOpacity={0.8}
          >
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.tarjetaTexto}>{c.nombre}</Text>
              {c.rol && <Text style={styles.tarjetaRol}>{c.rol}</Text>}
            </View>
            {cambiandoId === c.id_condominio ? (
              <ActivityIndicator color={colors.navy900} />
            ) : esActual ? (
              <Text style={styles.actualEtiqueta}>Actual</Text>
            ) : (
              <Text style={styles.tarjetaFlecha}>›</Text>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.tarjetaNueva}
        onPress={() => navigation.navigate("CrearCondominio")}
        disabled={cambiandoId !== null}
        activeOpacity={0.8}
      >
        <Text style={styles.tarjetaNuevaTexto}>+ Crear nuevo condominio</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.offWhite, gap: spacing.sm },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.offWhite },
  subtitulo: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tarjetaActiva: { borderColor: colors.navy900 },
  tarjetaTexto: { ...typography.heading, color: colors.textDark, flexShrink: 1 },
  tarjetaRol: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  tarjetaFlecha: { fontSize: 24, color: colors.textMuted, fontWeight: "700" },
  actualEtiqueta: { color: colors.navy900, fontWeight: "700", fontSize: 12 },
  tarjetaNueva: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  tarjetaNuevaTexto: { color: colors.info, fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
});
