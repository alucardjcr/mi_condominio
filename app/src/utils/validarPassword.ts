// Ronda 38, a pedido explícito del usuario: mismo criterio que el backend
// (auth.service.ts -> validarFortalezaPassword) — se repite acá para dar
// el error al toque, sin esperar el viaje de ida y vuelta al servidor. El
// backend SIEMPRE vuelve a validar de todos modos (nunca hay que confiar
// solo en la validación del cliente).
export function validarPassword(password: string): string | null {
  if (!password || password.length < 12) {
    return "La contraseña debe tener al menos 12 caracteres.";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)) {
    return "La contraseña debe incluir al menos un símbolo especial (ej: @ $ % & / !).";
  }
  return null;
}

export const AYUDA_PASSWORD = "Mínimo 12 caracteres, con al menos 1 mayúscula, 1 número y 1 símbolo (ej: Matimania1500!)";
