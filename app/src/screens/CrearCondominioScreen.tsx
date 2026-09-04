import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { crearCondominio } from "../api/client";
import { EstructuraCondominio } from "../api/types";
import { useAuth } from "../context/AuthContext";
import SelectModal, { OpcionSelect } from "../components/SelectModal";
import { REGIONES_CHILE } from "../data/chileRegiones";
import { colors, radius, spacing, typography } from "../theme/theme";

// Ronda 55, a pedido explícito del usuario: "Condominio de Parcelas" —
// estructuralmente es EXACTAMENTE lo mismo que "casas" en el backend (sin
// torres ni pisos, solo una lista de unidades) — así que se maneja como
// una opción de UI aparte, con sus propios textos/placeholders para que
// tenga sentido en un contexto rural, pero mandando `estructura: "casas"`
// al backend (no se duplicó ninguna lógica ahí).
type EstructuraUI = EstructuraCondominio | "parcelas";

interface TorreArmada {
  nombre_torre: string;
  cantidad_pisos?: number;
  numeros_unidad: string[];
}

// Separa una lista pegada tipo CSV: acepta comas, saltos de línea, o
// ambos mezclados (ej. pegar una columna de Excel) — así el administrador
// puede escribir su propia numeración irregular sin que la app le imponga
// un patrón, además de la opción de generarla automáticamente más abajo.
function parsearNumeros(texto: string): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const raw of texto.split(/[,\n]/)) {
    const n = raw.trim();
    if (!n || vistos.has(n)) continue;
    vistos.add(n);
    resultado.push(n);
  }
  return resultado;
}

// Patrón simple "N pisos x M deptos por piso" -> 101,102...,201,202...
function generarPorPatron(pisos: number, deptosPorPiso: number): string[] {
  const resultado: string[] = [];
  for (let p = 1; p <= pisos; p++) {
    for (let d = 1; d <= deptosPorPiso; d++) {
      resultado.push(`${p}${String(d).padStart(2, "0")}`);
    }
  }
  return resultado;
}

const OPCIONES_ESTRUCTURA: { valor: EstructuraUI; titulo: string; ayuda: string }[] = [
  {
    valor: "torres",
    titulo: "Varias torres o blocks",
    ayuda: 'Cada una con su propio nombre (ej: "Torre A", "Block 1"). Ej: un condominio con varios edificios.',
  },
  {
    valor: "edificio",
    titulo: "Un solo edificio",
    ayuda: "Sin nombres de torre — solo cuántos pisos tiene y los números de depto de cada uno.",
  },
  {
    valor: "casas",
    titulo: "Condominio de casas",
    ayuda: "Sin pisos ni torres — solo el número o nombre de cada casa.",
  },
  {
    valor: "parcelas",
    titulo: "Condominio de parcelas",
    ayuda: "Sin pisos ni torres — solo el número o nombre de cada parcela.",
  },
];

