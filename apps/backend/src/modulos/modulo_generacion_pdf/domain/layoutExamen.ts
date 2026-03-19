/**
 * Value objects de layout de examen.
 * 
 * Encapsula la configuracion visual y estructural del PDF de examen,
 * incluyendo dimensiones, margenes, perfiles OMR, etc.
 */
import type { PerfilPlantillaOmr, TemplateVersion } from '../shared/tiposPdf';
import {
  TEMPLATE_VERSION_TV3,
  TEMPLATE_VERSION_TV4
} from './templateCompat';

const MM_A_PUNTOS = 72 / 25.4;

/**
 * Perfil OMR v3 (radical): hoja de respuestas robusta para fotografía móvil.
 */
export const PERFIL_OMR_V3: PerfilPlantillaOmr = {
  qrSize: 27 * MM_A_PUNTOS,
  qrPadding: 3.8 * MM_A_PUNTOS,
  qrMarginModulos: 8,
  marcasEsquina: 'cuadrados',
  marcaCuadradoSize: 9.2 * MM_A_PUNTOS,
  marcaCuadradoQuietZone: 1.4 * MM_A_PUNTOS,
  burbujaRadio: (2.8 * MM_A_PUNTOS) / 2,
  burbujaPasoY: 2.9 * MM_A_PUNTOS,
  cajaOmrAncho: 42,
  fiducialSize: 1.1 * MM_A_PUNTOS,
  bubbleStrokePt: 1,
  labelToBubbleMm: 1.6,
  preguntasPorBloque: 10,
  opcionesPorPregunta: 5
};

export const PERFIL_OMR_V4: PerfilPlantillaOmr = {
  ...PERFIL_OMR_V3
};

/**
 * Resuelve el perfil OMR segun la version de template.
 */
export function obtenerPerfilPlantilla(templateVersion: TemplateVersion): PerfilPlantillaOmr {
  if (templateVersion === TEMPLATE_VERSION_TV3) return PERFIL_OMR_V3;
  if (templateVersion === TEMPLATE_VERSION_TV4) return PERFIL_OMR_V4;
  throw new Error(`Template version ${String(templateVersion)} no compatible para layout OMR`);
}
