/**
 * Value objects de layout de examen.
 * 
 * Encapsula la configuracion visual y estructural del PDF de examen,
 * incluyendo dimensiones, margenes, perfiles OMR, etc.
 */
import type { OmrTemplateId, PerfilPlantillaOmr, TemplateVersion } from '../shared/tiposPdf.js';
import { OMR_TEMPLATE_ID_INLINE_EXAM } from '../shared/tiposPdf.js';
import { TEMPLATE_VERSION_CANONICA, resolverOmrTemplateId } from './templateCanonico.js';

const MM_A_PUNTOS = 72 / 25.4;

/**
 * Perfil OMR canónico: hoja de respuestas robusta para fotografía móvil.
 */
export const PERFIL_OMR_CANONICO: PerfilPlantillaOmr = {
  templateId: 'omr-canonical-v4',
  ubicacion: 'panel-separado',
  // El payload se mantiene firmado y el símbolo conserva corrección H/Q. El
  // tamaño físico de 32 mm deja módulos de al menos 0.56 mm incluso con 49
  // módulos y quiet zone de cuatro; aumenta muestreo móvil sin cambiar el QR.
  qrSize: 32 * MM_A_PUNTOS,
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
  // Hueco circular centrado en el fiducial superior izquierdo: asimetria
  // legible por CV para recuperar orientacion aunque el QR este ocluido.
  fiducialOrientacion: { esquina: 'tl', tipo: 'centro_vacio', radio: 1.2 * MM_A_PUNTOS },
  // Superficie de marcado ampliada para lectura humana y fotografía móvil.
  // Superficie reforzada para lectura humana y fotografia movil; el aumento
  // moderado conserva cinco opciones en una sola fila.
  burbujaRadio: (6.4 * MM_A_PUNTOS) / 2,
  // La fila horizontal conserva burbujas grandes y deja una holgura adicional
  // para fotografía móvil sobre papel carta: el paso de 26 pt evita que una
  // marca se funda con la vecina después de blur, compresión o tinta expandida.
  burbujaPasoY: 0,
  burbujaPasoX: 26,
  orientacion: 'horizontal',
  // El contenedor se ajusta al conjunto de cinco burbujas, etiquetas y
  // La caja crece junto con la señal para conservar reserva blanca entre el
  // quinto circulo y el borde del panel.
  cajaOmrAncho: 147,
  // Fiduciales ligeramente mayores, con quiet zone explicita, para mejorar la
  // localizacion en capturas moviles. Los mapas historicos persisten su
  // markerSpec y no se reinterpretan por este valor nuevo.
  fiducialSize: 2.3 * MM_A_PUNTOS,
  fiducialMargin: 1,
  fiducialQuietZone: 0.6 * MM_A_PUNTOS,
  bubbleStrokePt: 1,
  labelToBubbleMm: 2.2,
  preguntasPorBloque: 10,
  opcionesPorPregunta: 5
};

/**
 * Plantilla experimental con una burbuja al inicio de cada opción.
 * El tamaño y paso son valores candidatos y no habilitan calificación automática.
 */
export const PERFIL_OMR_INLINE_EXAM: PerfilPlantillaOmr = {
  ...PERFIL_OMR_CANONICO,
  templateId: OMR_TEMPLATE_ID_INLINE_EXAM,
  ubicacion: 'junto-a-opcion',
  burbujaRadio: (8 * MM_A_PUNTOS) / 2,
  burbujaPasoY: 10.5 * MM_A_PUNTOS,
  burbujaPasoX: undefined,
  orientacion: 'vertical',
  // El renderer candidato no reserva esta columna; conserva la dimensión base en metadatos heredados.
  cajaOmrAncho: PERFIL_OMR_CANONICO.cajaOmrAncho
};

/** Resuelve el único perfil OMR operativo. */
export function obtenerPerfilPlantilla(templateVersion: TemplateVersion, templateId?: OmrTemplateId): PerfilPlantillaOmr {
  const templateIdResuelto = resolverOmrTemplateId(templateId);
  if (templateVersion === TEMPLATE_VERSION_CANONICA && templateIdResuelto === OMR_TEMPLATE_ID_INLINE_EXAM) return PERFIL_OMR_INLINE_EXAM;
  if (templateVersion === TEMPLATE_VERSION_CANONICA && templateIdResuelto === PERFIL_OMR_CANONICO.templateId) return PERFIL_OMR_CANONICO;
  throw new Error(`Template version ${String(templateVersion)} no compatible para layout OMR canónico`);
}
