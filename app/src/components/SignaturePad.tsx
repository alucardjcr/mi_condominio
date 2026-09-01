import React, { useRef, useState } from "react";
import { Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot, { ViewShotRef } from "react-native-view-shot";

interface Props {
  label?: string;
  value: string | null; // data URL de la firma ya capturada, o null si aún no se firma
  onChange: (dataUrl: string | null) => void;
}

const ALTO_LIENZO = 170;

// Pad de firma dibujada con el dedo (PanResponder + react-native-svg),
// capturada como PNG con react-native-view-shot. Reemplaza el cuaderno
// físico que hoy se firma al entregar un paquete.
export default function SignaturePad({ label = "Firma de quien retira *", value, onChange }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState("");
  const viewShotRef = useRef<ViewShotRef>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setActivePath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setActivePath((prev) => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setActivePath((prev) => {
          if (prev) setPaths((all) => [...all, prev]);
          return "";
        });
      },
    })
  ).current;

  const limpiar = () => {
    setPaths([]);
    setActivePath("");
  };

  const usarFirma = async () => {
    if (paths.length === 0) return;
    const uri = await viewShotRef.current?.capture?.();
    if (uri) onChange(uri);
  };

  if (value) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.previewWrap}>
          <Image source={{ uri: value }} style={styles.preview} resizeMode="contain" />
        </View>
        <TouchableOpacity
          style={styles.botonSecundario}
          onPress={() => {
            limpiar();
            onChange(null);
          }}
        >
          <Text style={styles.botonSecundarioTexto}>Rehacer firma</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ViewShot ref={viewShotRef} options={{ format: "png", result: "data-uri" }} style={styles.lienzoWrap}>
        <View style={styles.lienzo} {...panResponder.panHandlers}>
          <Svg width="100%" height="100%">
            {paths.map((d, i) => (
              <Path key={i} d={d} stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {activePath ? (
              <Path d={activePath} stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>
        </View>
      </ViewShot>
      <View style={styles.acciones}>
        <TouchableOpacity style={styles.botonSecundario} onPress={limpiar}>
          <Text style={styles.botonSecundarioTexto}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botonPrimario, paths.length === 0 && styles.botonDeshabilitado]}
          onPress={usarFirma}
          disabled={paths.length === 0}
        >
          <Text style={styles.botonPrimarioTexto}>Usar esta firma</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 4 },
  lienzoWrap: { borderRadius: 10, overflow: "hidden" },
  lienzo: {
    height: ALTO_LIENZO,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
  },
  acciones: { flexDirection: "row", gap: 10, marginTop: 8 },
  botonSecundario: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  botonSecundarioTexto: { color: "#555", fontWeight: "600" },
  botonPrimario: { flex: 1, backgroundColor: "#014BD2", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  botonPrimarioTexto: { color: "#fff", fontWeight: "700" },
  botonDeshabilitado: { opacity: 0.5 },
  previewWrap: {
    height: ALTO_LIENZO,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  preview: { flex: 1 },
});
