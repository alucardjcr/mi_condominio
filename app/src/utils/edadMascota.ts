// Ronda 79, a pedido explícito del usuario: edad de la mascota a partir de
// su fecha de nacimiento ('YYYY-MM-DD'). A diferencia de las personas
// (calcularEdad, en validarRut.ts, solo años), una mascota de pocos meses
// no tiene sentido mostrarla como "0 años": menos de un año se muestra en
// meses. Devuelve null si no hay fecha o no es válida/es futura.

export function textoEdadMascota(fechaNacimiento: string | null | undefined): string | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();

  let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
  if (hoy.getDate() < nac.getDate()) meses--;
  if (meses < 0) return null;

  if (meses < 1) return "Menos de 1 mes";
  if (meses < 12) return meses === 1 ? "1 mes" : `${meses} meses`;
  const anios = Math.floor(meses / 12);
  return anios === 1 ? "1 año" : `${anios} años`;
}

// Validación del campo de texto 'AAAA-MM-DD' antes de mandarlo al backend
// (el backend vuelve a validar). Vacío es válido: el campo es opcional.
export function fechaNacimientoMascotaValida(texto: string): boolean {
  const v = texto.trim();
  if (!v) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) return false;
  return v <= new Date().toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' -> 'DD-MM-YYYY' (formato pedido por el usuario para mostrar fechas de mascotas).
export function formatearFechaMascota(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}-${m}-${y}` : "";
}
