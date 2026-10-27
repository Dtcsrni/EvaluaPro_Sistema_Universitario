import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * politicaAutoCalificacionOmr
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';
const OPCIONES_OMR = new Set(['A', 'B', 'C', 'D', 'E']);
const MAX_FILL_PARCIAL_NO_COMPETITIVO = 0.32;
const MAX_NUCLEUS_FILL_PARCIAL_NO_COMPETITIVO = 0.6;
const MAX_CONFIANZA_MARCA_PARCIAL_NO_COMPETITIVA = 0.45;
const MAX_COMPACTNESS_RESIDUAL_PARCIAL_DEBIL = 0.12;
const MAX_CONFIANZA_RESIDUAL_PARCIAL_DEBIL = 0.35;
const MAX_CONTRASTE_RESIDUAL_PARCIAL_DEBIL = 0.24;
const MAX_SCORE_RATIO_PARCIAL_RESIDUAL = 0.3;
const MAX_FILL_PARCIAL_RESIDUAL = 0.25;
const MAX_NUCLEUS_FILL_PARCIAL_RESIDUAL = 0.05;
const MAX_COMPACTNESS_PARCIAL_RESIDUAL = 0.15;
const MAX_CONFIANZA_PARCIAL_RESIDUAL = 0.52;
const MAX_CONTRASTE_PARCIAL_RESIDUAL = 0.16;
const MAX_SCORE_RATIO_CONTORNO_DESPLAZADO = 0.32;
const MAX_FILL_CONTORNO_DESPLAZADO = 0.5;
const MAX_NUCLEUS_FILL_CONTORNO_DESPLAZADO = 0.85;
const MIN_DESPLAZAMIENTO_CONTORNO = 0.35;
const MAX_COMPACTNESS_CONTORNO = 0.25;
const MAX_CONFIANZA_CONTORNO = 0.8;
const MAX_CONTRASTE_CONTORNO = 0.16;
const MIN_SCORE_RATIO_SEGUNDA_MARCA = 0.3;
const MIN_FILL_SEGUNDA_MARCA = 0.6;
const MIN_NUCLEUS_FILL_SEGUNDA_MARCA = 0.75;
const MIN_CONFIANZA_SEGUNDA_MARCA = 0.75;
const MAX_SCORE_SIN_MARCA_SEGURA = 0.02;
const MAX_FILL_SIN_MARCA_SEGURA = 0.2;
const MAX_NUCLEUS_SIN_MARCA_SEGURA = 0.1;
const MAX_CONFIANZA_SIN_MARCA_SEGURA = 0.1;
const MIN_SCORE_PARCIAL_CIRCULAR_FUERTE = 0.6;
const MAX_SCORE_RATIO_PARCIAL_CONTORNO = 0.14;
const MAX_COMPACTNESS_PARCIAL_CONTORNO = 0.25;
const MAX_FILL_PARCIAL_DIFUSA = 0.4;
const MAX_SCORE_RATIO_PARCIAL_DIFUSA = 0.1;

export type EntradaAutoCalificacionOmr = {
  estadoAnalisis?: EstadoAnalisisOmr;
  calidadPagina: number;
  confianzaPromedioPagina: number;
  ratioAmbiguas: number;
  coberturaDeteccion: number;
  respuestasDetectadas?: ReadonlyArray<{
    opcion: string | null;
    confianza?: number;
    estadoRespuesta?: 'respondida' | 'sin_marca' | 'ambigua' | 'doble_marca' | 'tachada';
    flags?: ReadonlyArray<string>;
    scoresPorOpcion?: ReadonlyArray<{
      opcion: string;
      score: number;
      fillRatioCore: number;
      nucleusFillRatio?: number;
      centroidOffsetRatio?: number;
      markConfidence: number;
      shapeCompactness?: number;
      contraste?: number;
      softCoreContrast?: number;
      estadoMarca?: string;
    }>;
  }>;
};

