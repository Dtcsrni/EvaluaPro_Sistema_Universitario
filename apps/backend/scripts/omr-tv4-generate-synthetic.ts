/**
 * omr-tv4-generate-synthetic
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { generateSyntheticTv4Dataset } from './omr-tv4-synthetic-lib.js';

type Args = {
  dataset: string;
  variants: number;
  seed: number;
  questions: number;
  dpi: number;
  affineShearMax?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv4',
    variants: 6,
    seed: 20260308,
    questions: 20,
    dpi: 144,
    affineShearMax: undefined
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
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
    if ((key === '--questions' || key === '-q') && value) {
      args.questions = Math.max(20, Math.min(25, Number.parseInt(value, 10) || args.questions));
      i += 1;
      continue;
    }
    if ((key === '--dpi' || key === '--raster-dpi') && value) {
      args.dpi = Math.max(72, Math.min(600, Number.parseInt(value, 10) || args.dpi));
      i += 1;
      continue;
    }
    if ((key === '--affine-shear-max' || key === '--shear') && value) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) args.affineShearMax = Math.max(0, Math.min(0.02, parsed));
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await generateSyntheticTv4Dataset({
    datasetRoot: args.dataset,
    variants: args.variants,
    seed: args.seed,
    totalQuestions: args.questions,
    rasterDpi: args.dpi,
    affineShearMax: args.affineShearMax
  });
  process.stdout.write(
    `${JSON.stringify({
      datasetRoot: result.datasetRoot,
      captures: result.captures,
      questions: result.questions,
      variants: args.variants,
      seed: args.seed,
      dpi: args.dpi,
      affineShearMax: args.affineShearMax
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
