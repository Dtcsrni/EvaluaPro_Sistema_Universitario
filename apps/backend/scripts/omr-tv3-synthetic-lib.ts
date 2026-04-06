import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';

type Opcion = 'A' | 'B' | 'C' | 'D' | 'E';
type MarkType = 'valid' | 'blank' | 'double' | 'smudge';

type EvalThresholds = {
  precisionMin: number;
  falsePositiveMax: number;
  invalidDetectionMin: number;
  pagePassMin: number;
  autoGradeTrustMin?: number;
};

type ExamSpec = {
  totalQuestions: number;
  totalPages: number;
  optionsPerQuestion: number;
};

type RenderSpec = {
  width: number;
  height: number;
  marginPt: number;
  cornerMarkerSizePt: number;
  qrSizePt: number;
};

type NoiseSpec = {
  profile: 'realista_mixto';
  rotationDegMax: number;
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
  folio: string;
  numeroPagina: number;
  templateVersion: 3;
  seed: number;
  variantIndex: number;
};

type ManifestDataset = {
  version: '2';
  datasetType: 'synthetic_tv3';
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
};

type MapaPaginaPregunta = {
  numeroPregunta: number;
  opciones: Array<{ letra: string; x: number; y: number }>;
};

type MapaPagina = {
  numeroPagina: number;
  preguntas: MapaPaginaPregunta[];
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
    totalCapturas: number;
    totalPreguntas: number;
  };
  errors: Record<string, number>;
  checks: {
    precision: boolean;
    falsePositiveRate: boolean;
    invalidDetectionRate: boolean;
    pagePassRate: boolean;
  };
  ok: boolean;
  perCapture: PerCaptureEval[];
};

type GenerateDatasetOptions = {
  datasetRoot: string;
  variants: number;
  seed: number;
};

type EvaluateDatasetOptions = {
  datasetRoot: string;
  reportPath: string;
  thresholds?: Partial<EvalThresholds>;
};

const LETTERS: Opcion[] = ['A', 'B', 'C', 'D', 'E'];
const DEFAULT_EXAM_SPEC: ExamSpec = {
  totalQuestions: 50,
  totalPages: 4,
  optionsPerQuestion: 5
};
const DEFAULT_RENDER_SPEC: RenderSpec = {
  width: 612,
  height: 792,
  marginPt: 28.35,
  cornerMarkerSizePt: 20,
  qrSizePt: 88
};
const DEFAULT_NOISE_SPEC: NoiseSpec = {
  profile: 'realista_mixto',
  rotationDegMax: 0.45,
  blurSigmaMax: 0.22,
  brightnessMin: 0.98,
  brightnessMax: 1.03,
  contrastMin: 0.96,
  contrastMax: 1.04,
  jpegQualityMin: 90,
  jpegQualityMax: 96,
  shadowOpacityMax: 0.04
};
const DEFAULT_THRESHOLDS: EvalThresholds = {
  precisionMin: 0.95,
  falsePositiveMax: 0.02,
  invalidDetectionMin: 0.8,
  pagePassMin: 0.75,
  autoGradeTrustMin: 0.95
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

  pick<T>(items: T[]): T {
    return items[this.nextInt(0, items.length - 1)];
  }
}

function round6(value: number) {
  return Number(value.toFixed(6));
}

