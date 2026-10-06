// Ronda 79, a pedido explícito del usuario: todas las fechas que ve la
// persona usan el formato DD/MM/AAAA. Por dentro la app y el backend siguen
// hablando 'YYYY-MM-DD' (así lo guarda la base de datos); estos helpers
// solo convierten al mostrar.

// 'YYYY-MM-DD' (o 'YYYY-MM-DD HH:MM:SS') -> 'DD/MM/AAAA'. Vacío si no hay fecha válida.
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

// 'YYYY-MM-DD HH:MM:SS' -> 'DD/MM/AAAA HH:MM'.
export function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return "";
  const [f, h] = valor.split(" ");
  const fecha = formatearFecha(f);
  return h ? `${fecha} ${h.slice(0, 5)}` : fecha;
}
