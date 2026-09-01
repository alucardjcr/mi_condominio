// Ronda 24: paleta y constantes de diseño centralizadas — antes cada
// pantalla definía sus propios colores sueltos (blanco + un color distinto
// por botón, sin ningún criterio en común). La idea es que toda pantalla
// nueva (o que se vaya retocando) importe esto en vez de inventar colores.
//
// Ronda 26: color institucional — el ramp "navy" ahora se genera a partir
// del azul EXACTO del logo oficial "Mi Condominio" (#014BD2, extraído
// directamente del archivo del logo), no de un navy genérico. Es un azul
// franco/rey, bastante más saturado que el navy casi-negro que había antes.
// Fijo siempre igual, independiente de si el celular está en modo oscuro o
// claro: la app nunca sigue el tema del sistema (no hay useColorScheme en
// ningún lado — todos los colores están hardcodeados vía este archivo), y
// app.json fija "userInterfaceStyle": "light" para que tampoco cambien los
// controles nativos (teclado, etc.).
export const colors = {
  // Azules institucionales — fondo de pantalla, header, drawer, tarjetas
  // oscuras. navy900 es el azul exacto del logo; el resto del ramp son
  // variaciones más oscuras/claras del mismo tono (no colores distintos).
  navy900: "#014BD2",
  navy800: "#0140B3",
  navy700: "#013593",
  navy600: "#2766D9",
  navy500: "#4D81E0",

  // Acento — para botones primarios, elementos activos, foco.
  gold: "#D4AF37",
  goldSoft: "#E9CB6B",

  // Superficies claras — tarjetas/inputs sobre fondo oscuro, y pantallas
  // que se mantienen con contenido claro por ahora.
  white: "#FFFFFF",
  offWhite: "#F4F6FB",
  border: "#E4E7EC",

  // Texto
  textOnNavy: "#F5F7FB",
  textMutedOnNavy: "#9AA9C7",
  textDark: "#101828",
  textMuted: "#667085",

  // Semánticos — se mantienen consistentes con lo que ya existía
  // (entrada = verde, salida = rojo, etc.) para no romper la asociación
  // que los guardias ya tienen con estos colores. "info" ahora es el mismo
  // azul institucional (antes era un azul suelto #1A6FC4 que además estaba
  // hardcodeado en ~35 pantallas de antes de la ronda 24 — se unificó todo
  // a este mismo valor).
  success: "#1A9D5C",
  danger: "#C0392B",
  info: "#014BD2",
  warning: "#D97706",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 26, fontWeight: "800" as const },
  heading: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
  small: { fontSize: 12, fontWeight: "500" as const },
};

// screenOptions comunes para los Stack/Drawer navigators — header azul
// marino consistente en toda la app en vez del header por defecto
// (blanco/negro del sistema) que traía cada navigator antes.
export const navHeaderOptions = {
  headerStyle: { backgroundColor: colors.navy800 },
  headerTintColor: colors.textOnNavy,
  headerTitleStyle: { fontWeight: "700" as const, fontSize: 17 },
  headerTitleAlign: "center" as const,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.offWhite },
};
