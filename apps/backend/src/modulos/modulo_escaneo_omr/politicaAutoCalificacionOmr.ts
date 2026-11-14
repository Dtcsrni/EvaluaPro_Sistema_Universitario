import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EVALUAPRO_OMR_EVALUATOR_CODE_SHA256 } from './evaluatorCodeFingerprint.js';

/**
 * politicaAutoCalificacionOmr
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';
const OPCIONES_OMR = new Set(['A', 'B', 'C', 'D', 'E']);
type SenalOpcionOmr = NonNullable<NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]['scoresPorOpcion']>[number];
type SenalDistribuidaOmr = Pick<SenalOpcionOmr, 'score' | 'fillRatioCore' | 'nucleusFillRatio' | 'markConfidence'> & {
  contrasteCromaticoLocal?: number;
  margenCromatico?: number;
};

function esMarcaClaraOmr(score: SenalOpcionOmr) {
  const contraste = Math.max(Number(score.contraste), Number(score.softCoreContrast ?? 0));
  return score.estadoMarca === 'marcada' &&
    Number.isFinite(score.score) && score.score >= 0.3 &&
    Number.isFinite(score.fillRatioCore) && score.fillRatioCore >= 0.65 &&
    Number.isFinite(Number(score.nucleusFillRatio)) && Number(score.nucleusFillRatio) >= 0.55 &&
    Number.isFinite(Number(score.centroidOffsetRatio)) && Number(score.centroidOffsetRatio) <= 0.4 &&
    Number.isFinite(score.markConfidence) && score.markConfidence >= 0.72 &&
    Number.isFinite(Number(score.shapeCompactness)) && Number(score.shapeCompactness) >= 0.25 &&
    Number.isFinite(contraste) && contraste >= 0.1;
}
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
const MAX_SCORE_SIN_MARCA_SEGURA = 0.02;
const MAX_FILL_SIN_MARCA_SEGURA = 0.2;
const MAX_NUCLEUS_SIN_MARCA_SEGURA = 0.1;
const MAX_CONFIANZA_SIN_MARCA_SEGURA = 0.1;
const MIN_SCORE_PARCIAL_CIRCULAR_FUERTE = 0.6;

type SenalMarcaLocalOmr = {
  opcion: string;
  score: number;
  fillRatioCore: number;
  nucleusFillRatio: number;
  contraste: number;
  shapeCompactness: number;
};

/**
 * Resuelve una marca trasladada por deformación local solo si una burbuja
 * contiene relleno sólido y compacto, y las cuatro alternativas permanecen
 * vacías. No interpreta manchas parciales ni permite una segunda opción.
 */
export function seleccionarMarcaLocalUnicaFuerteOmr(
  senales: readonly SenalMarcaLocalOmr[]
): string | null {
  if (senales.length !== OPCIONES_OMR.size) return null;
  const ordenadas = [...senales].sort((a, b) => b.score - a.score);
  const [primera, segunda] = ordenadas;
  if (!primera || !segunda) return null;
  const valores = [
    primera.score,
    primera.fillRatioCore,
    primera.nucleusFillRatio,
    primera.contraste,
    primera.shapeCompactness,
    segunda.score,
    segunda.fillRatioCore,
    segunda.nucleusFillRatio
  ];
  if (!valores.every(Number.isFinite)) return null;
  const marcaSólida =
    primera.score >= 0.8 &&
    primera.fillRatioCore >= 0.78 &&
    primera.nucleusFillRatio >= 0.78 &&
    primera.contraste >= 0.3 &&
    primera.shapeCompactness >= 0.55;
  const alternativasVacías = ordenadas.slice(1).every((senal) =>
    senal.score <= 0.18 && senal.fillRatioCore <= 0.2 && senal.nucleusFillRatio <= 0.2
  );
  const margenSuficiente = primera.score - segunda.score >= 0.6;
  return marcaSólida && alternativasVacías && margenSuficiente && OPCIONES_OMR.has(primera.opcion)
    ? primera.opcion
    : null;
}

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
      fillRatioRing?: number;
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
  'gradeConsistencyObserved',
  'bonusConsistencyObserved'
] as const;

