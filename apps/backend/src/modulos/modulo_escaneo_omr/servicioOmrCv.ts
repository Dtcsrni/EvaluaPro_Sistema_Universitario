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
} from './omrCore';
import * as porFolioDatasetModule from './porFolioDataset';
import type { PanelDarknessDetection } from './porFolioDataset';
import { UMBRALES_OMR_AUTO, evaluarRescateAltaPrecisionOmr } from './politicaAutoCalificacionOmr';
import {
  calcularIntegral,
  detectarOpcion,
  detectarQrMejorado,
  extraerSubimagenRgba,
  mediaEnVentana,
  obtenerTransformacion
} from './infra/imagenProcesamientoCv';

type OpcionRespuestaOmr = 'A' | 'B' | 'C' | 'D' | 'E';

export type ScoreOpcionOmr = {
  opcion: OpcionRespuestaOmr;
  score: number;
  fillRatioCore: number;
  fillRatioRing: number;
  centerDarknessDelta: number;
  strokeLeakPenalty: number;
  shapeCompactness: number;
  markConfidence: number;
  estadoMarca: 'no_marcada' | 'parcial' | 'marcada' | 'tachada';
};

export type RespuestaDetectadaOmr = {
  numeroPregunta: number;
  opcion: OpcionRespuestaOmr | null;
  confianza: number;
  scoresPorOpcion: ScoreOpcionOmr[];
  flags: Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi' | 'parcial_detectada' | 'tachada_detectada'>;
};

type FlagRespuestaOmr = RespuestaDetectadaOmr['flags'][number];
type AnalyzePanelsFn = (imageBuffer: Buffer, questionNumbers: number[]) => Promise<PanelDarknessDetection[]>;

const analyzeOmrPanelsFromImageBuffer = (
  (porFolioDatasetModule as {
    analyzeOmrPanelsFromImageBuffer?: AnalyzePanelsFn;
    default?: {
      analyzeOmrPanelsFromImageBuffer?: AnalyzePanelsFn;
    };
    'module.exports'?: {
      analyzeOmrPanelsFromImageBuffer?: AnalyzePanelsFn;
    };
  }).analyzeOmrPanelsFromImageBuffer ??
  (porFolioDatasetModule as { default?: { analyzeOmrPanelsFromImageBuffer?: AnalyzePanelsFn } }).default
    ?.analyzeOmrPanelsFromImageBuffer ??
  (porFolioDatasetModule as { 'module.exports'?: { analyzeOmrPanelsFromImageBuffer?: AnalyzePanelsFn } })['module.exports']
    ?.analyzeOmrPanelsFromImageBuffer
) as AnalyzePanelsFn;

export type ResultadoOmr = {
  respuestasDetectadas: RespuestaDetectadaOmr[];
  advertencias: string[];
  qrTexto?: string;
  calidadPagina: number;
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  motivosRevision: string[];
  templateVersionDetectada: TemplateVersion;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
  engineVersion: 'omr-v1-cv' | 'omr-v3-cv' | 'omr-v4-cv';
  geomQuality: number;
  photoQuality: number;
  decisionPolicy: 'conservadora_v1';
};

type Punto = { x: number; y: number };
type TemplateVersion = 1 | 3 | 4;
type PerfilGeometriaOmr = 'actual' | 'geo_tight_search';

