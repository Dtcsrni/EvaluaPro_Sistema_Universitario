import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type Args = {
  datasetSynthetic: string;
  datasetReal: string;
  datasetRealManual: string;
  report: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    datasetSynthetic: '../../omr_samples_tv3',
    datasetReal: '../../omr_samples_tv3_real',
    datasetRealManual: '../../omr_samples_tv3_real_manual_min',
    report: '../../reports/qa/latest/omr/baseline_snapshot.json'
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--dataset-synthetic' && value) {
      args.datasetSynthetic = value;
      i += 1;
      continue;
    }
    if (key === '--dataset-real' && value) {
      args.datasetReal = value;
      i += 1;
      continue;
    }
    if (key === '--dataset-real-manual' && value) {
      args.datasetRealManual = value;
      i += 1;
      continue;
    }
    if ((key === '--report' || key === '-r') && value) {
      args.report = value;
      i += 1;
    }
  }
  return args;
}

async function runCmd(command: string, cwd: string, env?: NodeJS.ProcessEnv) {
  const started = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env: { ...process.env, ...env }
    });
    return {
      ok: true,
      command,
      durationMs: Date.now() - started,
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim()
    };
  } catch (error) {
    const e = error as Error & { stdout?: string; stderr?: string };
    return {
      ok: false,
      command,
      durationMs: Date.now() - started,
      stdout: String(e.stdout || '').trim(),
      stderr: String(e.stderr || '').trim(),
      error: e.message
    };
  }
}

function pickOmrEnv(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith('OMR_') || key === 'NODE_ENV')
      .sort((a, b) => a[0].localeCompare(b[0]))
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const gitHead = await runCmd('git rev-parse HEAD', cwd);

  const smoke = await runCmd('npm run omr:cv:smoke', cwd);
  const synthetic = await runCmd(
    `npm run omr:tv3:eval:synthetic -- --dataset ${args.datasetSynthetic} --report ../../reports/qa/latest/omr/synthetic-eval.json`,
    cwd
  );
  const real = await runCmd(
    `npm run omr:tv3:validate:real -- --dataset ${args.datasetReal} --report ../../reports/qa/latest/omr/tv3-real-validation.json --failure-report ../../reports/qa/latest/omr/tv3-real-failure-analysis.json`,
    cwd
  );
  const realManual = await runCmd(
    `npm run omr:tv3:validate:real -- --dataset ${args.datasetRealManual} --report ../../reports/qa/latest/omr/tv3-real-manual-validation.json --failure-report ../../reports/qa/latest/omr/tv3-real-manual-failure-analysis.json`,
    cwd
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    git: {
      commit: gitHead.stdout || null
    },
    datasets: {
      synthetic: path.resolve(cwd, args.datasetSynthetic),
      real: path.resolve(cwd, args.datasetReal),
      realManual: path.resolve(cwd, args.datasetRealManual)
    },
    environment: pickOmrEnv(process.env),
    gates: {
      smokeCv: smoke,
      synthetic,
      real,
      realManual
    }
  };

  const reportPath = path.resolve(cwd, args.report);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const repoRoot = path.resolve(cwd, '../..');
  const toRepoRelative = (targetPath: string) => path.relative(repoRoot, targetPath).replace(/\\/g, '/');
  const syntheticReportPath = path.resolve(cwd, '../../reports/qa/latest/omr/synthetic-eval.json');
  const realValidationPath = path.resolve(cwd, '../../reports/qa/latest/omr/tv3-real-validation.json');
  const realFailurePath = path.resolve(cwd, '../../reports/qa/latest/omr/tv3-real-failure-analysis.json');
  const realManualValidationPath = path.resolve(cwd, '../../reports/qa/latest/omr/tv3-real-manual-validation.json');
  const realManualFailurePath = path.resolve(cwd, '../../reports/qa/latest/omr/tv3-real-manual-failure-analysis.json');
  const realDatasetGenerationPath = path.resolve(cwd, '../../reports/qa/latest/omr/real_dataset_generation_report.json');
  const realManualDatasetGenerationPath = path.resolve(cwd, '../../reports/qa/latest/omr/real_manual_dataset_generation_report.json');
  const omrManifestPath = path.resolve(cwd, '../../reports/qa/latest/omr/manifest.json');
  const omrManifest = {
    generatedAt: payload.generatedAt,
    commit: payload.git.commit,
    datasets: payload.datasets,
    reports: {
      baselineSnapshot: toRepoRelative(reportPath),
      realDatasetGeneration: toRepoRelative(realDatasetGenerationPath),
      realManualDatasetGeneration: toRepoRelative(realManualDatasetGenerationPath),
      syntheticEval: toRepoRelative(syntheticReportPath),
      realValidation: toRepoRelative(realValidationPath),
      realFailureAnalysis: toRepoRelative(realFailurePath),
      realManualValidation: toRepoRelative(realManualValidationPath),
      realManualFailureAnalysis: toRepoRelative(realManualFailurePath)
    },
    gates: {
      smokeCv: smoke.ok,
      synthetic: synthetic.ok,
      real: real.ok,
      realManual: realManual.ok
    }
  };
  await fs.mkdir(path.dirname(omrManifestPath), { recursive: true });
  await fs.writeFile(omrManifestPath, `${JSON.stringify(omrManifest, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify({
      reportPath,
      commit: payload.git.commit,
      gates: {
        smokeCv: smoke.ok,
        synthetic: synthetic.ok,
        real: real.ok,
        realManual: realManual.ok
      }
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
