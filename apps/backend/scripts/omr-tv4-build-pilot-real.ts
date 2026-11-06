/**
 * omr-tv4-build-pilot-real
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  CaptureManifestPorFolio,
  GroundTruthRowPorFolio,
  MapaOmrPaginaPorFolio,
  OpcionOmr,
  QuestionRangePorFolio
} from '../src/modulos/modulo_escaneo_omr/porFolioDataset.js';
import { normalizarClavePilotoReal } from '../src/modulos/modulo_escaneo_omr/clavePilotoReal.js';

type Args = {
  dataset: string;
  sourceManifest?: string;
};

type Tv4CaptureManifest = Omit<CaptureManifestPorFolio, 'templateVersion'> & {
  templateVersion: 4;
};

type Tv4GroundTruthRow = Omit<GroundTruthRowPorFolio, 'sourceEvidence'> & {
  sourceEvidence: GroundTruthRowPorFolio['sourceEvidence'];
};

type SourceCaptureTruthRow = Omit<Tv4GroundTruthRow, 'captureId' | 'folio' | 'numeroPagina'>;

type SourceCaptureEntry = {
  captureId: string;
  folio: string;
  numeroPagina: number;
  captureOrdinal?: number;
  imageSourcePath: string;
  mapaOmrSourcePath: string;
  questionRange?: QuestionRangePorFolio;
  sourcePath?: string;
  sourceGroup?: string;
  expectedQr: string;
  bonusVisible?: boolean;
  truthRows: SourceCaptureTruthRow[];
};

type SourceImportManifest = {
  version: '1';
  datasetType: 'tv4_pilot_real_import';
  answerKey?: Record<string, OpcionOmr>;
  answerKeyByFolio?: Record<string, Record<string, OpcionOmr>>;
  captures: SourceCaptureEntry[];
};

type DatasetManifest = {
  version: '1';
  datasetType: 'tv4_pilot_real';
  templateVersion: 4;
  thresholds: {
    precisionMin: number;
    falsePositiveMax: number;
    invalidDetectionMin: number;
    pagePassMin: number;
    autoGradeTrustMin: number;
    autoCoverageMin: number;
  };
  groundTruthRef: string;
  answerKeyPath: string;
  answerKeyByFolioPath?: string;
  capturas: Tv4CaptureManifest[];
};

const DEFAULT_THRESHOLDS = {
  precisionMin: 0.98,
  falsePositiveMax: 0.01,
  invalidDetectionMin: 0.95,
  pagePassMin: 0.95,
  autoGradeTrustMin: 0.95,
  autoCoverageMin: 0.95
} as const;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv4_pilot_real'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--source-manifest' || key === '-s') && value) {
      args.sourceManifest = value;
      i += 1;
    }
  }
  return args;
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

function normalizeOption(value: unknown): OpcionOmr | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();
  return normalized === 'A' || normalized === 'B' || normalized === 'C' || normalized === 'D' || normalized === 'E'
    ? normalized
    : null;
}

function normalizeQuestionRange(range: QuestionRangePorFolio | undefined, truthRows: SourceCaptureTruthRow[]) {
  if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
    return {
      from: Number(range.from),
      to: Number(range.to)
    };
  }
  const numbers = truthRows
    .map((row) => Number(row.numeroPregunta))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!numbers.length) {
    throw new Error('No se puede derivar questionRange sin truthRows.');
  }
  return {
    from: numbers[0] ?? 1,
    to: numbers[numbers.length - 1] ?? numbers[0] ?? 1
  };
}

export function buildTemplateImportManifest() {
  return {
    version: '1',
    datasetType: 'tv4_pilot_real_import',
    captures: []
  } satisfies SourceImportManifest;
}

async function ensureBaseScaffold(datasetRoot: string) {
  await ensureDir(datasetRoot);
  await ensureDir(path.join(datasetRoot, 'images'));
  await ensureDir(path.join(datasetRoot, 'maps'));
  await ensureDir(path.join(datasetRoot, 'source'));
}

async function ensureScaffoldFiles(datasetRoot: string) {
  const manifestPath = path.join(datasetRoot, 'manifest.json');
  const answerKeyPath = path.join(datasetRoot, 'answer_key.json');
  const truthPath = path.join(datasetRoot, 'ground_truth.jsonl');
  const readmePath = path.join(datasetRoot, 'README.md');
  const sourceTemplatePath = path.join(datasetRoot, 'source', 'pilot_import.template.json');
  try {
    await fs.access(manifestPath);
  } catch {
    await writeJson(manifestPath, {
      version: '1',
      datasetType: 'tv4_pilot_real',
      templateVersion: 4,
      thresholds: DEFAULT_THRESHOLDS,
      groundTruthRef: 'ground_truth.jsonl',
      answerKeyPath: 'answer_key.json',
      capturas: []
    } satisfies DatasetManifest);
  }
  try {
    await fs.access(answerKeyPath);
  } catch {
    await fs.writeFile(answerKeyPath, '{}\n', 'utf8');
  }
  try {
    await fs.access(truthPath);
  } catch {
    await fs.writeFile(truthPath, '', 'utf8');
  }
  try {
    await fs.access(readmePath);
  } catch {
    await fs.writeFile(
      readmePath,
      [
        '# TV4 Pilot Real',
        '',
        'Dataset del piloto real de TV4.',
        '',
        '## Uso',
        '- Coloca un manifest de importacion en `source/pilot_import.json` o usa `--source-manifest`.',
        '- Ejecuta `npm -C apps/backend run omr:build:pilot-real`.',
        '- El builder copiara imagenes y mapas, validara TV4 y generara `manifest.json`, `ground_truth.jsonl` y `answer_key.json`.',
        '',
        '## Estado',
        '- Si el dataset esta vacio, TV4 sigue en estado `ready for validation` y aun no puede declararse productivo.'
      ].join('\n'),
      'utf8'
    );
  }
  try {
    await fs.access(sourceTemplatePath);
  } catch {
    await writeJson(sourceTemplatePath, buildTemplateImportManifest());
  }
}

function validateMapPage(mapPage: MapaOmrPaginaPorFolio, capture: SourceCaptureEntry) {
  if (Number(mapPage.templateVersion) !== 4) {
    throw new Error(`El mapa ${capture.mapaOmrSourcePath} no corresponde a TV4.`);
  }
  if (Number(mapPage.numeroPagina) !== Number(capture.numeroPagina)) {
    throw new Error(
      `El mapa ${capture.mapaOmrSourcePath} declara pagina ${mapPage.numeroPagina} y la captura ${capture.captureId} declara ${capture.numeroPagina}.`
    );
  }
  if (!Array.isArray(mapPage.preguntas) || !mapPage.preguntas.length) {
    throw new Error(`El mapa ${capture.mapaOmrSourcePath} no contiene preguntas OMR.`);
  }
}

export async function buildFromImportManifest(datasetRoot: string, sourceManifestPath: string) {
  await Promise.all([
    ensureDir(datasetRoot),
    ensureDir(path.join(datasetRoot, 'images')),
    ensureDir(path.join(datasetRoot, 'maps')),
    ensureDir(path.join(datasetRoot, 'source'))
  ]);
  const sourceManifest = await readJson<SourceImportManifest>(sourceManifestPath);
  if (sourceManifest.datasetType !== 'tv4_pilot_real_import') {
    throw new Error('El source manifest debe declarar datasetType=tv4_pilot_real_import.');
  }
  if (!Array.isArray(sourceManifest.captures) || !sourceManifest.captures.length) {
    throw new Error('El source manifest no contiene capturas.');
  }
  for (const capture of sourceManifest.captures) {
    if (capture.numeroPagina === 1 && typeof capture.bonusVisible !== 'boolean') {
      throw new Error(`La primera página del examen ${capture.folio} requiere bonusVisible booleano revisado a ciegas.`);
    }
    if (capture.numeroPagina !== 1 && capture.bonusVisible !== undefined) {
      throw new Error(`bonusVisible solo se registra en la primera página del examen ${capture.folio}.`);
    }
  }

  const capturesOut: Tv4CaptureManifest[] = [];
  const truthLines: string[] = [];

  for (const capture of sourceManifest.captures) {
    const absImage = path.resolve(path.dirname(sourceManifestPath), capture.imageSourcePath);
    const absMap = path.resolve(path.dirname(sourceManifestPath), capture.mapaOmrSourcePath);
    const imageExt = path.extname(absImage) || '.jpg';
    const imageTargetRel = path.posix.join('images', `${capture.captureId}${imageExt.toLowerCase()}`);
    const mapTargetRel = path.posix.join('maps', `${capture.captureId}.json`);
    const imageTargetAbs = path.join(datasetRoot, imageTargetRel);
    const mapTargetAbs = path.join(datasetRoot, mapTargetRel);
    const mapPage = await readJson<MapaOmrPaginaPorFolio>(absMap);
    validateMapPage(mapPage, capture);

    await fs.access(absImage);

    await fs.copyFile(absImage, imageTargetAbs);
    await writeJson(mapTargetAbs, mapPage);

    const questionRange = normalizeQuestionRange(capture.questionRange, capture.truthRows);
    capturesOut.push({
      captureId: capture.captureId,
      folio: String(capture.folio).trim().toUpperCase(),
      numeroPagina: Number(capture.numeroPagina),
      captureOrdinal: Math.max(1, Number(capture.captureOrdinal ?? 1)),
      imagePath: imageTargetRel,
      mapaOmrPath: mapTargetRel,
      questionRange,
      sourcePath: capture.sourcePath ?? capture.imageSourcePath,
      sourceGroup: capture.sourceGroup ?? 'pilot_real_import',
      templateVersion: 4,
      expectedQr: capture.expectedQr
    });

    for (const truthRow of capture.truthRows) {
      const row: Tv4GroundTruthRow = {
        captureId: capture.captureId,
        folio: String(capture.folio).trim().toUpperCase(),
        numeroPagina: Number(capture.numeroPagina),
        numeroPregunta: Number(truthRow.numeroPregunta),
        opcionEsperada: normalizeOption(truthRow.opcionEsperada),
        markType: truthRow.markType,
        selectedOptions: Array.isArray(truthRow.selectedOptions)
          ? truthRow.selectedOptions
              .map(normalizeOption)
              .filter((option): option is OpcionOmr => option !== null)
          : [],
        ...(truthRow.humanReview ? { humanReview: truthRow.humanReview } : {}),
        ...(truthRow.bonusVisible === undefined && capture.bonusVisible !== undefined ? { bonusVisible: capture.bonusVisible } : {}),
        sourceEvidence: truthRow.sourceEvidence
      };
      truthLines.push(JSON.stringify(row));
    }
  }

  const answerKeysByFolio = sourceManifest.answerKeyByFolio
    ? Object.fromEntries(Object.entries(sourceManifest.answerKeyByFolio).map(([folio, key]) => [
        folio.trim().toUpperCase(), normalizarClavePilotoReal(key, `answerKeyByFolio.${folio}`)
      ]))
    : undefined;
  if (answerKeysByFolio) {
    const folios = new Set(sourceManifest.captures.map((capture) => capture.folio.trim().toUpperCase()));
    const missingFolios = [...folios].filter((folio) => !answerKeysByFolio[folio]);
    if (missingFolios.length) throw new Error(`Faltan claves explícitas para folio(s): ${missingFolios.slice(0, 5).join(', ')}.`);
  }
  const answerKey = sourceManifest.answerKey
    ? normalizarClavePilotoReal(sourceManifest.answerKey)
    : answerKeysByFolio?.[Object.keys(answerKeysByFolio)[0] ?? ''];
  if (!answerKey) throw new Error('El import requiere answerKey o answerKeyByFolio; no se deriva la clave de las respuestas estudiantiles.');
  const manifest: DatasetManifest = {
    version: '1',
    datasetType: 'tv4_pilot_real',
    templateVersion: 4,
    thresholds: { ...DEFAULT_THRESHOLDS },
    groundTruthRef: 'ground_truth.jsonl',
    answerKeyPath: 'answer_key.json',
    ...(answerKeysByFolio ? { answerKeyByFolioPath: 'answer_key_by_folio.json' } : {}),
    capturas: capturesOut.sort((a, b) => a.captureId.localeCompare(b.captureId))
  };

  await writeJson(path.join(datasetRoot, 'manifest.json'), manifest);
  await fs.writeFile(path.join(datasetRoot, 'ground_truth.jsonl'), `${truthLines.join('\n')}${truthLines.length ? '\n' : ''}`, 'utf8');
  await writeJson(path.join(datasetRoot, 'answer_key.json'), answerKey);
  if (answerKeysByFolio) await writeJson(path.join(datasetRoot, 'answer_key_by_folio.json'), answerKeysByFolio);
  await fs.copyFile(sourceManifestPath, path.join(datasetRoot, 'source', 'pilot_import.snapshot.json'));

  return {
    captures: manifest.capturas.length,
    questions: truthLines.length,
    answerKeyQuestions: Object.keys(answerKey).length,
    imported: true
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  await ensureBaseScaffold(datasetRoot);
  await ensureScaffoldFiles(datasetRoot);

  const sourceManifestPath = args.sourceManifest
    ? path.resolve(process.cwd(), args.sourceManifest)
    : path.join(datasetRoot, 'source', 'pilot_import.json');

  let imported = false;
  let summary = {
    captures: 0,
    questions: 0,
    answerKeyQuestions: 0,
    imported: false
  };

  try {
    await fs.access(sourceManifestPath);
    summary = await buildFromImportManifest(datasetRoot, sourceManifestPath);
    imported = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      datasetRoot,
      sourceManifestPath,
      imported,
      ...summary
    })}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exit(1);
  });
}
