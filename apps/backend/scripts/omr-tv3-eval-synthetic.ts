/**
 * omr-tv3-eval-synthetic
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { evaluateSyntheticTv3Dataset } from './omr-tv3-synthetic-lib';

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
    dataset: '../../omr_samples_tv3',
    report: '../../reports/qa/latest/omr/synthetic-eval.json'
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
  const report = await evaluateSyntheticTv3Dataset({
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