export const UMBRALES_OMR_AUTO = {
  qualityRejectMin: Number.parseFloat(process.env.OMR_QUALITY_REJECT_MIN || '0.5'),
  qualityReviewMin: Number.parseFloat(process.env.OMR_QUALITY_REVIEW_MIN || '0.52'),
  autoConfMin: Number.parseFloat(process.env.OMR_AUTO_CONF_MIN || '0.58'),
  autoAmbiguasMax: Number.parseFloat(process.env.OMR_AUTO_AMBIGUAS_MAX || '0.4'),
  autoDeteccionMin: Number.parseFloat(process.env.OMR_AUTO_DETECCION_MIN || '0.6'),
  autoRescueQualityMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_QUALITY_MIN || '0.5'),
  autoRescueConfMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_CONF_MIN || '0.58'),
  autoRescueAmbigMax: Number.parseFloat(process.env.OMR_AUTO_RESCUE_AMBIG_MAX || '0.4'),
  // Cierres duros para no autocalificar cuando la señal es extremadamente inestable.
  autoHardStopConfMax: Number.parseFloat(process.env.OMR_AUTO_HARDSTOP_CONF_MAX || '0.3'),
  autoHardStopAmbiguasMin: Number.parseFloat(process.env.OMR_AUTO_HARDSTOP_AMBIGUAS_MIN || '0.85'),
  autoHardStopDeteccionMax: Number.parseFloat(process.env.OMR_AUTO_HARDSTOP_DETECCION_MAX || '0.35'),
  // Contrato operativo actual: todas las paginas deben poder autocalificarse.
  // Default estricto: NO forzar autocalificación. Solo habilitar por override explícito.
  autoForceAllPages: String(process.env.OMR_AUTO_FORCE_ALL_PAGES ?? '0').trim() !== '0'
} as const;

/** Huella de configuración que afecta OMR; permite ligar la validación a su runtime. */
export const OMR_RUNTIME_CONFIG_SHA256 = createHash('sha256')
  .update(JSON.stringify(Object.entries(process.env)
    .filter(([key]) => key.startsWith('OMR_') || key === 'NODE_ENV')
    .sort(([a], [b]) => a.localeCompare(b))))
  .digest('hex');

const CHECKS_PILOTO_REQUERIDOS = [
  'precision',
  'falsePositiveRate',
  'invalidDetectionRate',
  'pagePassRate',
  'autoGradeTrustRate',
  'autoCoverageRate',
  'gradeConsistencyLower95',
  'bonusConsistencyLower95'
] as const;

