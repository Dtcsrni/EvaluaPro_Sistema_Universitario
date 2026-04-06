/**
 * Configuracion de layout para impresion de examenes.
 * 
 * Centraliza la lectura de variables de entorno EXAMEN_LAYOUT_* y resuelve
 * el perfil de impresion con valores seguros y validados.
 */
import type { PerfilLayoutImpresion } from '../shared/tiposPdf';
import { MM_A_PUNTOS } from '../shared/tiposPdf';

function leerNumeroEnvSeguro(nombre: string, fallback: number, min?: number, max?: number): number {
  const raw = process.env[nombre];
  const valor = Number.parseFloat(String(raw ?? '').trim());
  if (!Number.isFinite(valor)) return fallback;
  let actual = valor;
  if (Number.isFinite(min as number)) actual = Math.max(min as number, actual);
  if (Number.isFinite(max as number)) actual = Math.min(max as number, actual);
  return actual;
}

function mmAPuntos(mm: number): number {
  return mm * MM_A_PUNTOS;
}

function leerBooleanEnv(nombre: string, fallback: boolean): boolean {
  const raw = String(process.env[nombre] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

/**
 * Resuelve el perfil de layout basado en variables de entorno.
 * Si no estan definidas, usa valores por defecto razonables.
 */
export function resolverPerfilLayout(): PerfilLayoutImpresion {
  const gridMm = leerNumeroEnvSeguro('EXAMEN_LAYOUT_GRID_MM', 0.4, 0.25, 2);
  const headerFirstMm = leerNumeroEnvSeguro('EXAMEN_LAYOUT_HEADER_FIRST_MM', 15, 10, 30);
  const headerOtherMm = leerNumeroEnvSeguro('EXAMEN_LAYOUT_HEADER_OTHER_MM', 3.5, 0, 20);
  const bottomSafeMm = leerNumeroEnvSeguro('EXAMEN_LAYOUT_BOTTOM_SAFE_MM', 4.5, 3, 16);

  const usarRellenosDecorativos = leerBooleanEnv('EXAMEN_LAYOUT_USAR_RELLENOS_DECORATIVOS', true);
  const usarEtiquetaOmrSolida = leerBooleanEnv('EXAMEN_LAYOUT_USAR_ETIQUETA_OMR_SOLIDA', true);

  return {
    gridStepPt: Math.max(0.25, mmAPuntos(gridMm)),
    headerHeightFirst: mmAPuntos(headerFirstMm),
    headerHeightOther: mmAPuntos(headerOtherMm),
    bottomSafePt: Math.max(mmAPuntos(3), mmAPuntos(bottomSafeMm)),
    usarRellenosDecorativos,
    usarEtiquetaOmrSolida
  };
}
