/**
 * Servicio de escaneo OMR basado en posiciones del PDF.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  buscarMejorOffsetPregunta,
  calcularMetricasPregunta,
  evaluarConOffset,
  type EstadoImagenOmr
} from './omrCore.js';
import { UMBRALES_OMR_AUTO, evaluarRescateAltaPrecisionOmr } from './politicaAutoCalificacionOmr.js';
import {
  calcularRegionQrFocalizada,
  calcularIntegral,
  coincidePayloadQrExacto,
  detectarOpcion,
  detectarQrEnRecorteNativo,
  detectarQrPorGeometriaConocida,
  detectarQrMejorado,
  detectarQrZxingPaginaFuente,
  extraerSubimagenRgba,
  mediaEnVentana,
  obtenerTransformacion
} from './infra/imagenProcesamientoCv.js';
import type { QrDetalle } from './infra/imagenProcesamientoCv.js';
import { OMR_ENGINE_RELEASE } from './omr/engineRelease.js';
import {
  fusionarRespuestaOmrV2,
  rescatarCandidataEstableEntrePasadas,
  rescatarCandidataEtiquetadaDebilEntrePasadas,
  rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas
} from './omr/decision/consensoRespuesta.js';
import {
  clasificarEstadoRespuestaOmr,
  resumirRespuestasOmr,
  type EstadoRespuestaOmr,
  type ResumenRespuestasOmr
} from './omr/decision/estadoRespuesta.js';

type OpcionRespuestaOmr = 'A' | 'B' | 'C' | 'D' | 'E';

export type ScoreOpcionOmr = {
  opcion: OpcionRespuestaOmr;
  score: number;
  fillRatioCore: number;
  fillRatioRing: number;
  fillDelta: number;
  /** Contraste de intensidad entre el fondo local y el centro de la burbuja. */
  contraste: number;
  radialMassRatio: number;
  centroidOffsetRatio: number;
  centerDarknessDelta: number;
  centerMean: number;
  softCoreContrast: number;
  softCentroidOffsetRatio: number;
  ringMean: number;
  outerMean: number;
  nucleusFillRatio: number;
  nucleusDarknessDelta: number;
  contrasteCromaticoLocal?: number;
  margenCromatico?: number;
  strokeLeakPenalty: number;
  shapeCompactness: number;
  markConfidence: number;
  /** Mayor componente oscuro conectado dentro del núcleo de la burbuja. */
  largestComponentPixels?: number;
  largestComponentFillRatio?: number;
  largestComponentOffsetRatio?: number;
  largestComponentDensity?: number;
  largestComponentAspectRatio?: number;
  estadoMarca: 'no_marcada' | 'parcial' | 'marcada' | 'tachada';
};

export type RespuestaDetectadaOmr = {
  numeroPregunta: number;
  opcion: OpcionRespuestaOmr | null;
  confianza: number;
  scoresPorOpcion: ScoreOpcionOmr[];
  flags: Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi' | 'parcial_detectada' | 'tachada_detectada'>;
  estadoRespuesta?: EstadoRespuestaOmr;
};

export type ResultadoOmr = {
  respuestasDetectadas: RespuestaDetectadaOmr[];
  advertencias: string[];
  qrTexto?: string;
  qrFuenteDeteccion?: 'jsqr' | 'zxing' | 'preprocesado' | 'resolucion_fuente' | 'known_geometry_rescue' | 'rotacion_pagina';
  calidadPagina: number;
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  motivosRevision: string[];
  templateVersionDetectada: TemplateVersion;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
  resumenRespuestas?: ResumenRespuestasOmr;
  engineVersion: 'omr-cv';
  /** Release del motor OMR/QR, independiente de la app y la plantilla. */
  engineRelease?: typeof OMR_ENGINE_RELEASE;
  geomQuality: number;
  photoQuality: number;
  decisionPolicy: 'conservadora_v2';
  /** Transformacion que termino gobernando las coordenadas de lectura. */
  geometryMode?: 'escala' | 'homografia' | 'qr';
  /** Evidencia de referencia de pagina usada para auditar la geometria. */
  geometryReferencePoints?: number;
  geometryReferenceQuality?: number;
  /** Giro estimado desde la arista superior del QR o de las marcas de pagina. */
  pageRotationDegrees?: 0 | 90 | 180 | 270;
  /** Inclinacion residual estimada despues de descontar el giro de 90 grados. */
  pageSkewDegrees?: number;
  pageOrientationDetermined?: boolean;
  pageOrientationConfidence?: number;
  pageOrientationMargin?: number;
  pageOrientationSource?: 'qr' | 'qr_patron_esperado' | 'fiducial_direccional' | 'indeterminada';
  pageOrientationConflict?: boolean;
  /** Indica que al menos una pregunta valido fiduciales locales. */
  geometryLocalEnabled?: boolean;
  /** Orientacion aplicada antes de proyectar el mapa OMR. */
  orientationMode?: 'none' | 'exif' | 'landscape_without_exif';
};

/**
 * Una respuesta pendiente basta para intentar la segunda hipotesis de
 * geometria; el resultado alternativo se conserva solo si el consenso mejora
 * sin perder cobertura.
 */
export function debeUsarRescateAltaResolucionOmr(
  estadoAnalisis: ResultadoOmr['estadoAnalisis'],
  cobertura: number
) {
  return estadoAnalisis === 'ok' && Number.isFinite(cobertura) && cobertura < 1;
}

function tieneDominanteFuertePendienteOmr(respuesta: Pick<RespuestaDetectadaOmr, 'opcion' | 'scoresPorOpcion'>) {
  if (respuesta.opcion != null) return false;
  const [dominante, segunda] = [...respuesta.scoresPorOpcion].sort((a, b) => b.score - a.score);
  return Boolean(
    dominante &&
    dominante.score >= 0.35 &&
    dominante.score - (segunda?.score ?? 0) >= 0.12 &&
    dominante.fillRatioCore >= 0.3 &&
    dominante.contraste >= 0.12 &&
    dominante.radialMassRatio >= 0.28 &&
    dominante.centroidOffsetRatio <= 0.4 &&
    dominante.shapeCompactness >= 0.25 &&
    dominante.markConfidence >= 0.6
  );
}

type Punto = { x: number; y: number };
type TemplateVersion = 4;
type PerfilGeometriaOmr = 'actual' | 'geo_tight_search';

/**
 * Decide si una pagina puede usar fiduciales locales aun cuando la referencia
 * global haya quedado en escala simple. La excepcion exige mapa con
 * fiduciales, no QR y no estar en un mapa derivado con escala forzada.
 */
export function debeUsarGeometriaLocalOmr(args: {
  habilitada: boolean;
  deshabilitada: boolean;
  referenciaGlobalFuerte: boolean;
  transformacion: 'escala' | 'homografia' | 'qr';
  qrDetectado: boolean;
  capturaBajaResolucion: boolean;
  forceSimpleScale: boolean;
  tieneFiducialesLocales: boolean;
}) {
  if (!args.habilitada || args.deshabilitada || args.referenciaGlobalFuerte) return false;
  if (
    args.transformacion === 'escala' &&
    !args.qrDetectado &&
    !args.capturaBajaResolucion
  ) {
    return args.tieneFiducialesLocales && !args.forceSimpleScale;
  }
  return true;
}

/**
 * Una homografia puede ser la referencia global mas fuerte y, aun asi, el
 * comparador de señal puede elegir escala nominal para leer la hoja. En esa
 * transicion la escala vuelve a ser la transformacion gobernante, por lo que
 * los fiduciales locales deben poder validar el corrimiento del panel.
 */
export function debeReactivarGeometriaLocalTrasEscalaOmr(args: {
  transformacionSeleccionada: 'escala' | 'homografia' | 'qr';
  qrDetectado: boolean;
  forceSimpleScale: boolean;
  deshabilitada: boolean;
  coordenadasEstrictas: boolean;
  tieneFiducialesLocales: boolean;
}) {
  return (
    args.transformacionSeleccionada === 'escala' &&
    !args.qrDetectado &&
    !args.forceSimpleScale &&
    !args.deshabilitada &&
    !args.coordenadasEstrictas &&
    args.tieneFiducialesLocales
  );
}

/**
 * Una puntuacion basada en tinta no desplaza una homografia sostenida por
 * cuatro fiduciales de esquina con calidad alta. La escala explicita del mapa
 * siempre conserva prioridad.
 */
/**
 * Las fotografias moviles pueden conservar una pagina vertical como pixeles
 * apaisados cuando la aplicacion no guarda EXIF. El mapa OMR siempre describe
 * una hoja carta vertical; se corrige solo ese caso antes de buscar QR y
 * fiduciales. Las orientaciones EXIF las resuelve Sharp mediante rotate().
 */
export function determinarOrientacionCapturaOmr(args: {
  width: number;
  height: number;
  exifOrientation?: number;
}) {
  const orientation = Number(args.exifOrientation);
  const orientationValida = Number.isInteger(orientation) && orientation >= 1 && orientation <= 8;
  const intercambiaEjes = orientationValida && [5, 6, 7, 8].includes(orientation);
  const landscapeWithoutExif =
    args.width > args.height * 1.05 && (!orientationValida || orientation === 1);
  if (landscapeWithoutExif) {
    return {
      modo: 'landscape_without_exif' as const,
      // Sharp aplica los grados positivos en sentido horario. Estas capturas
      // apaisadas contienen el documento girado en sentido antihorario dentro
      // del archivo; +90 deja el texto y el panel OMR en orientación vertical.
      // El signo contrario dejaba la hoja invertida y muestreaba fuera de las
      // burbujas, generando detecciones aisladas y falsos dobles.
      rotacionGrados: 90 as const,
      width: args.height,
      height: args.width
    };
  }
  return {
    modo: intercambiaEjes ? 'exif' as const : 'none' as const,
    rotacionGrados: 0 as const,
    width: intercambiaEjes ? args.height : args.width,
    height: intercambiaEjes ? args.width : args.height
  };
}

/**
 * Identifica un punto de lapiz real dentro de una burbuja sin aceptar el
 * borde de una burbuja vecina o una segunda marca. La masa radial, la
 * compacidad y el desplazamiento del centro separan el punto de tinta de un
 * artefacto desplazado. La tolerancia de centro es amplia solo porque las
 * capturas de baja resolucion cuantizan el punto en pocos pixeles.
 */
export function debeAceptarPuntoCentralAisladoOmr(args: {
  panelHorizontal: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  nucleoDominante: number;
  segundoNucleo: number;
  masaRadial: number;
  desplazamientoCentro: number;
  compacidad: number;
  nucleoTinta?: number;
  nucleoContraste?: number;
  componentePixels?: number;
  componenteFillRatio?: number;
  componenteAspectRatio?: number;
}) {
  const componentePareceResiduo = pareceResiduoDeCompresionOmr({
    largestComponentPixels: args.componentePixels,
    largestComponentFillRatio: args.componenteFillRatio,
    largestComponentAspectRatio: args.componenteAspectRatio
  });
  const evidenciaMicroNucleo =
    (args.nucleoTinta ?? 0) >= 0.18 &&
    (args.nucleoContraste ?? 0) >= 0.035 &&
    args.desplazamientoCentro <= 0.35;
  const limiteNucleoCompatible =
    args.nucleoTinta == null && args.nucleoContraste == null
      ? true
      : args.nucleoDominante <= 0.18 || evidenciaMicroNucleo;
  return (
    args.panelHorizontal &&
    !args.dobleMarcada &&
    !args.tachada &&
    !componentePareceResiduo &&
    (args.nucleoDominante >= 0.12 || evidenciaMicroNucleo) &&
    limiteNucleoCompatible &&
    args.nucleoDominante - args.segundoNucleo >= 0.07 &&
    args.segundoNucleo <= 0.08 &&
    args.masaRadial >= 0.45 &&
    args.desplazamientoCentro <= 0.5 &&
    (args.compacidad >= 0.15 || evidenciaMicroNucleo)
  );
}

function pareceResiduoDeCompresionOmr(componente: {
  largestComponentPixels?: number;
  largestComponentFillRatio?: number;
  largestComponentAspectRatio?: number;
}) {
  return (
    (componente.largestComponentFillRatio ?? 1) < 0.04 &&
    (componente.largestComponentPixels ?? Number.MAX_SAFE_INTEGER) <= 16 &&
    (componente.largestComponentAspectRatio ?? 1) >= 3
  );
}

/**
 * Acepta una tinta cromática localizada cuando destaca frente al papel
 * alrededor y frente a las otras cuatro burbujas. No sustituye la evidencia
 * geométrica y nunca resuelve dobles ni tachaduras.
 */
export function debeAceptarMarcaCromaticaAisladaOmr(args: {
  panelHorizontal: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  existeOpcionActual: boolean;
  contrasteCromaticoLocal: number;
  margenCromatico: number;
  fillRatioCore: number;
  nucleusFillRatio: number;
  centroidOffsetRatio: number;
  softCentroidOffsetRatio: number;
}) {
  return (
    args.panelHorizontal &&
    !args.dobleMarcada &&
    !args.tachada &&
    !args.existeOpcionActual &&
    args.contrasteCromaticoLocal >= 0.04 &&
    args.margenCromatico >= 0.035 &&
    (args.fillRatioCore >= 0.08 || args.nucleusFillRatio >= 0.12) &&
    (args.centroidOffsetRatio <= 0.68 || args.softCentroidOffsetRatio <= 0.45)
  );
}

/**
 * Solo descarta un doble cuando una tinta cromática domina y las otras
 * opciones carecen de una segunda señal geométrica fuerte. Una marca negra
 * competidora conserva el rechazo conservador de doble respuesta.
 */
export function debeResolverDobleOmrPorTintaCromatica(args: {
  panelHorizontal: boolean;
  tachada: boolean;
  scores: readonly ScoreOpcionOmr[];
}) {
  if (!args.panelHorizontal || args.tachada) return false;
  const [candidata, ...competidoras] = [...args.scores].sort(
    (a, b) => (b.contrasteCromaticoLocal ?? 0) - (a.contrasteCromaticoLocal ?? 0)
  );
  if (
    !candidata ||
    (candidata.contrasteCromaticoLocal ?? 0) < 0.12 ||
    (candidata.margenCromatico ?? 0) < 0.08 ||
    candidata.score < 0.42 ||
    candidata.markConfidence < 0.65 ||
    (candidata.fillRatioCore < 0.5 && candidata.nucleusFillRatio < 0.5) ||
    candidata.centroidOffsetRatio > 0.5
  ) return false;

  const umbralCompetidor = Math.max(0.42, candidata.score * 0.72);
  return !competidoras.some((otra) =>
    otra.score >= umbralCompetidor &&
    otra.fillRatioCore >= 0.5 &&
    (otra.centerDarknessDelta >= 0.16 || otra.markConfidence >= 0.88) &&
    otra.shapeCompactness >= 0.35 &&
    otra.estadoMarca !== 'tachada'
  );
}

/**
 * Rescata un punto compacto aislado cuando el relleno medio no alcanza los
 * umbrales normales. La dominancia debe existir entre las cinco opciones y la
 * componente debe estar dentro del núcleo, no sobre el anillo impreso.
 */
export function seleccionarPuntoCompactoAisladoOmr(args: {
  panelHorizontal: boolean;
  existeOpcionActual: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  scores: readonly ScoreOpcionOmr[];
}): ScoreOpcionOmr | null {
  if (!args.panelHorizontal || args.existeOpcionActual || args.dobleMarcada || args.tachada) return null;
  const [mejor, segunda] = [...args.scores].sort(
    (a, b) => (b.largestComponentFillRatio ?? 0) - (a.largestComponentFillRatio ?? 0)
  );
  if (!mejor || !segunda || mejor.estadoMarca === 'tachada') return null;
  const fill = mejor.largestComponentFillRatio ?? 0;
  const fillSegundo = segunda.largestComponentFillRatio ?? 0;
  const pixels = mejor.largestComponentPixels ?? 0;
  const margen = fill - fillSegundo;
  const centrosCompetidores = args.scores
    .filter((item) => item.opcion !== mejor.opcion)
    .map((item) => item.centerMean)
    .sort((a, b) => a - b);
  const medianaCentroCompetidores = centrosCompetidores.length === 4
    ? ((centrosCompetidores[1] ?? 0) + (centrosCompetidores[2] ?? 0)) / 2
    : null;
  const microcomponenteTenueDominante = Boolean(
    args.scores.length === 5 &&
    medianaCentroCompetidores != null &&
    medianaCentroCompetidores - mejor.centerMean >= 6 &&
    mejor.score <= 0.08 &&
    mejor.fillRatioCore <= 0.12 &&
    pixels >= 7 &&
    fill >= 0.02 &&
    fill <= 0.08 &&
    margen >= 0.015 &&
    fill >= Math.max(0.02, fillSegundo * 2.2) &&
    (mejor.largestComponentOffsetRatio ?? 1) <= 0.55 &&
    (mejor.largestComponentDensity ?? 0) >= 0.3 &&
    (mejor.largestComponentAspectRatio ?? Number.MAX_SAFE_INTEGER) <= 2.2 &&
    mejor.softCentroidOffsetRatio <= 0.5
  );
  // Capturas con una marca muy tenue pueden conservar suficiente contraste
  // central y una componente compacta, aunque la densidad quede debajo del
  // umbral normal. Este rescate exige evidencia más fuerte y más localizada.
  const microcomponenteTenueDeAltoContraste = Boolean(
    args.scores.length === 5 &&
    medianaCentroCompetidores != null &&
    medianaCentroCompetidores - mejor.centerMean >= 14 &&
    mejor.score <= 0.08 &&
    mejor.fillRatioCore <= 0.16 &&
    pixels >= 12 &&
    fill >= 0.035 &&
    fill <= 0.07 &&
    margen >= 0.025 &&
    fill >= Math.max(0.035, fillSegundo * 3) &&
    (mejor.largestComponentOffsetRatio ?? 1) <= 0.35 &&
    (mejor.largestComponentDensity ?? 0) >= 0.24 &&
    (mejor.largestComponentAspectRatio ?? Number.MAX_SAFE_INTEGER) <= 1.8 &&
    mejor.softCentroidOffsetRatio <= 0.25
  );
  const puntoCompactoConvencional = (
    pixels >= 4 &&
    fill >= 0.025 &&
    fill <= 0.28 &&
    margen >= 0.025 &&
    fill >= Math.max(0.045, fillSegundo * 2.2) &&
    (mejor.largestComponentOffsetRatio ?? 1) <= 0.48 &&
    (mejor.largestComponentDensity ?? 0) >= 0.35 &&
    (mejor.largestComponentAspectRatio ?? Number.MAX_SAFE_INTEGER) <= 2.2
  );
  return microcomponenteTenueDominante || microcomponenteTenueDeAltoContraste || puntoCompactoConvencional
    ? mejor
    : null;
}

/**
 * Recupera una marca tenue que conserva tinta en el nucleo aunque el score
 * global quede dominado por el anillo impreso. Exige margen fotometrico,
 * componente centrada y compacta, y ausencia de una opcion ya elegida o de
 * una doble/tachadura.
 */
export function seleccionarNucleoTenueDominanteOmr(args: {
  panelHorizontal: boolean;
  existeOpcionActual: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  scores: readonly ScoreOpcionOmr[];
}): ScoreOpcionOmr | null {
  if (!args.panelHorizontal || args.existeOpcionActual || args.dobleMarcada || args.tachada || args.scores.length !== 5) {
    return null;
  }
  const [mejor, segunda] = [...args.scores].sort(
    (a, b) => b.nucleusDarknessDelta - a.nucleusDarknessDelta || b.markConfidence - a.markConfidence
  );
  if (!mejor || !segunda || mejor.estadoMarca === 'tachada') return null;
  const margenNucleo = mejor.nucleusDarknessDelta - segunda.nucleusDarknessDelta;
  const componentePixels = mejor.largestComponentPixels ?? 0;
  const componenteFill = mejor.largestComponentFillRatio ?? 0;
  return (
    mejor.score <= 0.12 &&
    mejor.nucleusDarknessDelta >= 0.2 &&
    margenNucleo >= 0.05 &&
    mejor.fillRatioCore >= 0.22 &&
    mejor.nucleusFillRatio >= 0.3 &&
    mejor.centroidOffsetRatio <= 0.3 &&
    componentePixels >= 50 &&
    componenteFill >= 0.18 &&
    componenteFill <= 0.4 &&
    (mejor.largestComponentOffsetRatio ?? 1) <= 0.3 &&
    (mejor.largestComponentDensity ?? 0) >= 0.3 &&
    (mejor.largestComponentAspectRatio ?? Number.MAX_SAFE_INTEGER) <= 2
  ) ? mejor : null;
}

/**
 * Acepta una marca cuyo relleno global quedo degradado por compresion o
 * interpolacion, pero conserva evidencia fotometrica independiente en el
 * nucleo. El margen frente a la segunda opcion y la ausencia de un segundo
 * nucleo fuerte evitan convertir una doble marca en una respuesta valida.
 */
export function debeAceptarNucleoRobustoOmr(args: {
  panelHorizontal: boolean;
  capturaBajaResolucion: boolean;
  dobleMarcada: boolean;
  segundaNucleoConEvidencia: boolean;
  tachada: boolean;
  scoreDominante: number;
  scoreSegundo: number;
  nucleoDominante: number;
  nucleoTinta: number;
  nucleoContraste: number;
  desplazamientoCentro: number;
  confianza: number;
}) {
  return (
    args.panelHorizontal &&
    args.capturaBajaResolucion &&
    !args.tachada &&
    (!args.dobleMarcada || !args.segundaNucleoConEvidencia) &&
    args.scoreDominante >= 0.25 &&
    args.scoreSegundo <= 0.22 &&
    args.nucleoDominante >= 0.2 &&
    args.nucleoTinta >= 0.2 &&
    args.nucleoContraste >= 0.01 &&
    args.desplazamientoCentro <= 0.35 &&
    args.confianza >= 0.55
  );
}

/**
 * Acepta una marca tenue cuando la evidencia continua (grises) conserva una
 * burbuja compacta aunque la binarización haya producido pocos píxeles. No
 * usa la clave ni una respuesta observada: exige separación de fila,
 * contraste local, masa centrada y ausencia de segunda señal.
 */
export function debeAceptarMarcaFaintOmr(args: {
  panelHorizontal: boolean;
  capturaBajaResolucion: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  scoreDominante: number;
  scoreSegundo: number;
  contraste: number;
  nucleoDominante: number;
  masaRadial: number;
  desplazamientoCentro: number;
  compacidad: number;
  confianza: number;
  /** Evidencia continua del núcleo, independiente de la máscara binaria. */
  contrasteSuave?: number;
  /** Centroide de la tinta continua; evita rescatar un trazo lateral. */
  desplazamientoSuave?: number;
  /** Contraste medido solo en el núcleo; separa tinta de sombreado global. */
  contrasteNucleoSuave?: number;
}) {
  const rescateContinuo = args.contrasteSuave != null;
  const contraste = rescateContinuo ? args.contrasteSuave ?? 0 : args.contraste;
  const desplazamiento = rescateContinuo
    ? args.desplazamientoSuave ?? args.desplazamientoCentro
    : args.desplazamientoCentro;
  const nucleoTenueValido = !rescateContinuo ||
    (args.contrasteNucleoSuave ?? 0) >= 0.02 ||
    (contraste >= 0.055 && args.compacidad >= 0.12 && args.nucleoDominante <= 0.15);
  return (
    args.panelHorizontal &&
    (args.capturaBajaResolucion || rescateContinuo) &&
    !args.dobleMarcada &&
    !args.tachada &&
    args.scoreDominante >= (rescateContinuo ? 0 : 0.04) &&
    args.scoreDominante - args.scoreSegundo >= 0.04 &&
    args.scoreSegundo <= 0.03 &&
    nucleoTenueValido &&
    contraste >= (rescateContinuo ? 0.05 : 0.16) &&
    args.nucleoDominante >= (rescateContinuo ? 0.06 : 0.2) &&
    args.masaRadial >= (rescateContinuo ? 0.05 : 0.15) &&
    desplazamiento <= (rescateContinuo ? 0.72 : 0.45) &&
    args.compacidad >= (rescateContinuo ? 0.08 : 0.22) &&
    args.confianza >= (rescateContinuo ? 0 : 0.08)
  );
}

/**
 * Recupera una marca de baja señal cuando los rasgos continuos todavía
 * aíslan una sola burbuja. No sustituye la lectura normal: requiere una
 * segunda opción prácticamente vacía y rechaza dobles/tachaduras explícitas.
 */
export function rescatarMarcaAisladaPorRasgosOmr(args: {
  panelHorizontal: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  scores: readonly ScoreOpcionOmr[];
}): ScoreOpcionOmr | null {
  if (!args.panelHorizontal || args.dobleMarcada || args.tachada) return null;
  const proxy = (item: ScoreOpcionOmr) =>
    item.fillRatioCore * 0.4 +
    item.contraste * 0.25 +
    item.nucleusFillRatio * 0.18 +
    item.shapeCompactness * 0.1 +
    item.radialMassRatio * 0.07;
  const [dominante, segunda] = [...args.scores].sort(
    (a, b) => proxy(b) - proxy(a) || a.opcion.localeCompare(b.opcion)
  );
  if (!dominante || !segunda || dominante.estadoMarca === 'tachada') return null;
  const evidenciaSegunda =
    (
      segunda.fillRatioCore > 0.1 ||
      segunda.nucleusFillRatio > 0.25 ||
      segunda.nucleusDarknessDelta > 0.04
    ) &&
    // Un núcleo débil y disperso sin anillo es compatible con texto o ruido
    // de compresión; no debe bloquear la recuperación de una dominante. La
    // evidencia secundaria sigue siendo válida si conserva forma compacta,
    // anillo de tinta o un núcleo claramente fuerte.
    (
      segunda.shapeCompactness >= 0.25 ||
      segunda.fillRatioRing >= 0.18 ||
      segunda.fillRatioCore >= 0.4
    );
  const aislada =
    dominante.fillRatioCore >= 0.12 &&
    dominante.contraste >= 0.08 &&
    dominante.radialMassRatio >= 0.15 &&
    dominante.centroidOffsetRatio <= 0.6 &&
    dominante.shapeCompactness >= 0.12 &&
    dominante.nucleusFillRatio >= 0.1 &&
    dominante.fillRatioCore - segunda.fillRatioCore >= 0.08 &&
    dominante.contraste - segunda.contraste >= 0.05 &&
    !evidenciaSegunda;
  // En fotos comprimidas puede quedar un núcleo y contraste local fiables,
  // aunque la masa radial o el score convencional caigan por debajo del
  // umbral. Esta segunda vía es deliberadamente más estrecha: exige margen
  // multirasgo y ausencia de cualquier evidencia relevante en otra burbuja.
  const aisladaDeBajaSenal =
    dominante.fillRatioCore >= 0.12 &&
    dominante.contraste >= 0.04 &&
    dominante.nucleusFillRatio >= 0.15 &&
    proxy(dominante) - proxy(segunda) >= 0.03 &&
    !evidenciaSegunda;
  // Rechaza residuos extremos compatibles con compresión: una mancha
  // diminuta respecto del núcleo y muy elongada. No se exige circularidad ni
  // tamaño mínimo general, para conservar trazos intencionales degradados.
  return aislada || aisladaDeBajaSenal
    ? pareceResiduoDeCompresionOmr(dominante) ? null : dominante
    : null;
}

/**
 * Identifica una marca compacta que una pasada puede haber etiquetado como
 * doble por contaminación de la burbuja vecina. La segunda señal debe ser
 * débil tanto en score como en núcleo y forma; dos marcas comparables no
 * entran en este rescate.
 */
export function debeAceptarCandidataCompactaOmr(args: {
  scoreDominante: number;
  scoreSegundo: number;
  nucleoDominante: number;
  nucleoSegundo: number;
  contrasteDominante: number;
  compacidadDominante: number;
  compacidadSegunda: number;
  confianzaDominante: number;
}) {
  return (
    args.scoreDominante >= 0.45 &&
    args.scoreDominante - args.scoreSegundo >= 0.18 &&
    args.scoreSegundo <= 0.2 &&
    args.nucleoDominante >= 0.68 &&
    args.nucleoSegundo <= 0.5 &&
    args.contrasteDominante >= 0.2 &&
    args.compacidadDominante >= 0.5 &&
    args.compacidadSegunda < 0.35 &&
    args.confianzaDominante >= 0.85
  );
}

/**
 * Acepta una candidata fuerte aunque la pasada la haya descartado por una
 * doble marca espuria. Es mas exigente que el rescate fotometrico: combina
 * separacion entre opciones, relleno central, contraste, masa centrada y
 * compacidad. La regla evita aceptar el maximo relativo de texto o borde.
 */
export function debeAceptarCandidataFuerteOmr(args: {
  scoreDominante: number;
  scoreSegundo: number;
  fillRatioCore: number;
  contrasteDominante: number;
  masaRadial: number;
  desplazamientoCentro: number;
  compacidadDominante: number;
  confianzaDominante: number;
}) {
  return (
    args.scoreDominante >= 0.25 &&
    args.scoreDominante - args.scoreSegundo >= 0.1 &&
    args.scoreSegundo <= 0.18 &&
    args.fillRatioCore >= 0.45 &&
    args.contrasteDominante >= 0.1 &&
    args.masaRadial >= 0.25 &&
    args.desplazamientoCentro <= 0.35 &&
    args.compacidadDominante >= 0.38 &&
    args.confianzaDominante >= 0.58
  );
}

/**
 * Recupera una burbuja aislada cuando la pasada fue rechazada por el descarte
 * de alternativas, aunque la forma local sea claramente la de una marca.
 * Este caso aparece en fotos donde el fondo de varias ventanas conserva
 * textura, pero una sola burbuja mantiene núcleo, contraste y masa centrada.
 */
export function debeAceptarDominanteAisladaConContrasteOmr(args: {
  panelHorizontal: boolean;
  dobleMarcada: boolean;
  tachada: boolean;
  scoreDominante: number;
  scoreSegundo: number;
  fillRatioCore: number;
  fillRatioCoreSegundo: number;
  contraste: number;
  contrasteSegundo: number;
  contrasteSuave: number;
  radialMassRatio: number;
  centroidOffsetRatio: number;
  shapeCompactness: number;
  markConfidence: number;
}) {
  return (
    args.panelHorizontal &&
    !args.dobleMarcada &&
    !args.tachada &&
    args.scoreDominante >= 0.52 &&
    args.scoreDominante - args.scoreSegundo >= 0.28 &&
    args.scoreSegundo <= 0.17 &&
    args.fillRatioCore >= 0.32 &&
    args.fillRatioCoreSegundo <= 0.25 &&
    args.contraste >= 0.16 &&
    args.contrasteSegundo <= 0.1 &&
    args.contrasteSuave >= 0.12 &&
    args.radialMassRatio >= 0.22 &&
    args.centroidOffsetRatio <= 0.38 &&
    args.shapeCompactness >= 0.32 &&
    args.markConfidence >= 0.75
  );
}

type MapaOmrPagina = {
  numeroPagina: number;
  templateVersion?: TemplateVersion;
  templateId?: string;
  qr?: {
    x: number;
    y: number;
    size: number;
    marginModules?: number;
    matrixModules?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  };
  markerSpec?: {
    family?: 'solid_square_4pt_v1';
    sizeMm?: number;
    quietZoneMm?: number;
  };
  marcasPagina?: {
    tipo?: 'lineas' | 'cuadrados';
    size?: number;
    quietZone?: number;
    orientacion?: { esquina: 'tl'; tipo: 'centro_vacio'; radio: number };
    tl?: Punto;
    tr?: Punto;
    bl?: Punto;
    br?: Punto;
  };
  blockSpec?: {
    preguntasPorBloque?: number;
    opcionesPorPregunta?: number;
    bubbleDiameterMm?: number;
    bubblePitchYmm?: number;
    bubblePitchXmm?: number;
    orientation?: 'vertical' | 'horizontal';
  };
  engineHints?: {
    preferredEngine?: 'cv';
    conservativeDecision?: boolean;
    forceSimpleScale?: boolean;
    useMapCoordinatesStrict?: boolean;
    localSearchRadiusPx?: number;
  };
  perfilLayout?: {
    gridStepPt?: number;
    headerHeightFirst?: number;
    headerHeightOther?: number;
    bottomSafePt?: number;
  };
  preguntas: Array<{
    numeroPregunta: number;
    idPregunta: string;
    opciones: Array<{ letra: string; x: number; y: number }>;
    cajaOmr?: { x: number; y: number; width: number; height: number };
    perfilOmr?: { radio?: number; pasoY?: number; pasoX?: number; cajaAncho?: number; ubicacion?: 'panel-separado' | 'junto-a-opcion' };
    fiduciales?:
      | { top: { x: number; y: number }; bottom: { x: number; y: number } }
      | {
          leftTop: { x: number; y: number };
          leftBottom: { x: number; y: number };
          rightTop: { x: number; y: number };
          rightBottom: { x: number; y: number };
          leftMid?: { x: number; y: number };
          rightMid?: { x: number; y: number };
        };
  }>;
};

// Geometria base de hoja carta en puntos PDF.
const ANCHO_CARTA = 612; const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4;
// Compatibilidad para mapas antiguos sin markerSpec. Las plantillas nuevas
// persisten el tamaño real en markerSpec; por eso este fallback conserva el
// valor histórico y no reinterpreta examenes ya generados.
const OMR_FIDUCIAL_SIZE_MM_DEFAULT = 2;
// Compatibilidad para mapas sin tamaño QR persistido: conservar el valor
// histórico. Los mapas generados incluyen el tamaño exacto, de modo que las
// plantillas nuevas de 32 mm y las antiguas de 28 mm no se reinterpretan.
// La quiet zone interna sigue siendo de cuatro módulos y no se confunde con
// este padding físico.
const QR_MATRIZ_SIZE_MM = 28;
const QR_MATRIZ_SIZE_PTS = QR_MATRIZ_SIZE_MM * MM_A_PUNTOS;
const OMR_BUBBLE_PITCH_Y_MM = 5.5;
// El rescate por escala se reserva a entradas cuyo ancho original está por
// debajo de este límite: a 120 dpi la homografía puede dejar un corrimiento
// residual mayor que el diámetro de una burbuja; a resoluciones superiores
// la referencia global conserva mejor la geometría y debe prevalecer.
// A 144 dpi Letter raster is 1224 px wide; it is already a low-resolution
// proxy for a phone capture even though it is above the historical 120 dpi
// cutoff. Include that common size so the short local correction is active in
// the same conditions used by the synthetic robustness set.
const OMR_BAJA_RESOLUCION_MAX_ANCHO = 1300;
const OMR_BUSQUEDA_LOCAL_RESOLUCION_MIN_ANCHO = 1150;
const OMR_MUY_BAJA_RESOLUCION_MAX_ANCHO = 900;

const PERFILES_GEOMETRIA_OMR: Record<PerfilGeometriaOmr, {
  alignRange: number;
  vertRange: number;
  localSearchRatio: number;
  offsetX: number;
  offsetY: number;
}> = {
  actual: {
    alignRange: 22,
    vertRange: 12,
    localSearchRatio: 0.38,
    offsetX: 0,
    offsetY: 0
  },
  geo_tight_search: {
    alignRange: 16,
    vertRange: 8,
    localSearchRatio: 0.3,
    offsetX: 0,
    offsetY: 0
  }
};

function resolverPerfilGeometriaOmr(): PerfilGeometriaOmr {
  const raw = String(process.env.OMR_GEOMETRY_PROFILE || 'actual').trim().toLowerCase();
  const seleccionado: PerfilGeometriaOmr = raw === 'geo_tight_search' ? 'geo_tight_search' : 'actual';
  const entorno = String(process.env.NODE_ENV || 'production').toLowerCase();
  const forceProd = String(process.env.OMR_GEOMETRY_PROFILE_FORCE_PROD || '').trim().toLowerCase();
  const puedeEnProd = forceProd === '1' || forceProd === 'true';
  if (entorno === 'production' && seleccionado !== 'actual' && !puedeEnProd) {
    return 'actual';
  }
  return seleccionado;
}

