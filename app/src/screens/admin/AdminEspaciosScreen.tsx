import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { adminActualizarEspacio, adminCrearEspacio, adminGetEspacios, getTiposEspacioComun } from "../../api/client";
import { EspacioComun, TipoEspacioComun } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

// Configuración de espacios comunes reservables (ronda 14). Un mismo
// formulario sirve para crear (editId=null) y para editar uno existente
// (editId=id_espaciocomun, precargado con sus valores actuales) — evita
// duplicar los ~15 campos de configuración en dos formularios distintos.
export default function AdminEspaciosScreen() {
  const { token } = useAuth();
  const [espacios, setEspacios] = useState<EspacioComun[]>([]);
  const [tipos, setTipos] = useState<TipoEspacioComun[]>([]);
  const [loading, setLoading] = useState(true);

  const [formVisible, setFormVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipoSel, setTipoSel] = useState<OpcionSelect | null>(null);
  const [capacidad, setCapacidad] = useState("");
  const [reservable, setReservable] = useState(true);
  const [gratuito, setGratuito] = useState(false);
  const [precioBloque, setPrecioBloque] = useState("0");
  const [bloqueHoras, setBloqueHoras] = useState("1");
  const [montoGarantia, setMontoGarantia] = useState("0");
  const [tarifaAtrasoMinuto, setTarifaAtrasoMinuto] = useState("0");
  const [horaApertura, setHoraApertura] = useState("08:00");
  const [horaCierre, setHoraCierre] = useState("22:00");
  const [diasDisponibles, setDiasDisponibles] = useState("");
  const [minutosSeparacion, setMinutosSeparacion] = useState("0");
  const [diasMaxAnticipacion, setDiasMaxAnticipacion] = useState("30");
  const [diasMinCancelacion, setDiasMinCancelacion] = useState("0");
  const [temporadaInicio, setTemporadaInicio] = useState("");
  const [temporadaTermino, setTemporadaTermino] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      setEspacios(await adminGetEspacios(token, CONDOMINIO_ID));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargar();
    }, [cargar])
  );

  useEffect(() => {
    if (!token) return;
    getTiposEspacioComun(token, CONDOMINIO_ID).then(setTipos).catch((e) => Alert.alert("Error", e.message));
  }, [token]);

  const limpiarFormulario = () => {
    setEditId(null);
    setNombre("");
    setTipoSel(null);
    setCapacidad("");
    setReservable(true);
    setGratuito(false);
    setPrecioBloque("0");
    setBloqueHoras("1");
    setMontoGarantia("0");
    setTarifaAtrasoMinuto("0");
    setHoraApertura("08:00");
    setHoraCierre("22:00");
    setDiasDisponibles("");
    setMinutosSeparacion("0");
    setDiasMaxAnticipacion("30");
    setDiasMinCancelacion("0");
    setTemporadaInicio("");
    setTemporadaTermino("");
  };

  const handleNuevo = () => {
    limpiarFormulario();
    setFormVisible(true);
  };

  const handleEditar = (e: EspacioComun) => {
    setEditId(e.id_espaciocomun);
    setNombre(e.nombre);
    setTipoSel({ id: e.tipo_espaciocomun_id_tipoespaciocomun, label: e.gls_tipoespaciocomun });
    setCapacidad(e.capacidad != null ? String(e.capacidad) : "");
    setReservable(!!e.flg_reservable);
    setGratuito(!!e.flg_gratuito);
    setPrecioBloque(String(e.precio_bloque));
    setBloqueHoras(String(e.bloque_horas));
    setMontoGarantia(String(e.monto_garantia));
    setTarifaAtrasoMinuto(String(e.tarifa_atraso_minuto));
    setHoraApertura(e.hora_apertura.slice(0, 5));
    setHoraCierre(e.hora_cierre.slice(0, 5));
    setDiasDisponibles(e.dias_disponibles ?? "");
    setMinutosSeparacion(String(e.minutos_separacion));
    setDiasMaxAnticipacion(String(e.dias_max_anticipacion));
    setDiasMinCancelacion(String(e.dias_min_cancelacion_residente));
    setTemporadaInicio(e.mes_dia_inicio_temporada ?? "");
    setTemporadaTermino(e.mes_dia_termino_temporada ?? "");
    setFormVisible(true);
  };

  const handleGuardar = async () => {
    if (!token || !nombre.trim() || !tipoSel) {
      Alert.alert("Faltan datos", "Nombre y tipo de espacio son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const input = {
        nombre: nombre.trim(),
        tipo_espaciocomun_id_tipoespaciocomun: tipoSel.id,
        capacidad: capacidad.trim() ? Number(capacidad) : undefined,
        flg_reservable: reservable ? 1 : 0,
        flg_gratuito: gratuito ? 1 : 0,
        precio_bloque: Number(precioBloque) || 0,
        bloque_horas: String(Number(bloqueHoras) || 1),
        monto_garantia: Number(montoGarantia) || 0,
        tarifa_atraso_minuto: Number(tarifaAtrasoMinuto) || 0,
        hora_apertura: horaApertura,
        hora_cierre: horaCierre,
        dias_disponibles: diasDisponibles.trim() || undefined,
        minutos_separacion: Number(minutosSeparacion) || 0,
        dias_max_anticipacion: Number(diasMaxAnticipacion) || 0,
        dias_min_cancelacion_residente: Number(diasMinCancelacion) || 0,
        mes_dia_inicio_temporada: temporadaInicio.trim() || undefined,
        mes_dia_termino_temporada: temporadaTermino.trim() || undefined,
      };
      if (editId) {
        await adminActualizarEspacio(token, editId, input);
      } else {
        await adminCrearEspacio(token, input);
      }
      limpiarFormulario();
      setFormVisible(false);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleVigencia = async (e: EspacioComun) => {
    if (!token) return;
    try {
      await adminActualizarEspacio(token, e.id_espaciocomun, { flg_vigencia: e.flg_vigencia ? 0 : 1 });
      cargar();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={espacios}
      keyExtractor={(item) => String(item.id_espaciocomun)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View>
          {formVisible ? (
            <View style={styles.form}>
              <Text style={styles.formTitulo}>{editId ? "Editar espacio" : "Nuevo espacio"}</Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Quincho" />

              <SelectModal
                label="Tipo *"
                placeholder="Selecciona un tipo"
                opciones={tipos.map((t) => ({ id: t.id_tipoespaciocomun, label: t.gls_tipoespaciocomun }))}
                valorSeleccionado={tipoSel}
                onSeleccionar={setTipoSel}
              />

              <Text style={styles.label}>Capacidad (personas, opcional)</Text>
              <TextInput style={styles.input} value={capacidad} onChangeText={setCapacidad} keyboardType="numeric" />

              <View style={styles.tipoCupoSelector}>
                <TouchableOpacity
                  style={[styles.tipoCupoBoton, reservable && styles.tipoCupoBotonActivo]}
                  onPress={() => setReservable(true)}
                >
                  <Text style={[styles.tipoCupoTexto, reservable && styles.tipoCupoTextoActivo]}>Reservable</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tipoCupoBoton, !reservable && styles.tipoCupoBotonActivo]}
                  onPress={() => setReservable(false)}
                >
                  <Text style={[styles.tipoCupoTexto, !reservable && styles.tipoCupoTextoActivo]}>
                    No reservable
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tipoCupoSelector}>
                <TouchableOpacity
                  style={[styles.tipoCupoBoton, !gratuito && styles.tipoCupoBotonActivo]}
                  onPress={() => setGratuito(false)}
                >
                  <Text style={[styles.tipoCupoTexto, !gratuito && styles.tipoCupoTextoActivo]}>Pagado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tipoCupoBoton, gratuito && styles.tipoCupoBotonActivo]}
                  onPress={() => setGratuito(true)}
                >
                  <Text style={[styles.tipoCupoTexto, gratuito && styles.tipoCupoTextoActivo]}>Gratuito</Text>
                </TouchableOpacity>
              </View>

              {!gratuito && (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Precio por bloque</Text>
                    <TextInput style={styles.input} value={precioBloque} onChangeText={setPrecioBloque} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bloque (horas)</Text>
                    <TextInput style={styles.input} value={bloqueHoras} onChangeText={setBloqueHoras} keyboardType="numeric" />
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Garantía ($)</Text>
                  <TextInput style={styles.input} value={montoGarantia} onChangeText={setMontoGarantia} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Atraso ($/min)</Text>
                  <TextInput
                    style={styles.input}
                    value={tarifaAtrasoMinuto}
                    onChangeText={setTarifaAtrasoMinuto}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora apertura</Text>
                  <TextInput style={styles.input} value={horaApertura} onChangeText={setHoraApertura} placeholder="HH:MM" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hora cierre</Text>
                  <TextInput style={styles.input} value={horaCierre} onChangeText={setHoraCierre} placeholder="HH:MM" />
                </View>
              </View>

              <Text style={styles.label}>Días disponibles (1=lunes..7=domingo, vacío = todos)</Text>
              <TextInput
                style={styles.input}
                value={diasDisponibles}
                onChangeText={setDiasDisponibles}
                placeholder="Ej: 5,6,7"
                autoCapitalize="none"
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Separación (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={minutosSeparacion}
                    onChangeText={setMinutosSeparacion}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Máx. anticipación (días)</Text>
                  <TextInput
                    style={styles.input}
                    value={diasMaxAnticipacion}
                    onChangeText={setDiasMaxAnticipacion}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.label}>Mín. días para cancelar (residente)</Text>
              <TextInput
                style={styles.input}
                value={diasMinCancelacion}
                onChangeText={setDiasMinCancelacion}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Temporada (opcional, formato MM-DD)</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={temporadaInicio}
                  onChangeText={setTemporadaInicio}
                  placeholder="Inicio: 12-01"
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={temporadaTermino}
                  onChangeText={setTemporadaTermino}
                  placeholder="Término: 02-28"
                  autoCapitalize="none"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.botonCrear, { flex: 1 }]}
                  onPress={handleGuardar}
                  disabled={guardando}
                >
                  <Text style={styles.botonCrearTexto}>{guardando ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonCrear, { flex: 1, backgroundColor: "#999" }]}
                  onPress={() => {
                    limpiarFormulario();
                    setFormVisible(false);
                  }}
                >
                  <Text style={styles.botonCrearTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.botonCrear} onPress={handleNuevo}>
              <Text style={styles.botonCrearTexto}>+ Nuevo espacio</Text>
            </TouchableOpacity>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Todavía no hay espacios comunes configurados.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreItem}>{item.nombre}</Text>
              <Text style={styles.detalle}>
                {item.gls_tipoespaciocomun} · {item.flg_vigencia ? "Activo" : "Inactivo"}
                {!item.flg_reservable ? " · No reservable" : ""}
              </Text>
              <Text style={styles.detalle}>
                {item.flg_gratuito ? "Gratuito" : `${formatearMonto(item.precio_bloque)} / ${item.bloque_horas}h`}
                {item.monto_garantia ? ` · Garantía ${formatearMonto(item.monto_garantia)}` : ""}
              </Text>
              <Text style={styles.detalle}>
                {item.hora_apertura.slice(0, 5)} a {item.hora_cierre.slice(0, 5)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.botonToggle, item.flg_vigencia ? styles.botonDesactivar : styles.botonActivar]}
              onPress={() => handleToggleVigencia(item)}
            >
              <Text style={styles.botonToggleTexto}>{item.flg_vigencia ? "Desactivar" : "Activar"}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ marginTop: 8 }} onPress={() => handleEditar(item)}>
            <Text style={styles.enlaceEditar}>Editar configuración</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6f8" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 },
  formTitulo: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginTop: 4,
  },
  tipoCupoSelector: { flexDirection: "row", gap: 10, marginTop: 12 },
  tipoCupoBoton: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  tipoCupoBotonActivo: { backgroundColor: "#1a6fc4", borderColor: "#1a6fc4" },
  tipoCupoTexto: { fontWeight: "600", color: "#333", fontSize: 13 },
  tipoCupoTextoActivo: { color: "#fff" },
  botonCrear: { backgroundColor: "#1a9d5c", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 4 },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  nombreItem: { fontSize: 16, fontWeight: "700" },
  detalle: { color: "#666", marginTop: 2, fontSize: 13 },
  botonToggle: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  botonActivar: { backgroundColor: "#1a9d5c" },
  botonDesactivar: { backgroundColor: "#c0392b" },
  botonToggleTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  enlaceEditar: { color: "#1a6fc4", fontSize: 12, fontWeight: "600" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
});