const MINIMUM_EXAMS_FOR_EMPIRICAL_BATCH_GATE = 12;
const MINIMUM_EXAMS_FOR_POPULATION_GATE = 149;
const POPULATION_GATE_CONFIDENCE_LEVEL = 0.95;
const POPULATION_GATE_MINIMUM_LOWER_BOUND = 0.98;

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
      batchGate?: Record<string, unknown>;
      populationGate?: Record<string, unknown>;
    };
    const metrics = report.metrics;
    const thresholds = report.thresholds;
    const evidenceHashes = report.evidenceHashes;
    const populationGate = report.populationGate;
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
      evidenceHashes?.evaluatorCodeSha256 === EVALUAPRO_OMR_EVALUATOR_CODE_SHA256 &&
      report.batchGate?.status === 'passed' && report.batchGate?.passed === true &&
      report.batchGate?.minimumIndependentExams === MINIMUM_EXAMS_FOR_EMPIRICAL_BATCH_GATE &&
      CHECKS_PILOTO_REQUERIDOS.every((check) => report.checks?.[check] === true) &&
      report.evidenceHashes?.omrRuntimeConfigSha256 === OMR_RUNTIME_CONFIG_SHA256 &&
      hashesRequeridos.every((key) => hashSha256(evidenceHashes?.[key])))) return false;

    const gradeConsistencyMinimum = thresholds?.gradeConsistencyObservedMin;
    const coverageMinimum = thresholds?.autoCoverageMin;
    const totalCaptures = metrics?.totalCaptures;
    const gradeComparisons = metrics?.gradeComparisons;
    const bonusComparisons = metrics?.bonusComparisons;
    const gradeConsistency = metrics?.gradeConsistency;
    const bonusConsistency = metrics?.bonusConsistency;
    const pagePassRate = metrics?.pagePassRate;
    const autoGradeTrustRate = metrics?.autoGradeTrustRate;
    const autoCoverageRate = metrics?.autoCoverageRate;
    const humanReviewedRows = metrics?.humanReviewedRows;
    const humanReviewerCount = metrics?.humanReviewerCount;
    const gradeDiscordances = metrics?.automaticGradeDiscordances;
    const bonusDiscordances = metrics?.bonusDiscordances;
    const populationGrade = populationGate?.grade as Record<string, unknown> | undefined;
    const populationBonus = populationGate?.bonus as Record<string, unknown> | undefined;
    const populationEvidenceMatches =
      populationGate?.status === 'passed' && populationGate.passed === true &&
      populationGate.method === 'clopper_pearson_one_sided_exact_binomial_lower_bound' &&
      populationGate.confidenceLevel === POPULATION_GATE_CONFIDENCE_LEVEL &&
      populationGate.minimumLowerBound === POPULATION_GATE_MINIMUM_LOWER_BOUND &&
      populationGate.minimumIndependentExamsAtZeroDiscordances === MINIMUM_EXAMS_FOR_POPULATION_GATE &&
      numeric(gradeComparisons) && gradeComparisons >= MINIMUM_EXAMS_FOR_POPULATION_GATE &&
      numeric(bonusComparisons) && bonusComparisons >= MINIMUM_EXAMS_FOR_POPULATION_GATE &&
      Number.isInteger(gradeDiscordances) && Number(gradeDiscordances) >= 0 &&
      Number.isInteger(bonusDiscordances) && Number(bonusDiscordances) >= 0 &&
      report.batchGate?.gradeComparisons === gradeComparisons &&
      report.batchGate?.bonusComparisons === bonusComparisons &&
      numeric(populationGrade?.independentExams) && populationGrade.independentExams === gradeComparisons &&
      populationGrade.discordances === gradeDiscordances &&
      populationGrade.lowerBound === metrics?.gradeConsistencyLower95 &&
      numeric(populationGrade.lowerBound) && populationGrade.lowerBound >= POPULATION_GATE_MINIMUM_LOWER_BOUND &&
      numeric(populationBonus?.independentExams) && populationBonus.independentExams === bonusComparisons &&
      populationBonus.discordances === bonusDiscordances &&
      populationBonus.lowerBound === metrics?.bonusConsistencyLower95 &&
      numeric(populationBonus.lowerBound) && populationBonus.lowerBound >= POPULATION_GATE_MINIMUM_LOWER_BOUND;
    return numeric(gradeConsistencyMinimum) && gradeConsistencyMinimum === 1 &&
      numeric(coverageMinimum) && coverageMinimum === 1 &&
      numeric(totalCaptures) && totalCaptures > 0 &&
      numeric(gradeComparisons) && gradeComparisons >= MINIMUM_EXAMS_FOR_EMPIRICAL_BATCH_GATE &&
      numeric(bonusComparisons) && bonusComparisons >= MINIMUM_EXAMS_FOR_EMPIRICAL_BATCH_GATE &&
      numeric(gradeConsistency) && gradeConsistency === 1 &&
      numeric(bonusConsistency) && bonusConsistency === 1 &&
      numeric(pagePassRate) && pagePassRate === 1 &&
      numeric(autoGradeTrustRate) && autoGradeTrustRate === 1 &&
      numeric(autoCoverageRate) && autoCoverageRate === 1 &&
      numeric(humanReviewedRows) && humanReviewedRows > 0 &&
      numeric(humanReviewerCount) && humanReviewerCount > 0 &&
      populationEvidenceMatches;
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
 * Recupera una marca parcial si hay una única alternativa claramente marcada,
 * o la mejor señal supera el piso de ruido. Si dos alternativas son claras,
 * conserva la respuesta como doble/ambigua.
 */