function reportePilotoRealApruebaRuntime() {
  const reportPath = process.env.EVALUAPRO_OMR_TV4_REAL_PILOT_REPORT?.trim();
  if (!reportPath) return false;

  try {
    const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8')) as {
      datasetType?: unknown;
      status?: unknown;
      ok?: unknown;
      checks?: Record<string, unknown>;
      thresholds?: Record<string, unknown>;
      metrics?: Record<string, unknown>;
      evidenceHashes?: Record<string, unknown>;
    };
    const metrics = report.metrics;
    const thresholds = report.thresholds;
    const evidenceHashes = report.evidenceHashes;
    const hashSha256 = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
    const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    const hashesRequeridos = [
      'manifestSha256',
      'groundTruthSha256',
      'answerKeySha256',
      'captureAssetsSha256',
      'evaluatorCodeSha256'
    ];

    if (!(report.datasetType === 'tv4_pilot_real' &&
      report.status === 'passed' &&
      report.ok === true &&
      CHECKS_PILOTO_REQUERIDOS.every((check) => report.checks?.[check] === true) &&
      report.evidenceHashes?.omrRuntimeConfigSha256 === OMR_RUNTIME_CONFIG_SHA256 &&
      hashesRequeridos.every((key) => hashSha256(evidenceHashes?.[key])))) return false;

    const gradeConsistencyMinimum = thresholds?.gradeConsistencyLower95Min;
    const coverageMinimum = thresholds?.autoCoverageMin;
    const totalCaptures = metrics?.totalCaptures;
    const gradeComparisons = metrics?.gradeComparisons;
    const bonusComparisons = metrics?.bonusComparisons;
    const gradeConsistencyLower95 = metrics?.gradeConsistencyLower95;
    const bonusConsistencyLower95 = metrics?.bonusConsistencyLower95;
    const pagePassRate = metrics?.pagePassRate;
    const autoGradeTrustRate = metrics?.autoGradeTrustRate;
    const autoCoverageRate = metrics?.autoCoverageRate;
    const humanReviewedRows = metrics?.humanReviewedRows;
    const humanReviewerCount = metrics?.humanReviewerCount;
    return numeric(gradeConsistencyMinimum) && gradeConsistencyMinimum >= 0.99 &&
      numeric(coverageMinimum) && coverageMinimum === 1 &&
      numeric(totalCaptures) && totalCaptures > 0 &&
      numeric(gradeComparisons) && gradeComparisons >= 299 &&
      numeric(bonusComparisons) && bonusComparisons >= 299 &&
      numeric(gradeConsistencyLower95) && gradeConsistencyLower95 >= gradeConsistencyMinimum &&
      numeric(bonusConsistencyLower95) && bonusConsistencyLower95 >= gradeConsistencyMinimum &&
      numeric(pagePassRate) && pagePassRate === 1 &&
      numeric(autoGradeTrustRate) && autoGradeTrustRate === 1 &&
      numeric(autoCoverageRate) && autoCoverageRate === 1 &&
      numeric(humanReviewedRows) && humanReviewedRows > 0 &&
      numeric(humanReviewerCount) && humanReviewerCount > 0;
  } catch {
    return false;
  }
}

// La huella por sí sola no prueba que el piloto haya pasado. El runtime exige
// el reporte aprobado y lo vincula con la configuración OMR activa.
export const OMR_TV4_REAL_PILOT_GATE_PASSED = reportePilotoRealApruebaRuntime();

function clamp01(valor: number) {
  return Math.max(0, Math.min(1, valor));
}

