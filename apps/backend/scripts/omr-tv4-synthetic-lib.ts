/**
 * omr-tv4-synthetic-lib
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { calcularCalificacionExacta } from '../src/compartido/utilidades/calculoCalificacion.js';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import { evaluarAutoCalificableOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';
import { rasterizarPdfParaPreview } from '../src/modulos/modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';
import type { MapaVariante, PaginaOmr, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/shared/tiposPdf.js';

type Opcion = 'A' | 'B' | 'C' | 'D' | 'E';
type MarkType = 'valid' | 'blank' | 'double' | 'smudge';

type EvalThresholds = {
  precisionMin: number;
  falsePositiveMax: number;
  invalidDetectionMin: number;
  pagePassMin: number;
  autoGradeTrustMin?: number;
  autoCoverageMin?: number;
};

type ExamSpec = {
  totalQuestions: number;
  totalPages: number;
  optionsPerQuestion: number;
  templateVersion: 4;
  questionsPerPage: number;
};

type RenderSpec = {
  width: number;
  height: number;
  dpi: number;
  marginPt: number;
  cornerMarkerSizePt: number;
  qrSizePt: number;
};

type NoiseSpec = {
  profile: 'tv4_mobile_mix';
  rotationDegMax: number;
  affineShearMax: number;
  blurSigmaMax: number;
  brightnessMin: number;
  brightnessMax: number;
  contrastMin: number;
  contrastMax: number;
  jpegQualityMin: number;
  jpegQualityMax: number;
  shadowOpacityMax: number;
};

type CaptureManifest = {
  captureId: string;
  imagePath: string;
  mapaOmrPath: string;
  sourcePdfPath: string;
  folio: string;
  numeroPagina: number;
  templateVersion: 4;
  seed: number;
  variantIndex: number;
};

type ManifestDataset = {
  version: '1';
  datasetType: 'synthetic_tv4';
  hash: string;
  examSpec: ExamSpec;
  renderSpec: RenderSpec;
  noiseSpec: NoiseSpec;
  thresholds: EvalThresholds;
  answerKeyPath: string;
  groundTruthRef: string;
  capturas: CaptureManifest[];
};

type GroundTruthRow = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: Opcion | null;
  markType: MarkType;
  selectedOptions: Opcion[];
};

type PerCaptureEval = {
  captureId: string;
  mismatches: number;
  totalPreguntas: number;
  expectedScore: number;
  detectedScore: number;
  pagePass: boolean;
  estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
  autoCalificableOmr: boolean;
  motivosAutoCalificacion: string[];
  clearlyEligible: boolean;
  policyDiagnostics: Array<{
    numeroPregunta: number;
    opcion: string | null;
    estadoRespuesta?: string;
    flags: string[];
    confianza: number;
    scoresPorOpcion: Array<{
      opcion: string;
      score: number;
      estadoMarca: string;
      fillRatioCore: number;
      fillRatioRing: number;
      fillDelta: number;
      radialMassRatio: number;
      centerDarknessDelta: number;
      nucleusDarknessDelta: number;
      largestComponentFillRatio: number;
      largestComponentOffsetRatio: number;
      nucleusFillRatio: number;
      centroidOffsetRatio: number;
      markConfidence: number;
      shapeCompactness: number;
      contraste: number;
      softCoreContrast: number;
    }>;
  }>;
  issues: Array<{
    numeroPregunta: number;
    markType: MarkType;
    expected: Opcion | null;
    selectedOptions: Opcion[];
    detected: Opcion | null;
    estadoRespuesta?: string;
    flags: string[];
    confidence: number;
    scoresPorOpcion: Array<{
      opcion: string;
      score: number;
      estadoMarca: string;
      fillRatioCore: number;
      fillRatioRing: number;
      fillDelta: number;
      radialMassRatio: number;
      centerDarknessDelta: number;
      nucleusDarknessDelta: number;
      largestComponentFillRatio: number;
      largestComponentOffsetRatio: number;
      nucleusFillRatio: number;
      centroidOffsetRatio: number;
      markConfidence: number;
      shapeCompactness: number;
      contraste: number;
      softCoreContrast: number;
    }>;
  }>;
};

type CanonicalReport = {
  runId: string;
  examId: string;
  templateId: string;
  datasetProfile: string;
  noiseProfile: string;
  timestamp: string;
  thresholds: EvalThresholds & {
    omrParams?: Record<string, number>;
  };
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    invalidDetectionRate: number;
    falsePositiveRate: number;
    pagePassRate: number;
    gradeConsistency: number;
    autoGradeTrustRate: number;
    autoCoverageRate: number;
    autoEligibleCaptures: number;
    clearlyEligibleCaptures: number;
    automaticGradeDiscordances: number;
    totalCapturas: number;
    totalPreguntas: number;
  };
  errors: Record<string, number>;
  checks: {
    precision: boolean;
    falsePositiveRate: boolean;
    invalidDetectionRate: boolean;
    pagePassRate: boolean;
    autoGradeTrust: boolean;
    autoCoverage: boolean;
    automaticGradeDiscordances: boolean;
  };
  ok: boolean;
  perCapture: PerCaptureEval[];
};

type GenerateDatasetOptions = {
  datasetRoot: string;
  variants: number;
  seed: number;
  totalQuestions?: number;
  rasterDpi?: number;
  affineShearMax?: number;
  noise?: Partial<Pick<NoiseSpec,
    | 'rotationDegMax'
    | 'blurSigmaMax'
    | 'brightnessMin'
    | 'brightnessMax'
    | 'contrastMin'
    | 'contrastMax'
    | 'jpegQualityMin'
    | 'jpegQualityMax'
    | 'shadowOpacityMax'
  >>;
};

type EvaluateDatasetOptions = {
  datasetRoot: string;
  reportPath: string;
  thresholds?: Partial<EvalThresholds>;
};

const LETTERS: Opcion[] = ['A', 'B', 'C', 'D', 'E'];
const DEFAULT_EXAM_SPEC: ExamSpec = {
  totalQuestions: 20,
  totalPages: 2,
  optionsPerQuestion: 5,
  templateVersion: 4,
  questionsPerPage: 10
};
const DEFAULT_RENDER_SPEC: RenderSpec = {
  width: 1224,
  height: 1584,
  dpi: 144,
  marginPt: 10 * (72 / 25.4),
  cornerMarkerSizePt: 7 * (72 / 25.4),
  qrSizePt: 28 * (72 / 25.4)
};
const DEFAULT_NOISE_SPEC: NoiseSpec = {
  profile: 'tv4_mobile_mix',
  rotationDegMax: 0.55,
  affineShearMax: 0.005,
  blurSigmaMax: 0.26,
  brightnessMin: 0.97,
  brightnessMax: 1.04,
  contrastMin: 0.95,
  contrastMax: 1.05,
  jpegQualityMin: 89,
  jpegQualityMax: 96,
  shadowOpacityMax: 0.05
};
const DEFAULT_THRESHOLDS: EvalThresholds = {
  precisionMin: 0.95,
  falsePositiveMax: 0.02,
  invalidDetectionMin: 0.8,
  pagePassMin: 0.8,
  autoGradeTrustMin: 0.95,
  autoCoverageMin: 0.8
};

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1;
  }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }

  nextInt(min: number, max: number) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(low + this.next() * (high - low + 1));
  }

  pick<T>(items: T[]) {
    return items[this.nextInt(0, items.length - 1)];
  }
}

function round6(value: number) {
  return Number(value.toFixed(6));
}

function hashObject(input: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function buildAnswerKey(totalQuestions: number) {
  const answerKey: Record<number, Opcion> = {};
  for (let q = 1; q <= totalQuestions; q += 1) {
    answerKey[q] = LETTERS[(q - 1) % LETTERS.length] ?? 'A';
  }
  return answerKey;
}

function buildExamInputs(totalQuestions: number) {
  const preguntas: PreguntaBase[] = [];
  const ordenPreguntas: string[] = [];
  const ordenOpcionesPorPregunta: Record<string, number[]> = {};
  const answerKey = buildAnswerKey(totalQuestions);

  for (let i = 1; i <= totalQuestions; i += 1) {
    const id = `tv4-q${i}`;
    preguntas.push({
      id,
      enunciado: `Pregunta TV4 ${i}: selecciona la opción correcta.`,
      opciones: LETTERS.map((letter) => ({
        texto: `Opción ${letter}`,
        esCorrecta: answerKey[i] === letter
      }))
    });
    ordenPreguntas.push(id);
    ordenOpcionesPorPregunta[id] = [0, 1, 2, 3, 4];
  }

  const mapaVariante: MapaVariante = { ordenPreguntas, ordenOpcionesPorPregunta };
  return { preguntas, mapaVariante, answerKey };
}

function decideMarkType(rng: Rng): MarkType {
  const roll = rng.next();
  if (roll < 0.02) return 'smudge';
  if (roll < 0.06) return 'blank';
  if (roll < 0.1) return 'double';
  return 'valid';
}

function buildStudentSelection(
  questionNumber: number,
  answerKey: Record<number, Opcion>,
  markType: MarkType,
  rng: Rng
) {
  if (markType === 'blank') return [] as Opcion[];
  const correct = answerKey[questionNumber] ?? 'A';
  if (markType === 'smudge') return [correct];
  if (markType === 'double') {
    const wrong = LETTERS.find((option) => option !== correct) ?? 'B';
    return [correct, wrong];
  }
  if (rng.next() < 0.08) {
    return [rng.pick(LETTERS.filter((option) => option !== correct))];
  }
  return [correct];
}

async function renderPageImage(args: {
  page: PaginaOmr;
  baseImage: Buffer;
  renderSpec: RenderSpec;
  selectedByQuestion: Map<number, Opcion[]>;
  markTypeByQuestion: Map<number, MarkType>;
  noiseSpec: NoiseSpec;
  rng: Rng;
}) {
  const { page, baseImage, renderSpec, selectedByQuestion, markTypeByQuestion, noiseSpec, rng } = args;
  const metadata = await sharp(baseImage).metadata();
  const width = Number(metadata.width ?? renderSpec.width);
  const height = Number(metadata.height ?? renderSpec.height);
  const scaleX = width / 612;
  const scaleY = height / 792;
  const questionsSvg = page.preguntas
    .map((question) => {
      const selected = selectedByQuestion.get(question.numeroPregunta) ?? [];
      const markType = markTypeByQuestion.get(question.numeroPregunta) ?? 'valid';
      const bubbleRadius = Number(question.perfilOmr?.radio ?? 6.5) * Math.min(scaleX, scaleY);
      return question.opciones
        .map((option) => {
          const cx = option.x * scaleX;
          const cy = (792 - option.y) * scaleY;
          const isSelected = selected.includes(option.letra as Opcion);
          if (!isSelected) return '';
          if (markType === 'smudge') {
            const offset = bubbleRadius * 0.2;
            return `<ellipse cx="${(cx + offset).toFixed(2)}" cy="${(cy - offset).toFixed(2)}" rx="${(bubbleRadius * 0.62).toFixed(2)}" ry="${(bubbleRadius * 0.42).toFixed(2)}" fill="#050505" fill-opacity="0.34"/>`;
          }
          const fillOpacity = 0.88 + rng.next() * 0.1;
          return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(bubbleRadius * 0.82).toFixed(2)}" fill="#050505" fill-opacity="${fillOpacity.toFixed(3)}"/>`;
        })
        .join('');
    })
    .join('');

  const marksOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${questionsSvg}</svg>`;

  const angle = (rng.next() * 2 - 1) * noiseSpec.rotationDegMax;
  const shearX = (rng.next() * 2 - 1) * noiseSpec.affineShearMax;
  const shearY = (rng.next() * 2 - 1) * noiseSpec.affineShearMax;
  const blur = rng.next() * noiseSpec.blurSigmaMax;
  const brightness = noiseSpec.brightnessMin + rng.next() * (noiseSpec.brightnessMax - noiseSpec.brightnessMin);
  const contrast = noiseSpec.contrastMin + rng.next() * (noiseSpec.contrastMax - noiseSpec.contrastMin);
  const quality = Math.round(
    noiseSpec.jpegQualityMin + rng.next() * (noiseSpec.jpegQualityMax - noiseSpec.jpegQualityMin)
  );
  const shadowOpacity = rng.next() * noiseSpec.shadowOpacityMax;
  const shadowStart = Math.round(rng.next() * width * 0.35);
  const shadowEnd = Math.round(width - rng.next() * width * 0.2);
  const shadowOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="45%" stop-color="rgba(0,0,0,${shadowOpacity.toFixed(4)})"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient>
    </defs>
    <rect x="${shadowStart}" y="0" width="${Math.max(96, shadowEnd - shadowStart)}" height="${height}" fill="url(#g)"/>
  </svg>`;

  let pipeline = sharp(baseImage)
    .composite([
      { input: Buffer.from(marksOverlay) },
      { input: Buffer.from(shadowOverlay), blend: 'multiply' }
    ])
    .rotate(angle, { background: '#ffffff' })
    .affine([1, shearX, shearY, 1], { background: '#ffffff' })
    .resize(width, height, { fit: 'fill' })
    .modulate({ brightness, saturation: 1 })
    .linear(contrast, -6);

  if (blur >= 0.3) {
    pipeline = pipeline.blur(blur);
  }

  return pipeline.jpeg({ quality, chromaSubsampling: '4:4:4' }).toBuffer();
}

function ensureDir(dirPath: string) {
  return fs.mkdir(dirPath, { recursive: true });
}

async function limpiarArtefactosSinteticosObsoletos(datasetRoot: string) {
  const archivosPorDirectorio: Array<{ directorio: string; patron: RegExp }> = [
    { directorio: 'images', patron: /^TV4-SYNTH-\d+-P\d+\.jpg$/i },
    { directorio: 'maps', patron: /^TV4-SYNTH-\d+-P\d+\.json$/i },
    { directorio: 'pdfs', patron: /^TV4-SYNTH-\d+\.pdf$/i }
  ];

  for (const { directorio, patron } of archivosPorDirectorio) {
    const rutaDirectorio = path.join(datasetRoot, directorio);
    const entradas = await fs.readdir(rutaDirectorio, { withFileTypes: true });
    await Promise.all(
      entradas
        .filter((entrada) => entrada.isFile() && patron.test(entrada.name))
        .map(async (entrada) => {
          const rutaArchivo = path.join(rutaDirectorio, entrada.name);
          // En Windows, un archivo vacío precreado permite recuperar una
          // carpeta que no admite creación directa desde Node; se sobrescribe
          // después y no necesita pasar por unlink.
          if ((await fs.stat(rutaArchivo)).size === 0) return;
          await fs.unlink(rutaArchivo);
        })
    );
  }
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

async function readGroundTruth(filePath: string) {
  return (await fs.readFile(filePath, 'utf8'))
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GroundTruthRow);
}

function buildIndex(rows: GroundTruthRow[]) {
  const byCapture = new Map<string, Map<number, GroundTruthRow>>();
  for (const row of rows) {
    if (!byCapture.has(row.captureId)) byCapture.set(row.captureId, new Map<number, GroundTruthRow>());
    byCapture.get(row.captureId)?.set(row.numeroPregunta, row);
  }
  return byCapture;
}

function countMatchesForScore(answers: Map<number, Opcion | null>, answerKey: Record<number, Opcion>) {
  let score = 0;
  for (const [questionNumber, detected] of answers.entries()) {
    if (detected !== null && answerKey[questionNumber] === detected) score += 1;
  }
  return score;
}

export function esRechazoSeguroMarcaInvalida(estadoRespuesta: string | undefined, detected: Opcion | null) {
  return estadoRespuesta === 'ambigua' || estadoRespuesta === 'doble_marca' || estadoRespuesta === 'tachada' ||
    (estadoRespuesta === 'sin_marca' && detected === null);
}

export function debeIncluirIssueSintetico(markType: MarkType, expected: Opcion | null, detected: Opcion | null) {
  return markType === 'double' || markType === 'smudge' || expected !== detected;
}

export function resumirConfianzaCoberturaAutoCalificacion(capturas: ReadonlyArray<{
  claramenteElegible: boolean;
  autoCalificable: boolean;
  calificacionCoincide: boolean;
}>) {
  const claramenteElegibles = capturas.filter((captura) => captura.claramenteElegible).length;
  const autocalificables = capturas.filter((captura) => captura.autoCalificable);
  const cubiertasElegibles = capturas.filter((captura) => captura.claramenteElegible && captura.autoCalificable).length;
  const discordancias = autocalificables.filter((captura) =>
    !captura.claramenteElegible || !captura.calificacionCoincide
  ).length;
  const calificacionesCorrectas = autocalificables.length - discordancias;
  return {
    autoEligibleCaptures: autocalificables.length,
    clearlyEligibleCaptures: claramenteElegibles,
    autoCoverageRate: claramenteElegibles > 0 ? cubiertasElegibles / claramenteElegibles : 0,
    autoGradeTrustRate: autocalificables.length > 0 ? calificacionesCorrectas / autocalificables.length : 1,
    automaticGradeDiscordances: discordancias
  };
}

export async function generateSyntheticTv4Dataset(options: GenerateDatasetOptions) {
  const datasetRoot = path.resolve(process.cwd(), options.datasetRoot);
  await ensureDir(path.join(datasetRoot, 'images'));
  await ensureDir(path.join(datasetRoot, 'maps'));
  await ensureDir(path.join(datasetRoot, 'pdfs'));
  await ensureDir(path.join(datasetRoot, 'reports'));
  // El dataset es regenerable y sus capturas deben corresponder siempre a la
  // plantilla canónica vigente; retirar P3/P4 antiguos evita evaluar mapas
  // de una generación obsoleta que ya no aparece en el manifest.
  await limpiarArtefactosSinteticosObsoletos(datasetRoot);

  const requestedQuestions = Number(options.totalQuestions ?? DEFAULT_EXAM_SPEC.totalQuestions);
  const totalQuestions = Number.isFinite(requestedQuestions)
    ? Math.max(20, Math.min(25, Math.round(requestedQuestions)))
    : DEFAULT_EXAM_SPEC.totalQuestions;
  const examSpec: ExamSpec = {
    ...DEFAULT_EXAM_SPEC,
    totalQuestions,
    questionsPerPage: Math.ceil(totalQuestions / DEFAULT_EXAM_SPEC.totalPages)
  };
  const rasterDpi = Number.isFinite(options.rasterDpi) ? Math.max(72, Math.min(600, Math.round(options.rasterDpi as number))) : DEFAULT_RENDER_SPEC.dpi;
  const renderSpec: RenderSpec = {
    ...DEFAULT_RENDER_SPEC,
    dpi: rasterDpi,
    width: Math.round((612 * rasterDpi) / 72),
    height: Math.round((792 * rasterDpi) / 72)
  };
  const noiseSpec: NoiseSpec = {
    ...DEFAULT_NOISE_SPEC,
    ...(options.noise ?? {}),
    affineShearMax: Number.isFinite(options.affineShearMax)
      ? Math.max(0, Math.min(0.02, Number(options.affineShearMax)))
      : DEFAULT_NOISE_SPEC.affineShearMax
  };
  const thresholds = DEFAULT_THRESHOLDS;
  const { preguntas, mapaVariante, answerKey } = buildExamInputs(examSpec.totalQuestions);
  const groundTruthRows: GroundTruthRow[] = [];
  const captures: CaptureManifest[] = [];

  for (let variantIdx = 0; variantIdx < options.variants; variantIdx += 1) {
    const variantSeed = options.seed + variantIdx * 1013;
    const variantRng = new Rng(variantSeed);
    const folio = `TV4-SYNTH-${String(variantIdx + 1).padStart(3, '0')}`;
    const generated = await generarPdfExamen({
      titulo: 'Evaluación OMR TV4',
      folio,
      preguntas,
      mapaVariante,
      tipoExamen: 'parcial',
      totalPaginas: examSpec.totalPages,
      margenMm: 10,
      templateVersion: 4,
      bookletConfig: { densityMode: 'compact' }
    });
    const sourcePdfPath = path.join('pdfs', `${folio}.pdf`).replaceAll('\\', '/');
    await fs.writeFile(path.join(datasetRoot, sourcePdfPath), generated.pdfBytes);
    const rasterized = await rasterizarPdfParaPreview(generated.pdfBytes, { dpi: rasterDpi });
    const rasterByPage = new Map(rasterized.paginas.map((page) => [page.numero, page]));
    if (rasterized.paginasTotales < generated.mapaOmr.paginas.length) {
      throw new Error(
        `El PDF de prueba tiene ${rasterized.paginasTotales} páginas rasterizadas, ` +
          `pero el mapa OMR contiene ${generated.mapaOmr.paginas.length}.`
      );
    }

    for (const page of generated.mapaOmr.paginas) {
      const selectedByQuestion = new Map<number, Opcion[]>();
      const markTypeByQuestion = new Map<number, MarkType>();
      for (const question of page.preguntas) {
        const markType = decideMarkType(variantRng);
        const selected = buildStudentSelection(question.numeroPregunta, answerKey, markType, variantRng);
        selectedByQuestion.set(question.numeroPregunta, selected);
        markTypeByQuestion.set(question.numeroPregunta, markType);
        groundTruthRows.push({
          captureId: `${folio}-P${page.numeroPagina}`,
          numeroPregunta: question.numeroPregunta,
          opcionEsperada: markType === 'valid' ? selected[0] ?? null : null,
          markType,
          selectedOptions: selected
        });
      }

      const rasterPage = rasterByPage.get(page.numeroPagina);
      if (!rasterPage) throw new Error(`No se encontró la página rasterizada ${page.numeroPagina}.`);
      const dataUrlPrefix = 'data:image/png;base64,';
      if (!rasterPage.dataUrl.startsWith(dataUrlPrefix)) {
        throw new Error(`Raster inesperado para la página ${page.numeroPagina}.`);
      }
      const baseImage = Buffer.from(rasterPage.dataUrl.slice(dataUrlPrefix.length), 'base64');

      const imageBuffer = await renderPageImage({
        page,
        baseImage,
        renderSpec,
        selectedByQuestion,
        markTypeByQuestion,
        noiseSpec,
        rng: new Rng(variantSeed + page.numeroPagina * 37 + 19)
      });

      const captureId = `${folio}-P${page.numeroPagina}`;
      const imagePath = path.join('images', `${captureId}.jpg`).replaceAll('\\', '/');
      const mapPath = path.join('maps', `${captureId}.json`).replaceAll('\\', '/');
      await fs.writeFile(path.join(datasetRoot, imagePath), imageBuffer);
      await fs.writeFile(path.join(datasetRoot, mapPath), `${JSON.stringify(page, null, 2)}\n`, 'utf8');
      captures.push({
        captureId,
        imagePath,
        mapaOmrPath: mapPath,
        sourcePdfPath,
        folio,
        numeroPagina: page.numeroPagina,
        templateVersion: 4,
        seed: variantSeed,
        variantIndex: variantIdx
      });
    }
  }

  await fs.writeFile(path.join(datasetRoot, 'answer_key.json'), `${JSON.stringify(answerKey, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(datasetRoot, 'ground_truth.jsonl'),
    `${groundTruthRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8'
  );

  const manifestWithoutHash: Omit<ManifestDataset, 'hash'> = {
    version: '1',
    datasetType: 'synthetic_tv4',
    examSpec,
    renderSpec,
    noiseSpec,
    thresholds,
    answerKeyPath: 'answer_key.json',
    groundTruthRef: 'ground_truth.jsonl',
    capturas: captures
  };
  const manifest: ManifestDataset = {
    ...manifestWithoutHash,
    hash: hashObject({ manifestWithoutHash, groundTruthRows })
  };
  await fs.writeFile(path.join(datasetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(datasetRoot, 'quality_tags.json'),
    `${JSON.stringify(
      {
        profile: noiseSpec.profile,
        generatedAt: new Date().toISOString(),
        variants: options.variants,
        templateVersion: 4
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return {
    datasetRoot,
    manifest,
    captures: captures.length,
    questions: groundTruthRows.length
  };
}

export async function evaluateSyntheticTv4Dataset(options: EvaluateDatasetOptions) {
  const datasetRoot = path.resolve(process.cwd(), options.datasetRoot);
  const manifest = await readJson<ManifestDataset>(path.join(datasetRoot, 'manifest.json'));
  const answerKey = await readJson<Record<number, Opcion>>(path.join(datasetRoot, manifest.answerKeyPath));
  const groundTruthRows = await readGroundTruth(path.join(datasetRoot, manifest.groundTruthRef));
  const truthByCapture = buildIndex(groundTruthRows);
  const thresholds: EvalThresholds = {
    precisionMin: options.thresholds?.precisionMin ?? manifest.thresholds.precisionMin,
    falsePositiveMax: options.thresholds?.falsePositiveMax ?? manifest.thresholds.falsePositiveMax,
    invalidDetectionMin: options.thresholds?.invalidDetectionMin ?? manifest.thresholds.invalidDetectionMin,
    pagePassMin: options.thresholds?.pagePassMin ?? manifest.thresholds.pagePassMin,
    autoGradeTrustMin: options.thresholds?.autoGradeTrustMin ?? manifest.thresholds.autoGradeTrustMin ?? DEFAULT_THRESHOLDS.autoGradeTrustMin,
    autoCoverageMin: options.thresholds?.autoCoverageMin ?? manifest.thresholds.autoCoverageMin ?? DEFAULT_THRESHOLDS.autoCoverageMin
  };

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let total = 0;
  let invalidTotal = 0;
  let invalidDetected = 0;
  let pagePasses = 0;
  let gradeConsistency = 0;
  let gradeConsistencyCaptures = 0;
  const autoGradeOutcomes: Array<{ claramenteElegible: boolean; autoCalificable: boolean; calificacionCoincide: boolean }> = [];
  const errors: Record<string, number> = {
    mismatch_option: 0,
    missed_mark: 0,
    false_mark: 0,
    invalid_not_rejected: 0
  };
  const perCapture: PerCaptureEval[] = [];

  for (const capture of manifest.capturas) {
    const mapPage = await readJson<PaginaOmr>(path.join(datasetRoot, capture.mapaOmrPath));
    const imageBuffer = await fs.readFile(path.join(datasetRoot, capture.imagePath));
    const qrEsperado = mapPage.qr?.texto;
    if (!qrEsperado) {
      throw new Error(`El mapa OMR de ${capture.captureId} no contiene un QR esperado.`);
    }
    const detectionResult = await analizarOmr(
      `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
      mapPage,
      qrEsperado,
      10,
      {
        folio: capture.captureId,
        numeroPagina: mapPage.numeroPagina,
        templateVersionDetectada: 4
      },
      capture.captureId
    );
    const autoDecision = evaluarAutoCalificableOmr({
      estadoAnalisis: detectionResult.estadoAnalisis,
      calidadPagina: detectionResult.calidadPagina,
      confianzaPromedioPagina: detectionResult.confianzaPromedioPagina,
      ratioAmbiguas: detectionResult.ratioAmbiguas,
      coberturaDeteccion: mapPage.preguntas.length > 0
        ? detectionResult.respuestasDetectadas.length / mapPage.preguntas.length
        : 0,
      respuestasDetectadas: detectionResult.respuestasDetectadas
    });
    const detectedByQuestion = new Map<number, Opcion | null>();
    const gradeAnswersByQuestion = new Map<number, Opcion | null>();
    const responseByQuestion = new Map<number, typeof detectionResult.respuestasDetectadas[number]>();
    for (const respuesta of detectionResult.respuestasDetectadas) {
      const normalized = String(respuesta.opcion ?? '').trim().toUpperCase();
      const detected = LETTERS.includes(normalized as Opcion) ? (normalized as Opcion) : null;
      detectedByQuestion.set(respuesta.numeroPregunta, detected);
      responseByQuestion.set(respuesta.numeroPregunta, respuesta);
      // A candidate option in an ambiguous/invalid state must never earn credit.
      gradeAnswersByQuestion.set(respuesta.numeroPregunta, respuesta.estadoRespuesta === 'respondida' ? detected : null);
    }
    const truthForCapture = truthByCapture.get(capture.captureId);
    if (!truthForCapture) throw new Error(`No ground truth for capture ${capture.captureId}`);

    let mismatches = 0;
    const issues: PerCaptureEval['issues'] = [];
    const expectedByQuestion = new Map<number, Opcion | null>();
    for (const [questionNumber, truth] of truthForCapture.entries()) {
      total += 1;
      const expected = truth.opcionEsperada;
      const detected = detectedByQuestion.get(questionNumber) ?? null;
      const respuestaDetectada = responseByQuestion.get(questionNumber);
      expectedByQuestion.set(questionNumber, expected);

      if (truth.markType === 'double' || truth.markType === 'smudge') {
        invalidTotal += 1;
        const rechazoSeguro = esRechazoSeguroMarcaInvalida(respuestaDetectada?.estadoRespuesta, detected);
        if (rechazoSeguro) invalidDetected += 1;
        else errors.invalid_not_rejected += 1;
      }

      if (debeIncluirIssueSintetico(truth.markType, expected, detected)) {
        issues.push({
          numeroPregunta: questionNumber,
          markType: truth.markType,
          expected,
          selectedOptions: truth.selectedOptions,
          detected,
          estadoRespuesta: respuestaDetectada?.estadoRespuesta,
          flags: respuestaDetectada?.flags ?? [],
          confidence: Number(respuestaDetectada?.confianza ?? 0),
          scoresPorOpcion: (respuestaDetectada?.scoresPorOpcion ?? []).map((score) => ({
            opcion: score.opcion,
            score: score.score,
            estadoMarca: score.estadoMarca,
            fillRatioCore: score.fillRatioCore,
            fillRatioRing: score.fillRatioRing,
            fillDelta: score.fillDelta,
            radialMassRatio: score.radialMassRatio,
            centerDarknessDelta: score.centerDarknessDelta,
            nucleusDarknessDelta: score.nucleusDarknessDelta,
            largestComponentFillRatio: Number(score.largestComponentFillRatio ?? 0),
            largestComponentOffsetRatio: Number(score.largestComponentOffsetRatio ?? 0),
            nucleusFillRatio: Number(score.nucleusFillRatio ?? 0),
            centroidOffsetRatio: Number(score.centroidOffsetRatio ?? 0),
            markConfidence: score.markConfidence,
            shapeCompactness: Number(score.shapeCompactness ?? 0),
            contraste: score.contraste,
            softCoreContrast: Number(score.softCoreContrast ?? 0)
          }))
        });
      }

      if (expected !== null && detected === expected) {
        tp += 1;
        continue;
      }
      if (detected !== null && expected === null) {
        fp += 1;
        mismatches += 1;
        errors.false_mark += 1;
        continue;
      }
      if (expected !== null && detected === null) {
        fn += 1;
        mismatches += 1;
        errors.missed_mark += 1;
        continue;
      }
      if (expected !== null && detected !== null && expected !== detected) {
        fp += 1;
        fn += 1;
        mismatches += 1;
        errors.mismatch_option += 1;
      }

    }

    const expectedScore = countMatchesForScore(expectedByQuestion, answerKey);
    const detectedScore = countMatchesForScore(gradeAnswersByQuestion, answerKey);
    const totalQuestions = truthForCapture.size;
    const expectedGrade = calcularCalificacionExacta(expectedScore, totalQuestions, 0).calificacionFinalTexto;
    const detectedGrade = calcularCalificacionExacta(detectedScore, totalQuestions, 0).calificacionFinalTexto;
    const clearlyEligible = [...truthForCapture.values()].every((truth) => truth.markType === 'valid' || truth.markType === 'blank');
    const calificacionCoincide = expectedGrade === detectedGrade;
    gradeConsistencyCaptures += 1;
    if (calificacionCoincide) gradeConsistency += 1;
    autoGradeOutcomes.push({
      claramenteElegible: clearlyEligible,
      autoCalificable: autoDecision.autoCalificableOmr,
      calificacionCoincide
    });

    const pagePass = totalQuestions > 0 ? mismatches / totalQuestions <= 0.05 : true;
    if (pagePass) pagePasses += 1;
    perCapture.push({
      captureId: capture.captureId,
      mismatches,
      totalPreguntas: totalQuestions,
      expectedScore,
      detectedScore,
      pagePass,
      estadoAnalisis: detectionResult.estadoAnalisis,
      autoCalificableOmr: autoDecision.autoCalificableOmr,
      motivosAutoCalificacion: autoDecision.motivos,
      clearlyEligible,
      policyDiagnostics: autoDecision.autoCalificableOmr ? [] : detectionResult.respuestasDetectadas
        .filter((respuesta) =>
          respuesta.flags?.includes('parcial_detectada') ||
          !Number.isFinite(respuesta.confianza) ||
          Number(respuesta.confianza) < 0.9
        )
        .map((respuesta) => ({
          numeroPregunta: respuesta.numeroPregunta,
          opcion: respuesta.opcion,
          estadoRespuesta: respuesta.estadoRespuesta,
          flags: respuesta.flags ?? [],
          confianza: Number(respuesta.confianza ?? 0),
          scoresPorOpcion: (respuesta.scoresPorOpcion ?? []).map((score) => ({
            opcion: score.opcion,
            score: score.score,
            estadoMarca: score.estadoMarca,
            fillRatioCore: score.fillRatioCore,
            fillRatioRing: score.fillRatioRing,
            fillDelta: score.fillDelta,
            radialMassRatio: score.radialMassRatio,
            centerDarknessDelta: score.centerDarknessDelta,
            nucleusDarknessDelta: score.nucleusDarknessDelta,
            largestComponentFillRatio: Number(score.largestComponentFillRatio ?? 0),
            largestComponentOffsetRatio: Number(score.largestComponentOffsetRatio ?? 0),
            nucleusFillRatio: Number(score.nucleusFillRatio ?? 0),
            centroidOffsetRatio: Number(score.centroidOffsetRatio ?? 0),
            markConfidence: score.markConfidence,
            shapeCompactness: Number(score.shapeCompactness ?? 0),
            contraste: score.contraste,
            softCoreContrast: Number(score.softCoreContrast ?? 0)
          }))
        })),
      issues
    });
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = total > 0 ? fp / total : 0;
  const invalidDetectionRate = invalidTotal > 0 ? invalidDetected / invalidTotal : 1;
  const pagePassRate = perCapture.length > 0 ? pagePasses / perCapture.length : 1;
  const gradeConsistencyRate = gradeConsistencyCaptures > 0 ? gradeConsistency / gradeConsistencyCaptures : 0;
  const autoMetrics = resumirConfianzaCoberturaAutoCalificacion(autoGradeOutcomes);

  const checks = {
    precision: precision >= thresholds.precisionMin,
    falsePositiveRate: falsePositiveRate <= thresholds.falsePositiveMax,
    invalidDetectionRate: invalidDetectionRate >= thresholds.invalidDetectionMin,
    pagePassRate: pagePassRate >= thresholds.pagePassMin,
    autoGradeTrust: autoMetrics.autoGradeTrustRate >= Number(thresholds.autoGradeTrustMin ?? DEFAULT_THRESHOLDS.autoGradeTrustMin),
    autoCoverage: autoMetrics.autoCoverageRate >= Number(thresholds.autoCoverageMin ?? DEFAULT_THRESHOLDS.autoCoverageMin),
    automaticGradeDiscordances: autoMetrics.automaticGradeDiscordances === 0
  };

  const report: CanonicalReport = {
    runId: `omr-tv4-synth-${Date.now()}`,
    examId: `tv4-synthetic-${manifest.examSpec.totalQuestions}q-${manifest.examSpec.totalPages}p`,
    templateId: 'tv4',
    datasetProfile: manifest.datasetType,
    noiseProfile: manifest.noiseSpec.profile,
    timestamp: new Date().toISOString(),
    thresholds: {
      ...thresholds,
      omrParams: {
        OMR_RESPUESTA_CONF_MIN: Number.parseFloat(process.env.OMR_RESPUESTA_CONF_MIN || '0.78'),
        OMR_SCORE_MIN: Number.parseFloat(process.env.OMR_SCORE_MIN || '0.08'),
        OMR_DELTA_MIN: Number.parseFloat(process.env.OMR_DELTA_MIN || '0.02')
      }
    },
    metrics: {
      precision: round6(precision),
      recall: round6(recall),
      f1: round6(f1),
      invalidDetectionRate: round6(invalidDetectionRate),
      falsePositiveRate: round6(falsePositiveRate),
      pagePassRate: round6(pagePassRate),
      gradeConsistency: round6(gradeConsistencyRate),
      autoGradeTrustRate: round6(autoMetrics.autoGradeTrustRate),
      autoCoverageRate: round6(autoMetrics.autoCoverageRate),
      autoEligibleCaptures: autoMetrics.autoEligibleCaptures,
      clearlyEligibleCaptures: autoMetrics.clearlyEligibleCaptures,
      automaticGradeDiscordances: autoMetrics.automaticGradeDiscordances,
      totalCapturas: perCapture.length,
      totalPreguntas: total
    },
    errors,
    checks,
    ok: Object.values(checks).every(Boolean),
    perCapture
  };

  const reportPath = path.resolve(process.cwd(), options.reportPath);
  await ensureDir(path.dirname(reportPath));
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export async function runTv4SyntheticGate(args: {
  datasetRoot: string;
  reportPath: string;
  variants: number;
  seed: number;
  thresholds?: Partial<EvalThresholds>;
}) {
  await generateSyntheticTv4Dataset({
    datasetRoot: args.datasetRoot,
    variants: args.variants,
    seed: args.seed
  });
  return evaluateSyntheticTv4Dataset({
    datasetRoot: args.datasetRoot,
    reportPath: args.reportPath,
    thresholds: args.thresholds
  });
}
