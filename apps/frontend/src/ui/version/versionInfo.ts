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

type VersionSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

function parsearVersionSemver(valor: string): VersionSemver | null {
  const normalizada = String(valor || '').trim().replace(/^v/i, '').split('+', 1)[0] || '';
  const match = normalizada.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  };
}

/** Compara versiones semver: devuelve -1, 0 o 1. Las versiones inválidas son iguales. */
function compararPrerelease(izquierda: string[], derecha: string[]): number {
  if (izquierda.length === 0 && derecha.length === 0) return 0;
  if (izquierda.length === 0) return 1;
  if (derecha.length === 0) return -1;
  const limite = Math.max(izquierda.length, derecha.length);
  for (let i = 0; i < limite; i += 1) {
    const aId = izquierda[i];
    const bId = derecha[i];
    if (aId === undefined) return -1;
    if (bId === undefined) return 1;
    if (aId === bId) continue;
    const aNumerico = /^\d+$/.test(aId);
    const bNumerico = /^\d+$/.test(bId);
    if (aNumerico && bNumerico) return Number(aId) > Number(bId) ? 1 : -1;
    if (aNumerico !== bNumerico) return aNumerico ? -1 : 1;
    return aId > bId ? 1 : -1;
  }
  return 0;
}

export function compararVersiones(a: string, b: string): number {
  const izquierda = parsearVersionSemver(a);
  const derecha = parsearVersionSemver(b);
  if (!izquierda || !derecha) return 0;
  for (const campo of ['major', 'minor', 'patch'] as const) {
    if (izquierda[campo] !== derecha[campo]) return izquierda[campo] > derecha[campo] ? 1 : -1;
  }
  return compararPrerelease(izquierda.prerelease, derecha.prerelease);
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

