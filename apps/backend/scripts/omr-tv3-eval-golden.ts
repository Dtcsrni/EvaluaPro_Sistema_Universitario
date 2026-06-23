/**
 * omr-tv3-eval-golden
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { runOmrTv3E2E } from './omr-tv3-e2e';

type Args = {
  dataset: string;
  report: string;
  variants: number;
  seed: number;
  targetPrecision: number;
  targetFpMax: number;
  maxIterations: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3',
    report: '../../reports/qa/latest/omr-tv3-gate.json',
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

async function main() {
  const args = parseArgs(process.argv);
  const result = await runOmrTv3E2E({
    dataset: args.dataset,
    report: args.report,
    variants: args.variants,
    seed: args.seed,
    targetPrecision: args.targetPrecision,
    targetFpMax: args.targetFpMax,
    maxIterations: args.maxIterations
  });
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});