const PERFIL_GEOMETRIA_OMR_ACTIVO = resolverPerfilGeometriaOmr();
const GEOMETRIA_OMR_DEFAULT = PERFILES_GEOMETRIA_OMR[PERFIL_GEOMETRIA_OMR_ACTIVO];
// Parametros de deteccion ajustables por entorno (centralizados para calibracion/auditoria).
const OMR_SCORE_MIN = Number.parseFloat(process.env.OMR_SCORE_MIN || '0.05');
const OMR_DELTA_MIN = Number.parseFloat(process.env.OMR_DELTA_MIN || '0.012');
const OMR_STRONG_SCORE = Number.parseFloat(process.env.OMR_STRONG_SCORE || '0.06');
const OMR_SECOND_RATIO = Number.parseFloat(process.env.OMR_SECOND_RATIO || '0.75');
const OMR_SCORE_STD = Number.parseFloat(process.env.OMR_SCORE_STD || '0.6');
const OMR_ALIGN_RANGE = Number.parseFloat(process.env.OMR_ALIGN_RANGE || String(GEOMETRIA_OMR_DEFAULT.alignRange));
const OMR_VERT_RANGE = Number.parseFloat(process.env.OMR_VERT_RANGE || String(GEOMETRIA_OMR_DEFAULT.vertRange));
const OMR_VERT_STEP = Number.parseFloat(process.env.OMR_VERT_STEP || '2');
const OMR_OFFSET_X = Number.parseFloat(process.env.OMR_OFFSET_X || String(GEOMETRIA_OMR_DEFAULT.offsetX));
const OMR_OFFSET_Y = Number.parseFloat(process.env.OMR_OFFSET_Y || String(GEOMETRIA_OMR_DEFAULT.offsetY));
const OMR_FID_RIGHT_OFFSET_PTS = Number.parseFloat(process.env.OMR_FID_RIGHT_OFFSET_PTS || '30');
const OMR_BOX_WIDTH_PTS = Number.parseFloat(process.env.OMR_BOX_WIDTH_PTS || '84');
const OMR_LOCAL_DRIFT_PENALTY = Number.parseFloat(process.env.OMR_LOCAL_DRIFT_PENALTY || '0.08');
const OMR_LOCAL_SEARCH_RATIO = Number.parseFloat(process.env.OMR_LOCAL_SEARCH_RATIO || String(GEOMETRIA_OMR_DEFAULT.localSearchRatio));
const OMR_MAX_CENTER_DRIFT_RATIO = Number.parseFloat(process.env.OMR_MAX_CENTER_DRIFT_RATIO || '0.42');
const OMR_MIN_SAFE_RANGE = Number.parseFloat(process.env.OMR_MIN_SAFE_RANGE || '4');
const OMR_GEOMETRY_TRUST_MIN = (() => {
  const valor = Number.parseFloat(process.env.OMR_GEOMETRY_TRUST_MIN || '0.72');
  return Number.isFinite(valor) ? Math.max(0.65, Math.min(0.9, valor)) : 0.72;
})();
const OMR_AMBIGUITY_RATIO = Number.parseFloat(process.env.OMR_AMBIGUITY_RATIO || '0.99');
const OMR_MIN_FILL_DELTA = Number.parseFloat(process.env.OMR_MIN_FILL_DELTA || '0.08');
const OMR_MIN_CENTER_GAP = Number.parseFloat(process.env.OMR_MIN_CENTER_GAP || '10');
const OMR_MIN_HYBRID_CONF = Number.parseFloat(process.env.OMR_MIN_HYBRID_CONF || '0.35');
const OMR_QUALITY_WARN_MIN = Number.parseFloat(process.env.OMR_QUALITY_WARN_MIN || '-1');
const OMR_QUALITY_REJECT_MIN = UMBRALES_OMR_AUTO.qualityRejectMin;
const OMR_QUALITY_REVIEW_MIN = UMBRALES_OMR_AUTO.qualityReviewMin;
const OMR_AUTO_CONF_MIN = UMBRALES_OMR_AUTO.autoConfMin;
const OMR_AUTO_AMBIGUAS_MAX = UMBRALES_OMR_AUTO.autoAmbiguasMax;
const OMR_AUTO_DETECCION_MIN = UMBRALES_OMR_AUTO.autoDeteccionMin;
const OMR_RESPUESTA_CONF_MIN = Number.parseFloat(process.env.OMR_RESPUESTA_CONF_MIN || '0.4');
// Una doble marca puede conservar una segunda burbuja con menor score después
// de la rectificación local. La señal del núcleo evita que el rechazo dependa
// únicamente del score global, que puede quedar dominado por la primera marca.
const OMR_DOUBLE_SECOND_SCORE_MIN = Number.parseFloat(process.env.OMR_DOUBLE_SECOND_SCORE_MIN || '0.14');
const OMR_DOUBLE_SECOND_RATIO_MIN = Number.parseFloat(process.env.OMR_DOUBLE_SECOND_RATIO_MIN || '0.14');
// Una señal vecina de baja resolución puede cruzar el núcleo parcialmente sin
// ser una segunda marca. Exigir 0.45 conserva el rechazo de dobles con núcleo
// claramente relleno y permite rescatar una dominante sólida degradada.
const OMR_DOUBLE_SECOND_CORE_MIN = Number.parseFloat(process.env.OMR_DOUBLE_SECOND_CORE_MIN || '0.45');
const OMR_PARTIAL_TOP_REJECT_SCORE = Number.parseFloat(process.env.OMR_PARTIAL_TOP_REJECT_SCORE || '0.6');
const OMR_PARTIAL_CORE_MAX = Number.parseFloat(process.env.OMR_PARTIAL_CORE_MAX || '0.6');
const OMR_PARTIAL_CORE_SCORE_MAX = Number.parseFloat(process.env.OMR_PARTIAL_CORE_SCORE_MAX || '0.72');
const OMR_EXPORT_PATCHES = String(process.env.OMR_EXPORT_PATCHES || '').toLowerCase() === 'true' || process.env.OMR_EXPORT_PATCHES === '1';
const OMR_PATCH_DIR = process.env.OMR_PATCH_DIR || path.resolve(process.cwd(), 'storage', 'omr_patches');
const OMR_PATCH_SIZE = Math.max(24, Number.parseInt(process.env.OMR_PATCH_SIZE || '56', 10));
const OMR_DEBUG = String(process.env.OMR_DEBUG || '').toLowerCase() === 'true' || process.env.OMR_DEBUG === '1';
const OMR_DEBUG_DIR = process.env.OMR_DEBUG_DIR || path.resolve(process.cwd(), 'storage', 'omr_debug');
function leerBanderaEnv(nombre: string, porDefecto: boolean): boolean {
  const valor = process.env[nombre];
  if (valor == null || valor.trim() === '') return porDefecto;
  const normalizado = valor.trim().toLowerCase();
  if (normalizado === '1' || normalizado === 'true' || normalizado === 'yes' || normalizado === 'on') return true;
  if (normalizado === '0' || normalizado === 'false' || normalizado === 'no' || normalizado === 'off') return false;
  return porDefecto;
}
const OMR_MICRO_HIGH_RES_ENABLED = leerBanderaEnv('OMR_MICRO_HIGH_RES_ENABLED', false);
const OMR_COLORIMETRY_ENABLED = leerBanderaEnv('OMR_COLORIMETRY_ENABLED', true);
const OMR_COLORIMETRY_WHITE_PERCENTILE = Math.max(
  0.85,
  Math.min(0.99, Number.parseFloat(process.env.OMR_COLORIMETRY_WHITE_PERCENTILE || '0.96'))
);
const OMR_SECOND_PASS_ENABLED = leerBanderaEnv('OMR_SECOND_PASS_ENABLED', true);
const OMR_SECOND_PASS_QUALITY_MAX = Number.parseFloat(process.env.OMR_SECOND_PASS_QUALITY_MAX || '0.72');
const OMR_SECOND_PASS_CONF_MAX = Number.parseFloat(process.env.OMR_SECOND_PASS_CONF_MAX || '0.5');
const OMR_SECOND_PASS_FIDUCIALES_RESCUE = leerBanderaEnv('OMR_SECOND_PASS_FIDUCIALES_RESCUE', true);
const OMR_LOCAL_GEOMETRY_ENABLED = leerBanderaEnv('OMR_LOCAL_GEOMETRY_ENABLED', true);
const OMR_REJECT_KEEP_RESPONSES_MIN_DETECTION = Number.parseFloat(
  process.env.OMR_REJECT_KEEP_RESPONSES_MIN_DETECTION || '0.22'
);

type PerfilDeteccionOmr = {
  version: TemplateVersion;
  qrSizePts: number;
  bubbleRadiusPts: number;
  bubblePitchYPts: number;
  bubblePitchXPts: number;
  boxWidthPts: number;
  centerToLeftPts: number;
  alignRange: number;
  vertRange: number;
  localSearchRatio: number;
  localDriftPenalty: number;
  maxCenterDriftRatio: number;
  minSafeRange: number;
  scoreMin: number;
  scoreStd: number;
  strongScore: number;
  secondRatio: number;
  deltaMin: number;
  minTopZScore: number;
  ambiguityRatio: number;
  minFillDelta: number;
  minCenterGap: number;
  minHybridConf: number;
  reprojectionMaxErrorPx: number;
};

function resolverPerfilDeteccion(): PerfilDeteccionOmr {
  return {
    version: 4,
    qrSizePts: QR_MATRIZ_SIZE_PTS,
    // Debe coincidir con el renderer canónico. El mapa puede ajustar este
    // valor, pero el fallback también debe conservar la geometría física.
    bubbleRadiusPts: (6 * MM_A_PUNTOS) / 2,
    bubblePitchYPts: OMR_BUBBLE_PITCH_Y_MM * MM_A_PUNTOS,
    bubblePitchXPts: 25,
    boxWidthPts: Math.max(84, OMR_BOX_WIDTH_PTS),
    centerToLeftPts: 40,
    alignRange: Math.max(20, OMR_ALIGN_RANGE),
    vertRange: Math.max(12, OMR_VERT_RANGE),
    localSearchRatio: Math.max(0.24, OMR_LOCAL_SEARCH_RATIO * 0.96),
    localDriftPenalty: Math.max(0.08, OMR_LOCAL_DRIFT_PENALTY),
    maxCenterDriftRatio: Math.max(0.22, OMR_MAX_CENTER_DRIFT_RATIO * 0.8),
    minSafeRange: Math.max(4, OMR_MIN_SAFE_RANGE),
    scoreMin: Math.max(0.038, OMR_SCORE_MIN * 0.96),
    scoreStd: Math.max(0.56, OMR_SCORE_STD * 0.98),
    strongScore: Math.max(0.058, OMR_STRONG_SCORE * 0.97),
    secondRatio: Math.max(0.7, OMR_SECOND_RATIO * 0.96),
    deltaMin: Math.max(0.009, OMR_DELTA_MIN * 0.96),
    minTopZScore: 0.88,
    ambiguityRatio: Math.max(0.94, OMR_AMBIGUITY_RATIO * 0.98),
    minFillDelta: Math.max(0.085, OMR_MIN_FILL_DELTA * 0.94),
    minCenterGap: Math.max(10.2, OMR_MIN_CENTER_GAP * 0.94),
    minHybridConf: Math.max(0.22, OMR_MIN_HYBRID_CONF * 0.82),
    reprojectionMaxErrorPx: 4
  };
}

function mediana(valores: number[]) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[medio - 1] + ordenados[medio]) / 2 : ordenados[medio];
}

function ajustarPerfilConMapa(perfilBase: PerfilDeteccionOmr, mapaPagina: MapaOmrPagina): PerfilDeteccionOmr {
  const plantillaInline = mapaPagina.templateId === 'omr-inline-exam-v1';
  const radios: number[] = [];
  const pasosY: number[] = [];
  const pasosX: number[] = [];
  let tienePasoXExplicito = false;
  const anchosCaja: number[] = [];
  const offsetsCentroIzq: number[] = [];

  for (const pregunta of mapaPagina.preguntas ?? []) {
    if (Number.isFinite(pregunta.perfilOmr?.radio)) radios.push(Number(pregunta.perfilOmr?.radio));
    if (Number.isFinite(pregunta.perfilOmr?.pasoY) && Number(pregunta.perfilOmr?.pasoY) > 0.4) {
      pasosY.push(Number(pregunta.perfilOmr?.pasoY));
    }
    if (Number.isFinite(pregunta.perfilOmr?.pasoX) && Number(pregunta.perfilOmr?.pasoX) > 0.4) {
      pasosX.push(Number(pregunta.perfilOmr?.pasoX));
      tienePasoXExplicito = true;
    }
    if (Number.isFinite(pregunta.cajaOmr?.width)) anchosCaja.push(Number(pregunta.cajaOmr?.width));
    const opcionA = pregunta.opciones?.find((op) => op.letra === 'A');
    const opcionB = pregunta.opciones?.find((op) => op.letra === 'B');
    if (opcionA && opcionB && Number.isFinite(opcionA.y) && Number.isFinite(opcionB.y)) {
      const deltaY = Math.abs(Number(opcionB.y) - Number(opcionA.y));
      const deltaX = Math.abs(Number(opcionB.x) - Number(opcionA.x));
      // Algunos mapas históricos declaraban `pasoY` aunque la fila era
      // horizontal. La orientación de los centros es la fuente de verdad:
      // una variación X claramente dominante debe alimentar el paso X.
      if (deltaX > Math.max(0.4, deltaY * 1.5)) pasosX.push(deltaX);
      else if (deltaY > 0.4) pasosY.push(deltaY);
    }
    if (opcionA && Number.isFinite(pregunta.cajaOmr?.x)) {
      offsetsCentroIzq.push(Number(opcionA.x) - Number(pregunta.cajaOmr?.x));
    }
  }

  const radio = mediana(radios);
  const pasoY = mediana(pasosY);
  const pasoX = mediana(pasosX);
  // Compatibilidad acotada para mapas horizontales anteriores que guardaban
  // el paso X dentro de `pasoY`: conservar su escala efectiva evita ampliar
  // demasiado el anillo de lectura de fixtures antiguos. Los mapas canónicos
  // actuales siempre declaran `pasoX` y usan el valor físico exacto.
  const pasoXDetectable = !tienePasoXExplicito && pasoX !== null && pasoY !== null
    ? (pasoX + pasoY) / 2
    : pasoX;
  const anchoCaja = mediana(anchosCaja);
  const offset = mediana(offsetsCentroIzq);
  const qrSizePersistido = Number(mapaPagina.qr?.size);

  return {
    ...perfilBase,
    bubbleRadiusPts:
      radio !== null ? Math.max(2.6, Math.min(plantillaInline ? 16 : 7.2, radio)) : perfilBase.bubbleRadiusPts,
    bubblePitchYPts:
      pasoY !== null ? Math.max(6.8, Math.min(plantillaInline ? 40 : 16, pasoY)) : perfilBase.bubblePitchYPts,
    bubblePitchXPts:
      pasoXDetectable !== null ? Math.max(8, Math.min(40, pasoXDetectable)) : perfilBase.bubblePitchXPts,
    boxWidthPts:
      anchoCaja !== null ? Math.max(plantillaInline ? 12 : 32, Math.min(180, anchoCaja)) : perfilBase.boxWidthPts,
    centerToLeftPts:
      offset !== null ? Math.max(8, Math.min(60, offset)) : perfilBase.centerToLeftPts,
    qrSizePts:
      Number.isFinite(qrSizePersistido) && qrSizePersistido > 0
        ? qrSizePersistido
        : perfilBase.qrSizePts
  };
}

function limpiarBase64(entrada: string) {
  return entrada.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
}

/**
 * Señal demasiado débil para publicar una letra, pero suficiente para
 * distinguir un intento de marca de una burbuja realmente vacía. Mantenerla
 * como ambigua evita perder rayones o puntos tenues en el estado OMR y no
 * abre una ruta de calificación automática.
 */
type RasgoIntentoMarcaOmr = Pick<ScoreOpcionOmr,
  'score' | 'contraste' | 'softCoreContrast' | 'nucleusFillRatio' | 'centerMean' |
  'radialMassRatio' | 'centroidOffsetRatio' | 'shapeCompactness'> &
  Partial<Pick<ScoreOpcionOmr,
    'fillRatioCore' | 'nucleusDarknessDelta' | 'softCentroidOffsetRatio' |
    'largestComponentPixels' | 'largestComponentFillRatio' |
    'largestComponentOffsetRatio' | 'largestComponentDensity' |
    'largestComponentAspectRatio'>>;

function esIntentoCircularTenueOmr(score: RasgoIntentoMarcaOmr) {
  const contraste = Math.max(score.contraste, score.softCoreContrast);
  return (
    score.score <= 0.02 &&
    contraste >= 0.1 &&
    score.nucleusFillRatio >= 0.1 &&
    score.radialMassRatio >= 0.15 &&
    score.centroidOffsetRatio <= 0.42 &&
    score.shapeCompactness >= 0.05
  );
}

export function esIntentoMarcaDebilOmr(
  score: RasgoIntentoMarcaOmr,
  otrasOpciones: readonly RasgoIntentoMarcaOmr[] = [],
  opcionesEvaluacion: { permitirMicrocomponenteRelativo?: boolean } = {}
) {
  const contraste = Math.max(score.contraste, score.softCoreContrast);
  const evidenciaCircularTenue = esIntentoCircularTenueOmr(score);

  // Una marca de lápiz, paloma o trazo corto puede no ser circular. Para
  // conservarla como intento (sin publicar una letra), comparamos su
  // contraste local contra la mediana de las otras burbujas del mismo
  // reactivo y exigimos evidencia localizada en el núcleo/centro.
  const tonosCompetidores = otrasOpciones
    .map((item) => Math.max(item.contraste, item.softCoreContrast))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const medianaCompetidores = tonosCompetidores.length === 0
    ? 0
    : tonosCompetidores[Math.floor(tonosCompetidores.length / 2)] ?? 0;
  const contrasteRelativo = contraste - medianaCompetidores;
  const evidenciaLocalizada =
    score.nucleusFillRatio >= 0.05 ||
    (score.fillRatioCore ?? 0) >= 0.035 ||
    (score.nucleusDarknessDelta ?? 0) >= 0.025 ||
    score.softCoreContrast >= 0.025;
  const evidenciaDeUbicacion =
    score.centroidOffsetRatio <= 0.72 ||
    (score.softCentroidOffsetRatio ?? 1) <= 0.75;
  const evidenciaTonalRelativa =
    contraste >= 0.06 &&
    contrasteRelativo >= 0.035 &&
    evidenciaLocalizada &&
    evidenciaDeUbicacion;
  // Una tonalidad casi imperceptible también cuenta si el núcleo/centro
  // contiene una señal concentrada y claramente aislada respecto de la fila.
  // El requisito espacial evita convertir textura uniforme o rayones externos
  // en intentos; esta rama tampoco elige una letra.
  const evidenciaTonalMuyTenueLocalizada =
    contraste >= 0.02 &&
    contrasteRelativo >= 0.02 &&
    score.nucleusFillRatio >= 0.12 &&
    (score.fillRatioCore ?? 0) >= 0.1 &&
    (score.centroidOffsetRatio <= 0.5 || (score.softCentroidOffsetRatio ?? 1) <= 0.5);

  // La cuantizacion puede dejar un componente de lapiz compacto dentro del
  // nucleo aunque las medias fotometricas absolutas queden en cero. Para
  // conservar ese intento sin publicar letra, exigimos tamaño relativo,
  // forma/localizacion y diferencia de intensidad frente a las cuatro opciones.
  const medianasCentroCompetidor = otrasOpciones
    .map((item) => item.centerMean)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const medianaCentroCompetidor = medianasCentroCompetidor.length === 4
    ? ((medianasCentroCompetidor[1] ?? 0) + (medianasCentroCompetidor[2] ?? 0)) / 2
    : null;
  const componenteFill = score.largestComponentFillRatio ?? 0;
  const fillComponenteCompetidora = Math.max(
    0,
    ...otrasOpciones.map((item) => item.largestComponentFillRatio ?? 0)
  );
  const evidenciaMicrocomponenteRelativo = opcionesEvaluacion.permitirMicrocomponenteRelativo !== false && Boolean(
    medianaCentroCompetidor != null &&
    medianaCentroCompetidor - score.centerMean >= 6 &&
    score.score <= 0.08 &&
    (score.fillRatioCore ?? 0) <= 0.2 &&
    (score.largestComponentPixels ?? 0) >= 7 &&
    componenteFill >= 0.015 &&
    componenteFill <= 0.08 &&
    componenteFill - fillComponenteCompetidora >= 0.012 &&
    componenteFill >= fillComponenteCompetidora * 2.5 &&
    (score.largestComponentDensity ?? 0) >= 0.3 &&
    (score.largestComponentAspectRatio ?? Number.MAX_SAFE_INTEGER) <= 2.2 &&
    (score.largestComponentOffsetRatio ?? 1) <= 0.6 &&
    (score.softCentroidOffsetRatio ?? 1) <= 0.5
  );

  return evidenciaCircularTenue || evidenciaTonalRelativa || evidenciaTonalMuyTenueLocalizada ||
    evidenciaMicrocomponenteRelativo;
}

export function normalizarDobleMarcadaPorEvidenciaOmr(
  respuesta: RespuestaDetectadaOmr
): RespuestaDetectadaOmr {
  if (!respuesta.flags.includes('doble_marca') || respuesta.flags.includes('tachada_detectada')) return respuesta;
  const candidatas = respuesta.scoresPorOpcion.filter((score) => score.estadoMarca === 'marcada' || score.estadoMarca === 'parcial');
  if (candidatas.length === 0) return respuesta;
  const ordenadas = [...candidatas].sort((a, b) => b.score - a.score);
  const candidata = ordenadas[0]!;
  const segundaCandidata = ordenadas[1];
  const restoSinEvidenciaComparable = ordenadas.slice(1).every((competidora) =>
    competidora.markConfidence <= 0.6 &&
    competidora.nucleusFillRatio <= 0.55 &&
    competidora.shapeCompactness <= 0.27
  );

  // Una sola marca visualmente fuerte puede quedar acompañada por ruido que
  // también cruzó el umbral binario de "marcada". Esta excepción exige una
  // dominancia simultánea en varias mediciones independientes; dos señales
  // centrales con núcleo comparable nunca se resuelven automáticamente.
  const dobleConDominanteMultirasgo = Boolean(
    segundaCandidata &&
    candidata.estadoMarca === 'marcada' &&
    candidata.score >= 0.3 &&
    candidata.score - segundaCandidata.score >= 0.12 &&
    candidata.markConfidence >= 0.8 &&
    candidata.markConfidence - segundaCandidata.markConfidence >= 0.25 &&
    candidata.fillRatioCore >= 0.5 &&
    candidata.contraste >= 0.12 &&
    candidata.nucleusFillRatio >= 0.75 &&
    candidata.nucleusFillRatio - segundaCandidata.nucleusFillRatio >= 0.25 &&
    candidata.centroidOffsetRatio <= 0.22 &&
    restoSinEvidenciaComparable
  );
  if (dobleConDominanteMultirasgo) {
    return {
      ...respuesta,
      opcion: candidata.opcion,
      confianza: Math.max(respuesta.confianza, candidata.markConfidence),
      flags: respuesta.flags.filter((flag) => flag !== 'doble_marca'),
      estadoRespuesta: 'respondida'
    };
  }

  // El traspaso del reverso o el residuo de un borrado puede elevar el
  // relleno del nucleo de otra burbuja sin aportar tinta localizada. En ese
  // caso, compara contraste local y oscuridad del centro, no solo el nucleo.
  // La ruta exige margen claro y no se activa si otra opcion muestra evidencia
  // tonal/cromatica comparable; las dobles reales siguen en revision.
  const contrasteCandidata = Math.max(candidata.contraste, candidata.softCoreContrast);
  const competidorConMarcaLocalComparable = respuesta.scoresPorOpcion.some((score) =>
    score.opcion !== candidata.opcion &&
    score.score >= 0.04 &&
    score.fillRatioCore >= 0.18 &&
    score.centroidOffsetRatio <= 0.6 &&
    score.contraste >= 0.1 &&
    score.centerDarknessDelta >= 0.1
  );
  const competidorCromaticoComparable = respuesta.scoresPorOpcion.some((score) =>
    score.opcion !== candidata.opcion &&
    (score.contrasteCromaticoLocal ?? 0) >= 0.04 &&
    (score.margenCromatico ?? 0) >= 0.035
  );
  const contrastDominanteSobreNucleoFantasma = Boolean(
    candidata.estadoMarca === 'marcada' &&
    candidata.score >= 0.35 &&
    candidata.score - (segundaCandidata?.score ?? 0) >= 0.18 &&
    candidata.markConfidence >= 0.7 &&
    candidata.fillRatioCore >= 0.2 &&
    contrasteCandidata >= 0.14 &&
    candidata.centerDarknessDelta >= 0.14 &&
    candidata.contraste - Math.max(
      0,
      ...respuesta.scoresPorOpcion
        .filter((score) => score.opcion !== candidata.opcion)
        .map((score) => score.contraste)
    ) >= 0.08 &&
    candidata.centerDarknessDelta - Math.max(
      0,
      ...respuesta.scoresPorOpcion
        .filter((score) => score.opcion !== candidata.opcion)
        .map((score) => score.centerDarknessDelta)
    ) >= 0.08 &&
    candidata.centroidOffsetRatio <= 0.3 &&
    !competidorConMarcaLocalComparable &&
    !competidorCromaticoComparable
  );
  if (contrastDominanteSobreNucleoFantasma) {
    return {
      ...respuesta,
      opcion: candidata.opcion,
      confianza: Math.max(respuesta.confianza, candidata.markConfidence),
      flags: respuesta.flags.filter((flag) => flag !== 'doble_marca'),
      estadoRespuesta: 'respondida'
    };
  }

  if (candidatas.length !== 1) return respuesta;

  const competidorConNucleo = respuesta.scoresPorOpcion.some((score) =>
    score.opcion !== candidata.opcion &&
    score.nucleusFillRatio >= 0.15 &&
    score.fillRatioCore >= 0.18 &&
    score.centroidOffsetRatio <= 0.6 &&
    (score.contraste >= 0.1 || score.centerDarknessDelta >= 0.1 ||
      ((score.contrasteCromaticoLocal ?? 0) >= 0.04 && (score.margenCromatico ?? 0) >= 0.035))
  );
  if (competidorConNucleo) return respuesta;

  const flags = respuesta.flags.filter((flag) => flag !== 'doble_marca');
  const marcaDominanteClara =
    candidata.estadoMarca === 'marcada' &&
    candidata.markConfidence >= 0.7 &&
    candidata.fillRatioCore >= 0.6 &&
    candidata.nucleusFillRatio >= 0.75 &&
    candidata.centroidOffsetRatio <= 0.3;
  const contrastesCompetidores = respuesta.scoresPorOpcion
    .filter((score) => score.opcion !== candidata.opcion)
    .map((score) => Math.max(score.contraste, score.softCoreContrast))
    .sort((a, b) => a - b);
  const contrasteRelativo = Math.max(candidata.contraste, candidata.softCoreContrast) -
    (contrastesCompetidores[Math.floor(contrastesCompetidores.length / 2)] ?? 0);
  const marcaTonalIdentificable =
    candidata.estadoMarca === 'parcial' &&
    candidata.score >= 0.035 &&
    Math.max(candidata.contraste, candidata.softCoreContrast) >= 0.15 &&
    contrasteRelativo >= 0.08 &&
    candidata.fillRatioCore >= 0.25 &&
    candidata.nucleusFillRatio >= 0.28 &&
    candidata.radialMassRatio >= 0.35 &&
    candidata.centroidOffsetRatio <= 0.35;
  if (marcaDominanteClara || marcaTonalIdentificable) {
    return {
      ...respuesta,
      opcion: candidata.opcion,
      confianza: Math.max(respuesta.confianza, candidata.markConfidence, marcaTonalIdentificable ? 0.4 : 0),
      flags,
      estadoRespuesta: 'respondida'
    };
  }
  return {
    ...respuesta,
    opcion: null,
    confianza: Math.max(respuesta.confianza, 0.2),
    flags: Array.from(new Set([...flags, 'parcial_detectada'])) as RespuestaDetectadaOmr['flags'],
    estadoRespuesta: 'ambigua'
  };
}

function agregarIntentosNoResueltosAlResultadoOmr(
  resultado: ResultadoOmr,
  opciones: {
    permitirMicrocomponenteRelativo?: boolean;
  } = {}
): ResultadoOmr {
  let cambios = 0;
  const respuestasDetectadas = resultado.respuestasDetectadas.map((respuesta) => {
    const sinDobleEspuria = normalizarDobleMarcadaPorEvidenciaOmr(respuesta);
    if (sinDobleEspuria !== respuesta) cambios += 1;
    if (sinDobleEspuria.opcion != null) {
      const candidataElegida = sinDobleEspuria.scoresPorOpcion.find((score) => score.opcion === sinDobleEspuria.opcion);
      const candidatasPorNucleo = [...sinDobleEspuria.scoresPorOpcion].sort(
        (a, b) => b.fillRatioCore - a.fillRatioCore
      );
      const candidataNucleo = candidatasPorNucleo[0];
      const segundaNucleo = candidatasPorNucleo[1];
      const fillCoreMargin = candidataNucleo?.opcion === sinDobleEspuria.opcion
        ? candidataNucleo.fillRatioCore - (segundaNucleo?.fillRatioCore ?? 0)
        : 0;
      const fillCoreCompetitorScore = candidataElegida
        ? Math.max(0, ...sinDobleEspuria.scoresPorOpcion
          .filter((score) => score.opcion !== candidataElegida.opcion)
          .map((score) => score.score))
        : 1;
      const permitirConfianzaMarcada = !respuesta.flags.some((flag) =>
        flag === 'doble_marca' || flag === 'tachada_detectada'
      ) && respuesta.estadoRespuesta !== 'doble_marca' && respuesta.estadoRespuesta !== 'tachada';
      if (
        (!candidataElegida ||
          !debeAbstenerseMarcaParcialOmr({
            ...candidataElegida,
            fillCoreMargin,
            fillCoreCompetitorScore,
            permitirConfianzaMarcada
          }))
      ) return sinDobleEspuria;
      cambios += 1;
      return {
        ...sinDobleEspuria,
        opcion: null,
        confianza: Math.min(sinDobleEspuria.confianza, 0.5),
        flags: Array.from(new Set([...sinDobleEspuria.flags, 'parcial_detectada'])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'ambigua' as const
      };
    }
    if (
      sinDobleEspuria.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')
    ) return sinDobleEspuria;

    const intentos = sinDobleEspuria.scoresPorOpcion.filter((score) =>
      esIntentoMarcaDebilOmr(
        score,
        sinDobleEspuria.scoresPorOpcion.filter((otra) => otra.opcion !== score.opcion),
        opciones
      )
    );
    if (intentos.length === 0) return sinDobleEspuria;
    cambios += 1;
    return {
      ...sinDobleEspuria,
      confianza: Math.max(sinDobleEspuria.confianza, 0.2),
      flags: Array.from(new Set([...sinDobleEspuria.flags, 'parcial_detectada'])) as RespuestaDetectadaOmr['flags'],
      estadoRespuesta: 'ambigua' as const
    };
  });
  if (cambios === 0) return resultado;

  const ratioAmbiguas = respuestasDetectadas.filter((respuesta) => respuesta.estadoRespuesta === 'ambigua').length /
    Math.max(1, respuestasDetectadas.length);
  return {
    ...resultado,
    respuestasDetectadas,
    ratioAmbiguas,
    estadoAnalisis: resultado.estadoAnalisis === 'ok' ? 'requiere_revision' : resultado.estadoAnalisis,
    advertencias: Array.from(new Set([...resultado.advertencias, 'Se conservaron intentos de marca tonal localizada para revisión'])),
    resumenRespuestas: resumirRespuestasOmr(respuestasDetectadas, resultado.calidadPagina, resultado.geomQuality)
  };
}

type DebugInfo = {
  folio?: string;
  numeroPagina?: number;
  templateVersionDetectada?: TemplateVersion;
};

type OpcionesAnalisisInterno = {
  aggressivePreprocess?: boolean;
  highResolutionRescue?: boolean;
  noRetry?: boolean;
  rescueFiduciales?: boolean;
  disableLocalGeometry?: boolean;
  forceHomographyGeometry?: boolean;
  qrGeometryOutputSize?: number;
};

type DebugPregunta = {
  numeroPregunta: number;
  panelHorizontalCompacto?: boolean;
  rescateMarcaFaint?: boolean;
  mejorOpcion: string | null;
  mejorScore: number;
  segundoScore: number;
  dobleMarcadaReal?: boolean;
  rescateDoblePorTintaCromatica?: boolean;
  rescateMarcaCromatica?: boolean;
  delta: number;
  dobleMarcada: boolean;
  suficiente: boolean;
  opcionDetectada?: string | null;
  confianzaPregunta?: number;
  flags?: string[];
  dx: number;
  dy: number;
  scoreMean: number;
  scoreStd: number;
  scoreThreshold: number;
  microRescate?: boolean;
  microScores?: Array<{
    opcion: string;
    score: number;
    fillRatioCore?: number;
    contraste?: number;
    radialMassRatio?: number;
    centroidOffsetRatio?: number;
    nucleusFillRatio?: number;
    nucleusDarknessDelta?: number;
    shapeCompactness?: number;
    markConfidence?: number;
  }>;
  centros: Array<{ letra: string; x: number; y: number; score: number; estadoMarca?: ScoreOpcionOmr['estadoMarca']; markConfidence?: number; fillRatioCore?: number; fillRatioRing?: number; centerMean?: number; softCoreContrast?: number; softCentroidOffsetRatio?: number; ringMean?: number; outerMean?: number; fillDelta?: number; contraste?: number; radialMassRatio?: number; centroidOffsetRatio?: number }>;
};

type DebugOmr = {
  folio?: string;
  numeroPagina?: number;
  width: number;
  height: number;
  transformacion: string;
  advertencias: string[];
  preguntas: DebugPregunta[];
};

type PatchRegistro = {
  numeroPregunta: number;
  letra: string;
  x: number;
  y: number;
  score: number;
  confianzaPregunta: number;
  seleccionada: boolean;
  opcionDetectada: string | null;
};

type ParametrosBurbuja = {
  radio: number;
  ringInner: number;
  ringOuter: number;
  outerOuter: number;
  paso: number;
};

function crearParametrosBurbuja(
  escalaX: number,
  bubbleRadiusPts: number,
  bubblePitchYPts: number,
  bubblePitchXPts: number,
  geometriaVerticalCompacta = false
): ParametrosBurbuja {
  // El piso de la ROI evita que el marco impreso se interprete como una
  // marca cuando la captura tiene poca resolución.
  // Keep the historical floor for horizontal/synthetic fixtures, and use a
  // small floor only when the map explicitly has the compact vertical shape.
  const radio = Math.max(geometriaVerticalCompacta ? 3 : 6, bubbleRadiusPts * escalaX);
  const pasoCentroPts = geometriaVerticalCompacta ? bubblePitchYPts : bubblePitchXPts;
  const pasoCentroPx = Math.max(radio * 2.4, pasoCentroPts * escalaX);
  const ringInner = Math.max(radio + 2, Math.min(radio * 1.34, pasoCentroPx * 0.31));
  const ringOuter = Math.max(ringInner + 2, Math.min(radio * 1.88, pasoCentroPx * 0.42));
  const outerOuter = Math.max(ringOuter + 2, Math.min(ringOuter + Math.max(2, radio * 0.3), pasoCentroPx * 0.48));
  const paso = Math.max(1, Math.round(radio / 4));
  return { radio, ringInner, ringOuter, outerOuter, paso };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function round6(v: number) {
  return Number(v.toFixed(6));
}

function rescatarOpcionDominantePorScores(
  scoresPorOpcion: ScoreOpcionOmr[],
  opcionActual: OpcionRespuestaOmr | null,
  confianzaActual: number,
  permitirRescateNucleoBajaResolucion = false
) {
  if (opcionActual || confianzaActual > 0) return null;
  const orden = [...scoresPorOpcion].sort((a, b) => b.score - a.score || a.opcion.localeCompare(b.opcion));
  const top = orden[0];
  const second = orden[1];
  if (!top) return null;

  const topScore = top.score;
  const secondScore = second?.score ?? 0;
  const gap = topScore - secondScore;
  const ratio = secondScore / Math.max(0.0001, topScore);
  const secondStrong = Boolean(
    second &&
      (second.score >= 0.68 ||
        second.markConfidence >= 0.9 ||
        second.fillRatioCore >= 0.58 ||
        second.centerDarknessDelta >= 0.24)
  );
  if (secondStrong && (gap < 0.2 || ratio > 0.82)) return null;
  const dominantConfidence = clamp01(
    top.markConfidence * 0.28 +
      clamp01((topScore - 0.52) / 0.42) * 0.32 +
      clamp01((gap - 0.12) / 0.42) * 0.26 +
      clamp01((top.centerDarknessDelta - 0.18) / 0.48) * 0.14
  );

  const dominantePorGap =
    topScore >= 0.55 &&
    gap >= 0.08 &&
    ratio <= 0.82 &&
    top.centerDarknessDelta >= 0.06 &&
    top.markConfidence >= 0.45 &&
    // El anillo de una burbuja vacía puede parecer dominante después de una
    // homografía inclinada y de la compresión JPEG. Un rescate por simple
    // separación de score solo es válido si también conserva un núcleo
    // claramente superior al de una burbuja impresa vacía; las rutas de
    // recuperación de baja resolución ya tienen sus propios criterios de
    // núcleo y no se relajan aquí.
    top.fillRatioCore >= 0.7;
  const dominantePorScore =
    topScore >= 0.8 &&
    gap >= 0.06 &&
    ratio <= 0.86 &&
    top.centerDarknessDelta >= 0.04 &&
    top.markConfidence >= 0.4;
  const dominantePorCore =
    top.fillRatioCore >= 0.58 &&
    gap >= 0.1 &&
    ratio <= 0.84 &&
    top.centerDarknessDelta >= 0.08 &&
    top.shapeCompactness >= 0.62;
  // En una captura de 96--120 dpi el score global puede bajar por el
  // remuestreo, aunque el núcleo de la burbuja siga prácticamente lleno. Este
  // rescate solo aplica al perfil horizontal compacto y exige separación
  // amplia, confianza alta y un segundo núcleo débil; una doble marca real no
  // puede satisfacer simultáneamente esas condiciones.
  const dominantePorNucleoBajaResolucion =
    permitirRescateNucleoBajaResolucion &&
    topScore >= 0.44 &&
    top.fillRatioCore >= 0.76 &&
    top.markConfidence >= 0.85 &&
    top.shapeCompactness >= 0.5 &&
    gap >= 0.18 &&
    secondScore < 0.3 &&
    second.fillRatioCore < 0.45 &&
    second.markConfidence < 0.7;

  if (!(dominantePorGap || dominantePorScore || dominantePorCore || dominantePorNucleoBajaResolucion)) return null;
  if (dominantConfidence < 0.34) return null;

  return {
    opcion: top.opcion,
    confianza: round6(Math.max(0.34, dominantConfidence)),
    motivo: `Rescate por dominancia local (${top.opcion}, gap=${gap.toFixed(3)})`
  };
}

function calcularCalidadPagina(args: {
  tipoTransformacion: 'qr' | 'homografia' | 'escala';
  qrDetectado: boolean;
  reprojectionErrorPromedio: number;
  blurVar: number;
  brilloMedio: number;
  colorCast: number;
  saturationMean: number;
  confianzaMedia: number;
  ratioAmbiguas: number;
  referenciaPaginaCalidad: number;
}) {
  const {
    tipoTransformacion,
    qrDetectado,
    reprojectionErrorPromedio,
    blurVar,
    brilloMedio,
    colorCast,
    saturationMean,
    confianzaMedia,
    ratioAmbiguas,
    referenciaPaginaCalidad
  } = args;
  const factorTransformacion = tipoTransformacion === 'escala' ? 0.74 : tipoTransformacion === 'homografia' ? 0.9 : 1;
  const factorReferenciaPagina = clamp01(referenciaPaginaCalidad);
  const factorQr = qrDetectado ? 1 : 0.78;
  const factorBlur = Math.max(0.35, clamp01((blurVar - 70) / 320));
  const factorExposicion = clamp01(1 - Math.abs(brilloMedio - 145) / 120);
  const factorRepro = clamp01(1 - reprojectionErrorPromedio / 6);
  const factorColorBalance = clamp01(1 - colorCast / 0.24);
  const excesoSaturacion = Math.max(0, saturationMean - 0.28);
  const factorSaturacion = clamp01(1 - excesoSaturacion / 0.45);
  const factorNoAmbiguas = clamp01(1 - ratioAmbiguas);
  const calidad =
    factorTransformacion * 0.18 +
    factorReferenciaPagina * 0.12 +
    factorQr * 0.14 +
    factorRepro * 0.25 +
    factorBlur * 0.17 +
    factorExposicion * 0.12 +
    factorColorBalance * 0.06 +
    factorSaturacion * 0.02 +
    clamp01(confianzaMedia) * 0.01 +
    factorNoAmbiguas * 0.01;
  return clamp01(calidad);
}

function resolverEstadoAnalisis(args: {
  calidadPagina: number;
  confianzaMedia: number;
  ratioAmbiguas: number;
  totalRespuestas: number;
  respuestasAnalizadas?: number;
  geometriaConfiable?: boolean;
}) {
  const { calidadPagina, confianzaMedia, ratioAmbiguas, totalRespuestas } = args;
  const geometriaConfiable = args.geometriaConfiable !== false;
  const motivos: string[] = [];
  const advertencias: string[] = [];
  const puedeRechazarPorCalidad = totalRespuestas >= 3;
  // La cobertura mide cuántos reactivos fueron interpretados, incluidos los
  // blancos legítimos; no debe penalizar una hoja correctamente contestada en
  // blanco como si fuera una captura ilegible.
  const respuestasAnalizadas = Math.max(
    0,
    Math.min(totalRespuestas, args.respuestasAnalizadas ?? 0)
  );
  const deteccionRatio = totalRespuestas > 0 ? respuestasAnalizadas / totalRespuestas : 0;
  const rescateAltaPrecision = evaluarRescateAltaPrecisionOmr({
    calidadPagina,
    confianzaPromedioPagina: confianzaMedia,
    ratioAmbiguas
  });
  let estado: ResultadoOmr['estadoAnalisis'] = 'ok';
  let anularRespuestas = false;

  if (calidadPagina < OMR_QUALITY_REJECT_MIN && puedeRechazarPorCalidad) {
    const senalMuyDebil = confianzaMedia < 0.2 || ratioAmbiguas > 0.85;
    if (senalMuyDebil) {
      estado = 'rechazado_calidad';
      if (deteccionRatio < OMR_REJECT_KEEP_RESPONSES_MIN_DETECTION) {
        anularRespuestas = true;
      } else {
        advertencias.push('Calidad rechazada: respuestas conservadas para revision manual');
      }
      motivos.push(`Calidad insuficiente (${calidadPagina.toFixed(2)} < ${OMR_QUALITY_REJECT_MIN.toFixed(2)})`);
      advertencias.push(`Pagina rechazada por baja calidad (${calidadPagina.toFixed(2)})`);
    } else {
      estado = 'requiere_revision';
      motivos.push(`Calidad baja (${calidadPagina.toFixed(2)}), revisar manualmente`);
    }
  } else if (calidadPagina < OMR_QUALITY_REJECT_MIN && !puedeRechazarPorCalidad) {
    estado = 'requiere_revision';
    motivos.push(`Calidad baja en muestra reducida (${calidadPagina.toFixed(2)})`);
  } else if (
    calidadPagina < OMR_QUALITY_REVIEW_MIN ||
    confianzaMedia < OMR_AUTO_CONF_MIN ||
    ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX
  ) {
    if (rescateAltaPrecision) {
      estado = 'ok';
      advertencias.push(
        `Calidad baja compensada por senal OMR fuerte (confianza ${confianzaMedia.toFixed(2)}, ambiguas ${(ratioAmbiguas * 100).toFixed(1)}%)`
      );
    } else {
      const calidadMedia = calidadPagina < OMR_QUALITY_REVIEW_MIN;
      const confianzaBaja = confianzaMedia < OMR_AUTO_CONF_MIN;
      const ambiguedadAlta = ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX;
      const deteccionBaja = deteccionRatio < OMR_AUTO_DETECCION_MIN;
      const senalesDebiles = [calidadMedia, confianzaBaja, ambiguedadAlta, deteccionBaja].filter(Boolean).length;
      const senalSevera =
        confianzaMedia < Math.max(0.38, OMR_AUTO_CONF_MIN - 0.18) ||
        ratioAmbiguas > Math.max(0.6, OMR_AUTO_AMBIGUAS_MAX + 0.2) ||
        deteccionRatio < Math.max(0.45, OMR_AUTO_DETECCION_MIN - 0.25);

      if (senalSevera || senalesDebiles >= 2) {
        estado = 'requiere_revision';
        if (calidadMedia) {
          motivos.push(`Calidad media (${calidadPagina.toFixed(2)}), requiere revision`);
        }
        if (confianzaBaja) {
          motivos.push(`Confianza promedio baja (${confianzaMedia.toFixed(2)})`);
        }
        if (ambiguedadAlta) {
          motivos.push(`Ambiguedad alta (${(ratioAmbiguas * 100).toFixed(1)}%)`);
        }
        if (deteccionBaja) {
          motivos.push(`Cobertura de detección baja (${(deteccionRatio * 100).toFixed(1)}%)`);
        }
      } else {
        estado = 'ok';
        advertencias.push(
          `Senal OMR limite pero estable (confianza ${confianzaMedia.toFixed(2)}, ambiguas ${(ratioAmbiguas * 100).toFixed(1)}%, deteccion ${(deteccionRatio * 100).toFixed(1)}%)`
        );
      }
    }
  }

  if (
    estado === 'ok' &&
    deteccionRatio < Math.max(0.5, OMR_AUTO_DETECCION_MIN - 0.2) &&
    !rescateAltaPrecision
  ) {
    estado = 'requiere_revision';
    motivos.push(`Cobertura de detección insuficiente (${(deteccionRatio * 100).toFixed(1)}%)`);
  }

  if (!geometriaConfiable) {
    if (estado !== 'rechazado_calidad') estado = 'requiere_revision';
    anularRespuestas = true;
    motivos.push('Referencia de página insuficiente: se requiere QR legible o cuatro marcas y orientación verificables');
    advertencias.push('No se autocalifica una captura sin geometría y orientación confiables');
  }

  return { estado, motivos, advertencias, anularRespuestas };
}

type MetricasColorimetria = {
  colorCast: number;
  saturationMean: number;
  whiteRefR: number;
  whiteRefG: number;
  whiteRefB: number;
};

function percentilDesdeHistograma(hist: Uint32Array, q: number) {
  const total = hist.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return 255;
  const objetivo = Math.max(1, Math.round(total * q));
  let acumulado = 0;
  for (let i = 0; i < hist.length; i += 1) {
    acumulado += hist[i];
    if (acumulado >= objetivo) return i;
  }
  return 255;
}

function construirGrayColorimetrico(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { gray: Uint8ClampedArray; metricasColor: MetricasColorimetria } {
  const histR = new Uint32Array(256);
  const histG = new Uint32Array(256);
  const histB = new Uint32Array(256);
  const totalPix = Math.max(1, width * height);
  const targetMuestras = 220_000;
  const pasoMuestra = Math.max(1, Math.round(Math.sqrt(totalPix / targetMuestras)));
  let sumaR = 0;
  let sumaG = 0;
  let sumaB = 0;
  let sumaSat = 0;
  let conteo = 0;

  for (let y = 0; y < height; y += pasoMuestra) {
    for (let x = 0; x < width; x += pasoMuestra) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      histR[r] += 1;
      histG[g] += 1;
      histB[b] += 1;
      sumaR += r;
      sumaG += g;
      sumaB += b;
      const maxRgb = Math.max(r, g, b);
      const minRgb = Math.min(r, g, b);
      sumaSat += maxRgb > 0 ? (maxRgb - minRgb) / maxRgb : 0;
      conteo += 1;
    }
  }

  const refR = Math.max(170, percentilDesdeHistograma(histR, OMR_COLORIMETRY_WHITE_PERCENTILE));
  const refG = Math.max(170, percentilDesdeHistograma(histG, OMR_COLORIMETRY_WHITE_PERCENTILE));
  const refB = Math.max(170, percentilDesdeHistograma(histB, OMR_COLORIMETRY_WHITE_PERCENTILE));
  const scaleR = 255 / Math.max(1, refR);
  const scaleG = 255 / Math.max(1, refG);
  const scaleB = 255 / Math.max(1, refB);
  const meanR = (sumaR / Math.max(1, conteo)) * scaleR;
  const meanG = (sumaG / Math.max(1, conteo)) * scaleG;
  const meanB = (sumaB / Math.max(1, conteo)) * scaleB;
  const colorCast = clamp01((Math.abs(meanR - meanG) + Math.abs(meanG - meanB) + Math.abs(meanR - meanB)) / (3 * 255));
  const saturationMean = clamp01(sumaSat / Math.max(1, conteo));

  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    const r = Math.min(255, data[p] * scaleR);
    const g = Math.min(255, data[p + 1] * scaleG);
    const b = Math.min(255, data[p + 2] * scaleB);
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const tinta = Math.min(r, g, b);
    gray[i] = Math.round(luma * 0.68 + tinta * 0.32);
  }

  return {
    gray,
    metricasColor: {
      colorCast,
      saturationMean,
      whiteRefR: refR,
      whiteRefG: refG,
      whiteRefB: refB
    }
  };
}

function percentilGray(gray: Uint8ClampedArray, q: number) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
  const total = gray.length;
  const objetivo = Math.max(1, Math.round(total * q));
  let acumulado = 0;
  for (let i = 0; i < 256; i += 1) {
    acumulado += hist[i];
    if (acumulado >= objetivo) return i;
  }
  return 255;
}

