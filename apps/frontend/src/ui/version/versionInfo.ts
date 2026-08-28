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

export function abrirVentanaVersion(portal: 'docente' | 'alumno') {
  if (typeof window === 'undefined') return;
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#/version-info?portal=${encodeURIComponent(portal)}`;
  window.open(url, '_blank', 'noopener,noreferrer,width=1220,height=860');
}