export function parcialDetectadaNoCompetitivaConMarcaFuerte(respuesta: NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]) {
  if (!respuesta.flags?.includes('parcial_detectada') || !respuesta.opcion) return false;
  const scores = respuesta.scoresPorOpcion;
  if (
    !scores ||
    scores.length !== OPCIONES_OMR.size ||
    new Set(scores.map((score) => score.opcion)).size !== OPCIONES_OMR.size ||
    scores.some((score) => !OPCIONES_OMR.has(score.opcion))
  ) return false;

  const seleccionada = scores.find((score) => score.opcion === respuesta.opcion);
  if (!seleccionada ||
    !Number.isFinite(respuesta.confianza) ||
    !Number.isFinite(seleccionada.score) ||
    !Number.isFinite(seleccionada.fillRatioCore) ||
    !Number.isFinite(seleccionada.nucleusFillRatio) ||
    !Number.isFinite(seleccionada.centroidOffsetRatio) ||
    !Number.isFinite(seleccionada.markConfidence) ||
    !Number.isFinite(seleccionada.shapeCompactness) ||
    !Number.isFinite(seleccionada.contraste) ||
    (seleccionada.softCoreContrast !== undefined && !Number.isFinite(seleccionada.softCoreContrast)) ||
    seleccionada.estadoMarca !== 'marcada' ||
    Number(respuesta.confianza) < 0.9 ||
    seleccionada.score < 0.85 ||
    seleccionada.fillRatioCore < 0.8 ||
    Number(seleccionada.nucleusFillRatio) < 0.75 ||
    Number(seleccionada.centroidOffsetRatio) > 0.2 ||
    Number(seleccionada.shapeCompactness) < 0.55 ||
    Math.max(Number(seleccionada.contraste), seleccionada.softCoreContrast ?? 0) < 0.25 ||
    seleccionada.markConfidence < 0.9
  ) return false;

  return scores
    .filter((score) => score.opcion !== respuesta.opcion)
    .every((score) => {
      const contraste = Math.max(Number(score.contraste), score.softCoreContrast ?? 0);
      const metricasFinitas =
        Number.isFinite(score.score) &&
        Number.isFinite(score.fillRatioCore) &&
        Number.isFinite(score.nucleusFillRatio) &&
        Number.isFinite(score.centroidOffsetRatio) &&
        Number.isFinite(score.markConfidence) &&
        Number.isFinite(score.shapeCompactness) &&
        Number.isFinite(contraste) &&
        (score.softCoreContrast === undefined || Number.isFinite(score.softCoreContrast));
      if (!metricasFinitas || score.estadoMarca === 'tachada') return false;

      const parcialDebil =
        score.score <= seleccionada.score * 0.25 &&
        score.fillRatioCore <= MAX_FILL_PARCIAL_NO_COMPETITIVO &&
        Number(score.nucleusFillRatio) <= MAX_NUCLEUS_FILL_PARCIAL_NO_COMPETITIVO &&
        contraste <= 0.2 &&
        score.markConfidence <= MAX_CONFIANZA_MARCA_PARCIAL_NO_COMPETITIVA;
      const residualParcialDisperso =
        score.estadoMarca === 'parcial' &&
        score.score <= seleccionada.score * 0.2 &&
        score.fillRatioCore <= MAX_FILL_PARCIAL_RESIDUAL &&
        Number(score.nucleusFillRatio) <= MAX_NUCLEUS_FILL_PARCIAL_RESIDUAL &&
        Number(score.shapeCompactness) <= MAX_COMPACTNESS_RESIDUAL_PARCIAL_DEBIL &&
        score.markConfidence <= MAX_CONFIANZA_RESIDUAL_PARCIAL_DEBIL &&
        contraste <= MAX_CONTRASTE_RESIDUAL_PARCIAL_DEBIL;
      // Los anillos impresos de TV4 dejan una señal parcial de poco relleno y
      // sin masa central. Se toleran solo cuando también son poco compactos,
      // débiles y claramente inferiores a una marca dominante.
      const residualDeAnillo =
        score.estadoMarca === 'parcial' &&
        score.score <= seleccionada.score * MAX_SCORE_RATIO_PARCIAL_RESIDUAL &&
        score.fillRatioCore <= MAX_FILL_PARCIAL_RESIDUAL &&
        Number(score.nucleusFillRatio) <= MAX_NUCLEUS_FILL_PARCIAL_RESIDUAL &&
        Number(score.shapeCompactness) <= MAX_COMPACTNESS_PARCIAL_RESIDUAL &&
        score.markConfidence <= MAX_CONFIANZA_PARCIAL_RESIDUAL &&
        contraste <= MAX_CONTRASTE_PARCIAL_RESIDUAL;
      // Si el contorno se filtra al núcleo por desplazamiento, solo se ignora
      // ante una señal secundaria dispersa, lejos del centro y sin contraste
      // suficiente para competir con la burbuja dominante.
      const contornoDesplazado =
        score.score <= seleccionada.score * MAX_SCORE_RATIO_CONTORNO_DESPLAZADO &&
        score.fillRatioCore <= MAX_FILL_CONTORNO_DESPLAZADO &&
        Number(score.nucleusFillRatio) <= MAX_NUCLEUS_FILL_CONTORNO_DESPLAZADO &&
        Number(score.centroidOffsetRatio) >= MIN_DESPLAZAMIENTO_CONTORNO &&
        Number(score.shapeCompactness) <= MAX_COMPACTNESS_CONTORNO &&
        score.markConfidence <= MAX_CONFIANZA_CONTORNO &&
        contraste <= MAX_CONTRASTE_CONTORNO;

      return parcialDebil || residualParcialDisperso || residualDeAnillo || contornoDesplazado;
    });
}