function realzarGrayParaFotoDificil(gray: Uint8ClampedArray, width: number, height: number) {
  if (gray.length === 0) return gray;
  const pLow = percentilGray(gray, 0.03);
  const pHigh = percentilGray(gray, 0.97);
  const rango = Math.max(24, pHigh - pLow);
  const estirada = new Uint8ClampedArray(gray.length);

  for (let i = 0; i < gray.length; i += 1) {
    const norm = (gray[i] - pLow) / rango;
    const clamped = Math.max(0, Math.min(1, norm));
    const gamma = Math.pow(clamped, 0.92);
    estirada[i] = Math.max(0, Math.min(255, Math.round(gamma * 255)));
  }

  if (width < 3 || height < 3) return estirada;

  const salida = new Uint8ClampedArray(estirada.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        salida[idx] = estirada[idx];
        continue;
      }

      const c = estirada[idx];
      const avg4 =
        (estirada[idx - 1] + estirada[idx + 1] + estirada[idx - width] + estirada[idx + width]) / 4;
      const unsharp = c + (c - avg4) * 0.75;
      salida[idx] = Math.max(0, Math.min(255, Math.round(unsharp)));
    }
  }

  return salida;
}

async function exportarPatchesOmr(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  registros: PatchRegistro[],
  info: { folio?: string; numeroPagina?: number }
) {
  if (!OMR_EXPORT_PATCHES || registros.length === 0) return;
  const folioSafe = String(info.folio || 'sin-folio').replace(/[^a-zA-Z0-9_-]/g, '');
  const pagina = String(info.numeroPagina || '0');
  const baseDir = path.join(OMR_PATCH_DIR, folioSafe, `P${pagina}`);
  await fs.mkdir(baseDir, { recursive: true });

  const metadata: Array<Record<string, unknown>> = [];
  for (const reg of registros) {
    const left = Math.max(0, Math.round(reg.x - OMR_PATCH_SIZE / 2));
    const top = Math.max(0, Math.round(reg.y - OMR_PATCH_SIZE / 2));
    const crop = extraerSubimagenRgba(rgba, width, height, {
      left,
      top,
      width: OMR_PATCH_SIZE,
      height: OMR_PATCH_SIZE
    });
    const file = `q${String(reg.numeroPregunta).padStart(2, '0')}_${reg.letra}_${left}_${top}.png`;
    await sharp(Buffer.from(crop.data), { raw: { width: crop.width, height: crop.height, channels: 4 } })
      .png()
      .toFile(path.join(baseDir, file));
    metadata.push({
      file,
      numeroPregunta: reg.numeroPregunta,
      letra: reg.letra,
      x: reg.x,
      y: reg.y,
      score: reg.score,
      confianzaPregunta: reg.confianzaPregunta,
      seleccionada: reg.seleccionada,
      opcionDetectada: reg.opcionDetectada
    });
  }
  await fs.writeFile(path.join(baseDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
}

async function decodificarImagen(base64: string, aggressivePreprocess = false, highResolutionRescue = false) {
  const buffer = Buffer.from(limpiarBase64(base64), 'base64');
  const metadataEntrada = await sharp(buffer).metadata();
  const widthEntrada = Number(metadataEntrada.width ?? 0);
  const heightEntrada = Number(metadataEntrada.height ?? 0);
  if (!widthEntrada || !heightEntrada) {
    throw new Error('No se pudo leer la imagen');
  }
  const orientacion = determinarOrientacionCapturaOmr({
    width: widthEntrada,
    height: heightEntrada,
    exifOrientation: metadataEntrada.orientation
  });
  const imagenBase = orientacion.rotacionGrados !== 0
    ? sharp(buffer).rotate(orientacion.rotacionGrados).normalize()
    : sharp(buffer).rotate().normalize();
  // La normalizacion por canal mejora el contraste monocromatico, pero puede
  // alterar la saturacion relativa de tintas de color. Conservar RGB original
  // para el rasgo cromatico evita que la correccion de iluminacion borre esa
  // evidencia; geometria y puntuacion de luminancia siguen usando `imagenBase`.
  const imagenColorBase = orientacion.rotacionGrados !== 0
    ? sharp(buffer).rotate(orientacion.rotacionGrados)
    : sharp(buffer).rotate();
  const { width, height } = orientacion;
  // Las capturas de móvil o exportaciones de baja resolución pueden dejar el
  // QR y los fiduciales por debajo del tamaño útil para jsQR y la búsqueda
  // geométrica. Escalar solo hacia arriba en ese caso estabiliza la detección
  // sin cambiar las coordenadas del mapa, que se vuelven a proyectar con el
  // ancho/alto efectivos de la imagen normalizada.
  // Mantener un tamaño normalizado acota memoria y hace comparables los
  // umbrales entre cámaras; la micro-ROI central aporta resolución efectiva
  // adicional sin cambiar la geometría global ni multiplicar la latencia.
  const limiteResolucion = aggressivePreprocess && highResolutionRescue ? 2200 : 1600;
  const anchoObjetivo = Math.min(limiteResolucion, Math.max(width, 1200));
  const imagenRedimensionada = imagenBase.clone().resize({ width: anchoObjetivo });
  const imagenColorRedimensionada = imagenColorBase.clone().resize({ width: anchoObjetivo });
  const [imagenProcesada, imagenColorProcesada] = await Promise.all([
    imagenRedimensionada.ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    imagenColorRedimensionada.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  ]);
  const { data, info } = imagenProcesada;
  const w = info.width ?? width;
  const h = info.height ?? height;
  const rgba = new Uint8ClampedArray(data);
  const rgbaColor = new Uint8ClampedArray(imagenColorProcesada.data);
  const grayDefault = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < grayDefault.length; i += 1, p += 4) {
    grayDefault[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }
  let gray = grayDefault;
  let metricasColor: MetricasColorimetria = {
    colorCast: 0,
    saturationMean: 0,
    whiteRefR: 255,
    whiteRefG: 255,
    whiteRefB: 255
  };
  if (OMR_COLORIMETRY_ENABLED) {
    const colorimetrico = construirGrayColorimetrico(rgba, w, h);
    metricasColor = colorimetrico.metricasColor;
    const fuerzaColor =
      clamp01((metricasColor.colorCast - 0.03) / 0.25) * 0.7 +
      clamp01((metricasColor.saturationMean - 0.2) / 0.45) * 0.3;
    const mezclaColor = 0.2 + fuerzaColor * 0.45;
    gray = new Uint8ClampedArray(grayDefault.length);
    for (let i = 0; i < gray.length; i += 1) {
      gray[i] = Math.round(grayDefault[i] * (1 - mezclaColor) + colorimetrico.gray[i] * mezclaColor);
    }
  }

  const metricasPrevias = calcularMetricasImagen(gray, w, h);
  const contrasteGlobal = Math.abs(percentilGray(gray, 0.9) - percentilGray(gray, 0.1));
  const requiereRescate = aggressivePreprocess || metricasPrevias.blurVar < 110 || contrasteGlobal < 52;
  if (requiereRescate) {
    const realzada = realzarGrayParaFotoDificil(gray, w, h);
    const mezclaBase = aggressivePreprocess ? 0.78 : contrasteGlobal < 42 ? 0.72 : 0.5;
    const mezcla = Math.max(0.4, Math.min(0.9, mezclaBase));
    const combinada = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i += 1) {
      combinada[i] = Math.round(gray[i] * (1 - mezcla) + realzada[i] * mezcla);
    }
    if (aggressivePreprocess) {
      const reforzada = realzarGrayParaFotoDificil(combinada, w, h);
      gray = new Uint8ClampedArray(reforzada);
    } else {
      gray = combinada;
    }
  }

  const integral = calcularIntegral(gray, w, h);
  let micro: {
    gray: Uint8ClampedArray;
    rgba: Uint8ClampedArray;
    rgbaColor: Uint8ClampedArray;
    integral: Uint32Array;
    width: number;
    height: number;
    scale: number;
    paramsBurbuja: ParametrosBurbuja;
  } | undefined;
  if (OMR_MICRO_HIGH_RES_ENABLED && widthEntrada > 1600 && w < 2200) {
    const anchoMicro = Math.min(2200, Math.max(w + 1, widthEntrada));
    const [imagenMicro, imagenColorMicro] = await Promise.all([
      imagenBase.clone().resize({ width: anchoMicro }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      imagenColorBase.clone().resize({ width: anchoMicro }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    ]);
    const { data: dataMicro, info: infoMicro } = imagenMicro;
    const microWidth = infoMicro.width ?? anchoMicro;
    const microHeight = infoMicro.height ?? Math.round(microWidth * h / Math.max(1, w));
    const microGray = new Uint8ClampedArray(microWidth * microHeight);
    for (let i = 0, p = 0; i < microGray.length; i += 1, p += 4) {
      microGray[i] = (dataMicro[p] * 77 + dataMicro[p + 1] * 150 + dataMicro[p + 2] * 29) >> 8;
    }
    micro = {
      gray: microGray,
      rgba: new Uint8ClampedArray(dataMicro.buffer, dataMicro.byteOffset, dataMicro.byteLength),
      rgbaColor: new Uint8ClampedArray(
        imagenColorMicro.data.buffer,
        imagenColorMicro.data.byteOffset,
        imagenColorMicro.data.byteLength
      ),
      integral: calcularIntegral(microGray, microWidth, microHeight),
      width: microWidth,
      height: microHeight,
      scale: microWidth / Math.max(1, w),
      paramsBurbuja: {
        radio: 0,
        ringInner: 0,
        ringOuter: 0,
        outerOuter: 0,
        paso: 1
      }
    };
  }

  return {
    data: rgba,
    colorData: rgbaColor,
    gray,
    integral,
    width: w,
    height: h,
    metricasColor,
    buffer,
    sourceWidth: w,
    orientationMode: orientacion.modo,
    micro
  };
}

async function detectarQrEnResolucionFuente(
  buffer: Buffer,
  qrSizePtsHint?: number,
  opciones: { matrixModules?: number; payloadsEsperados?: readonly string[] } = {}
) {
  const metadata = await sharp(buffer).metadata();
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (!width || !height || width <= 1600) return null;
  const orientacion = determinarOrientacionCapturaOmr({
    width,
    height,
    exifOrientation: metadata.orientation
  });
  const imagenFuente = orientacion.rotacionGrados !== 0
    ? sharp(buffer).rotate(orientacion.rotacionGrados)
    : sharp(buffer).rotate();
  const fuenteWidth = orientacion.width;
  const fuenteHeight = orientacion.height;
  const qrSizePts = qrSizePtsHint ?? QR_MATRIZ_SIZE_PTS;
  const qrSizePx = Math.max(80, Math.round((qrSizePts / ANCHO_CARTA) * fuenteWidth));
  const lado = Math.max(1, Math.min(
    Math.round(qrSizePx * 1.25),
    Math.floor(Math.min(fuenteWidth, fuenteHeight) * 0.28)
  ));
  // El QR esperado ocupa la cabecera derecha; este único recorte deja margen
  // suficiente para inclinación/perspectiva leve sin decodificar varias veces
  // el bitmap nativo completo.
  const left = Math.max(0, Math.min(fuenteWidth - lado, Math.round(fuenteWidth * 0.875 - lado / 2)));
  const top = Math.max(0, Math.min(fuenteHeight - lado, Math.round(fuenteHeight * 0.1 - lado / 2)));
  const { data, info } = await imagenFuente.clone().extract({ left, top, width: lado, height: lado })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const widthRecorte = info.width ?? lado;
  const heightRecorte = info.height ?? lado;
  const rgba = new Uint8ClampedArray(data);
  const gray = new Uint8ClampedArray(widthRecorte * heightRecorte);
  for (let indice = 0, pixel = 0; indice < gray.length; indice += 1, pixel += 4) {
    gray[indice] = (rgba[pixel]! * 77 + rgba[pixel + 1]! * 150 + rgba[pixel + 2]! * 29) >> 8;
  }
  const qrRecorte = detectarQrEnRecorteNativo(
    rgba,
    gray,
    widthRecorte,
    heightRecorte,
    { x: left, y: top },
    { width: fuenteWidth, height: fuenteHeight, qrSizePts, anchoCarta: ANCHO_CARTA }
  );
  if (qrRecorte && (!opciones.payloadsEsperados?.length || opciones.payloadsEsperados.includes(qrRecorte.data))) return qrRecorte;

  // Algunos códigos de capturas inclinadas o tenues se pierden al aislar la
  // reserva antes de decodificar. El pase global se limita a un ZXing en gris
  // sobre la fuente intacta, después de intentar primero la ROI nativa.
  const { data: grisFuente, info: infoGrisFuente } = await imagenFuente.clone()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const qrFuente = detectarQrZxingPaginaFuente(
    new Uint8ClampedArray(grisFuente),
    infoGrisFuente.width ?? fuenteWidth,
    infoGrisFuente.height ?? fuenteHeight,
    qrSizePts,
    ANCHO_CARTA,
    opciones
  );
  return qrFuente ?? detectarQrEnResolucionFuenteRotada(buffer, qrSizePts, opciones);
}

/**
 * Rescata el QR exacto en la imagen fuente cuando la orientación de lectura
 * impide detectar patrones ZXing. Las esquinas quedan en el marco girado:
 * el caller solo debe usar el payload para identidad, nunca para rectificar OMR.
 */
export async function detectarQrEnResolucionFuenteRotada(
  buffer: Buffer,
  qrSizePtsHint?: number,
  opciones: { matrixModules?: number; payloadsEsperados?: readonly string[] } = {}
): Promise<QrDetalle | null> {
  const payloadsEsperados = opciones.payloadsEsperados ?? [];
  if (payloadsEsperados.length === 0) return null;
  const metadata = await sharp(buffer).metadata();
  if (Math.max(Number(metadata.width ?? 0), Number(metadata.height ?? 0)) <= 1600) return null;

  const qrSizePts = qrSizePtsHint ?? QR_MATRIZ_SIZE_PTS;
  for (const giro of [90, 180, 270] as const) {
    const { data, info } = await sharp(buffer)
      .rotate(giro)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const verificado = detectarQrZxingPaginaFuente(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      qrSizePts,
      ANCHO_CARTA,
      opciones
    );
    if (verificado && payloadsEsperados.includes(verificado.data)) {
      return { ...verificado, fuenteDeteccionQr: 'rotacion_pagina' };
    }
  }
  return null;
}

async function detectarQrEnImagenRealzada(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  qrSizePtsHint?: number
) {
  const qrSizePts = qrSizePtsHint ?? QR_MATRIZ_SIZE_PTS;
  const region = calcularRegionQrFocalizada(width, height, qrSizePts, ANCHO_CARTA);
  const rgbaInput = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const { data: pixels, info } = await sharp(rgbaInput, {
    raw: { width, height, channels: 4 }
  })
    .extract(region)
    .sharpen({ sigma: 0.8 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(pixels);
  const gray = new Uint8ClampedArray(info.width * info.height);
  for (let indice = 0, pixel = 0; indice < gray.length; indice += 1, pixel += 4) {
    gray[indice] = (rgba[pixel]! * 77 + rgba[pixel + 1]! * 150 + rgba[pixel + 2]! * 29) >> 8;
  }
  return detectarQrEnRecorteNativo(
    rgba,
    gray,
    info.width,
    info.height,
    { x: region.left, y: region.top },
    { width, height, qrSizePts, anchoCarta: ANCHO_CARTA }
  );
}

/**
 * Último rescate del QR cuando el contenido de la página está girado respecto
 * de su orientación vertical. Solo se decodifican dos ROI pequeñas alrededor
 * de la cabecera esperada, tolerando recorte/margen de cámara, y las
 * coordenadas se devuelven en el marco original de la captura.
 */
export async function detectarQrConRotacionPagina(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  qrSizePtsHint?: number,
  payloadsEsperados: readonly string[] = []
): Promise<QrDetalle | null> {
  if (width < 160 || height < 160 || data.length !== width * height * 4) return null;
  const giros: Array<90 | 180 | 270> = width > height * 1.05 ? [90, 270] : [180];
  const entrada = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const qrSizePts = qrSizePtsHint ?? QR_MATRIZ_SIZE_PTS;

  for (const giro of giros) {
    const widthRotada = giro === 180 ? width : height;
    const heightRotada = giro === 180 ? height : width;
    const region = calcularRegionQrFocalizada(widthRotada, heightRotada, qrSizePts, ANCHO_CARTA);
    const { data: pixeles, info } = await sharp(entrada, {
      raw: { width, height, channels: 4 }
    })
      .rotate(giro)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const anchoCompleto = info.width ?? widthRotada;
    const altoCompleto = info.height ?? heightRotada;
    const rgbaCompleto = new Uint8ClampedArray(pixeles);
    const desrotar = (punto: { x: number; y: number }) => {
      if (giro === 90) return { x: punto.y, y: height - 1 - punto.x };
      if (giro === 180) return { x: width - 1 - punto.x, y: height - 1 - punto.y };
      return { x: width - 1 - punto.y, y: punto.x };
    };
    const regiones = [
      region,
      {
        ...region,
        left: Math.max(0, Math.min(anchoCompleto - region.width, region.left - Math.round(anchoCompleto * 0.1))),
        top: Math.max(0, Math.min(altoCompleto - region.height, region.top + Math.round(altoCompleto * 0.09)))
      }
    ];
    for (const regionCandidata of regiones) {
      const recorte = extraerSubimagenRgba(rgbaCompleto, anchoCompleto, altoCompleto, regionCandidata);
      const grayRecorte = new Uint8ClampedArray(recorte.width * recorte.height);
      for (let indice = 0, pixel = 0; indice < grayRecorte.length; indice += 1, pixel += 4) {
        grayRecorte[indice] = (recorte.data[pixel]! * 77 + recorte.data[pixel + 1]! * 150 + recorte.data[pixel + 2]! * 29) >> 8;
      }
      const detectado = detectarQrEnRecorteNativo(
        recorte.data,
        grayRecorte,
        recorte.width,
        recorte.height,
        { x: regionCandidata.left, y: regionCandidata.top },
        { width: anchoCompleto, height: altoCompleto, qrSizePts, anchoCarta: ANCHO_CARTA }
      );
      if (!detectado || (payloadsEsperados.length > 0 && !payloadsEsperados.includes(detectado.data))) continue;
      return {
        ...detectado,
        location: {
          topLeftCorner: desrotar(detectado.location.topLeftCorner),
          topRightCorner: desrotar(detectado.location.topRightCorner),
          bottomRightCorner: desrotar(detectado.location.bottomRightCorner),
          bottomLeftCorner: desrotar(detectado.location.bottomLeftCorner)
        },
        fuenteDeteccionQr: 'rotacion_pagina'
      };
    }
  }
  return null;
}

function calcularMetricaAlineacion(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  dx: number,
  dy: number,
  params: ParametrosBurbuja
) {
  let mejorScore = 0;
  let segundoScore = 0;
  for (const opcion of centros) {
    const punto = { x: opcion.punto.x + dx, y: opcion.punto.y + dy };
    const { score } = detectarOpcion(gray, integral, width, height, punto, params);
    if (score > mejorScore) {
      segundoScore = mejorScore;
      mejorScore = score;
    } else if (score > segundoScore) {
      segundoScore = score;
    }
  }
  const delta = Math.max(0, mejorScore - segundoScore);
  // Priorizamos separacion clara entre opcion dominante y el resto.
  return delta * 1.4 + mejorScore * 0.3;
}

function evaluarAlineacionOffset(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  dx: number,
  dy: number,
  params: ParametrosBurbuja
) {
  return calcularMetricaAlineacion(gray, integral, width, height, centros, dx, dy, params);
}

function localizarMarcaLocal(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centro: Punto,
  radio = 18,
  fidSizePx = 10
) {
  const paso = 1;
  const half = Math.max(2, fidSizePx / 2);
  const x0 = Math.max(0, Math.floor(centro.x - radio));
  const x1 = Math.min(width - 1, Math.ceil(centro.x + radio));
  const y0 = Math.max(0, Math.floor(centro.y - radio));
  const y1 = Math.min(height - 1, Math.ceil(centro.y + radio));

  let mejorX = centro.x;
  let mejorY = centro.y;
  let mejorMean = Infinity;

  for (let y = y0; y <= y1; y += paso) {
    for (let x = x0; x <= x1; x += paso) {
      const mean = mediaEnVentana(integral, width, height, x - half, y - half, x + half, y + half);
      if (mean < mejorMean) {
        mejorMean = mean;
        mejorX = x;
        mejorY = y;
      }
    }
  }

  const fondo = mediaEnVentana(integral, width, height, centro.x - radio * 1.3, centro.y - radio * 1.3, centro.x + radio * 1.3, centro.y + radio * 1.3);
  if (mejorMean > fondo - 10) return null;
  if (!Number.isFinite(mejorX) || !Number.isFinite(mejorY)) return null;
  return { x: mejorX, y: mejorY };
}

function localizarBordeVertical(
  integral: Uint32Array,
  width: number,
  height: number,
  xEsperado: number,
  yTop: number,
  yBottom: number,
  rango = 18
) {
  const y0 = Math.max(0, Math.min(yTop, yBottom));
  const y1 = Math.min(height - 1, Math.max(yTop, yBottom));
  if (y1 - y0 < 8) return null;
  let mejorX = Math.round(xEsperado);
  let mejor = Infinity;
  for (let x = Math.floor(xEsperado - rango); x <= Math.ceil(xEsperado + rango); x += 1) {
    if (x < 2 || x >= width - 2) continue;
    const banda = mediaEnVentana(integral, width, height, x - 1, y0, x + 1, y1);
    if (banda < mejor) {
      mejor = banda;
      mejorX = x;
    }
  }
  const contexto = mediaEnVentana(integral, width, height, xEsperado - rango - 4, y0, xEsperado + rango + 4, y1);
  if (mejor > contexto - 6) return null;
  return mejorX;
}

function localizarBordeHorizontal(
  integral: Uint32Array,
  width: number,
  height: number,
  yEsperado: number,
  xLeft: number,
  xRight: number,
  rango = 24
) {
  const x0 = Math.max(2, Math.min(xLeft, xRight));
  const x1 = Math.min(width - 2, Math.max(xLeft, xRight));
  if (x1 - x0 < 24) return null;
  let mejorY = Math.round(yEsperado);
  let mejor = Infinity;
  for (let y = Math.floor(yEsperado - rango); y <= Math.ceil(yEsperado + rango); y += 1) {
    if (y < 2 || y >= height - 2) continue;
    const banda = mediaEnVentana(integral, width, height, x0, y - 1, x1, y + 1);
    if (banda < mejor) {
      mejor = banda;
      mejorY = y;
    }
  }
  const contexto = mediaEnVentana(integral, width, height, x0, yEsperado - rango - 4, x1, yEsperado + rango + 4);
  if (mejor > contexto - 8) return null;
  return mejorY;
}

function ajustarCentrosVerticalPorCaja(
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  escalaX: number,
  boxWidthPts: number,
  centerToLeftPts: number
) {
  if (centros.length < 2) return null;
  const xs = centros.map((centro) => centro.punto.x);
  const ys = centros.map((centro) => centro.punto.y);
  const expectedLeft = Math.min(...xs) - centerToLeftPts * escalaX;
  const expectedRight = expectedLeft + boxWidthPts * escalaX;
  const margenY = Math.max(8, params.ringOuter * 1.4);
  const expectedTop = Math.max(...ys) + margenY;
  const expectedBottom = Math.min(...ys) - margenY;
  const rango = Math.max(36, Math.min(132, params.ringOuter * 9));
  const top = localizarBordeHorizontal(integral, width, height, expectedTop, expectedLeft, expectedRight, rango);
  const bottom = localizarBordeHorizontal(integral, width, height, expectedBottom, expectedLeft, expectedRight, rango);
  if (top === null || bottom === null) return null;

  const expectedSpan = expectedTop - expectedBottom;
  const actualSpan = top - bottom;
  if (expectedSpan < 12 || !Number.isFinite(actualSpan) || actualSpan < expectedSpan * 0.82 || actualSpan > expectedSpan * 1.22) {
    return null;
  }
  const scaleY = actualSpan / expectedSpan;
  const offsetY = bottom - expectedBottom * scaleY;
  if (!Number.isFinite(scaleY) || scaleY < 0.82 || scaleY > 1.22) return null;
  return centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: opcion.punto.x,
      y: opcion.punto.y * scaleY + offsetY
    }
  }));
}

function ajustarCentrosVerticalPorCajaAmplia(
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  escalaX: number,
  boxWidthPts: number,
  centerToLeftPts: number
) {
  if (centros.length < 2) return null;
  const xs = centros.map((centro) => centro.punto.x);
  const ys = centros.map((centro) => centro.punto.y);
  const expectedLeft = Math.min(...xs) - centerToLeftPts * escalaX;
  const expectedRight = expectedLeft + boxWidthPts * escalaX;
  const margenY = Math.max(8, params.ringOuter * 1.4);
  const expectedUpper = Math.min(...ys) - margenY;
  const expectedLower = Math.max(...ys) + margenY;
  const expectedSpan = expectedLower - expectedUpper;
  if (expectedSpan < 24) return null;

  const x0 = Math.max(2, Math.min(expectedLeft, expectedRight));
  const x1 = Math.min(width - 2, Math.max(expectedLeft, expectedRight));
  const searchMin = Math.max(2, Math.floor(expectedUpper - 260));
  const searchMax = Math.min(height - 3, Math.ceil(expectedLower + 260));
  const lines: Array<{ y: number; mean: number }> = [];
  for (let y = searchMin; y <= searchMax; y += 1) {
    const mean = mediaEnVentana(integral, width, height, x0, y - 1, x1, y + 1);
    if (mean >= 180) continue;
    const prev = mediaEnVentana(integral, width, height, x0, y - 2, x1, y);
    const next = mediaEnVentana(integral, width, height, x0, y, x1, y + 2);
    if (mean <= prev && mean <= next) lines.push({ y, mean });
  }
  if (lines.length < 2) return null;

  const expectedMid = (expectedUpper + expectedLower) / 2;
  let mejor: { upper: number; lower: number; score: number } | null = null;
  for (let i = 0; i < lines.length - 1; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const upper = lines[i].y;
      const lower = lines[j].y;
      const span = lower - upper;
      if (span < expectedSpan * 0.72 || span > expectedSpan * 1.5) continue;
      const score =
        Math.abs((upper + lower) / 2 - expectedMid) +
        Math.abs(span - expectedSpan) * 0.35 +
        (lines[i].mean + lines[j].mean) * 0.08;
      if (!mejor || score < mejor.score) mejor = { upper, lower, score };
    }
  }
  if (!mejor) return null;
  const scaleY = (mejor.lower - mejor.upper) / expectedSpan;
  const offsetY = mejor.upper - expectedUpper * scaleY;
  if (!Number.isFinite(scaleY) || scaleY < 0.72 || scaleY > 1.5) return null;
  return centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: opcion.punto.x,
      y: opcion.punto.y * scaleY + offsetY
    }
  }));
}

type AjusteFiducialesResultado = {
  centros: Array<{ letra: string; punto: Punto }>;
  reprojectionErrorPx: number;
  puntosDetectados: number;
  puntosEsperados: number;
};

