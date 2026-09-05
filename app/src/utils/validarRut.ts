// Ronda 70, a pedido explícito del usuario: validar el RUT chileno de
// TODAS las personas del sistema (residentes, guardias, personal,
// administradores, vetados) al perder el foco del campo — algoritmo
// estándar de dígito verificador módulo 11. Formato pedido: "12345678-9"
// (sin puntos, con guión).

/** Deja el RUT solo con dígitos + "K" mayúscula, sin puntos ni guión. */
function limpiarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Calcula el dígito verificador correcto para un cuerpo de RUT (sin DV). */
function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * true si el RUT es válido (cuerpo numérico + dígito verificador correcto,
 * algoritmo módulo 11). Acepta el RUT con o sin puntos/guión — se limpia
 * internamente antes de validar.
 */
export function esRutValido(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return calcularDigitoVerificador(cuerpo) === dv;
}

/**
 * Formatea un RUT ya limpio al formato pedido "12345678-9" (sin puntos).
 * Si el texto no alcanza a tener cuerpo + DV, lo devuelve tal cual venía
 * (para no "romper" lo que la persona todavía está escribiendo).
 */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return rut.trim();
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo}-${dv}`;
}

/**
 * Calcula la edad en años a partir de una fecha "YYYY-MM-DD". Devuelve
 * null si la fecha no es válida o viene vacía — para que la pantalla
 * simplemente no muestre nada en vez de un error.
 */
export function calcularEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const noCumplioAunEsteAnio =
    hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (noCumplioAunEsteAnio) edad--;
  return edad >= 0 ? edad : null;
}
