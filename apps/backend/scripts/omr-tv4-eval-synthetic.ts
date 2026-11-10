/**
 * omr-tv4-eval-synthetic
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

type Args = {
  dataset: string;
  report: string;
  precisionMin?: number;
  falsePositiveMax?: number;
  invalidDetectionMin?: number;
  pagePassMin?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv4',
    report: '../../reports/qa/latest/omr/tv4-synthetic-eval.json'
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
    if (key === '--precision-min' && value) {
      args.precisionMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--false-positive-max' && value) {
      args.falsePositiveMax = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--invalid-detection-min' && value) {
      args.invalidDetectionMin = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--page-pass-min' && value) {
      args.pagePassMin = Number.parseFloat(value);
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetRoot = path.resolve(process.cwd(), args.dataset);
  const manifest = JSON.parse(await fs.readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')) as {
    thresholds?: { omrParams?: Record<string, number> };
  };
  const omrParams = {
    OMR_RESPUESTA_CONF_MIN: manifest.thresholds?.omrParams?.OMR_RESPUESTA_CONF_MIN ?? 0.78,
    OMR_SCORE_MIN: manifest.thresholds?.omrParams?.OMR_SCORE_MIN ?? 0.08,
    OMR_DELTA_MIN: manifest.thresholds?.omrParams?.OMR_DELTA_MIN ?? 0.02
  };
  for (const [name, value] of Object.entries(omrParams)) process.env[name] = String(value);

  // El motor lee sus parámetros al cargarse; importarlo después de fijar la
  // configuración evita reportar umbrales distintos de los que se evaluaron.
  const { evaluateSyntheticTv4Dataset } = await import('./omr-tv4-synthetic-lib.js');
  const report = await evaluateSyntheticTv4Dataset({
    datasetRoot: args.dataset,
    reportPath: args.report,
    thresholds: {
      precisionMin: args.precisionMin,
      falsePositiveMax: args.falsePositiveMax,
      invalidDetectionMin: args.invalidDetectionMin,
      pagePassMin: args.pagePassMin
    }
  });

  process.stdout.write(
    `${JSON.stringify({
      runId: report.runId,
      ok: report.ok,
      metrics: report.metrics,
      checks: report.checks
    })}\n`
  );

  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
