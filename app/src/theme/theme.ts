// Ronda 24: paleta y constantes de diseño centralizadas — antes cada
// pantalla definía sus propios colores sueltos (blanco + un color distinto
// por botón, sin ningún criterio en común). La idea es que toda pantalla
// nueva (o que se vaya retocando) importe esto en vez de inventar colores.
//
// Fondo azul marino + acento dorado — combinación clásica de "panel
// administrativo/institucional" (a pedido del usuario: fondos azul marino).
export const colors = {
  // Azules marinos — fondo de pantalla, header, drawer, tarjetas oscuras.
  navy900: "#0A1330",
  navy800: "#101B3D",
  navy700: "#182652",
  navy600: "#233568",
  navy500: "#33478A",

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
  // que los guardias ya tienen con estos colores.
  success: "#1A9D5C",
  danger: "#C0392B",
  info: "#1A6FC4",
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
