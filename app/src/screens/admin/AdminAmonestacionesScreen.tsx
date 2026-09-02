import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  adminAprobarMulta,
  adminActualizarTipoAmonestacion,
  adminActualizarTipoMulta,
  adminCrearAmonestacion,
  adminCrearTipoAmonestacion,
  adminCrearTipoMulta,
  adminGetAmonestaciones,
  adminGetTiposAmonestacion,
  adminGetTiposMulta,
  adminNotificarMulta,
  adminRechazarMulta,
  getTorres,
  getUnidadesPorTorre,
} from "../../api/client";
import { Amonestacion, EstadoAmonestacionGls, TipoAmonestacion, TipoMulta, Torre, Unidad } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";
import { colors, radius, spacing, typography } from "../../theme/theme";

const ESTADO_COLOR: Record<EstadoAmonestacionGls, string> = {
  Enviada: "#DCFCE7",
  "Pendiente de aprobación": "#FEF3C7",
  Aprobada: "#DBEAFE",
  Rechazada: "#FEE2E2",
  Notificada: "#DCFCE7",
};

type Vista = "listado" | "nueva" | "tipos";

// Ronda 41, a pedido explícito del usuario: módulo de amonestaciones y
// multas. Administrador y Comité pueden usarlo completo (crear, aprobar/
// rechazar multas, gestionar catálogos por condominio) — la ÚNICA acción
// exclusiva del Administrador real es notificar una multa ya aprobada al
// residente (ver handleNotificar, que oculta el botón si el rol no calza;
// el backend igual lo vuelve a validar).
export default function AdminAmonestacionesScreen() {
  const { token, rol } = useAuth();
  const [vista, setVista] = useState<Vista>("listado");

  const [amonestaciones, setAmonestaciones] = useState<Amonestacion[]>([]);
  const [tiposAmonestacion, setTiposAmonestacion] = useState<TipoAmonestacion[]>([]);
  const [tiposMulta, setTiposMulta] = useState<TipoMulta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("Todas");

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([
      adminGetAmonestaciones(token, CONDOMINIO_ID),
      adminGetTiposAmonestacion(token, CONDOMINIO_ID),
      adminGetTiposMulta(token, CONDOMINIO_ID),
    ])
      .then(([a, ta, tm]) => {
        setAmonestaciones(a);
        setTiposAmonestacion(ta);
        setTiposMulta(tm);
      })
      .catch((e) => Alert.alert("Error", e.message))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const amonestacionesFiltradas = useMemo(() => {
    if (filtroEstado === "Todas") return amonestaciones;
    return amonestaciones.filter((a) => a.estado === filtroEstado);
  }, [amonestaciones, filtroEstado]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <View style={styles.tabs}>
        {(
          [
            { id: "listado" as Vista, label: "Listado" },
            { id: "nueva" as Vista, label: "Nueva" },
            { id: "tipos" as Vista, label: "Tipos" },
          ] as const
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, vista === t.id && styles.tabActivo]}
            onPress={() => setVista(t.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTexto, vista === t.id && styles.tabTextoActivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {vista === "listado" && (
        <Listado
          amonestaciones={amonestacionesFiltradas}
          filtroEstado={filtroEstado}
          setFiltroEstado={setFiltroEstado}
          rol={rol}
          onCambio={cargar}
        />
      )}
      {vista === "nueva" && (
        <NuevaAmonestacion tiposAmonestacion={tiposAmonestacion} tiposMulta={tiposMulta} onCreada={() => { cargar(); setVista("listado"); }} />
      )}
      {vista === "tipos" && (
        <GestionTipos tiposAmonestacion={tiposAmonestacion} tiposMulta={tiposMulta} onCambio={cargar} />
      )}
    </View>
  );
}

function Listado({
  amonestaciones,
  filtroEstado,
  setFiltroEstado,
  rol,
  onCambio,
}: {
  amonestaciones: Amonestacion[];
  filtroEstado: string;
  setFiltroEstado: (v: string) => void;
  rol: string | null;
  onCambio: () => void;
}) {
  const { token } = useAuth();
  const [procesando, setProcesando] = useState<number | null>(null);

  const handleAprobar = async (a: Amonestacion) => {
    if (!token) return;
    setProcesando(a.id_amonestacion);
    try {
      await adminAprobarMulta(token, a.id_amonestacion);
      onCambio();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setProcesando(null);
    }
  };

  const handleRechazar = (a: Amonestacion) => {
    Alert.prompt?.(
      "Rechazar multa",
      "Explica por qué se rechaza:",
      async (motivo) => {
        if (!token || !motivo?.trim()) return;
        setProcesando(a.id_amonestacion);
        try {
          await adminRechazarMulta(token, a.id_amonestacion, motivo.trim());
          onCambio();
        } catch (e: any) {
          Alert.alert("Error", e.message);
        } finally {
          setProcesando(null);
        }
      },
      "plain-text"
    );
  };

  const handleNotificar = (a: Amonestacion) => {
    if (!token) return;
    Alert.alert("Notificar al residente", `Se le va a avisar al depto ${a.numero_unidad} sobre esta multa. ¿Continuar?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Notificar",
        onPress: async () => {
          setProcesando(a.id_amonestacion);
          try {
            await adminNotificarMulta(token, a.id_amonestacion);
            onCambio();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setProcesando(null);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.lista}>
      <View style={styles.filtroEstados}>
        {["Todas", "Pendiente de aprobación", "Aprobada", "Notificada", "Rechazada", "Enviada"].map((e) => (
          <TouchableOpacity
            key={e}
            style={[styles.filtroChip, filtroEstado === e && styles.filtroChipActivo]}
            onPress={() => setFiltroEstado(e)}
          >
            <Text style={[styles.filtroChipTexto, filtroEstado === e && styles.filtroChipTextoActivo]} numberOfLines={1}>
              {e}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {amonestaciones.length === 0 && <Text style={styles.vacio}>No hay amonestaciones con este filtro.</Text>}

      {amonestaciones.map((a) => (
        <View key={a.id_amonestacion} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.depto}>
              {a.nombre_torre} {a.numero_unidad}
            </Text>
            <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[a.estado] }]}>
              <Text style={styles.badgeTexto}>{a.estado}</Text>
            </View>
          </View>
          <Text style={styles.tipo}>
            {a.gls_tipoamonestacion}
            {a.flg_es_multa && a.monto ? ` — ${a.monto} ${a.unidad_monto} (${a.gls_tipomulta})` : ""}
          </Text>
          <Text style={styles.descripcion}>{a.descripcion}</Text>
          <Text style={styles.meta}>
            Hecho el {a.fecha_hecho} · Creado por {a.nombre_creador}
          </Text>
          {a.motivo_rechazo && <Text style={styles.motivoRechazo}>Rechazada: {a.motivo_rechazo}</Text>}
          {a.nombre_aprobador && <Text style={styles.meta}>Aprobada por {a.nombre_aprobador}</Text>}
          {a.nombre_notificador && <Text style={styles.meta}>Notificada por {a.nombre_notificador}</Text>}

          {a.estado === "Pendiente de aprobación" && (
            <View style={styles.acciones}>
              <TouchableOpacity
                style={styles.botonAprobar}
                onPress={() => handleAprobar(a)}
                disabled={procesando === a.id_amonestacion}
              >
                <Text style={styles.botonAprobarTexto}>{procesando === a.id_amonestacion ? "..." : "Aprobar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.botonRechazar}
                onPress={() => handleRechazar(a)}
                disabled={procesando === a.id_amonestacion}
              >
                <Text style={styles.botonRechazarTexto}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          )}
          {a.estado === "Aprobada" && rol === "Administrador" && (
            <TouchableOpacity
              style={[styles.botonAprobar, { marginTop: spacing.sm }]}
              onPress={() => handleNotificar(a)}
              disabled={procesando === a.id_amonestacion}
            >
              <Text style={styles.botonAprobarTexto}>{procesando === a.id_amonestacion ? "..." : "Notificar al residente"}</Text>
            </TouchableOpacity>
          )}
          {a.estado === "Aprobada" && rol !== "Administrador" && (
            <Text style={styles.ayudaNotificar}>Solo el Administrador puede notificar esta multa al residente.</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function NuevaAmonestacion({
  tiposAmonestacion,
  tiposMulta,
  onCreada,
}: {
  tiposAmonestacion: TipoAmonestacion[];
  tiposMulta: TipoMulta[];
  onCreada: () => void;
}) {
  const { token } = useAuth();
  const [torres, setTorres] = useState<Torre[]>([]);
  const [torreSel, setTorreSel] = useState<OpcionSelect | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [unidadSel, setUnidadSel] = useState<OpcionSelect | null>(null);
  const [tipoSel, setTipoSel] = useState<OpcionSelect | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [fechaHecho, setFechaHecho] = useState(new Date().toISOString().slice(0, 10));
  const [tipoMultaSel, setTipoMultaSel] = useState<OpcionSelect | null>(null);
  const [monto, setMonto] = useState("");
  const [unidadMonto, setUnidadMonto] = useState<"UF" | "UTM">("UF");
  const [creando, setCreando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getTorres(token, CONDOMINIO_ID).then(setTorres);
    }, [token])
  );

  const tipoElegido = tiposAmonestacion.find((t) => t.id_tipoamonestacion === tipoSel?.id);
  const esMulta = !!tipoElegido?.flg_es_multa;

  const handleSeleccionarTorre = async (opcion: OpcionSelect) => {
    setTorreSel(opcion);
    setUnidadSel(null);
    if (!token) return;
    setUnidades(await getUnidadesPorTorre(token, opcion.id));
  };

  const handleSeleccionarTipoMulta = (opcion: OpcionSelect) => {
    setTipoMultaSel(opcion);
    const tm = tiposMulta.find((t) => t.id_tipomulta === opcion.id);
    if (tm?.monto_sugerido !== null && tm?.monto_sugerido !== undefined) {
      setMonto(String(tm.monto_sugerido));
      setUnidadMonto((tm.unidad_monto as "UF" | "UTM") ?? "UF");
    }
  };

  const handleCrear = async () => {
    if (!token) return;
    if (!unidadSel || !tipoSel || !descripcion.trim() || !fechaHecho) {
      Alert.alert("Faltan datos", "Completa depto, tipo, descripción y fecha.");
      return;
    }
    if (esMulta && (!tipoMultaSel || !monto.trim())) {
      Alert.alert("Faltan datos de la multa", "Elige el motivo y el monto.");
      return;
    }
    setCreando(true);
    try {
      await adminCrearAmonestacion(token, CONDOMINIO_ID, {
        unidad_id_unidad: unidadSel.id,
        tipo_amonestacion_id_tipoamonestacion: tipoSel.id,
        descripcion: descripcion.trim(),
        fecha_hecho: fechaHecho,
        tipo_multa_id_tipomulta: esMulta ? tipoMultaSel!.id : undefined,
        monto: esMulta ? Number(monto) : undefined,
        unidad_monto: esMulta ? unidadMonto : undefined,
      });
      Alert.alert(
        "Listo",
        esMulta
          ? "La multa quedó pendiente de aprobación del comité."
          : "La amonestación se envió y notificó al residente."
      );
      setUnidadSel(null);
      setTorreSel(null);
      setTipoSel(null);
      setDescripcion("");
      setTipoMultaSel(null);
      setMonto("");
      onCreada();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
      <View style={styles.card}>
        <SelectModal
          label="Torre"
          placeholder="Selecciona una torre"
          opciones={torres.map((t) => ({ id: t.id_torreblock, label: t.nombre_torre }))}
          valorSeleccionado={torreSel}
          onSeleccionar={handleSeleccionarTorre}
        />
        <SelectModal
          label="Depto"
          placeholder={torreSel ? "Selecciona un depto" : "Primero elige la torre"}
          opciones={unidades.map((u) => ({ id: u.id_unidad, label: u.numero_unidad }))}
          valorSeleccionado={unidadSel}
          onSeleccionar={setUnidadSel}
          disabled={!torreSel}
        />
        <SelectModal
          label="Tipo de amonestación"
          placeholder="Selecciona un tipo"
          opciones={tiposAmonestacion.map((t) => ({
            id: t.id_tipoamonestacion,
            label: t.gls_tipoamonestacion + (t.flg_es_multa ? " (multa)" : ""),
          }))}
          valorSeleccionado={tipoSel}
          onSeleccionar={setTipoSel}
        />

        <Text style={styles.label}>Descripción de la falta</Text>
        <TextInput
          style={[styles.input, styles.inputMultilinea]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="¿Qué pasó?"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <Text style={styles.label}>Fecha en que ocurrió</Text>
        <TextInput style={styles.input} value={fechaHecho} onChangeText={setFechaHecho} placeholder="AAAA-MM-DD" />

        {esMulta && (
          <>
            <Text style={styles.avisoMulta}>
              Esta es una multa — queda pendiente de aprobación del comité antes de poder notificarse.
            </Text>
            <SelectModal
              label="Motivo de la multa"
              placeholder="Selecciona un motivo"
              opciones={tiposMulta.map((t) => ({ id: t.id_tipomulta, label: t.gls_tipomulta }))}
              valorSeleccionado={tipoMultaSel}
              onSeleccionar={handleSeleccionarTipoMulta}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Monto</Text>
                <TextInput style={styles.input} value={monto} onChangeText={setMonto} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unidad</Text>
                <View style={styles.filaOpciones}>
                  {(["UF", "UTM"] as const).map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.opcionChica, unidadMonto === u && styles.opcionChicaActiva]}
                      onPress={() => setUnidadMonto(u)}
                    >
                      <Text style={[styles.opcionChicaTexto, unidadMonto === u && styles.opcionChicaTextoActivo]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity style={[styles.botonCrear, creando && styles.botonDeshabilitado]} onPress={handleCrear} disabled={creando}>
          {creando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonCrearTexto}>{esMulta ? "Enviar a aprobación" : "Enviar amonestación"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function GestionTipos({
  tiposAmonestacion,
  tiposMulta,
  onCambio,
}: {
  tiposAmonestacion: TipoAmonestacion[];
  tiposMulta: TipoMulta[];
  onCambio: () => void;
}) {
  const { token } = useAuth();
  const [subvista, setSubvista] = useState<"amonestacion" | "multa">("amonestacion");

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [esMultaNuevo, setEsMultaNuevo] = useState(false);
  const [montoNuevo, setMontoNuevo] = useState("");
  const [unidadNuevo, setUnidadNuevo] = useState<"UF" | "UTM">("UF");
  const [creando, setCreando] = useState(false);

  const handleCrear = async () => {
    if (!token || !nombreNuevo.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre del tipo nuevo.");
      return;
    }
    setCreando(true);
    try {
      if (subvista === "amonestacion") {
        await adminCrearTipoAmonestacion(token, CONDOMINIO_ID, {
          gls_tipoamonestacion: nombreNuevo.trim(),
          flg_es_multa: esMultaNuevo ? 1 : 0,
        });
      } else {
        await adminCrearTipoMulta(token, CONDOMINIO_ID, {
          gls_tipomulta: nombreNuevo.trim(),
          monto_sugerido: montoNuevo.trim() ? Number(montoNuevo) : undefined,
          unidad_monto: unidadNuevo,
        });
      }
      setNombreNuevo("");
      setEsMultaNuevo(false);
      setMontoNuevo("");
      onCambio();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggleVigenciaAmonestacion = async (t: TipoAmonestacion) => {
    if (!token) return;
    try {
      await adminActualizarTipoAmonestacion(token, t.id_tipoamonestacion, { flg_vigencia: t.flg_vigencia ? 0 : 1 });
      onCambio();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleToggleVigenciaMulta = async (t: TipoMulta) => {
    if (!token) return;
    try {
      await adminActualizarTipoMulta(token, t.id_tipomulta, { flg_vigencia: t.flg_vigencia ? 0 : 1 });
      onCambio();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
      <View style={styles.filtroEstados}>
        <TouchableOpacity
          style={[styles.filtroChip, subvista === "amonestacion" && styles.filtroChipActivo]}
          onPress={() => setSubvista("amonestacion")}
        >
          <Text style={[styles.filtroChipTexto, subvista === "amonestacion" && styles.filtroChipTextoActivo]}>
            Tipos de amonestación
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroChip, subvista === "multa" && styles.filtroChipActivo]}
          onPress={() => setSubvista("multa")}
        >
          <Text style={[styles.filtroChipTexto, subvista === "multa" && styles.filtroChipTextoActivo]}>Motivos de multa</Text>
        </TouchableOpacity>
      </View>

      {subvista === "amonestacion"
        ? tiposAmonestacion.map((t) => (
            <View key={t.id_tipoamonestacion} style={[styles.card, styles.filaTipo]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombreTipo}>{t.gls_tipoamonestacion}</Text>
                {!!t.flg_es_multa && <Text style={styles.etiquetaMulta}>Implica multa</Text>}
              </View>
              <TouchableOpacity onPress={() => handleToggleVigenciaAmonestacion(t)}>
                <Text style={t.flg_vigencia ? styles.linkDesactivar : styles.linkActivar}>
                  {t.flg_vigencia ? "Desactivar" : "Activar"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        : tiposMulta.map((t) => (
            <View key={t.id_tipomulta} style={[styles.card, styles.filaTipo]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombreTipo}>{t.gls_tipomulta}</Text>
                {t.monto_sugerido !== null && (
                  <Text style={styles.etiquetaMulta}>
                    Sugerido: {t.monto_sugerido} {t.unidad_monto}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleToggleVigenciaMulta(t)}>
                <Text style={t.flg_vigencia ? styles.linkDesactivar : styles.linkActivar}>
                  {t.flg_vigencia ? "Desactivar" : "Activar"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

      <Text style={styles.subtitulo}>Agregar {subvista === "amonestacion" ? "un tipo de amonestación" : "un motivo de multa"}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={nombreNuevo} onChangeText={setNombreNuevo} placeholder="Nombre" />
        {subvista === "amonestacion" ? (
          <TouchableOpacity style={styles.checkboxFila} onPress={() => setEsMultaNuevo(!esMultaNuevo)}>
            <View style={[styles.checkbox, esMultaNuevo && styles.checkboxActivo]} />
            <Text style={styles.checkboxTexto}>Este tipo implica una multa económica</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Monto sugerido</Text>
              <TextInput style={styles.input} value={montoNuevo} onChangeText={setMontoNuevo} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unidad</Text>
              <View style={styles.filaOpciones}>
                {(["UF", "UTM"] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.opcionChica, unidadNuevo === u && styles.opcionChicaActiva]}
                    onPress={() => setUnidadNuevo(u)}
                  >
                    <Text style={[styles.opcionChicaTexto, unidadNuevo === u && styles.opcionChicaTextoActivo]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
        <TouchableOpacity style={[styles.botonCrear, creando && styles.botonDeshabilitado]} onPress={handleCrear} disabled={creando}>
          <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Agregar"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centrado: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: spacing.xs, padding: spacing.md, paddingBottom: 0 },
  tab: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 9, alignItems: "center" },
  tabActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  tabTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextoActivo: { color: colors.textOnNavy },

  lista: { padding: spacing.md, gap: spacing.sm },
  filtroEstados: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xs },
  filtroChip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  filtroChipActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  filtroChipTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 11 },
  filtroChipTextoActivo: { color: colors.textOnNavy },

  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  depto: { ...typography.heading, fontSize: 15, color: colors.textDark },
  tipo: { color: colors.navy900, fontWeight: "700", fontSize: 13, marginTop: spacing.xs },
  descripcion: { ...typography.small, color: colors.textDark, marginTop: 4 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  motivoRechazo: { fontSize: 12, color: colors.danger, marginTop: 4, fontStyle: "italic" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTexto: { fontSize: 11, fontWeight: "800", color: colors.textDark },
  acciones: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  botonAprobar: { flex: 1, backgroundColor: colors.success, borderRadius: radius.sm, padding: 10, alignItems: "center" },
  botonAprobarTexto: { color: "#fff", fontWeight: "700", fontSize: 13 },
  botonRechazar: { flex: 1, borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.sm, padding: 10, alignItems: "center" },
  botonRechazarTexto: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  ayudaNotificar: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, fontStyle: "italic" },

  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    marginTop: 4,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  inputMultilinea: { minHeight: 70, textAlignVertical: "top" },
  avisoMulta: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, fontStyle: "italic" },
  filaOpciones: { flexDirection: "row", gap: 6, marginTop: 4 },
  opcionChica: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  opcionChicaActiva: { borderColor: colors.navy900, backgroundColor: colors.offWhite },
  opcionChicaTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  opcionChicaTextoActivo: { color: colors.navy900 },

  botonCrear: { backgroundColor: colors.success, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.md },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  botonDeshabilitado: { opacity: 0.6 },

  subtitulo: { ...typography.heading, fontSize: 15, color: colors.textDark, marginTop: spacing.sm },
  filaTipo: { flexDirection: "row", alignItems: "center" },
  nombreTipo: { fontSize: 14, fontWeight: "700", color: colors.textDark },
  etiquetaMulta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  linkDesactivar: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  linkActivar: { color: colors.success, fontWeight: "700", fontSize: 12 },

  checkboxFila: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border },
  checkboxActivo: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  checkboxTexto: { color: colors.textDark, fontSize: 13 },
});
