import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Paquete } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme/theme";
import { fuenteImagenPrivada } from "../utils/imagenesPrivadas";
import { fechaHora24 } from "../utils/fechas";

export const ESTADOS_PENDIENTES = ["Recepcionado", "Notificado", "En portería"];

// Primer nombre + apellido paterno del guardia. Si el guardia es anterior a la
// separación del nombre, se deduce del nombre completo.
function nombreCorto(p: Paquete): string {
  if (p.guardia_creador_nombres && p.guardia_creador_apellido_paterno) {
    return `${p.guardia_creador_nombres.trim().split(/\s+/)[0]} ${p.guardia_creador_apellido_paterno.trim()}`;
  }
  const w = (p.nombre_guardia_creador ?? "").trim().split(/\s+/).filter(Boolean);
  if (w.length <= 3) return w.slice(0, 2).join(" ");
  return `${w[0]} ${w[2]}`;
}

// Tarjeta de un paquete en la vista del residente: foto circular del paquete,
// tipo/estado, quién lo recibió y, si ya se retiró, foto + fecha + nombre de
// quien lo retiró.
export default function PaqueteResidenteCard({ item }: { item: Paquete }) {
  const { token } = useAuth();
  const pendiente = ESTADOS_PENDIENTES.includes(item.gls_estadopaquete);
  const fotoPaquete = fuenteImagenPrivada(item.foto_recepcion_url, token);
  const fotoRetiro = fuenteImagenPrivada(item.foto_retiro_url, token);
  return (
    <View style={[styles.card, pendiente && styles.cardPendiente]}>
      <View style={styles.filaPaquete}>
        {fotoPaquete ? (
          <Image source={fotoPaquete} style={styles.foto} />
        ) : (
          <View style={[styles.foto, styles.fotoVacia]}>
            <Text style={{ fontSize: 24 }}>📦</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.tipo}>{item.gls_tipopaquete}</Text>
            <Text style={styles.estado}>{item.gls_estadopaquete}</Text>
          </View>
          <Text style={styles.detalle}>Recibido: {fechaHora24(item.fecha_recepcion)}</Text>
          {item.nombre_guardia_creador ? (
            <Text style={styles.detalle}>Recibido por el guardia {nombreCorto(item)}</Text>
          ) : null}
        </View>
      </View>
      {item.fecha_entrega ? (
        <View style={[styles.filaPaquete, styles.filaRetiro]}>
          {fotoRetiro ? (
            <Image source={fotoRetiro} style={styles.foto} />
          ) : (
            <View style={[styles.foto, styles.fotoVacia]}>
              <Text style={{ fontSize: 24 }}>👤</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.detalle}>Retirado: {fechaHora24(item.fecha_entrega)}</Text>
            {item.entregado_a ? <Text style={styles.detalle}>Recibió: {item.entregado_a}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.navy800, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.navy600 },
  cardPendiente: { borderColor: colors.botonNaranja, borderWidth: 1.5 },
  filaPaquete: { flexDirection: "row", alignItems: "center", gap: 12 },
  filaRetiro: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.navy600 },
  foto: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.navy700, overflow: "hidden" },
  fotoVacia: { alignItems: "center", justifyContent: "center" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  tipo: { fontSize: 12, color: colors.textMutedOnNavy, fontWeight: "600" },
  estado: { fontSize: 12, color: colors.goldSoft, fontWeight: "700" },
  detalle: { color: colors.textMutedOnNavy, marginTop: 4, fontSize: 13 },
});
