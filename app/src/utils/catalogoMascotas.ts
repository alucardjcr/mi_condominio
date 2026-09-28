import { OpcionSelect } from "../components/SelectModal";
import { EspecieMascota } from "../api/types";

// Ronda 78, a pedido explícito del usuario ("la idea es que tengamos en la
// bd las razas y las especies"): el catálogo de especies/razas vive en la
// base (ver GET /especies-mascota, tablas especie_mascota/raza_mascota) —
// este archivo solo arma las opciones para SelectModal a partir de lo que
// devuelve la API, y resuelve el caso "Otra" para especies/razas que no
// están en el catálogo (dato viejo, o el dueño la escribió a mano). En el
// backend `mascota.especie`/`mascota.raza` siguen siendo texto libre: se
// guarda el nombre elegido, no el id.

export const OPCION_OTRA: OpcionSelect = { id: -1, label: "Otra" };

export function opcionesEspeciesDesde(especies: EspecieMascota[]): OpcionSelect[] {
  return especies.map((e) => ({ id: e.id_especiemascota, label: e.gls_especie }));
}

/** Razas de la especie elegida (por su nombre/label), o vacío si no hay catálogo para ella. */
export function opcionesRazasDesde(especies: EspecieMascota[], especieLabel: string | undefined | null): OpcionSelect[] {
  if (!especieLabel) return [];
  const especie = especies.find((e) => e.gls_especie === especieLabel);
  if (!especie) return [];
  return especie.razas.map((r) => ({ id: r.id_razamascota, label: r.gls_raza }));
}

/**
 * Dado un valor ya guardado (puede venir de antes de este catálogo, o no
 * calzar con ninguna opción), devuelve la opción de SelectModal que
 * corresponde y, si no calza, el texto para el campo "Otra" junto con la
 * opción sintética OPCION_OTRA.
 */
export function opcionParaValor(valor: string | undefined | null, opciones: OpcionSelect[]): { sel: OpcionSelect | null; otro: string } {
  if (!valor || !valor.trim()) return { sel: null, otro: "" };
  const encontrada = opciones.find((o) => o.label.toLowerCase() === valor.trim().toLowerCase());
  if (encontrada) return { sel: encontrada, otro: "" };
  return { sel: OPCION_OTRA, otro: valor };
}