type MapaOmrPagina = {
  numeroPagina: number;
  templateVersion?: TemplateVersion;
  markerSpec?: {
    family?: 'aruco_4x4_50';
    sizeMm?: number;
    quietZoneMm?: number;
  };
  blockSpec?: {
    preguntasPorBloque?: number;
    opcionesPorPregunta?: number;
    bubbleDiameterMm?: number;
    bubblePitchYmm?: number;
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
    perfilOmr?: { radio?: number; pasoY?: number; cajaAncho?: number };
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
const MM_A_PUNTOS = 72 / 25.4; const QR_SIZE_PTS_V1 = 68; const QR_SIZE_PTS_V2 = 88;

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
  const entorno = String(process.env.NODE_ENV || 'development').toLowerCase();
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
const OMR_BOX_WIDTH_PTS = Number.parseFloat(process.env.OMR_BOX_WIDTH_PTS || '42');
const OMR_LOCAL_DRIFT_PENALTY = Number.parseFloat(process.env.OMR_LOCAL_DRIFT_PENALTY || '0.08');
const OMR_LOCAL_SEARCH_RATIO = Number.parseFloat(process.env.OMR_LOCAL_SEARCH_RATIO || String(GEOMETRIA_OMR_DEFAULT.localSearchRatio));
const OMR_MAX_CENTER_DRIFT_RATIO = Number.parseFloat(process.env.OMR_MAX_CENTER_DRIFT_RATIO || '0.42');
const OMR_MIN_SAFE_RANGE = Number.parseFloat(process.env.OMR_MIN_SAFE_RANGE || '4');
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

function resolverPerfilDeteccion(templateVersion: TemplateVersion): PerfilDeteccionOmr {
  if (templateVersion === 1) {
    return {
      version: 1,
      qrSizePts: 20 * MM_A_PUNTOS,
      bubbleRadiusPts: (5 * MM_A_PUNTOS) / 2,
      bubblePitchYPts: 8.8,
      boxWidthPts: Math.max(54, OMR_BOX_WIDTH_PTS * 1.15),
      centerToLeftPts: 9.5,
      alignRange: Math.max(14, OMR_ALIGN_RANGE * 0.72),
      vertRange: Math.max(8, OMR_VERT_RANGE * 0.72),
      localSearchRatio: Math.max(0.18, OMR_LOCAL_SEARCH_RATIO * 0.72),
      localDriftPenalty: Math.max(0.06, OMR_LOCAL_DRIFT_PENALTY * 0.85),
      maxCenterDriftRatio: Math.max(0.18, OMR_MAX_CENTER_DRIFT_RATIO * 0.6),
      minSafeRange: Math.max(4, OMR_MIN_SAFE_RANGE),
      scoreMin: Math.max(0.035, OMR_SCORE_MIN * 0.92),
      scoreStd: Math.max(0.5, OMR_SCORE_STD * 0.92),
      strongScore: Math.max(0.05, OMR_STRONG_SCORE * 0.9),
      secondRatio: Math.max(0.68, OMR_SECOND_RATIO * 0.92),
      deltaMin: Math.max(0.008, OMR_DELTA_MIN * 0.92),
      minTopZScore: 0.8,
      ambiguityRatio: Math.max(0.92, OMR_AMBIGUITY_RATIO * 0.97),
      minFillDelta: Math.max(0.075, OMR_MIN_FILL_DELTA * 0.88),
      minCenterGap: Math.max(8.5, OMR_MIN_CENTER_GAP * 0.82),
      minHybridConf: Math.max(0.2, OMR_MIN_HYBRID_CONF * 0.74),
      reprojectionMaxErrorPx: 3.6
    };
  }
  if (templateVersion === 4) {
    return {
      version: 4,
      qrSizePts: 31 * MM_A_PUNTOS,
      bubbleRadiusPts: (6.6 * MM_A_PUNTOS) / 2,
      bubblePitchYPts: 12.6,
      boxWidthPts: Math.max(78, OMR_BOX_WIDTH_PTS * 1.72),
      centerToLeftPts: 15.8,
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
  return {
    version: 3,
    qrSizePts: 30 * MM_A_PUNTOS,
    bubbleRadiusPts: (6.2 * MM_A_PUNTOS) / 2,
    bubblePitchYPts: 11.2,
    boxWidthPts: Math.max(70, OMR_BOX_WIDTH_PTS * 1.5),
    centerToLeftPts: 14.2,
    alignRange: Math.max(18, OMR_ALIGN_RANGE * 0.92),
    vertRange: Math.max(10, OMR_VERT_RANGE * 0.9),
    localSearchRatio: Math.max(0.22, OMR_LOCAL_SEARCH_RATIO * 0.9),
    localDriftPenalty: Math.max(0.08, OMR_LOCAL_DRIFT_PENALTY),
    maxCenterDriftRatio: Math.max(0.2, OMR_MAX_CENTER_DRIFT_RATIO * 0.74),
    minSafeRange: Math.max(4, OMR_MIN_SAFE_RANGE),
    scoreMin: Math.max(0.04, OMR_SCORE_MIN),
    scoreStd: Math.max(0.58, OMR_SCORE_STD),
    strongScore: Math.max(0.06, OMR_STRONG_SCORE),
    secondRatio: Math.max(0.72, OMR_SECOND_RATIO),
    deltaMin: Math.max(0.01, OMR_DELTA_MIN),
    minTopZScore: 0.9,
    ambiguityRatio: Math.max(0.95, OMR_AMBIGUITY_RATIO),
    minFillDelta: Math.max(0.09, OMR_MIN_FILL_DELTA),
    minCenterGap: Math.max(10.5, OMR_MIN_CENTER_GAP * 0.92),
    minHybridConf: Math.max(0.22, OMR_MIN_HYBRID_CONF * 0.8),
    reprojectionMaxErrorPx: 4.2
  };
}

function mediana(valores: number[]) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[medio - 1] + ordenados[medio]) / 2 : ordenados[medio];
}

function ajustarPerfilConMapa(perfilBase: PerfilDeteccionOmr, mapaPagina: MapaOmrPagina): PerfilDeteccionOmr {
  const radios: number[] = [];
  const pasosY: number[] = [];
  const anchosCaja: number[] = [];
  const offsetsCentroIzq: number[] = [];

  for (const pregunta of mapaPagina.preguntas ?? []) {
    if (Number.isFinite(pregunta.perfilOmr?.radio)) radios.push(Number(pregunta.perfilOmr?.radio));
    if (Number.isFinite(pregunta.perfilOmr?.pasoY)) pasosY.push(Number(pregunta.perfilOmr?.pasoY));
    if (Number.isFinite(pregunta.cajaOmr?.width)) anchosCaja.push(Number(pregunta.cajaOmr?.width));
    const opcionA = pregunta.opciones?.find((op) => op.letra === 'A');
    const opcionB = pregunta.opciones?.find((op) => op.letra === 'B');
    if (opcionA && opcionB && Number.isFinite(opcionA.y) && Number.isFinite(opcionB.y)) {
      const delta = Math.abs(Number(opcionB.y) - Number(opcionA.y));
      if (delta > 0.4) pasosY.push(delta);
    }
    if (opcionA && Number.isFinite(pregunta.cajaOmr?.x)) {
      offsetsCentroIzq.push(Number(opcionA.x) - Number(pregunta.cajaOmr?.x));
    }
  }

  const radio = mediana(radios);
  const pasoY = mediana(pasosY);
  const anchoCaja = mediana(anchosCaja);
  const offset = mediana(offsetsCentroIzq);

  return {
    ...perfilBase,
    bubbleRadiusPts:
      radio !== null ? Math.max(2.6, Math.min(7.2, radio)) : perfilBase.bubbleRadiusPts,
    bubblePitchYPts:
      pasoY !== null ? Math.max(6.8, Math.min(16, pasoY)) : perfilBase.bubblePitchYPts,
    boxWidthPts:
      anchoCaja !== null ? Math.max(32, Math.min(84, anchoCaja)) : perfilBase.boxWidthPts,
    centerToLeftPts:
      offset !== null ? Math.max(4.5, Math.min(22, offset)) : perfilBase.centerToLeftPts
  };
}

function limpiarBase64(entrada: string) {
  return entrada.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
}

type DebugInfo = {
  folio?: string;
  numeroPagina?: number;
  templateVersionDetectada?: TemplateVersion;
};

type OpcionesAnalisisInterno = {
  aggressivePreprocess?: boolean;
  noRetry?: boolean;
  rescueFiduciales?: boolean;
  rawImageBase64?: string;
};

type DebugPregunta = {
  numeroPregunta: number;
  mejorOpcion: string | null;
  mejorScore: number;
  segundoScore: number;
  delta: number;
  dobleMarcada: boolean;
  suficiente: boolean;
  dx: number;
  dy: number;
  scoreMean: number;
  scoreStd: number;
  scoreThreshold: number;
  centros: Array<{ letra: string; x: number; y: number; score: number }>;
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

function crearParametrosBurbuja(escalaX: number, bubbleRadiusPts: number, bubblePitchYPts: number): ParametrosBurbuja {
  const radio = Math.max(6, bubbleRadiusPts * escalaX);
  const pasoCentroPx = Math.max(radio * 2.4, bubblePitchYPts * escalaX);
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
  confianzaActual: number
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
    top.fillRatioCore >= 0.12;
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

  if (!(dominantePorGap || dominantePorScore || dominantePorCore)) return null;
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
    ratioAmbiguas
  } = args;
  const factorTransformacion = tipoTransformacion === 'escala' ? 0.74 : tipoTransformacion === 'homografia' ? 0.9 : 1;
  const factorQr = qrDetectado ? 1 : 0.78;
  const factorBlur = Math.max(0.35, clamp01((blurVar - 70) / 320));
  const factorExposicion = clamp01(1 - Math.abs(brilloMedio - 145) / 120);
  const factorRepro = clamp01(1 - reprojectionErrorPromedio / 6);
  const factorColorBalance = clamp01(1 - colorCast / 0.24);
  const excesoSaturacion = Math.max(0, saturationMean - 0.28);
  const factorSaturacion = clamp01(1 - excesoSaturacion / 0.45);
  const factorNoAmbiguas = clamp01(1 - ratioAmbiguas);
  const calidad =
    factorTransformacion * 0.22 +
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
  respuestasContestadas: number;
}) {
  const { calidadPagina, confianzaMedia, ratioAmbiguas, totalRespuestas, respuestasContestadas } = args;
  const motivos: string[] = [];
  const advertencias: string[] = [];
  const puedeRechazarPorCalidad = totalRespuestas >= 3;
  const deteccionRatio = totalRespuestas > 0 ? respuestasContestadas / totalRespuestas : 0;
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

async function decodificarImagen(base64: string, aggressivePreprocess = false) {
  const buffer = Buffer.from(limpiarBase64(base64), 'base64');
  const imagen = sharp(buffer).rotate().normalize();
  const { width, height } = await imagen.metadata();
  if (!width || !height) {
    throw new Error('No se pudo leer la imagen');
  }
  const anchoObjetivo = Math.min(width, 1600);
  const imagenRedimensionada = imagen.resize({ width: anchoObjetivo });
  const { data, info } = await imagenRedimensionada.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width ?? width;
  const h = info.height ?? height;
  const rgba = new Uint8ClampedArray(data);
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

  return {
    data: rgba,
    gray,
    integral,
    width: w,
    height: h,
    metricasColor,
    buffer
  };
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

type AjusteFiducialesResultado = {
  centros: Array<{ letra: string; punto: Punto }>;
  reprojectionErrorPx: number;
  puntosDetectados: number;
  puntosEsperados: number;
};

function distancia(a: Punto, b: Punto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  fidMidRight?: Punto
): AjusteFiducialesResultado | null {
  const radio = Math.max(18, fidSizePx * 3.6);
  const detTop = localizarMarcaLocal(gray, integral, width, height, fidTop, radio, fidSizePx);
  const detBottom = localizarMarcaLocal(gray, integral, width, height, fidBottom, radio, fidSizePx);
  if (!detTop || !detBottom) return null;
  const detMidLeft = fidMidLeft ? localizarMarcaLocal(gray, integral, width, height, fidMidLeft, Math.max(14, radio * 0.85), fidSizePx) : null;

  const dyEsperado = fidBottom.y - fidTop.y;
  const dyReal = detBottom.y - detTop.y;
  if (Math.abs(dyEsperado) < 1) return null;
  const scaleY = dyReal / dyEsperado;
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

  const centrosAjustados = centros.map((opcion) => ({
    letra: opcion.letra,
    punto: {
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
  const reprojectionErrorPx = errores.reduce((acc, e) => acc + e, 0) / Math.max(1, errores.length);
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
  fidMidRight?: Punto
): AjusteFiducialesResultado | null {
  const radio = Math.max(16, fidSizePx * 3.2);
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

function ajustarCentrosVertical(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centros: Array<{ letra: string; punto: Punto }>,
  params: ParametrosBurbuja,
  vertRange: number
) {
  if (centros.length < 2) return centros;
  const baseY = centros[0].punto.y;
  let mejorScore = -Infinity;
  let mejorScale = 1;
  let mejorOffset = 0;
  for (let scale = 0.96; scale <= 1.04 + 1e-6; scale += 0.01) {
    for (let offset = -vertRange; offset <= vertRange + 1e-6; offset += OMR_VERT_STEP) {
      const centrosAjustados = centros.map((opcion) => ({
        letra: opcion.letra,
        punto: { x: opcion.punto.x, y: baseY + (opcion.punto.y - baseY) * scale + offset }
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
      x: opcion.punto.x,
      y: baseY + (opcion.punto.y - baseY) * mejorScale + mejorOffset
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
  perfil: PerfilDeteccionOmr
): PreparacionPregunta {
  const { gray, integral, width, height, escalaX, paramsBurbuja } = estado;
  const centrosBase = construirCentrosBasePregunta(pregunta, transformar);
  if (!OMR_LOCAL_GEOMETRY_ENABLED) {
    return {
      centros: centrosBase,
      reprojectionErrorPx: null,
      puntosFidDetectados: 0,
      puntosFidEsperados: 0,
      usaRescateCaja: false,
      motivo: 'Ajuste geometrico local desactivado'
    };
  }
  const fiduciales = normalizarFiducialesPregunta(pregunta.fiduciales, transformar);
  const fidSizePx = Math.max(6, 7 * escalaX);
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
        fiduciales.rightMid
      )
    : null;
  const ajustePanelDerecho = fiduciales
    ? ajustarCentrosPorPanelDerechoFiduciales(
        gray,
        integral,
        width,
        height,
        centrosBase,
        fiduciales.rightTop,
        fiduciales.rightBottom,
        fidSizePx,
        fiduciales.rightMid
      )
    : null;
  const esAjusteConfiable = (ajuste: AjusteFiducialesResultado, coberturaMin: number, errorMax: number) => {
    const cobertura = ajuste.puntosDetectados / Math.max(1, ajuste.puntosEsperados);
    return Number.isFinite(ajuste.reprojectionErrorPx) && ajuste.reprojectionErrorPx <= errorMax && cobertura >= coberturaMin;
  };
  let ajusteSeleccionado: AjusteFiducialesResultado | null = null;
  let panelDerechoPreferido = false;
  if (ajusteFid && ajustePanelDerecho) {
    const fidConfiable = esAjusteConfiable(ajusteFid, 0.5, 7.2);
    const panelConfiable = esAjusteConfiable(ajustePanelDerecho, 0.5, 5.8);
    const panelClaramenteMejor =
      panelConfiable &&
      (!fidConfiable || ajustePanelDerecho.reprojectionErrorPx <= ajusteFid.reprojectionErrorPx + 0.35);
    ajusteSeleccionado = panelClaramenteMejor ? ajustePanelDerecho : ajusteFid;
    panelDerechoPreferido = panelClaramenteMejor;
  } else if (ajusteFid) {
    ajusteSeleccionado = ajusteFid;
  } else if (ajustePanelDerecho) {
    ajusteSeleccionado = ajustePanelDerecho;
    panelDerechoPreferido = true;
  }
  const centrosCaja = !ajusteSeleccionado
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
  const centros = ajustarCentrosVertical(
    gray,
    integral,
    width,
    height,
    centrosCaja ?? ajusteSeleccionado?.centros ?? centrosBase,
    paramsBurbuja,
    perfil.vertRange
  );
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
        motivo: 'Rescate por caja OMR (fiduciales no detectados)'
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
  if (/^OMR1:/i.test(qrTexto)) return 1;
  if (/:TV1\b/i.test(qrTexto)) return 1;
  if (/:TV3\b/i.test(qrTexto)) return 3;
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

function construirScoresPorOpcion(args: {
  estado: EstadoImagenOmr;
  centros: Array<{ letra: string; punto: Punto }>;
  scoresEvaluados: Array<{ letra: string; x: number; y: number; score: number }>;
  mejorDx: number;
  mejorDy: number;
}): ScoreOpcionOmr[] {
  const { estado, centros, scoresEvaluados, mejorDx, mejorDy } = args;
  const { gray, integral, width, height, paramsBurbuja } = estado;

  return scoresEvaluados
    .map((scoreItem) => {
      const centroBase = centros.find((item) => item.letra === scoreItem.letra);
      const x = scoreItem.x ?? (centroBase ? centroBase.punto.x + mejorDx : 0);
      const y = scoreItem.y ?? (centroBase ? centroBase.punto.y + mejorDy : 0);
      const rasgos = detectarOpcion(gray, integral, width, height, { x, y }, paramsBurbuja);
      const centerDarknessDelta = clamp01((rasgos.ringMean - rasgos.centerMean) / 255);
      const shapeCompactness = clamp01((1 / Math.max(1, rasgos.anisotropy)) * (1 - Math.min(0.6, rasgos.centroidOffsetRatio)));
      const markConfidence = clamp01(
        scoreItem.score * 1.55 +
          centerDarknessDelta * 0.32 +
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
        centerDarknessDelta,
        strokeLeakPenalty: rasgos.ringOnlyPenalty,
        shapeCompactness,
        markConfidence,
        estadoMarca
      };
    })
    .filter((item) => ['A', 'B', 'C', 'D', 'E'].includes(item.opcion))
    .sort((a, b) => b.score - a.score);
}

export async function leerQrDesdeImagen(imagenBase64: string): Promise<string | undefined> {
  const { data, gray, width, height } = await decodificarImagen(imagenBase64);
  const qr = detectarQrMejorado(data, gray, width, height, {
    qrSizePtsV1: QR_SIZE_PTS_V1,
    qrSizePtsV2: QR_SIZE_PTS_V2,
    anchoCarta: ANCHO_CARTA
  });
  return qr?.data;
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
  if (resultado.estadoAnalisis === 'ok') return false;
  if (resultado.geomQuality < 0.52) return false;
  if (
    resultado.motivosRevision.some((motivo) =>
      /error geometrico|sin fiduciales|escala simple|no rectificada|rectificacion cv no confiable/i.test(motivo)
    )
  ) {
    return false;
  }
  if (resultado.calidadPagina <= OMR_SECOND_PASS_QUALITY_MAX) return true;
  if (resultado.confianzaPromedioPagina <= OMR_SECOND_PASS_CONF_MAX) return true;
  if (resultado.motivosRevision.some((m) => /alineacion global inestable/i.test(m))) return true;
  return false;
}

function computePanelRescueConfidence(detection: PanelDarknessDetection) {
  const topScore = Math.max(...Object.values(detection.rawScores));
  if (detection.markType === 'valid') {
    return round6(clamp01(0.72 + topScore * 0.22 + detection.dominantGap * 0.18));
  }
  if (detection.markType === 'double') {
    return round6(clamp01(0.68 + topScore * 0.16));
  }
  return round6(clamp01(0.74 + Math.max(0, 0.18 - topScore) * 0.6));
}

function esRespuestaInvalidaResuelta(respuesta: Pick<RespuestaDetectadaOmr, 'opcion' | 'confianza' | 'flags'>) {
  if (respuesta.opcion) return true;
  if (respuesta.flags.includes('bajo_contraste')) return false;
  if (respuesta.flags.includes('doble_marca')) return respuesta.confianza >= 0.62;
  return respuesta.confianza >= 0.62;
}

function buildPanelDarknessScores(detection: PanelDarknessDetection): ScoreOpcionOmr[] {
  const selected = new Set(detection.selectedOptions);
  const topScore = Math.max(...Object.values(detection.rawScores));
  return (['A', 'B', 'C', 'D', 'E'] as const)
    .map((option) => {
      const score = detection.rawScores[option] ?? 0;
      const isSelected = selected.has(option);
      const estadoMarca: ScoreOpcionOmr['estadoMarca'] =
        detection.markType === 'double' && isSelected
          ? 'marcada'
          : detection.markType === 'valid' && detection.option === option
            ? 'marcada'
            : score >= Math.max(0.16, topScore * 0.42) && score > 0
              ? 'parcial'
              : 'no_marcada';
      return {
        opcion: option,
        score: round6(score),
        fillRatioCore: round6(score),
        fillRatioRing: 0,
        centerDarknessDelta: round6(score),
        strokeLeakPenalty: 0,
        shapeCompactness: detection.markType === 'valid' && detection.option === option ? 1 : isSelected ? 0.75 : 0.5,
        markConfidence: round6(
          clamp01(
            isSelected ? score * 1.35 + detection.dominantGap * 0.55 : score * 1.15 + Math.min(0.08, detection.dominantGap * 0.12)
          )
        ),
        estadoMarca
      };
    })
    .sort((a, b) => b.score - a.score || a.opcion.localeCompare(b.opcion));
}

async function aplicarRescatePanelDarkness(
  buffer: Buffer,
  mapaPagina: MapaOmrPagina,
  respuestasDetectadas: ResultadoOmr['respuestasDetectadas'],
  advertencias: string[]
) {
  if (!([3, 4].includes(mapaPagina.templateVersion ?? 3)) || mapaPagina.preguntas.length === 0) return respuestasDetectadas;
  const preguntas = mapaPagina.preguntas.map((pregunta) => pregunta.numeroPregunta);
  const detections = await analyzeOmrPanelsFromImageBuffer(buffer, preguntas);
  if (detections.length === 0) return respuestasDetectadas;
  const detectionsByQuestion = new Map(detections.map((item) => [item.questionNumber, item]));
  let cambios = 0;

  const merged = respuestasDetectadas.map((respuesta) => {
    const rescue = detectionsByQuestion.get(respuesta.numeroPregunta);
    if (!rescue) return respuesta;

    const tieneFlagParcial = respuesta.flags.includes('parcial_detectada');
    const rescueTopScore = Math.max(...Object.values(rescue.rawScores));
    const blankLimpio = rescue.markType === 'blank' && rescueTopScore <= 0.03;
    const debeRescatarValida =
      rescue.markType === 'valid' &&
      rescue.option &&
      (respuesta.opcion == null ||
        respuesta.opcion !== rescue.option ||
        tieneFlagParcial ||
        respuesta.confianza < 0.9);
    const debeRescatarBlank =
      (rescue.markType === 'blank' || rescue.markType === 'double') &&
      ((respuesta.opcion != null && (blankLimpio || tieneFlagParcial || respuesta.confianza < 0.86)) ||
        respuesta.opcion == null);

    if (debeRescatarValida) {
      cambios += 1;
      const flags = respuesta.flags.filter(
        (flag) => flag !== 'bajo_contraste' && flag !== 'doble_marca' && flag !== 'parcial_detectada'
      ) as FlagRespuestaOmr[];
      return {
        numeroPregunta: respuesta.numeroPregunta,
        opcion: rescue.option,
        confianza: Math.max(respuesta.confianza, computePanelRescueConfidence(rescue)),
        scoresPorOpcion: buildPanelDarknessScores(rescue),
        flags
      };
    }
    if (debeRescatarBlank) {
      cambios += 1;
      const blankFlags =
        rescue.markType === 'double'
          ? (['doble_marca'] as FlagRespuestaOmr[])
          : ([] as FlagRespuestaOmr[]);
      return {
        numeroPregunta: respuesta.numeroPregunta,
        opcion: null,
        confianza: computePanelRescueConfidence(rescue),
        scoresPorOpcion: buildPanelDarknessScores(rescue),
        flags: Array.from(new Set(blankFlags)) as FlagRespuestaOmr[]
      };
    }
    return respuesta;
  });

  if (cambios > 0) {
    advertencias.push(`Rescate panel_darkness_v1 aplicado en ${cambios} preguntas`);
  }
  return merged;
}

function fusionarResultadosOmr(base: ResultadoOmr, rescate: ResultadoOmr): ResultadoOmr {
  const baseMejor = puntuarResultadoOmr(base) >= puntuarResultadoOmr(rescate);
  const principal = baseMejor ? base : rescate;
  const secundario = baseMejor ? rescate : base;

  const mapaSec = new Map(secundario.respuestasDetectadas.map((r) => [r.numeroPregunta, r]));
  const respuestasDetectadas = principal.respuestasDetectadas.map((rPrincipal) => {
    const rSec = mapaSec.get(rPrincipal.numeroPregunta);
    if (!rSec) return rPrincipal;

    if (rPrincipal.opcion && rSec.opcion && rPrincipal.opcion === rSec.opcion) {
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: rPrincipal.opcion,
        confianza: Math.max(rPrincipal.confianza, rSec.confianza),
        scoresPorOpcion:
          rPrincipal.scoresPorOpcion.length >= rSec.scoresPorOpcion.length ? rPrincipal.scoresPorOpcion : rSec.scoresPorOpcion,
        flags: Array.from(new Set([...rPrincipal.flags, ...rSec.flags]))
      };
    }
    if (rPrincipal.opcion && !rSec.opcion) return rPrincipal;
    if (!rPrincipal.opcion && rSec.opcion) return rSec;
    if (!rPrincipal.opcion && !rSec.opcion) {
      return {
        numeroPregunta: rPrincipal.numeroPregunta,
        opcion: null,
        confianza: Math.max(rPrincipal.confianza, rSec.confianza),
        scoresPorOpcion:
          rPrincipal.scoresPorOpcion.length >= rSec.scoresPorOpcion.length ? rPrincipal.scoresPorOpcion : rSec.scoresPorOpcion,
        flags: Array.from(new Set([...rPrincipal.flags, ...rSec.flags]))
      };
    }
    return rPrincipal.confianza >= rSec.confianza ? rPrincipal : rSec;
  });

  const sumaConf = respuestasDetectadas.reduce((acc, r) => acc + Math.max(0, r.confianza), 0);
  const total = Math.max(1, respuestasDetectadas.length);
  const contestadas = respuestasDetectadas.filter((r) => Boolean(r.opcion)).length;
  const ambiguas = respuestasDetectadas.filter((r) => !r.opcion).length;
  const confianzaPromedioPagina = sumaConf / total;
  const ratioAmbiguas = ambiguas / total;

  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina: Math.max(base.calidadPagina, rescate.calidadPagina),
    confianzaMedia: confianzaPromedioPagina,
    ratioAmbiguas,
    totalRespuestas: respuestasDetectadas.length,
    respuestasContestadas: contestadas
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
    calidadPagina: Math.max(base.calidadPagina, rescate.calidadPagina),
    estadoAnalisis: decisionEstado.estado,
    motivosRevision,
    templateVersionDetectada: principal.templateVersionDetectada,
    confianzaPromedioPagina,
    ratioAmbiguas,
    engineVersion: principal.engineVersion,
    geomQuality: Math.max(base.geomQuality, rescate.geomQuality),
    photoQuality: Math.max(base.photoQuality, rescate.photoQuality),
    decisionPolicy: 'conservadora_v1'
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
  const { data, gray, integral, width, height, metricasColor, buffer } = await decodificarImagen(
    imagenBase64,
    Boolean(opcionesInternas?.aggressivePreprocess)
  );
  const bufferRescatePanel = opcionesInternas?.rawImageBase64
    ? Buffer.from(limpiarBase64(opcionesInternas.rawImageBase64), 'base64')
    : buffer;
  const templateInicial = debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 1;
  const perfilInicial = ajustarPerfilConMapa(resolverPerfilDeteccion(templateInicial), mapaPagina);
  let qrDetalle = detectarQrMejorado(data, gray, width, height, {
    qrSizePtsHint: perfilInicial.qrSizePts,
    qrSizePtsV1: QR_SIZE_PTS_V1,
    qrSizePtsV2: QR_SIZE_PTS_V2,
    anchoCarta: ANCHO_CARTA
  });
  let qrTexto = qrDetalle?.data;
  const templateQr = extraerTemplateVersionDesdeQr(qrTexto);
  const templateVersionDetectada = templateQr ?? debugInfo?.templateVersionDetectada ?? mapaPagina.templateVersion ?? 3;
  const perfil = ajustarPerfilConMapa(resolverPerfilDeteccion(templateVersionDetectada), mapaPagina);
  if (!qrDetalle && perfil.qrSizePts !== perfilInicial.qrSizePts) {
    qrDetalle = detectarQrMejorado(data, gray, width, height, {
      qrSizePtsHint: perfil.qrSizePts,
      qrSizePtsV1: QR_SIZE_PTS_V1,
      qrSizePtsV2: QR_SIZE_PTS_V2,
      anchoCarta: ANCHO_CARTA
    });
    qrTexto = qrDetalle?.data;
  }
  const escalaX = width / ANCHO_CARTA;
  const paramsBurbuja = crearParametrosBurbuja(escalaX, perfil.bubbleRadiusPts, perfil.bubblePitchYPts);

  if (!qrTexto) {
    advertencias.push('No se detecto QR en la imagen');
  }
  const qrEsperados = Array.isArray(qrEsperado) ? qrEsperado : qrEsperado ? [qrEsperado] : [];
  if (qrEsperados.length > 0 && qrTexto) {
    const normalizado = String(qrTexto).trim().toUpperCase();
    const coincide = qrEsperados.some((esperado) => {
      const exp = String(esperado).trim().toUpperCase();
      return normalizado === exp || normalizado.startsWith(`${exp}|`) || normalizado.includes(`FOLIO:${exp}`);
    });
    if (!coincide) {
      advertencias.push('El QR no coincide con el examen esperado');
    }
  }

  const transformacionBase = obtenerTransformacion(gray, width, height, advertencias, qrDetalle, {
    margenMm,
    qrSizePts: perfil.qrSizePts,
    anchoCarta: ANCHO_CARTA,
    altoCarta: ALTO_CARTA,
    mmAPuntos: MM_A_PUNTOS
  });
  const transformarEscala = (punto: Punto) => {
    const escalaX = width / ANCHO_CARTA;
    const escalaY = height / ALTO_CARTA;
    return { x: punto.x * escalaX, y: height - punto.y * escalaY };
  };
  const forceSimpleScale = mapaPagina.engineHints?.forceSimpleScale === true;
  const useMapCoordinatesStrict =
    typeof mapaPagina.engineHints?.useMapCoordinatesStrict === 'boolean'
      ? mapaPagina.engineHints.useMapCoordinatesStrict
      : false;
  const localSearchRadiusPx = useMapCoordinatesStrict
    ? 0
    : (mapaPagina.engineHints?.localSearchRadiusPx ??
      (templateVersionDetectada === 3 || templateVersionDetectada === 4
        ? Math.max(2, Math.round(paramsBurbuja.radio * 0.55))
        : undefined));
  const localBubbleSearchRadiusPx = OMR_LOCAL_GEOMETRY_ENABLED ? 0 : localSearchRadiusPx;
  let transformar = transformacionBase.transformar;
  if (forceSimpleScale) {
    transformar = transformarEscala;
    advertencias.push('Mapa OMR derivado desde imagen: transformacion global por escala forzada');
  } else if (transformacionBase.tipo === 'escala') {
    motivosRevision.push('Alineacion global no rectificada (escala simple)');
    advertencias.push('Rectificacion CV no confiable; se mantiene escala simple con ajuste local');
  } else if (!OMR_LOCAL_GEOMETRY_ENABLED) {
    advertencias.push('OMR_LOCAL_GEOMETRY_ENABLED=0: se desactiva ajuste local por pregunta');
  }

  const evaluarTransformacion = (transformador: (p: Punto) => Punto) => {
    const muestras = mapaPagina.preguntas.slice(0, Math.min(5, mapaPagina.preguntas.length));
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

  if (transformacionBase.tipo === 'homografia' || transformacionBase.tipo === 'qr') {
    const calidadHom = evaluarTransformacion(transformacionBase.transformar);
    const calidadEscala = evaluarTransformacion(transformarEscala);
    const puntajeHom = calidadHom.score + calidadHom.delta * 0.6;
    const puntajeEscala = calidadEscala.score + calidadEscala.delta * 0.6;
    const ventajaEscala = puntajeEscala - puntajeHom;
    const escalaMejor = ventajaEscala > 0.03;
    const escalaMuyMejor = ventajaEscala > 0.14;
    if (escalaMejor) {
      motivosRevision.push('Alineacion global inestable (escala simple puntuo mejor)');
      const permitirFallbackEscala =
        forceSimpleScale ||
        !OMR_LOCAL_GEOMETRY_ENABLED ||
        (!opcionesInternas?.rescueFiduciales && escalaMuyMejor) ||
        (transformacionBase.tipo === 'homografia' && escalaMuyMejor && ventajaEscala > 0.18);
      if (permitirFallbackEscala) {
        advertencias.push('Se eligio transformacion por escala por mayor coherencia de marcas');
        transformar = transformarEscala;
      } else if (opcionesInternas?.rescueFiduciales !== false) {
        advertencias.push('Rescate fiduciales: se mantiene transformacion base para ajuste local');
      } else {
        advertencias.push('Escala simple puntuo mejor, pero se conserva rectificacion CV y ajuste local');
      }
    }
  }
  const estado: EstadoImagenOmr = { gray, integral, width, height, escalaX, paramsBurbuja };
  const umbralRespuestaConf = opcionesInternas?.aggressivePreprocess
    ? Math.max(0.62, OMR_RESPUESTA_CONF_MIN - 0.14)
    : OMR_RESPUESTA_CONF_MIN;
  const respuestasDetectadas: ResultadoOmr['respuestasDetectadas'] = [];
  const patches: PatchRegistro[] = [];
  let sumaConfianza = 0;
  let preguntasAmbiguas = 0;
  let respuestasContestadas = 0;
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

  mapaPagina.preguntas.forEach((pregunta) => {
    const prep = prepararCentrosPregunta(estado, pregunta, transformar, perfil);
    const centros = prep.centros;
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
    const habilitarAjusteLocalPregunta = OMR_LOCAL_GEOMETRY_ENABLED && fiducialConfiable;
    if (perfil.reprojectionMaxErrorPx < Number.POSITIVE_INFINITY && reprojectionFueraDeRango && bloqueoPorFiducial) {
      motivosRevision.push(`P${pregunta.numeroPregunta}: error geometrico local (fiduciales)`);
      if (opcionesInternas?.rescueFiduciales) {
        advertencias.push(`P${pregunta.numeroPregunta}: rescate fiduciales por error geométrico local`);
      }
    }
    const { mejorDx, mejorDy } = habilitarAjusteLocalPregunta
      ? { mejorDx: 0, mejorDy: 0 }
      : buscarMejorOffsetPregunta({
          estado,
          centros,
          alignRange: Math.max(4, Math.min(perfil.alignRange, 8)),
          maxCenterDriftRatio: Math.min(perfil.maxCenterDriftRatio, 0.18),
          minSafeRange: perfil.minSafeRange,
          evaluarAlineacionOffset
        });
    const localSearchRadiusPregunta = !OMR_LOCAL_GEOMETRY_ENABLED
      ? localSearchRadiusPx
      : habilitarAjusteLocalPregunta
        ? 0
        : 0;
    const resultado = evaluarConOffset({
      gray,
      integral,
      width,
      height,
      centros,
      dx: mejorDx,
      dy: mejorDy,
      params: paramsBurbuja,
      localSearchRatio: perfil.localSearchRatio,
      localSearchRadiusPx: localSearchRadiusPregunta,
      localDriftPenalty: perfil.localDriftPenalty,
      detectarOpcion
    });
    const metricas = calcularMetricasPregunta({
      estado,
      centros,
      resultado,
      mejorDx,
      mejorDy,
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
    let opcionDetectada =
      metricas.suficiente && metricas.confianza >= umbralRespuestaConf
        ? (metricas.mejorOpcion as OpcionRespuestaOmr | null)
        : null;
    const scoresPorOpcion = construirScoresPorOpcion({
      estado,
      centros,
      scoresEvaluados: resultado.scores,
      mejorDx,
      mejorDy
    });
    const rescateDominante = rescatarOpcionDominantePorScores(scoresPorOpcion, opcionDetectada, metricas.confianza);
    let confianzaPregunta = metricas.confianza;
    if (!opcionDetectada && rescateDominante) {
      opcionDetectada = rescateDominante.opcion;
      confianzaPregunta = Math.max(metricas.confianza, rescateDominante.confianza);
      advertencias.push(`P${pregunta.numeroPregunta}: ${rescateDominante.motivo}`);
    }

    const flags: Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi' | 'parcial_detectada' | 'tachada_detectada'> = [];
    if (metricas.dobleMarcada && !rescateDominante) flags.push('doble_marca');
    if ((!metricas.suficiente || confianzaPregunta < umbralRespuestaConf) && !rescateDominante) flags.push('bajo_contraste');
    if (scoresPorOpcion.some((item) => item.estadoMarca === 'tachada')) {
      flags.push('tachada_detectada');
    } else if (scoresPorOpcion.some((item) => item.estadoMarca === 'parcial')) {
      flags.push('parcial_detectada');
    }
    respuestasDetectadas.push({
      numeroPregunta: pregunta.numeroPregunta,
      opcion: opcionDetectada,
      confianza: confianzaPregunta,
      scoresPorOpcion,
      flags
    });
    sumaConfianza += confianzaPregunta;
    if (opcionDetectada) respuestasContestadas += 1;
    if ((metricas.dobleMarcada && !rescateDominante) || (!rescateDominante && (!metricas.suficiente || confianzaPregunta < umbralRespuestaConf))) {
      preguntasAmbiguas += 1;
      if (metricas.dobleMarcada && !rescateDominante) {
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
        return {
          letra: item.letra,
          x: scoreItem?.x ?? item.punto.x,
          y: scoreItem?.y ?? item.punto.y,
          score: scoreItem?.score ?? 0
        };
      });
      debug.preguntas.push({
        numeroPregunta: pregunta.numeroPregunta,
        mejorOpcion: metricas.mejorOpcion,
        mejorScore: metricas.mejorScore,
        segundoScore: metricas.segundoScore,
        delta: metricas.delta,
        dobleMarcada: metricas.dobleMarcada,
        suficiente: metricas.suficiente,
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
  let respuestasFinales = await aplicarRescatePanelDarkness(bufferRescatePanel, mapaPagina, respuestasDetectadas, advertencias);
  if (respuestasFinales !== respuestasDetectadas) {
    sumaConfianza = respuestasFinales.reduce((acc, item) => acc + item.confianza, 0);
    respuestasContestadas = respuestasFinales.filter((item) => esRespuestaInvalidaResuelta(item)).length;
    preguntasAmbiguas = respuestasFinales.filter((item) => !esRespuestaInvalidaResuelta(item)).length;
  } else {
    respuestasFinales = respuestasDetectadas;
    respuestasContestadas = respuestasFinales.filter((item) => esRespuestaInvalidaResuelta(item)).length;
    preguntasAmbiguas = respuestasFinales.filter((item) => !esRespuestaInvalidaResuelta(item)).length;
  }

  const confianzaMedia = respuestasFinales.length ? sumaConfianza / respuestasFinales.length : 0;
  const ratioAmbiguas = respuestasFinales.length > 0 ? preguntasAmbiguas / respuestasFinales.length : 1;
  const reprojectionErrorPromedio =
    reprojectionErrorConteo > 0 ? reprojectionErrorAcumulado / reprojectionErrorConteo : 2.8;
  const metricasImagen = calcularMetricasImagen(gray, width, height);
  const factorTransformacion =
    transformacionBase.tipo === 'escala' ? 0.72 : transformacionBase.tipo === 'homografia' ? 0.9 : 1;
  const geomQuality = clamp01((1 - reprojectionErrorPromedio / 7) * factorTransformacion);
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
    ratioAmbiguas
  });
  if (OMR_QUALITY_WARN_MIN >= 0 && calidadPagina < OMR_QUALITY_WARN_MIN) {
    advertencias.push(`Calidad de pagina baja (${calidadPagina.toFixed(2)})`);
  }
  const decisionEstado = resolverEstadoAnalisis({
    calidadPagina,
    confianzaMedia,
    ratioAmbiguas,
    totalRespuestas: respuestasDetectadas.length,
    respuestasContestadas
  });
  const estadoAnalisis: ResultadoOmr['estadoAnalisis'] = decisionEstado.estado;
  if (decisionEstado.anularRespuestas) {
    for (const r of respuestasDetectadas) {
      r.opcion = null;
      r.confianza = 0;
    }
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
    calidadPagina,
    estadoAnalisis,
    motivosRevision: motivosUnicos,
    templateVersionDetectada,
    confianzaPromedioPagina: confianzaMedia,
    ratioAmbiguas,
    engineVersion:
      templateVersionDetectada === 1 ? 'omr-v1-cv' : templateVersionDetectada === 4 ? 'omr-v4-cv' : 'omr-v3-cv',
    geomQuality,
    photoQuality: clamp01(photoQuality),
    decisionPolicy: 'conservadora_v1'
  };

  if (!opcionesInternas?.noRetry && debeIntentarSegundoPase(resultadoBase)) {
    const resultadoRescate = await analizarOmr(
      imagenBase64,
      mapaPagina,
      qrEsperado,
      margenMm,
      debugInfo,
      {
        aggressivePreprocess: true,
        noRetry: true,
        rescueFiduciales: OMR_SECOND_PASS_FIDUCIALES_RESCUE
      }
    );
    const fusion = fusionarResultadosOmr(resultadoBase, resultadoRescate);
    const scoreBase = puntuarResultadoOmr(resultadoBase);
    const scoreRescate = puntuarResultadoOmr(resultadoRescate);
    const scoreFusion = puntuarResultadoOmr(fusion);
    if (scoreFusion >= scoreBase || scoreRescate > scoreBase) {
      const elegido = scoreFusion >= scoreRescate ? fusion : resultadoRescate;
      elegido.advertencias = Array.from(
        new Set([...elegido.advertencias, scoreFusion >= scoreRescate ? 'Segundo pase OMR fusionado por mejora' : 'Segundo pase OMR rescato detecciones'])
      );
      return elegido;
    }
    resultadoBase.advertencias.push('Segundo pase OMR descartado por no mejorar');
  } else if (!opcionesInternas?.noRetry && resultadoBase.estadoAnalisis !== 'ok') {
    resultadoBase.advertencias.push('Segundo pase OMR omitido: geometria o señal no apta para rescate');
  }

  return resultadoBase;
}