function distancia(a: Punto, b: Punto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type ParejaTransformacionAfin = {
  esperado: Punto;
  detectado: Punto;
};

type AjusteTransformacionAfin = {
  transformar: (punto: Punto) => Punto;
  reprojectionErrorPx: number;
};

/**
 * Ajusta un mapa afín local usando fiduciales del mismo panel OMR.
 * La escala + traslacion anterior no puede representar cizallamiento: bajo
 * una captura inclinada, las filas superior e inferior terminan con distinto
 * desplazamiento horizontal. Se prueban triangulos no colineales y se elige
 * el ajuste con menor error medio para tolerar un fiducial espurio.
 */
function resolverTransformacionAfinLocal(
  pares: ParejaTransformacionAfin[]
): AjusteTransformacionAfin | null {
  if (pares.length < 3) return null;

  let mejor: AjusteTransformacionAfin | null = null;
  for (let i = 0; i < pares.length - 2; i += 1) {
    for (let j = i + 1; j < pares.length - 1; j += 1) {
      for (let k = j + 1; k < pares.length; k += 1) {
        const p0 = pares[i]?.esperado;
        const p1 = pares[j]?.esperado;
        const p2 = pares[k]?.esperado;
        const q0 = pares[i]?.detectado;
        const q1 = pares[j]?.detectado;
        const q2 = pares[k]?.detectado;
        if (!p0 || !p1 || !p2 || !q0 || !q1 || !q2) continue;

        const ux = p1.x - p0.x;
        const uy = p1.y - p0.y;
        const vx = p2.x - p0.x;
        const vy = p2.y - p0.y;
        const determinante = ux * vy - uy * vx;
        if (Math.abs(determinante) < 1e-3) continue;

        const transformar = (punto: Punto): Punto => {
          const px = punto.x - p0.x;
          const py = punto.y - p0.y;
          const alpha = (px * vy - py * vx) / determinante;
          const beta = (ux * py - uy * px) / determinante;
          return {
            x: q0.x + alpha * (q1.x - q0.x) + beta * (q2.x - q0.x),
            y: q0.y + alpha * (q1.y - q0.y) + beta * (q2.y - q0.y)
          };
        };

        const reprojectionErrorPx =
          pares.reduce((total, par) => total + distancia(transformar(par.esperado), par.detectado), 0) /
          Math.max(1, pares.length);
        if (!mejor || reprojectionErrorPx < mejor.reprojectionErrorPx) {
          mejor = { transformar, reprojectionErrorPx };
        }
      }
    }
  }
  return mejor;
}

function ajustarCentrosPorFiduciales(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  fidTop: Punto,
  fidBottom: Punto,
  fidSizePx: number,
  fidTopRight?: Punto,
  fidBottomRight?: Punto,
  fidMidLeft?: Punto,
  fidMidRight?: Punto,
  radioBusquedaFactor = 3.6
): AjusteFiducialesResultado | null {
  // En el panel horizontal las burbujas quedan cerca de los fiduciales en Y;
  // una ventana fija de 18px podía incluir el círculo vecino y elegirlo como
  // el componente más oscuro. El llamador reduce el radio para esta geometría
  // y conserva una ventana proporcional al marcador.
  const radio = Math.max(10, fidSizePx * radioBusquedaFactor);
  const detTop = localizarMarcaLocal(gray, integral, width, height, fidTop, radio, fidSizePx);
  const detBottom = localizarMarcaLocal(gray, integral, width, height, fidBottom, radio, fidSizePx);
  if (!detTop || !detBottom) return null;
  const detMidLeft = fidMidLeft ? localizarMarcaLocal(gray, integral, width, height, fidMidLeft, Math.max(14, radio * 0.85), fidSizePx) : null;

  const dyEsperado = fidBottom.y - fidTop.y;
  const dyReal = detBottom.y - detTop.y;
  if (Math.abs(dyEsperado) < 1) return null;
  const scaleY = dyReal / dyEsperado;
  // A QR-rectified page may still have mild perspective, but a collapse or
  // expansion of the fiducial span is not a valid local correction. Without
  // this guard, a spurious dark component can compress all option centers and
  // make one question look like five identical marks.
  if (!Number.isFinite(scaleY) || scaleY < 0.86 || scaleY > 1.16) return null;
  const offsetY = detTop.y - fidTop.y * scaleY;

  let scaleX = 1;
  let offsetX = (detTop.x - fidTop.x + detBottom.x - fidBottom.x) / 2;
  const yTopDet = Math.min(detTop.y, detBottom.y) - fidSizePx;
  const yBottomDet = Math.max(detTop.y, detBottom.y) + fidSizePx;
  let detTopR: Punto | null = null;
  let detBottomR: Punto | null = null;
  const detMidR = fidMidRight ? localizarMarcaLocal(gray, integral, width, height, fidMidRight, Math.max(14, radio * 0.85), fidSizePx) : null;

  if (fidTopRight && fidBottomRight) {
    detTopR = localizarMarcaLocal(gray, integral, width, height, fidTopRight, radio, fidSizePx);
    detBottomR = localizarMarcaLocal(gray, integral, width, height, fidBottomRight, radio, fidSizePx);
    if (detTopR || detBottomR || (detMidLeft && detMidR && fidMidLeft && fidMidRight)) {
      const scaleCandidates: number[] = [];
      const offsetCandidates: number[] = [];
      const incluirPar = (leftDet: Punto | null, rightDet: Punto | null, leftRef: Punto | undefined, rightRef: Punto | undefined) => {
        if (!leftDet || !rightDet || !leftRef || !rightRef) return;
        const dxEsperado = rightRef.x - leftRef.x;
        if (Math.abs(dxEsperado) <= 1) return;
        const s = (rightDet.x - leftDet.x) / dxEsperado;
        if (!Number.isFinite(s)) return;
        scaleCandidates.push(s);
        offsetCandidates.push(leftDet.x - leftRef.x * s);
        offsetCandidates.push(rightDet.x - rightRef.x * s);
      };

      incluirPar(detTop, detTopR, fidTop, fidTopRight);
      incluirPar(detBottom, detBottomR, fidBottom, fidBottomRight);
      incluirPar(detMidLeft, detMidR, fidMidLeft, fidMidRight);

      if (scaleCandidates.length > 0) {
        scaleX = scaleCandidates.reduce((acc, val) => acc + val, 0) / scaleCandidates.length;
      }
      if (offsetCandidates.length > 0) {
        offsetX = offsetCandidates.reduce((acc, val) => acc + val, 0) / offsetCandidates.length;
      }
    } else {
      const bordeIzq = localizarBordeVertical(integral, width, height, detTop.x, yTopDet, yBottomDet, Math.max(10, fidSizePx * 2));
      const bordeDer = localizarBordeVertical(
        integral,
        width,
        height,
        fidMidRight?.x ?? fidTopRight.x,
        yTopDet,
        yBottomDet,
        Math.max(14, fidSizePx * 3)
      );
      if (bordeIzq !== null && bordeDer !== null) {
        const dxEsperado = fidTopRight.x - fidTop.x;
        const dxReal = bordeDer - bordeIzq;
        if (Math.abs(dxEsperado) > 1) {
          scaleX = dxReal / dxEsperado;
        }
        const offsetLeft = bordeIzq - fidTop.x * scaleX;
        const offsetRight = bordeDer - fidTopRight.x * scaleX;
        offsetX = (offsetLeft + offsetRight) / 2;
      }
    }
  }

  if (!Number.isFinite(scaleX) || scaleX < 0.85 || scaleX > 1.15) {
    scaleX = 1;
    offsetX = (detTop.x - fidTop.x + detBottom.x - fidBottom.x) / 2;
  }

  const paresAfin: ParejaTransformacionAfin[] = [
    { esperado: fidTop, detectado: detTop },
    { esperado: fidBottom, detectado: detBottom }
  ];
  if (fidTopRight && detTopR) paresAfin.push({ esperado: fidTopRight, detectado: detTopR });
  if (fidBottomRight && detBottomR) paresAfin.push({ esperado: fidBottomRight, detectado: detBottomR });
  if (fidMidLeft && detMidLeft) paresAfin.push({ esperado: fidMidLeft, detectado: detMidLeft });
  if (fidMidRight && detMidR) paresAfin.push({ esperado: fidMidRight, detectado: detMidR });

  const ajusteAfin = resolverTransformacionAfinLocal(paresAfin);
  const errorAfinMax = Math.max(2.6, fidSizePx * 0.9);
  const usarAjusteAfin = paresAfin.length >= 4 && ajusteAfin !== null && ajusteAfin.reprojectionErrorPx <= errorAfinMax;
  const centrosAjustados = centros.map((opcion) => ({
    letra: opcion.letra,
    punto: usarAjusteAfin && ajusteAfin
      ? ajusteAfin.transformar(opcion.punto)
      : {
          x: opcion.punto.x * scaleX + offsetX,
          y: opcion.punto.y * scaleY + offsetY
        }
  }));
  const errores: number[] = [distancia(detTop, fidTop), distancia(detBottom, fidBottom)];
  if (fidMidLeft) {
    if (detMidLeft) errores.push(distancia(detMidLeft, fidMidLeft));
    else errores.push(8);
  }
  if (fidTopRight) {
    if (detTopR) errores.push(distancia(detTopR, fidTopRight));
    else errores.push(8);
  }
  if (fidBottomRight) {
    if (detBottomR) errores.push(distancia(detBottomR, fidBottomRight));
    else errores.push(8);
  }
  const reprojectionErrorPx = usarAjusteAfin && ajusteAfin
    ? ajusteAfin.reprojectionErrorPx
    : errores.reduce((acc, e) => acc + e, 0) / Math.max(1, errores.length);
  return {
    centros: centrosAjustados,
    reprojectionErrorPx,
    puntosDetectados: 2 + (detMidLeft ? 1 : 0) + (detTopR ? 1 : 0) + (detBottomR ? 1 : 0) + (detMidR ? 1 : 0),
    puntosEsperados: 2 + (fidMidLeft ? 1 : 0) + (fidTopRight ? 1 : 0) + (fidBottomRight ? 1 : 0) + (fidMidRight ? 1 : 0)
  };
}

function ajustarCentrosPorPanelDerechoFiduciales(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  fidTopRight: Punto,
  fidBottomRight: Punto,
  fidSizePx: number,
  fidMidRight?: Punto,
  radioBusquedaFactor = 3.2
): AjusteFiducialesResultado | null {
  const radio = Math.max(10, fidSizePx * radioBusquedaFactor);
  const detTopR = localizarMarcaLocal(gray, integral, width, height, fidTopRight, radio, fidSizePx);
  const detBottomR = localizarMarcaLocal(gray, integral, width, height, fidBottomRight, radio, fidSizePx);
  const detMidR = fidMidRight
    ? localizarMarcaLocal(gray, integral, width, height, fidMidRight, Math.max(12, radio * 0.8), fidSizePx)
    : null;
  const pares: Array<{ exp: Punto; det: Punto }> = [];
  if (detTopR) pares.push({ exp: fidTopRight, det: detTopR });
  if (detBottomR) pares.push({ exp: fidBottomRight, det: detBottomR });
  if (fidMidRight && detMidR) pares.push({ exp: fidMidRight, det: detMidR });
  if (pares.length < 2) return null;

  const dxs = pares.map((p) => p.det.x - p.exp.x);
  const dys = pares.map((p) => p.det.y - p.exp.y);
  const shiftX = dxs.reduce((acc, v) => acc + v, 0) / dxs.length;
  const shiftY = dys.reduce((acc, v) => acc + v, 0) / dys.length;
  if (!Number.isFinite(shiftX) || !Number.isFinite(shiftY)) return null;
  if (Math.abs(shiftX) > width * 0.22 || Math.abs(shiftY) > height * 0.22) return null;

  const dyEsperado = fidBottomRight.y - fidTopRight.y;
  const puedeEscalarY = detTopR && detBottomR && Math.abs(dyEsperado) > 1;
  const scaleY = puedeEscalarY ? (detBottomR.y - detTopR.y) / dyEsperado : 1;
  if (!Number.isFinite(scaleY) || scaleY < 0.86 || scaleY > 1.16) return null;
  if (detTopR && detBottomR && Math.abs(dyEsperado) > 1) {
    // Los dos fiduciales derechos pertenecen a una misma línea vertical. Una
    // inclinación excesiva indica que la búsqueda capturó texto, una burbuja
    // o un borde cercano; aceptarla desplaza cada opción a otra fila.
    const dxEsperado = fidBottomRight.x - fidTopRight.x;
    const dxDetectado = detBottomR.x - detTopR.x;
    const maxDerivaHorizontal = Math.max(fidSizePx * 2.5, Math.abs(dyEsperado) * 0.08);
    if (Math.abs(dxDetectado - dxEsperado) > maxDerivaHorizontal) return null;
  }
  const offsetY = detTopR && detBottomR ? detTopR.y - fidTopRight.y * scaleY : shiftY;

  const dxEsperadoLinea = fidBottomRight.x - fidTopRight.x;
  const dxDetectadoLinea = detTopR && detBottomR ? detBottomR.x - detTopR.x : dxEsperadoLinea;

  const mapPoint = (p: Punto): Punto => {
    if (!(detTopR && detBottomR) || Math.abs(dyEsperado) <= 1) {
      return { x: p.x + shiftX, y: p.y * scaleY + offsetY };
    }
    const t = (p.y - fidTopRight.y) / dyEsperado;
    const xLineaEsperada = fidTopRight.x + dxEsperadoLinea * t;
    const xLineaDetectada = detTopR.x + dxDetectadoLinea * t;
    const deltaLineaX = xLineaDetectada - xLineaEsperada;
    return { x: p.x + deltaLineaX, y: p.y * scaleY + offsetY };
  };

  const centrosAjustados = centros.map((opcion) => ({
    letra: opcion.letra,
    punto: mapPoint(opcion.punto)
  }));

  const errores = pares.map(({ exp, det }) => distancia(mapPoint(exp), det));
  const reprojectionErrorPx = errores.reduce((acc, e) => acc + e, 0) / Math.max(1, errores.length);
  const puntosEsperados = 2 + (fidMidRight ? 1 : 0);
  return {
    centros: centrosAjustados,
    reprojectionErrorPx,
    puntosDetectados: pares.length,
    puntosEsperados
  };
}

function ajustarCentrosHorizontal(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  horizontalRange: number
) {
  if (centros.length < 2) return centros;
  const baseX = centros[0].punto.x;
  let mejorScore = -Infinity;
  let mejorScale = 1;
  let mejorOffset = 0;
  // En el perfil denso la coordenada informativa es X. Reutilizar la búsqueda
  // vertical histórica dejaba el paso horizontal sin corregir cuando la foto
  // tenía perspectiva o el comparador elegía escala simple.
  for (let scale = 0.94; scale <= 1.06 + 1e-6; scale += 0.01) {
    for (let offset = -horizontalRange; offset <= horizontalRange + 1e-6; offset += OMR_VERT_STEP) {
      const centrosAjustados = centros.map((opcion) => ({
        letra: opcion.letra,
        punto: { x: baseX + (opcion.punto.x - baseX) * scale + offset, y: opcion.punto.y }
      }));
      const score = calcularMetricaAlineacion(gray, integral, width, height, centrosAjustados, 0, 0, params);
      if (score > mejorScore) {
        mejorScore = score;
        mejorScale = scale;
        mejorOffset = offset;
      }
    }
  }
  return centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: baseX + (opcion.punto.x - baseX) * mejorScale + mejorOffset,
      y: opcion.punto.y
    }
  }));
}

function ajustarCentrosPorCaja(
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  escalaX: number,
  boxWidthPts: number,
  centerToLeftPts: number
) {
  if (centros.length === 0) return null;
  const xs = centros.map((c) => c.punto.x);
  const ys = centros.map((c) => c.punto.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const margenY = Math.max(8, params.ringOuter * 1.4);
  const yTop = Math.max(0, Math.min(height - 1, maxY + margenY));
  const yBottom = Math.max(0, Math.min(height - 1, minY - margenY));

  const offsetLeftPx = centerToLeftPts * escalaX;
  const boxWidthPx = boxWidthPts * escalaX;
  const expectedLeft = Math.min(...xs) - offsetLeftPx;
  const expectedRight = expectedLeft + boxWidthPx;

  const rango = Math.max(12, params.ringOuter * 1.1);
  const bordeIzq = localizarBordeVertical(integral, width, height, expectedLeft, yTop, yBottom, rango);
  const bordeDer = localizarBordeVertical(integral, width, height, expectedRight, yTop, yBottom, rango);
  if (bordeIzq === null || bordeDer === null) return null;

  const dxEsperado = expectedRight - expectedLeft;
  const dxReal = bordeDer - bordeIzq;
  if (Math.abs(dxEsperado) < 1) return null;

  const scaleX = dxReal / dxEsperado;
  const offsetX = bordeIzq - expectedLeft * scaleX;
  if (!Number.isFinite(scaleX) || scaleX < 0.88 || scaleX > 1.12) return null;

  return centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
      x: opcion.punto.x * scaleX + offsetX,
      y: opcion.punto.y
    }
  }));
}

function construirCentrosBasePregunta(
  pregunta: MapaOmrPagina['preguntas'][number],
  transformar: (punto: Punto) => Punto
) {
  return pregunta.opciones.map((opcion) => {
    const base = transformar({ x: opcion.x, y: opcion.y });
    return {
      letra: opcion.letra,
      punto: { x: base.x + OMR_OFFSET_X, y: base.y + OMR_OFFSET_Y }
    };
  });
}

type FiducialesNormalizados = {
  leftTop: Punto;
  leftBottom: Punto;
  rightTop: Punto;
  rightBottom: Punto;
  leftMid?: Punto;
  rightMid?: Punto;
};

type PreparacionPregunta = {
  centros: Array<{ letra: string; punto: Punto }>;
  reprojectionErrorPx: number | null;
  puntosFidDetectados: number;
  puntosFidEsperados: number;
  usaRescateCaja: boolean;
  motivo?: string;
};

function normalizarFiducialesPregunta(
  fid: MapaOmrPagina['preguntas'][number]['fiduciales'],
  transformar: (punto: Punto) => Punto
): FiducialesNormalizados | null {
  if (!fid) return null;
  if ('leftTop' in fid) {
    return {
      leftTop: transformar(fid.leftTop),
      leftBottom: transformar(fid.leftBottom),
      rightTop: transformar(fid.rightTop),
      rightBottom: transformar(fid.rightBottom),
      leftMid: fid.leftMid ? transformar(fid.leftMid) : undefined,
      rightMid: fid.rightMid ? transformar(fid.rightMid) : undefined
    };
  }
  const leftTop = transformar(fid.top);
  const leftBottom = transformar(fid.bottom);
  const rightTop = transformar({ x: fid.top.x + OMR_FID_RIGHT_OFFSET_PTS, y: fid.top.y });
  const rightBottom = transformar({ x: fid.bottom.x + OMR_FID_RIGHT_OFFSET_PTS, y: fid.bottom.y });
  return {
    leftTop,
    leftBottom,
    rightTop,
    rightBottom,
    leftMid: { x: (leftTop.x + leftBottom.x) / 2, y: (leftTop.y + leftBottom.y) / 2 },
    rightMid: { x: (rightTop.x + rightBottom.x) / 2, y: (rightTop.y + rightBottom.y) / 2 }
  };
}

function prepararCentrosPregunta(
  estado: EstadoImagenOmr,
  pregunta: MapaOmrPagina['preguntas'][number],
  transformar: (punto: Punto) => Punto,
  perfil: PerfilDeteccionOmr,
  usarCoordenadasEstrictas: boolean,
  usarGeometriaLocal: boolean,
  fiducialSizeMm: number,
  permitirBusquedaHorizontal: boolean,
  usarSoloFiducialesCompletos: boolean,
  capturaBajaResolucion: boolean
): PreparacionPregunta {
  const { gray, integral, width, height, escalaX, paramsBurbuja } = estado;
  const centrosBase = construirCentrosBasePregunta(pregunta, transformar);
  const esPanelVertical = pregunta.opciones.length >= 2 && (() => {
    const xs = pregunta.opciones.map((opcion) => Number(opcion.x));
    const ys = pregunta.opciones.map((opcion) => Number(opcion.y));
    const rangoX = Math.max(...xs) - Math.min(...xs);
    const rangoY = Math.max(...ys) - Math.min(...ys);
    return rangoY > Math.max(12, rangoX * 1.5);
  })();
  const esPanelHorizontal = !esPanelVertical && (
    (Number.isFinite(pregunta.perfilOmr?.pasoX) && Number(pregunta.perfilOmr?.pasoX) > 0.4) || (() => {
      const xs = pregunta.opciones.map((opcion) => Number(opcion.x));
      const ys = pregunta.opciones.map((opcion) => Number(opcion.y));
      const rangoX = Math.max(...xs) - Math.min(...xs);
      const rangoY = Math.max(...ys) - Math.min(...ys);
      return rangoX > Math.max(12, rangoY * 1.5);
    })()
  );
  if (!usarGeometriaLocal || usarCoordenadasEstrictas) {
    return {
      // Incluso sin fiduciales confiables, el perfil horizontal puede corregir
      // el corrimiento común del paso X por perspectiva leve. No se buscan
      // bordes ni cajas en este camino, para evitar que texto cercano deforme
      // las cinco posiciones.
      centros: esPanelHorizontal && permitirBusquedaHorizontal
        ? ajustarCentrosHorizontal(gray, integral, width, height, centrosBase, paramsBurbuja, perfil.vertRange)
        : centrosBase,
      reprojectionErrorPx: null,
      puntosFidDetectados: 0,
      puntosFidEsperados: 0,
      usaRescateCaja: false,
      motivo: usarCoordenadasEstrictas
        ? 'Coordenadas estrictas del mapa OMR'
        : 'Ajuste geometrico local desactivado'
    };
  }
  const fiduciales = normalizarFiducialesPregunta(pregunta.fiduciales, transformar);
  // El tamano de la ventana de contraste debe corresponder al marcador que
  // realmente imprime la plantilla. El valor fijo anterior sobredimensionaba
  // la ventana y podia atraer texto o bordes cercanos en capturas pequenas.
  const fidSizePt = Math.max(0.4, Number.isFinite(fiducialSizeMm) ? fiducialSizeMm * MM_A_PUNTOS : OMR_FIDUCIAL_SIZE_MM_DEFAULT * MM_A_PUNTOS);
  const fidSizePx = Math.max(4, fidSizePt * escalaX);
  const ajusteFid = fiduciales
    ? ajustarCentrosPorFiduciales(
        gray,
        integral,
        width,
        height,
        centrosBase,
        fiduciales.leftTop,
        fiduciales.leftBottom,
        fidSizePx,
        fiduciales.rightTop,
        fiduciales.rightBottom,
        fiduciales.leftMid,
        fiduciales.rightMid,
          esPanelVertical ? 6 : capturaBajaResolucion ? 1.05 : 1.8
      )
    : null;
  const ajustePanelDerecho = fiduciales && !usarSoloFiducialesCompletos
    ? ajustarCentrosPorPanelDerechoFiduciales(
        gray,
        integral,
        width,
        height,
        centrosBase,
        fiduciales.rightTop,
        fiduciales.rightBottom,
        fidSizePx,
        fiduciales.rightMid,
          esPanelVertical ? 5.5 : 1.6
    )
    : null;
  const esAjustePlausible = (ajuste: AjusteFiducialesResultado) => {
    // Una búsqueda local solo puede observar el entorno inmediato de cada
    // fiducial. Si la transformación resultante mueve una burbuja decenas de
    // píxeles respecto de la referencia global, encontró tinta ajena (texto,
    // QR o una tarjeta vecina) y no una corrección física del panel.
    const desplazamientos = ajuste.centros.map((centro, indice) =>
      Math.hypot(centro.punto.x - centrosBase[indice].punto.x, centro.punto.y - centrosBase[indice].punto.y)
    );
    const limite = esPanelHorizontal
      ? Math.max(18, fidSizePx * 3)
      : Math.max(28, fidSizePx * 4);
    if (desplazamientos.length === 0 || !desplazamientos.every((valor) => Number.isFinite(valor) && valor <= limite)) {
      return false;
    }
    if (!pregunta.cajaOmr) return true;
    const caja = pregunta.cajaOmr;
    const esquinasCaja = [
      transformar({ x: caja.x, y: caja.y }),
      transformar({ x: caja.x + caja.width, y: caja.y }),
      transformar({ x: caja.x, y: caja.y + caja.height }),
      transformar({ x: caja.x + caja.width, y: caja.y + caja.height })
    ];
    const minX = Math.min(...esquinasCaja.map((punto) => punto.x)) - limite;
    const maxX = Math.max(...esquinasCaja.map((punto) => punto.x)) + limite;
    const minY = Math.min(...esquinasCaja.map((punto) => punto.y)) - limite;
    const maxY = Math.max(...esquinasCaja.map((punto) => punto.y)) + limite;
    return ajuste.centros.every(({ punto }) =>
      Number.isFinite(punto.x) && Number.isFinite(punto.y) &&
      punto.x >= minX && punto.x <= maxX && punto.y >= minY && punto.y <= maxY
    );
  };
  const esAjusteConfiable = (ajuste: AjusteFiducialesResultado, coberturaMin: number, errorMax: number) => {
    const cobertura = ajuste.puntosDetectados / Math.max(1, ajuste.puntosEsperados);
    return Number.isFinite(ajuste.reprojectionErrorPx) &&
      ajuste.reprojectionErrorPx <= errorMax &&
      cobertura >= coberturaMin &&
      esAjustePlausible(ajuste);
  };
  let ajusteSeleccionado: AjusteFiducialesResultado | null = null;
  let panelDerechoPreferido = false;
  let ajusteRechazadoPorCalidad = false;
  if (ajusteFid && ajustePanelDerecho) {
    const fidConfiable = esAjusteConfiable(ajusteFid, usarSoloFiducialesCompletos ? 1 : 0.5, 7.2);
    const panelConfiable = esAjusteConfiable(ajustePanelDerecho, 0.5, 5.8);
    const panelClaramenteMejor =
      panelConfiable &&
      (!fidConfiable || ajustePanelDerecho.reprojectionErrorPx <= ajusteFid.reprojectionErrorPx + 0.35);
    if (panelClaramenteMejor) {
      ajusteSeleccionado = ajustePanelDerecho;
      panelDerechoPreferido = true;
    } else if (fidConfiable) {
      ajusteSeleccionado = ajusteFid;
    } else if (panelConfiable) {
      ajusteSeleccionado = ajustePanelDerecho;
      panelDerechoPreferido = true;
    } else {
      ajusteRechazadoPorCalidad = true;
    }
  } else if (ajusteFid) {
    if (esAjusteConfiable(ajusteFid, 0.5, 7.2)) ajusteSeleccionado = ajusteFid;
    else ajusteRechazadoPorCalidad = true;
  } else if (ajustePanelDerecho) {
    if (esAjusteConfiable(ajustePanelDerecho, 0.5, 5.8)) {
      ajusteSeleccionado = ajustePanelDerecho;
      panelDerechoPreferido = true;
    } else {
      ajusteRechazadoPorCalidad = true;
    }
  }
  const centrosCaja = !ajusteSeleccionado && !usarSoloFiducialesCompletos
    ? ajustarCentrosPorCaja(
        integral,
        width,
        height,
        centrosBase,
        paramsBurbuja,
        escalaX,
        perfil.boxWidthPts,
        perfil.centerToLeftPts
      )
      : null;
  const centrosGeometricos = centrosCaja ?? ajusteSeleccionado?.centros ?? centrosBase;
  // Una transformación fiducial confiable ya contiene la perspectiva local
  // del panel. Volver a buscar bordes sobre ella puede confundir divisores de
  // reactivos o fondos tintados con los bordes OMR y deformar el paso vertical.
  const ajustarBordesVerticales = esPanelVertical && !ajusteSeleccionado;
  const centrosCajaVertical = ajustarBordesVerticales
    ? ajustarCentrosVerticalPorCaja(
        integral,
        width,
        height,
        centrosGeometricos,
        paramsBurbuja,
        escalaX,
        perfil.boxWidthPts,
        perfil.centerToLeftPts
      )
    : null;
  const centrosCajaVerticalAmplia = ajustarBordesVerticales && !centrosCajaVertical
    ? ajustarCentrosVerticalPorCajaAmplia(
        integral,
        width,
        height,
        centrosGeometricos,
        paramsBurbuja,
        escalaX,
        perfil.boxWidthPts,
        perfil.centerToLeftPts
      )
    : null;
  // En el contrato vertical v4 la separación ya es explícita y los
  // fiduciales/caja aportan la transformación local. La búsqueda adicional
  // de escala/offset optimizada para la fila histórica podía saltar una
  // posición completa cuando una burbuja marcada dominaba la métrica.
  const centros = esPanelVertical
    ? centrosCajaVertical ?? centrosCajaVerticalAmplia ?? centrosGeometricos
    : esPanelHorizontal && permitirBusquedaHorizontal && !ajusteSeleccionado
      ? ajustarCentrosHorizontal(gray, integral, width, height, centrosGeometricos, paramsBurbuja, perfil.vertRange)
      : centrosGeometricos;
  if (!fiduciales) {
    return {
      centros,
      reprojectionErrorPx: null,
      puntosFidDetectados: 0,
      puntosFidEsperados: 0,
      usaRescateCaja: false,
      motivo: 'Sin fiduciales por pregunta'
    };
  }
  if (!ajusteSeleccionado) {
    if (centrosCaja) {
      return {
        centros,
        reprojectionErrorPx: null,
        puntosFidDetectados: 0,
        puntosFidEsperados: 4,
        usaRescateCaja: true,
        motivo: ajusteRechazadoPorCalidad
          ? 'Rescate por caja OMR (fiduciales rechazados por calidad)'
          : 'Rescate por caja OMR (fiduciales no detectados)'
      };
    }
    return {
      centros,
      reprojectionErrorPx: Number.POSITIVE_INFINITY,
      puntosFidDetectados: 0,
      puntosFidEsperados: 4,
      usaRescateCaja: false,
      motivo: 'No se pudieron localizar fiduciales'
    };
  }
  if (panelDerechoPreferido && !ajusteFid) {
    return {
      centros,
      reprojectionErrorPx: ajusteSeleccionado.reprojectionErrorPx,
      puntosFidDetectados: ajusteSeleccionado.puntosDetectados,
      puntosFidEsperados: ajusteSeleccionado.puntosEsperados,
      usaRescateCaja: false,
      motivo: 'Rescate por panel OMR derecho (fiduciales)'
    };
  }
  return {
    centros,
    reprojectionErrorPx: ajusteSeleccionado.reprojectionErrorPx,
    puntosFidDetectados: ajusteSeleccionado.puntosDetectados,
    puntosFidEsperados: ajusteSeleccionado.puntosEsperados,
    usaRescateCaja: false,
    motivo: panelDerechoPreferido ? 'Ajuste por panel OMR derecho (fiduciales preferido)' : undefined
  };
}

function extraerTemplateVersionDesdeQr(qrTexto?: string): TemplateVersion | undefined {
  if (!qrTexto) return undefined;
  if (/:TV4\b/i.test(qrTexto)) return 4;
  return undefined;
}

function calcularMetricasImagen(gray: Uint8ClampedArray, width: number, height: number) {
  const n = Math.max(1, width * height);
  let suma = 0;
  for (let i = 0; i < gray.length; i += 1) suma += gray[i];
  const brilloMedio = suma / n;

  if (width < 3 || height < 3) return { brilloMedio, blurVar: 0 };
  let lapSuma = 0;
  let lapSumaSq = 0;
  let conteo = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = gray[y * width + x];
      const lap =
        gray[y * width + (x - 1)] +
        gray[y * width + (x + 1)] +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] -
        4 * c;
      lapSuma += lap;
      lapSumaSq += lap * lap;
      conteo += 1;
    }
  }
  const mediaLap = lapSuma / Math.max(1, conteo);
  const blurVar = Math.max(0, lapSumaSq / Math.max(1, conteo) - mediaLap * mediaLap);
  return { brilloMedio, blurVar };
}

function mediaSaturacionEnAnillo(
  data: Uint8ClampedArray | undefined,
  width: number,
  height: number,
  center: Punto,
  innerRadius: number,
  outerRadius: number
) {
  if (!data || width <= 0 || height <= 0 || outerRadius <= 0) return 0;
  const left = Math.max(0, Math.floor(center.x - outerRadius));
  const right = Math.min(width - 1, Math.ceil(center.x + outerRadius));
  const top = Math.max(0, Math.floor(center.y - outerRadius));
  const bottom = Math.min(height - 1, Math.ceil(center.y + outerRadius));
  const innerSquared = innerRadius * innerRadius;
  const outerSquared = outerRadius * outerRadius;
  let total = 0;
  let count = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = x - center.x;
      const dy = y - center.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < innerSquared || distanceSquared > outerSquared) continue;
      const index = (y * width + x) * 4;
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const maximum = Math.max(red, green, blue);
      if (maximum < 24) continue;
      const minimum = Math.min(red, green, blue);
      total += (maximum - minimum) / maximum;
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

function construirScoresPorOpcion(args: {
  estado: EstadoImagenOmr;
  centros: Array<{ letra: string; punto: Punto }>;
  scoresEvaluados: Array<{ letra: string; x: number; y: number; score: number }>;
  mejorDx: number;
  mejorDy: number;
  colorData?: Uint8ClampedArray;
  colorWidth?: number;
  colorHeight?: number;
}): ScoreOpcionOmr[] {
  const { estado, centros, scoresEvaluados, mejorDx, mejorDy, colorData, colorWidth, colorHeight } = args;
  const { gray, integral, width, height, paramsBurbuja } = estado;

  return scoresEvaluados
    .map((scoreItem) => {
      const centroBase = centros.find((item) => item.letra === scoreItem.letra);
      const x = scoreItem.x ?? (centroBase ? centroBase.punto.x + mejorDx : 0);
      const y = scoreItem.y ?? (centroBase ? centroBase.punto.y + mejorDy : 0);
      const rasgos = detectarOpcion(gray, integral, width, height, { x, y }, paramsBurbuja);
      const cromaticidadNucleo = mediaSaturacionEnAnillo(
        colorData,
        colorWidth ?? width,
        colorHeight ?? height,
        { x, y },
        0,
        paramsBurbuja.radio * 0.5
      );
      const cromaticidadFondo = mediaSaturacionEnAnillo(
        colorData,
        colorWidth ?? width,
        colorHeight ?? height,
        { x, y },
        paramsBurbuja.radio * 1.1,
        paramsBurbuja.radio * 1.4
      );
      const contrasteCromaticoLocal = cromaticidadNucleo - cromaticidadFondo;
      const centerDarknessDelta = clamp01((rasgos.ringMean - rasgos.centerMean) / 255);
      const nucleusFillRatio = clamp01(rasgos.nucleoFillRatio ?? 0);
      const nucleusDarknessDelta = clamp01(rasgos.nucleoDarknessDelta ?? 0);
      const shapeCompactness = clamp01((1 / Math.max(1, rasgos.anisotropy)) * (1 - Math.min(0.6, rasgos.centroidOffsetRatio)));
      const markConfidence = clamp01(
        scoreItem.score * 1.55 +
          centerDarknessDelta * 0.32 +
          nucleusDarknessDelta * 0.24 +
          nucleusFillRatio * 0.16 +
          rasgos.ratioCore * 0.28 -
          rasgos.ringOnlyPenalty * 0.34 -
          rasgos.centroidOffsetRatio * 0.18
      );
      const gapCentro = rasgos.ringMean - rasgos.centerMean;
      const estadoMarca: ScoreOpcionOmr['estadoMarca'] =
        scoreItem.score >= 0.16 && rasgos.ratioRing >= 0.32 && rasgos.ratioCore < 0.22 && rasgos.anisotropy >= 2.45
          ? 'tachada'
          : (scoreItem.score >= 0.18 && rasgos.ratioCore >= 0.18 && gapCentro >= 16 && rasgos.centroidOffsetRatio <= 0.42) ||
              (scoreItem.score >= 0.14 && rasgos.ratioCore >= 0.26 && gapCentro >= 12) ||
              markConfidence >= 0.72
            ? 'marcada'
            : scoreItem.score >= 0.1 || rasgos.ratioCore >= 0.14 || rasgos.fillDelta >= 0.06
              ? 'parcial'
              : 'no_marcada';

      return {
        opcion: (String(scoreItem.letra ?? '').trim().toUpperCase() || 'A') as OpcionRespuestaOmr,
        score: scoreItem.score,
        fillRatioCore: rasgos.ratioCore,
        fillRatioRing: rasgos.ratioRing,
        fillDelta: rasgos.fillDelta,
        contraste: rasgos.contraste,
        radialMassRatio: rasgos.radialMassRatio,
        centroidOffsetRatio: rasgos.centroidOffsetRatio,
        centerDarknessDelta,
        centerMean: rasgos.centerMean,
        softCoreContrast: rasgos.softCoreContrast,
        softCentroidOffsetRatio: rasgos.softCentroidOffsetRatio,
        ringMean: rasgos.ringMean,
        outerMean: rasgos.outerMean,
        nucleusFillRatio,
        nucleusDarknessDelta,
        contrasteCromaticoLocal,
        margenCromatico: 0,
        strokeLeakPenalty: rasgos.ringOnlyPenalty,
        shapeCompactness,
        markConfidence,
        largestComponentPixels: rasgos.largestComponentPixels,
        largestComponentFillRatio: rasgos.largestComponentFillRatio,
        largestComponentOffsetRatio: rasgos.largestComponentOffsetRatio,
        largestComponentDensity: rasgos.largestComponentDensity,
        largestComponentAspectRatio: rasgos.largestComponentAspectRatio,
        estadoMarca
      };
    })
    .filter((item) => ['A', 'B', 'C', 'D', 'E'].includes(item.opcion))
    .map((item, _, items) => ({
      ...item,
      margenCromatico: item.contrasteCromaticoLocal! - Math.max(
        0,
        ...items.filter((otra) => otra.opcion !== item.opcion).map((otra) => otra.contrasteCromaticoLocal ?? 0)
      )
    }))
    .sort((a, b) => b.score - a.score);
}

