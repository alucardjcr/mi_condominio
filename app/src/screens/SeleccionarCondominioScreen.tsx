import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 26: se muestra en vez de Login/AdminRoot cuando el Administrador
// que acaba de loguearse tiene más de un condominio a su cargo (ver
// AuthContext -> requiereSeleccionCondominio). Desde acá también puede
// crear un condominio nuevo (CrearCondominioScreen) y, al terminar ese
// asistente, entra derecho a ese condominio recién creado.
export default function SeleccionarCondominioScreen({ navigation }: any) {
  const { condominiosDisponibles, seleccionarCondominio, logout } = useAuth();
  const [cargandoId, setCargandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleElegir = async (id: number) => {
    setError(null);
    setCargandoId(id);
    try {
      await seleccionarCondominio(id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargandoId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>¿A cuál condominio deseas ingresar?</Text>
      <Text style={styles.subtitulo}>Administras más de un condominio con esta cuenta.</Text>

      <View style={styles.lista}>
        {condominiosDisponibles.map((c) => (
          <TouchableOpacity
            key={c.id_condominio}
            style={styles.tarjeta}
            onPress={() => handleElegir(c.id_condominio)}
            disabled={cargandoId !== null}
            activeOpacity={0.8}
          >
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.tarjetaTexto}>{c.nombre}</Text>
              {c.rol && <Text style={styles.tarjetaRol}>{c.rol}</Text>}
            </View>
            {cargandoId === c.id_condominio ? (
              <ActivityIndicator color={colors.navy900} />
            ) : (
              <Text style={styles.tarjetaFlecha}>›</Text>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.tarjetaNueva}
          onPress={() => navigation.navigate("CrearCondominio")}
          disabled={cargandoId !== null}
          activeOpacity={0.8}
        >
          <Text style={styles.tarjetaNuevaTexto}>+ Crear nuevo condominio</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.salirWrap} onPress={logout} activeOpacity={0.7}>
        <Text style={styles.salirTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.navy900 },
  titulo: { ...typography.title, textAlign: "center", color: colors.textOnNavy },
  subtitulo: {
    ...typography.body,
    color: colors.textMutedOnNavy,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  lista: { gap: spacing.sm },
  tarjeta: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tarjetaTexto: { ...typography.heading, color: colors.textDark, flexShrink: 1 },
  tarjetaRol: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  tarjetaFlecha: { fontSize: 24, color: colors.textMuted, fontWeight: "700" },
  tarjetaNueva: {
    borderWidth: 1.5,
    borderColor: colors.goldSoft,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  tarjetaNuevaTexto: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  salirWrap: { marginTop: spacing.xl, alignItems: "center" },
  salirTexto: { color: colors.textMutedOnNavy, fontSize: 14, fontWeight: "600" },
});