// Ronda 26: asistente de creación de condominio. Se llega acá desde
// SeleccionarCondominioScreen (todavía sin sesión completa, solo el token
// intermedio) o desde el menú de alguien ya logeado que quiere agregar
// OTRO condominio a su cuenta — en ambos casos usa el mismo token
// disponible (ver useAuth().token / tokenIntermedio) porque el backend
// acepta cualquiera de los dos para estas rutas (ver routes/condominios.ts).
export default function CrearCondominioScreen({ navigation }: any) {
  const { token, tokenIntermedio, seleccionarCondominio, cambiarCondominio } = useAuth();
  const tokenApi = token ?? tokenIntermedio;

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [nombreCondominio, setNombreCondominio] = useState("");
  const [regionSel, setRegionSel] = useState<OpcionSelect | null>(null);
  const [comunaSel, setComunaSel] = useState<OpcionSelect | null>(null);
  const comunasDisponibles = regionSel ? REGIONES_CHILE.find((r) => r.nombre === regionSel.label)?.comunas ?? [] : [];

  const handleSeleccionarRegion = (opcion: OpcionSelect) => {
    setRegionSel(opcion);
    setComunaSel(null); // la comuna se resetea, ya no corresponde a la región nueva
  };
  const [estructura, setEstructura] = useState<EstructuraUI | null>(null);

  // Ronda 59, a pedido explícito del usuario: rediseño del flujo de
  // torres/blocks — antes se pedía nombre + generación opcional + lista
  // editable de números de depto, todo junto en una sola pantalla densa
  // por torre. Nuevo flujo: 1) elegir la palabra (Torre/Block), 2)
  // cuántas hay en total, 3) un paso POR CADA torre pidiendo solo pisos +
  // deptos por piso (sin mostrar/editar la lista de números — se genera
  // sola con el mismo patrón de siempre). Va creando la Torre 1, luego la
  // 2, etc., hasta completar la cantidad indicada.
  const [torresAgregadas, setTorresAgregadas] = useState<TorreArmada[]>([]);
  const [etiquetaTorreBlock, setEtiquetaTorreBlock] = useState<"Torre" | "Block" | null>(null);
  const [cantidadTorresTexto, setCantidadTorresTexto] = useState("");
  const [cantidadTorresConfirmada, setCantidadTorresConfirmada] = useState<number | null>(null);
  const [torreIndiceActual, setTorreIndiceActual] = useState(1);
  const [pisosTorre, setPisosTorre] = useState("");
  const [deptosPorPisoTorre, setDeptosPorPisoTorre] = useState("");

  // --- estructura = "edificio": un solo bloque de pisos/deptos ---
  const [pisosEdificio, setPisosEdificio] = useState("");
  const [deptosPorPisoEdificio, setDeptosPorPisoEdificio] = useState("");

  // --- estructura = "casas" ---
  const [casasTexto, setCasasTexto] = useState("");

  // --- estructura = "parcelas" (mismo manejo que "casas" en el backend) ---
  const [parcelasTexto, setParcelasTexto] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ronda 59: confirma cuántas torres/blocks hay en total y arranca el
  // asistente en la Torre/Block N°1.
  const handleConfirmarCantidadTorres = () => {
    const n = Number(cantidadTorresTexto);
    if (!n || n < 1) {
      setError("Ingresa cuántas torres o blocks tiene el condominio.");
      return;
    }
    setError(null);
    setCantidadTorresConfirmada(n);
    setTorreIndiceActual(1);
  };

  // Agrega la torre actual (con el patrón pisos x deptos-por-piso, sin
  // pedirle al usuario la lista de números) y avanza a la siguiente, o
  // termina si ya era la última.
  const handleAgregarTorreActualYSeguir = () => {
    const pisos = Number(pisosTorre);
    const deptosPorPiso = Number(deptosPorPisoTorre);
    if (!pisos || pisos < 1 || !deptosPorPiso || deptosPorPiso < 1) {
      setError("Ingresa cuántos pisos tiene y cuántos deptos por piso.");
      return;
    }
    setError(null);
    const nombre = `${etiquetaTorreBlock} ${torreIndiceActual}`;
    setTorresAgregadas((prev) => [...prev, { nombre_torre: nombre, cantidad_pisos: pisos, numeros_unidad: generarPorPatron(pisos, deptosPorPiso) }]);
    setPisosTorre("");
    setDeptosPorPisoTorre("");
    setTorreIndiceActual((i) => i + 1);
  };

  const handleQuitarTorre = (index: number) => {
    setTorresAgregadas((prev) => prev.filter((_, i) => i !== index));
  };

  // Vuelve a empezar el asistente de torres desde cero (por si se
  // equivocó eligiendo Torre/Block o la cantidad).
  const handleReiniciarAsistenteTorres = () => {
    setEtiquetaTorreBlock(null);
    setCantidadTorresTexto("");
    setCantidadTorresConfirmada(null);
    setTorreIndiceActual(1);
    setTorresAgregadas([]);
    setPisosTorre("");
    setDeptosPorPisoTorre("");
    setError(null);
  };

  // Ronda 59, a pedido explícito del usuario (encontró un condominio
  // duplicado 3 veces en la base — probablemente por reintentar tocando
  // "Crear condominio" al no ver ningún cambio visible, un bug ya
  // corregido en la ronda 55, pero se agrega esta protección extra de
  // todos modos): `enviando` (estado de React) no alcanza por sí solo
  // para bloquear un doble-toque MUY rápido, porque el estado recién se
  // actualiza en el siguiente render — un `ref` se actualiza al instante,
  // sin esperar ningún render.
  const enviandoRef = useRef(false);

  const handleEnviar = async () => {
    if (enviandoRef.current) return;
    setError(null);
    if (!nombreCondominio.trim()) {
      setError("Falta el nombre del condominio.");
      setPaso(1);
      return;
    }
    if (!regionSel) {
      setError("Falta la región del condominio.");
      setPaso(1);
      return;
    }
    if (!comunaSel) {
      setError("Falta la comuna del condominio.");
      setPaso(1);
      return;
    }
    if (!estructura) {
      setError("Indica cómo está estructurado el condominio.");
      return;
    }
    if (!tokenApi) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    let payload: Parameters<typeof crearCondominio>[1];
    if (estructura === "torres") {
      if (torresAgregadas.length === 0) {
        setError("Agrega al menos una torre o block antes de continuar.");
        return;
      }
      payload = { nombre_condominio: nombreCondominio.trim(), estructura, torres: torresAgregadas };
    } else if (estructura === "edificio") {
      const pisos = Number(pisosEdificio);
      const deptosPorPiso = Number(deptosPorPisoEdificio);
      if (!pisos || pisos < 1 || !deptosPorPiso || deptosPorPiso < 1) {
        setError("Ingresa cuántos pisos tiene el edificio y cuántos deptos por piso.");
        return;
      }
      payload = {
        nombre_condominio: nombreCondominio.trim(),
        estructura,
        edificio: { cantidad_pisos: pisos, numeros_unidad: generarPorPatron(pisos, deptosPorPiso) },
      };
    } else if (estructura === "casas") {
      const numeros = parsearNumeros(casasTexto);
      if (numeros.length === 0) {
        setError("Agrega al menos un número o nombre de casa.");
        return;
      }
      payload = { nombre_condominio: nombreCondominio.trim(), estructura: "casas", numeros_unidad_casas: numeros };
    } else {
      // estructura === "parcelas" — mismo payload que "casas" para el
      // backend (ver la nota en EstructuraUI, arriba).
      const numeros = parsearNumeros(parcelasTexto);
      if (numeros.length === 0) {
        setError("Agrega al menos un número o nombre de parcela.");
        return;
      }
      payload = { nombre_condominio: nombreCondominio.trim(), estructura: "casas", numeros_unidad_casas: numeros };
    }

    if (comunaSel) {
      payload.comuna = comunaSel.label;
    }
    if (regionSel) {
      payload.region = regionSel.label;
    }

    enviandoRef.current = true;
    setEnviando(true);
    try {
      const resultado = await crearCondominio(tokenApi, payload);

      if (!token) {
        // Todavía no había sesión completa (venimos del selector) — entra
        // directo al condominio recién creado.
        await seleccionarCondominio(resultado.id_condominio);
        return;
      }

      // Ronda 55, a pedido explícito del usuario (bug reportado: "Entrar
      // ahora" no funciona): confirmado con una prueba directa contra el
      // backend que el cambio de sesión SÍ funcionaba de verdad (200,
      // token nuevo, condominio correcto) — el problema real era que acá
      // nunca se navegaba a ningún lado después. cambiarCondominio()
      // actualiza el contexto de sesión (nuevo token, nuevo condominio),
      // pero el usuario seguía viendo esta misma pantalla de "Crear
      // condominio" sin ningún cambio visible — parecía que el botón no
      // hacía nada, aunque por dentro sí había cambiado de condominio.
      // También le faltaba manejo de errores: si algo fallaba (sesión
      // vencida, sin conexión), la promesa quedaba sin atrapar y no se
      // veía ningún aviso.
      Alert.alert(
        "Condominio creado",
        `"${resultado.nombre}" quedó creado con ${resultado.unidades_creadas} unidad(es). ¿Quieres entrar a administrarlo ahora?`,
        [
          { text: "Más tarde", style: "cancel", onPress: () => navigation.goBack() },
          {
            text: "Entrar ahora",
            onPress: async () => {
              try {
                await cambiarCondominio(resultado.id_condominio);
                navigation.navigate("Home");
              } catch (e: any) {
                Alert.alert("Error", e.message ?? "No se pudo cambiar de condominio. Vuelve a intentar.");
              }
            },
          },
        ]
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>Crear condominio</Text>

        {paso === 1 && (
          <View style={styles.card}>
            <Text style={styles.label}>Nombre del condominio</Text>
            <TextInput
              style={styles.input}
              value={nombreCondominio}
              onChangeText={setNombreCondominio}
              placeholder="ej: Altos de San Miguel"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Región</Text>
            <SelectModal
              label="Región"
              placeholder="Selecciona una región"
              opciones={REGIONES_CHILE.map((r, i) => ({ id: i, label: r.nombre }))}
              valorSeleccionado={regionSel}
              onSeleccionar={handleSeleccionarRegion}
            />
            <Text style={styles.label}>Comuna</Text>
            <SelectModal
              label="Comuna"
              placeholder={regionSel ? "Selecciona una comuna" : "Primero elige la región"}
              opciones={comunasDisponibles.map((c, i) => ({ id: i, label: c }))}
              valorSeleccionado={comunaSel}
              onSeleccionar={setComunaSel}
              disabled={!regionSel}
            />
            <TouchableOpacity
              style={styles.boton}
              onPress={() => {
                if (!nombreCondominio.trim()) {
                  setError("Falta el nombre del condominio.");
                  return;
                }
                if (!regionSel) {
                  setError("Falta la región del condominio.");
                  return;
                }
                if (!comunaSel) {
                  setError("Falta la comuna del condominio.");
                  return;
                }
                setError(null);
                setPaso(2);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.botonTexto}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}

        {paso === 2 && (
          <View style={styles.card}>
            <Text style={styles.label}>¿Cómo está estructurado este condominio?</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {OPCIONES_ESTRUCTURA.map((op) => (
                <TouchableOpacity
                  key={op.valor}
                  style={[styles.opcionLarga, estructura === op.valor && styles.opcionActiva]}
                  onPress={() => setEstructura(op.valor)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.opcionLargaTitulo, estructura === op.valor && styles.opcionTextoActivo]}>
                    {op.titulo}
                  </Text>
                  <Text style={styles.opcionLargaAyuda}>{op.ayuda}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.boton, estructura === null && styles.botonDeshabilitado]}
              onPress={() => estructura !== null && setPaso(3)}
              disabled={estructura === null}
              activeOpacity={0.85}
            >
              <Text style={styles.botonTexto}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}

        {paso === 3 && estructura === "torres" && (
          <View style={styles.card}>
            {/* Sub-pantalla A: elegir la palabra (Torre / Block) */}
            {!etiquetaTorreBlock && (
              <>
                <Text style={styles.label}>¿Cómo se llaman las unidades de este condominio?</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  {(["Torre", "Block"] as const).map((opcion) => (
                    <TouchableOpacity
                      key={opcion}
                      style={[styles.opcionLarga, { flex: 1 }]}
                      onPress={() => setEtiquetaTorreBlock(opcion)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.opcionLargaTitulo}>{opcion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Sub-pantalla B: cuántas torres/blocks hay en total */}
            {etiquetaTorreBlock && cantidadTorresConfirmada === null && (
              <>
                <Text style={styles.label}>¿Cuántas {etiquetaTorreBlock === "Torre" ? "torres" : "blocks"} tiene el condominio?</Text>
                <TextInput
                  style={styles.input}
                  value={cantidadTorresTexto}
                  onChangeText={setCantidadTorresTexto}
                  placeholder="ej: 3"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
                {error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity style={styles.botonSecundario} onPress={handleReiniciarAsistenteTorres} activeOpacity={0.7}>
                  <Text style={styles.botonSecundarioTexto}>‹ Cambiar Torre/Block</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.boton} onPress={handleConfirmarCantidadTorres} activeOpacity={0.85}>
                  <Text style={styles.botonTexto}>Continuar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Sub-pantalla C: un paso por cada torre/block, pidiendo solo
                pisos + deptos por piso — la numeración se genera sola. */}
            {etiquetaTorreBlock && cantidadTorresConfirmada !== null && torreIndiceActual <= cantidadTorresConfirmada && (
              <>
                <Text style={styles.subtitulo}>
                  {etiquetaTorreBlock} {torreIndiceActual} de {cantidadTorresConfirmada}
                </Text>
                <Text style={styles.label}>Pisos</Text>
                <TextInput
                  style={styles.input}
                  value={pisosTorre}
                  onChangeText={setPisosTorre}
                  placeholder="ej: 5"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
                <Text style={styles.label}>Deptos por piso</Text>
                <TextInput
                  style={styles.input}
                  value={deptosPorPisoTorre}
                  onChangeText={setDeptosPorPisoTorre}
                  placeholder="ej: 4"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
                <Text style={styles.ayuda}>
                  Los números de depto (101, 102... 201, 202...) se generan solos — si necesitas números distintos
                  (irregulares, saltados, con letra), lo ajustas después desde la administración del condominio.
                </Text>
                {error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity style={styles.boton} onPress={handleAgregarTorreActualYSeguir} activeOpacity={0.85}>
                  <Text style={styles.botonTexto}>
                    {torreIndiceActual < cantidadTorresConfirmada ? "Guardar y seguir con la siguiente" : "Guardar"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Sub-pantalla D: resumen final + crear */}
            {etiquetaTorreBlock && cantidadTorresConfirmada !== null && torreIndiceActual > cantidadTorresConfirmada && (
              <>
                <Text style={styles.subtitulo}>Resumen</Text>
                {torresAgregadas.map((t, i) => (
                  <View key={i} style={styles.torreResumen}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.torreResumenNombre}>{t.nombre_torre}</Text>
                      <Text style={styles.torreResumenDetalle}>{t.numeros_unidad.length} unidad(es)</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleQuitarTorre(i)}>
                      <Text style={styles.quitarTexto}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {error && <Text style={styles.error}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.boton, enviando && styles.botonDeshabilitado]}
                  onPress={handleEnviar}
                  disabled={enviando}
                  activeOpacity={0.85}
                >
                  {enviando ? (
                    <ActivityIndicator color={colors.navy900} />
                  ) : (
                    <Text style={styles.botonTexto}>Crear condominio</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {paso === 3 && estructura === "edificio" && (
          <View style={styles.card}>
            <Text style={styles.label}>Pisos</Text>
            <TextInput
              style={styles.input}
              value={pisosEdificio}
              onChangeText={setPisosEdificio}
              placeholder="ej: 8"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>Deptos por piso</Text>
            <TextInput
              style={styles.input}
              value={deptosPorPisoEdificio}
              onChangeText={setDeptosPorPisoEdificio}
              placeholder="ej: 4"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <Text style={styles.ayuda}>
              Los números de depto (101, 102... 201, 202...) se generan solos — si necesitas números distintos
              (irregulares, saltados, con letra), lo ajustas después desde la administración del condominio.
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.boton, enviando && styles.botonDeshabilitado]}
              onPress={handleEnviar}
              disabled={enviando}
              activeOpacity={0.85}
            >
              {enviando ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <Text style={styles.botonTexto}>Crear condominio</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {paso === 3 && estructura === "casas" && (
          <View style={styles.card}>
            <Text style={styles.label}>Números o nombres de las casas</Text>
            <Text style={styles.ayuda}>
              Separados por coma o uno por línea (puedes pegar una lista, ej. desde Excel). ej: Casa 1, Casa 2... o
              1, 2, 3...
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={casasTexto}
              onChangeText={setCasasTexto}
              placeholder={"Casa 1, Casa 2, Casa 3..."}
              placeholderTextColor={colors.textMuted}
              multiline
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.boton, enviando && styles.botonDeshabilitado]}
              onPress={handleEnviar}
              disabled={enviando}
              activeOpacity={0.85}
            >
              {enviando ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <Text style={styles.botonTexto}>Crear condominio</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {paso === 3 && estructura === "parcelas" && (
          <View style={styles.card}>
            <Text style={styles.label}>Números o nombres de las parcelas</Text>
            <Text style={styles.ayuda}>
              Separados por coma o uno por línea (puedes pegar una lista, ej. desde Excel). ej: Parcela 1, Parcela
              2... o 1, 2, 3...
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultilinea]}
              value={parcelasTexto}
              onChangeText={setParcelasTexto}
              placeholder={"Parcela 1, Parcela 2, Parcela 3..."}
              placeholderTextColor={colors.textMuted}
              multiline
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.boton, enviando && styles.botonDeshabilitado]}
              onPress={handleEnviar}
              disabled={enviando}
              activeOpacity={0.85}
            >
              {enviando ? (
                <ActivityIndicator color={colors.navy900} />
              ) : (
                <Text style={styles.botonTexto}>Crear condominio</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {(paso === 1 || paso === 2) && error && <Text style={styles.error}>{error}</Text>}

        {paso > 1 && (
          <TouchableOpacity style={styles.volverWrap} onPress={() => setPaso((p) => (p - 1) as 1 | 2)}>
            <Text style={styles.volverTexto}>‹ Volver</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl },
  titulo: { ...typography.title, textAlign: "center", color: colors.textOnNavy, marginBottom: spacing.lg },
  subtitulo: { ...typography.heading, color: colors.textDark, marginTop: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg },
  label: { ...typography.label, color: colors.textDark, marginTop: spacing.sm },
  ayuda: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 16,
    marginTop: 6,
    color: colors.textDark,
    backgroundColor: colors.offWhite,
  },
  inputChico: { flex: 1, marginTop: 0 },
  inputMultilinea: { minHeight: 90, textAlignVertical: "top" },
  filaPatron: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: 6 },
  botonGenerar: {
    backgroundColor: colors.navy700,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  botonGenerarTexto: { color: colors.textOnNavy, fontWeight: "700", fontSize: 13 },
  opcionLarga: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  opcionActiva: { borderColor: colors.navy900, backgroundColor: colors.offWhite },
  opcionLargaTitulo: { color: colors.textDark, fontWeight: "800", fontSize: 15 },
  opcionLargaAyuda: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  opcionTextoActivo: { color: colors.navy900 },
  torreResumen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.offWhite,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  torreResumenNombre: { fontWeight: "700", color: colors.textDark },
  torreResumenDetalle: { fontSize: 12, color: colors.textMuted },
  quitarTexto: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  boton: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  botonDeshabilitado: { opacity: 0.6 },
  botonTexto: { color: colors.navy900, fontSize: 16, fontWeight: "800" },
  botonSecundario: {
    borderWidth: 1.5,
    borderColor: colors.navy900,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  botonSecundarioTexto: { color: colors.navy900, fontWeight: "700" },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center", fontWeight: "600" },
  volverWrap: { alignItems: "center", marginTop: spacing.lg },
  volverTexto: { color: colors.textMutedOnNavy, fontSize: 14, fontWeight: "600" },
});
