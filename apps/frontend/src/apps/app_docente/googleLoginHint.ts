const CLAVE_CUENTA_INSTITUCIONAL = 'ep.auth.google.last-institutional-email';
export const CUENTA_INSTITUCIONAL_INICIAL = 'Erick.vega@cuh.mx';

export function normalizarCorreoInstitucionalGoogle(correo: unknown): string | null {
  if (typeof correo !== 'string') return null;
  const normalizado = correo.trim();
  if (!normalizado || !/@cuh\.mx$/i.test(normalizado)) return null;
  return normalizado;
}

export function obtenerLoginHintGoogle(): string {
  try {
    return normalizarCorreoInstitucionalGoogle(localStorage.getItem(CLAVE_CUENTA_INSTITUCIONAL))
      ?? CUENTA_INSTITUCIONAL_INICIAL;
  } catch {
    return CUENTA_INSTITUCIONAL_INICIAL;
  }
}

/** Guarda solo una identidad institucional después de que la API acepte el login Google. */
export function recordarLoginGoogleInstitucional(correo: unknown): string | null {
  const normalizado = normalizarCorreoInstitucionalGoogle(correo);
  if (!normalizado) return null;
  try {
    localStorage.setItem(CLAVE_CUENTA_INSTITUCIONAL, normalizado);
  } catch {
    // La preferencia mejora la selección de cuenta, pero no debe bloquear la autenticación.
  }
  return normalizado;
}