/**
 * Recupera una marca parcial cuando la opción primaria tiene relleno central
 * sólido y domina por margen, mientras ninguna alternativa conserva un núcleo,
 * relleno o confianza compatibles con una segunda marca. Devuelve la opción
 * candidata; cualquier doble marca o tachadura se mantiene en revisión.
 */
export function opcionParcialDominanteRecuperable(
  respuesta: NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]
) {
  if (
    !respuesta.flags?.includes('parcial_detectada') ||
    respuesta.flags.includes('doble_marca') ||
    respuesta.flags.includes('tachada_detectada') ||
    respuesta.estadoRespuesta === 'doble_marca' ||
    respuesta.estadoRespuesta === 'tachada'
  ) return null;

  const scores = respuesta.scoresPorOpcion;
  if (
    !scores ||
    scores.length !== OPCIONES_OMR.size ||
    new Set(scores.map((score) => score.opcion)).size !== OPCIONES_OMR.size ||
    scores.some((score) => !OPCIONES_OMR.has(score.opcion))
  ) return null;

  const orden = [...scores].sort((a, b) => b.score - a.score);
  const seleccionada = respuesta.opcion
    ? orden.find((score) => score.opcion === respuesta.opcion)
    : orden[0];
  const segunda = orden.find((score) => score.opcion !== seleccionada?.opcion);
  if (!seleccionada || !segunda || orden[0]?.opcion !== seleccionada.opcion) return null;

  const contrasteSeleccionado = Math.max(Number(seleccionada.contraste), Number(seleccionada.softCoreContrast ?? 0));
  const senalSeleccionada = [
    seleccionada.score,
    seleccionada.fillRatioCore,
    seleccionada.nucleusFillRatio,
    seleccionada.centroidOffsetRatio,
    seleccionada.markConfidence,
    seleccionada.shapeCompactness,
    contrasteSeleccionado
  ];
  if (!senalSeleccionada.every(Number.isFinite) || seleccionada.estadoMarca !== 'marcada') return null;

  const alternativas = orden.filter((score) => score.opcion !== seleccionada.opcion);
  const metricasAlternativaDebil = (score: (typeof scores)[number]) => {
    const contraste = Math.max(Number(score.contraste), Number(score.softCoreContrast ?? 0));
    return [
      score.score,
      score.fillRatioCore,
      score.nucleusFillRatio,
      score.markConfidence,
      score.shapeCompactness,
      contraste
    ].every(Number.isFinite) && score.estadoMarca !== 'tachada';
  };
  if (!alternativas.every(metricasAlternativaDebil)) return null;

  // Rescate muy estricto para marcas claras cuyo contorno apenas entra a otra burbuja.
  const primarioMuyFuerte =
    seleccionada.score >= 0.75 &&
    seleccionada.fillRatioCore >= 0.8 &&
    Number(seleccionada.nucleusFillRatio) >= 0.75 &&
    Number(seleccionada.centroidOffsetRatio) <= 0.35 &&
    seleccionada.markConfidence >= 0.95 &&
    Number(seleccionada.shapeCompactness) >= 0.35 &&
    contrasteSeleccionado >= 0.35;
  const alternativasResiduales = alternativas.every((score) => {
    const contraste = Math.max(Number(score.contraste), Number(score.softCoreContrast ?? 0));
    return score.score <= seleccionada.score * 0.12 &&
      score.fillRatioCore <= 0.31 &&
      Number(score.nucleusFillRatio) <= 0.23 &&
      score.markConfidence <= 0.3 &&
      contraste <= 0.15;
  });
  if (primarioMuyFuerte && seleccionada.score - segunda.score >= 0.6 && alternativasResiduales) {
    return seleccionada.opcion as 'A' | 'B' | 'C' | 'D' | 'E';
  }

  // Rescate para el anillo impreso: la marca central sigue fuerte, y cada
  // alternativa queda bajo los topes históricos de señal parcial no competitiva.
  const primarioFuerte =
    seleccionada.score >= 0.85 &&
    seleccionada.fillRatioCore >= 0.8 &&
    Number(seleccionada.nucleusFillRatio) >= 0.75 &&
    Number(seleccionada.centroidOffsetRatio) <= 0.35 &&
    seleccionada.markConfidence >= 0.9 &&
    Number(seleccionada.shapeCompactness) >= 0.35 &&
    contrasteSeleccionado >= 0.25 &&
    seleccionada.score - segunda.score >= 0.6;
  const alternativasNoCompetitivas = alternativas.every((score) => {
    const contraste = Math.max(Number(score.contraste), Number(score.softCoreContrast ?? 0));
    const ratioScore = score.score / seleccionada.score;
    const debilHistorica =
      ratioScore <= MAX_SCORE_RATIO_PARCIAL_RESIDUAL &&
      score.fillRatioCore <= MAX_FILL_PARCIAL_NO_COMPETITIVO &&
      Number(score.nucleusFillRatio) <= MAX_NUCLEUS_FILL_PARCIAL_NO_COMPETITIVO &&
      score.markConfidence <= MAX_CONFIANZA_MARCA_PARCIAL_NO_COMPETITIVA &&
      Number(score.shapeCompactness) <= MAX_COMPACTNESS_PARCIAL_RESIDUAL &&
      contraste <= MAX_CONTRASTE_PARCIAL_RESIDUAL;
    const contornoDebil =
      ratioScore <= MAX_SCORE_RATIO_PARCIAL_CONTORNO &&
      score.fillRatioCore <= MAX_FILL_PARCIAL_NO_COMPETITIVO &&
      Number(score.nucleusFillRatio) <= 0.23 &&
      score.markConfidence <= 0.3 &&
      Number(score.shapeCompactness) <= MAX_COMPACTNESS_PARCIAL_CONTORNO &&
      contraste <= MAX_CONTRASTE_PARCIAL_RESIDUAL;
    const señalDifusaDebil =
      ratioScore <= MAX_SCORE_RATIO_PARCIAL_DIFUSA &&
      score.fillRatioCore <= MAX_FILL_PARCIAL_DIFUSA &&
      Number(score.nucleusFillRatio) <= 0.15 &&
      score.markConfidence <= 0.3 &&
      Number(score.shapeCompactness) <= 0.08 &&
      contraste <= 0.13;
    return debilHistorica || contornoDebil || señalDifusaDebil;
  });
  return primarioFuerte && alternativasNoCompetitivas
    ? seleccionada.opcion as 'A' | 'B' | 'C' | 'D' | 'E'
    : null;
}

