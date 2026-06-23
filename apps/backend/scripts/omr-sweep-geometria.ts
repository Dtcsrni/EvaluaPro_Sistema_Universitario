/**
 * omr-sweep-geometria
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluateProfile, type EvalProfileSummary } from './omr-eval-profile';

type Summary = {
  profile: string;
  mode: 'omr';
  dataset: string;
  totalReactivos: number;
  detectadas: number;
  correctas: number;
  deteccionRate: number;
  precisionSobreTotal: number;
  estados: Record<string, number>;
  imagenesConError: number;
};

type Profile = {
  name: string;
  env: Record<string, string>;
};

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const options = {
    dataset: '../../omr_samples',
    mode: 'omr' as const,
    out: '../../reports/qa/latest/omr_sweep_geometria.json'
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === '--dataset' || arg === '-d') && next) {
      options.dataset = next;
      i += 1;
      continue;
    }
    if ((arg === '--mode' || arg === '-m') && next && next === 'omr') {
      options.mode = 'omr';
      i += 1;
      continue;
    }
    if ((arg === '--out' || arg === '-o') && next) {
      options.out = next;
      i += 1;
      continue;
    }
  }

  return options;
}

function perfilesGeometria(): Profile[] {
  return [
    { name: 'actual', env: {} },
    {
      name: 'geo_wide_search',
      env: {
        OMR_ALIGN_RANGE: '28',
        OMR_VERT_RANGE: '14',
        OMR_LOCAL_SEARCH_RATIO: '0.45'
      }
    },
    {
      name: 'geo_tight_search',
      env: {
        OMR_ALIGN_RANGE: '16',
        OMR_VERT_RANGE: '8',
        OMR_LOCAL_SEARCH_RATIO: '0.30'
      }
    },
    {
      name: 'offset_left_up',
      env: {
        OMR_OFFSET_X: '-10',
        OMR_OFFSET_Y: '-4'
      }
    },
    {
      name: 'offset_right_down',
      env: {
        OMR_OFFSET_X: '10',
        OMR_OFFSET_Y: '4'
      }
    },
    {
      name: 'hybrid_balanced',
      env: {
        OMR_ALIGN_RANGE: '24',
        OMR_VERT_RANGE: '12',
        OMR_LOCAL_SEARCH_RATIO: '0.40',
        OMR_OFFSET_X: '-4',
        OMR_OFFSET_Y: '0'
      }
    }
  ];
}

async function runProfile(profile: Profile, dataset: string, mode: 'omr'): Promise<Summary> {
  const oldEnv = {
    OMR_PROFILE_NAME: process.env.OMR_PROFILE_NAME,
    OMR_ALIGN_RANGE: process.env.OMR_ALIGN_RANGE,
    OMR_VERT_RANGE: process.env.OMR_VERT_RANGE,
    OMR_LOCAL_SEARCH_RATIO: process.env.OMR_LOCAL_SEARCH_RATIO,
    OMR_OFFSET_X: process.env.OMR_OFFSET_X,
    OMR_OFFSET_Y: process.env.OMR_OFFSET_Y
  };

  process.env.OMR_PROFILE_NAME = profile.name;
  for (const [key, value] of Object.entries(profile.env)) {
    process.env[key] = value;
  }

  try {
    const summary: EvalProfileSummary = await evaluateProfile({
      dataset,
      mode,
      mongoUri: process.env.MONGODB_URI_HOST || 'mongodb://localhost:27017/evaluapro',
      profileName: profile.name
    });
    return summary;
  } catch (error) {
    throw new Error(`Perfil ${profile.name} falló: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    const keys = ['OMR_ALIGN_RANGE', 'OMR_VERT_RANGE', 'OMR_LOCAL_SEARCH_RATIO', 'OMR_OFFSET_X', 'OMR_OFFSET_Y'] as const;
    for (const key of keys) {
      const previous = oldEnv[key];
      if (typeof previous === 'string') process.env[key] = previous;
      else delete process.env[key];
    }
    if (typeof oldEnv.OMR_PROFILE_NAME === 'string') process.env.OMR_PROFILE_NAME = oldEnv.OMR_PROFILE_NAME;
    else delete process.env.OMR_PROFILE_NAME;
  }
}

function winnerByScore(rows: Array<{ profile: string; summary: Summary; deltaVsActual: Record<string, number> }>) {
  const ordered = [...rows].sort((a, b) => {
    if (b.summary.precisionSobreTotal !== a.summary.precisionSobreTotal) {
      return b.summary.precisionSobreTotal - a.summary.precisionSobreTotal;
    }
    if (b.summary.deteccionRate !== a.summary.deteccionRate) {
      return b.summary.deteccionRate - a.summary.deteccionRate;
    }
    return a.summary.imagenesConError - b.summary.imagenesConError;
  });
  return ordered[0];
}

async function main() {
  const options = parseArgs(process.argv);
  const profiles = perfilesGeometria();

  const runs = [] as Array<{ profile: string; summary: Summary }>;
  for (const profile of profiles) {
    const summary = await runProfile(profile, options.dataset, options.mode);
    runs.push({ profile: profile.name, summary });
  }

  const actual = runs.find((r) => r.profile === 'actual');
  if (!actual) throw new Error('No se encontró baseline actual');

  const enriched = runs.map((run) => {
    const deltaVsActual = {
      detectadas: run.summary.detectadas - actual.summary.detectadas,
      correctas: run.summary.correctas - actual.summary.correctas,
      deteccionRate: Number((run.summary.deteccionRate - actual.summary.deteccionRate).toFixed(6)),
      precisionSobreTotal: Number((run.summary.precisionSobreTotal - actual.summary.precisionSobreTotal).toFixed(6)),
      imagenesConError: run.summary.imagenesConError - actual.summary.imagenesConError
    };
    return {
      profile: run.profile,
      summary: run.summary,
      deltaVsActual
    };
  });

  const winner = winnerByScore(enriched);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    dataset: path.resolve(process.cwd(), options.dataset),
    baselineProfile: 'actual',
    winner: {
      profile: winner.profile,
      precisionSobreTotal: winner.summary.precisionSobreTotal,
      deteccionRate: winner.summary.deteccionRate,
      deltaVsActual: winner.deltaVsActual
    },
    runs: enriched
  };

  const outputPath = path.resolve(process.cwd(), options.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const table = enriched.map((run) => ({
    perfil: run.profile,
    reactivos: run.summary.totalReactivos,
    detectadas: run.summary.detectadas,
    correctas: run.summary.correctas,
    detRate: Number(run.summary.deteccionRate.toFixed(4)),
    precTotal: Number(run.summary.precisionSobreTotal.toFixed(4)),
    dDetRate: run.deltaVsActual.deteccionRate,
    dPrec: run.deltaVsActual.precisionSobreTotal
  }));

  process.stdout.write(`${JSON.stringify({ winner: report.winner, table, outputPath })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});

