import React from "react";
import Svg, { Circle, Rect } from "react-native-svg";
import { colors } from "../theme/theme";

// Ronda 76, a pedido explícito del usuario: ilustración decorativa para el
// encabezado de "Nuevo residente" (y reutilizable en cualquier otra
// pantalla que quiera el mismo estilo "hero" con edificios). Se dibuja con
// react-native-svg — ya estaba instalada en el proyecto (se usa para las
// firmas/gráficos de reportes), así que no hace falta agregar ninguna
// dependencia nueva ni un ícono cargado de afuera.
export default function IlustracionEdificios({ size = 110 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Nubes */}
      <Circle cx="24" cy="22" r="9" fill={colors.white} opacity={0.7} />
      <Circle cx="36" cy="18" r="12" fill={colors.white} opacity={0.7} />
      <Circle cx="48" cy="24" r="8" fill={colors.white} opacity={0.7} />

      {/* Árbol */}
      <Rect x="12" y="88" width="6" height="18" rx="2" fill="#0A8A4A" opacity={0.55} />
      <Circle cx="15" cy="82" r="12" fill="#2FAE6B" opacity={0.6} />

      {/* Edificio trasero (más chico, más claro) */}
      <Rect x="54" y="38" width="32" height="66" rx="4" fill={colors.azulVivo} opacity={0.3} />
      <Rect x="61" y="48" width="7" height="7" rx="1" fill={colors.white} opacity={0.8} />
      <Rect x="73" y="48" width="7" height="7" rx="1" fill={colors.white} opacity={0.8} />
      <Rect x="61" y="63" width="7" height="7" rx="1" fill={colors.white} opacity={0.8} />
      <Rect x="73" y="63" width="7" height="7" rx="1" fill={colors.white} opacity={0.8} />
      <Rect x="61" y="78" width="7" height="7" rx="1" fill={colors.white} opacity={0.8} />
      <Rect x="73" y="78" width="7" height="7" rx="1" fill={colors.white} opacity={0.8} />

      {/* Edificio delantero (principal) */}
      <Rect x="70" y="56" width="40" height="48" rx="5" fill={colors.azulVivo} />
      <Rect x="78" y="66" width="8" height="8" rx="1.5" fill={colors.goldSoft} />
      <Rect x="94" y="66" width="8" height="8" rx="1.5" fill={colors.goldSoft} />
      <Rect x="78" y="80" width="8" height="8" rx="1.5" fill={colors.goldSoft} />
      <Rect x="94" y="80" width="8" height="8" rx="1.5" fill={colors.goldSoft} />
      <Rect x="86" y="94" width="8" height="10" rx="1.5" fill={colors.navy900} opacity={0.5} />
    </Svg>
  );
}