export function parcialDetectadaConFormaCircularFuerte(
  respuesta: NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]
) {
  if (!respuesta.flags?.includes('parcial_detectada') || !respuesta.opcion) return false;
  const scores = respuesta.scoresPorOpcion;
  if (!scores || scores.length !== OPCIONES_OMR.size) return false;
  const seleccionada = scores.find((score) => score.opcion === respuesta.opcion);
  if (!seleccionada) return false;
  const score = Number(seleccionada.score);
  const fillRatioCore = Number(seleccionada.fillRatioCore);
  const centroidOffsetRatio = Number(seleccionada.centroidOffsetRatio);
  const markConfidence = Number(seleccionada.markConfidence);
  const shapeCompactness = Number(seleccionada.shapeCompactness);
  const contraste = Math.max(Number(seleccionada.contraste), Number(seleccionada.softCoreContrast ?? 0));
  if (![score, fillRatioCore, centroidOffsetRatio, markConfidence, shapeCompactness, contraste].every(Number.isFinite)) {
    return false;
  }
  if (
    seleccionada.estadoMarca !== 'marcada' ||
    score < MIN_SCORE_PARCIAL_CIRCULAR_FUERTE ||
    fillRatioCore < 0.65 ||
    centroidOffsetRatio > 0.35 ||
    markConfidence < 0.75 ||
    shapeCompactness < 0.5 ||
    contraste < 0.1
  ) return false;

  const secondScore = Math.max(
    0,
    ...scores.filter((score) => score.opcion !== respuesta.opcion).map((score) => score.score)
  );
  return score - secondScore >= 0.15;
}

