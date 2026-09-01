import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  adminActualizarMantencion,
  adminCancelarMantencion,
  adminGetElementosMantencion,
  adminGetMantencion,
  adminSubirDatosFinalesMantencion,
} from "../../api/client";
import { Mantencion, TipoElementoMantencion } from "../../api/types";
import { API_BASE_URL, CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";
import FotoCapture from "../../components/FotoCapture";

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

function formatearFecha(fechaMysql: string | null) {
  if (!fechaMysql) return "—";
  const iso = fechaMysql.replace(" ", "T");
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function urlCompleta(path: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

// Ronda 19: detalle completo de una mantención para Administrador/Comité.
// Mientras está Programada se puede editar o cancelar (con motivo
// obligatorio); comprobante/foto/costo real se suben después, en cualquier
// momento salvo que ya esté Cancelada (regla del usuario: "Administrador/
// Comité, después").
export default function AdminMantencionDetalleScreen({ route }: any) {
  const { id } = route.params as { id: number };
  const { token } = useAuth();
  const [mantencion, setMantencion] = useState<Mantencion | null>(null);
  const [elementos, setElementos] = useState<TipoElementoMantencion[]>([]);
  const [loading, setLoading] = useState(true);

  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [elementoSel, setElementoSel] = useState<OpcionSelect | null>(null);
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [costoEstimado, setCostoEstimado] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  const [foto, setFoto] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [costoReal, setCostoReal] = useState("");
  const [subiendoDatos, setSubiendoDatos] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [m, listaElementos] = await Promise.all([
        adminGetMantencion(token, id),
        adminGetElementosMantencion(token, CONDOMINIO_ID, true),
      ]);
      setMantencion(m);
      setElementos(listaElementos);
      setCostoReal(m.costo_real != null ? String(m.costo_real) : "");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  const iniciarEdicion = () => {
    if (!mantencion) return;
    setTitulo(mantencion.titulo);
    setDescripcion(mantencion.descripcion);
    setElementoSel({ id: mantencion.tipo_elemento_mantencion_id_tipoelementomantencion, label: mantencion.gls_tipoelementomantencion });
    setFechaProgramada(mantencion.fecha_programada);
    setCostoEstimado(mantencion.costo_estimado != null ? String(mantencion.costo_estimado) : "");
    setEditando(true);
  };

  const handleGuardarEdicion = async () => {
    if (!token || !mantencion) return;
    if (!titulo.trim() || !descripcion.trim() || !elementoSel || !/^\d{4}-\d{2}-\d{2}$/.test(fechaProgramada)) {
      Alert.alert("Faltan datos", "Título, descripción, elemento y fecha programada (AAAA-MM-DD) son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      await adminActualizarMantencion(token, mantencion.id_mantencion, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        tipo_elemento_mantencion_id_tipoelementomantencion: elementoSel.id,
        fecha_programada: fechaProgramada,
        costo_estimado: costoEstimado.trim() ? Number(costoEstimado) : null,
      });
      setEditando(false);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarCancelacion = async () => {
    if (!token || !mantencion) return;
    if (!motivoCancelacion.trim()) {
      Alert.alert("Falta el motivo", "El motivo de la cancelación es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      await adminCancelarMantencion(token, mantencion.id_mantencion, motivoCancelacion.trim());
      setCancelando(false);
      setMotivoCancelacion("");
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleSubirDatosFinales = async () => {
    if (!token || !mantencion) return;
    setSubiendoDatos(true);
    try {
      await adminSubirDatosFinalesMantencion(token, mantencion.id_mantencion, {
        comprobante: comprobante ?? undefined,
        foto: foto ?? undefined,
        costo_real: costoReal.trim() ? Number(costoReal) : undefined,
      });
      setFoto(null);
      setComprobante(null);
      cargar();
      Alert.alert("Guardado", "Se actualizaron los datos finales de la mantención.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubiendoDatos(false);
    }
  };

  if (loading || !mantencion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const esProgramada = mantencion.gls_estadomantencion === "Programada";
  const esCancelada = mantencion.gls_estadomantencion === "Cancelada";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      {editando ? (
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Editar mantención</Text>

          <Text style={styles.label}>Título *</Text>
          <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} />

          <SelectModal
            label="Elemento de infraestructura *"
            placeholder="Selecciona un elemento"
            opciones={elementos.map((e) => ({ id: e.id_tipoelementomantencion, label: e.gls_tipoelementomantencion }))}
            valorSeleccionado={elementoSel}
            onSeleccionar={setElementoSel}
          />

          <Text style={styles.label}>Descripción del trabajo *</Text>
          <TextInput style={[styles.input, { height: 80 }]} value={descripcion} onChangeText={setDescripcion} multiline />

          <Text style={styles.label}>Fecha programada *</Text>
          <TextInput style={styles.input} value={fechaProgramada} onChangeText={setFechaProgramada} placeholder="AAAA-MM-DD" autoCapitalize="none" />

          <Text style={styles.label}>Costo estimado (opcional)</Text>
          <TextInput style={styles.input} value={costoEstimado} onChangeText={setCostoEstimado} keyboardType="numeric" />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
            <TouchableOpacity style={[styles.boton, styles.botonPrimario, { flex: 1 }]} onPress={handleGuardarEdicion} disabled={guardando}>
              <Text style={styles.botonTexto}>{guardando ? "Guardando..." : "Guardar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.boton, { backgroundColor: "#999", flex: 1 }]} onPress={() => setEditando(false)}>
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitulo}>{mantencion.titulo}</Text>
            <Text style={styles.estado}>{mantencion.gls_estadomantencion}</Text>
          </View>
          <Text style={styles.detalle}>{mantencion.gls_tipoelementomantencion}</Text>
          <Text style={styles.detalle}>{mantencion.descripcion}</Text>
          <Text style={styles.detalle}>Programada: {mantencion.fecha_programada}</Text>
          {mantencion.costo_estimado != null && <Text style={styles.detalle}>Costo estimado: {formatearMonto(mantencion.costo_estimado)}</Text>}
          <Text style={styles.detalle}>Creada por {mantencion.nombre_creador} · {formatearFecha(mantencion.fecha_creacion)}</Text>

          {esProgramada && !cancelando && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.boton, styles.botonPrimario, { flex: 1 }]} onPress={iniciarEdicion}>
                <Text style={styles.botonTexto}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.boton, styles.botonPeligro, { flex: 1 }]} onPress={() => setCancelando(true)}>
                <Text style={styles.botonTexto}>Cancelar mantención</Text>
              </TouchableOpacity>
            </View>
          )}

          {cancelando && (
            <View style={{ marginTop: 12 }}>
              <TextInput
                style={styles.input}
                placeholder="Motivo de la cancelación"
                value={motivoCancelacion}
                onChangeText={setMotivoCancelacion}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.boton, styles.botonPeligro, { flex: 1 }]} onPress={handleConfirmarCancelacion} disabled={guardando}>
                  <Text style={styles.botonTexto}>{guardando ? "Guardando..." : "Confirmar cancelación"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.boton, { backgroundColor: "#999", flex: 1 }]}
                  onPress={() => {
                    setCancelando(false);
                    setMotivoCancelacion("");
                  }}
                >
                  <Text style={styles.botonTexto}>Volver</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {(mantencion.empresa_nombre || mantencion.fecha_hora_llegada) && (
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Empresa</Text>
          <Text style={styles.detalle}>Empresa: {mantencion.empresa_nombre ?? "—"}</Text>
          <Text style={styles.detalle}>
            Contacto: {mantencion.persona_nombre ?? "—"}
            {mantencion.persona_rut ? ` · RUT ${mantencion.persona_rut}` : ""}
          </Text>
          <Text style={styles.detalle}>
            Ingreso: {formatearFecha(mantencion.fecha_hora_llegada)}
            {mantencion.nombre_guardia_llegada ? ` (${mantencion.nombre_guardia_llegada})` : ""}
          </Text>
          <Text style={styles.detalle}>
            Salida: {formatearFecha(mantencion.fecha_hora_salida)}
            {mantencion.nombre_guardia_salida ? ` (${mantencion.nombre_guardia_salida})` : ""}
          </Text>
        </View>
      )}

      {esCancelada && (
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Cancelación</Text>
          <Text style={styles.detalle}>Motivo: {mantencion.motivo_cancelacion}</Text>
          <Text style={styles.detalle}>
            {formatearFecha(mantencion.fecha_cancelacion)}
            {mantencion.nombre_cancelo ? ` · ${mantencion.nombre_cancelo}` : ""}
          </Text>
        </View>
      )}

      {!esCancelada && (
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Comprobante y costo real</Text>

          {mantencion.comprobante_url && (
            <Image source={{ uri: urlCompleta(mantencion.comprobante_url)! }} style={styles.preview} resizeMode="contain" />
          )}
          {mantencion.foto_resultado_url && (
            <Image source={{ uri: urlCompleta(mantencion.foto_resultado_url)! }} style={styles.preview} resizeMode="cover" />
          )}
          {mantencion.costo_real != null && <Text style={styles.detalle}>Costo real: {formatearMonto(mantencion.costo_real)}</Text>}

          <FotoCapture label="Foto/comprobante de la factura (opcional)" value={comprobante} onChange={setComprobante} />
          <FotoCapture label="Foto del resultado del trabajo (opcional)" value={foto} onChange={setFoto} />

          <Text style={styles.label}>Costo real (opcional, solo informativo)</Text>
          <TextInput style={styles.input} value={costoReal} onChangeText={setCostoReal} keyboardType="numeric" />

          <TouchableOpacity style={[styles.boton, styles.botonPrimario, { marginTop: 12 }]} onPress={handleSubirDatosFinales} disabled={subiendoDatos}>
            <Text style={styles.botonTexto}>{subiendoDatos ? "Guardando..." : "Guardar comprobante/costo"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#eee" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitulo: { fontSize: 16, fontWeight: "700", flex: 1 },
  estado: { fontSize: 12, fontWeight: "800", color: "#1a6fc4" },
  detalle: { color: "#555", marginTop: 6, fontSize: 13 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, marginTop: 4 },
  boton: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  botonPrimario: { backgroundColor: "#795548" },
  botonPeligro: { backgroundColor: "#c0392b" },
  botonTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
  preview: { height: 160, borderRadius: 10, marginTop: 10, backgroundColor: "#fafafa" },
});