async function leerQrDetalleDesdeImagenConRealceFinal(
  imagenBase64: string,
  permitirRealceFinal: boolean
): Promise<QrDetalle | null> {
  const { data, gray, width, height, buffer } = await decodificarImagen(imagenBase64);
  let qr = detectarQrMejorado(data, gray, width, height, {
    qrSizePts: QR_MATRIZ_SIZE_PTS,
    anchoCarta: ANCHO_CARTA
  });
  if (!qr) {
    const realzado = await detectarQrEnImagenRealzada(data, width, height);
    if (realzado) qr = { ...realzado, fuenteDeteccionQr: 'preprocesado' };
  }
  if (!qr) {
    const nativo = await detectarQrEnResolucionFuente(buffer);
    if (nativo) qr = { ...nativo, fuenteDeteccionQr: 'resolucion_fuente' };
  }
  if (!qr) qr = await detectarQrConRotacionPagina(data, width, height);
  if (!qr && permitirRealceFinal) {
    const metadataEntrada = await sharp(buffer).metadata();
    const anchoFuente = Number(metadataEntrada.width ?? 0);
    const altoFuente = Number(metadataEntrada.height ?? 0);
    // Un realce completo cuesta más que las ROI anteriores. Limitarlo a
    // fuentes pequeñas, donde una ligera expansión de bordes recupera módulos
    // QR submuestreados sin ampliar el costo de las capturas de alta resolución.
    if (anchoFuente > 0 && altoFuente > 0 && Math.max(anchoFuente, altoFuente) <= 1600) {
      const imagenRealzada = await sharp(buffer)
        .rotate()
        .sharpen({ sigma: 0.8 })
        .png()
        .toBuffer();
      const qrRealzado = await leerQrDetalleDesdeImagenConRealceFinal(
        `data:image/png;base64,${imagenRealzada.toString('base64')}`,
        false
      );
      if (qrRealzado) return { ...qrRealzado, fuenteDeteccionQr: 'preprocesado' };
    }
  }
  return qr;
}

export async function leerQrDetalleDesdeImagen(imagenBase64: string): Promise<QrDetalle | null> {
  return leerQrDetalleDesdeImagenConRealceFinal(imagenBase64, true);
}

export async function leerQrDesdeImagen(imagenBase64: string): Promise<string | undefined> {
  return (await leerQrDetalleDesdeImagen(imagenBase64))?.data;
}

function puntajeEstado(estado: ResultadoOmr['estadoAnalisis']) {
  if (estado === 'ok') return 3;
  if (estado === 'requiere_revision') return 2;
  return 1;
}

function puntuarResultadoOmr(resultado: ResultadoOmr) {
  const total = Math.max(1, resultado.respuestasDetectadas.length);
  const contestadas = resultado.respuestasDetectadas.filter((r) => Boolean(r.opcion)).length;
  const cobertura = contestadas / total;
  return (
    puntajeEstado(resultado.estadoAnalisis) * 2 +
    resultado.calidadPagina * 1.1 +
    resultado.confianzaPromedioPagina * 0.9 +
    (1 - resultado.ratioAmbiguas) * 0.8 +
    cobertura * 0.7
  );
}

function debeIntentarSegundoPase(resultado: ResultadoOmr) {
  if (!OMR_SECOND_PASS_ENABLED) return false;
  const cobertura = resultado.respuestasDetectadas.length > 0
    ? resultado.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length /
      resultado.respuestasDetectadas.length
    : 0;
  if (cobertura < 0.75) return true;
  if (resultado.respuestasDetectadas.some(tieneIntentoParcialPendienteOmr)) return true;
  if (
    resultado.estadoAnalisis === 'ok' &&
    !resultado.respuestasDetectadas.some((respuesta) => respuesta.opcion == null)
  ) return false;
  if (resultado.geomQuality < 0.52) return false;
  if (resultado.ratioAmbiguas > OMR_AUTO_AMBIGUAS_MAX) return true;
  if (resultado.calidadPagina <= OMR_SECOND_PASS_QUALITY_MAX) return true;
  if (resultado.confianzaPromedioPagina <= OMR_SECOND_PASS_CONF_MAX) return true;
  if (resultado.motivosRevision.some((m) => /alineacion global inestable/i.test(m))) return true;
  // Una página puede terminar en estado `ok` por no contener dobles marcas y
  // aun así dejar reactivos sin letra. Ejecutar una segunda hipótesis en ese
  // caso permite rescatar tinta tenue; la fusión monotónica inferior garantiza
  // que nunca se reemplace una lectura válida por una pasada de menor cobertura.
  if (
    resultado.estadoAnalisis === 'ok' &&
    resultado.respuestasDetectadas.some((respuesta) => respuesta.opcion == null)
  ) return true;
  return false;
}

export function tieneIntentoParcialPendienteOmr(
  respuesta: Pick<RespuestaDetectadaOmr, 'opcion' | 'flags'>
) {
  return respuesta.opcion == null && respuesta.flags.includes('parcial_detectada');
}

/**
 * Evita convertir el contorno impreso o ruido tenue en una letra calificable.
 * La señal se conserva para revisión como parcial; el contraste cromático
 * localizado puede rescatar marcas suaves de color cuando supera el fondo.
 */
export function debeAbstenerseMarcaParcialOmr(
  score: Pick<ScoreOpcionOmr, 'score' | 'fillRatioCore' | 'shapeCompactness' | 'centerDarknessDelta' | 'contrasteCromaticoLocal' | 'margenCromatico' | 'centroidOffsetRatio' | 'softCoreContrast'> & {
    markConfidence?: number;
    permitirConfianzaMarcada?: boolean;
    fillCoreMargin?: number;
    fillCoreCompetitorScore?: number;
  }
) {
  if (
    score.centerDarknessDelta >= 0.16 ||
    (score.permitirConfianzaMarcada === true && (
      ((score.markConfidence ?? 0) >= 0.72 && score.shapeCompactness >= 0.35) ||
      ((score.fillCoreMargin ?? 0) >= 0.08 &&
        (score.fillCoreCompetitorScore ?? 1) <= 0.08 &&
        score.score >= 0.18 &&
        score.fillRatioCore >= 0.18 &&
        (score.markConfidence ?? 0) >= 0.1 &&
        score.shapeCompactness >= 0.15 &&
        score.centroidOffsetRatio <= 0.6 &&
        score.softCoreContrast >= 0.06)
    )) ||
    (score.score >= 0.45 && score.fillRatioCore >= 0.75 && score.shapeCompactness >= 0.65)
  ) return false;
  return !(
    (score.contrasteCromaticoLocal ?? 0) >= 0.08 &&
    (score.margenCromatico ?? 0) >= 0.04
  );
}

export function debeEvaluarConsensoHomografiaEscalaOmr(resultado: Pick<ResultadoOmr,
  'qrTexto' | 'geometryMode' | 'geometryReferencePoints' | 'geometryReferenceQuality' | 'respuestasDetectadas'
>) {
  if (
    resultado.qrTexto ||
    resultado.geometryMode !== 'escala' ||
    (resultado.geometryReferencePoints ?? 0) < 4 ||
    (resultado.geometryReferenceQuality ?? 0) < 0.9
  ) return false;
  return resultado.respuestasDetectadas.some((respuesta) =>
    respuesta.opcion == null && (
      respuesta.flags.includes('doble_marca') ||
      respuesta.flags.includes('parcial_detectada') ||
      tieneDominanteFuertePendienteOmr(respuesta)
    )
  );
}

export function debeEvaluarRescateAltaResolucionGeometriaLocalOmr(resultado: Pick<ResultadoOmr,
  'qrTexto' | 'geometryMode' | 'geometryReferencePoints' | 'geometryReferenceQuality' |
  'geometryLocalEnabled' | 'resumenRespuestas' | 'respuestasDetectadas'
>) {
  if (
    resultado.qrTexto ||
    resultado.geometryMode !== 'escala' ||
    !resultado.geometryLocalEnabled ||
    (resultado.geometryReferencePoints ?? 0) < 4 ||
    (resultado.geometryReferenceQuality ?? 0) < 0.9 ||
    resultado.resumenRespuestas?.examenVacio === true
  ) return false;
  return resultado.respuestasDetectadas.some((respuesta) =>
    respuesta.opcion == null && (
      respuesta.flags.includes('doble_marca') ||
      respuesta.flags.includes('parcial_detectada') ||
      tieneDominanteFuertePendienteOmr(respuesta)
    )
  );
}

export function aplicarAbstencionPorOrientacionOmr(resultado: ResultadoOmr): ResultadoOmr {
  if (resultado.pageOrientationDetermined === true && !resultado.pageOrientationConflict) return resultado;
  const conflicto = resultado.pageOrientationConflict === true;
  // Una orientación ausente no invalida la evidencia fotométrica ya calculada;
  // solo impide usarla para autocalificar. Conservar las candidatas permite que
  // la revisión manual vea la lectura OMR y detecte blancos, dobles y
  // tachaduras. Un conflicto explícito sí anula las letras porque hay dos
  // referencias geométricas incompatibles.
  const respuestasDetectadas = conflicto
    ? resultado.respuestasDetectadas.map((respuesta) => ({
        ...respuesta,
        opcion: null,
        confianza: 0,
        estadoRespuesta: 'ambigua' as const
      }))
    : resultado.respuestasDetectadas;
  const motivo = conflicto
    ? 'Orientación de página contradictoria: abstención de respuestas'
    : 'Orientación de página no demostrada: detecciones conservadas solo para revisión';
  const advertencia = conflicto
    ? 'No se conservan letras OMR cuando las referencias de orientación se contradicen'
    : 'Se conservan candidatas OMR para revisión, pero la página no es autocalificable sin orientación verificada';
  return {
    ...resultado,
    respuestasDetectadas,
    estadoAnalisis: resultado.estadoAnalisis === 'rechazado_calidad' ? 'rechazado_calidad' : 'requiere_revision',
    motivosRevision: Array.from(new Set([...resultado.motivosRevision, motivo])).slice(0, 24),
    advertencias: Array.from(new Set([...resultado.advertencias, advertencia])),
    resumenRespuestas: resumirRespuestasOmr(
      respuestasDetectadas,
      resultado.calidadPagina,
      resultado.geomQuality,
      { forzarRevision: conflicto }
    )
  };
}

function obtenerCandidataCompactaOmr(respuesta: RespuestaDetectadaOmr) {
  const scores = [...respuesta.scoresPorOpcion].sort((a, b) => b.score - a.score);
  const dominante = scores[0];
  const segunda = scores[1];
  if (!dominante) return null;
  const aceptable = debeAceptarCandidataCompactaOmr({
    scoreDominante: dominante.score,
    scoreSegundo: segunda?.score ?? 0,
    nucleoDominante: dominante.fillRatioCore,
    nucleoSegundo: segunda?.fillRatioCore ?? 0,
    contrasteDominante: dominante.contraste,
    compacidadDominante: dominante.shapeCompactness,
    compacidadSegunda: segunda?.shapeCompactness ?? 0,
    confianzaDominante: dominante.markConfidence
  });
  return aceptable ? dominante : null;
}

function obtenerCandidataFuerteOmr(respuesta: RespuestaDetectadaOmr) {
  const scores = [...respuesta.scoresPorOpcion].sort((a, b) => b.score - a.score);
  const dominante = scores[0];
  const segunda = scores[1];
  if (!dominante || respuesta.flags.includes('tachada_detectada')) return null;
  const aceptable = debeAceptarCandidataFuerteOmr({
    scoreDominante: dominante.score,
    scoreSegundo: segunda?.score ?? 0,
    fillRatioCore: dominante.fillRatioCore,
    contrasteDominante: dominante.contraste,
    masaRadial: dominante.radialMassRatio,
    desplazamientoCentro: dominante.centroidOffsetRatio,
    compacidadDominante: dominante.shapeCompactness,
    confianzaDominante: dominante.markConfidence
  });
  return aceptable ? dominante : null;
}

function rescatarCandidataFuerteEntrePasadas(
  principal: RespuestaDetectadaOmr,
  secundaria: RespuestaDetectadaOmr
) {
  const candidatas = [principal, secundaria]
    .map((respuesta) => ({ respuesta, candidata: obtenerCandidataFuerteOmr(respuesta) }))
    .filter((item): item is { respuesta: RespuestaDetectadaOmr; candidata: ScoreOpcionOmr } => Boolean(item.candidata));
  if (candidatas.length === 0) return null;
  const letras = new Set(candidatas.map((item) => item.candidata.opcion));
  if (letras.size > 1) return null;
  return candidatas.sort((a, b) => b.candidata.markConfidence - a.candidata.markConfidence)[0];
}

function rescatarCandidataCompactaEntrePasadas(
  principal: RespuestaDetectadaOmr,
  secundaria: RespuestaDetectadaOmr
) {
  const candidatas = [principal, secundaria]
    .map((respuesta) => ({ respuesta, candidata: obtenerCandidataCompactaOmr(respuesta) }))
    .filter((item): item is { respuesta: RespuestaDetectadaOmr; candidata: ScoreOpcionOmr } => Boolean(item.candidata));
  if (candidatas.length === 0) return null;
  const letras = new Set(candidatas.map((item) => item.candidata.opcion));
  if (letras.size > 1) return null;
  const mejor = candidatas.sort((a, b) => b.candidata.markConfidence - a.candidata.markConfidence)[0];
  return mejor;
}

function esRespuestaAmbiguaOmr(respuesta: Pick<RespuestaDetectadaOmr, 'opcion' | 'flags'>) {
  // Un blanco legítimo no es una ambigüedad. Solo se contabilizan como
  // ambiguas las respuestas sin letra que tienen evidencia de interferencia,
  // contraste insuficiente o geometría inválida.
  return respuesta.opcion == null && respuesta.flags.length > 0;
}