function tieneSegundaMarcaConEvidencia(respuesta: NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]) {
  if (!respuesta.opcion || !respuesta.scoresPorOpcion) return false;
  const seleccionada = respuesta.scoresPorOpcion.find((score) => score.opcion === respuesta.opcion);
  if (!seleccionada || !Number.isFinite(seleccionada.score) || seleccionada.score <= 0) return false;

  return respuesta.scoresPorOpcion.some((score) => {
    if (score.opcion === respuesta.opcion || score.estadoMarca !== 'marcada') return false;
    const metricas = [score.score, score.fillRatioCore, score.nucleusFillRatio, score.markConfidence];
    if (!metricas.every((valor) => Number.isFinite(valor))) return false;
    return score.score >= seleccionada.score * MIN_SCORE_RATIO_SEGUNDA_MARCA &&
      score.fillRatioCore >= MIN_FILL_SEGUNDA_MARCA &&
      Number(score.nucleusFillRatio) >= MIN_NUCLEUS_FILL_SEGUNDA_MARCA &&
      score.markConfidence >= MIN_CONFIANZA_SEGUNDA_MARCA;
  });
}

function sinMarcaConEvidenciaDeAusencia(respuesta: NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]) {
  const scores = respuesta.scoresPorOpcion;
  if (respuesta.estadoRespuesta !== 'sin_marca' || respuesta.opcion !== null || !scores || scores.length !== OPCIONES_OMR.size) {
    return false;
  }
  if (new Set(scores.map((score) => score.opcion)).size !== OPCIONES_OMR.size || scores.some((score) => !OPCIONES_OMR.has(score.opcion))) {
    return false;
  }
  return scores.every((score) => {
    const metricas = [score.score, score.fillRatioCore, score.nucleusFillRatio, score.markConfidence];
    return score.estadoMarca === 'no_marcada' &&
      metricas.every((valor) => Number.isFinite(valor)) &&
      score.score <= MAX_SCORE_SIN_MARCA_SEGURA &&
      score.fillRatioCore <= MAX_FILL_SIN_MARCA_SEGURA &&
      Number(score.nucleusFillRatio) <= MAX_NUCLEUS_SIN_MARCA_SEGURA &&
      score.markConfidence <= MAX_CONFIANZA_SIN_MARCA_SEGURA;
  });
}

export function evaluarRescateAltaPrecisionOmr(args: Omit<EntradaAutoCalificacionOmr, 'estadoAnalisis' | 'coberturaDeteccion'>) {
  const { calidadPagina, confianzaPromedioPagina, ratioAmbiguas } = args;
  return (
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.autoRescueQualityMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoRescueConfMin &&
    clamp01(ratioAmbiguas) <= UMBRALES_OMR_AUTO.autoRescueAmbigMax
  );
}

