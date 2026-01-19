/**
 * Utilidades de texto (normalizaciones/formatos).
 */

export function normalizarEspacios(valor: string): string {
  return String(valor || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function aTituloPropio(valor: string): string {
  const limpio = normalizarEspacios(valor).toLowerCase();
  if (!limpio) return '';
  return limpio
    .split(' ')
    .filter(Boolean)
    .map((parte) => (parte.length === 1 ? parte.toUpperCase() : parte[0].toUpperCase() + parte.slice(1)))
    .join(' ');
}

const REGEX_MATRICULA = /^CUH\d{9}$/;

export function normalizarMatricula(valor: string): string {
  return normalizarEspacios(valor).replace(/\s+/g, '').toUpperCase();
}

export function esMatriculaValida(valor: string): boolean {
  return REGEX_MATRICULA.test(normalizarMatricula(valor));
}

/**
 * Normaliza un texto para usarlo como parte de un nombre de archivo.
 * - Elimina acentos/diacríticos.
 * - Reemplaza espacios por guiones bajos.
 * - Remueve caracteres inválidos (Windows/macOS/Linux).
 */
export function normalizarParaNombreArchivo(
  valor: unknown,
  opciones?: {
    maxLen?: number;
  }
): string {
  const maxLen = Math.max(8, Math.floor(opciones?.maxLen ?? 80));
  const base = String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!base) return '';

  let salida = base
    .replace(/\s+/g, '_')
    // caracteres prohibidos en Windows: <>:"/\|?*
    .replace(/[<>:"/\\|?*]/g, '')
    // elimina caracteres de control (categoria Unicode Cc)
    .replace(/[\p{Cc}]/gu, '')
    // deja solo un set seguro; lo demás se convierte en '-'
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+/, '')
    .replace(/[-_.]+$/, '');

  if (!salida) return '';
  if (salida.length > maxLen) {
    salida = salida.slice(0, maxLen).replace(/[-_.]+$/, '');
  }
  return salida;
}
