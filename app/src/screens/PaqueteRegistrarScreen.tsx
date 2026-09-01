import React, { useEffect, useState } from "react";
import {
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
import {
  getResidentesPorUnidad,
  getTiposPaquete,
  getTorres,
  getUnidadesPorTorre,
  registrarLlegadaPaquete,
} from "../api/client";
import { Residente, TipoPaquete, Torre, Unidad } from "../api/types";
import { CONDOMINIO_ID } from "../config/api";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";
import FotoCapture from "../components/FotoCapture";

export default function PaqueteRegistrarScreen({ navigation }: any) {
  const { token } = useAuth();

  const [torres, setTorres] = useState<Torre[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [residentes, setResidentes] = useState<Residente[]>([]);
  const [tipos, setTipos] = useState<TipoPaquete[]>([]);

  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [unidadSel, setUnidadSel] = useState<OpcionSelect | null>(null);
  const [tipoSel, setTipoSel] = useState<OpcionSelect | null>(null);
  const [receptorSel, setReceptorSel] = useState<OpcionSelect | null>(null);
  const [receptorLibre, setReceptorLibre] = useState("");
  const [usandoReceptorLibre, setUsandoReceptorLibre] = useState(false);
  const [rutReceptor, setRutReceptor] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) return;
    getTorres(token, CONDOMINIO_ID).then(setTorres).catch((e) => Alert.alert("Error", e.message));
    getTiposPaquete(token, CONDOMINIO_ID).then(setTipos).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const handleSeleccionarTorre = async (opcion: OpcionSelect) => {
    setTorreSel(opcion);
    setUnidadSel(null);
    setReceptorSel(null);
    setReceptorLibre("");
    setUsandoReceptorLibre(false);
    setUnidades([]);
    setResidentes([]);
    if (!token) return;
    setUnidades(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleSeleccionarUnidad = async (opcion: OpcionSelect) => {
    setUnidadSel(opcion);
    setReceptorSel(null);
    setReceptorLibre("");
    setUsandoReceptorLibre(false);
    setResidentes([]);
    if (!token) return;
    setResidentes(await getResidentesPorUnidad(token, opcion.id));
  };

  const nombreReceptorFinal = usandoReceptorLibre ? receptorLibre : receptorSel?.label ?? "";

  const limpiarFormulario = () => {
    setTorreSel(null);
    setUnidadSel(null);
    setTipoSel(null);
    setReceptorSel(null);
    setReceptorLibre("");
    setUsandoReceptorLibre(false);
    setRutReceptor("");
    setFoto(null);
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!torreSel || !unidadSel || !nombreReceptorFinal.trim()) {
      Alert.alert("Faltan datos", "Torre, depto y a quién viene dirigido el paquete son obligatorios.");
      return;
    }
    if (!foto) {
      Alert.alert("Falta la foto", "La foto del paquete es obligatoria para dejar constancia de cómo llegó.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await registrarLlegadaPaquete(token, {
        unidad_id_unidad: unidadSel.id,
        nombre_receptor: nombreReceptorFinal,
        residente_receptor_usuario_id: usandoReceptorLibre ? undefined : receptorSel?.id,
        rut_receptor: rutReceptor.trim() || undefined,
        tipo_paquete_id_tipopaquete: tipoSel?.id,
        foto_recepcion: foto,
        condominio_id_condominio: CONDOMINIO_ID,
      });

      if (!resultado.receptorCoincide) {
        Alert.alert(
          "⚠️ Revisar",
          `"${nombreReceptorFinal}" no coincide con ningún residente registrado en ${unidadSel.label}. Queda registrado igual, para revisión.`
        );
      }

      Alert.alert(
        "Paquete registrado",
        `Queda guardado en portería para ${nombreReceptorFinal} — ${torreSel.label} ${unidadSel.label}.`
      );
      limpiarFormulario();
      navigation.navigate("PaquetePendientes");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <SelectModal
          label="Torre *"
          placeholder="Selecciona una torre"
          opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
          valorSeleccionado={torreSel}
          onSeleccionar={handleSeleccionarTorre}
        />

        <SelectModal
          label="Depto *"
          placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
          opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
          valorSeleccionado={unidadSel}
          onSeleccionar={handleSeleccionarUnidad}
          disabled={!torreSel}
        />

        <SelectModal
          label="A quién viene dirigido *"
          placeholder={unidadSel ? "Selecciona un residente" : "Primero elige el depto"}
          opciones={residentes.map((r) => ({ id: r.id_usuario, label: r.nombre_usuario }))}
          valorSeleccionado={usandoReceptorLibre ? null : receptorSel}
          onSeleccionar={(o) => {
            setReceptorSel(o);
            setUsandoReceptorLibre(false);
          }}
          disabled={!unidadSel}
          extraFooterLabel="No está en la lista / no lo sabe"
          onExtraFooter={() => {
            setUsandoReceptorLibre(true);
            setReceptorSel(null);
          }}
        />

        {usandoReceptorLibre && (
          <>
            <Text style={styles.alerta}>
              No coincide con ningún residente precargado del depto — verifica bien antes de guardarlo.
            </Text>
            <TextInput
              style={styles.input}
              value={receptorLibre}
              onChangeText={setReceptorLibre}
              placeholder="Nombre a quien viene dirigido el paquete"
            />
          </>
        )}

        <Text style={styles.label}>RUT (opcional)</Text>
        <TextInput
          style={styles.input}
          value={rutReceptor}
          onChangeText={setRutReceptor}
          placeholder="Ej: 12.345.678-9"
        />

        <SelectModal
          label="Tipo de paquete (opcional)"
          placeholder="Sin especificar — queda como «Bulto»"
          opciones={tipos.map((t) => ({ id: t.id_tipopaquete, label: t.gls_tipopaquete }))}
          valorSeleccionado={tipoSel}
          onSeleccionar={setTipoSel}
        />

        <FotoCapture label="Foto del paquete *" value={foto} onChange={setFoto} />

        <TouchableOpacity
          style={[styles.boton, enviando && styles.botonDeshabilitado]}
          onPress={handleSubmit}
          disabled={enviando}
        >
          <Text style={styles.botonTexto}>{enviando ? "Registrando..." : "Registrar paquete"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  alerta: { color: "#c0392b", fontSize: 12, marginTop: 8 },
  boton: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 28 },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
