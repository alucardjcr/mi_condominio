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

// ISO con zona (ej. '2026-10-06T22:15:00.000Z', como guarda las visitas el
// servidor) -> 'DD/MM/AAAA HH:MM' en la hora local del teléfono.
export function formatearFechaHoraISO(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 'YYYY-MM-DD HH:MM:SS' -> 'DD/MM/AAAA HH:MM'.
export function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return "";
  const [f, h] = valor.split(" ");
  const fecha = formatearFecha(f);
  return h ? `${fecha} ${h.slice(0, 5)}` : fecha;
}

// Formato 24 horas en todo el sistema (a pedido explícito del usuario).
// Aceptan ISO ('2026-10-09T14:44:00.000Z') o 'YYYY-MM-DD HH:MM:SS' y muestran
// la hora local del teléfono.
function aDate(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const d = new Date(valor.includes("T") ? valor : valor.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}
const dos = (n: number) => String(n).padStart(2, "0");

// 'DD/MM/AAAA HH:MM' (o 'DD/MM HH:MM' si conAnio=false).
export function fechaHora24(valor: string | null | undefined, conAnio = true): string {
  const d = aDate(valor);
  if (!d) return "";
  const fecha = `${dos(d.getDate())}/${dos(d.getMonth() + 1)}${conAnio ? `/${d.getFullYear()}` : ""}`;
  return `${fecha} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// 'HH:MM' en 24 horas.
export function hora24(valor: string | null | undefined): string {
  const d = aDate(valor);
  return d ? `${dos(d.getHours())}:${dos(d.getMinutes())}` : "";
}

// 'DD/MM/AAAA' de una fecha/hora cualquiera.
export function fecha24(valor: string | null | undefined): string {
  const d = aDate(valor);
  return d ? `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}
