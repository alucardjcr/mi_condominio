import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  jefeAsignarTurno,
  jefeCrearBloque,
  jefeActualizarBloque,
  jefeEliminarBloque,
  jefeGenerarPatronTurnos,
  jefeGetBloques,
  jefeGetPersonal,
  jefeGetTurnos,
  jefeQuitarTurno,
} from "../../api/client";
import { DuplaPatronInput, PersonalTurno, TurnoAsignado, TurnoBloque } from "../../api/types";
import { CONDOMINIO_ID } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import SelectModal, { OpcionSelect } from "../../components/SelectModal";
import { colors, radius, spacing, typography } from "../../theme/theme";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatFecha(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const NOMBRES_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Paleta fija — cada guardia se queda con el mismo color en toda la tabla
// (calculado por su id, para que sea estable entre recargas).
const PALETA_GUARDIA = ["#DCEBFF", "#FFE8CC", "#E4F7D8", "#FBE0E8", "#EAE0FB", "#FFF3B0", "#D8F5F0", "#F0D8E8"];
function colorParaGuardia(id: number) {
  return PALETA_GUARDIA[id % PALETA_GUARDIA.length];
}

type Vista = "calendario" | "patron" | "bloques";

// Ronda 39, a pedido explícito del usuario: mostró un roster mensual hecho
// en Excel (formato "4x4" — 2 duplas de guardias, una de día y otra de
// noche, rotando cada 4 días) y pidió reproducir eso en la app: bloques de
// turno editables, vista de calendario mensual, un generador de patrón
// automático, y que el JefeGuardias también pueda aparecer en el roster
// (antes solo se le podía asignar turno a un Guardia). Toda la lógica de
// negocio vive en turnos.service.ts — acá solo la interfaz.
export default function JefeGuardiasTurnosScreen() {
  const { token } = useAuth();
  const [vista, setVista] = useState<Vista>("calendario");

  const [bloques, setBloques] = useState<TurnoBloque[]>([]);
  const [personal, setPersonal] = useState<PersonalTurno[]>([]);
  const [turnos, setTurnos] = useState<TurnoAsignado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const hoy = new Date();
  const [mesVisible, setMesVisible] = useState(hoy.getMonth()); // 0-11
  const [anioVisible, setAnioVisible] = useState(hoy.getFullYear());

  const primerDiaMes = useMemo(() => new Date(anioVisible, mesVisible, 1), [anioVisible, mesVisible]);
  const ultimoDiaMes = useMemo(() => new Date(anioVisible, mesVisible + 1, 0), [anioVisible, mesVisible]);
  const diasDelMes = useMemo(() => {
    const dias: Date[] = [];
    for (let d = 1; d <= ultimoDiaMes.getDate(); d++) dias.push(new Date(anioVisible, mesVisible, d));
    return dias;
  }, [anioVisible, mesVisible, ultimoDiaMes]);

  const cargar = useCallback(
    async (mostrarRefresh = false) => {
      if (!token) return;
      mostrarRefresh ? setRefrescando(true) : setLoading(true);
      try {
        const [b, p, t] = await Promise.all([
          jefeGetBloques(token, CONDOMINIO_ID),
          jefeGetPersonal(token, CONDOMINIO_ID),
          jefeGetTurnos(token, CONDOMINIO_ID, formatFecha(primerDiaMes), formatFecha(ultimoDiaMes)),
        ]);
        setBloques(b);
        setPersonal(p);
        setTurnos(t);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
        setRefrescando(false);
      }
    },
    [token, primerDiaMes, ultimoDiaMes]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const cambiarMes = (delta: number) => {
    let m = mesVisible + delta;
    let a = anioVisible;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMesVisible(m);
    setAnioVisible(a);
  };

  // fecha ISO -> { [id_turnobloque]: TurnoAsignado }
  const turnosPorFechaYBloque = useMemo(() => {
    const mapa: Record<string, Record<number, TurnoAsignado>> = {};
    turnos.forEach((t) => {
      (mapa[t.fecha] ??= {})[t.id_turnobloque] = t;
    });
    return mapa;
  }, [turnos]);

  const handleTocarCelda = (fecha: Date, bloque: TurnoBloque) => {
    if (!token) return;
    const fechaISO = formatFecha(fecha);
    const existente = turnosPorFechaYBloque[fechaISO]?.[bloque.id_turnobloque];

    const opcionesAsignar = personal
      .filter((p) => p.id_usuario !== existente?.guardia_usuario_id)
      .map((p) => ({
        text: `${p.nombre_usuario}${p.rol === "JefeGuardias" ? " (Jefe)" : ""}`,
        onPress: async () => {
          try {
            if (existente) await jefeQuitarTurno(token, existente.id_turnoasignado);
            await jefeAsignarTurno(token, {
              guardia_usuario_id: p.id_usuario,
              turno_bloque_id_turnobloque: bloque.id_turnobloque,
              fecha: fechaISO,
              condominio_id_condominio: CONDOMINIO_ID,
            });
            cargar();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      }));

    const botones: any[] = [...opcionesAsignar];
    if (existente) {
      botones.push({
        text: "Quitar de este turno",
        style: "destructive",
        onPress: async () => {
          try {
            await jefeQuitarTurno(token, existente.id_turnoasignado);
            cargar();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      });
    }
    botones.push({ text: "Cancelar", style: "cancel" });

    Alert.alert(
      `${bloque.gls_turnobloque} · ${fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`,
      existente ? `Asignado a ${existente.nombre_guardia}` : "Sin asignar — elige quién cubre este turno:",
      botones
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.navy900} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <View style={styles.tabs}>
        {(
          [
            { id: "calendario" as Vista, label: "Calendario" },
            { id: "patron" as Vista, label: "Generar patrón" },
            { id: "bloques" as Vista, label: "Bloques" },
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

      {vista === "calendario" && (
        <CalendarioMensual
          mesVisible={mesVisible}
          anioVisible={anioVisible}
          diasDelMes={diasDelMes}
          bloques={bloques}
          turnosPorFechaYBloque={turnosPorFechaYBloque}
          onCambiarMes={cambiarMes}
          onTocarCelda={handleTocarCelda}
          refrescando={refrescando}
          onRefresh={() => cargar(true)}
        />
      )}
      {vista === "patron" && (
        <GeneradorPatron
          bloques={bloques}
          personal={personal}
          onGenerado={cargar}
          fechaInicioSugerida={formatFecha(primerDiaMes)}
          fechaTerminoSugerida={formatFecha(ultimoDiaMes)}
        />
      )}
      {vista === "bloques" && <GestionBloques bloques={bloques} onCambio={cargar} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vista: calendario mensual
// ---------------------------------------------------------------------------
function CalendarioMensual({
  mesVisible,
  anioVisible,
  diasDelMes,
  bloques,
  turnosPorFechaYBloque,
  onCambiarMes,
  onTocarCelda,
  refrescando,
  onRefresh,
}: {
  mesVisible: number;
  anioVisible: number;
  diasDelMes: Date[];
  bloques: TurnoBloque[];
  turnosPorFechaYBloque: Record<string, Record<number, TurnoAsignado>>;
  onCambiarMes: (delta: number) => void;
  onTocarCelda: (fecha: Date, bloque: TurnoBloque) => void;
  refrescando: boolean;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} />}
    >
      <View style={styles.navMes}>
        <TouchableOpacity onPress={() => onCambiarMes(-1)} style={styles.botonNav}>
          <Text style={styles.botonNavTexto}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.tituloMes}>
          {NOMBRES_MES[mesVisible]} {anioVisible}
        </Text>
        <TouchableOpacity onPress={() => onCambiarMes(1)} style={styles.botonNav}>
          <Text style={styles.botonNavTexto}>›</Text>
        </TouchableOpacity>
      </View>

      {bloques.length === 0 && (
        <Text style={styles.vacio}>Todavía no hay bloques de turno creados — anda a la pestaña "Bloques" para crear uno.</Text>
      )}

      {bloques.length > 0 && (
        <View style={styles.tabla}>
          <View style={[styles.filaTabla, styles.filaEncabezado]}>
            <Text style={[styles.celdaFecha, styles.textoEncabezado]}>Fecha</Text>
            {bloques.map((b) => (
              <Text key={b.id_turnobloque} style={[styles.celdaBloque, styles.textoEncabezado]} numberOfLines={1}>
                {b.gls_turnobloque}
              </Text>
            ))}
          </View>

          {diasDelMes.map((dia) => {
            const diaSemana = dia.getDay(); // 0=domingo, 6=sábado
            const esFinde = diaSemana === 0 || diaSemana === 6;
            const fechaISO = formatFecha(dia);
            return (
              <View key={fechaISO} style={[styles.filaTabla, esFinde && styles.filaFinde]}>
                <View style={styles.celdaFecha}>
                  <Text style={styles.textoFechaNum}>{dia.getDate()}</Text>
                  <Text style={styles.textoFechaDia}>{NOMBRES_DIA[diaSemana].slice(0, 3)}</Text>
                </View>
                {bloques.map((b) => {
                  const asignado = turnosPorFechaYBloque[fechaISO]?.[b.id_turnobloque];
                  return (
                    <TouchableOpacity
                      key={b.id_turnobloque}
                      style={[
                        styles.celdaBloque,
                        styles.celdaAsignable,
                        asignado && { backgroundColor: colorParaGuardia(asignado.guardia_usuario_id) },
                      ]}
                      onPress={() => onTocarCelda(dia, b)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.textoAsignado} numberOfLines={2}>
                        {asignado ? asignado.nombre_guardia : "—"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.ayudaCalendario}>Toca cualquier celda para asignar, cambiar, o quitar quién cubre ese turno.</Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Vista: generador de patrón ("4x4")
// ---------------------------------------------------------------------------
interface FilaDupla {
  guardiaDia: OpcionSelect | null;
  guardiaNoche: OpcionSelect | null;
}

function GeneradorPatron({
  bloques,
  personal,
  onGenerado,
  fechaInicioSugerida,
  fechaTerminoSugerida,
}: {
  bloques: TurnoBloque[];
  personal: PersonalTurno[];
  onGenerado: () => void;
  fechaInicioSugerida: string;
  fechaTerminoSugerida: string;
}) {
  const { token } = useAuth();
  const [fechaInicio, setFechaInicio] = useState(fechaInicioSugerida);
  const [fechaTermino, setFechaTermino] = useState(fechaTerminoSugerida);
  const [bloqueDia, setBloqueDia] = useState<OpcionSelect | null>(null);
  const [bloqueNoche, setBloqueNoche] = useState<OpcionSelect | null>(null);
  const [diasPorBloque, setDiasPorBloque] = useState("4");
  const [duplas, setDuplas] = useState<FilaDupla[]>([
    { guardiaDia: null, guardiaNoche: null },
    { guardiaDia: null, guardiaNoche: null },
  ]);
  const [generando, setGenerando] = useState(false);

  const opcionesPersonal = personal.map((p) => ({ id: p.id_usuario, label: `${p.nombre_usuario}${p.rol === "JefeGuardias" ? " (Jefe)" : ""}` }));

  const actualizarDupla = (indice: number, campo: keyof FilaDupla, valor: OpcionSelect) => {
    setDuplas((prev) => prev.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d)));
  };

  const handleGenerar = () => {
    if (!token) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaTermino)) {
      Alert.alert("Fechas inválidas", "Usa el formato AAAA-MM-DD para ambas fechas.");
      return;
    }
    if (!bloqueDia || !bloqueNoche) {
      Alert.alert("Faltan bloques", "Elige cuál bloque es el de día y cuál el de noche.");
      return;
    }
    const duplasCompletas: DuplaPatronInput[] = [];
    for (const d of duplas) {
      if (d.guardiaDia && d.guardiaNoche) {
        duplasCompletas.push({ guardia_dia_id: d.guardiaDia.id, guardia_noche_id: d.guardiaNoche.id });
      }
    }
    if (duplasCompletas.length === 0) {
      Alert.alert("Faltan duplas", "Agrega al menos una dupla completa (guardia de día + guardia de noche).");
      return;
    }
    const dias = Number(diasPorBloque);
    if (!Number.isInteger(dias) || dias < 1) {
      Alert.alert("Días por bloque inválido", "Debe ser un número entero de al menos 1.");
      return;
    }

    Alert.alert(
      "Generar patrón",
      `Esto va a REEMPLAZAR cualquier turno ya asignado entre ${fechaInicio} y ${fechaTermino}. ¿Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Generar",
          style: "destructive",
          onPress: async () => {
            setGenerando(true);
            try {
              const resultado = await jefeGenerarPatronTurnos(token, CONDOMINIO_ID, {
                fecha_inicio: fechaInicio,
                fecha_termino: fechaTermino,
                bloque_dia_id: bloqueDia.id,
                bloque_noche_id: bloqueNoche.id,
                dias_por_bloque: dias,
                duplas: duplasCompletas,
              });
              Alert.alert(
                "Listo",
                `Se generaron ${resultado.dias_generados} días (${resultado.asignaciones_creadas} asignaciones en total).`
              );
              onGenerado();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setGenerando(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
      <Text style={styles.ayudaCalendario}>
        Genera automáticamente todo el calendario de un rango, rotando por las duplas cada tantos días — reproduce el
        patrón "4x4": cada dupla cubre {diasPorBloque || "N"} días seguidos (uno de día, el otro de noche), y se pasa
        a la siguiente.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Desde</Text>
        <TextInput style={styles.input} value={fechaInicio} onChangeText={setFechaInicio} placeholder="AAAA-MM-DD" />
        <Text style={styles.label}>Hasta</Text>
        <TextInput style={styles.input} value={fechaTermino} onChangeText={setFechaTermino} placeholder="AAAA-MM-DD" />

        <SelectModal
          label="Bloque de día"
          placeholder="Selecciona el bloque de día"
          opciones={bloques.map((b) => ({ id: b.id_turnobloque, label: `${b.gls_turnobloque} (${b.hora_inicio.slice(0, 5)}–${b.hora_termino.slice(0, 5)})` }))}
          valorSeleccionado={bloqueDia}
          onSeleccionar={setBloqueDia}
        />
        <SelectModal
          label="Bloque de noche"
          placeholder="Selecciona el bloque de noche"
          opciones={bloques.map((b) => ({ id: b.id_turnobloque, label: `${b.gls_turnobloque} (${b.hora_inicio.slice(0, 5)}–${b.hora_termino.slice(0, 5)})` }))}
          valorSeleccionado={bloqueNoche}
          onSeleccionar={setBloqueNoche}
        />

        <Text style={styles.label}>Días seguidos por dupla</Text>
        <TextInput style={styles.input} value={diasPorBloque} onChangeText={setDiasPorBloque} keyboardType="number-pad" placeholder="4" />
      </View>

      <Text style={styles.subtitulo}>Duplas (en el orden que van rotando)</Text>
      {duplas.map((d, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.filaDuplaHeader}>
            <Text style={styles.numeroDupla}>Dupla {i + 1}</Text>
            {duplas.length > 1 && (
              <TouchableOpacity onPress={() => setDuplas((prev) => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.quitarDupla}>Quitar</Text>
              </TouchableOpacity>
            )}
          </View>
          <SelectModal
            label="Guardia de día"
            placeholder="Selecciona"
            opciones={opcionesPersonal}
            valorSeleccionado={d.guardiaDia}
            onSeleccionar={(o) => actualizarDupla(i, "guardiaDia", o)}
          />
          <SelectModal
            label="Guardia de noche"
            placeholder="Selecciona"
            opciones={opcionesPersonal}
            valorSeleccionado={d.guardiaNoche}
            onSeleccionar={(o) => actualizarDupla(i, "guardiaNoche", o)}
          />
        </View>
      ))}
      <TouchableOpacity
        style={styles.botonSecundario}
        onPress={() => setDuplas((prev) => [...prev, { guardiaDia: null, guardiaNoche: null }])}
      >
        <Text style={styles.botonSecundarioTexto}>+ Agregar dupla</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.botonCrear, generando && styles.botonDeshabilitado]} onPress={handleGenerar} disabled={generando}>
        {generando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonCrearTexto}>Generar patrón</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Vista: gestión de bloques de turno
// ---------------------------------------------------------------------------
function GestionBloques({ bloques, onCambio }: { bloques: TurnoBloque[]; onCambio: () => void }) {
  const { token } = useAuth();
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [inicioNuevo, setInicioNuevo] = useState("");
  const [terminoNuevo, setTerminoNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  const [bloqueEditando, setBloqueEditando] = useState<number | null>(null);
  const [nombreEditar, setNombreEditar] = useState("");
  const [inicioEditar, setInicioEditar] = useState("");
  const [terminoEditar, setTerminoEditar] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleCrear = async () => {
    if (!token) return;
    if (!nombreNuevo.trim() || !/^\d{2}:\d{2}$/.test(inicioNuevo) || !/^\d{2}:\d{2}$/.test(terminoNuevo)) {
      Alert.alert("Faltan datos", "Nombre y horas en formato HH:MM (ej: 20:00).");
      return;
    }
    setCreando(true);
    try {
      await jefeCrearBloque(token, CONDOMINIO_ID, { gls_turnobloque: nombreNuevo.trim(), hora_inicio: inicioNuevo, hora_termino: terminoNuevo });
      setNombreNuevo("");
      setInicioNuevo("");
      setTerminoNuevo("");
      onCambio();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreando(false);
    }
  };

  const handleAbrirEditar = (b: TurnoBloque) => {
    setBloqueEditando(b.id_turnobloque);
    setNombreEditar(b.gls_turnobloque);
    setInicioEditar(b.hora_inicio.slice(0, 5));
    setTerminoEditar(b.hora_termino.slice(0, 5));
  };

  const handleGuardarEdicion = async (id: number) => {
    if (!token) return;
    setGuardando(true);
    try {
      await jefeActualizarBloque(token, id, { gls_turnobloque: nombreEditar.trim(), hora_inicio: inicioEditar, hora_termino: terminoEditar });
      setBloqueEditando(null);
      onCambio();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = (b: TurnoBloque) => {
    if (!token) return;
    Alert.alert("Eliminar bloque", `¿Eliminar "${b.gls_turnobloque}"? Los turnos ya asignados con este bloque no se borran.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await jefeEliminarBloque(token, b.id_turnobloque);
            onCambio();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
      <Text style={styles.ayudaCalendario}>
        Define los horarios de turno del condominio — por ejemplo "Día" 08:00–20:00 y "Noche" 20:00–08:00 para un
        patrón de 12 horas.
      </Text>

      {bloques.map((b) =>
        bloqueEditando === b.id_turnobloque ? (
          <View key={b.id_turnobloque} style={styles.card}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={nombreEditar} onChangeText={setNombreEditar} />
            <Text style={styles.label}>Hora inicio</Text>
            <TextInput style={styles.input} value={inicioEditar} onChangeText={setInicioEditar} placeholder="HH:MM" />
            <Text style={styles.label}>Hora término</Text>
            <TextInput style={styles.input} value={terminoEditar} onChangeText={setTerminoEditar} placeholder="HH:MM" />
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
              <TouchableOpacity
                style={[styles.botonCrear, { flex: 1 }, guardando && styles.botonDeshabilitado]}
                onPress={() => handleGuardarEdicion(b.id_turnobloque)}
                disabled={guardando}
              >
                <Text style={styles.botonCrearTexto}>{guardando ? "Guardando..." : "Guardar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.botonSecundario, { flex: 1 }]} onPress={() => setBloqueEditando(null)}>
                <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View key={b.id_turnobloque} style={[styles.card, styles.filaBloque]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombreBloque}>{b.gls_turnobloque}</Text>
              <Text style={styles.horarioBloque}>
                {b.hora_inicio.slice(0, 5)} – {b.hora_termino.slice(0, 5)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleAbrirEditar(b)} style={{ marginRight: spacing.md }}>
              <Text style={styles.linkEditar}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleEliminar(b)}>
              <Text style={styles.quitarDupla}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      <Text style={styles.subtitulo}>Nuevo bloque</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Nombre (ej: "Día", "Noche")</Text>
        <TextInput style={styles.input} value={nombreNuevo} onChangeText={setNombreNuevo} placeholder="Día" />
        <Text style={styles.label}>Hora inicio</Text>
        <TextInput style={styles.input} value={inicioNuevo} onChangeText={setInicioNuevo} placeholder="08:00" />
        <Text style={styles.label}>Hora término</Text>
        <TextInput style={styles.input} value={terminoNuevo} onChangeText={setTerminoNuevo} placeholder="20:00" />
        <TouchableOpacity style={[styles.botonCrear, creando && styles.botonDeshabilitado]} onPress={handleCrear} disabled={creando}>
          <Text style={styles.botonCrearTexto}>{creando ? "Creando..." : "Crear bloque"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: spacing.xs, padding: spacing.md, paddingBottom: 0 },
  tab: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 9, alignItems: "center" },
  tabActivo: { borderColor: colors.navy900, backgroundColor: colors.navy900 },
  tabTexto: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextoActivo: { color: colors.textOnNavy },

  navMes: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, marginBottom: spacing.sm },
  botonNav: { paddingHorizontal: 16, paddingVertical: 4 },
  botonNavTexto: { fontSize: 26, color: colors.navy900, fontWeight: "700" },
  tituloMes: { ...typography.heading, color: colors.textDark, minWidth: 160, textAlign: "center" },

  vacio: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
  ayudaCalendario: { ...typography.small, color: colors.textMuted, textAlign: "center", marginBottom: spacing.xs },

  tabla: { backgroundColor: colors.white, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  filaTabla: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
  filaEncabezado: { backgroundColor: colors.navy900, borderTopWidth: 0 },
  filaFinde: { backgroundColor: "#FFF8E1" },
  celdaFecha: { width: 56, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  celdaBloque: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.border },
  celdaAsignable: {},
  textoEncabezado: { color: colors.textOnNavy, fontWeight: "800", fontSize: 12, textAlign: "center" },
  textoFechaNum: { fontWeight: "800", fontSize: 14, color: colors.textDark },
  textoFechaDia: { fontSize: 10, color: colors.textMuted },
  textoAsignado: { fontSize: 11, fontWeight: "700", color: colors.textDark, textAlign: "center" },

  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
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
  subtitulo: { ...typography.heading, fontSize: 15, color: colors.textDark, marginTop: spacing.sm },
  filaDuplaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  numeroDupla: { fontWeight: "800", color: colors.navy900 },
  quitarDupla: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  linkEditar: { color: colors.info, fontWeight: "700", fontSize: 13 },

  botonCrear: { backgroundColor: colors.success, borderRadius: radius.sm, padding: 14, alignItems: "center", marginTop: spacing.sm },
  botonCrearTexto: { color: "#fff", fontWeight: "700" },
  botonDeshabilitado: { opacity: 0.6 },
  botonSecundario: { borderWidth: 1.5, borderColor: colors.navy900, borderRadius: radius.sm, padding: 12, alignItems: "center" },
  botonSecundarioTexto: { color: colors.navy900, fontWeight: "700" },

  filaBloque: { flexDirection: "row", alignItems: "center" },
  nombreBloque: { fontSize: 15, fontWeight: "700", color: colors.textDark },
  horarioBloque: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