export function opcionParcialDominanteRecuperable(
  respuesta: NonNullable<EntradaAutoCalificacionOmr['respuestasDetectadas']>[number]
) {
  if (
    !respuesta.flags?.includes('parcial_detectada') ||
    respuesta.flags.includes('tachada_detectada') ||
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
  const senalesValidas = orden.every((score) => [
    score.score,
    score.fillRatioCore,
    Number(score.nucleusFillRatio),
    Number(score.centroidOffsetRatio),
    score.markConfidence,
    Number(score.shapeCompactness),
    Math.max(Number(score.contraste), Number(score.softCoreContrast ?? 0))
  ].every(Number.isFinite));
  if (!senalesValidas) return null;

  const candidata = orden[0];
  const competidora = orden[1];
  // Si la señal dominante ocupa mucho el anillo y es poco compacta, mientras
  // otra opción también muestra núcleo y relleno medibles, la lectura puede
  // venir de texto/elementos del panel superpuestos al área de burbujas. No
  // elijas una letra en ese empate morfológico; una marca aislada y centrada
  // (aunque sea tenue) sigue siendo recuperable abajo.
  const contaminacionDePanelIndistinguible = Boolean(
    candidata && competidora &&
    Number(candidata.fillRatioRing) >= 0.4 &&
    Number(candidata.shapeCompactness) < 0.45 &&
    competidora.score >= 0.18 &&
    Number(competidora.nucleusFillRatio) >= 0.4
  );
  if (contaminacionDePanelIndistinguible) return null;

  const marcasClaras = orden.filter(esMarcaClaraOmr);
  if (marcasClaras.length === 1) return marcasClaras[0]!.opcion as 'A' | 'B' | 'C' | 'D' | 'E';
  if (marcasClaras.length > 1) return null;

  // Un indicador de doble marca sin una opción claramente rellena sigue
  // siendo error ambiguo; no se elige entre dos señales dudosas.
  if (respuesta.flags.includes('doble_marca') || respuesta.estadoRespuesta === 'doble_marca') return null;

  if (!candidata || candidata.estadoMarca === 'tachada') return null;
  const contraste = Math.max(Number(candidata.contraste), Number(candidata.softCoreContrast ?? 0));
  const senalSobrePisoDeRuido =
    candidata.score >= 0.1 &&
    candidata.fillRatioCore >= 0.2 &&
    Number(candidata.nucleusFillRatio) >= 0.07 &&
    Number(candidata.centroidOffsetRatio) <= 0.45 &&
    candidata.markConfidence >= 0.2 &&
    Number(candidata.shapeCompactness) >= 0.15 &&
    contraste >= 0.05;
  return senalSobrePisoDeRuido
    ? candidata.opcion as 'A' | 'B' | 'C' | 'D' | 'E'
    : null;
}

/**
 * Detecta filas donde la tinta aparente está repartida entre varias burbujas.
 * El puntaje de una sola opción no es suficiente si todas las ventanas OMR
 * comparten relleno (fondo, texto o fiduciales) o si varias señales débiles
 * quedan prácticamente empatadas.
 */
export function evidenciaOmrNoDiscriminante(
  respuesta: { scoresPorOpcion?: readonly SenalDistribuidaOmr[] | null }
) {
  const scores = respuesta.scoresPorOpcion;
  if (!scores || scores.length !== OPCIONES_OMR.size) return false;
  if (!scores.every((score) => [score.score, score.fillRatioCore, Number(score.nucleusFillRatio), score.markConfidence].every(Number.isFinite))) {
    return false;
  }

  const orden = [...scores].sort((a, b) => b.score - a.score);
  const primera = orden[0];
  const segunda = orden[1];
  if (!primera || !segunda) return false;

  const evidenciaCromaticaDominante = Number(primera.contrasteCromaticoLocal) >= 0.06 &&
    Number(primera.margenCromatico) >= 0.08;
  const rellenoCompartido = !evidenciaCromaticaDominante &&
    scores.filter((score) => score.score >= 0.15 && score.fillRatioCore >= 0.4).length >= 4;
  const empateDebilConRuidoDistribuido = primera.score <= 0.25 &&
    primera.score - segunda.score <= 0.025 &&
    scores.filter((score) => score.score >= 0.1 && score.fillRatioCore >= 0.18 && Number(score.nucleusFillRatio) >= 0.25).length >= 2;

  return rellenoCompartido || empateDebilConRuidoDistribuido;
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
  return respuesta.scoresPorOpcion.some((score) =>
    score.opcion !== respuesta.opcion && esMarcaClaraOmr(score)
  );
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

export function evaluarRescateAltaPrecisionOmr(args: Pick<EntradaAutoCalificacionOmr, 'calidadPagina' | 'confianzaPromedioPagina'>) {
  const { calidadPagina, confianzaPromedioPagina } = args;
  return (
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.autoRescueQualityMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoRescueConfMin
  );
}

export function evaluarAutoCalificableOmr(args: EntradaAutoCalificacionOmr) {
  const {
    estadoAnalisis,
    calidadPagina,
    confianzaPromedioPagina,
    coberturaDeteccion
  } = args;
  const rescateAltaPrecision = evaluarRescateAltaPrecisionOmr({ calidadPagina, confianzaPromedioPagina });
  const motivos = new Set<string>();
  for (const respuesta of args.respuestasDetectadas ?? []) {
    if (!respuesta.estadoRespuesta) motivos.add('respuesta_estado_ausente');
    else if (!['respondida', 'sin_marca', 'ambigua', 'doble_marca', 'tachada'].includes(respuesta.estadoRespuesta)) {
      motivos.add('respuesta_estado_no_calificable');
    }
    if (respuesta.estadoRespuesta === 'respondida' && respuesta.opcion === null) motivos.add('respondida_sin_opcion');
    if (respuesta.estadoRespuesta === 'sin_marca' && respuesta.opcion !== null) motivos.add('sin_marca_con_opcion');
    if (['ambigua', 'doble_marca', 'tachada'].includes(String(respuesta.estadoRespuesta)) && respuesta.opcion !== null) {
      motivos.add('respuesta_estado_no_calificable');
    }
    if (respuesta.estadoRespuesta === 'respondida' && tieneSegundaMarcaConEvidencia(respuesta)) {
      motivos.add('segunda_marca_con_evidencia');
    }
    const respuestaInvalidadaPorMarca = ['sin_marca', 'ambigua', 'doble_marca', 'tachada'].includes(String(respuesta.estadoRespuesta));
    const parcialRecuperable = opcionParcialDominanteRecuperable(respuesta) !== null;
    if (respuesta.flags?.includes('parcial_detectada') &&
        !respuestaInvalidadaPorMarca &&
        !parcialRecuperable &&
        !parcialDetectadaNoCompetitivaConMarcaFuerte(respuesta)) {
      motivos.add('marca_parcial_no_competitiva');
    }
    // Una marca ambigua, doble o tachada se registra como incorrecta; su
    // confianza local no debe bloquear el puntaje cuando los controles de
    // calidad, cobertura e identidad de la página sí son suficientes.
    const omisionConAusenciaConfirmada = sinMarcaConEvidenciaDeAusencia(respuesta);
    if (!respuestaInvalidadaPorMarca && (!Number.isFinite(respuesta.confianza) ||
        (!omisionConAusenciaConfirmada && !parcialRecuperable && clamp01(Number(respuesta.confianza)) < UMBRALES_OMR_AUTO.autoConfMin))) {
      motivos.add('confianza_reactivo_insuficiente');
    }
  }
  if (clamp01(confianzaPromedioPagina) <= UMBRALES_OMR_AUTO.autoHardStopConfMax) motivos.add('confianza_pagina_hard_stop');
  if (clamp01(coberturaDeteccion) <= UMBRALES_OMR_AUTO.autoHardStopDeteccionMax) motivos.add('cobertura_pagina_hard_stop');
  if (estadoAnalisis === 'rechazado_calidad') motivos.add('calidad_pagina_rechazada');
  const hardStop = motivos.size > 0;
  const cumpleBase =
    clamp01(calidadPagina) >= UMBRALES_OMR_AUTO.qualityReviewMin &&
    clamp01(confianzaPromedioPagina) >= UMBRALES_OMR_AUTO.autoConfMin &&
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
