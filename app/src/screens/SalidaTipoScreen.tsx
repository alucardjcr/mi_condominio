import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

function BotonGrande({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.boton, pressed && styles.presionado]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.botonTexto}>{label}</Text>
    </Pressable>
  );
}

// Ronda 28, a pedido explícito del usuario: mismo patrón que
// EntradaTipoScreen — antes de la lista de "quién está dentro"
// (SalidaScreen), se elige si se busca entre las visitas vehiculares o las
// peatonales. SalidaScreen filtra la lista según route.params.peatonal.
export default function SalidaTipoScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>¿La visita que sale es vehicular o peatonal?</Text>
      <View style={styles.opciones}>
        <BotonGrande emoji="🚗" label="Vehicular" onPress={() => navigation.navigate("Salida", { peatonal: false })} />
        <BotonGrande emoji="🚶" label="Peatonal" onPress={() => navigation.navigate("Salida", { peatonal: true })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.navy900, justifyContent: "center" },
  titulo: { color: colors.textOnNavy, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: spacing.xl },
  opciones: { flexDirection: "row", gap: spacing.md },
  boton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: 32,
    alignItems: "center",
  },
  presionado: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  emoji: { fontSize: 36, marginBottom: spacing.sm },
  botonTexto: { color: colors.textDark, fontSize: 16, fontWeight: "800" },
});
