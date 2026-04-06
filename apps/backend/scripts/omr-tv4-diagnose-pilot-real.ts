import fs from 'node:fs/promises';
import path from 'node:path';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr';
import type {
  CaptureManifestPorFolio,
  GroundTruthRowPorFolio,
  MapaOmrPaginaPorFolio
} from '../src/modulos/modulo_escaneo_omr/porFolioDataset';

type ManifestDataset = {
  datasetType: string;
  groundTruthRef: string;
  capturas: CaptureManifestPorFolio[];
};

type Args = {
  dataset: string;
  outDir: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv4_pilot_real',
    outDir: '../../reports/qa/latest/omr/tv4-pilot-real-diagnose'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if ((key === '--out-dir' || key === '-o') && value) {
      args.outDir = value;
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

function groupTruth(rows: GroundTruthRowPorFolio[]) {
  const grouped = new Map<string, GroundTruthRowPorFolio[]>();
  for (const row of rows) {
    if (!grouped.has(row.captureId)) grouped.set(row.captureId, []);
    grouped.get(row.captureId)!.push(row);
  }
  return grouped;
}

function imageToDataUrl(imagePath: string, fileBuffer: Buffer) {
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fileBuffer.toString('base64')}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  const outDir = path.resolve(process.cwd(), args.outDir);
  const manifest = await readJsonFile<ManifestDataset>(path.join(datasetRoot, 'manifest.json'));
  if (!Array.isArray(manifest.capturas) || manifest.capturas.length === 0) {
    throw new Error('El dataset piloto real TV4 no contiene capturas. Ejecuta primero el armado del piloto real.');
  }
  const truth = groupTruth(await readGroundTruth(path.join(datasetRoot, manifest.groundTruthRef)));
  await fs.mkdir(outDir, { recursive: true });

  for (const capture of manifest.capturas) {
    const imageBuffer = await fs.readFile(path.join(datasetRoot, capture.imagePath));
    const mapPage = await readJsonFile<MapaOmrPaginaPorFolio>(path.join(datasetRoot, capture.mapaOmrPath));
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
    const truthRows = truth.get(capture.captureId) ?? [];
    const payload = {
      capture,
      result,
      truthRows,
      byQuestion: truthRows.map((row) => {
        const detected = result.respuestasDetectadas.find((item) => item.numeroPregunta === row.numeroPregunta);
        return {
          numeroPregunta: row.numeroPregunta,
          expected: row.opcionEsperada,
          markType: row.markType,
          selectedOptions: row.selectedOptions,
          detectedOption: detected?.opcion ?? null,
          confidence: detected?.confianza ?? 0,
          flags: detected?.flags ?? [],
          scores: detected?.scoresPorOpcion ?? []
        };
      })
    };
    await fs.writeFile(
      path.join(outDir, `${capture.captureId}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
  }

  process.stdout.write(`${JSON.stringify({ ok: true, outDir })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
