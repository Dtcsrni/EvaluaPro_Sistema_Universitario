/**
 * omr-tv3-generate-real-manual-min
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { generateSyntheticTv3Dataset } from './omr-tv3-synthetic-lib';

type Scenario =
  | 'buena_luz'
  | 'luz_calida'
  | 'luz_fria'
  | 'rotacion_leve'
  | 'ligera_sombra'
  | 'jpeg_media'
  | 'baja_tinta';

type Args = {
  dataset: string;
  report: string;
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
  thresholds: {
    precisionMin: number;
    falsePositiveMax: number;
    invalidDetectionMin: number;
    pagePassMin: number;
    autoGradeTrustMin?: number;
  };
  capturas: CaptureManifest[];
  layoutMeta?: {
    layoutRevision: string;
    layoutHash: string;
  };
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3_real_manual_min',
    report: '../../reports/qa/latest/omr/real_manual_dataset_generation_report.json',
    seed: 20260224
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
    if (key === '--seed' && value) {
      args.seed = Number.parseInt(value, 10) || args.seed;
      i += 1;
    }
  }
  return args;
}

function scenarioForCapture(capture: CaptureManifest): Scenario {
  const byVariant: Scenario[][] = [
    ['buena_luz', 'luz_calida', 'rotacion_leve', 'baja_tinta'],
    ['luz_fria', 'ligera_sombra', 'jpeg_media', 'baja_tinta'],
    ['buena_luz', 'ligera_sombra', 'rotacion_leve', 'baja_tinta'],
    ['luz_fria', 'luz_calida', 'jpeg_media', 'baja_tinta'],
    ['buena_luz', 'ligera_sombra', 'rotacion_leve', 'jpeg_media'],
    ['luz_fria', 'ligera_sombra', 'rotacion_leve', 'baja_tinta']
  ];
  const variantScenarios = byVariant[capture.variantIndex % byVariant.length];
  return variantScenarios?.[Math.max(0, Math.min(3, capture.numeroPagina - 1))] ?? 'buena_luz';
}

async function applyScenario(imagePath: string, scenario: Scenario, seed: number) {
  const buffer = await fs.readFile(imagePath);
  const rngFactor = ((seed % 1000) / 1000) * 0.05;
  let pipeline = sharp(buffer);

  switch (scenario) {
    case 'buena_luz':
      pipeline = pipeline.modulate({ brightness: 1.01, saturation: 1.0 }).linear(1.01, -1);
      break;
    case 'luz_calida':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 0.99 }).tint({ r: 251, g: 235, b: 220 });
      break;
    case 'luz_fria':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 1.0 }).tint({ r: 235, g: 243, b: 255 });
      break;
    case 'rotacion_leve':
      pipeline = pipeline.rotate(0.35 + rngFactor * 0.5, { background: '#ffffff' });
      break;
    case 'ligera_sombra': {
      const meta = await sharp(buffer).metadata();
      const width = Number(meta.width ?? 612);
      const height = Number(meta.height ?? 792);
      const overlay = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="rgba(0,0,0,0)" />
              <stop offset="50%" stop-color="rgba(0,0,0,0.045)" />
              <stop offset="100%" stop-color="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          <rect x="${Math.round(width * 0.2)}" y="0" width="${Math.round(width * 0.56)}" height="${height}" fill="url(#g)" />
        </svg>`
      );
      pipeline = pipeline.composite([{ input: overlay, blend: 'multiply' }]);
      break;
    }
    case 'jpeg_media':
      pipeline = pipeline.modulate({ brightness: 1.0, saturation: 1.0 });
      break;
    case 'baja_tinta':
      // Simula marcas y texto impresos tenues manteniendo detectabilidad de fiduciales/QR.
      pipeline = pipeline.modulate({ brightness: 1.02, saturation: 0.99 }).linear(0.95, 7);
      break;
    default:
      break;
  }

  const quality = scenario === 'jpeg_media' ? 88 : 93;
  const out = await pipeline.jpeg({ quality, chromaSubsampling: '4:4:4' }).toBuffer();
  await fs.writeFile(imagePath, out);
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  const reportPath = path.resolve(process.cwd(), args.report);

  await generateSyntheticTv3Dataset({
    datasetRoot: args.dataset,
    variants: 6,
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

  manifest.datasetType = 'tv3_real_manual_min_mobile_simulated';
  manifest.thresholds.precisionMin = 0.95;
  manifest.thresholds.falsePositiveMax = 0.02;
  manifest.thresholds.invalidDetectionMin = 0.75;
  manifest.thresholds.pagePassMin = 0.75;
  manifest.thresholds.autoGradeTrustMin = 0.75;
  manifest.layoutMeta = {
    layoutRevision: 'tv3_low_ink_resilient_r1',
    layoutHash: '69b91a043b2a842c2372ec88631057cd1097678b1ebec391f4ce33a10f0fb099'
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const payload = {
    generatedAt: new Date().toISOString(),
    datasetRoot,
    datasetType: manifest.datasetType,
    captures: manifest.capturas.length,
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
