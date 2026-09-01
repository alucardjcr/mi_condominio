import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

function BotonGrande({ label, sub, color, onPress }: { label: string; sub: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.boton, { backgroundColor: color }, pressed && styles.presionado]}
    >
      <Text style={styles.botonTexto}>{label}</Text>
      <Text style={styles.botonSub}>{sub}</Text>
    </Pressable>
  );
}

// Ronda 28, a pedido explícito del usuario: antes el Home tenía "ENTRADA" y
// "SALIDA" como dos botones sueltos — ahora ambos quedan agrupados bajo
// "VISITAS" en el Home, y acá se elige cuál de las dos. El siguiente paso
// (EntradaTipoScreen/SalidaTipoScreen) pregunta si es vehicular o peatonal
// antes de llegar al formulario de siempre.
export default function VisitasMenuScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <BotonGrande
        label="Entrada"
        sub="Registrar el ingreso de una visita"
        color={colors.success}
        onPress={() => navigation.navigate("EntradaTipo")}
      />
      <BotonGrande
        label="Salida"
        sub="Registrar la salida de una visita"
        color={colors.danger}
        onPress={() => navigation.navigate("SalidaTipo")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.navy900, justifyContent: "center", gap: spacing.md },
  boton: { borderRadius: radius.lg, paddingVertical: 28, alignItems: "center" },
  presionado: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  botonTexto: { color: colors.textOnNavy, fontSize: 20, fontWeight: "800", letterSpacing: 0.4 },
  botonSub: { color: colors.textOnNavy, fontSize: 13, marginTop: 4, opacity: 0.85 },
});
