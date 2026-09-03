// Ronda 24: paleta y constantes de diseño centralizadas — antes cada
// pantalla definía sus propios colores sueltos (blanco + un color distinto
// por botón, sin ningún criterio en común). La idea es que toda pantalla
// nueva (o que se vaya retocando) importe esto en vez de inventar colores.
//
// Ronda 26: color institucional — el ramp "navy" se generó originalmente a
// partir del azul EXACTO del logo oficial "Mi Condominio" (#014BD2).
//
// Ronda 54, a pedido explícito del usuario: ese azul, usado como FONDO DE
// PANTALLA COMPLETA (login, dashboards), resultaba demasiado saturado/
// vibrante para sesiones largas — más "azul rey llamativo" que el navy
// sobrio que suelen usar apps de gestión serias (bancos, herramientas de
// trabajo). El ramp "navy" ahora se basa en un tono más apagado y oscuro
// (#0A2C6B) para fondo/superficie — el azul vibrante original queda
// disponible aparte como `azulVivo`, para usarlo puntualmente en acentos
// (el logo ya lo trae de fábrica, badges destacados, etc.), no como color
// de fondo dominante.
export const colors = {
  // Azules institucionales — fondo de pantalla, header, drawer, tarjetas
  // oscuras. Todo el ramp son variaciones más oscuras/claras del mismo
  // tono sobrio (no colores distintos).
  navy900: "#0A2C6B",
  navy800: "#082350",
  navy700: "#061A3B",
  navy600: "#2F538F",
  navy500: "#5478B0",

  // El azul vibrante original del logo — a propósito NO se usa como fondo
  // de pantalla completa (por eso dejó de ser navy900); queda disponible
  // para acentos puntuales que sí quieran destacar con energía.
  azulVivo: "#014BD2",

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
  // que los guardias ya tienen con estos colores. "info" sigue el mismo
  // azul institucional que el resto del ramp (ronda 54: ahora el sobrio,
  // no el vibrante).
  success: "#1A9D5C",
  danger: "#C0392B",
  info: "#0A2C6B",
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
