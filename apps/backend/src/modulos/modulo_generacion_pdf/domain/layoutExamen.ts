/**
 * Value objects de layout de examen.
 * 
 * Encapsula la configuracion visual y estructural del PDF de examen,
 * incluyendo dimensiones, margenes, perfiles OMR, etc.
 */
import type { PerfilPlantillaOmr, TemplateVersion } from '../shared/tiposPdf';
import { TEMPLATE_VERSION_CANONICA } from './templateCanonico';

const MM_A_PUNTOS = 72 / 25.4;

/**
 * Perfil OMR canónico: hoja de respuestas robusta para fotografía móvil.
 */
export const PERFIL_OMR_CANONICO: PerfilPlantillaOmr = {
  // El payload por pagina incluye integridad, referencias y orden de
  // opciones; una superficie fisica mayor conserva mas modulo por pixel.
  qrSize: 25 * MM_A_PUNTOS,
  qrPadding: 3 * MM_A_PUNTOS,
  // Quiet zone de cuatro modulos, mas el padding blanco externo del PDF.
  qrMarginModulos: 4,
  marcasEsquina: 'lineas',
  marcaCuadradoSize: 5.8 * MM_A_PUNTOS,
  marcaCuadradoQuietZone: 0.8 * MM_A_PUNTOS,
  // Superficie de marcado ampliada para lectura humana y fotografía móvil.
  burbujaRadio: (4.8 * MM_A_PUNTOS) / 2,
  burbujaPasoY: 3.9 * MM_A_PUNTOS,
  // 132 pt dejan una celda legible para cinco respuestas y permiten que el
  // mapa persistido coincida con el panel que realmente se imprime.
  cajaOmrAncho: 132,
  fiducialSize: 1.5 * MM_A_PUNTOS,
  fiducialMargin: 0.9,
  fiducialQuietZone: 0.5 * MM_A_PUNTOS,
  bubbleStrokePt: 1,
  labelToBubbleMm: 2.2,
  preguntasPorBloque: 10,
  opcionesPorPregunta: 5
};

/** Resuelve el único perfil OMR operativo. */
export function obtenerPerfilPlantilla(templateVersion: TemplateVersion): PerfilPlantillaOmr {
  if (templateVersion === TEMPLATE_VERSION_CANONICA) return PERFIL_OMR_CANONICO;
  throw new Error(`Template version ${String(templateVersion)} no compatible para layout OMR canónico`);
}
