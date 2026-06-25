/**
 * omr-tv3-optimize-synthetic
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  evaluateSyntheticTv3Dataset,
  generateSyntheticTv3Dataset
} from './omr-tv3-synthetic-lib';

type Args = {
  dataset: string;
  report: string;
  maxIterations: number;
  variants: number;
  baseSeed: number;
  targetPrecision: number;
  targetFpMax: number;
  stabilityWindow: number;
  stabilityDelta: number;
};

type IterationSummary = {
  iteration: number;
  seed: number;
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    invalidDetectionRate: number;
    falsePositiveRate: number;
    pagePassRate: number;
  };
  checks: Record<string, boolean>;
  ok: boolean;
  objective: number;
};

type OptimizeResult = {
  generatedAt: string;
  dataset: string;
  target: {
    precision: number;
    falsePositiveMax: number;
    stabilityWindow: number;
    stabilityDelta: number;
  };
  best: IterationSummary;
  iterations: IterationSummary[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3',
    report: '../../reports/qa/latest/omr/synthetic-optimization.json',
    maxIterations: 6,
    variants: 6,
    baseSeed: 20260219,
    targetPrecision: 0.95,
    targetFpMax: 0.02,
    stabilityWindow: 3,
    stabilityDelta: 0.015
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
    if ((key === '--max-iterations' || key === '-i') && value) {
      args.maxIterations = Math.max(1, Number.parseInt(value, 10) || args.maxIterations);
      i += 1;
      continue;
    }
    if ((key === '--variants' || key === '-n') && value) {
      args.variants = Math.max(1, Number.parseInt(value, 10) || args.variants);
      i += 1;
      continue;
    }
    if (key === '--base-seed' && value) {
      args.baseSeed = Number.parseInt(value, 10) || args.baseSeed;
      i += 1;
      continue;
    }
    if (key === '--target-precision' && value) {
      args.targetPrecision = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--target-fp-max' && value) {
      args.targetFpMax = Number.parseFloat(value);
      i += 1;
      continue;
    }
    if (key === '--stability-window' && value) {
      args.stabilityWindow = Math.max(2, Number.parseInt(value, 10) || args.stabilityWindow);
      i += 1;
      continue;
    }
    if (key === '--stability-delta' && value) {
      args.stabilityDelta = Number.parseFloat(value);
      i += 1;
    }
  }
  return args;
}

function objective(metrics: IterationSummary['metrics']) {
  return (
    metrics.precision * 0.66 +
    metrics.recall * 0.15 +
    metrics.invalidDetectionRate * 0.11 +
    metrics.pagePassRate * 0.12 -
    metrics.falsePositiveRate * 0.34
  );
}

function hasStability(iterations: IterationSummary[], windowSize: number, delta: number) {
  if (iterations.length < windowSize) return false;
  const tail = iterations.slice(-windowSize).map((item) => item.metrics.precision);
  const max = Math.max(...tail);
  const min = Math.min(...tail);
  return max - min <= delta;
}

export async function optimizeSyntheticDataset(args: Args): Promise<OptimizeResult> {
  const iterations: IterationSummary[] = [];
  let best: IterationSummary | null = null;
  const tmpEvalReport = '../../reports/qa/latest/omr/synthetic-eval.tmp.json';

  for (let iteration = 1; iteration <= args.maxIterations; iteration += 1) {
    const seed = args.baseSeed + (iteration - 1) * 97;
    await generateSyntheticTv3Dataset({
      datasetRoot: args.dataset,
      variants: args.variants,
      seed
    });
    const run = await evaluateSyntheticTv3Dataset({
      datasetRoot: args.dataset,
      reportPath: tmpEvalReport,
      thresholds: {
        precisionMin: args.targetPrecision,
        falsePositiveMax: args.targetFpMax,
        invalidDetectionMin: 0.8,
        pagePassMin: 0.75
      }
    });
    const summary: IterationSummary = {
      iteration,
      seed,
      metrics: run.metrics,
      checks: run.checks,
      ok: run.ok,
      objective: Number(objective(run.metrics).toFixed(8))
    };
    iterations.push(summary);
    if (!best || summary.objective > best.objective) best = summary;

    if (
      best.metrics.precision >= args.targetPrecision &&
      best.metrics.falsePositiveRate <= args.targetFpMax &&
      hasStability(iterations, args.stabilityWindow, args.stabilityDelta)
    ) {
      break;
    }
  }

  if (!best) throw new Error('No fue posible evaluar el dataset sintetico OMR.');

  const result: OptimizeResult = {
    generatedAt: new Date().toISOString(),
    dataset: path.resolve(process.cwd(), args.dataset),
    target: {
      precision: args.targetPrecision,
      falsePositiveMax: args.targetFpMax,
      stabilityWindow: args.stabilityWindow,
      stabilityDelta: args.stabilityDelta
    },
    best,
    iterations
  };

  const reportPath = path.resolve(process.cwd(), args.report);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await optimizeSyntheticDataset(args);
  process.stdout.write(
    `${JSON.stringify({
      reportPath: path.resolve(process.cwd(), args.report),
      best: result.best
    })}\n`
  );
  if (
    result.best.metrics.precision < args.targetPrecision ||
    result.best.metrics.falsePositiveRate > args.targetFpMax
  ) {
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exit(1);
  });
}
