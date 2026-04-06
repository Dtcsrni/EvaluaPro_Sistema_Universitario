import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  evaluateSyntheticTv3Dataset,
  generateSyntheticTv3Dataset
} from './omr-tv3-synthetic-lib';
import { optimizeSyntheticDataset } from './omr-tv3-optimize-synthetic';

type Args = {
  dataset: string;
  report: string;
  optimizationReport: string;
  variants: number;
  seed: number;
  targetPrecision: number;
  targetFpMax: number;
  maxIterations: number;
};

type OptimizationResult = {
  best?: {
    seed?: number;
  };
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3',
    report: '../../reports/qa/latest/omr-tv3-gate.json',
    optimizationReport: '../../reports/qa/latest/omr/synthetic-optimization.json',
    variants: 6,
    seed: 20260219,
    targetPrecision: 0.95,
    targetFpMax: 0.02,
    maxIterations: 8
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
    if (key === '--optimization-report' && value) {
      args.optimizationReport = value;
      i += 1;
      continue;
    }
    if ((key === '--variants' || key === '-n') && value) {
      args.variants = Math.max(1, Number.parseInt(value, 10) || args.variants);
      i += 1;
      continue;
    }
    if (key === '--seed' && value) {
      args.seed = Number.parseInt(value, 10) || args.seed;
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
    if (key === '--max-iterations' && value) {
      args.maxIterations = Math.max(1, Number.parseInt(value, 10) || args.maxIterations);
      i += 1;
    }
  }
  return args;
}

async function readJsonFile<T>(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export async function runOmrTv3E2E(inputArgs?: Partial<Args>) {
  const parsed = parseArgs(process.argv);
  const args: Args = {
    ...parsed,
    ...inputArgs
  };
  const startedAt = new Date();
  await optimizeSyntheticDataset({
    dataset: args.dataset,
    report: args.optimizationReport,
    maxIterations: args.maxIterations,
    variants: args.variants,
    baseSeed: args.seed,
    targetPrecision: args.targetPrecision,
    targetFpMax: args.targetFpMax,
    stabilityWindow: 3,
    stabilityDelta: 0.015
  });
  const optPath = path.resolve(process.cwd(), args.optimizationReport);
  const optimization = await readJsonFile<OptimizationResult>(optPath);
  const bestSeed = optimization.best?.seed ?? args.seed;

  await generateSyntheticTv3Dataset({
    datasetRoot: args.dataset,
    variants: args.variants,
    seed: bestSeed
  });

  const report = await evaluateSyntheticTv3Dataset({
    datasetRoot: args.dataset,
    reportPath: args.report,
    thresholds: {
      precisionMin: args.targetPrecision,
      falsePositiveMax: args.targetFpMax,
      invalidDetectionMin: 0.8,
      pagePassMin: 0.75
    }
  });

  const finishedAt = new Date();
  const payload = {
    ok: report.ok,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    reportPath: path.resolve(process.cwd(), args.report),
    optimizationReportPath: optPath,
    metrics: report.metrics,
    checks: report.checks
  };
  process.stdout.write(
    `${JSON.stringify(payload)}\n`
  );

  return payload;
}

async function main() {
  const result = await runOmrTv3E2E();
  if (!result.ok) process.exit(1);
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
