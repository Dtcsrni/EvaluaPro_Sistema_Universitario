/**
 * Value objects de layout de examen.
 * 
 * Encapsula la configuracion visual y estructural del PDF de examen,
 * incluyendo dimensiones, margenes, perfiles OMR, etc.
 */
import type { PerfilPlantillaOmr, TemplateVersion } from '../shared/tiposPdf.js';
import { TEMPLATE_VERSION_CANONICA } from './templateCanonico.js';

const MM_A_PUNTOS = 72 / 25.4;

/**
 * Perfil OMR canónico: hoja de respuestas robusta para fotografía móvil.
 */
export const PERFIL_OMR_CANONICO: PerfilPlantillaOmr = {
  // El payload se mantiene compacto y firmado. 28 mm de símbolo con 3 mm de
  // padding externo conserva una quiet zone física clara y reduce el footprint
  // total de la tarjeta a 34 mm, sin cambiar la señal del OMR.
  // Con el payload canónico actual (53 módulos + 4 de margen por lado), cada
  // módulo sigue superando 5 dots a 300 dpi; no se baja de este umbral.
  qrSize: 28 * MM_A_PUNTOS,
  qrPadding: 3 * MM_A_PUNTOS,
  // Quiet zone de cuatro modulos, mas el padding blanco externo del PDF.
  qrMarginModulos: 4,
  // Cuadrados sólidos con zona de silencio: ofrecen una firma geométrica
  // estable para homografía aun cuando una foto tenga blur o perspectiva.
  marcasEsquina: 'cuadrados',
  // 7 mm conserva una firma negra estable incluso en capturas de 96 DPI;
  // sigue dentro del margen imprimible de 10 mm y no invade contenido.
  marcaCuadradoSize: 7 * MM_A_PUNTOS,
  marcaCuadradoQuietZone: 0.8 * MM_A_PUNTOS,
  // Superficie de marcado ampliada para lectura humana y fotografía móvil.
  burbujaRadio: (6 * MM_A_PUNTOS) / 2,
  // La fila horizontal conserva burbujas grandes y deja una holgura adicional
  // para fotografía móvil sobre papel carta: el paso de 25 pt evita que una
  // marca se funda con la vecina después de blur, compresión o tinta expandida.
  burbujaPasoY: 0,
  burbujaPasoX: 25,
  orientacion: 'horizontal',
  // El contenedor se ajusta al conjunto de cinco burbujas, etiquetas y
  // fiduciales; no reserva espacio ornamental a la derecha. 137 pt conserva
  // el mismo aire lateral y agrega 2 pt de separación por lado al conjunto.
  cajaOmrAncho: 137,
  // Dos milímetros dejan una huella de aproximadamente 9–10 px en capturas
  // de 120 dpi; el marcador sigue cabiendo dentro de la caja compacta sin
  // invadir la ventana de búsqueda de la burbuja vecina.
  fiducialSize: 2 * MM_A_PUNTOS,
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
