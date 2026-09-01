import { API_BASE_URL } from "../config/api";

// Ronda 31, a pedido explícito del usuario (Ley 21.719 de Protección de
// Datos Personales): desde esta ronda /uploads exige sesión válida (ver
// backend/src/index.ts) — cualquier <Image> que muestre una foto/firma/
// comprobante ahora tiene que mandar el token en el header Authorization,
// igual que cualquier otra llamada a la API. Este helper arma el `source`
// completo (uri + headers) a partir de la URL relativa o absoluta que
// devuelve el backend, para no repetir esta lógica en cada pantalla.
export function fuenteImagenPrivada(url: string | null | undefined, token: string | null): { uri: string; headers?: Record<string, string> } | null {
  if (!url) return null;
  const uri = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
}
