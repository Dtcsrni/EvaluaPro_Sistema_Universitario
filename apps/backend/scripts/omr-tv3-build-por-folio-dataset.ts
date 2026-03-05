import path from 'node:path';
import { buildPorFolioDataset } from '../src/modulos/modulo_escaneo_omr/porFolioDataset';

type Args = {
  dataset: string;
  organization?: string;
  assignments?: string;
  pdfSnapshot?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dataset: 'omr_samples_tv3_real_por_folio'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--dataset' || key === '-d') && value) {
      args.dataset = value;
      i += 1;
      continue;
    }
    if (key === '--organization' && value) {
      args.organization = value;
      i += 1;
      continue;
    }
    if (key === '--assignments' && value) {
      args.assignments = value;
      i += 1;
      continue;
    }
    if (key === '--pdf-snapshot' && value) {
      args.pdfSnapshot = value;
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const summary = await buildPorFolioDataset({
    repoRoot,
    datasetRoot: args.dataset,
    organizationPath: args.organization,
    assignmentSnapshotPath: args.assignments,
    pdfSnapshotPath: args.pdfSnapshot
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
