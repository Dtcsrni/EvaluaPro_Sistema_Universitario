import { generateSyntheticTv3Dataset } from './omr-tv3-synthetic-lib';

type Args = {
  dataset: string;
  variants: number;
  seed: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: '../../omr_samples_tv3',
    variants: 6,
    seed: 20260219
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
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await generateSyntheticTv3Dataset({
    datasetRoot: args.dataset,
    variants: args.variants,
    seed: args.seed
  });
  process.stdout.write(
    `${JSON.stringify({
      datasetRoot: result.datasetRoot,
      captures: result.captures,
      questions: result.questions,
      variants: args.variants,
      seed: args.seed
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});

