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
