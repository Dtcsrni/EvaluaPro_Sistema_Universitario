/**
 * versionInfo
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
export function obtenerVersionApp(): string {
  return String(import.meta.env.VITE_APP_DISPLAY_VERSION || import.meta.env.VITE_APP_VERSION || '1.1.1');
}

export function obtenerVersionTecnicaApp(): string {
  return String(import.meta.env.VITE_APP_VERSION || '1.1.1');
}

export const OMR_CANONICAL_VERSION = Number(import.meta.env.VITE_OMR_CANONICAL_VERSION || 4) as 4;
export const OMR_CANONICAL_CONTRACT_ID = String(import.meta.env.VITE_OMR_CANONICAL_CONTRACT_ID || 'omr-canonical-v4');
export const OMR_CANONICAL_DISPLAY_LABEL = String(import.meta.env.VITE_OMR_CANONICAL_DISPLAY_LABEL || 'OMR canónico · v4');

export function abrirVentanaVersion(portal: 'docente' | 'alumno') {
  if (typeof window === 'undefined') return;
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#/version-info?portal=${encodeURIComponent(portal)}`;
  window.open(url, '_blank', 'noopener,noreferrer,width=1220,height=860');
}

