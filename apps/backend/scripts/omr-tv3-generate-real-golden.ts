/**
 * omr-tv3-generate-real-golden
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { generateSyntheticTv3Dataset } from './omr-tv3-synthetic-lib';

type Scenario =
  | 'buena_luz'
  | 'luz_calida'
  | 'luz_fria'
  | 'rotacion_leve'
  | 'desenfoque_leve'
  | 'jpeg_media'
  | 'sombreado_parcial';

type Args = {
  dataset: string;
  report: string;
  variants: number;
  seed: number;
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
  scenario?: Scenario;
};

type ManifestDataset = {
  version: string;
  datasetType: string;
  examSpec: {
    totalQuestions: number;
    totalPages: number;
    optionsPerQuestion: number;
  };
  renderSpec: {
    width: number;
    height: number;
    marginPt: number;
    cornerMarkerSizePt: number;
    qrSizePt: number;
  };
  noiseSpec: Record<string, unknown>;
  thresholds: {
    precisionMin: number;
    falsePositiveMax: number;
    invalidDetectionMin: number;
    pagePassMin: number;
    autoGradeTrustMin?: number;
  };
  answerKeyPath: string;
  groundTruthRef: string;
  capturas: CaptureManifest[];
  layoutMeta?: {
    layoutRevision: string;
    layoutHash: string;
  };
  hash?: string;
};

const SCENARIOS: Scenario[] = [
  'buena_luz',
  'luz_calida',
  'luz_fria',
  'rotacion_leve',
  'desenfoque_leve',
  'jpeg_media',
  'sombreado_parcial'
];

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3_real',
    report: '../../reports/qa/latest/omr/real_dataset_generation_report.json',
    variants: 24,
    seed: 20260223
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
    if ((key === '--variants' || key === '-n') && value) {
      args.variants = Math.max(8, Number.parseInt(value, 10) || args.variants);
      i += 1;
      continue;
    }
    if (key === '--seed' && value) {
      args.seed = Number.parseInt(value, 10) || args.seed;
      i += 1;
    }
  }
  return args;
}

function scenarioForCapture(capture: CaptureManifest): Scenario {
  const idx = Math.abs((capture.variantIndex * 13 + capture.numeroPagina * 7) % SCENARIOS.length);
  return SCENARIOS[idx] ?? 'buena_luz';
}

async function applyScenario(imagePath: string, scenario: Scenario, variantSeed: number) {
  const buffer = await fs.readFile(imagePath);
  const rngFactor = ((variantSeed % 1000) / 1000) * 0.04;
  let pipeline = sharp(buffer);

  switch (scenario) {
    case 'buena_luz':
      pipeline = pipeline.modulate({ brightness: 1.01, saturation: 1 }).linear(1.01, -2);
      break;
    case 'luz_calida':
      pipeline = pipeline.modulate({ brightness: 1.01, saturation: 0.99 }).tint({ r: 252, g: 236, b: 220 });
      break;
    case 'luz_fria':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 1.0 }).tint({ r: 236, g: 244, b: 255 });
      break;
    case 'rotacion_leve':
      pipeline = pipeline.rotate(0.28 + rngFactor * 0.6, { background: '#ffffff' });
      break;
    case 'desenfoque_leve':
      pipeline = pipeline.blur(0.3 + rngFactor * 0.4).modulate({ brightness: 1 });
      break;
    case 'jpeg_media':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 1.0 });
      break;
    case 'sombreado_parcial': {
      const meta = await sharp(buffer).metadata();
      const width = Number(meta.width ?? 612);
      const height = Number(meta.height ?? 792);
      const overlay = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="rgba(0,0,0,0)" />
              <stop offset="50%" stop-color="rgba(0,0,0,0.035)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          <rect x="${Math.round(width * 0.15)}" y="0" width="${Math.round(width * 0.62)}" height="${height}" fill="url(#g)" />
        </svg>`
      );
      pipeline = pipeline.composite([{ input: overlay, blend: 'multiply' }]);
      break;
    }
    default:
      break;
  }

  const quality = scenario === 'jpeg_media' ? 90 : 94;
  const out = await pipeline.jpeg({ quality, chromaSubsampling: '4:4:4' }).toBuffer();
  await fs.writeFile(imagePath, out);
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  const reportPath = path.resolve(process.cwd(), args.report);

  const generated = await generateSyntheticTv3Dataset({
    datasetRoot: args.dataset,
    variants: args.variants,
    seed: args.seed
  });

  const manifestPath = path.join(datasetRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ManifestDataset;

  const scenarioCount = new Map<Scenario, number>();
  for (const capture of manifest.capturas) {
    const scenario = scenarioForCapture(capture);
    capture.scenario = scenario;
    scenarioCount.set(scenario, (scenarioCount.get(scenario) ?? 0) + 1);
    await applyScenario(path.join(datasetRoot, capture.imagePath), scenario, capture.seed);
  }

  manifest.datasetType = 'tv3_real_pdf_capture_simulated';
  manifest.thresholds.precisionMin = 0.95;
  manifest.thresholds.falsePositiveMax = 0.02;
  manifest.thresholds.invalidDetectionMin = 0.8;
  manifest.thresholds.pagePassMin = 0.75;
  manifest.thresholds.autoGradeTrustMin = 0.75;
  const layoutSignature = manifest.capturas
    .map((capture) => `${capture.captureId}:${capture.mapaOmrPath}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
  manifest.layoutMeta = {
    layoutRevision: 'tv3_low_ink_resilient_r1',
    layoutHash: crypto.createHash('sha256').update(layoutSignature).digest('hex')
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const payload = {
    generatedAt: new Date().toISOString(),
    datasetRoot,
    datasetType: manifest.datasetType,
    variants: args.variants,
    captures: manifest.capturas.length,
    questions: generated.questions,
    scenarios: Object.fromEntries(Array.from(scenarioCount.entries()).sort((a, b) => a[0].localeCompare(b[0])))
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
