import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { adminReporteGastoComun, urlReporteGastoComunExcel } from "../../api/client";
import { ReporteGastoComunDetalleItem, ReporteGastoComunResumenDepto } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { descargarYCompartirArchivo } from "../../utils/descargas";

function formatearMonto(monto: number) {
  return `$${monto.toLocaleString("es-CL")}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function primerDiaDelMes() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function hoyComoTexto() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

type Seccion = {
  title: string;
  subtitulo: string;
  data: ReporteGastoComunDetalleItem[];
};

export default function AdminReporteGastoComunScreen() {
  const { token } = useAuth();
  const [fechaInicio, setFechaInicio] = useState(primerDiaDelMes());
  const [fechaTermino, setFechaTermino] = useState(hoyComoTexto());
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [resumen, setResumen] = useState<ReporteGastoComunResumenDepto[]>([]);
  const [detalle, setDetalle] = useState<ReporteGastoComunDetalleItem[]>([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [exportando, setExportando] = useState(false);

  const secciones: Seccion[] = useMemo(
    () =>
      resumen.map((r) => ({
        title: `${r.nombre_torre} · Depto ${r.numero_unidad}`,
        subtitulo: `${r.cantidad_cobros} cobro${r.cantidad_cobros === 1 ? "" : "s"} · ${formatearMonto(r.total_cobrar)}`,
        data: detalle.filter((d) => d.unidad_id_unidad === r.unidad_id_unidad),
      })),
    [resumen, detalle]
  );

  const handleBuscar = async () => {
    if (!token) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaTermino)) {
      Alert.alert("Fechas inválidas", "Usa el formato AAAA-MM-DD, por ejemplo 2026-08-01.");
      return;
    }
    setBuscando(true);
    try {
      const data = await adminReporteGastoComun(token, fechaInicio, fechaTermino, CONDOMINIO_ID);
      setResumen(data.resumenPorDepto);
      setDetalle(data.detalle);
      setTotalGeneral(data.totalGeneral);
      setBuscado(true);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleExportar = async () => {
    if (!token) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaTermino)) {
      Alert.alert("Fechas inválidas", "Usa el formato AAAA-MM-DD, por ejemplo 2026-08-01.");
      return;
    }
    setExportando(true);
    try {
      const url = urlReporteGastoComunExcel(fechaInicio, fechaTermino, CONDOMINIO_ID);
      await descargarYCompartirArchivo(url, token, `gasto-comun-${fechaInicio}-a-${fechaTermino}.xlsx`);
    } catch (e: any) {
      Alert.alert("Error al exportar", e.message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.filtros}>
        <View style={styles.filaFechas}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fecha inicio</Text>
            <TextInput
              style={styles.input}
              value={fechaInicio}
              onChangeText={setFechaInicio}
              placeholder="AAAA-MM-DD"
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fecha término</Text>
            <TextInput
              style={styles.input}
              value={fechaTermino}
              onChangeText={setFechaTermino}
              placeholder="AAAA-MM-DD"
              autoCapitalize="none"
            />
          </View>
        </View>
        <TouchableOpacity style={styles.boton} onPress={handleBuscar} disabled={buscando}>
          {buscando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Buscar</Text>}
        </TouchableOpacity>

        {buscado && (
          <Text style={styles.totalGeneral}>
            Total del período: {formatearMonto(totalGeneral)} ({detalle.length} cobro
            {detalle.length === 1 ? "" : "s"} en {resumen.length} depto{resumen.length === 1 ? "" : "s"})
          </Text>
        )}

        <TouchableOpacity style={styles.botonExportar} onPress={handleExportar} disabled={exportando}>
          {exportando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonExportarTexto}>Exportar a Excel (para ComunidadFeliz)</Text>
          )}
        </TouchableOpacity>
      </View>

      {buscado && (
        <SectionList
          sections={secciones}
          keyExtractor={(item) => String(item.id_constancia)}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}
          ListEmptyComponent={
            <Text style={styles.vacio}>
              No hay cobros de estacionamientos de visita en ese rango de fechas.
            </Text>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.seccionHeader}>
              <Text style={styles.seccionTitulo}>{section.title}</Text>
              <Text style={styles.seccionSubtitulo}>{section.subtitulo}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre_visita}</Text>
                <Text style={styles.detalleTexto}>
                  {item.concepto}
                  {item.minutos_extras ? ` · ${item.minutos_extras} min de exceso` : ""}
                  {item.patente ? ` · ${item.patente}` : ""}
                </Text>
                <Text style={styles.detalleTexto}>
                  Entró: {formatearFecha(item.fecha_entrada)} {formatearHora(item.hora_entrada)}
                  {item.fecha_salida
                    ? `  ·  Salió: ${formatearFecha(item.fecha_salida)} ${formatearHora(item.hora_salida!)}`
                    : ""}
                </Text>
              </View>
              <Text style={styles.monto}>{formatearMonto(item.monto_cobrar)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filtros: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  filaFechas: { flexDirection: "row", gap: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#333", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  boton: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  botonTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  totalGeneral: { marginTop: 12, fontSize: 15, fontWeight: "700", color: "#1a6fc4" },
  botonExportar: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  botonExportarTexto: { color: "#fff", fontSize: 15, fontWeight: "700" },
  vacio: { textAlign: "center", color: "#888", marginTop: 30 },
  seccionHeader: {
    backgroundColor: "#f5f6f8",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
    borderRadius: 8,
  },
  seccionTitulo: { fontSize: 15, fontWeight: "800", color: "#222" },
  seccionSubtitulo: { fontSize: 12, color: "#666", marginTop: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  nombre: { fontSize: 15, fontWeight: "700" },
  detalleTexto: { color: "#555", marginTop: 2, fontSize: 13 },
  monto: { fontSize: 16, fontWeight: "800", color: "#c0392b", marginLeft: 8 },
});
