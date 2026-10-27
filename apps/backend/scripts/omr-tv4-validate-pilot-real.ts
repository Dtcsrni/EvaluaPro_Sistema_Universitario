/**
 * omr-tv4-validate-pilot-real
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { calcularCalificacionExacta } from '../src/compartido/utilidades/calculoCalificacion.js';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/index.js';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import { clasificarEstadoRespuestaOmr } from '../src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.js';
import type { EstadoRespuestaOmr } from '../src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.js';
import {
  evaluarAutoCalificableOmr,
  OMR_RUNTIME_CONFIG_SHA256
} from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';
import { leerBonoVisibleOmr } from '../src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.js';
import type {
  CaptureManifestPorFolio,
  GroundTruthRowPorFolio,
  MapaOmrPaginaPorFolio
} from '../src/modulos/modulo_escaneo_omr/porFolioDataset.js';

type EstadoAnalisisOmr = 'ok' | 'rechazado_calidad' | 'requiere_revision';

type EvalThresholds = {
  precisionMin: number;
  falsePositiveMax: number;
  invalidDetectionMin: number;
  pagePassMin: number;
  autoGradeTrustMin: number;
  autoCoverageMin: number;
  gradeConsistencyLower95Min: number;
};

type ManifestDataset = {
  version: string;
  datasetType: string;
  thresholds: EvalThresholds;
  groundTruthRef: string;
  answerKeyPath: string;
  answerKeyByFolioPath?: string;
  capturas: CaptureManifestPorFolio[];
};

type OpcionClave = 'A' | 'B' | 'C' | 'D' | 'E';
export type AnswerKey = Record<number, OpcionClave>;
const GRADE_CONSISTENCY_LOWER_95_MINIMUM = 0.98;

export type CandidateExamGrade = {
  fullCoverage: boolean;
  autoEligible: boolean;
  expectedCorrect: number;
  detectedCorrect: number;
  expectedBonus?: 0 | 0.25;
  detectedBonus?: 0 | 0.25;
  bonusLabelSeen?: boolean;
  answerKey?: AnswerKey;
};

type PilotValidationStatus = 'passed' | 'failed' | 'not_applicable';

type Args = {
  dataset: string;
  report: string;
  failureReport: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv4_pilot_real',
    report: '../../reports/qa/latest/omr/tv4-pilot-real-validation.json',
    failureReport: '../../reports/qa/latest/omr/tv4-pilot-real-failures.json'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--report' || key === '-r') && value) {
      args.report = value;
      i += 1;
      continue;
    }
    if (key === '--failure-report' && value) {
      args.failureReport = value;
      i += 1;
    }
  }
  return args;
}

async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function readGroundTruth(filePath: string) {
  return (await fs.readFile(filePath, 'utf8'))
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GroundTruthRowPorFolio);
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validarGroundTruthHumano(rows: GroundTruthRowPorFolio[]) {
  const revisores = new Set<string>();
  const filasInvalidas: string[] = [];
  for (const row of rows) {
    const review = row.humanReview;
    const reviewedAt = typeof review?.reviewedAt === 'string' ? Date.parse(review.reviewedAt) : Number.NaN;
    const fechaCanonica = Number.isFinite(reviewedAt) && new Date(reviewedAt).toISOString() === review?.reviewedAt;
    if (
      review?.method !== 'visual_original_capture' ||
      review.reviewerAttested !== true ||
      review.independentOfOmr !== true ||
      review.omrPredictionsHidden !== true ||
      !/^[a-f0-9]{64}$/i.test(String(review.reviewerIdHash ?? '')) ||
      !fechaCanonica ||
      row.sourceEvidence?.detector !== 'manual_visual_review' ||
      !Number.isSafeInteger(row.sourceEvidence.sourcePage) ||
      row.sourceEvidence.sourcePage < 1 ||
      !/^[a-f0-9]{64}$/i.test(row.sourceEvidence.pageImageSha256) ||
      (row.numeroPagina === 1 && typeof row.bonusVisible !== 'boolean') ||
      (row.numeroPagina !== 1 && row.bonusVisible !== undefined)
    ) {
      filasInvalidas.push(`${row.captureId}:Q${row.numeroPregunta}`);
      continue;
    }
    revisores.add(review.reviewerIdHash.toLowerCase());
  }
  return {
    valid: rows.length > 0 && filasInvalidas.length === 0,
    reviewedRows: rows.length - filasInvalidas.length,
    reviewerCount: revisores.size,
    invalidRows: filasInvalidas
  };
}

export function validarHashCapturaEtiquetada(rows: GroundTruthRowPorFolio[], imageSha256: string) {
  const hash = imageSha256.toLowerCase();
  return rows
    .filter((row) => row.sourceEvidence.detector !== 'manual_visual_review'
      || row.sourceEvidence.pageImageSha256.toLowerCase() !== hash)
    .map((row) => `${row.captureId}:Q${row.numeroPregunta}`);
}

export function detectarDuplicadoImagenEntreFolios(args: {
  imageSha256: string;
  captureId: string;
  folio: string;
  seen: Map<string, { folio: string; captureId: string }>;
}) {
  const folio = args.folio.trim().toUpperCase();
  const previous = args.seen.get(args.imageSha256);
  if (previous && previous.folio !== folio) return previous.captureId;
  if (!previous) args.seen.set(args.imageSha256, { folio, captureId: args.captureId });
  return null;
}

export function validarIdentidadQrCaptura(args: {
  expectedQr: string;
  mapQr: string;
  folio: string;
  numeroPagina: number;
}) {
  const expectedQr = args.expectedQr.trim();
  const mapQr = args.mapQr.trim();
  if (!expectedQr || expectedQr !== mapQr) return false;
  const identity = extraerResumenQrExamen(expectedQr);
  return Boolean(identity
    && identity.folio === args.folio.trim().toUpperCase()
    && identity.numeroPagina === args.numeroPagina
    && identity.templateVersion === 4
    && identity.payloadSignatureValid !== false);
}

async function readAnswerKey(filePath: string): Promise<AnswerKey> {
  const raw = await readJsonFile<Record<string, unknown>>(filePath);
  const entries = Object.entries(raw ?? {});
  if (entries.length === 0) throw new Error('El piloto real requiere una clave de respuestas no vacía.');
  const answerKey: AnswerKey = {};
  for (const [questionNumberRaw, answer] of entries) {
    const questionNumber = Number(questionNumberRaw);
    if (!Number.isSafeInteger(questionNumber) || questionNumber <= 0 || !['A', 'B', 'C', 'D', 'E'].includes(String(answer))) {
      throw new Error(`La clave del piloto real contiene una entrada inválida en la pregunta ${questionNumberRaw}.`);
    }
    answerKey[questionNumber] = answer as OpcionClave;
  }
  const questionNumbers = Object.keys(answerKey).map(Number).sort((a, b) => a - b);
  if (questionNumbers.some((questionNumber, index) => questionNumber !== index + 1)) {
    throw new Error('La clave del piloto real debe cubrir preguntas consecutivas desde 1.');
  }
  return answerKey;
}

export async function readAnswerKeysByFolio(filePath: string | undefined): Promise<Record<string, AnswerKey>> {
  if (!filePath) return {};
  const raw = await readJsonFile<Record<string, unknown>>(filePath);
  const entries = Object.entries(raw ?? {});
  if (entries.length === 0) throw new Error('answerKeyByFolio no puede estar vacío.');
  const result: Record<string, AnswerKey> = {};
  for (const [folio, rawKey] of entries) {
    if (!folio.trim() || !rawKey || typeof rawKey !== 'object' || Array.isArray(rawKey)) {
      throw new Error(`answerKeyByFolio contiene una clave inválida para ${folio || '(folio vacío)'}.`);
    }
    const answerKey: AnswerKey = {};
    for (const [questionNumberRaw, answer] of Object.entries(rawKey as Record<string, unknown>)) {
      const questionNumber = Number(questionNumberRaw);
      if (!Number.isSafeInteger(questionNumber) || questionNumber <= 0 || !['A', 'B', 'C', 'D', 'E'].includes(String(answer))) {
        throw new Error(`answerKeyByFolio contiene una entrada inválida en ${folio}, pregunta ${questionNumberRaw}.`);
      }
      answerKey[questionNumber] = answer as OpcionClave;
    }
    const questionNumbers = Object.keys(answerKey).map(Number).sort((a, b) => a - b);
    if (questionNumbers.length === 0 || questionNumbers.some((questionNumber, index) => questionNumber !== index + 1)) {
      throw new Error(`La clave de ${folio} debe cubrir preguntas consecutivas desde 1.`);
    }
    result[folio] = answerKey;
  }
  return result;
}

async function resolveDatasetFile(datasetRoot: string, relativePath: string) {
  const rootReal = await fs.realpath(datasetRoot);
  const candidate = path.resolve(rootReal, relativePath);
  const relative = path.relative(rootReal, candidate);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Ruta de archivo fuera del dataset OMR: ${relativePath}`);
  }
  const realPath = await fs.realpath(candidate);
  const realRelative = path.relative(rootReal, realPath);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    throw new Error(`Ruta de archivo fuera del dataset OMR: ${relativePath}`);
  }
  return realPath;
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listTypeScriptFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(entryPath);
  }
  return files;
}

async function hashPilotEvidence(args: {
  datasetRoot: string;
  manifestBytes: Buffer;
  manifest: ManifestDataset;
}) {
  const groundTruthPath = await resolveDatasetFile(args.datasetRoot, args.manifest.groundTruthRef);
  const answerKeyPath = await resolveDatasetFile(args.datasetRoot, args.manifest.answerKeyPath);
  const answerKeyByFolioPath = args.manifest.answerKeyByFolioPath
    ? await resolveDatasetFile(args.datasetRoot, args.manifest.answerKeyByFolioPath)
    : undefined;
  const groundTruthBytes = await fs.readFile(groundTruthPath);
  const answerKeyBytes = await fs.readFile(answerKeyPath);
  const answerKeyByFolioBytes = answerKeyByFolioPath ? await fs.readFile(answerKeyByFolioPath) : Buffer.alloc(0);
  const assets = new Map<string, string>();
  for (const capture of args.manifest.capturas) {
    for (const relativePath of [capture.imagePath, capture.mapaOmrPath]) {
      const absolutePath = await resolveDatasetFile(args.datasetRoot, relativePath);
      assets.set(relativePath.replaceAll('\\', '/'), sha256(await fs.readFile(absolutePath)));
    }
  }
  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const codeFiles = [
    fileURLToPath(import.meta.url),
    path.join(backendRoot, 'src', 'compartido', 'utilidades', 'calculoCalificacion.ts'),
    ...await listTypeScriptFiles(path.join(backendRoot, 'src', 'modulos', 'modulo_escaneo_omr')),
    ...await listTypeScriptFiles(path.join(backendRoot, 'src', 'modulos', 'modulo_calificacion'))
  ].sort();
  const codeHashes = await Promise.all(codeFiles.map(async (filePath) => ({
    file: path.relative(backendRoot, filePath).replaceAll('\\', '/'),
    sha256: sha256(await fs.readFile(filePath))
  })));
  return {
    manifestSha256: sha256(args.manifestBytes),
    groundTruthSha256: sha256(groundTruthBytes),
    answerKeySha256: sha256(answerKeyBytes),
    answerKeyByFolioSha256: answerKeyByFolioBytes.length ? sha256(answerKeyByFolioBytes) : null,
    captureAssetsSha256: sha256(JSON.stringify([...assets.entries()].sort(([a], [b]) => a.localeCompare(b)))),
    evaluatorCodeSha256: sha256(JSON.stringify(codeHashes)),
    omrRuntimeConfigSha256: OMR_RUNTIME_CONFIG_SHA256
  };
}

export function calcularConcordanciaNotasPorExamen(answerKey: AnswerKey, exams: CandidateExamGrade[]) {
  let comparisons = 0;
  let consistent = 0;
  let bonusComparisons = 0;
  let bonusConsistent = 0;
  for (const exam of exams) {
    if (!exam.fullCoverage || !exam.autoEligible || exam.expectedBonus === undefined || exam.detectedBonus === undefined) continue;
    const examAnswerKey = exam.answerKey ?? answerKey;
    const totalQuestions = Object.keys(examAnswerKey).length;
    if (totalQuestions === 0) continue;
    comparisons += 1;
    const expectedBonus = exam.expectedBonus;
    const detectedBonus = exam.detectedBonus;
    const expectedGrade = calcularCalificacionExacta(exam.expectedCorrect, totalQuestions, expectedBonus).calificacionFinalTexto;
    const detectedGrade = calcularCalificacionExacta(exam.detectedCorrect, totalQuestions, detectedBonus).calificacionFinalTexto;
    if (expectedGrade === detectedGrade) consistent += 1;
    bonusComparisons += 1;
    if (expectedBonus === detectedBonus) bonusConsistent += 1;
  }
  return {
    gradeComparisons: comparisons,
    gradeConsistency: comparisons > 0 ? consistent / comparisons : 0,
    automaticGradeDiscordances: comparisons - consistent,
    bonusComparisons,
    bonusConsistency: bonusComparisons > 0 ? bonusConsistent / bonusComparisons : null,
    bonusDiscordances: bonusComparisons - bonusConsistent
  };
}

export function contarAbstencionesBono(exams: CandidateExamGrade[]) {
  return exams.filter((exam) => exam.bonusLabelSeen === true && exam.detectedBonus === undefined).length;
}

function probabilidadBinomialAlMenos(exitos: number, ensayos: number, probabilidad: number) {
  if (exitos === 0) return 1;
  if (probabilidad <= 0) return 0;
  if (probabilidad >= 1) return 1;

  let logCoeficiente = 0;
  for (let indice = 1; indice <= exitos; indice += 1) {
    logCoeficiente += Math.log(ensayos - exitos + indice) - Math.log(indice);
  }

  const logP = Math.log(probabilidad);
  const logComplemento = Math.log1p(-probabilidad);
  let termino = Math.exp(
    logCoeficiente + exitos * logP + (ensayos - exitos) * logComplemento
  );
  let acumulado = termino;
  for (let resultado = exitos; resultado < ensayos && termino > 0; resultado += 1) {
    termino *= ((ensayos - resultado) / (resultado + 1)) * (probabilidad / (1 - probabilidad));
    acumulado += termino;
  }
  return Math.min(1, acumulado);
}

/** Límite inferior unilateral exacto Clopper-Pearson para concordancia binomial. */
export function calcularCotaInferiorExactaConcordancia(
  examCount: number,
  discordances: number,
  confidenceLevel = 0.95
) {
  if (!Number.isSafeInteger(examCount) || examCount < 0) {
    throw new Error('El número de exámenes debe ser un entero no negativo.');
  }
  if (!Number.isSafeInteger(discordances) || discordances < 0 || discordances > examCount) {
    throw new Error('El número de discordancias debe ser un entero entre cero y el total de exámenes.');
  }
  if (!Number.isFinite(confidenceLevel) || confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error('El nivel de confianza debe estar en el intervalo abierto (0,1).');
  }
  if (examCount === 0) return null;
  const successes = examCount - discordances;
  if (successes === 0) return 0;
  const alpha = 1 - confidenceLevel;
  if (discordances === 0) return alpha ** (1 / examCount);

  // Invierte P_p(X >= successes) = alpha por bisección; la cola binomial es
  // monótona en p y evita aproximaciones normales para muestras pequeñas.
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (probabilidadBinomialAlMenos(successes, examCount, middle) < alpha) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

export function cumpleGateConcordanciaNotas(
  examCount: number,
  discordances: number,
  minimumLowerBound: number,
  confidenceLevel = 0.95
) {
  if (!Number.isFinite(minimumLowerBound) || minimumLowerBound <= 0 || minimumLowerBound >= 1) {
    throw new Error('El límite inferior mínimo debe estar en el intervalo abierto (0,1).');
  }
  const lowerBound = calcularCotaInferiorExactaConcordancia(examCount, discordances, confidenceLevel);
  return lowerBound !== null && lowerBound >= minimumLowerBound;
}

export function calcularMinimoExamenesSinDiscordancias(args: {
  targetConsistency: number;
  confidenceLevel?: number;
}) {
  const confidenceLevel = args.confidenceLevel ?? 0.95;
  if (!Number.isFinite(args.targetConsistency) || args.targetConsistency <= 0 || args.targetConsistency >= 1) {
    throw new Error('La concordancia objetivo debe estar en el intervalo abierto (0,1).');
  }
  if (!Number.isFinite(confidenceLevel) || confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error('El nivel de confianza debe estar en el intervalo abierto (0,1).');
  }
  return Math.ceil(Math.log(1 - confidenceLevel) / Math.log(args.targetConsistency));
}

export function calcularConcordanciaPorCondicion(rows: Array<{
  folio: string;
  condition: string;
  discordant: boolean;
}>) {
  const grouped = new Map<string, Map<string, { units: number; discordantUnits: number }>>();
  for (const row of rows) {
    const condition = row.condition.trim();
    const folio = row.folio.trim().toUpperCase();
    if (!condition || !folio) throw new Error('La condición y el folio son obligatorios para el reporte estratificado.');
    if (!grouped.has(condition)) grouped.set(condition, new Map());
    const byExam = grouped.get(condition)!;
    const exam = byExam.get(folio) ?? { units: 0, discordantUnits: 0 };
    exam.units += 1;
    if (row.discordant) exam.discordantUnits += 1;
    byExam.set(folio, exam);
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([condition, exams]) => {
    const independentExams = exams.size;
    const discordantExams = [...exams.values()].filter((exam) => exam.discordantUnits > 0).length;
    const units = [...exams.values()].reduce((total, exam) => total + exam.units, 0);
    const discordantUnits = [...exams.values()].reduce((total, exam) => total + exam.discordantUnits, 0);
    const lower95 = calcularCotaInferiorExactaConcordancia(independentExams, discordantExams);
    return {
      condition,
      independentExams,
      units,
      discordantExams,
      discordantUnits,
      consistency: independentExams > 0 ? round6((independentExams - discordantExams) / independentExams) : null,
      lower95: lower95 === null ? null : round6(lower95)
    };
  });
}

function coincideConVerdadTerreno(row: GroundTruthRowPorFolio, current?: {
  opcion: string | null;
  flags: string[];
  estadoRespuesta?: EstadoRespuestaOmr;
}) {
  const detectedOption = current?.opcion ?? null;
  const detectedState = current?.estadoRespuesta ?? (current
    ? clasificarEstadoRespuestaOmr({ opcion: current.opcion, flags: current.flags })
    : undefined);
  if (row.markType === 'valid') return detectedState === 'respondida' && detectedOption === row.opcionEsperada;
  if (row.markType === 'blank') return detectedState === 'sin_marca' && detectedOption === null;
  return detectedState === 'ambigua' || detectedState === 'doble_marca' || detectedState === 'tachada';
}

function imageToDataUrl(imagePath: string, fileBuffer: Buffer) {
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fileBuffer.toString('base64')}`;
}

function round6(value: number) {
  return Number(value.toFixed(6));
}

export function isResolvedDetection(current?: {
  opcion: string | null;
  flags: string[];
  confianza: number;
  estadoRespuesta?: EstadoRespuestaOmr;
}) {
  if (!current) return false;
  const estado = current.estadoRespuesta ?? clasificarEstadoRespuestaOmr({
    opcion: current.opcion,
    flags: current.flags
  });
  if (current.confianza < 0.62 || !Number.isFinite(current.confianza)) return false;
  if (estado === 'respondida') {
    return Boolean(current.opcion) && !current.flags.some((flag) => flag === 'doble_marca' || flag === 'tachada_detectada');
  }
  return estado === 'sin_marca' && current.opcion === null && current.flags.length === 0;
}

function groupTruth(rows: GroundTruthRowPorFolio[]) {
  const grouped = new Map<string, Map<number, GroundTruthRowPorFolio>>();
  for (const row of rows) {
    if (!grouped.has(row.captureId)) grouped.set(row.captureId, new Map<number, GroundTruthRowPorFolio>());
    grouped.get(row.captureId)!.set(row.numeroPregunta, row);
  }
  return grouped;
}

function bump(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

export async function runTv4PilotRealValidation(args: {
  datasetRoot: string;
  reportPath: string;
  failureReportPath: string;
}) {
  const datasetRoot = path.resolve(process.cwd(), args.datasetRoot);
  const reportPath = path.resolve(process.cwd(), args.reportPath);
  const failureReportPath = path.resolve(process.cwd(), args.failureReportPath);
  const manifestPath = await resolveDatasetFile(datasetRoot, 'manifest.json');
  const manifestBytes = await fs.readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as ManifestDataset;
  if (!Number.isFinite(manifest.thresholds?.gradeConsistencyLower95Min) ||
      manifest.thresholds.gradeConsistencyLower95Min < GRADE_CONSISTENCY_LOWER_95_MINIMUM ||
      manifest.thresholds.gradeConsistencyLower95Min >= 1) {
    throw new Error('El manifest requiere thresholds.gradeConsistencyLower95Min entre 0.98 y 1.0, sin incluir 1.0.');
  }
  if (!Number.isFinite(manifest.thresholds?.autoCoverageMin) ||
      manifest.thresholds.autoCoverageMin < 0.8 ||
      manifest.thresholds.autoCoverageMin > 1) {
    throw new Error('El manifest requiere thresholds.autoCoverageMin entre 0.8 y 1.0.');
  }
  if (!Array.isArray(manifest.capturas) || manifest.capturas.length === 0) {
    const runId = `omr-tv4-pilot-real-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const reason = 'El dataset piloto real TV4 no contiene capturas; la validación física queda not_applicable.';
    const report = {
      runId,
      timestamp,
      datasetRoot,
      datasetType: manifest.datasetType,
      status: 'not_applicable' as PilotValidationStatus,
      reason,
      evidenceHashes: { omrRuntimeConfigSha256: OMR_RUNTIME_CONFIG_SHA256 },
      thresholds: manifest.thresholds,
      metrics: {
        precision: null,
        falsePositiveRate: null,
        invalidDetectionRate: null,
        pagePassRate: null,
        autoGradeTrustRate: null,
        autoCoverageRate: null,
        gradeConsistency: null,
        gradeConsistencyLower95: null,
        bonusConsistency: null,
        bonusConsistencyLower95: null,
        gradeConsistencyEvidence: {
          method: 'clopper_pearson_one_sided_exact_binomial_lower_bound',
          confidenceLevel: 0.95,
          independentExams: 0,
          automaticGradeDiscordances: 0,
          minimumPerfectExamsFor98Percent95: calcularMinimoExamenesSinDiscordancias({ targetConsistency: 0.98 }),
          lowerBound: null
        },
        capturePassRate: null,
        concordanceByCondition: [],
        totalCaptures: 0,
        totalPreguntasEvaluadas: 0,
        gradeComparisons: 0,
        automaticGradeDiscordances: 0,
        bonusComparisons: 0,
        bonusDiscordances: 0,
        bonusAbstentions: 0
      },
      checks: {
        precision: false,
        falsePositiveRate: false,
        invalidDetectionRate: false,
        pagePassRate: false,
        autoGradeTrustRate: false,
        autoCoverageRate: false,
        gradeConsistencyLower95: false,
        bonusConsistencyLower95: false
      },
      ok: false,
      perCapture: []
    };
    const failures = {
      runId,
      timestamp,
      datasetRoot,
      status: 'not_applicable' as PilotValidationStatus,
      reason,
      topCauses: [{ causa: 'capture_count_zero', total: 1 }],
      topCaptures: [],
      byEstadoAnalisis: { ok: 0, requiere_revision: 0, rechazado_calidad: 0 },
      byFolio: {},
      byPagina: {},
      byTipoError: {}
    };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.mkdir(path.dirname(failureReportPath), { recursive: true });
    await fs.writeFile(failureReportPath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8');
    return { report, failures };
  }
  const truthRows = await readGroundTruth(await resolveDatasetFile(datasetRoot, manifest.groundTruthRef));
  const humanReview = validarGroundTruthHumano(truthRows);
  if (!humanReview.valid) {
    const examples = humanReview.invalidRows.slice(0, 5).join(', ') || 'sin filas revisadas';
    throw new Error(`El piloto real requiere revisión humana visual independiente por reactivo; filas inválidas: ${examples}.`);
  }
  const answerKey = await readAnswerKey(await resolveDatasetFile(datasetRoot, manifest.answerKeyPath));
  const answerKeyByFolio = await readAnswerKeysByFolio(manifest.answerKeyByFolioPath
    ? await resolveDatasetFile(datasetRoot, manifest.answerKeyByFolioPath)
    : undefined);
  const resolveAnswerKey = (folio: string) => {
    if (!manifest.answerKeyByFolioPath) return answerKey;
    const key = answerKeyByFolio[folio];
    if (!key) throw new Error(`answerKeyByFolio no contiene una clave para ${folio}.`);
    return key;
  };
  const evidenceHashes = await hashPilotEvidence({ datasetRoot, manifestBytes, manifest });
  const truthByCapture = groupTruth(truthRows);
  const folioByImageHash = new Map<string, { folio: string; captureId: string }>();

  let tp = 0;
  let fp = 0;
  let invalidTotal = 0;
  let invalidDetected = 0;
  let pagePassCount = 0;
  let autoPages = 0;
  let autoPagesPassing = 0;
  let clearlyEligibleCaptures = 0;
  let clearlyEligibleAutoPages = 0;
  let totalPreguntasEvaluadas = 0;
  let totalCaptures = 0;

  const estadoCounts: Record<EstadoAnalisisOmr, number> = {
    ok: 0,
    requiere_revision: 0,
    rechazado_calidad: 0
  };
  const causeCounts = new Map<string, number>();
  const errorTypeCounts = new Map<string, number>();
  const byFolio = new Map<string, { captures: number; mismatches: number; pagesOk: number }>();
  const byPage = new Map<string, { captures: number; mismatches: number; pagesOk: number }>();
  const examenGradeByFolio = new Map<string, {
    questionNumbers: Set<number>;
    pageNumbers: Set<number>;
    captureCount: number;
    duplicateQuestion: boolean;
    duplicatePage: boolean;
    expectedCorrect: number;
    detectedCorrect: number;
    expectedBonus?: 0 | 0.25;
    detectedBonus?: 0 | 0.25;
    bonusLabelSeen: boolean;
    allPagesAutoCalificables: boolean;
    conditionRows: Map<GroundTruthRowPorFolio['markType'], { units: number; discordantUnits: number }>;
    answerKey: AnswerKey;
  }>();
  const perCapture: Array<{
    captureId: string;
    folio: string;
    numeroPagina: number;
    estadoAnalisis: EstadoAnalisisOmr;
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    coberturaDeteccion: number;
    autoCalificable: boolean;
    claramenteElegible: boolean;
    bonusDetectionStatus: 'not_applicable' | 'confirmed' | 'indeterminate';
    mismatches: number;
    totalPreguntas: number;
    pagePass: boolean;
  }> = [];

  for (const capture of manifest.capturas) {
    const examAnswerKey = resolveAnswerKey(capture.folio);
    const expected = truthByCapture.get(capture.captureId);
    if (!expected) throw new Error(`No hay truth para ${capture.captureId}`);
    const claramenteElegible = [...expected.values()].every((row) => row.markType === 'valid' || row.markType === 'blank');
    if (claramenteElegible) clearlyEligibleCaptures += 1;
    const mapPage = await readJsonFile<MapaOmrPaginaPorFolio>(await resolveDatasetFile(datasetRoot, capture.mapaOmrPath));
    if (!validarIdentidadQrCaptura({
      expectedQr: capture.expectedQr,
      mapQr: String(mapPage.qr?.texto ?? ''),
      folio: capture.folio,
      numeroPagina: capture.numeroPagina
    })) {
      throw new Error(`El QR de manifest/mapa no identifica de forma exacta ${capture.folio}, página ${capture.numeroPagina}, TV4.`);
    }
    const imageBuffer = await fs.readFile(await resolveDatasetFile(datasetRoot, capture.imagePath));
    const imageHash = sha256(imageBuffer);
    const normalizedFolio = capture.folio.trim().toUpperCase();
    const duplicateImageCaptureId = detectarDuplicadoImagenEntreFolios({
      imageSha256: imageHash,
      captureId: capture.captureId,
      folio: normalizedFolio,
      seen: folioByImageHash
    });
    if (duplicateImageCaptureId) {
      throw new Error(`La imagen de ${capture.captureId} duplica la captura ${duplicateImageCaptureId} asignada a otro folio; no cuenta como examen independiente.`);
    }
    const invalidImageLabels = validarHashCapturaEtiquetada([...expected.values()], imageHash);
    if (invalidImageLabels.length) {
      throw new Error(`La verdad terreno no está ligada a la imagen original de ${capture.captureId}; filas inválidas: ${invalidImageLabels.slice(0, 5).join(', ')}.`);
    }
    const result = await analizarOmr(
      imageToDataUrl(capture.imagePath, imageBuffer),
      mapPage,
      [capture.expectedQr, capture.folio, `EXAMEN:${capture.folio}:P${capture.numeroPagina}:TV4`],
      10,
      {
        folio: capture.folio,
        numeroPagina: capture.numeroPagina,
        templateVersionDetectada: 4
      }
    );

    const bonusField = mapPage.layoutDebug?.headerFieldBoxes?.find((field) => field.id === 'calificacion-linea');
    let detectedBonus: 0 | 0.25 | undefined;
    if (capture.numeroPagina === 1 && bonusField) {
      try {
        const lecturaBono = await leerBonoVisibleOmr(imageToDataUrl(capture.imagePath, imageBuffer), bonusField);
        detectedBonus = lecturaBono.bono ?? undefined;
      } catch {
        detectedBonus = undefined;
      }
    }

    totalCaptures += 1;
    estadoCounts[result.estadoAnalisis] += 1;

    const detected = new Map<number, {
      opcion: string | null;
      flags: string[];
      confianza: number;
      estadoRespuesta?: EstadoRespuestaOmr;
      scoresPorOpcion: typeof result.respuestasDetectadas[number]['scoresPorOpcion'];
    }>();
    const captureCauseTokens: string[] = [];
    for (const respuesta of result.respuestasDetectadas) {
      detected.set(respuesta.numeroPregunta, {
        opcion: respuesta.opcion,
        flags: respuesta.flags,
        confianza: Number(respuesta.confianza ?? 0),
        estadoRespuesta: respuesta.estadoRespuesta,
        scoresPorOpcion: respuesta.scoresPorOpcion
      });
      for (const flag of respuesta.flags) captureCauseTokens.push(`flag:${flag}`);
    }

    let mismatches = 0;
    let respuestasResueltas = 0;
    for (const [questionNumber, row] of expected.entries()) {
      const current = detected.get(questionNumber);
      const detectedOption = (current?.opcion as string | null | undefined) ?? null;
      const detectedState = current?.estadoRespuesta ?? (current
        ? clasificarEstadoRespuestaOmr({ opcion: current.opcion, flags: current.flags })
        : undefined);
      const selected = row.selectedOptions ?? [];
      totalPreguntasEvaluadas += 1;
      if (isResolvedDetection(current)) respuestasResueltas += 1;

      if (row.markType === 'double' || row.markType === 'smudge') {
        invalidTotal += 1;
        if (detectedState === 'ambigua' || detectedState === 'doble_marca' || detectedState === 'tachada') invalidDetected += 1;
      }

      if (row.markType === 'valid' && detectedState === 'respondida' && detectedOption === row.opcionEsperada) {
        tp += 1;
        continue;
      }
      if (row.markType === 'blank' && detectedState === 'sin_marca' && detectedOption === null) continue;
      if ((row.markType === 'double' || row.markType === 'smudge') &&
        (detectedState === 'ambigua' || detectedState === 'doble_marca' || detectedState === 'tachada')) continue;

      mismatches += 1;
      if (row.markType === 'valid' && (detectedState !== 'respondida' || detectedOption === null)) {
        bump(errorTypeCounts, 'missed_mark');
      } else if (detectedState === 'respondida' && detectedOption && row.markType !== 'valid') {
        fp += 1;
        bump(errorTypeCounts, 'false_positive');
      } else if (row.markType === 'valid' && detectedState === 'respondida' && detectedOption && !selected.includes(detectedOption as never)) {
        fp += 1;
        bump(errorTypeCounts, 'wrong_option');
      } else if (row.markType === 'double' || row.markType === 'smudge') {
        bump(errorTypeCounts, 'invalid_not_rejected');
      } else {
        bump(errorTypeCounts, detectedState === 'ambigua' ? 'blank_requires_review' : 'other');
      }
    }

    const totalPreguntas = expected.size;
    const coberturaDeteccion = totalPreguntas > 0 ? respuestasResueltas / totalPreguntas : 0;
    const auto = evaluarAutoCalificableOmr({
      estadoAnalisis: result.estadoAnalisis,
      calidadPagina: result.calidadPagina,
      confianzaPromedioPagina: result.confianzaPromedioPagina,
      ratioAmbiguas: result.ratioAmbiguas,
      coberturaDeteccion,
      respuestasDetectadas: result.respuestasDetectadas
    });

    let examenGrade = examenGradeByFolio.get(capture.folio);
    if (!examenGrade) {
      examenGrade = {
        questionNumbers: new Set<number>(),
        pageNumbers: new Set<number>(),
        captureCount: 0,
        duplicateQuestion: false,
        duplicatePage: false,
        expectedCorrect: 0,
        detectedCorrect: 0,
        bonusLabelSeen: false,
        allPagesAutoCalificables: true,
        conditionRows: new Map(),
        answerKey: examAnswerKey
      };
      examenGradeByFolio.set(capture.folio, examenGrade);
    } else if (JSON.stringify(examenGrade.answerKey) !== JSON.stringify(examAnswerKey)) {
      throw new Error(`La clave de respuestas cambió entre páginas del examen ${capture.folio}.`);
    }
    examenGrade.captureCount += 1;
    if (examenGrade.pageNumbers.has(capture.numeroPagina)) examenGrade.duplicatePage = true;
    examenGrade.pageNumbers.add(capture.numeroPagina);
    examenGrade.allPagesAutoCalificables &&= auto.autoCalificableOmr;
    if (capture.numeroPagina === 1) {
      const bonusLabels = new Set([...expected.values()].map((row) => row.bonusVisible));
      if (bonusLabels.size !== 1 || bonusLabels.has(undefined)) {
        throw new Error(`La verdad terreno de bono para ${capture.folio} debe ser una etiqueta booleana única en la página 1.`);
      }
      examenGrade.expectedBonus = [...bonusLabels][0] ? 0.25 : 0;
      examenGrade.detectedBonus = detectedBonus;
      examenGrade.bonusLabelSeen = true;
    }
    for (const [questionNumber, row] of expected.entries()) {
      const answer = examAnswerKey[questionNumber];
      if (!answer) throw new Error(`La clave del piloto real no contiene la pregunta ${questionNumber}.`);
      if (examenGrade.questionNumbers.has(questionNumber)) examenGrade.duplicateQuestion = true;
      examenGrade.questionNumbers.add(questionNumber);
      if (row.markType === 'valid' && row.opcionEsperada === answer) examenGrade.expectedCorrect += 1;
      const current = detected.get(questionNumber);
      if (current?.estadoRespuesta === 'respondida' && current.opcion === answer) examenGrade.detectedCorrect += 1;
      const condition = examenGrade.conditionRows.get(row.markType) ?? { units: 0, discordantUnits: 0 };
      condition.units += 1;
      if (!coincideConVerdadTerreno(row, current)) condition.discordantUnits += 1;
      examenGrade.conditionRows.set(row.markType, condition);
    }

    const pagePass = mismatches === 0;
    if (!pagePass) {
      for (const warning of result.advertencias) captureCauseTokens.push(`warning:${warning}`);
      for (const motivo of result.motivosRevision) captureCauseTokens.push(`motivo:${motivo}`);
      for (const token of captureCauseTokens) bump(causeCounts, token);
    }
    if (pagePass) pagePassCount += 1;
    if (auto.autoCalificableOmr) {
      autoPages += 1;
      if (pagePass) autoPagesPassing += 1;
      if (claramenteElegible) clearlyEligibleAutoPages += 1;
    }

    const folioKey = capture.folio;
    const pageKey = `${capture.folio}:P${capture.numeroPagina}`;
    if (!byFolio.has(folioKey)) byFolio.set(folioKey, { captures: 0, mismatches: 0, pagesOk: 0 });
    if (!byPage.has(pageKey)) byPage.set(pageKey, { captures: 0, mismatches: 0, pagesOk: 0 });
    const folioBucket = byFolio.get(folioKey)!;
    folioBucket.captures += 1;
    folioBucket.mismatches += mismatches;
    if (pagePass) folioBucket.pagesOk += 1;
    const pageBucket = byPage.get(pageKey)!;
    pageBucket.captures += 1;
    pageBucket.mismatches += mismatches;
    if (pagePass) pageBucket.pagesOk += 1;

    perCapture.push({
      captureId: capture.captureId,
      folio: capture.folio,
      numeroPagina: capture.numeroPagina,
      estadoAnalisis: result.estadoAnalisis,
      calidadPagina: round6(result.calidadPagina),
      confianzaPromedioPagina: round6(result.confianzaPromedioPagina),
      ratioAmbiguas: round6(result.ratioAmbiguas),
      coberturaDeteccion: round6(coberturaDeteccion),
      autoCalificable: auto.autoCalificableOmr,
      claramenteElegible,
      bonusDetectionStatus: capture.numeroPagina !== 1
        ? 'not_applicable'
        : detectedBonus === undefined ? 'indeterminate' : 'confirmed',
      mismatches,
      totalPreguntas,
      pagePass
    });
  }

  const conditionComparisons: Array<{ folio: string; condition: string; discordant: boolean }> = [];
  const examGrades = [...examenGradeByFolio.entries()].map(([folio, examen]) => {
    const preguntasClave = Object.keys(examen.answerKey).map(Number);
    const examenCompleto = !examen.duplicateQuestion &&
      !examen.duplicatePage &&
      examen.bonusLabelSeen &&
      examen.captureCount === examen.pageNumbers.size &&
      examen.questionNumbers.size === preguntasClave.length &&
      preguntasClave.every((questionNumber) => examen.questionNumbers.has(questionNumber));
    if (examenCompleto && examen.allPagesAutoCalificables) {
      for (const [condition, stats] of examen.conditionRows) {
        for (let index = 0; index < stats.units; index += 1) {
          conditionComparisons.push({ folio, condition: `mark:${condition}`, discordant: index < stats.discordantUnits });
        }
      }
      if (examen.bonusLabelSeen && examen.expectedBonus !== undefined && examen.detectedBonus !== undefined) {
        conditionComparisons.push({
          folio,
          condition: examen.expectedBonus > 0 ? 'bonus:visible' : 'bonus:absent',
          discordant: examen.expectedBonus !== examen.detectedBonus
        });
      }
    }
    return {
      fullCoverage: examenCompleto,
      autoEligible: examen.allPagesAutoCalificables && examen.detectedBonus !== undefined,
      expectedCorrect: examen.expectedCorrect,
      detectedCorrect: examen.detectedCorrect,
      expectedBonus: examen.expectedBonus,
      detectedBonus: examen.detectedBonus,
      bonusLabelSeen: examen.bonusLabelSeen,
      answerKey: examen.answerKey
    };
  });
  const bonusAbstentions = contarAbstencionesBono(examGrades);
  const gradeConsistencyResult = calcularConcordanciaNotasPorExamen(answerKey, examGrades);
  const { gradeComparisons, gradeConsistency, automaticGradeDiscordances, bonusComparisons, bonusConsistency, bonusDiscordances } = gradeConsistencyResult;
  const gradeConsistencyLower95 = calcularCotaInferiorExactaConcordancia(
    gradeComparisons,
    automaticGradeDiscordances
  );
  const bonusConsistencyLower95 = calcularCotaInferiorExactaConcordancia(bonusComparisons, bonusDiscordances);
  const concordanciaPorCondicion = calcularConcordanciaPorCondicion(conditionComparisons);
  const minimumPerfectExamsFor98Percent95 = calcularMinimoExamenesSinDiscordancias({ targetConsistency: 0.98 });

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const falsePositiveRate = totalPreguntasEvaluadas > 0 ? fp / totalPreguntasEvaluadas : 0;
  const invalidDetectionRate = invalidTotal > 0 ? invalidDetected / invalidTotal : 1;
  const pagePassRate = totalCaptures > 0 ? pagePassCount / totalCaptures : 0;
  const autoGradeTrustRate = autoPages > 0 ? autoPagesPassing / autoPages : 0;
  const autoCoverageRate = clearlyEligibleCaptures > 0 ? clearlyEligibleAutoPages / clearlyEligibleCaptures : 0;
  const capturePassRate = pagePassRate;
  const checks = {
    precision: precision >= manifest.thresholds.precisionMin,
    falsePositiveRate: falsePositiveRate <= manifest.thresholds.falsePositiveMax,
    invalidDetectionRate: invalidDetectionRate >= manifest.thresholds.invalidDetectionMin,
    pagePassRate: pagePassRate >= manifest.thresholds.pagePassMin,
    autoGradeTrustRate: autoGradeTrustRate >= manifest.thresholds.autoGradeTrustMin,
    autoCoverageRate: autoCoverageRate >= manifest.thresholds.autoCoverageMin,
    gradeConsistencyLower95: cumpleGateConcordanciaNotas(
      gradeComparisons,
      automaticGradeDiscordances,
      manifest.thresholds.gradeConsistencyLower95Min
    ),
    bonusConsistencyLower95: cumpleGateConcordanciaNotas(
      bonusComparisons,
      bonusDiscordances,
      bonusAbstentions,
      manifest.thresholds.gradeConsistencyLower95Min
    )
  };
  const ok = Object.values(checks).every(Boolean);
  const runId = `omr-tv4-pilot-real-${Date.now()}`;
  const report = {
    runId,
    timestamp: new Date().toISOString(),
    datasetRoot,
    datasetType: manifest.datasetType,
    status: (ok ? 'passed' : 'failed') as PilotValidationStatus,
    thresholds: manifest.thresholds,
    evidenceHashes,
    metrics: {
      precision: round6(precision),
      falsePositiveRate: round6(falsePositiveRate),
      invalidDetectionRate: round6(invalidDetectionRate),
      pagePassRate: round6(pagePassRate),
      autoGradeTrustRate: round6(autoGradeTrustRate),
      autoCoverageRate: round6(autoCoverageRate),
      gradeConsistency: round6(gradeConsistency),
      gradeConsistencyLower95: gradeConsistencyLower95 === null ? null : round6(gradeConsistencyLower95),
      bonusConsistency: bonusConsistency === null ? null : round6(bonusConsistency),
      bonusConsistencyLower95: bonusConsistencyLower95 === null ? null : round6(bonusConsistencyLower95),
      gradeConsistencyEvidence: {
        method: 'clopper_pearson_one_sided_exact_binomial_lower_bound',
        confidenceLevel: 0.95,
        independentExams: gradeComparisons,
        automaticGradeDiscordances,
        minimumPerfectExamsFor98Percent95,
        lowerBound: gradeConsistencyLower95 === null ? null : round6(gradeConsistencyLower95)
      },
      capturePassRate: round6(capturePassRate),
      clearlyEligibleCaptures,
      totalCaptures,
      totalPreguntasEvaluadas,
      gradeComparisons,
      automaticGradeDiscordances,
      bonusComparisons,
      bonusDiscordances,
      humanReviewedRows: humanReview.reviewedRows,
      humanReviewerCount: humanReview.reviewerCount,
      concordanceByCondition: concordanciaPorCondicion
    },
    checks,
    ok,
    perCapture
  };
  const failures = {
    runId,
    timestamp: new Date().toISOString(),
    datasetRoot,
    evidenceHashes,
    topCauses: [...causeCounts.entries()]
      .map(([causa, total]) => ({ causa, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 40),
    topCaptures: [...perCapture]
      .filter((capture) => capture.mismatches > 0 || capture.estadoAnalisis !== 'ok')
      .sort((a, b) => b.mismatches - a.mismatches || a.captureId.localeCompare(b.captureId))
      .slice(0, 40),
    byEstadoAnalisis: estadoCounts,
    byFolio: Object.fromEntries([...byFolio.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byPagina: Object.fromEntries([...byPage.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byTipoError: Object.fromEntries([...errorTypeCounts.entries()].sort((a, b) => b[1] - a[1]))
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.mkdir(path.dirname(failureReportPath), { recursive: true });
  await fs.writeFile(failureReportPath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8');

  return { report, failures };
}

async function main() {
  const args = parseArgs(process.argv);
  const { report } = await runTv4PilotRealValidation({
    datasetRoot: args.dataset,
    reportPath: args.report,
    failureReportPath: args.failureReport
  });
  process.stdout.write(`${JSON.stringify({ ok: report.ok, metrics: report.metrics, checks: report.checks })}\n`);
  if (!report.ok) process.exit(1);
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exit(1);
  });
}