function fusionarResultadosOmr(
  base: ResultadoOmr,
  rescate: ResultadoOmr,
  pasadasAdicionales: readonly ResultadoOmr[] = []
): ResultadoOmr {
  const baseMejor = puntuarResultadoOmr(base) >= puntuarResultadoOmr(rescate);
  const principal = baseMejor ? base : rescate;
  const secundario = baseMejor ? rescate : base;

  const mapaSec = new Map(secundario.respuestasDetectadas.map((r) => [r.numeroPregunta, r]));
  const respuestasDetectadas = principal.respuestasDetectadas.map((rPrincipal) => {
    const rSec = mapaSec.get(rPrincipal.numeroPregunta);
    if (!rSec) return rPrincipal;
    const fusion = fusionarRespuestaOmrV2(rPrincipal, rSec);
    const pasadasPregunta = [base, rescate, ...pasadasAdicionales]
      .map((resultado) => resultado.respuestasDetectadas.find((respuesta) => respuesta.numeroPregunta === rPrincipal.numeroPregunta))
      .filter((respuesta): respuesta is RespuestaDetectadaOmr => Boolean(respuesta));
    const candidataEstable = rescatarCandidataEstableEntrePasadas(pasadasPregunta);
    if (
      candidataEstable &&
      (fusion.opcion == null || fusion.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada'))
    ) {
      const opcionEstable = candidataEstable.opcion as RespuestaDetectadaOmr['opcion'];
      const flagsEstables = fusion.flags.filter(
        (flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'
      ) as RespuestaDetectadaOmr['flags'];
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: opcionEstable,
        // La estabilidad entre dos pasadas independientes es la evidencia
        // adicional que permite atravesar el umbral del rescate aditivo. La
        // marca sigue llevando `bajo_contraste` y la página puede continuar
        // en revisión; no se convierte en una respuesta de alta confianza.
        confianza: Math.max(0.66, candidataEstable.fuerza * 0.88),
        scoresPorOpcion: candidataEstable.evidencia.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
        flags: Array.from(new Set([...flagsEstables, 'bajo_contraste'])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    const candidataEtiquetadaDebil = rescatarCandidataEtiquetadaDebilEntrePasadas(pasadasPregunta);
    if (
      candidataEtiquetadaDebil &&
      fusion.opcion == null &&
      !fusion.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')
    ) {
      const opcionDebil = candidataEtiquetadaDebil.opcion as RespuestaDetectadaOmr['opcion'];
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: opcionDebil,
        confianza: Math.max(0.42, candidataEtiquetadaDebil.fuerza * 0.9),
        scoresPorOpcion: candidataEtiquetadaDebil.evidencia.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
        flags: Array.from(new Set([...fusion.flags, 'bajo_contraste'])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    const candidataEtiquetadaRepetida = rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas(pasadasPregunta);
    if (
      candidataEtiquetadaRepetida &&
      (fusion.opcion == null || fusion.opcion === candidataEtiquetadaRepetida.opcion)
    ) {
      const opcionRepetida = candidataEtiquetadaRepetida.opcion as RespuestaDetectadaOmr['opcion'];
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: opcionRepetida,
        // Dos pasadas limpias coincidentes, con una pasada invalidante cuyo
        // maximo es otra opcion, son evidencia suficiente para entrar en la
        // ruta de rescate aditivo; se conserva la bandera de bajo contraste.
        confianza: Math.max(0.66, candidataEtiquetadaRepetida.fuerza * 0.88),
        scoresPorOpcion: candidataEtiquetadaRepetida.evidencia.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
        flags: Array.from(new Set([
          ...fusion.flags.filter((flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'),
          'bajo_contraste'
        ])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    const rescateFuerte =
      (fusion.opcion == null || fusion.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada'))
        ? rescatarCandidataFuerteEntrePasadas(rPrincipal, rSec)
        : null;
    if (rescateFuerte) {
      const opcionFuerte = rescateFuerte.candidata.opcion as RespuestaDetectadaOmr['opcion'];
      const flagsFuertes = fusion.flags.filter(
        (flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'
      ) as RespuestaDetectadaOmr['flags'];
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: opcionFuerte,
        confianza: Math.max(0.65, rescateFuerte.candidata.markConfidence * 0.82),
        scoresPorOpcion: rescateFuerte.respuesta.scoresPorOpcion,
        flags: Array.from(new Set([...flagsFuertes, 'bajo_contraste'])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    const rescateCompacto =
      (fusion.opcion == null || fusion.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada'))
        ? rescatarCandidataCompactaEntrePasadas(rPrincipal, rSec)
        : null;
    if (rescateCompacto) {
      const opcionCompacta = rescateCompacto.candidata.opcion as RespuestaDetectadaOmr['opcion'];
      const flagsCompactos = fusion.flags.filter(
        (flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'
      ) as RespuestaDetectadaOmr['flags'];
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: opcionCompacta,
        confianza: Math.max(0.7, rescateCompacto.candidata.markConfidence * 0.86),
        scoresPorOpcion: rescateCompacto.respuesta.scoresPorOpcion,
        flags: Array.from(new Set([...flagsCompactos, 'bajo_contraste'])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    return {
      numeroPregunta: rPrincipal.numeroPregunta,
      opcion: fusion.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')
        ? null
        : fusion.opcion as RespuestaDetectadaOmr['opcion'],
      confianza: fusion.confianza,
      scoresPorOpcion: fusion.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
      flags: fusion.flags as RespuestaDetectadaOmr['flags'],
      estadoRespuesta: clasificarEstadoRespuestaOmr({
        opcion: fusion.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada') ? null : fusion.opcion,
        flags: fusion.flags
      })
    };
  });

  const sumaConf = respuestasDetectadas.reduce((acc, r) => acc + Math.max(0, r.confianza), 0);
  const total = Math.max(1, respuestasDetectadas.length);
  const ambiguas = respuestasDetectadas.filter(esRespuestaAmbiguaOmr).length;
  const respuestasAnalizadas = respuestasDetectadas.length - ambiguas;
  const confianzaPromedioPagina = sumaConf / total;
  const ratioAmbiguas = ambiguas / total;

  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina: Math.max(base.calidadPagina, rescate.calidadPagina),
    confianzaMedia: confianzaPromedioPagina,
    ratioAmbiguas,
    totalRespuestas: respuestasDetectadas.length,
    respuestasAnalizadas,
    geometriaConfiable: ![base, rescate].some((resultado) =>
      resultado.motivosRevision.some((motivo) => /referencia global|referencia de página/i.test(motivo))
    )
  });

  const advertencias = Array.from(new Set([...base.advertencias, ...rescate.advertencias]));
  const motivosRevision = Array.from(
    new Set([
      ...base.motivosRevision,
      ...rescate.motivosRevision,
      ...decisionEstado.motivos,
      'Segundo pase OMR aplicado por baja calidad/inestabilidad'
    ])
  ).slice(0, 24);

  return {
    respuestasDetectadas,
    advertencias,
    qrTexto: principal.qrTexto ?? secundario.qrTexto,
    qrFuenteDeteccion: principal.qrFuenteDeteccion ?? secundario.qrFuenteDeteccion,
    calidadPagina: Math.max(base.calidadPagina, rescate.calidadPagina),
    estadoAnalisis: decisionEstado.estado,
    motivosRevision,
    templateVersionDetectada: principal.templateVersionDetectada,
    confianzaPromedioPagina,
    ratioAmbiguas,
    resumenRespuestas: resumirRespuestasOmr(
      respuestasDetectadas,
      Math.max(base.calidadPagina, rescate.calidadPagina),
      Math.max(base.geomQuality, rescate.geomQuality)
    ),
    engineVersion: principal.engineVersion,
    engineRelease: OMR_ENGINE_RELEASE,
    geomQuality: Math.max(base.geomQuality, rescate.geomQuality),
    photoQuality: Math.max(base.photoQuality, rescate.photoQuality),
    decisionPolicy: 'conservadora_v2',
    geometryMode: principal.geometryMode,
    geometryReferencePoints: Math.max(base.geometryReferencePoints ?? 0, rescate.geometryReferencePoints ?? 0),
    geometryReferenceQuality: Math.max(base.geometryReferenceQuality ?? 0, rescate.geometryReferenceQuality ?? 0),
    pageRotationDegrees: principal.pageRotationDegrees ?? secundario.pageRotationDegrees,
    pageSkewDegrees: principal.pageSkewDegrees ?? secundario.pageSkewDegrees,
    geometryLocalEnabled: Boolean(base.geometryLocalEnabled || rescate.geometryLocalEnabled),
    orientationMode: principal.orientationMode ?? secundario.orientationMode
  };
}

export function debeAceptarConsensoGeometriaAlternaOmr(
  homografia: RespuestaDetectadaOmr,
  escala: RespuestaDetectadaOmr
) {
  if (
    homografia.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada') ||
    escala.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')
  ) return false;

  // La homografía también puede recuperar una marca pequeña que la escala no
  // localiza. Solo se admite para una abstención de escala y con evidencia
  // espacial/fotométrica aislada; las respuestas ya determinadas nunca se
  // sustituyen y las páginas vacías no llegan a esta ruta de rescate.
  if (homografia.opcion != null && escala.opcion == null) {
    const [dominante, segunda] = [...homografia.scoresPorOpcion].sort((a, b) => b.score - a.score);
    return Boolean(
      dominante &&
      dominante.opcion === homografia.opcion &&
      homografia.confianza >= 0.4 &&
      dominante.score >= 0.001 &&
      dominante.fillRatioCore >= 0.18 &&
      dominante.contraste >= 0.025 &&
      dominante.softCoreContrast >= 0.1 &&
      dominante.radialMassRatio >= 0.45 &&
      dominante.centroidOffsetRatio <= 0.28 &&
      dominante.shapeCompactness >= 0.18 &&
      (segunda?.score ?? 0) <= 0.01 &&
      (segunda?.fillRatioCore ?? 0) <= 0.08
    );
  }

  if (
    homografia.opcion != null ||
    escala.opcion == null ||
    !debeAceptarRescateAltaResolucionOmr(escala)
  ) return false;
  const [dominante, segunda] = [...homografia.scoresPorOpcion].sort((a, b) => b.score - a.score);
  return Boolean(
    dominante &&
    dominante.opcion === escala.opcion &&
    dominante.score >= 0.3 &&
    dominante.score - (segunda?.score ?? 0) >= 0.06 &&
    dominante.markConfidence >= 0.75 &&
    dominante.fillRatioCore >= 0.45 &&
    dominante.contraste >= 0.08 &&
    dominante.centroidOffsetRatio <= 0.32 &&
    (segunda?.markConfidence ?? 0) <= 0.66 &&
    (segunda?.fillRatioCore ?? 0) <= 0.42 &&
    (segunda?.nucleusFillRatio ?? 0) <= 0.45 &&
    (segunda?.shapeCompactness ?? 0) <= 0.42
  );
}

export function combinarRespuestasOmrSinPerderDeterminadas(
  base: readonly RespuestaDetectadaOmr[],
  rescate: readonly RespuestaDetectadaOmr[],
  altaResolucion: readonly RespuestaDetectadaOmr[] = [],
  preguntasPanelHorizontal: ReadonlySet<number> = new Set(),
  escalaAlterna: readonly RespuestaDetectadaOmr[] = [],
  protegerDeterminadas = false
) {
  const rescatePorPregunta = new Map(rescate.map((respuesta) => [respuesta.numeroPregunta, respuesta]));
  const altaResolucionPorPregunta = new Map(altaResolucion.map((respuesta) => [respuesta.numeroPregunta, respuesta]));
  const escalaAlternaPorPregunta = new Map(escalaAlterna.map((respuesta) => [respuesta.numeroPregunta, respuesta]));
  return base.map((respuesta) => {
    const alternativa = rescatePorPregunta.get(respuesta.numeroPregunta);
    const candidataAltaResolucion = altaResolucionPorPregunta.get(respuesta.numeroPregunta);
    const candidataEscalaAlterna = escalaAlternaPorPregunta.get(respuesta.numeroPregunta);
    if (protegerDeterminadas && respuesta.opcion != null) return respuesta;
    const candidataEstable = rescatarCandidataEstableEntrePasadas(
      [respuesta, alternativa, candidataAltaResolucion].filter(
        (item): item is RespuestaDetectadaOmr => Boolean(item)
      )
    );
    const candidataEtiquetadaRepetida = rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas(
      [respuesta, alternativa, candidataAltaResolucion].filter(
        (item): item is RespuestaDetectadaOmr => Boolean(item)
      )
    );
    // Una letra previa no es un ancla fuerte si procede de una pasada con
    // contraste bajo/parcial y contradice dos pasadas limpias posteriores.
    // Las respuestas fuertes y las dobles confirmadas siguen siendo
    // monotónicas/conservadoras.
    if (
      candidataEtiquetadaRepetida &&
      candidataEtiquetadaRepetida.opcion !== respuesta.opcion &&
      respuesta.confianza <= 0.75 &&
      !respuesta.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada') &&
      respuesta.flags.some((flag) => flag === 'bajo_contraste' || flag === 'parcial_detectada')
    ) {
      return {
        ...candidataEtiquetadaRepetida.evidencia,
        numeroPregunta: respuesta.numeroPregunta,
        opcion: candidataEtiquetadaRepetida.opcion as RespuestaDetectadaOmr['opcion'],
        confianza: Math.max(0.66, candidataEtiquetadaRepetida.fuerza * 0.88),
        scoresPorOpcion: candidataEtiquetadaRepetida.evidencia.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
        flags: Array.from(new Set([
          ...respuesta.flags.filter((flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'),
          ...candidataEtiquetadaRepetida.evidencia.flags,
          'bajo_contraste' as const
        ])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    // Una respuesta previa con parcial/bajo contraste no es una ancla fuerte.
    // Si dos pasadas independientes coinciden en otra letra, permitir el
    // reemplazo evita que el guard monotónico conserve una lectura desplazada
    // aunque el pase de rescate haya localizado la burbuja real. Las dobles y
    // tachaduras nunca entran como candidatas estables.
    if (
      respuesta.opcion != null &&
      candidataEstable &&
      candidataEstable.opcion !== respuesta.opcion &&
      candidataEstable.repeticiones >= 2 &&
      candidataEstable.fuerza >= 0.28 &&
      respuesta.confianza <= 0.75 &&
      respuesta.flags.some((flag) => flag === 'bajo_contraste' || flag === 'parcial_detectada')
    ) {
      return {
        ...candidataEstable.evidencia,
        numeroPregunta: respuesta.numeroPregunta,
        opcion: candidataEstable.opcion as RespuestaDetectadaOmr['opcion'],
        confianza: Math.max(0.66, candidataEstable.fuerza * 0.88),
        scoresPorOpcion: candidataEstable.evidencia.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
        flags: Array.from(new Set([
          ...respuesta.flags,
          ...candidataEstable.evidencia.flags,
          'bajo_contraste' as const
        ])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    if (respuesta.opcion != null) return respuesta;
    const rescateConfiable = Boolean(
      alternativa?.opcion != null &&
      alternativa.confianza >= 0.65 &&
      !alternativa.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')
    );
    if (rescateConfiable && alternativa) return alternativa;
    if (candidataAltaResolucion && debeAceptarRescateAltaResolucionOmr(candidataAltaResolucion)) {
      return candidataAltaResolucion;
    }
    if (
      candidataAltaResolucion &&
      candidataEscalaAlterna &&
      debeAceptarConsensoGeometriaAlternaOmr(candidataAltaResolucion, candidataEscalaAlterna)
    ) {
      const dominanteHomografica = [...candidataAltaResolucion.scoresPorOpcion]
        .sort((a, b) => b.score - a.score)[0];
      const candidataElegida = candidataEscalaAlterna.opcion == null
        ? candidataAltaResolucion
        : candidataEscalaAlterna;
      return {
        ...candidataElegida,
        numeroPregunta: respuesta.numeroPregunta,
        confianza: candidataEscalaAlterna.opcion == null
          ? candidataAltaResolucion.confianza
          : Math.min(candidataEscalaAlterna.confianza, dominanteHomografica?.markConfidence ?? candidataEscalaAlterna.confianza),
        flags: Array.from(new Set([
          ...respuesta.flags.filter((flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'),
          ...candidataAltaResolucion.flags.filter((flag) => flag !== 'doble_marca' && flag !== 'tachada_detectada'),
          ...candidataEscalaAlterna.flags,
          'bajo_contraste' as const
        ])) as RespuestaDetectadaOmr['flags'],
        estadoRespuesta: 'respondida' as const
      };
    }
    if (respuesta.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')) return respuesta;
    const candidataPorRasgos = preguntasPanelHorizontal.has(respuesta.numeroPregunta)
      ? rescatarMarcaAisladaPorRasgosOmr({
          panelHorizontal: true,
          dobleMarcada: false,
          tachada: false,
          scores: respuesta.scoresPorOpcion
        })
      : null;
    return candidataPorRasgos
      ? {
          ...respuesta,
          opcion: candidataPorRasgos.opcion,
          confianza: Math.max(0.42, candidataPorRasgos.markConfidence),
          estadoRespuesta: 'respondida' as const,
          flags: Array.from(new Set([...respuesta.flags, 'bajo_contraste' as const]))
        }
      : respuesta;
  });
}

/**
 * Promueve una marca tenue solo cuando el mismo núcleo localizado aparece en
 * al menos dos pasadas OMR distintas. La clave y las etiquetas externas no
 * participan en esta decisión; las respuestas ya emitidas quedan intactas.
 */
export function rescatarMarcaTenueConsensuadaEntrePasadasOmr(
  resultado: ResultadoOmr,
  pasadas: readonly (readonly RespuestaDetectadaOmr[])[],
  mapaPagina: MapaOmrPagina
): ResultadoOmr {
  if (
    resultado.qrTexto ||
    resultado.geometryMode !== 'escala' ||
    !resultado.geometryLocalEnabled ||
    (resultado.geometryReferencePoints ?? 0) < 4 ||
    (resultado.geometryReferenceQuality ?? 0) < 0.9 ||
    resultado.resumenRespuestas?.examenVacio === true
  ) return resultado;

  const preguntasHorizontales = new Set(
    (mapaPagina.preguntas ?? [])
      .filter((pregunta) => {
        const xs = pregunta.opciones.map((opcion) => Number(opcion.x));
        const ys = pregunta.opciones.map((opcion) => Number(opcion.y));
        if (xs.length < 2 || ys.length < 2 || [...xs, ...ys].some((value) => !Number.isFinite(value))) return false;
        const rangoX = Math.max(...xs) - Math.min(...xs);
        const rangoY = Math.max(...ys) - Math.min(...ys);
        return rangoY <= Math.max(12, rangoX * 1.5);
      })
      .map((pregunta) => pregunta.numeroPregunta)
  );

  let cambios = 0;
  const respuestasDetectadas = resultado.respuestasDetectadas.map((respuesta) => {
    if (
      respuesta.opcion != null ||
      !preguntasHorizontales.has(respuesta.numeroPregunta) ||
      respuesta.flags.some((flag) => flag === 'tachada_detectada' || flag === 'fuera_roi')
    ) return respuesta;

    const votos = new Map<OpcionRespuestaOmr, ScoreOpcionOmr[]>();
    const opcionesDeterminadas = new Set<OpcionRespuestaOmr>();
    let pasadasInvalidantes = 0;
    for (const pasada of pasadas) {
      const evidencia = pasada.find((item) => item.numeroPregunta === respuesta.numeroPregunta);
      if (!evidencia) continue;
      if (evidencia.opcion != null) {
        opcionesDeterminadas.add(evidencia.opcion);
        continue;
      }
      if (evidencia.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada' || flag === 'fuera_roi')) {
        pasadasInvalidantes += 1;
        continue;
      }
      const proxy = (item: ScoreOpcionOmr) =>
        item.fillRatioCore * 0.4 +
        item.contraste * 0.25 +
        item.nucleusFillRatio * 0.18 +
        item.shapeCompactness * 0.1 +
        item.radialMassRatio * 0.07;
      const [candidata, segunda] = [...evidencia.scoresPorOpcion].sort(
        (a, b) => proxy(b) - proxy(a) || a.opcion.localeCompare(b.opcion)
      );
      if (!candidata ||
        candidata.score < 0.02 ||
        candidata.fillRatioCore < 0.18 ||
        candidata.nucleusFillRatio < 0.18 ||
        candidata.softCoreContrast < 0.08 ||
        candidata.softCentroidOffsetRatio > 0.42 ||
        candidata.shapeCompactness < 0.12 ||
        candidata.radialMassRatio < 0.15 ||
        candidata.strokeLeakPenalty > 0.18 ||
        proxy(candidata) - proxy(segunda) < 0.1
      ) continue;
      const previas = votos.get(candidata.opcion) ?? [];
      previas.push(candidata);
      votos.set(candidata.opcion, previas);
    }

    if (OMR_DEBUG) {
      const resumenVotos = [...votos.entries()].map(([opcion, evidencias]) => `${opcion}:${evidencias.length}`).join(',') || 'ninguno';
      console.error(`[omr-consenso-tenue] Q${respuesta.numeroPregunta} votos=${resumenVotos} invalidantes=${pasadasInvalidantes} determinadas=${[...opcionesDeterminadas].join(',') || 'ninguna'}`);
    }
    if (votos.size !== 1) return respuesta;
    const [opcion, evidencias] = [...votos.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    if (
      pasadasInvalidantes >= 2 ||
      !opcion ||
      !evidencias ||
      evidencias.length < 2 ||
      (opcionesDeterminadas.size > 0 && (opcionesDeterminadas.size > 1 || !opcionesDeterminadas.has(opcion)))
    ) return respuesta;
    cambios += 1;
    return {
      ...respuesta,
      opcion,
      confianza: 0.72,
      estadoRespuesta: 'respondida' as const,
      flags: respuesta.flags.filter((flag) => flag !== 'bajo_contraste' && flag !== 'parcial_detectada')
    };
  });

  if (cambios === 0) return resultado;
  const ambiguas = respuestasDetectadas.filter(esRespuestaAmbiguaOmr).length;
  const confianzaPromedioPagina = respuestasDetectadas.length > 0
    ? respuestasDetectadas.reduce((suma, respuesta) => suma + Math.max(0, respuesta.confianza), 0) / respuestasDetectadas.length
    : 0;
  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina: resultado.calidadPagina,
    confianzaMedia: confianzaPromedioPagina,
    ratioAmbiguas: respuestasDetectadas.length > 0 ? ambiguas / respuestasDetectadas.length : 1,
    totalRespuestas: respuestasDetectadas.length,
    respuestasAnalizadas: respuestasDetectadas.length - ambiguas,
    geometriaConfiable: resultado.geomQuality >= 0.52
  });
  return {
    ...resultado,
    respuestasDetectadas,
    confianzaPromedioPagina,
    ratioAmbiguas: respuestasDetectadas.length > 0 ? ambiguas / respuestasDetectadas.length : 1,
    estadoAnalisis: decisionEstado.estado,
    motivosRevision: Array.from(new Set([...resultado.motivosRevision, ...decisionEstado.motivos])).slice(0, 24),
    advertencias: Array.from(new Set([
      ...resultado.advertencias,
      `${cambios} marca(s) tenue(s) confirmada(s) por rasgos localizados repetidos entre pasadas`
    ])),
    resumenRespuestas: resumirRespuestasOmr(
      respuestasDetectadas,
      resultado.calidadPagina,
      resultado.geomQuality,
      { forzarRevision: decisionEstado.anularRespuestas }
    )
  };
}

export function debeAceptarRescateAltaResolucionOmr(respuesta: RespuestaDetectadaOmr) {
  if (
    respuesta.opcion == null ||
    respuesta.confianza < 0.8 ||
    respuesta.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')
  ) return false;
  const scores = [...respuesta.scoresPorOpcion].sort((a, b) => b.score - a.score);
  const dominante = scores[0];
  const segunda = scores[1];
  const rescateConvencional = Boolean(
    dominante &&
    dominante.opcion === respuesta.opcion &&
    dominante.score >= 0.2 &&
    dominante.score - (segunda?.score ?? 0) >= 0.1 &&
    dominante.fillRatioCore >= 0.5 &&
    dominante.contraste >= 0.15 &&
    dominante.radialMassRatio >= 0.28 &&
    dominante.centroidOffsetRatio <= 0.45 &&
    dominante.shapeCompactness >= 0.25 &&
    dominante.markConfidence >= 0.45 &&
    (segunda?.fillRatioCore ?? 0) <= 0.35
  );
  const rescateIrregularLocalizado = Boolean(
    dominante &&
    dominante.opcion === respuesta.opcion &&
    respuesta.confianza >= 0.85 &&
    dominante.score >= 0.25 &&
    dominante.score - (segunda?.score ?? 0) >= 0.15 &&
    dominante.fillRatioCore >= 0.15 &&
    dominante.contraste >= 0.12 &&
    dominante.radialMassRatio >= 0.12 &&
    dominante.centroidOffsetRatio <= 0.3 &&
    dominante.shapeCompactness >= 0.35 &&
    dominante.markConfidence >= 0.5 &&
    (segunda?.fillRatioCore ?? 0) <= 0.35
  );
  return rescateConvencional || rescateIrregularLocalizado;
}

function fusionarRescateAditivoOmr(
  base: ResultadoOmr,
  rescate: ResultadoOmr,
  altaResolucion: ResultadoOmr,
  mapaPagina?: MapaOmrPagina,
  escalaAlterna?: ResultadoOmr,
  protegerDeterminadas = false
): ResultadoOmr {
  const preguntasPanelHorizontal = new Set(
    (mapaPagina?.preguntas ?? [])
      .filter((pregunta) => {
        const xs = pregunta.opciones.map((opcion) => Number(opcion.x));
        const ys = pregunta.opciones.map((opcion) => Number(opcion.y));
        if (xs.length < 2 || ys.length < 2 || [...xs, ...ys].some((value) => !Number.isFinite(value))) return false;
        const rangoX = Math.max(...xs) - Math.min(...xs);
        const rangoY = Math.max(...ys) - Math.min(...ys);
        const vertical = rangoY > Math.max(12, rangoX * 1.5);
        return !vertical && (
          (Number.isFinite(pregunta.perfilOmr?.pasoX) && Number(pregunta.perfilOmr?.pasoX) > 0.4) ||
          rangoX > Math.max(12, rangoY * 1.5)
        );
      })
      .map((pregunta) => pregunta.numeroPregunta)
  );
  const respuestasDetectadas = combinarRespuestasOmrSinPerderDeterminadas(
    base.respuestasDetectadas,
    rescate.respuestasDetectadas,
    altaResolucion.respuestasDetectadas,
    preguntasPanelHorizontal,
    escalaAlterna?.respuestasDetectadas ?? [],
    protegerDeterminadas
  );
  const total = respuestasDetectadas.length;
  const ambiguas = respuestasDetectadas.filter(esRespuestaAmbiguaOmr).length;
  const confianzaPromedioPagina = total > 0
    ? respuestasDetectadas.reduce((suma, respuesta) => suma + Math.max(0, respuesta.confianza), 0) / total
    : 0;
  const ratioAmbiguas = total > 0 ? ambiguas / total : 1;
  const calidadPagina = Math.max(base.calidadPagina, rescate.calidadPagina);
  const geomQuality = Math.max(base.geomQuality, rescate.geomQuality);
  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina,
    confianzaMedia: confianzaPromedioPagina,
    ratioAmbiguas,
    totalRespuestas: total,
    respuestasAnalizadas: total - ambiguas,
    geometriaConfiable: ![base, rescate].some((resultado) =>
      resultado.motivosRevision.some((motivo) => /referencia global|referencia de página/i.test(motivo))
    )
  });
  return {
    ...rescate,
    respuestasDetectadas,
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas,
    estadoAnalisis: decisionEstado.estado,
    motivosRevision: Array.from(new Set([...base.motivosRevision, ...rescate.motivosRevision, ...decisionEstado.motivos])).slice(0, 24),
    advertencias: Array.from(new Set([...base.advertencias, ...rescate.advertencias])),
    resumenRespuestas: resumirRespuestasOmr(
      respuestasDetectadas,
      calidadPagina,
      geomQuality,
      { forzarRevision: decisionEstado.anularRespuestas }
    ),
    geomQuality
  };
}

export async function analizarOmr(
  imagenBase64: string,
  mapaPagina: MapaOmrPagina,
  qrEsperado?: string | string[],
  margenMm = 10,
  debugInfo?: DebugInfo,
  opcionesInternas?: OpcionesAnalisisInterno
): Promise<ResultadoOmr> {
  const advertencias: string[] = [];
  const motivosRevision: string[] = [];
  const { data, colorData, gray, integral, width, height, metricasColor, sourceWidth, orientationMode, micro, buffer } = await decodificarImagen(
    imagenBase64,
    Boolean(opcionesInternas?.aggressivePreprocess),
    Boolean(opcionesInternas?.highResolutionRescue)
  );
  const perfilInicial = ajustarPerfilConMapa(resolverPerfilDeteccion(), mapaPagina);
  const qrEsperados = Array.isArray(qrEsperado) ? qrEsperado : qrEsperado ? [qrEsperado] : [];
  const coincideQrEsperado = (texto?: string) => {
    if (!texto || qrEsperados.length === 0) return Boolean(texto);
    return coincidePayloadQrExacto(texto, qrEsperados);
  };
  let qrDetalle = detectarQrMejorado(data, gray, width, height, {
    qrSizePtsHint: perfilInicial.qrSizePts,
    qrSizePts: QR_MATRIZ_SIZE_PTS,
    anchoCarta: ANCHO_CARTA,
    payloadsEsperados: qrEsperados
  });
  let qrTexto = qrDetalle?.data;
  let qrFuenteDeteccion = qrDetalle?.fuenteDeteccionQr;
  if (!qrDetalle || !coincideQrEsperado(qrDetalle.data)) {
    const qrRealzado = await detectarQrEnImagenRealzada(data, width, height, perfilInicial.qrSizePts);
    if (qrRealzado && coincideQrEsperado(qrRealzado.data)) {
      qrDetalle = qrRealzado;
      qrTexto = qrRealzado.data;
      qrFuenteDeteccion = 'preprocesado';
    }
  }
  if (!qrDetalle || !coincideQrEsperado(qrDetalle.data)) {
    const qrNativo = await detectarQrEnResolucionFuente(buffer, perfilInicial.qrSizePts, {
      matrixModules: mapaPagina.qr?.matrixModules,
      payloadsEsperados: qrEsperados
    });
    if (qrNativo && coincideQrEsperado(qrNativo.data)) {
      // Sin cantidad de módulos persistida, ZXing conserva identidad, pero sus
      // centros extrapolados no deben gobernar una homografía del mapa.
      qrDetalle = qrNativo.fuenteDeteccionQr === 'rotacion_pagina' ||
        (qrNativo.fuenteDeteccionQr === 'resolucion_fuente' && !mapaPagina.qr?.matrixModules)
        ? null
        : qrNativo;
      qrTexto = qrNativo.data;
      qrFuenteDeteccion = qrNativo.fuenteDeteccionQr ?? 'resolucion_fuente';
    }
  }
  const templateQr = extraerTemplateVersionDesdeQr(qrTexto);
  const templateVersionDetectada = templateQr ?? debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 4;
  const perfil = ajustarPerfilConMapa(resolverPerfilDeteccion(), mapaPagina);
  if ((!qrDetalle || !coincideQrEsperado(qrDetalle.data)) && perfil.qrSizePts !== perfilInicial.qrSizePts) {
    qrDetalle = detectarQrMejorado(data, gray, width, height, {
      qrSizePtsHint: perfil.qrSizePts,
      qrSizePts: QR_MATRIZ_SIZE_PTS,
      anchoCarta: ANCHO_CARTA,
      payloadsEsperados: qrEsperados
    });
    if (qrDetalle && coincideQrEsperado(qrDetalle.data)) {
      qrTexto = qrDetalle.data;
      qrFuenteDeteccion = qrDetalle.fuenteDeteccionQr;
    }
  }
  // Cuando jsQR no encuentra el símbolo completo, los fiduciales de página y
  // el QR persistido en el mapa todavía permiten rectificar exactamente la
  // reserva esperada. Se usa solo como rescate y el payload debe coincidir con
  // el esperado; nunca se acepta un QR encontrado fuera de esa geometría.
  if ((!qrDetalle || !coincideQrEsperado(qrDetalle.data)) && mapaPagina.qr) {
    const transformacionQrConocida = obtenerTransformacion(gray, width, height, [], undefined, {
      margenMm,
      qrSizePts: perfil.qrSizePts,
      qrGeometry: { ...mapaPagina.qr, textoEsperado: qrEsperado },
      marcasPagina: mapaPagina.marcasPagina,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS
    });
    const qrRectificado = detectarQrPorGeometriaConocida(
      data,
      width,
      height,
      mapaPagina.qr,
      transformacionQrConocida.transformar,
      {
        altoCarta: ALTO_CARTA,
        outputSize: opcionesInternas?.qrGeometryOutputSize,
        payloadsEsperados: qrEsperados
      }
    );
    if (qrRectificado && coincideQrEsperado(qrRectificado.data)) {
      qrDetalle = qrRectificado;
      qrTexto = qrRectificado.data;
      qrFuenteDeteccion = qrRectificado.fuenteDeteccionQr ?? 'known_geometry_rescue';
    }
  }
  if ((!qrDetalle || !coincideQrEsperado(qrDetalle.data)) && qrEsperados.length > 0) {
    const qrRotado = await detectarQrConRotacionPagina(
      data,
      width,
      height,
      perfil.qrSizePts,
      qrEsperados
    );
    if (qrRotado) {
      // La posición medida sobre los píxeles girados identifica el QR, pero
      // no gobierna OMR: la geometría sigue resolviéndose con la captura base.
      qrDetalle = null;
      qrTexto = qrRotado.data;
      qrFuenteDeteccion = 'rotacion_pagina';
    }
  }
  const escalaX = width / ANCHO_CARTA;
  const geometriaVerticalCompacta = mapaPagina.preguntas.some((pregunta) => {
    if (!pregunta.opciones || pregunta.opciones.length < 2) return false;
    const xs = pregunta.opciones.map((opcion) => opcion.x);
    const ys = pregunta.opciones.map((opcion) => opcion.y);
    const rangoX = Math.max(...xs) - Math.min(...xs);
    const rangoY = Math.max(...ys) - Math.min(...ys);
    return rangoY > Math.max(12, rangoX * 1.5);
  });
  const paramsBurbuja = crearParametrosBurbuja(
    escalaX,
    perfil.bubbleRadiusPts,
    perfil.bubblePitchYPts,
    perfil.bubblePitchXPts,
    geometriaVerticalCompacta
  );
  if (micro) {
    micro.paramsBurbuja = {
      radio: paramsBurbuja.radio * micro.scale,
      ringInner: paramsBurbuja.ringInner * micro.scale,
      ringOuter: paramsBurbuja.ringOuter * micro.scale,
      outerOuter: paramsBurbuja.outerOuter * micro.scale,
      paso: Math.max(1, Math.round(paramsBurbuja.paso * micro.scale))
    };
  }
  if (!qrTexto) {
    advertencias.push('No se detecto QR en la imagen');
  }
  if (qrEsperados.length > 0 && qrTexto) {
    if (!coincidePayloadQrExacto(qrTexto, qrEsperados)) {
      advertencias.push('El QR no coincide con el examen esperado');
    }
  }

  const transformacionBase = obtenerTransformacion(gray, width, height, advertencias, qrDetalle, {
    margenMm,
    qrSizePts: perfil.qrSizePts,
    qrGeometry: mapaPagina.qr ? { ...mapaPagina.qr, textoEsperado: qrEsperado } : undefined,
    marcasPagina: mapaPagina.marcasPagina,
    anchoCarta: ANCHO_CARTA,
    altoCarta: ALTO_CARTA,
    mmAPuntos: MM_A_PUNTOS
  });
  const referenciaPaginaCalidad = clamp01(Number(transformacionBase.referenciaPagina?.calidad ?? 0));
  const geometriaConfiable =
    !mapaPagina.engineHints?.forceSimpleScale &&
    transformacionBase.referenciaPagina?.orientacionDeterminada !== false &&
    transformacionBase.tipo !== 'escala' &&
    transformacionBase.referenciaPagina?.puntosDetectados >= 4 &&
    referenciaPaginaCalidad >= OMR_GEOMETRY_TRUST_MIN;
  if (!geometriaConfiable) {
    motivosRevision.push('Referencia global de página no confiable');
  }
  const referenciaGlobalFuerte =
    geometriaConfiable &&
    transformacionBase.tipo === 'homografia' &&
    transformacionBase.referenciaPagina?.tipo === 'marcas_esquina' &&
    // Una homografía aceptable para localizar la página no siempre es lo
    // bastante precisa para leer burbujas de 6 mm a 120 dpi. Por debajo de
    // este umbral se conserva la homografía como base, pero se habilita el
    // ajuste local acotado por pregunta para absorber perspectiva residual.
    referenciaPaginaCalidad >= 0.72;
  const capturaBajaResolucion = sourceWidth <= OMR_BAJA_RESOLUCION_MAX_ANCHO;
  const capturaResolucionIntermedia =
    capturaBajaResolucion && sourceWidth > OMR_BUSQUEDA_LOCAL_RESOLUCION_MIN_ANCHO;
  const capturaMuyBajaResolucion = sourceWidth <= OMR_MUY_BAJA_RESOLUCION_MAX_ANCHO;
  const transformarEscala = (punto: Punto) => {
    const escalaX = width / ANCHO_CARTA;
    const escalaY = height / ALTO_CARTA;
    return { x: punto.x * escalaX, y: height - punto.y * escalaY };
  };
  const forceHomographyGeometry = Boolean(
    opcionesInternas?.forceHomographyGeometry &&
    !qrTexto &&
    transformacionBase.tipo === 'homografia' &&
    (transformacionBase.referenciaPagina?.puntosDetectados ?? 0) >= 4 &&
    referenciaPaginaCalidad >= 0.9
  );
  const forceSimpleScale = !forceHomographyGeometry && (
    mapaPagina.engineHints?.forceSimpleScale === true
  );
  const tieneFiducialesLocales = mapaPagina.preguntas.some((pregunta) => Boolean(pregunta.fiduciales));
  // En capturas móviles de alta resolución, una escala simple sin QR puede
  // conservar un corrimiento local aunque no exista homografía confiable.
  // Los fiduciales por pregunta aportan la referencia que faltaba; el ajuste
  // sigue acotado por prepararCentrosPregunta y sus validaciones geométricas.
  let usarGeometriaLocal = debeUsarGeometriaLocalOmr({
    habilitada: OMR_LOCAL_GEOMETRY_ENABLED,
    deshabilitada: forceHomographyGeometry || Boolean(opcionesInternas?.disableLocalGeometry),
    referenciaGlobalFuerte,
    transformacion: transformacionBase.tipo,
    qrDetectado: Boolean(qrTexto),
    capturaBajaResolucion,
    forceSimpleScale,
    tieneFiducialesLocales
  });
  const useMapCoordinatesStrict =
    typeof mapaPagina.engineHints?.useMapCoordinatesStrict === 'boolean'
      ? mapaPagina.engineHints.useMapCoordinatesStrict
      : false;
  const localSearchRadiusPx = useMapCoordinatesStrict
    ? 0
    : (mapaPagina.engineHints?.localSearchRadiusPx ?? Math.max(2, Math.round(paramsBurbuja.radio * 0.55)));
  const permitirRescateLocal = !referenciaGlobalFuerte;
  // Una homografía de página puede conservar calidad global y aun así dejar
  // un residuo de varios píxeles en una captura pequeña. Una búsqueda local
  // muy corta dentro de cada burbuja absorbe ese residuo sin alcanzar la
  // alternativa vecina ni el texto exterior del panel.
  const localBubbleSearchRadiusPx = usarGeometriaLocal
    ? 0
    : !permitirRescateLocal && capturaResolucionIntermedia
      ? Math.max(2, Math.min(7, Math.round(paramsBurbuja.radio * 0.38)))
      : !permitirRescateLocal
        ? 0
        : localSearchRadiusPx;
  let transformar = transformacionBase.transformar;
  // Una homografia de esquinas con calidad baja puede quedar desplazada por
  // el borde de la hoja o por una sombra, especialmente cuando el QR no fue
  // legible. En una captura de baja resolucion la escala nominal es una base
  // mas estable para que los fiduciales de cada panel hagan la correccion
  // local; esta ruta no se habilita con QR ni en imagenes de mayor resolucion.
  const referenciaDebilSinQr =
    capturaBajaResolucion &&
    !qrTexto &&
    transformacionBase.tipo === 'homografia' &&
    referenciaPaginaCalidad < OMR_GEOMETRY_TRUST_MIN;
  if (referenciaDebilSinQr) {
    transformar = transformarEscala;
    advertencias.push('Referencia global debil sin QR; se usa escala nominal para rescate local');
  }
  if (forceSimpleScale) {
    transformar = transformarEscala;
    advertencias.push('Mapa OMR derivado desde imagen: transformacion global por escala forzada');
  } else if (transformacionBase.tipo === 'escala') {
    motivosRevision.push('Alineacion global no rectificada (escala simple)');
    advertencias.push(
      usarGeometriaLocal
        ? 'Rectificacion CV no confiable; se mantiene escala simple con ajuste local'
        : 'Rectificacion CV no confiable; se mantiene escala simple sin ajuste local'
    );
  } else if (!usarGeometriaLocal) {
    advertencias.push(
      opcionesInternas?.disableLocalGeometry
        ? 'Se desactiva ajuste local por pregunta en el pase alternativo'
        : OMR_LOCAL_GEOMETRY_ENABLED
        ? 'Se usa la geometria persistida sin ajuste local por pregunta'
        : 'OMR_LOCAL_GEOMETRY_ENABLED=0: se desactiva ajuste local por pregunta'
    );
  }

  const evaluarTransformacion = (transformador: (p: Punto) => Punto) => {
    const cantidadMuestras = Math.min(5, mapaPagina.preguntas.length);
    const usarMuestreoDistribuido = mapaPagina.preguntas.length >= 20;
    const indicesMuestra = !usarMuestreoDistribuido
      ? Array.from({ length: cantidadMuestras }, (_valor, indice) => indice)
      : cantidadMuestras <= 1
      ? [0]
      : Array.from({ length: cantidadMuestras }, (_valor, indice) =>
          Math.round(indice * (mapaPagina.preguntas.length - 1) / (cantidadMuestras - 1))
        );
    // Solo una página densa muestrea toda su extensión vertical. En la muestra
    // fotográfica de 48 páginas (máximo 9 reactivos por página), el cambio
    // global redujo cobertura, por lo que se conserva la selección anterior.
    const muestras = [...new Set(indicesMuestra)]
      .map((indice) => mapaPagina.preguntas[indice])
      .filter((pregunta): pregunta is NonNullable<typeof pregunta> => Boolean(pregunta));
    let totalScore = 0;
    let totalDelta = 0;
    for (const pregunta of muestras) {
      const centros = pregunta.opciones.map((opcion) => ({
        letra: opcion.letra,
        punto: transformador({ x: opcion.x, y: opcion.y })
      }));
      let mejorScore = 0;
      let segundoScore = 0;
      const rango = Math.max(8, Math.round(paramsBurbuja.ringOuter * 0.6));
      const paso = Math.max(1, Math.round(paramsBurbuja.radio / 4));
      for (let dy = -rango; dy <= rango; dy += paso) {
        for (let dx = -rango; dx <= rango; dx += paso) {
          const resultado = evaluarConOffset({
            gray,
            integral,
            width,
            height,
            centros,
            dx,
          dy,
          params: paramsBurbuja,
          localSearchRatio: perfil.localSearchRatio,
          localSearchRadiusPx: localBubbleSearchRadiusPx,
          localDriftPenalty: perfil.localDriftPenalty,
          detectarOpcion
        });
          if (resultado.mejorScore > mejorScore) {
            segundoScore = resultado.segundoScore;
            mejorScore = resultado.mejorScore;
          } else if (resultado.mejorScore > segundoScore) {
            segundoScore = resultado.mejorScore;
          }
        }
      }
      totalScore += mejorScore;
      totalDelta += Math.max(0, mejorScore - segundoScore);
    }
    const denom = Math.max(1, muestras.length);
    return { score: totalScore / denom, delta: totalDelta / denom };
  };

  if ((transformacionBase.tipo === 'homografia' || transformacionBase.tipo === 'qr') && !forceHomographyGeometry) {
    const calidadHom = evaluarTransformacion(transformacionBase.transformar);
    const calidadEscala = evaluarTransformacion(transformarEscala);
    const puntajeHom = calidadHom.score + calidadHom.delta * 0.6;
    const puntajeEscala = calidadEscala.score + calidadEscala.delta * 0.6;
    const ventajaEscala = puntajeEscala - puntajeHom;
    const escalaMejor = ventajaEscala > 0.03;
    const escalaMuyMejor = !qrTexto
      ? ventajaEscala > 0.08
      : transformacionBase.tipo === 'qr'
        ? ventajaEscala > 0.1
        : ventajaEscala > 0.14;
    if (escalaMejor) {
      if (!forceSimpleScale) {
        motivosRevision.push('Alineacion global inestable (escala simple puntuo mejor)');
      }
      const permitirFallbackEscala = forceSimpleScale || (
        !usarGeometriaLocal ||
        (transformacionBase.referenciaPagina?.tipo === 'marcas_esquina' && escalaMejor && referenciaGlobalFuerte) ||
        (opcionesInternas?.rescueFiduciales === false && escalaMuyMejor && referenciaGlobalFuerte) ||
        (transformacionBase.tipo === 'homografia' && escalaMuyMejor && ventajaEscala > 0.18 && referenciaGlobalFuerte)
      );
      if (permitirFallbackEscala) {
        if (!forceSimpleScale) {
          advertencias.push('Se eligio transformacion por escala por mayor coherencia de marcas');
        }
        transformar = transformarEscala;
      } else if (opcionesInternas?.rescueFiduciales !== false) {
        advertencias.push('Rescate fiduciales: se mantiene transformacion base para ajuste local');
      } else {
        advertencias.push('Escala simple puntuo mejor, pero se conserva rectificacion CV y ajuste local');
      }
    }
  }
  if (forceHomographyGeometry) {
    transformar = transformacionBase.transformar;
    usarGeometriaLocal = false;
    advertencias.push('Pase de evidencia OMR: homografia de fiduciales fijada para consenso geometrico');
  }
  // En escala simple solo se conserva el ajuste local cuando la página
  // realmente trae fiduciales por pregunta. Esto también cubre la transición
  // en la que el comparador elige escala como fallback de una homografía.
  const escalaConFiducialesLocales = debeReactivarGeometriaLocalTrasEscalaOmr({
    transformacionSeleccionada: transformar === transformarEscala ? 'escala' : transformacionBase.tipo,
    qrDetectado: Boolean(qrTexto),
    forceSimpleScale,
    deshabilitada: Boolean(opcionesInternas?.disableLocalGeometry),
    coordenadasEstrictas: useMapCoordinatesStrict,
    tieneFiducialesLocales
  });
  if (escalaConFiducialesLocales) {
    usarGeometriaLocal = true;
  } else if (transformar === transformarEscala) {
    usarGeometriaLocal = false;
  }
  if (
    !forceSimpleScale &&
    transformacionBase.tipo !== 'escala' &&
    referenciaPaginaCalidad < 0.72
  ) {
    // Una escala global puede puntuar mejor al comparar solo tinta, pero en
    // una página con perspectiva residual desplaza sistemáticamente las
    // burbujas. Mantener la rectificación y activar la búsqueda local acotada
    // evita ese sesgo sin relajar el rechazo de dobles marcas.
    transformar = transformacionBase.transformar;
    usarGeometriaLocal = !opcionesInternas?.disableLocalGeometry;
  }
  // En una captura pequeña la homografía de página puede ser globalmente
  // confiable y, aun así, sufrir distorsión no lineal en una fila concreta.
  // Se habilita el ajuste fiducial local acotado como hipótesis adicional; si
  // los marcadores no forman una geometría plausible, prepararCentrosPregunta
  // conserva automáticamente la transformación global.
  const usarGeometriaLocalEfectiva = usarGeometriaLocal || (capturaMuyBajaResolucion && referenciaGlobalFuerte);
  const estado: EstadoImagenOmr = {
    gray,
    integral,
    width,
    height,
    escalaX,
    paramsBurbuja,
    micro
  };
  // La homografía global o la transformación QR ya fijan la posición en la
  // hoja. La búsqueda horizontal se reserva para el caso de escala simple;
  // sobre una página densa, optimizarla contra tinta de texto puede desplazar
  // toda la fila hacia una palabra o una línea y fabricar marcas.
  const permitirBusquedaHorizontal =
    transformacionBase.tipo === 'escala' ||
    // En capturas pequeñas una homografía/QR de calidad baja puede dejar un
    // corrimiento subpíxel que los fiduciales locales no siempre recuperan.
    // Habilitar la búsqueda solo para el panel horizontal y solo en esa ruta
    // degradada corrige el paso X sin relajar la decisión de marcas dobles.
    (capturaBajaResolucion && referenciaPaginaCalidad < OMR_GEOMETRY_TRUST_MIN);
  const umbralRespuestaConf = opcionesInternas?.aggressivePreprocess
    ? Math.max(0.62, OMR_RESPUESTA_CONF_MIN - 0.14)
    : OMR_RESPUESTA_CONF_MIN;
  const respuestasDetectadas: ResultadoOmr['respuestasDetectadas'] = [];
  const patches: PatchRegistro[] = [];
  let preguntasAmbiguas = 0;
  let reprojectionErrorAcumulado = 0;
  let reprojectionErrorConteo = 0;
  const debug: DebugOmr | null = OMR_DEBUG
    ? {
        folio: debugInfo?.folio,
        numeroPagina: debugInfo?.numeroPagina,
        width,
        height,
        transformacion: transformacionBase.tipo,
        advertencias: [...advertencias],
        preguntas: []
      }
    : null;

  const usarCoordenadasEstrictas = mapaPagina.engineHints?.useMapCoordinatesStrict === true;
  mapaPagina.preguntas.forEach((pregunta) => {
    const prep = prepararCentrosPregunta(
      estado,
      pregunta,
      transformar,
      perfil,
      usarCoordenadasEstrictas,
       usarGeometriaLocalEfectiva,
      mapaPagina.markerSpec?.sizeMm ?? OMR_FIDUCIAL_SIZE_MM_DEFAULT,
      permitirBusquedaHorizontal,
      referenciaGlobalFuerte,
       capturaBajaResolucion
    );
    let centros = prep.centros;
    const panelHorizontalCompacto = Number.isFinite(pregunta.perfilOmr?.pasoX) && Number(pregunta.perfilOmr?.pasoX) > 0.4;
    const permitirBusquedaLocalPregunta = permitirRescateLocal ||
      (capturaResolucionIntermedia && referenciaGlobalFuerte && panelHorizontalCompacto) ||
      // En originales de hasta 900 px la homografía puede ser correcta a
      // escala de página, pero quedar desplazada varios píxeles en un panel
      // pequeño. Habilitar la búsqueda solo para el panel horizontal evita
      // perder una marca válida; la decisión de doble marca sigue intacta.
      (capturaMuyBajaResolucion && referenciaGlobalFuerte && panelHorizontalCompacto);
    if ((prep.usaRescateCaja || /panel OMR derecho/i.test(String(prep.motivo ?? ''))) && prep.motivo) {
      advertencias.push(`P${pregunta.numeroPregunta}: ${prep.motivo}`);
    }
    if (prep.reprojectionErrorPx !== null && Number.isFinite(prep.reprojectionErrorPx)) {
      reprojectionErrorAcumulado += prep.reprojectionErrorPx;
      reprojectionErrorConteo += 1;
    }
    const reprojectionError = prep.reprojectionErrorPx;
    const reprojectionDisponible = typeof reprojectionError === 'number' && Number.isFinite(reprojectionError);
    const reprojectionFueraDeRango =
      reprojectionError === Number.POSITIVE_INFINITY ||
      (reprojectionDisponible && reprojectionError > perfil.reprojectionMaxErrorPx);
    const bloqueoPorFiducial = prep.puntosFidDetectados >= 2 && !prep.usaRescateCaja;
    const fiducialConfiable =
      prep.puntosFidDetectados >= 3 &&
      reprojectionDisponible &&
      (reprojectionError as number) <= perfil.reprojectionMaxErrorPx;
    const habilitarAjusteLocalPregunta = usarGeometriaLocalEfectiva && fiducialConfiable;
    if (perfil.reprojectionMaxErrorPx < Number.POSITIVE_INFINITY && reprojectionFueraDeRango && bloqueoPorFiducial) {
      motivosRevision.push(`P${pregunta.numeroPregunta}: error geometrico local (fiduciales)`);
      if (opcionesInternas?.rescueFiduciales) {
        advertencias.push(`P${pregunta.numeroPregunta}: rescate fiduciales por error geométrico local`);
      }
    }
    const offsetsPregunta = habilitarAjusteLocalPregunta || !permitirBusquedaLocalPregunta
      ? { mejorDx: 0, mejorDy: 0 }
      : buscarMejorOffsetPregunta({
          estado,
          centros,
          alignRange: Math.max(4, Math.min(perfil.alignRange, 8)),
          maxCenterDriftRatio: Math.min(perfil.maxCenterDriftRatio, 0.18),
          minSafeRange: perfil.minSafeRange,
          evaluarAlineacionOffset
        });
    let mejorDx = offsetsPregunta.mejorDx;
    let mejorDy = offsetsPregunta.mejorDy;
    let rescateOffsetAmplioArtefacto = false;
    const localSearchRadiusPregunta = !permitirBusquedaLocalPregunta
      ? 0
      : !usarGeometriaLocalEfectiva
        ? localSearchRadiusPx
        : habilitarAjusteLocalPregunta
          ? 0
          : 0;
    const evaluarConCentros = (
      centrosEvaluacion: Array<{ letra: string; punto: Punto }>,
      radio: number,
      dx: number,
      dy: number
    ) => {
      const resultado = evaluarConOffset({
        gray,
        integral,
        width,
        height,
        centros: centrosEvaluacion,
        dx,
        dy,
        params: paramsBurbuja,
        localSearchRatio: perfil.localSearchRatio,
        localSearchRadiusPx: radio,
        localDriftPenalty: perfil.localDriftPenalty,
        detectarOpcion
      });
      const metricas = calcularMetricasPregunta({
        estado,
        centros: centrosEvaluacion,
        resultado,
        mejorDx: dx,
        mejorDy: dy,
        umbrales: {
          scoreMin: perfil.scoreMin,
          scoreStd: perfil.scoreStd,
          strongScore: perfil.strongScore,
          secondRatio: perfil.secondRatio,
          deltaMin: perfil.deltaMin,
          minTopZScore: perfil.minTopZScore,
          ambiguityRatio: perfil.ambiguityRatio,
          minFillDelta: perfil.minFillDelta,
          minCenterGap: perfil.minCenterGap,
          minHybridConfidence: perfil.minHybridConf
        },
        detectarOpcion
      });
      return { resultado, metricas };
    };
    const evaluarConRadioLocal = (radio: number) => evaluarConCentros(centros, radio, mejorDx, mejorDy);
    const evaluacionSinBusquedaLocal = localSearchRadiusPregunta > 0
      ? evaluarConCentros(centros, 0, mejorDx, mejorDy)
      : null;
    let evaluacion = evaluarConRadioLocal(localSearchRadiusPregunta);
    // A local bubble search can maximize a nearby text stroke when the map
    // center is too weak to provide an independent anchor. Keep it only when
    // it preserves the same candidate already visible at the map coordinate;
    // this permits faint-mark recovery without turning a blank row into a
    // confident answer from neighboring content.
    if (
      evaluacionSinBusquedaLocal &&
      evaluacion.metricas.mejorOpcion &&
      evaluacionSinBusquedaLocal.metricas.mejorOpcion &&
      evaluacion.metricas.mejorOpcion !== evaluacionSinBusquedaLocal.metricas.mejorOpcion
    ) {
      evaluacion = evaluacionSinBusquedaLocal;
    }
    // Un corrimiento residual puede hacer que una marca válida parezca doble
    // al capturar una fila compacta a baja resolución. Solo en ese caso se
    // explora un desplazamiento horizontal más amplio; una respuesta limpia o
    // un panel vertical nunca se mueve por esta heurística. La aceptación
    // exige que la hipótesis corregida sea suficiente y deje de ser doble.
    if (
      referenciaGlobalFuerte &&
      capturaBajaResolucion &&
      panelHorizontalCompacto &&
      evaluacion.metricas.dobleMarcada
    ) {
      const offsetsDobleBajaResolucion = buscarMejorOffsetPregunta({
        estado,
        centros,
        alignRange: Math.max(4, Math.min(perfil.alignRange, 8)),
        // La ventana ampliada solo se usa después de observar una doble
        // aparente; mantiene un desplazamiento acotado para no buscar fuera
        // del panel ni confundir texto cercano con una burbuja.
        alignRangeX: Math.max(16, perfil.alignRange),
        alignRangeY: Math.max(4, Math.min(perfil.alignRange, 8)),
        maxCenterDriftRatio: Math.min(perfil.maxCenterDriftRatio, 0.18),
        maxCenterDriftRatioX: Math.min(0.5, Math.max(0.42, perfil.maxCenterDriftRatio)),
        maxCenterDriftRatioY: Math.min(perfil.maxCenterDriftRatio, 0.18),
        minSafeRange: perfil.minSafeRange,
        evaluarAlineacionOffset
      });
      const rescateDoble = evaluarConCentros(
        centros,
        Math.max(localSearchRadiusPregunta, Math.round(paramsBurbuja.radio * 1.5)),
        offsetsDobleBajaResolucion.mejorDx,
        offsetsDobleBajaResolucion.mejorDy
      );
      if (
        rescateDoble.metricas.suficiente &&
        !rescateDoble.metricas.dobleMarcada &&
        rescateDoble.metricas.confianza >= Math.max(0.55, evaluacion.metricas.confianza + 0.08) &&
        rescateDoble.metricas.mejorScore >= evaluacion.metricas.mejorScore + 0.04
      ) {
        mejorDx = offsetsDobleBajaResolucion.mejorDx;
        mejorDy = offsetsDobleBajaResolucion.mejorDy;
        evaluacion = rescateDoble;
        advertencias.push(`P${pregunta.numeroPregunta}: rescate horizontal de doble aparente`);
      }
    }
    // En escala simple con fiduciales locales, una fila horizontal puede
    // conservar un corrimiento residual aunque la geometría del panel haya
    // sido validada. Se permite una búsqueda pequeña solo para señal débil o
    // doble aparente; la hipótesis corregida debe mejorar claramente y quedar
    // sin doble marca. Una respuesta ya limpia no se mueve.
    if (
      transformacionBase.tipo === 'escala' &&
      capturaBajaResolucion &&
      panelHorizontalCompacto &&
      (!evaluacion.metricas.suficiente ||
        evaluacion.metricas.confianza < umbralRespuestaConf ||
        evaluacion.metricas.dobleMarcada) &&
      !useMapCoordinatesStrict
    ) {
      const offsetEscalaLocal = buscarMejorOffsetPregunta({
        estado,
        centros,
        alignRange: Math.max(4, Math.min(perfil.alignRange, 8)),
        maxCenterDriftRatio: Math.min(0.3, Math.max(0.22, perfil.maxCenterDriftRatio)),
        minSafeRange: perfil.minSafeRange,
        evaluarAlineacionOffset
      });
      const rescateEscalaLocal = evaluarConCentros(
        centros,
        Math.max(localSearchRadiusPregunta, Math.round(paramsBurbuja.radio * 1.35)),
        offsetEscalaLocal.mejorDx,
        offsetEscalaLocal.mejorDy
      );
      if (
        rescateEscalaLocal.metricas.suficiente &&
        !rescateEscalaLocal.metricas.dobleMarcada &&
        rescateEscalaLocal.metricas.confianza >= Math.max(0.55, evaluacion.metricas.confianza + 0.08) &&
        rescateEscalaLocal.metricas.mejorScore >= evaluacion.metricas.mejorScore + 0.04
      ) {
        mejorDx = offsetEscalaLocal.mejorDx;
        mejorDy = offsetEscalaLocal.mejorDy;
        evaluacion = rescateEscalaLocal;
        advertencias.push(`P${pregunta.numeroPregunta}: rescate de corrimiento local en escala`);
      }
    }
    // Si el corrimiento no es uniforme entre las cinco posiciones, el offset
    // común anterior no basta. Para una lectura todavía débil se explora una
    // ventana muy pequeña por burbuja y se conserva la hipótesis solo si la
    // pregunta completa mejora; esto evita convertir una palabra cercana en
    // cinco respuestas independientes.
    if (
      transformacionBase.tipo === 'escala' &&
      capturaBajaResolucion &&
      panelHorizontalCompacto &&
      (!evaluacion.metricas.suficiente ||
        evaluacion.metricas.confianza < umbralRespuestaConf ||
        evaluacion.metricas.dobleMarcada) &&
      !useMapCoordinatesStrict
    ) {
      const radioRefinamiento = Math.max(2, Math.min(7, Math.round(paramsBurbuja.radio * 0.42)));
      const pasoRefinamiento = Math.max(1, Math.round(paramsBurbuja.radio / 8));
      const centrosRefinados = centros.map((centro) => {
        let mejor = { punto: centro.punto, score: -Infinity };
        for (let dy = -radioRefinamiento; dy <= radioRefinamiento; dy += pasoRefinamiento) {
          for (let dx = -radioRefinamiento; dx <= radioRefinamiento; dx += pasoRefinamiento) {
            const punto = { x: centro.punto.x + dx, y: centro.punto.y + dy };
            const score = detectarOpcion(gray, integral, width, height, punto, paramsBurbuja).score;
            if (score > mejor.score) mejor = { punto, score };
          }
        }
        return { letra: centro.letra, punto: mejor.punto };
      });
      const rescateCentrosRefinados = evaluarConCentros(centrosRefinados, 0, 0, 0);
      if (
        rescateCentrosRefinados.metricas.suficiente &&
        !rescateCentrosRefinados.metricas.dobleMarcada &&
        rescateCentrosRefinados.metricas.confianza >= Math.max(0.55, evaluacion.metricas.confianza + 0.08) &&
        rescateCentrosRefinados.metricas.mejorScore >= evaluacion.metricas.mejorScore + 0.04
      ) {
        centros = centrosRefinados;
        mejorDx = 0;
        mejorDy = 0;
        evaluacion = rescateCentrosRefinados;
        advertencias.push(`P${pregunta.numeroPregunta}: refinamiento local por burbuja`);
      }
    }
    // En capturas extremadamente pequeñas una deriva horizontal no lineal
    // puede dejar la marca válida fuera de la ventana global. Se permite una
    // búsqueda amplia únicamente para una respuesta que quedó débil, y solo se
    // acepta si la candidata tiene evidencia de tinta sólida y las otras cuatro
    // ventanas permanecen vacías. Una doble marca o ruido distribuido no puede
    // atravesar este filtro.
    if (
      referenciaGlobalFuerte &&
      capturaMuyBajaResolucion &&
      panelHorizontalCompacto &&
      (!evaluacion.metricas.suficiente ||
        evaluacion.metricas.confianza < umbralRespuestaConf ||
        evaluacion.metricas.mejorScore < OMR_PARTIAL_CORE_SCORE_MAX) &&
      !evaluacion.metricas.dobleMarcada
    ) {
      const offsetAmplioBajaResolucion = buscarMejorOffsetPregunta({
        estado,
        centros,
        alignRange: Math.max(4, Math.min(perfil.alignRange, 8)),
        alignRangeX: Math.max(32, Math.min(56, perfil.alignRange * 4)),
        alignRangeY: Math.max(4, Math.min(perfil.alignRange, 8)),
        maxCenterDriftRatio: Math.min(perfil.maxCenterDriftRatio, 0.18),
        maxCenterDriftRatioX: Math.min(0.95, Math.max(0.85, perfil.maxCenterDriftRatio)),
        maxCenterDriftRatioY: Math.min(perfil.maxCenterDriftRatio, 0.18),
        minSafeRange: perfil.minSafeRange,
        evaluarAlineacionOffset
      });
      const rescateOffsetAmplio = evaluarConCentros(
        centros,
        Math.max(localSearchRadiusPregunta, Math.round(paramsBurbuja.radio * 1.5)),
        offsetAmplioBajaResolucion.mejorDx,
        offsetAmplioBajaResolucion.mejorDy
      );
      const scoresOffsetAmplio = construirScoresPorOpcion({
        estado,
        centros,
        scoresEvaluados: rescateOffsetAmplio.resultado.scores,
        mejorDx: offsetAmplioBajaResolucion.mejorDx,
        mejorDy: offsetAmplioBajaResolucion.mejorDy,
        colorData,
        colorWidth: width,
        colorHeight: height
      });
      const dominanteOffsetAmplio = scoresOffsetAmplio[0];
      const segundaOffsetAmplio = scoresOffsetAmplio[1];
      const segundaSeñalArtefactoNoCompacto = Boolean(
        dominanteOffsetAmplio &&
        segundaOffsetAmplio &&
        dominanteOffsetAmplio.score >= 0.9 &&
        dominanteOffsetAmplio.fillRatioCore >= 0.95 &&
        dominanteOffsetAmplio.fillRatioRing <= 0.25 &&
        dominanteOffsetAmplio.shapeCompactness >= 0.72 &&
        dominanteOffsetAmplio.score - segundaOffsetAmplio.score >= 0.03 &&
        segundaOffsetAmplio.fillRatioCore >= 0.8 &&
        segundaOffsetAmplio.shapeCompactness < 0.65 &&
        segundaOffsetAmplio.fillRatioRing < 0.22
      );
      const otrasVentanasVacias = scoresOffsetAmplio.slice(1).every(
        (item, indice) =>
          (item.fillRatioCore < 0.42 && item.markConfidence < 0.72) ||
          (indice === 0 && segundaSeñalArtefactoNoCompacto) ||
          (segundaSeñalArtefactoNoCompacto &&
            evaluacion.metricas.mejorScore < 0.2 &&
            item.score < 0.3 &&
            item.fillRatioCore < 0.55 &&
            item.markConfidence < 0.65)
      );
      const marcaOffsetAmplioSegura = Boolean(
        dominanteOffsetAmplio &&
        otrasVentanasVacias &&
        (!rescateOffsetAmplio.metricas.dobleMarcada || segundaSeñalArtefactoNoCompacto) &&
        dominanteOffsetAmplio.score >= 0.78 &&
        dominanteOffsetAmplio.fillRatioCore >= 0.82 &&
        dominanteOffsetAmplio.centerDarknessDelta >= 0.12 &&
        dominanteOffsetAmplio.markConfidence >= 0.85 &&
        dominanteOffsetAmplio.shapeCompactness >= 0.55 &&
        (segundaSeñalArtefactoNoCompacto
          ? dominanteOffsetAmplio.score - (segundaOffsetAmplio?.score ?? 0) >= 0.03
          : dominanteOffsetAmplio.score - (segundaOffsetAmplio?.score ?? 0) >= 0.24) &&
        (segundaSeñalArtefactoNoCompacto || (segundaOffsetAmplio?.fillRatioCore ?? 0) < 0.5) &&
        (segundaOffsetAmplio?.fillRatioRing ?? 0) < 0.35
      );
      if (
        marcaOffsetAmplioSegura &&
        dominanteOffsetAmplio &&
        dominanteOffsetAmplio.score >= evaluacion.metricas.mejorScore + 0.16
      ) {
        mejorDx = offsetAmplioBajaResolucion.mejorDx;
        mejorDy = offsetAmplioBajaResolucion.mejorDy;
        evaluacion = rescateOffsetAmplio;
        rescateOffsetAmplioArtefacto = true;
        advertencias.push(`P${pregunta.numeroPregunta}: rescate horizontal amplio de baja resolución`);
      }
    }
    // Una homografía global fuerte es la referencia principal; solo si el
    // análisis conservador no alcanza evidencia suficiente se permite una
    // búsqueda alrededor de cada burbuja. Esto corrige el residuo de una foto
    // deformada sin recalcular la geometría del panel ni mover una respuesta
    // ya válida por tinta cercana.
    if (
      referenciaGlobalFuerte &&
      (!evaluacion.metricas.suficiente ||
        evaluacion.metricas.confianza < umbralRespuestaConf ||
        evaluacion.metricas.mejorScore < OMR_PARTIAL_CORE_SCORE_MAX) &&
      !evaluacion.metricas.dobleMarcada
    ) {
      const radioRescate = Math.max(localSearchRadiusPx, Math.round(paramsBurbuja.radio * 1.5));
      const rescate = evaluarConRadioLocal(radioRescate);
      if (
        rescate.metricas.suficiente &&
        rescate.metricas.confianza >= Math.max(0.55, evaluacion.metricas.confianza + 0.08)
      ) {
        evaluacion = rescate;
        advertencias.push(`P${pregunta.numeroPregunta}: rescate por búsqueda local acotada`);
      }
    }
    // Una referencia global puede ser suficientemente buena para rectificar
    // la página y, aun así, dejar un corrimiento residual en un panel tras
    // perspectiva/compresión. En vez de relajar el umbral de marcas, se
    // intenta una segunda preparación geométrica solo para una respuesta que
    // ya resultó débil. La aceptación exige mejora medible y conserva el
    // rechazo de dobles marcas.
    if (
      referenciaGlobalFuerte &&
      (!evaluacion.metricas.suficiente ||
        evaluacion.metricas.confianza < umbralRespuestaConf ||
        evaluacion.metricas.mejorScore < OMR_PARTIAL_CORE_SCORE_MAX) &&
      !evaluacion.metricas.dobleMarcada &&
      !useMapCoordinatesStrict &&
      !opcionesInternas?.disableLocalGeometry
    ) {
      const prepRescate = prepararCentrosPregunta(
        estado,
        pregunta,
        transformar,
        perfil,
        false,
        true,
        mapaPagina.markerSpec?.sizeMm ?? OMR_FIDUCIAL_SIZE_MM_DEFAULT,
        permitirBusquedaHorizontal,
        false,
        capturaBajaResolucion
      );
      const rescateGeometrico = evaluarConCentros(prepRescate.centros, 0, 0, 0);
      if (
        rescateGeometrico &&
        rescateGeometrico.metricas.suficiente &&
        !rescateGeometrico.metricas.dobleMarcada &&
        rescateGeometrico.metricas.confianza >= Math.max(0.55, evaluacion.metricas.confianza + 0.08)
      ) {
        centros = prepRescate.centros;
        mejorDx = 0;
        mejorDy = 0;
        evaluacion = rescateGeometrico;
        advertencias.push(`P${pregunta.numeroPregunta}: rescate geométrico local por respuesta débil`);
      }
    }
    // La homografía de página sigue siendo la referencia principal, pero una
    // captura inclinada puede dejar un corrimiento horizontal progresivo en
    // los paneles compactos. Para una respuesta débil se contrasta la escala
    // simple solo como hipótesis local; se acepta únicamente si encuentra un
    // núcleo claramente relleno, una forma compacta y ningún indicio de doble
    // marca. Esto evita convertir texto cercano o una marca parcial en válida.
    if (
      referenciaGlobalFuerte &&
      capturaBajaResolucion &&
      panelHorizontalCompacto &&
      (!evaluacion.metricas.suficiente ||
        evaluacion.metricas.confianza < umbralRespuestaConf ||
        evaluacion.metricas.mejorScore < OMR_PARTIAL_CORE_SCORE_MAX) &&
      !evaluacion.metricas.dobleMarcada
    ) {
      const centrosEscala = construirCentrosBasePregunta(pregunta, transformarEscala);
      const evaluacionEscala = evaluarConCentros(centrosEscala, 0, 0, 0);
      const scoresEscala = construirScoresPorOpcion({
        estado,
        centros: centrosEscala,
        scoresEvaluados: evaluacionEscala.resultado.scores,
        mejorDx: 0,
        mejorDy: 0,
        colorData,
        colorWidth: width,
        colorHeight: height
      });
      const dominanteEscala = scoresEscala[0];
      const segundaEscala = scoresEscala[1];
      const marcaEscalaSegura = Boolean(
        dominanteEscala &&
        !evaluacionEscala.metricas.dobleMarcada &&
        dominanteEscala.score >= 0.72 &&
        dominanteEscala.fillRatioCore >= 0.72 &&
        dominanteEscala.shapeCompactness >= 0.45 &&
        dominanteEscala.score - (segundaEscala?.score ?? 0) >= 0.18 &&
        (segundaEscala?.fillRatioCore ?? 0) < 0.62 &&
        (segundaEscala?.fillRatioRing ?? 0) < 0.42
      );
      if (marcaEscalaSegura && dominanteEscala && dominanteEscala.score >= evaluacion.metricas.mejorScore + 0.1) {
        centros = centrosEscala;
        mejorDx = 0;
        mejorDy = 0;
        evaluacion = evaluacionEscala;
        advertencias.push(`P${pregunta.numeroPregunta}: rescate de alineación por escala local acotada`);
      }
    }
    const { resultado, metricas } = evaluacion;
    let opcionDetectada =
      metricas.suficiente && metricas.confianza >= umbralRespuestaConf
        ? (metricas.mejorOpcion as OpcionRespuestaOmr | null)
        : null;
    const scoresPorOpcion = construirScoresPorOpcion({
      estado,
      centros,
      scoresEvaluados: resultado.scores,
      mejorDx,
      mejorDy,
      colorData,
      colorWidth: width,
      colorHeight: height
    });
    const microScoresPorOpcion = micro
      ? construirScoresPorOpcion({
          estado: {
            gray: micro.gray,
            integral: micro.integral,
            width: micro.width,
            height: micro.height,
            escalaX: escalaX * micro.scale,
            paramsBurbuja: micro.paramsBurbuja
          },
          centros: centros.map((centro) => ({
            letra: centro.letra,
            punto: { x: centro.punto.x * micro.scale, y: centro.punto.y * micro.scale }
          })),
          scoresEvaluados: evaluarConOffset({
            gray: micro.gray,
            integral: micro.integral,
            width: micro.width,
            height: micro.height,
            centros: centros.map((centro) => ({
              letra: centro.letra,
              punto: { x: centro.punto.x * micro.scale, y: centro.punto.y * micro.scale }
            })),
            dx: 0,
            dy: 0,
            params: micro.paramsBurbuja,
            localSearchRatio: 0,
            localSearchRadiusPx: 0,
            localDriftPenalty: 0,
            detectarOpcion
          }).scores,
          mejorDx: 0,
          mejorDy: 0,
          colorData: micro.rgbaColor,
          colorWidth: micro.width,
          colorHeight: micro.height
        })
      : [];
    const [microDominante, microSegunda] = [...microScoresPorOpcion].sort((a, b) => b.score - a.score);
    const rescateMicro = Boolean(
      microDominante &&
      !metricas.dobleMarcada &&
      !opcionDetectada &&
      microDominante.score >= 0.12 &&
      microDominante.score - (microSegunda?.score ?? 0) >= 0.06 &&
      microDominante.fillRatioCore >= 0.18 &&
      microDominante.nucleusFillRatio >= 0.18 &&
      microDominante.nucleusDarknessDelta >= 0.018 &&
      microDominante.centroidOffsetRatio <= 0.42 &&
      microDominante.shapeCompactness >= 0.12 &&
      ((microSegunda?.nucleusFillRatio ?? 0) < 0.18 || (microSegunda?.score ?? 0) < 0.1)
    );
    const scoreDominante = scoresPorOpcion[0]?.score ?? 0;
    const scoreSegundo = scoresPorOpcion[1]?.score ?? 0;
    const scoreTercero = scoresPorOpcion[2]?.score ?? 0;
    const segundaSeñalAislada =
      scoreSegundo <= 0 ||
      scoreSegundo - scoreTercero >= 0.03 ||
      scoreTercero / Math.max(0.0001, scoreSegundo) <= 0.7;
    const segundaMarcaParcialConsistente =
      panelHorizontalCompacto &&
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      scoresPorOpcion[1]?.estadoMarca === 'parcial' &&
      segundaSeñalAislada &&
      // Un borde de la burbuja vecina o una sombra puede producir una señal
      // parcial en paneles compactos. Solo se clasifica como segunda marca si
      // conserva evidencia suficiente tanto en núcleo como en anillo.
      scoreSegundo >= 0.2 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.4 &&
      (scoresPorOpcion[1]?.fillRatioRing ?? 0) >= 0.28 &&
      (scoresPorOpcion[1]?.markConfidence ?? 0) >= 0.35;
    const dobleMarcadaPorForma =
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      scoresPorOpcion[1]?.estadoMarca === 'marcada' &&
      scoreSegundo >= OMR_DOUBLE_SECOND_SCORE_MIN &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= OMR_DOUBLE_SECOND_CORE_MIN &&
      scoreSegundo / Math.max(0.0001, scoreDominante) >= OMR_DOUBLE_SECOND_RATIO_MIN;
    const topEsMarcaSolida =
      scoreDominante >= 0.9 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.72 &&
      scoreSegundo / Math.max(0.0001, scoreDominante) <= 0.58;
    const anclaHorizontalConfiable = Boolean(
      panelHorizontalCompacto &&
      metricas.mejorOpcion &&
      (
        (metricas.suficiente && metricas.mejorScore >= 0.7) ||
        // Una marca valida muy oscura puede contaminar las cinco ventanas
        // por sombra/compresion. Si la dominante conserva forma compacta y
        // la segunda señal es claramente inferior, se mantiene la respuesta;
        // las dobles francas quedan protegidas por anclaNoDebeSuprimirDoble.
        (
          scoreDominante >= 0.9 &&
          (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.9 &&
          (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.62 &&
          scoreSegundo / Math.max(0.0001, scoreDominante) <= 0.42
        ) ||
        // Para una marca degradada se exige además una segunda ventana sin
        // anillo persistente; evita aceptar una doble parcial como valida.
        (
          scoreDominante >= 0.48 &&
          scoreDominante < 0.7 &&
          (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.65 &&
          (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.35 &&
          scoreSegundo / Math.max(0.0001, scoreDominante) <= 0.42 &&
          scoresPorOpcion[1]?.estadoMarca === 'marcada' &&
          (scoresPorOpcion[1]?.markConfidence ?? 1) < 0.4 &&
          (scoresPorOpcion[1]?.fillRatioRing ?? 0) < 0.22
        )
      )
    );
    const alternativaConNucleoYAnillo = scoresPorOpcion.slice(1).some(
      // Un anillo aislado de compresión o de borde puede superar los ratios
      // geométricos sin ser una segunda marca. La evidencia alternativa debe
      // conservar también una puntuación mínima para participar en el
      // rechazo de doble marca.
      (item) =>
        item.score >= 0.12 &&
        item.fillRatioCore >= 0.18 &&
        item.fillRatioRing >= 0.38 &&
        item.estadoMarca !== 'tachada'
    );
    const indiceOpcion = (opcion: string | undefined) =>
      opcion == null ? -1 : 'ABCDE'.indexOf(opcion);
    const distanciaEntreMarcas = Math.abs(
      indiceOpcion(scoresPorOpcion[0]?.opcion) - indiceOpcion(scoresPorOpcion[1]?.opcion)
    );
    const dobleMarcadaPorExtremosCompacta =
      panelHorizontalCompacto &&
      scoreDominante >= 0.9 &&
      scoresPorOpcion[1]?.estadoMarca === 'parcial' &&
      scoreSegundo >= 0.35 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.45 &&
      (scoresPorOpcion[1]?.fillRatioRing ?? 0) >= 0.25 &&
      distanciaEntreMarcas >= 3;
    const dobleMarcadaPorExtremosDegradada =
      panelHorizontalCompacto &&
      scoreDominante >= 0.82 &&
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      scoresPorOpcion[1]?.estadoMarca === 'parcial' &&
      scoreSegundo >= 0.12 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.22 &&
      (scoresPorOpcion[1]?.fillRatioRing ?? 0) >= 0.32 &&
      distanciaEntreMarcas >= 3;
    const dobleMarcadaPorAnclaCompacta =
      panelHorizontalCompacto &&
      (
        // Un panel parcialmente recortado puede producir un núcleo oscuro
        // artificial y una segunda señal alta. La forma poco compacta del
        // supuesto dominante evita aceptarlo como respuesta válida.
        (scoreDominante >= 0.9 &&
          scoreSegundo >= 0.3 &&
          (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.35 &&
          (scoresPorOpcion[1]?.fillRatioRing ?? 0) >= 0.18 &&
          scoreSegundo / Math.max(0.0001, scoreDominante) >= 0.25 &&
          (scoresPorOpcion[0]?.shapeCompactness ?? 1) < 0.6) ||
        // Una segunda señal con anillo persistente es evidencia de otra
        // burbuja marcada, aunque el núcleo haya quedado degradado.
        (scoresPorOpcion[1]?.estadoMarca === 'parcial' &&
          segundaSeñalAislada &&
          scoreSegundo >= 0.2 &&
          (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.4 &&
          (scoresPorOpcion[1]?.fillRatioRing ?? 0) >= 0.32 &&
          (scoresPorOpcion[1]?.markConfidence ?? 0) >= 0.35)
      );
    const dominanteAmbiguaConVecinaCompacta =
      panelHorizontalCompacto &&
      scoreDominante < 0.9 &&
      scoreSegundo >= 0.3 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.22 &&
      scoresPorOpcion[1]?.estadoMarca === 'marcada' &&
      distanciaEntreMarcas === 1;
    // Dos o más señales moderadas distribuidas en la fila no deben
    // convertirse en una letra solo porque el máximo relativo supera el
    // umbral. Es el patrón típico de una respuesta doble degradada: la
    // segunda burbuja conserva núcleo y contraste, pero no alcanza el score
    // de una marca limpia. Se mantiene por debajo del dominio de marcas
    // sólidas para no bloquear el rescate de un único círculo lleno.
    const alternativaConNucleoModerado = scoresPorOpcion.slice(1).some(
      (item) =>
        item.score >= 0.12 &&
        item.fillRatioCore >= 0.22 &&
        item.markConfidence >= 0.2 &&
        // El núcleo aislado de una burbuja puede ser texto o compresión. Para
        // participar en el rechazo de una doble distribuida debe conservar
        // además una forma mínimamente compacta, salvo que el núcleo sea muy
        // fuerte y esté acompañado por contraste suficiente.
        (
          item.shapeCompactness >= 0.25 ||
          (item.fillRatioCore >= 0.4 && item.markConfidence >= 0.65)
        )
    );
    const dobleMarcadaPorDistribucion =
      panelHorizontalCompacto &&
      scoreDominante >= 0.18 &&
      scoreDominante < 0.55 &&
      scoreSegundo / Math.max(0.0001, scoreDominante) >= 0.42 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) < 0.85 &&
      alternativaConNucleoModerado;
    const anclaNoDebeSuprimirDoble =
      dobleMarcadaPorExtremosCompacta ||
      dobleMarcadaPorExtremosDegradada ||
      dobleMarcadaPorAnclaCompacta ||
      dominanteAmbiguaConVecinaCompacta ||
      dobleMarcadaPorDistribucion;
    const rescateDobleArtefactoCompacto = Boolean(
      scoreDominante >= 0.28 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.7 &&
      (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.55 &&
      (scoresPorOpcion[0]?.markConfidence ?? 0) >= 0.7 &&
      scoreDominante - scoreSegundo >= 0.12 &&
      scoreSegundo <= 0.18 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 1) <= 0.5 &&
      (scoresPorOpcion[1]?.shapeCompactness ?? 1) < 0.2
    );
    const rescateDobleArtefactoAceptable = Boolean(
      rescateDobleArtefactoCompacto || (
      rescateOffsetAmplioArtefacto &&
      panelHorizontalCompacto &&
      metricas.dobleMarcada &&
      scoreDominante >= 0.9 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.95 &&
      (scoresPorOpcion[0]?.fillRatioRing ?? 1) <= 0.25 &&
      (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.72 &&
      scoreSegundo >= 0.9 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.8 &&
      (scoresPorOpcion[1]?.fillRatioRing ?? 1) < 0.22 &&
      (scoresPorOpcion[1]?.shapeCompactness ?? 1) < 0.65 &&
      scoreDominante - scoreSegundo >= 0.03 &&
      scoresPorOpcion.slice(2).every(
        (item) => item.score < 0.3 && item.fillRatioCore < 0.55 && item.markConfidence < 0.65
      )
      )
    );
    const marcaDominanteRescatable =
      (panelHorizontalCompacto &&
        scoreDominante >= 0.84 &&
        (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.9 &&
        (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.65 &&
        scoreSegundo < 0.34 &&
        (scoresPorOpcion[1]?.fillRatioRing ?? 0) < 0.18) ||
      // A single filled bubble can be classified as double when a linear
      // stroke crosses a neighbor in synthetic/low-contrast rasters. The
      // rescue is deliberately narrower than the normal single-mark path:
      // the dominant bubble must remain compact and the neighbor must be a
      // weak, non-compact signal.
      rescateDobleArtefactoCompacto ||
      // En papel fotografiado, una marca de color puede perder parte de su
      // núcleo al normalizar iluminación cálida. Si mantiene un núcleo y una
      // forma compacta con una segunda señal claramente inferior, no es doble.
      (!panelHorizontalCompacto &&
        scoreDominante >= 0.68 &&
        (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.6 &&
        (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.65 &&
        scoreSegundo < 0.22 &&
        scoreSegundo / Math.max(0.0001, scoreDominante) < 0.35 &&
        (scoresPorOpcion[0]?.centerDarknessDelta ?? 0) >= 0.25);
    const marcaSolidaConNucleoDominante =
      // A 120 dpi una marca válida puede perder puntuación global aunque su
      // núcleo siga prácticamente lleno. La evidencia del anillo vecino
      // distingue este caso de una doble marca real.
      scoreDominante >= 0.78 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.9 &&
      scoreDominante - scoreSegundo >= 0.1 &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 1) <= 0.74 &&
      (scoresPorOpcion[1]?.fillRatioRing ?? 1) <= 0.2;
    const marcaDominanteRescatableConContraste =
      marcaDominanteRescatable || marcaSolidaConNucleoDominante;
    const dobleMarcada =
      (!rescateDobleArtefactoAceptable && (!topEsMarcaSolida || anclaNoDebeSuprimirDoble)) &&
      (!anclaHorizontalConfiable || anclaNoDebeSuprimirDoble) &&
      !marcaDominanteRescatableConContraste &&
      (metricas.dobleMarcada ||
        dobleMarcadaPorForma ||
        segundaMarcaParcialConsistente ||
        dobleMarcadaPorExtremosCompacta ||
        dobleMarcadaPorExtremosDegradada ||
        dobleMarcadaPorAnclaCompacta ||
        dominanteAmbiguaConVecinaCompacta ||
        dobleMarcadaPorDistribucion ||
        (scoreDominante >= 0.72 && alternativaConNucleoYAnillo));
    const rescateSegundaPorNucleoFuerte = Boolean(
      panelHorizontalCompacto &&
      capturaBajaResolucion &&
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 1) <= 0.55 &&
      (scoresPorOpcion[0]?.fillRatioRing ?? 1) <= 0.22 &&
      (scoresPorOpcion[0]?.markConfidence ?? 1) <= 0.75 &&
      scoresPorOpcion[1]?.estadoMarca === 'parcial' &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 0) >= 0.65 &&
      (scoresPorOpcion[1]?.fillRatioRing ?? 0) >= 0.35 &&
      (scoresPorOpcion[1]?.markConfidence ?? 0) >= 0.5 &&
      (scoresPorOpcion[1]?.score ?? 0) >= 0.22 &&
      scoreDominante - (scoresPorOpcion[1]?.score ?? 0) <= 0.1
    );
    const rescatePrimeraPorNucleoFuerte = Boolean(
      panelHorizontalCompacto &&
      capturaBajaResolucion &&
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.58 &&
      (scoresPorOpcion[0]?.markConfidence ?? 0) >= 0.55 &&
      (scoresPorOpcion[0]?.centerDarknessDelta ?? 0) >= 0.08 &&
      scoresPorOpcion[1]?.estadoMarca === 'marcada' &&
      (scoresPorOpcion[1]?.fillRatioCore ?? 1) < 0.5 &&
      (scoresPorOpcion[1]?.markConfidence ?? 1) < 0.45 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) - (scoresPorOpcion[1]?.fillRatioCore ?? 1) >= 0.12 &&
      (scoresPorOpcion[0]?.centerDarknessDelta ?? 0) - (scoresPorOpcion[1]?.centerDarknessDelta ?? 1) >= 0.03 &&
      scoreDominante >= 0.26 &&
      scoreDominante - (scoresPorOpcion[1]?.score ?? 0) <= 0.12
    );
    // A 120 dpi capture can reduce a filled bubble to a score of 0.18-0.40
    // even when its core is clearly darker than the ring. If every other
    // bubble is effectively empty, that isolated evidence is safer than
    // rejecting a real answer as partial. The guard deliberately requires a
    // meaningful core and a near-zero runner-up, so it cannot revive a
    // double-marked response.
    const marcaCompactaAislada =
      panelHorizontalCompacto &&
      scoreDominante >= 0.14 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.3 &&
      scoreDominante - scoreSegundo >= 0.1 &&
      scoreSegundo <= 0.02;
    // En capturas pequeñas, una marca válida situada en el extremo del panel
    // puede conservar un núcleo claro y perder forma por la interpolación de
    // la perspectiva. Solo se rescata cuando las otras cuatro ventanas están
    // prácticamente vacías; no se aplica a dobles ni a señales distribuidas.
    const rescateMarcaAisladaBajaResolucion =
      panelHorizontalCompacto &&
      capturaBajaResolucion &&
      !dobleMarcada &&
      scoreDominante >= 0.08 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.5 &&
      scoreDominante - scoreSegundo >= 0.07 &&
      scoreSegundo <= 0.03 &&
      (scoresPorOpcion[0]?.markConfidence ?? 0) >= 0.15 &&
      (scoresPorOpcion[0]?.shapeCompactness ?? 0) >= 0.15;
    // Algunas capturas reales contienen un punto de lapiz en el centro de la
    // burbuja en lugar de un relleno completo. La señal fotometrica global
    // queda baja, pero el nucleo puede seguir siendo inequívoco. Se acepta
    // solo un nucleo central claramente separado del segundo, sin doble marca
    // ni tachadura; si dos burbujas compiten, la respuesta sigue en revision.
    const ordenPorNucleo = [...scoresPorOpcion].sort(
      (a, b) =>
        (b.fillRatioCore + b.nucleusFillRatio * 0.45 + b.nucleusDarknessDelta * 0.35) -
          (a.fillRatioCore + a.nucleusFillRatio * 0.45 + a.nucleusDarknessDelta * 0.35) ||
        b.markConfidence - a.markConfidence
    );
    const nucleoDominante = ordenPorNucleo[0];
    const segundoNucleo = ordenPorNucleo[1];
    const segundoNucleoConEvidencia = Boolean(
      segundoNucleo &&
      segundoNucleo.nucleusFillRatio >= 0.25 &&
      segundoNucleo.nucleusDarknessDelta >= 0.04
    );
    const rescatePuntoCentralAislado = Boolean(
      nucleoDominante &&
      debeAceptarPuntoCentralAisladoOmr({
        panelHorizontal: panelHorizontalCompacto,
        // Una doble aparente causada por anillo/borde no debe bloquear un
        // punto central que solo tiene un competidor sin tinta central. Si la
        // segunda burbuja también conserva núcleo oscuro, la invalidez sí se
        // mantiene.
        dobleMarcada: metricas.dobleMarcada && segundoNucleoConEvidencia,
        tachada: nucleoDominante.estadoMarca === 'tachada',
        nucleoDominante: nucleoDominante.fillRatioCore,
        segundoNucleo: segundoNucleo?.fillRatioCore ?? 0,
        masaRadial: nucleoDominante.radialMassRatio,
        desplazamientoCentro: nucleoDominante.centroidOffsetRatio,
        compacidad: nucleoDominante.shapeCompactness,
        nucleoTinta: nucleoDominante.nucleusFillRatio,
        nucleoContraste: nucleoDominante.nucleusDarknessDelta,
        componentePixels: nucleoDominante.largestComponentPixels,
        componenteFillRatio: nucleoDominante.largestComponentFillRatio,
        componenteAspectRatio: nucleoDominante.largestComponentAspectRatio
      })
    );
    const candidataNucleoRobusto = scoresPorOpcion[0];
    const rescateNucleoRobusto = Boolean(
      candidataNucleoRobusto &&
      debeAceptarNucleoRobustoOmr({
        panelHorizontal: panelHorizontalCompacto,
        // La decisión usa la resolución efectiva después de normalizar la
        // foto; de lo contrario una captura grande reducida a 1600 px nunca
        // podría usar este rescate aunque la burbuja ya esté cuantizada.
        capturaBajaResolucion: capturaBajaResolucion || width <= 1600,
        dobleMarcada,
        segundaNucleoConEvidencia: segundoNucleoConEvidencia,
        tachada: candidataNucleoRobusto.estadoMarca === 'tachada',
        scoreDominante,
        scoreSegundo,
        nucleoDominante: candidataNucleoRobusto.fillRatioCore,
        nucleoTinta: candidataNucleoRobusto.nucleusFillRatio,
        nucleoContraste: candidataNucleoRobusto.nucleusDarknessDelta,
        desplazamientoCentro: candidataNucleoRobusto.centroidOffsetRatio,
        confianza: candidataNucleoRobusto.markConfidence
      })
    );
    // La candidata de una marca tenue no puede depender del score binario:
    // cuando todas las opciones quedan por debajo del umbral, ese orden es
    // arbitrario (A por empate). Se ordena con evidencia continua del núcleo
    // y se exige margen frente a la segunda burbuja.
    const proxyMarcaTenue = (item: ScoreOpcionOmr) =>
      item.contraste * 1.4 +
      item.softCoreContrast * 0.6 +
      item.fillRatioCore * 0.12 +
      item.nucleusDarknessDelta * 0.08;
    const ordenMarcaTenue = [...scoresPorOpcion].sort(
      (a, b) => proxyMarcaTenue(b) - proxyMarcaTenue(a) || b.markConfidence - a.markConfidence
    );
    const candidataMarcaTenue = ordenMarcaTenue[0];
    const segundaMarcaTenue = ordenMarcaTenue[1];
    const rescateMarcaFaintLegacy = Boolean(
      candidataNucleoRobusto &&
      debeAceptarMarcaFaintOmr({
        panelHorizontal: panelHorizontalCompacto,
        capturaBajaResolucion: capturaBajaResolucion || width <= 1600,
        dobleMarcada,
        tachada: candidataNucleoRobusto.estadoMarca === 'tachada',
        scoreDominante,
        scoreSegundo,
        contraste: candidataNucleoRobusto.contraste,
        nucleoDominante: candidataNucleoRobusto.fillRatioCore,
        masaRadial: candidataNucleoRobusto.radialMassRatio,
        desplazamientoCentro: candidataNucleoRobusto.centroidOffsetRatio,
        compacidad: candidataNucleoRobusto.shapeCompactness,
        confianza: candidataNucleoRobusto.markConfidence
      })
    );
    const rescateMarcaFaintContinuo = Boolean(
      candidataMarcaTenue &&
      // Mantener intacto el rescate histórico cuando ya existe un score
      // binario significativo. El canal continuo solo resuelve el caso que
      // la máscara convencional dejó por debajo del umbral.
      scoreDominante < 0.16 &&
      debeAceptarMarcaFaintOmr({
        panelHorizontal: panelHorizontalCompacto,
        capturaBajaResolucion: capturaBajaResolucion || width <= 1600,
        dobleMarcada,
        tachada: candidataMarcaTenue.estadoMarca === 'tachada',
        scoreDominante: proxyMarcaTenue(candidataMarcaTenue),
        scoreSegundo: proxyMarcaTenue(segundaMarcaTenue ?? candidataMarcaTenue),
        contraste: candidataMarcaTenue.contraste,
        nucleoDominante: candidataMarcaTenue.fillRatioCore,
        masaRadial: candidataMarcaTenue.radialMassRatio,
        desplazamientoCentro: candidataMarcaTenue.centroidOffsetRatio,
        compacidad: candidataMarcaTenue.shapeCompactness,
        confianza: candidataMarcaTenue.markConfidence,
        contrasteSuave: Math.max(candidataMarcaTenue.softCoreContrast, candidataMarcaTenue.contraste),
        desplazamientoSuave: candidataMarcaTenue.softCentroidOffsetRatio,
        contrasteNucleoSuave: candidataMarcaTenue.softCoreContrast
      })
    );
    const rescateMarcaFaint = rescateMarcaFaintLegacy || rescateMarcaFaintContinuo;
    const candidataRescateFaint = rescateMarcaFaintContinuo
      ? candidataMarcaTenue
      : candidataNucleoRobusto;
    const candidataCromatica = [...scoresPorOpcion].sort(
      (a, b) => (b.contrasteCromaticoLocal ?? 0) - (a.contrasteCromaticoLocal ?? 0)
    )[0];
    const existeTachada = scoresPorOpcion.some((item) => item.estadoMarca === 'tachada');
    const rescateDoblePorTintaCromatica = Boolean(
      dobleMarcada && candidataCromatica && debeResolverDobleOmrPorTintaCromatica({
        panelHorizontal: panelHorizontalCompacto,
        tachada: existeTachada,
        scores: scoresPorOpcion
      })
    );
    const dobleMarcadaReal =
      dobleMarcada &&
      !rescatePuntoCentralAislado &&
      !rescateNucleoRobusto &&
      !rescateDoblePorTintaCromatica;
    const rescateMarcaCromatica = Boolean(
      candidataCromatica &&
      debeAceptarMarcaCromaticaAisladaOmr({
        panelHorizontal: panelHorizontalCompacto,
        dobleMarcada: dobleMarcadaReal,
        tachada: existeTachada,
        existeOpcionActual: opcionDetectada != null,
        contrasteCromaticoLocal: candidataCromatica.contrasteCromaticoLocal ?? 0,
        margenCromatico: candidataCromatica.margenCromatico ?? 0,
        fillRatioCore: candidataCromatica.fillRatioCore,
        nucleusFillRatio: candidataCromatica.nucleusFillRatio,
        centroidOffsetRatio: candidataCromatica.centroidOffsetRatio,
        softCentroidOffsetRatio: candidataCromatica.softCentroidOffsetRatio
      })
    );
    const rescateMarcaAisladaPorRasgos = rescatarMarcaAisladaPorRasgosOmr({
      panelHorizontal: panelHorizontalCompacto,
      dobleMarcada: dobleMarcadaReal,
      tachada: scoresPorOpcion.some((item) => item.estadoMarca === 'tachada'),
      scores: scoresPorOpcion
    });
    const rescatePuntoCompacto = seleccionarPuntoCompactoAisladoOmr({
      panelHorizontal: panelHorizontalCompacto,
      existeOpcionActual: opcionDetectada != null,
      dobleMarcada: dobleMarcadaReal,
      tachada: scoresPorOpcion.some((item) => item.estadoMarca === 'tachada'),
      scores: scoresPorOpcion
    });
    const rescateNucleoTenue = seleccionarNucleoTenueDominanteOmr({
      panelHorizontal: panelHorizontalCompacto,
      existeOpcionActual: opcionDetectada != null,
      dobleMarcada: dobleMarcadaReal,
      tachada: scoresPorOpcion.some((item) => item.estadoMarca === 'tachada'),
      scores: scoresPorOpcion
    });
    const formaCircularInsuficiente =
      panelHorizontalCompacto &&
      !rescateNucleoRobusto &&
      !rescateMarcaFaint &&
      scoreDominante >= 0.44 &&
      scoreDominante < 0.95 &&
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.65 &&
      (scoresPorOpcion[0]?.shapeCompactness ?? 1) < 0.45 &&
      (scoresPorOpcion[0]?.fillRatioRing ?? 1) <= 0.28;
    const marcaAmbiguaNoCompacta =
      panelHorizontalCompacto &&
      !rescateNucleoRobusto &&
      !rescateMarcaFaint &&
      scoreDominante >= 0.44 &&
      scoreDominante < 0.95 &&
      scoreSegundo >= 0.2 &&
      scoresPorOpcion[0]?.estadoMarca === 'marcada' &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.65 &&
      (scoresPorOpcion[0]?.shapeCompactness ?? 1) < 0.65 &&
      (scoresPorOpcion[0]?.fillRatioRing ?? 1) <= 0.3;
    const rescateMarcaVerticalConNucleo =
      !panelHorizontalCompacto &&
      !dobleMarcadaReal &&
      scoreDominante >= 0.24 &&
      (scoresPorOpcion[0]?.fillRatioCore ?? 0) >= 0.5 &&
      (scoresPorOpcion[0]?.fillRatioRing ?? 0) >= 0.45 &&
      scoreDominante - scoreSegundo >= 0.08 &&
      scoreSegundo <= 0.22 &&
      (scoresPorOpcion[0]?.markConfidence ?? 0) >= 0.5 &&
      scoresPorOpcion.slice(1).every((item) => item.fillRatioCore <= 0.5);
    const rescateDominanteAislada = Boolean(
      candidataNucleoRobusto &&
      debeAceptarDominanteAisladaConContrasteOmr({
        panelHorizontal: panelHorizontalCompacto,
        dobleMarcada,
        tachada: candidataNucleoRobusto.estadoMarca === 'tachada',
        scoreDominante,
        scoreSegundo,
        fillRatioCore: candidataNucleoRobusto.fillRatioCore,
        fillRatioCoreSegundo: scoresPorOpcion[1]?.fillRatioCore ?? 0,
        contraste: candidataNucleoRobusto.contraste,
        contrasteSegundo: scoresPorOpcion[1]?.contraste ?? 0,
        contrasteSuave: candidataNucleoRobusto.softCoreContrast,
        radialMassRatio: candidataNucleoRobusto.radialMassRatio,
        centroidOffsetRatio: candidataNucleoRobusto.centroidOffsetRatio,
        shapeCompactness: candidataNucleoRobusto.shapeCompactness,
        markConfidence: candidataNucleoRobusto.markConfidence
      })
    );
    const marcaParcialDominante =
      !rescatePuntoCentralAislado &&
      !rescateNucleoRobusto &&
      !rescateMarcaFaint &&
      !rescateDominanteAislada &&
      !rescatePuntoCompacto &&
      !rescateMicro &&
      !marcaCompactaAislada &&
      !rescateMarcaAisladaBajaResolucion &&
      !rescateMarcaVerticalConNucleo &&
      !dobleMarcada &&
      scoresPorOpcion[0]?.estadoMarca !== 'no_marcada' &&
      (
        (scoreDominante < OMR_PARTIAL_TOP_REJECT_SCORE &&
          (scoresPorOpcion[0]?.estadoMarca !== 'marcada' || (scoresPorOpcion[0]?.fillRatioRing ?? 0) < 0.2)) ||
        (scoreDominante < OMR_PARTIAL_CORE_SCORE_MAX &&
          (scoresPorOpcion[0]?.fillRatioCore ?? 1) < OMR_PARTIAL_CORE_MAX) ||
        // Una mancha desplazada puede llenar el núcleo y superar el umbral
        // de tinta, pero su masa no conserva la forma compacta de una marca
        // circular. En ese caso se exige revisión manual en vez de calificarla
        // como respuesta válida.
        formaCircularInsuficiente ||
        marcaAmbiguaNoCompacta
      );
    const rescateMarcaAislada = rescatePrimeraPorNucleoFuerte || rescateSegundaPorNucleoFuerte;
    const rechazoPorMarcaInvalida = !rescateMarcaCromatica && !rescatePuntoCompacto && !rescateNucleoTenue && (
      (dobleMarcadaReal && !rescateMarcaAislada) ||
      marcaParcialDominante ||
      formaCircularInsuficiente ||
      marcaAmbiguaNoCompacta
    );
    const rescateDominante = rescatePuntoCompacto
      ? {
          opcion: rescatePuntoCompacto.opcion,
          confianza: round6(Math.max(0.42, rescatePuntoCompacto.markConfidence)),
          motivo: `Rescate por punto compacto y dominante (${rescatePuntoCompacto.opcion})`
        }
      : rechazoPorMarcaInvalida && !rescateMarcaAisladaPorRasgos
        ? null
        : rescateDobleArtefactoAceptable
        ? {
            opcion: scoresPorOpcion[0]?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.9, scoresPorOpcion[0]?.markConfidence ?? 0)),
            motivo: `Rescate por forma compacta frente a artefacto vecino (${scoresPorOpcion[0]?.opcion ?? '?'})`
          }
      : rescateMarcaCromatica && candidataCromatica
        ? {
            opcion: candidataCromatica.opcion,
            confianza: round6(Math.max(0.58, candidataCromatica.markConfidence)),
            motivo: `Rescate por tinta cromática localizada y aislada (${candidataCromatica.opcion})`
          }
      : rescateDominanteAislada
        ? {
            opcion: candidataNucleoRobusto?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.66, candidataNucleoRobusto?.markConfidence ?? 0)),
            motivo: `Rescate por dominante aislada con contraste (${candidataNucleoRobusto?.opcion ?? '?'})`
          }
      : rescateMicro
        ? {
            opcion: microDominante!.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.4, microDominante!.markConfidence)),
            motivo: `Rescate micro-ROI de alta resolución (${microDominante!.opcion})`
          }
      : rescatePrimeraPorNucleoFuerte
        ? {
            opcion: scoresPorOpcion[0]?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.55, scoresPorOpcion[0]?.markConfidence ?? 0)),
            motivo: `Rescate por nucleo de candidata primaria (${scoresPorOpcion[0]?.opcion ?? '?'})`
          }
      : rescateSegundaPorNucleoFuerte
        ? {
            opcion: scoresPorOpcion[1]?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.55, scoresPorOpcion[1]?.markConfidence ?? 0)),
            motivo: `Rescate por nucleo de candidata vecina (${scoresPorOpcion[1]?.opcion ?? '?'})`
          }
      : marcaSolidaConNucleoDominante
        ? {
            opcion: scoresPorOpcion[0]?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.78, metricas.confianza)) ,
            motivo: `Rescate por nucleo dominante (${scoresPorOpcion[0]?.opcion ?? '?'})`
          }
      : rescateMarcaAisladaBajaResolucion
        ? {
            opcion: scoresPorOpcion[0]?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.34, scoresPorOpcion[0]?.markConfidence ?? 0)),
            motivo: `Rescate aislado de baja resolucion (${scoresPorOpcion[0]?.opcion ?? '?'})`
          }
      : rescatePuntoCentralAislado
        ? {
            opcion: nucleoDominante.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.42, nucleoDominante.markConfidence)),
            motivo: `Rescate por punto central aislado (${nucleoDominante.opcion})`
          }
      : rescateMarcaAisladaPorRasgos
        ? {
            opcion: rescateMarcaAisladaPorRasgos.opcion,
            confianza: round6(Math.max(0.42, rescateMarcaAisladaPorRasgos.markConfidence)),
            motivo: `Rescate de marca aislada sin alternativa compacta (${rescateMarcaAisladaPorRasgos.opcion})`
          }
      : rescateNucleoTenue
        ? {
            opcion: rescateNucleoTenue.opcion,
            confianza: round6(Math.max(0.4, rescateNucleoTenue.markConfidence)),
            motivo: `Rescate por nucleo tenue dominante y componente compacta (${rescateNucleoTenue.opcion})`
          }
      : rescateNucleoRobusto
        ? {
            opcion: candidataNucleoRobusto.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.55, candidataNucleoRobusto.markConfidence)),
            motivo: `Rescate por nucleo robusto (${candidataNucleoRobusto.opcion ?? '?'})`
          }
      : rescateMarcaFaint
        ? {
            opcion: candidataRescateFaint?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.34, candidataRescateFaint?.markConfidence ?? 0)),
            motivo: `Rescate fotometrico de marca tenue (${candidataRescateFaint?.opcion ?? '?'})`
          }
      : rescateMarcaVerticalConNucleo
        ? {
            opcion: scoresPorOpcion[0]?.opcion as OpcionRespuestaOmr,
            confianza: round6(Math.max(0.5, scoresPorOpcion[0]?.markConfidence ?? 0)),
            motivo: `Rescate vertical por nucleo y anillo (${scoresPorOpcion[0]?.opcion ?? '?'})`
          }
        : rescatarOpcionDominantePorScores(
            scoresPorOpcion,
            opcionDetectada,
            metricas.confianza,
            panelHorizontalCompacto && capturaBajaResolucion
          );
    let confianzaPregunta = metricas.confianza;
    if (rechazoPorMarcaInvalida && !rescateMarcaAisladaPorRasgos) {
      opcionDetectada = null;
      confianzaPregunta = Math.min(confianzaPregunta, 0.5);
    } else if (!opcionDetectada && rescateDominante) {
      opcionDetectada = rescateDominante.opcion;
      confianzaPregunta = Math.max(metricas.confianza, rescateDominante.confianza);
      advertencias.push(`P${pregunta.numeroPregunta}: ${rescateDominante.motivo}`);
    }
    // El ancla geométrica solo puede resolver una lectura válida; nunca debe
    // reactivar una opción que el análisis de forma ya rechazó como doble o
    // parcial. La prioridad conservadora evita convertir marcas inválidas en
    // respuestas calificables.
    if (
      anclaHorizontalConfiable &&
      metricas.mejorOpcion &&
      !rechazoPorMarcaInvalida &&
      !rescateMarcaCromatica
    ) {
      opcionDetectada = metricas.mejorOpcion as OpcionRespuestaOmr;
      confianzaPregunta = Math.max(confianzaPregunta, metricas.confianza);
    }

    // Una ruta de recuperacion distinta puede volver a elegir la misma
    // componente diminuta que el detector de punto central ya rechazo. No
    // convertir ese residuo aislado (etiquetado como no marcado) en respuesta.
    const opcionElegidaSinTinta = scoresPorOpcion.find(
      (item) => item.opcion === opcionDetectada && item.estadoMarca === 'no_marcada'
    );
    if (opcionElegidaSinTinta && pareceResiduoDeCompresionOmr(opcionElegidaSinTinta)) {
      opcionDetectada = null;
      confianzaPregunta = 0;
    }

    const flags: Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi' | 'parcial_detectada' | 'tachada_detectada'> = [];
    const hayEvidenciaMarca = scoresPorOpcion.some((item) =>
      item.estadoMarca !== 'no_marcada'
    );
    // La evidencia nueva se aplica después de fusionar hipótesis para que una
    // marca tenue no contamine la decisión ni suprima una letra recuperable.
    const intentosMarcaDebil = scoresPorOpcion.filter(esIntentoCircularTenueOmr);
    const hayIntentoMarcaDebil = intentosMarcaDebil.length === 1;
    if (dobleMarcadaReal && !rescateDominante) flags.push('doble_marca');
    // Un reactivo en blanco es una lectura válida y no debe contaminar el
    // ratio de ambigüedad. La bandera solo se agrega cuando hay tinta o forma
    // parcial que realmente compita con una respuesta.
    if (
      hayEvidenciaMarca &&
      (!metricas.suficiente || confianzaPregunta < umbralRespuestaConf) &&
      !rescateDominante
    ) flags.push('bajo_contraste');
    if (scoresPorOpcion.some((item) => item.estadoMarca === 'tachada')) {
      flags.push('tachada_detectada');
    } else if (!rescateMarcaCromatica && scoresPorOpcion.some((item) => item.estadoMarca === 'parcial')) {
      flags.push('parcial_detectada');
    } else if (hayIntentoMarcaDebil && !opcionDetectada) {
      flags.push('parcial_detectada');
    }
    respuestasDetectadas.push({
      numeroPregunta: pregunta.numeroPregunta,
      opcion: opcionDetectada,
      confianza: confianzaPregunta,
      scoresPorOpcion,
      flags,
      estadoRespuesta: clasificarEstadoRespuestaOmr({ opcion: opcionDetectada, flags })
    });
    if (esRespuestaAmbiguaOmr({ opcion: opcionDetectada, flags })) {
      preguntasAmbiguas += 1;
      if (dobleMarcadaReal && !rescateDominante) {
        motivosRevision.push(`P${pregunta.numeroPregunta}: multiple marca / ambiguedad`);
      } else if (metricas.suficiente && confianzaPregunta < OMR_RESPUESTA_CONF_MIN) {
        motivosRevision.push(`P${pregunta.numeroPregunta}: confianza baja (${confianzaPregunta.toFixed(2)})`);
      }
    }

    for (const s of resultado.scores) {
      patches.push({
        numeroPregunta: pregunta.numeroPregunta,
        letra: s.letra,
        x: s.x,
        y: s.y,
        score: s.score,
        confianzaPregunta: metricas.confianza,
        seleccionada: s.letra === opcionDetectada,
        opcionDetectada
      });
    }

    if (debug) {
      const centrosConScore = centros.map((item) => {
        const scoreItem = resultado.scores.find((s) => s.letra === item.letra);
        const rasgosItem = scoresPorOpcion.find((s) => s.opcion === item.letra);
        return {
          letra: item.letra,
          x: scoreItem?.x ?? item.punto.x,
          y: scoreItem?.y ?? item.punto.y,
          score: scoreItem?.score ?? 0,
          estadoMarca: rasgosItem?.estadoMarca,
          markConfidence: rasgosItem?.markConfidence,
          fillRatioCore: rasgosItem?.fillRatioCore,
          fillRatioRing: rasgosItem?.fillRatioRing,
          centerDarknessDelta: rasgosItem?.centerDarknessDelta,
          centerMean: rasgosItem?.centerMean,
          softCoreContrast: rasgosItem?.softCoreContrast,
          softCentroidOffsetRatio: rasgosItem?.softCentroidOffsetRatio,
          ringMean: rasgosItem?.ringMean,
          outerMean: rasgosItem?.outerMean,
          nucleusFillRatio: rasgosItem?.nucleusFillRatio,
          nucleusDarknessDelta: rasgosItem?.nucleusDarknessDelta,
          strokeLeakPenalty: rasgosItem?.strokeLeakPenalty,
          fillDelta: rasgosItem?.fillDelta,
          contraste: rasgosItem?.contraste,
          radialMassRatio: rasgosItem?.radialMassRatio,
          centroidOffsetRatio: rasgosItem?.centroidOffsetRatio,
          shapeCompactness: rasgosItem?.shapeCompactness,
          contrasteCromaticoLocal: rasgosItem?.contrasteCromaticoLocal,
          margenCromatico: rasgosItem?.margenCromatico
        };
      });
      debug.preguntas.push({
        numeroPregunta: pregunta.numeroPregunta,
        panelHorizontalCompacto,
        rescateMarcaFaint,
        mejorOpcion: metricas.mejorOpcion,
        mejorScore: metricas.mejorScore,
        segundoScore: metricas.segundoScore,
        dobleMarcadaReal,
        rescateDoblePorTintaCromatica,
        rescateMarcaCromatica,
        delta: metricas.delta,
        dobleMarcada: dobleMarcadaReal,
        suficiente: metricas.suficiente,
        opcionDetectada,
        confianzaPregunta,
        flags,
        microRescate: rescateMicro,
        microScores: microScoresPorOpcion.slice(0, 2).map((item) => ({
          opcion: item.opcion,
          score: item.score,
          fillRatioCore: item.fillRatioCore,
          contraste: item.contraste,
          radialMassRatio: item.radialMassRatio,
          centroidOffsetRatio: item.centroidOffsetRatio,
          nucleusFillRatio: item.nucleusFillRatio,
          nucleusDarknessDelta: item.nucleusDarknessDelta,
          shapeCompactness: item.shapeCompactness,
          markConfidence: item.markConfidence,
          contrasteCromaticoLocal: item.contrasteCromaticoLocal,
          margenCromatico: item.margenCromatico
        })),
        dx: mejorDx,
        dy: mejorDy,
        scoreMean: metricas.scoreMean,
        scoreStd: metricas.scoreStd,
        scoreThreshold: metricas.scoreThreshold,
        centros: centrosConScore
      });
    }
  });

  if (debug) {
    try {
      const folioSafe = String(debugInfo?.folio || 'sin-folio').replace(/[^a-zA-Z0-9_-]/g, '');
      const paginaSafe = String(debugInfo?.numeroPagina || mapaPagina.numeroPagina || '0');
      const dir = path.join(OMR_DEBUG_DIR, folioSafe);
      await fs.mkdir(dir, { recursive: true });
      const baseName = `P${paginaSafe}_${Date.now()}`;
      const jsonPath = path.join(dir, `${baseName}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(debug, null, 2), 'utf8');

      const top2PorPregunta = new Map<number, { primero?: string; segundo?: string }>();
      for (const p of debug.preguntas) {
        const orden = [...p.centros].sort((a, b) => b.score - a.score);
        top2PorPregunta.set(p.numeroPregunta, { primero: orden[0]?.letra, segundo: orden[1]?.letra });
      }

      const svgPartes: string[] = [];
      svgPartes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`);
      svgPartes.push(`<rect width="100%" height="100%" fill="none"/>`);
      for (const p of debug.preguntas) {
        const top2 = top2PorPregunta.get(p.numeroPregunta) || {};
        for (const c of p.centros) {
          const color =
            c.letra === top2.primero
              ? '#22c55e'
              : c.letra === top2.segundo
                ? '#f59e0b'
                : '#38bdf8';
          svgPartes.push(
            `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="6" stroke="${color}" stroke-width="2" fill="none" />`
          );
          svgPartes.push(
            `<text x="${(c.x + 7).toFixed(2)}" y="${(c.y - 6).toFixed(2)}" font-size="10" fill="${color}" font-family="Arial">${c.letra}</text>`
          );
        }
      }
      svgPartes.push(`</svg>`);
      const svg = Buffer.from(svgPartes.join(''));

      const buffer = Buffer.from(limpiarBase64(imagenBase64), 'base64');
      await sharp(buffer)
        .rotate()
        .normalize()
        .resize({ width })
        .composite([{ input: svg, top: 0, left: 0 }])
        .png()
        .toFile(path.join(dir, `${baseName}.png`));
    } catch {
      // No bloquea flujo si falla el debug.
    }
  }
  // Invariante de calificación: una respuesta con evidencia de doble marca
  // o tachado nunca puede conservar una letra calificable, aunque una etapa
  // de rescate haya producido una opción dominante.
  let respuestasFinales = respuestasDetectadas.map((respuesta) => {
    const marcaInvalida = respuesta.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada');
    if (!marcaInvalida || respuesta.opcion == null) return respuesta;
    return {
      ...respuesta,
      opcion: null,
      confianza: Math.min(0.5, respuesta.confianza),
      estadoRespuesta: clasificarEstadoRespuestaOmr({ opcion: null, flags: respuesta.flags })
    };
  });
  preguntasAmbiguas = respuestasFinales.filter(esRespuestaAmbiguaOmr).length;

  // Recalcular después de normalizar dobles/tachaduras: no debe conservarse
  // una confianza alta de una respuesta que acaba de quedar invalidada.
  const confianzaMedia = respuestasFinales.length
    ? respuestasFinales.reduce((total, respuesta) => total + Math.max(0, respuesta.confianza), 0) / respuestasFinales.length
    : 0;
  const ratioAmbiguas = respuestasFinales.length > 0 ? preguntasAmbiguas / respuestasFinales.length : 1;
  const respuestasAnalizadas = respuestasFinales.length - preguntasAmbiguas;
  const reprojectionErrorPromedio =
    reprojectionErrorConteo > 0 ? reprojectionErrorAcumulado / reprojectionErrorConteo : 2.8;
  const metricasImagen = calcularMetricasImagen(gray, width, height);
  const geometryLocalValidated = usarGeometriaLocalEfectiva && reprojectionErrorConteo > 0;
  const factorTransformacion =
    transformacionBase.tipo === 'escala'
      ? geometryLocalValidated ? 0.84 : 0.72
      : transformacionBase.tipo === 'homografia' ? 0.9 : 1;
  const geomQuality = clamp01(
    reprojectionErrorConteo > 0
      ? (1 - reprojectionErrorPromedio / 7) * factorTransformacion
      : geometriaConfiable
        ? referenciaPaginaCalidad * factorTransformacion
        : (1 - reprojectionErrorPromedio / 7) * factorTransformacion
  );
  const photoQuality =
    clamp01((metricasImagen.blurVar - 50) / 320) * 0.45 +
    clamp01(1 - Math.abs(metricasImagen.brilloMedio - 145) / 120) * 0.35 +
    clamp01(1 - metricasColor.colorCast / 0.24) * 0.2;
  const calidadPagina = calcularCalidadPagina({
    tipoTransformacion: transformacionBase.tipo,
    qrDetectado: Boolean(qrTexto),
    reprojectionErrorPromedio,
    blurVar: metricasImagen.blurVar,
    brilloMedio: metricasImagen.brilloMedio,
    colorCast: metricasColor.colorCast,
    saturationMean: metricasColor.saturationMean,
    confianzaMedia,
    ratioAmbiguas,
    referenciaPaginaCalidad
  });
  if (OMR_QUALITY_WARN_MIN >= 0 && calidadPagina < OMR_QUALITY_WARN_MIN) {
    advertencias.push(`Calidad de pagina baja (${calidadPagina.toFixed(2)})`);
  }
  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina,
    confianzaMedia,
    ratioAmbiguas,
    totalRespuestas: respuestasDetectadas.length,
    respuestasAnalizadas,
    geometriaConfiable
  });
  const estadoAnalisis: ResultadoOmr['estadoAnalisis'] = decisionEstado.estado;
  if (decisionEstado.anularRespuestas) {
    respuestasFinales = respuestasFinales.map((respuesta) => ({
      ...respuesta,
      opcion: null,
      confianza: 0,
      estadoRespuesta: 'ambigua' as const
    }));
  }
  motivosRevision.push(...decisionEstado.motivos);
  advertencias.push(...decisionEstado.advertencias);
  try {
    await exportarPatchesOmr(data, width, height, patches, {
      folio: debugInfo?.folio,
      numeroPagina: debugInfo?.numeroPagina ?? mapaPagina.numeroPagina
    });
  } catch {
    // No bloquea flujo si falla export de patches.
  }

  const motivosUnicos = Array.from(new Set(motivosRevision)).slice(0, 24);
  const resultadoBase: ResultadoOmr = {
    respuestasDetectadas: respuestasFinales,
    advertencias,
    qrTexto,
    qrFuenteDeteccion,
    calidadPagina,
    estadoAnalisis,
    motivosRevision: motivosUnicos,
    templateVersionDetectada,
    confianzaPromedioPagina: confianzaMedia,
    ratioAmbiguas,
    resumenRespuestas: resumirRespuestasOmr(
      respuestasFinales,
      calidadPagina,
      geomQuality,
      { forzarRevision: decisionEstado.anularRespuestas }
    ),
    engineVersion: 'omr-cv',
    engineRelease: OMR_ENGINE_RELEASE,
    geomQuality,
    photoQuality: clamp01(photoQuality),
    decisionPolicy: 'conservadora_v2',
    geometryMode: transformar === transformarEscala ? 'escala' : transformacionBase.tipo,
    geometryReferencePoints: Number(transformacionBase.referenciaPagina?.puntosDetectados ?? 0),
    geometryReferenceQuality: referenciaPaginaCalidad,
    pageRotationDegrees: transformacionBase.referenciaPagina.tipo === 'escala'
      ? undefined
      : transformacionBase.referenciaPagina.orientacionGrados,
    pageSkewDegrees: transformacionBase.referenciaPagina.tipo === 'escala'
      ? undefined
      : transformacionBase.referenciaPagina.inclinacionGrados,
    pageOrientationDetermined: transformacionBase.referenciaPagina.orientacionDeterminada ?? false,
    pageOrientationConfidence: 'confianzaOrientacion' in transformacionBase.referenciaPagina
      ? transformacionBase.referenciaPagina.confianzaOrientacion
      : undefined,
    pageOrientationMargin: 'margenOrientacion' in transformacionBase.referenciaPagina
      ? transformacionBase.referenciaPagina.margenOrientacion
      : undefined,
    pageOrientationSource: transformacionBase.referenciaPagina.fuenteOrientacion ?? 'indeterminada',
    pageOrientationConflict: transformacionBase.referenciaPagina.conflictoOrientacion ?? false,
    geometryLocalEnabled: geometryLocalValidated,
    orientationMode
  };

  if (!opcionesInternas?.noRetry && debeIntentarSegundoPase(resultadoBase)) {
    const coberturaBase = resultadoBase.respuestasDetectadas.length > 0
      ? resultadoBase.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length /
        resultadoBase.respuestasDetectadas.length
      : 0;
    // La segunda hipotesis puede corregir la transformacion global y se
    // ejecuta ante cualquier reactivo pendiente; el consenso posterior limita
    // los rescates a mejoras sin perdida de cobertura.
    const usarAltaResolucionRescate = debeUsarRescateAltaResolucionOmr(
      resultadoBase.estadoAnalisis,
      coberturaBase
    );
    const resultadoRescate = await analizarOmr(
      imagenBase64,
      mapaPagina,
      qrEsperado,
      margenMm,
      debugInfo,
      {
        aggressivePreprocess: true,
        highResolutionRescue: usarAltaResolucionRescate && coberturaBase < 0.75,
        noRetry: true,
        rescueFiduciales: OMR_SECOND_PASS_FIDUCIALES_RESCUE,
        disableLocalGeometry: usarGeometriaLocal
      }
    );
    const fusion = fusionarResultadosOmr(resultadoBase, resultadoRescate);
    const scoreBase = puntuarResultadoOmr(resultadoBase);
    const scoreRescate = puntuarResultadoOmr(resultadoRescate);
    const scoreFusion = puntuarResultadoOmr(fusion);
    const coberturaResultado = (resultado: ResultadoOmr) => resultado.respuestasDetectadas.length > 0
      ? resultado.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length /
        resultado.respuestasDetectadas.length
      : 0;
    const coberturaRescate = coberturaResultado(resultadoRescate);
    const coberturaFusion = coberturaResultado(fusion);
    const conteoInvalidantesPorPregunta = new Map<number, number>();
    for (const resultado of [resultadoBase, resultadoRescate]) {
      for (const respuesta of resultado.respuestasDetectadas) {
        if (!respuesta.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada')) continue;
        conteoInvalidantesPorPregunta.set(
          respuesta.numeroPregunta,
          (conteoInvalidantesPorPregunta.get(respuesta.numeroPregunta) ?? 0) + 1
        );
      }
    }
    // Una sola pasada puede confundir ruido/borde con doble marca. El consenso
    // ya decide si la otra pasada ofrece una candidata suficientemente fuerte;
    // solo se fuerza abstencion cuando ambas pasadas confirman invalidez.
    const preguntasConMarcaInvalida = new Set(
      Array.from(conteoInvalidantesPorPregunta.entries())
        .filter(([, conteo]) => conteo >= 2)
        .map(([numeroPregunta]) => numeroPregunta)
    );
    let resultadoElegido = resultadoBase;
    if (preguntasConMarcaInvalida.size > 0) {
      const respuestasConservadoras = fusion.respuestasDetectadas.map((respuesta) => {
        // El consenso ya puede haber rescatado una candidata válida frente a
        // un falso positivo de borde en una sola pasada. La confirmación de
        // invalidez solo debe anular una pregunta que quedó sin candidata;
        // nunca debe borrar una letra que el consenso justificó.
        if (!preguntasConMarcaInvalida.has(respuesta.numeroPregunta) || respuesta.opcion != null) return respuesta;
        return {
          ...respuesta,
          opcion: null,
          confianza: Math.min(0.5, respuesta.confianza),
          flags: Array.from(new Set([...respuesta.flags, 'doble_marca' as const])) as RespuestaDetectadaOmr['flags']
        };
      });
      fusion.respuestasDetectadas = respuestasConservadoras;
      fusion.advertencias = Array.from(
        new Set([...fusion.advertencias, 'Segundo pase OMR conservó marca inválida confirmada'])
      );
      resultadoElegido = fusion;
    } else {
      const fusionMejoraSinPerderCobertura = scoreFusion >= scoreBase && coberturaFusion >= coberturaBase;
      const rescateMejoraSinPerderCobertura = scoreRescate > scoreBase && coberturaRescate >= coberturaBase;
      if (fusionMejoraSinPerderCobertura || rescateMejoraSinPerderCobertura) {
      const elegido = fusionMejoraSinPerderCobertura && scoreFusion >= scoreRescate ? fusion : resultadoRescate;
      elegido.advertencias = Array.from(
        new Set([...elegido.advertencias, scoreFusion >= scoreRescate ? 'Segundo pase OMR fusionado por mejora' : 'Segundo pase OMR rescato detecciones'])
      );
        resultadoElegido = elegido;
      } else {
        resultadoBase.advertencias.push('Segundo pase OMR descartado por no mejorar');
      }
      // La seleccion de la hipotesis alternativa nunca puede reducir la
      // cobertura de la pasada base. Si la fusion empeora cobertura por una
      // penalizacion de confianza, se conserva la base y solo se admiten
      // rescates aditivos posteriores.
      if (coberturaResultado(resultadoElegido) < coberturaBase) {
        resultadoElegido = resultadoBase;
        resultadoElegido.advertencias = Array.from(
          new Set([...resultadoElegido.advertencias, 'Fusion OMR descartada por perdida de cobertura'])
        );
      }
    }
    const quedanPreguntasSinResolver = resultadoElegido.respuestasDetectadas.some((respuesta) => respuesta.opcion == null);
    const habilitarConsensoGeometricoAlterno = debeEvaluarConsensoHomografiaEscalaOmr(resultadoBase);
    const habilitarRescateAltaResolucionGeometriaLocal =
      debeEvaluarRescateAltaResolucionGeometriaLocalOmr(resultadoBase);
    const usarAltaPorConflictoDeFusion =
      quedanPreguntasSinResolver &&
      resultadoElegido.estadoAnalisis !== 'rechazado_calidad' &&
      resultadoElegido.respuestasDetectadas.some((respuesta) =>
        tieneIntentoParcialPendienteOmr(respuesta) || tieneDominanteFuertePendienteOmr(respuesta)
      );
    let resultadoAltaResolucion = usarAltaResolucionRescate && coberturaBase < 0.75
      ? resultadoRescate
      : null;
    if ((usarAltaResolucionRescate || usarAltaPorConflictoDeFusion) && quedanPreguntasSinResolver) {
      resultadoAltaResolucion = await analizarOmr(
        imagenBase64,
        mapaPagina,
        qrEsperado,
        margenMm,
        debugInfo,
        {
          aggressivePreprocess: true,
          highResolutionRescue: true,
          noRetry: true,
          rescueFiduciales: OMR_SECOND_PASS_FIDUCIALES_RESCUE,
          disableLocalGeometry: usarGeometriaLocal
        }
      );
    }
    if (resultadoAltaResolucion && quedanPreguntasSinResolver) {
      const fusionAltaResolucion = fusionarResultadosOmr(
        resultadoElegido,
        resultadoAltaResolucion,
        [resultadoBase, resultadoRescate]
      );
      const resultadoAditivo = fusionarRescateAditivoOmr(
        resultadoElegido,
        fusionAltaResolucion,
        resultadoAltaResolucion,
        mapaPagina
      );
      const coberturaAditiva = coberturaResultado(resultadoAditivo);
      const coberturaElegida = coberturaResultado(resultadoElegido);
      if (coberturaAditiva > coberturaElegida) {
        resultadoAditivo.advertencias = Array.from(
          new Set([...resultadoAditivo.advertencias, 'Rescate OMR de alta resolución completó reactivos pendientes sin sustituir respuestas previas'])
        );
        resultadoElegido = resultadoAditivo;
      }
      if (
        habilitarConsensoGeometricoAlterno &&
        resultadoBase.resumenRespuestas?.examenVacio !== true &&
        debeEvaluarConsensoHomografiaEscalaOmr(resultadoAltaResolucion)
      ) {
        const resultadoHomografiaAlterna = await analizarOmr(
          imagenBase64,
          mapaPagina,
          qrEsperado,
          margenMm,
          debugInfo,
          {
            // Aislar la hipótesis geométrica: el preprocesamiento agresivo y
            // el reescalado de alta resolución pueden borrar puntos pequeños,
            // que son precisamente el caso que este contraste debe resolver.
            aggressivePreprocess: false,
            highResolutionRescue: false,
            noRetry: true,
            rescueFiduciales: OMR_SECOND_PASS_FIDUCIALES_RESCUE,
            disableLocalGeometry: true,
            forceHomographyGeometry: true
          }
        );
        const resultadoConsensoGeometrico = fusionarRescateAditivoOmr(
          resultadoElegido,
          resultadoElegido,
          resultadoHomografiaAlterna,
          mapaPagina,
          resultadoAltaResolucion,
          true
        );
        if (coberturaResultado(resultadoConsensoGeometrico) > coberturaResultado(resultadoElegido)) {
          resultadoConsensoGeometrico.advertencias = Array.from(new Set([
            ...resultadoConsensoGeometrico.advertencias,
            'Rescate OMR aceptado por consenso independiente entre escala y homografia; sin sustituir respuestas previas'
          ]));
          resultadoElegido = resultadoConsensoGeometrico;
        }
      }
    }
    if (
      habilitarRescateAltaResolucionGeometriaLocal &&
      !resultadoBase.resumenRespuestas?.examenVacio &&
      resultadoElegido.respuestasDetectadas.some((respuesta) => respuesta.opcion == null)
    ) {
      const resultadoAltaResolucionGeometriaLocal = await analizarOmr(
        imagenBase64,
        mapaPagina,
        qrEsperado,
        margenMm,
        debugInfo,
        {
          aggressivePreprocess: true,
          highResolutionRescue: true,
          noRetry: true,
          rescueFiduciales: OMR_SECOND_PASS_FIDUCIALES_RESCUE,
          disableLocalGeometry: false
        }
      );
      const resultadoAditivoLocal = fusionarRescateAditivoOmr(
        resultadoElegido,
        resultadoElegido,
        resultadoAltaResolucionGeometriaLocal,
        mapaPagina,
        undefined,
        true
      );
      if (coberturaResultado(resultadoAditivoLocal) > coberturaResultado(resultadoElegido)) {
        resultadoAditivoLocal.advertencias = Array.from(new Set([
          ...resultadoAditivoLocal.advertencias,
          'Rescate OMR local de alta resolución completó reactivos pendientes sin sustituir respuestas previas'
        ]));
        resultadoElegido = resultadoAditivoLocal;
      }
      const resultadoConsensoTenue = rescatarMarcaTenueConsensuadaEntrePasadasOmr(
        resultadoElegido,
        [
          resultadoBase.respuestasDetectadas,
          resultadoRescate.respuestasDetectadas,
          ...(resultadoAltaResolucion ? [resultadoAltaResolucion.respuestasDetectadas] : []),
          resultadoAltaResolucionGeometriaLocal.respuestasDetectadas
        ],
        mapaPagina
      );
      if (coberturaResultado(resultadoConsensoTenue) > coberturaResultado(resultadoElegido)) {
        resultadoConsensoTenue.advertencias = Array.from(new Set([
          ...resultadoConsensoTenue.advertencias,
          'Rescate tenue confirmado por dos pasadas locales, centradas y sin competidoras'
        ]));
        resultadoElegido = resultadoConsensoTenue;
      }
    }
    if (!opcionesInternas?.noRetry) {
      const resultadoRasgosAislados = fusionarRescateAditivoOmr(
        resultadoElegido,
        resultadoElegido,
        resultadoElegido,
        mapaPagina
      );
      const coberturaElegida = resultadoElegido.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length;
      const coberturaRasgos = resultadoRasgosAislados.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length;
      if (coberturaRasgos > coberturaElegida) {
        resultadoRasgosAislados.advertencias = Array.from(
          new Set([...resultadoRasgosAislados.advertencias, 'Rescate OMR conservador completó marcas aisladas con baja confianza; requiere revisión'])
        );
        resultadoElegido = resultadoRasgosAislados;
      }
    }
    return agregarIntentosNoResueltosAlResultadoOmr(
      aplicarAbstencionPorOrientacionOmr(resultadoElegido),
      {
        permitirMicrocomponenteRelativo: !opcionesInternas?.noRetry
      }
    );
  } else if (!opcionesInternas?.noRetry && resultadoBase.estadoAnalisis !== 'ok') {
    resultadoBase.advertencias.push('Segundo pase OMR omitido: geometria o señal no apta para rescate');
  }

  if (!opcionesInternas?.noRetry) {
    const resultadoRasgosAislados = fusionarRescateAditivoOmr(
      resultadoBase,
      resultadoBase,
      resultadoBase,
      mapaPagina
    );
    const coberturaBase = resultadoBase.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length;
    const coberturaRasgos = resultadoRasgosAislados.respuestasDetectadas.filter((respuesta) => respuesta.opcion != null).length;
    if (coberturaRasgos > coberturaBase) {
      resultadoRasgosAislados.advertencias = Array.from(
        new Set([...resultadoRasgosAislados.advertencias, 'Rescate OMR conservador completó marcas aisladas con baja confianza; requiere revisión'])
      );
      return agregarIntentosNoResueltosAlResultadoOmr(
        aplicarAbstencionPorOrientacionOmr(resultadoRasgosAislados),
        {
          permitirMicrocomponenteRelativo: !opcionesInternas?.noRetry
        }
      );
    }
  }
  return agregarIntentosNoResueltosAlResultadoOmr(
    aplicarAbstencionPorOrientacionOmr(resultadoBase),
    {
      permitirMicrocomponenteRelativo: !opcionesInternas?.noRetry
    }
  );
}