export function evaluarAutoCalificableOmr(args: EntradaAutoCalificacionOmr) {
  const {
    estadoAnalisis,
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas,
    coberturaDeteccion
  } = args;
  const rescateAltaPrecision = evaluarRescateAltaPrecisionOmr({
    calidadPagina,
    confianzaPromedioPagina,
    ratioAmbiguas
  });
  const motivos = new Set<string>();
  for (const respuesta of args.respuestasDetectadas ?? []) {
    if (!respuesta.estadoRespuesta) motivos.add('respuesta_estado_ausente');
    else if (respuesta.estadoRespuesta !== 'respondida' && respuesta.estadoRespuesta !== 'sin_marca') {
      motivos.add('respuesta_estado_no_calificable');
    }
    if (respuesta.estadoRespuesta === 'respondida' && respuesta.opcion === null) motivos.add('respondida_sin_opcion');
    if (respuesta.estadoRespuesta === 'sin_marca' && respuesta.opcion !== null) motivos.add('sin_marca_con_opcion');
    if (respuesta.estadoRespuesta === 'respondida' && tieneSegundaMarcaConEvidencia(respuesta)) {
      motivos.add('segunda_marca_con_evidencia');
    }
    const parcialRecuperable = opcionParcialDominanteRecuperable(respuesta) !== null;
    if (respuesta.flags?.includes('parcial_detectada') &&
        !parcialRecuperable &&
        !parcialDetectadaNoCompetitivaConMarcaFuerte(respuesta)) {
      motivos.add('marca_parcial_no_competitiva');
    }
    const omisionConAusenciaConfirmada = sinMarcaConEvidenciaDeAusencia(respuesta);
    if (!Number.isFinite(respuesta.confianza) ||
        (!omisionConAusenciaConfirmada && !parcialRecuperable && clamp01(Number(respuesta.confianza)) < UMBRALES_OMR_AUTO.autoConfMin)) {
      motivos.add('confianza_reactivo_insuficiente');
    }
  }
  if (clamp01(confianzaPromedioPagina) <= UMBRALES_OMR_AUTO.autoHardStopConfMax) motivos.add('confianza_pagina_hard_stop');
  if (clamp01(ratioAmbiguas) >= UMBRALES_OMR_AUTO.autoHardStopAmbiguasMin) motivos.add('ambiguedad_pagina_hard_stop');
  if (clamp01(coberturaDeteccion) <= UMBRALES_OMR_AUTO.autoHardStopDeteccionMax) motivos.add('cobertura_pagina_hard_stop');
  if (estadoAnalisis === 'rechazado_calidad') motivos.add('calidad_pagina_rechazada');
  const hardStop = motivos.size > 0;
  const cumpleBase =
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.qualityReviewMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoConfMin &&
    clamp01(ratioAmbiguas) <= UMBRALES_OMR_AUTO.autoAmbiguasMax &&
    clamp01(coberturaDeteccion) >= UMBRALES_OMR_AUTO.autoDeteccionMin;
  const autoCalificableOmr = hardStop
    ? false
    : UMBRALES_OMR_AUTO.autoForceAllPages
    ? true
    : estadoAnalisis === 'ok' && (cumpleBase || rescateAltaPrecision);

  if (!autoCalificableOmr && !hardStop && !UMBRALES_OMR_AUTO.autoForceAllPages) {
    if (estadoAnalisis !== 'ok') motivos.add('estado_analisis_no_ok');
    if (!rescateAltaPrecision) {
      if (clamp01(calidadPagina) < UMBRALES_OMR_AUTO.qualityReviewMin) motivos.add('calidad_pagina_insuficiente');
      if (clamp01(confianzaPromedioPagina) < UMBRALES_OMR_AUTO.autoConfMin) motivos.add('confianza_promedio_insuficiente');
      if (clamp01(ratioAmbiguas) > UMBRALES_OMR_AUTO.autoAmbiguasMax) motivos.add('ambiguedad_excede_limite');
      if (clamp01(coberturaDeteccion) < UMBRALES_OMR_AUTO.autoDeteccionMin) motivos.add('cobertura_inferior_al_limite');
    }
    if (motivos.size === 0) motivos.add('estado_analisis_no_aprobado');
  }

  return {
    hardStop,
    rescateAltaPrecision,
    autoCalificableOmr,
    motivos: autoCalificableOmr ? [] : Array.from(motivos)
  };
}