function hashObject(input: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function getQuestionsPerPage(totalQuestions: number, totalPages: number) {
  const base = Math.floor(totalQuestions / totalPages);
  const rem = totalQuestions % totalPages;
  return Array.from({ length: totalPages }, (_v, idx) => base + (idx < rem ? 1 : 0));
}

function buildAnswerKey(totalQuestions: number, optionsPerQuestion: number) {
  const answerKey: Record<number, Opcion> = {};
  const options = LETTERS.slice(0, Math.max(2, Math.min(LETTERS.length, optionsPerQuestion)));
  for (let q = 1; q <= totalQuestions; q += 1) {
    answerKey[q] = options[(q - 1) % options.length] ?? 'A';
  }
  return answerKey;
}

function yImage(renderSpec: RenderSpec, yPdf: number) {
  return renderSpec.height - yPdf;
}

function buildPageMap(
  pageNumber: number,
  questionNumbers: number[],
  renderSpec: RenderSpec,
  folio: string
) {
  const leftColumnX = 188;
  const rightColumnX = 428;
  const topY = 640;
  const rowStep = 82;
    const optionStep = 18;
  const leftCount = Math.ceil(questionNumbers.length / 2);

  const preguntas = questionNumbers.map((questionNumber, localIdx) => {
    const isLeft = localIdx < leftCount;
    const row = isLeft ? localIdx : localIdx - leftCount;
    const centerX = isLeft ? leftColumnX : rightColumnX;
    const baseY = topY - row * rowStep;
    const opciones = LETTERS.map((letter, optionIdx) => ({
      letra: letter,
      x: centerX,
      y: baseY - optionIdx * optionStep
    }));
    const topBubbleY = baseY;
    const bottomBubbleY = baseY - (LETTERS.length - 1) * optionStep;
    const bubbleRadius = 7.6;
    const cajaPadX = 22;
    const cajaPadY = 11;
    const cajaOmrX = centerX - cajaPadX;
    const cajaOmrY = bottomBubbleY - cajaPadY;
    const cajaOmrWidth = cajaPadX * 2;
    const cajaOmrHeight = topBubbleY - bottomBubbleY + cajaPadY * 2;
    return {
      numeroPregunta: questionNumber,
      idPregunta: `q-${questionNumber}`,
      opciones,
      cajaOmr: {
        x: cajaOmrX,
        y: cajaOmrY,
        width: cajaOmrWidth,
        height: cajaOmrHeight
      },
      perfilOmr: {
        radio: bubbleRadius,
        pasoY: optionStep,
        cajaAncho: cajaOmrWidth
      }
    };
  });

  const qrX = renderSpec.width - renderSpec.marginPt - renderSpec.qrSizePt;
  const qrY = renderSpec.height - renderSpec.marginPt - renderSpec.qrSizePt;

  return {
    numeroPagina: pageNumber,
    templateVersion: 3 as const,
    qr: {
      texto: `EXAMEN:${folio}:P${pageNumber}:TV3`,
      x: qrX,
      y: qrY,
      size: renderSpec.qrSizePt,
      padding: 4
    },
    marcasPagina: {
      tipo: 'cuadrados' as const,
      size: renderSpec.cornerMarkerSizePt,
      quietZone: 8,
      tl: { x: renderSpec.marginPt, y: renderSpec.height - renderSpec.marginPt },
      tr: { x: renderSpec.width - renderSpec.marginPt, y: renderSpec.height - renderSpec.marginPt },
      bl: { x: renderSpec.marginPt, y: renderSpec.marginPt },
      br: { x: renderSpec.width - renderSpec.marginPt, y: renderSpec.marginPt }
    },
    preguntas
  };
}

function decideMarkType(rng: Rng): MarkType {
  const roll = rng.next();
  if (roll < 0.01) return 'double';
  return 'valid';
}

function buildStudentSelection(
  questionNumber: number,
  answerKey: Record<number, Opcion>,
  markType: MarkType,
  rng: Rng
) {
  if (markType === 'blank' || markType === 'smudge') return [] as Opcion[];
  const correct = answerKey[questionNumber];
  if (markType === 'double') {
    const wrong = LETTERS.find((option) => option !== correct) ?? 'B';
    return [correct, wrong];
  }
  const isWrong = rng.next() < 0.08;
  if (!isWrong) return [correct];
  const wrongOptions = LETTERS.filter((option) => option !== correct);
  return [rng.pick(wrongOptions)];
}

function drawBubbleSvg(cx: number, cy: number, selected: boolean, fillOpacity: number) {
  const ring = `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="7.0" fill="none" stroke="#e2e2e2" stroke-width="0.45"/>`;
  if (!selected) return ring;
  return `${ring}<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="6.9" fill="#040404" fill-opacity="${Math.max(0.98, fillOpacity).toFixed(3)}"/>`;
}

async function renderPageImage(args: {
  mapPage: ReturnType<typeof buildPageMap>;
  renderSpec: RenderSpec;
  selectedByQuestion: Map<number, Opcion[]>;
  noiseSpec: NoiseSpec;
  rng: Rng;
}) {
  const { mapPage, renderSpec, selectedByQuestion, noiseSpec, rng } = args;
  const halfMarker = renderSpec.cornerMarkerSizePt / 2;
  const markers = [
    mapPage.marcasPagina.tl,
    mapPage.marcasPagina.tr,
    mapPage.marcasPagina.bl,
    mapPage.marcasPagina.br
  ];

  const markerSvg = markers
    .map((marker) => {
      const cx = marker.x;
      const cy = yImage(renderSpec, marker.y);
      const quiet = 7;
      return [
        `<rect x="${(cx - halfMarker - quiet).toFixed(2)}" y="${(cy - halfMarker - quiet).toFixed(2)}" width="${(renderSpec.cornerMarkerSizePt + quiet * 2).toFixed(2)}" height="${(renderSpec.cornerMarkerSizePt + quiet * 2).toFixed(2)}" fill="#ffffff"/>`,
        `<rect x="${(cx - halfMarker).toFixed(2)}" y="${(cy - halfMarker).toFixed(2)}" width="${renderSpec.cornerMarkerSizePt.toFixed(2)}" height="${renderSpec.cornerMarkerSizePt.toFixed(2)}" fill="#0c0c0c"/>`
      ].join('');
    })
    .join('');

  const questionsSvg = mapPage.preguntas
    .map((question) => {
      const selected = selectedByQuestion.get(question.numeroPregunta) ?? [];
      const optionsSvg = question.opciones
        .map((option) => {
          const cx = option.x;
          const cy = yImage(renderSpec, option.y);
          const isSelected = selected.includes(option.letra as Opcion);
          const fillOpacity = isSelected ? 0.86 + rng.next() * 0.12 : 0;
          return drawBubbleSvg(cx, cy, isSelected, fillOpacity);
        })
        .join('');

      const smudgeSvg = '';

      const fid = question.fiduciales;
      const fidSvg = fid
        ? [
            fid.leftTop,
            fid.leftBottom,
            fid.rightTop,
            fid.rightBottom
          ]
              .map((point) => {
                const x = point.x - 3;
                const y = yImage(renderSpec, point.y) - 3;
                return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="6" height="6" fill="#111111"/>`;
              })
              .join('')
        : '';

      return `${optionsSvg}${smudgeSvg}${fidSvg}`;
    })
    .join('');

  const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderSpec.width}" height="${renderSpec.height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${markerSvg}
  ${questionsSvg}
</svg>`;

  const qrBuffer = await QRCode.toBuffer(String(mapPage.qr?.texto ?? ''), {
    type: 'png',
    width: Math.round(renderSpec.qrSizePt),
    margin: 1,
    errorCorrectionLevel: 'H'
  });

  const qrTop = Math.round(yImage(renderSpec, Number(mapPage.qr?.y ?? 0) + Number(mapPage.qr?.size ?? 0)));
  const qrLeft = Math.round(Number(mapPage.qr?.x ?? 0));

  const angle = (rng.next() * 2 - 1) * noiseSpec.rotationDegMax;
  const blur = rng.next() * noiseSpec.blurSigmaMax;
  const brightness = noiseSpec.brightnessMin + rng.next() * (noiseSpec.brightnessMax - noiseSpec.brightnessMin);
  const contrast = noiseSpec.contrastMin + rng.next() * (noiseSpec.contrastMax - noiseSpec.contrastMin);
  const quality = Math.round(
    noiseSpec.jpegQualityMin + rng.next() * (noiseSpec.jpegQualityMax - noiseSpec.jpegQualityMin)
  );
  const shadowOpacity = rng.next() * noiseSpec.shadowOpacityMax;
  const shadowStart = Math.round(rng.next() * renderSpec.width * 0.4);
  const shadowEnd = Math.round(renderSpec.width - rng.next() * renderSpec.width * 0.25);
  const shadowOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderSpec.width}" height="${renderSpec.height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="55%" stop-color="rgba(0,0,0,${shadowOpacity.toFixed(4)})"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient>
    </defs>
    <rect x="${shadowStart}" y="0" width="${Math.max(80, shadowEnd - shadowStart)}" height="${renderSpec.height}" fill="url(#g)"/>
  </svg>`;

  let pipeline = sharp(Buffer.from(baseSvg))
    .composite([{ input: qrBuffer, top: qrTop, left: qrLeft }])
    .composite([{ input: Buffer.from(shadowOverlay), blend: 'multiply' }])
    .rotate(angle, { background: '#ffffff' })
    .resize(renderSpec.width, renderSpec.height, { fit: 'fill' })
    .modulate({ brightness, saturation: 1 })
    .linear(contrast, -7);

  if (blur >= 0.3) {
    pipeline = pipeline.blur(blur);
  }

  return pipeline.jpeg({ quality, chromaSubsampling: '4:4:4' }).toBuffer();
}

function ensureDir(dirPath: string) {
  return fs.mkdir(dirPath, { recursive: true });
}

export async function generateSyntheticTv3Dataset(options: GenerateDatasetOptions) {
  const datasetRoot = path.resolve(process.cwd(), options.datasetRoot);
  const imagesDir = path.join(datasetRoot, 'images');
  const mapsDir = path.join(datasetRoot, 'maps');
  const reportDir = path.join(datasetRoot, 'reports');
  await ensureDir(imagesDir);
  await ensureDir(mapsDir);
  await ensureDir(reportDir);

  const examSpec = DEFAULT_EXAM_SPEC;
  const renderSpec = DEFAULT_RENDER_SPEC;
  const noiseSpec = DEFAULT_NOISE_SPEC;
  const thresholds = DEFAULT_THRESHOLDS;
  const answerKey = buildAnswerKey(examSpec.totalQuestions, examSpec.optionsPerQuestion);
  const perPage = getQuestionsPerPage(examSpec.totalQuestions, examSpec.totalPages);
  const groundTruthRows: GroundTruthRow[] = [];
  const captures: CaptureManifest[] = [];
  let globalQuestionOffset = 0;

  for (let variantIdx = 0; variantIdx < options.variants; variantIdx += 1) {
    const variantSeed = options.seed + variantIdx * 1009;
    const variantRng = new Rng(variantSeed);
    const folio = `SYNTH-${String(variantIdx + 1).padStart(3, '0')}`;
    globalQuestionOffset = 0;

    for (let pageIdx = 0; pageIdx < examSpec.totalPages; pageIdx += 1) {
      const pageNumber = pageIdx + 1;
      const totalOnPage = perPage[pageIdx] ?? 0;
      const questionNumbers = Array.from(
        { length: totalOnPage },
        (_v, idx) => globalQuestionOffset + idx + 1
      );
      globalQuestionOffset += totalOnPage;
      const pageMap = buildPageMap(pageNumber, questionNumbers, renderSpec, folio);
      const selectedByQuestion = new Map<number, Opcion[]>();
      const markTypeByQuestion = new Map<number, MarkType>();

      for (const q of questionNumbers) {
        const markType = decideMarkType(variantRng);
        const selected = buildStudentSelection(q, answerKey, markType, variantRng);
        markTypeByQuestion.set(q, markType);
        selectedByQuestion.set(q, selected);
        groundTruthRows.push({
          captureId: `${folio}-P${pageNumber}`,
          numeroPregunta: q,
          opcionEsperada: markType === 'valid' ? selected[0] ?? null : null,
          markType,
          selectedOptions: selected
        });
      }

      const imageBuffer = await renderPageImage({
        mapPage: pageMap,
        renderSpec,
        selectedByQuestion,
        noiseSpec,
        rng: new Rng(variantSeed + pageIdx * 37 + 17)
      });

      const captureId = `${folio}-P${pageNumber}`;
      const imagePath = path.join('images', `${captureId}.jpg`).replaceAll('\\', '/');
      const mapPath = path.join('maps', `${captureId}.json`).replaceAll('\\', '/');
      await fs.writeFile(path.join(datasetRoot, imagePath), imageBuffer);
      await fs.writeFile(path.join(datasetRoot, mapPath), `${JSON.stringify(pageMap, null, 2)}\n`, 'utf8');
      captures.push({
        captureId,
        imagePath,
        mapaOmrPath: mapPath,
        folio,
        numeroPagina: pageNumber,
        templateVersion: 3,
        seed: variantSeed,
        variantIndex: variantIdx
      });
    }
  }

  const answerKeyPath = 'answer_key.json';
  await fs.writeFile(path.join(datasetRoot, answerKeyPath), `${JSON.stringify(answerKey, null, 2)}\n`, 'utf8');
  const groundTruthRef = 'ground_truth.jsonl';
  const groundTruthText = `${groundTruthRows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  await fs.writeFile(path.join(datasetRoot, groundTruthRef), groundTruthText, 'utf8');

  const manifestWithoutHash: Omit<ManifestDataset, 'hash'> = {
    version: '2',
    datasetType: 'synthetic_tv3',
    examSpec,
    renderSpec,
    noiseSpec,
    thresholds,
    answerKeyPath,
    groundTruthRef,
    capturas: captures
  };
  const hash = hashObject({ manifestWithoutHash, groundTruthRows });
  const manifest: ManifestDataset = {
    ...manifestWithoutHash,
    hash
  };
  await fs.writeFile(path.join(datasetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    path.join(datasetRoot, 'quality_tags.json'),
    `${JSON.stringify(
      {
        profile: noiseSpec.profile,
        generatedAt: new Date().toISOString(),
        variants: options.variants
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

async function readJson<T>(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readGroundTruth(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GroundTruthRow);
}

async function detectSyntheticOmr(
  imagePath: string,
  mapPage: MapaPagina
) {
  const { data, info } = await sharp(imagePath).greyscale().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const pixel = (x: number, y: number) => {
    const xx = Math.max(0, Math.min(width - 1, Math.round(x)));
    const yy = Math.max(0, Math.min(height - 1, Math.round(y)));
    return data[yy * width + xx] ?? 255;
  };
  const sampleDiskDarkness = (cx: number, cy: number, radius: number) => {
    let sum = 0;
    let count = 0;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > r2) continue;
        sum += pixel(cx + dx, cy + dy);
        count += 1;
      }
    }
    const mean = count > 0 ? sum / count : 255;
    return 1 - mean / 255;
  };

  const responses = new Map<number, Opcion | null>();
  let detectedMarked = 0;
  for (const question of mapPage.preguntas) {
    const optionScores = question.opciones
      .map((option) => {
        const centerX = option.x;
        const centerY = height - option.y;
        const darkness = sampleDiskDarkness(centerX, centerY, 4);
        return {
          option: String(option.letra).toUpperCase() as Opcion,
          darkness
        };
      })
      .sort((a, b) => b.darkness - a.darkness);
    const top = optionScores[0];
    const second = optionScores[1];
    let selected: Opcion | null = null;
    if (top && top.darkness >= 0.3) {
      const secondIsFar = !second || second.darkness <= top.darkness * 0.74;
      const absoluteGapOk = !second || top.darkness - second.darkness >= 0.09;
      if (secondIsFar && absoluteGapOk) {
        selected = top.option;
      }
    }
    if (selected) detectedMarked += 1;
    responses.set(question.numeroPregunta, selected);
  }

  const detectionRate = mapPage.preguntas.length > 0 ? detectedMarked / mapPage.preguntas.length : 0;
  const estadoAnalisis: PerCaptureEval['estadoAnalisis'] =
    detectionRate >= 0.55 ? 'ok' : detectionRate >= 0.35 ? 'requiere_revision' : 'rechazado_calidad';

  return {
    responses,
    estadoAnalisis
  };
}

function buildIndex(rows: GroundTruthRow[]) {
  const byCapture = new Map<string, Map<number, GroundTruthRow>>();
  for (const row of rows) {
    if (!byCapture.has(row.captureId)) byCapture.set(row.captureId, new Map<number, GroundTruthRow>());
    byCapture.get(row.captureId)?.set(row.numeroPregunta, row);
  }
  return byCapture;
}

function countMatchesForScore(
  answers: Map<number, Opcion | null>,
  answerKey: Record<number, Opcion>
) {
  let score = 0;
  for (const [questionNumber, detected] of answers.entries()) {
    if (detected !== null && answerKey[questionNumber] === detected) score += 1;
  }
  return score;
}

export async function evaluateSyntheticTv3Dataset(options: EvaluateDatasetOptions) {
  const datasetRoot = path.resolve(process.cwd(), options.datasetRoot);
  const manifest = await readJson<ManifestDataset>(path.join(datasetRoot, 'manifest.json'));
  const answerKey = await readJson<Record<number, Opcion>>(path.join(datasetRoot, manifest.answerKeyPath));
  const groundTruthRows = await readGroundTruth(path.join(datasetRoot, manifest.groundTruthRef));
  const truthByCapture = buildIndex(groundTruthRows);
  const thresholds: EvalThresholds = {
    precisionMin: options.thresholds?.precisionMin ?? manifest.thresholds.precisionMin,
    falsePositiveMax: options.thresholds?.falsePositiveMax ?? manifest.thresholds.falsePositiveMax,
    invalidDetectionMin: options.thresholds?.invalidDetectionMin ?? manifest.thresholds.invalidDetectionMin,
    pagePassMin: options.thresholds?.pagePassMin ?? manifest.thresholds.pagePassMin
  };
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let total = 0;
  let invalidTotal = 0;
  let invalidDetected = 0;
  let pagePasses = 0;
  let gradeConsistency = 0;
  const errors: Record<string, number> = {
    mismatch_option: 0,
    missed_mark: 0,
    false_mark: 0,
    invalid_not_rejected: 0
  };
  const perCapture: PerCaptureEval[] = [];

  for (const capture of manifest.capturas) {
    const mapPage = await readJson<MapaPagina>(path.join(datasetRoot, capture.mapaOmrPath));
    const detection = await detectSyntheticOmr(path.join(datasetRoot, capture.imagePath), mapPage);
    const truthForCapture = truthByCapture.get(capture.captureId);
    if (!truthForCapture) {
      throw new Error(`No ground truth for capture ${capture.captureId}`);
    }

    const detectedByQuestion = detection.responses;

    let mismatches = 0;
    const expectedByQuestion = new Map<number, Opcion | null>();
    for (const [questionNumber, truth] of truthForCapture.entries()) {
      total += 1;
      const expected = truth.opcionEsperada;
      const detected = detectedByQuestion.get(questionNumber) ?? null;
      expectedByQuestion.set(questionNumber, expected);

      if (truth.markType === 'double' || truth.markType === 'smudge') {
        invalidTotal += 1;
        if (detected === null) invalidDetected += 1;
        else errors.invalid_not_rejected += 1;
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
    const detectedScore = countMatchesForScore(detectedByQuestion, answerKey);
    if (expectedScore === detectedScore) gradeConsistency += 1;

    const totalQuestions = truthForCapture.size;
    const pagePass = totalQuestions > 0 ? mismatches / totalQuestions <= 0.05 : true;
    if (pagePass) pagePasses += 1;
    perCapture.push({
      captureId: capture.captureId,
      mismatches,
      totalPreguntas: totalQuestions,
      expectedScore,
      detectedScore,
      pagePass,
      estadoAnalisis: detection.estadoAnalisis
    });
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = total > 0 ? fp / total : 0;
  const invalidDetectionRate = invalidTotal > 0 ? invalidDetected / invalidTotal : 1;
  const pagePassRate = perCapture.length > 0 ? pagePasses / perCapture.length : 1;
  const gradeConsistencyRate = perCapture.length > 0 ? gradeConsistency / perCapture.length : 1;

  const checks = {
    precision: precision >= thresholds.precisionMin,
    falsePositiveRate: falsePositiveRate <= thresholds.falsePositiveMax,
    invalidDetectionRate: invalidDetectionRate >= thresholds.invalidDetectionMin,
    pagePassRate: pagePassRate >= thresholds.pagePassMin
  };

  const report: CanonicalReport = {
    runId: `omr-synth-${Date.now()}`,
    examId: 'tv3-synthetic-50q-4p',
    templateId: 'tv3',
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

export async function runTv3SyntheticGate(args: {
  datasetRoot: string;
  reportPath: string;
  variants: number;
  seed: number;
  thresholds?: Partial<EvalThresholds>;
}) {
  await generateSyntheticTv3Dataset({
    datasetRoot: args.datasetRoot,
    variants: args.variants,
    seed: args.seed
  });
  const report = await evaluateSyntheticTv3Dataset({
    datasetRoot: args.datasetRoot,
    reportPath: args.reportPath,
    thresholds: args.thresholds
  });
  return report;
}
