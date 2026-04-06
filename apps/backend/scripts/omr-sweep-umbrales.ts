import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluateProfile, type EvalProfileSummary } from './omr-eval-profile';

type ModoOmr = 'omr';

type Thresholds = {
  qualityRejectMin: number;
  qualityReviewMin: number;
  autoConfMin: number;
  autoAmbiguasMax: number;
  autoDeteccionMin: number;
  autoRescueQualityMin: number;
  autoRescueConfMin: number;
  autoRescueAmbigMax: number;
};

type SweepOptions = {
  dataset: string;
  mode: ModoOmr;
  out: string;
  maxPasses: number;
};

type EvaluacionPerfil = {
  name: string;
  thresholds: Thresholds;
  summary: EvalProfileSummary;
  score: number;
  scoreParts: {
    precision: number;
    deteccion: number;
    okRate: number;
    requiereRevisionRate: number;
    rechazadoRate: number;
    erroresRate: number;
  };
};

const DEFAULTS: Thresholds = {
  qualityRejectMin: Number.parseFloat(process.env.OMR_QUALITY_REJECT_MIN || '0.65'),
  qualityReviewMin: Number.parseFloat(process.env.OMR_QUALITY_REVIEW_MIN || '0.8'),
  autoConfMin: Number.parseFloat(process.env.OMR_AUTO_CONF_MIN || '0.82'),
  autoAmbiguasMax: Number.parseFloat(process.env.OMR_AUTO_AMBIGUAS_MAX || '0.06'),
  autoDeteccionMin: Number.parseFloat(process.env.OMR_AUTO_DETECCION_MIN || '0.85'),
  autoRescueQualityMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_QUALITY_MIN || '0.58'),
  autoRescueConfMin: Number.parseFloat(process.env.OMR_AUTO_RESCUE_CONF_MIN || '0.84'),
  autoRescueAmbigMax: Number.parseFloat(process.env.OMR_AUTO_RESCUE_AMBIG_MAX || '0.04')
};

function parseArgs(argv: string[]): SweepOptions {
  const args = argv.slice(2);
  const options: SweepOptions = {
    dataset: '../../omr_samples',
    mode: 'omr',
    out: '../../reports/qa/latest/omr_sweep_umbrales.json',
    maxPasses: 2
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
    if (arg === '--max-passes' && next) {
      options.maxPasses = Math.max(1, Number.parseInt(next, 10) || 2);
      i += 1;
    }
  }

  return options;
}

function round3(v: number) {
  return Number(v.toFixed(3));
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function normalizeThresholds(raw: Thresholds): Thresholds {
  const qualityReviewMin = round3(clamp(raw.qualityReviewMin, 0.45, 0.98));
  const qualityRejectMax = Math.max(0.3, qualityReviewMin - 0.05);
  const qualityRejectMin = round3(clamp(raw.qualityRejectMin, 0.2, qualityRejectMax));
  return {
    qualityRejectMin,
    qualityReviewMin,
    autoConfMin: round3(clamp(raw.autoConfMin, 0.45, 0.99)),
    autoAmbiguasMax: round3(clamp(raw.autoAmbiguasMax, 0.005, 0.4)),
    autoDeteccionMin: round3(clamp(raw.autoDeteccionMin, 0.4, 0.99)),
    autoRescueQualityMin: round3(clamp(raw.autoRescueQualityMin, 0.2, 0.95)),
    autoRescueConfMin: round3(clamp(raw.autoRescueConfMin, 0.45, 0.99)),
    autoRescueAmbigMax: round3(clamp(raw.autoRescueAmbigMax, 0.005, 0.4))
  };
}

function serializeThresholds(t: Thresholds) {
  return JSON.stringify(t);
}

function setThresholdEnv(t: Thresholds) {
  process.env.OMR_QUALITY_REJECT_MIN = String(t.qualityRejectMin);
  process.env.OMR_QUALITY_REVIEW_MIN = String(t.qualityReviewMin);
  process.env.OMR_AUTO_CONF_MIN = String(t.autoConfMin);
  process.env.OMR_AUTO_AMBIGUAS_MAX = String(t.autoAmbiguasMax);
  process.env.OMR_AUTO_DETECCION_MIN = String(t.autoDeteccionMin);
  process.env.OMR_AUTO_RESCUE_QUALITY_MIN = String(t.autoRescueQualityMin);
  process.env.OMR_AUTO_RESCUE_CONF_MIN = String(t.autoRescueConfMin);
  process.env.OMR_AUTO_RESCUE_AMBIG_MAX = String(t.autoRescueAmbigMax);
}

function totalEstados(estados: Record<string, number>) {
  return Object.values(estados).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

function calcularScore(summary: EvalProfileSummary) {
  const totalPaginas = totalEstados(summary.estados);
  const ok = Number(summary.estados.ok ?? 0);
  const requiereRevision = Number(summary.estados.requiere_revision ?? 0);
  const rechazado = Number(summary.estados.rechazado_calidad ?? 0);

  const okRate = totalPaginas > 0 ? ok / totalPaginas : 0;
  const requiereRevisionRate = totalPaginas > 0 ? requiereRevision / totalPaginas : 0;
  const rechazadoRate = totalPaginas > 0 ? rechazado / totalPaginas : 0;
  const erroresRate = totalPaginas > 0 ? summary.imagenesConError / totalPaginas : 0;

  const precision = summary.precisionSobreTotal;
  const deteccion = summary.deteccionRate;

  const score =
    precision * 0.64 +
    deteccion * 0.26 +
    okRate * 0.08 -
    requiereRevisionRate * 0.07 -
    rechazadoRate * 0.16 -
    erroresRate * 0.2;

  return {
    score: Number(score.toFixed(8)),
    parts: {
      precision,
      deteccion,
      okRate,
      requiereRevisionRate,
      rechazadoRate,
      erroresRate
    }
  };
}

function mejor(a: EvaluacionPerfil, b: EvaluacionPerfil) {
  if (b.score !== a.score) return b.score > a.score;
  if (b.summary.precisionSobreTotal !== a.summary.precisionSobreTotal) {
    return b.summary.precisionSobreTotal > a.summary.precisionSobreTotal;
  }
  if (b.summary.deteccionRate !== a.summary.deteccionRate) {
    return b.summary.deteccionRate > a.summary.deteccionRate;
  }
  return b.summary.imagenesConError < a.summary.imagenesConError;
}

function variacionesPorClave(actual: Thresholds, key: keyof Thresholds): number[] {
  const base = actual[key];
  const delta =
    key === 'autoAmbiguasMax' || key === 'autoRescueAmbigMax'
      ? 0.01
      : key === 'qualityRejectMin' || key === 'qualityReviewMin'
        ? 0.03
        : 0.04;
  const vals = [base - delta, base, base + delta].map((v) => round3(v));
  return Array.from(new Set(vals));
}

async function evaluarConfig(
  cache: Map<string, EvaluacionPerfil>,
  name: string,
  thresholds: Thresholds,
  dataset: string,
  mode: ModoOmr
) {
  const normalized = normalizeThresholds(thresholds);
  const key = serializeThresholds(normalized);
  const inCache = cache.get(key);
  if (inCache) return inCache;

  setThresholdEnv(normalized);
  process.env.OMR_PROFILE_NAME = name;

  const summary = await evaluateProfile({
    dataset,
    mode,
    mongoUri: process.env.MONGODB_URI_HOST || 'mongodb://localhost:27017/evaluapro',
    profileName: name
  });
  const score = calcularScore(summary);
  const out: EvaluacionPerfil = {
    name,
    thresholds: normalized,
    summary,
    score: score.score,
    scoreParts: score.parts
  };
  cache.set(key, out);
  return out;
}

async function main() {
  const options = parseArgs(process.argv);
  const datasetAbs = path.resolve(process.cwd(), options.dataset);
  const outAbs = path.resolve(process.cwd(), options.out);
  const cache = new Map<string, EvaluacionPerfil>();

  const baseline = await evaluarConfig(cache, 'thresholds_baseline', DEFAULTS, options.dataset, options.mode);
  let mejorActual = baseline;
  let actual = baseline.thresholds;

  const trace: Array<{
    pass: number;
    key: keyof Thresholds;
    from: number;
    to: number;
    scoreBefore: number;
    scoreAfter: number;
    improved: boolean;
  }> = [];

  const keys = [
    'qualityRejectMin',
    'qualityReviewMin',
    'autoConfMin',
    'autoAmbiguasMax',
    'autoDeteccionMin',
    'autoRescueQualityMin',
    'autoRescueConfMin',
    'autoRescueAmbigMax'
  ] as const;

  for (let pass = 1; pass <= options.maxPasses; pass += 1) {
    let huboMejora = false;
    for (const key of keys) {
      const before = mejorActual;
      let mejorLocal = before;

      for (const candidato of variacionesPorClave(actual, key)) {
        const propuesta = normalizeThresholds({ ...actual, [key]: candidato });
        const evalRun = await evaluarConfig(
          cache,
          `thresholds_pass${pass}_${String(key)}_${String(candidato)}`,
          propuesta,
          options.dataset,
          options.mode
        );
        if (mejor(mejorLocal, evalRun)) {
          mejorLocal = evalRun;
        }
      }

      const improved = mejor(before, mejorLocal);
      trace.push({
        pass,
        key,
        from: before.thresholds[key],
        to: mejorLocal.thresholds[key],
        scoreBefore: before.score,
        scoreAfter: mejorLocal.score,
        improved
      });

      if (improved) {
        actual = mejorLocal.thresholds;
        mejorActual = mejorLocal;
        huboMejora = true;
      }
    }
    if (!huboMejora) break;
  }

  const delta = {
    score: Number((mejorActual.score - baseline.score).toFixed(8)),
    detectadas: mejorActual.summary.detectadas - baseline.summary.detectadas,
    correctas: mejorActual.summary.correctas - baseline.summary.correctas,
    deteccionRate: Number((mejorActual.summary.deteccionRate - baseline.summary.deteccionRate).toFixed(6)),
    precisionSobreTotal: Number((mejorActual.summary.precisionSobreTotal - baseline.summary.precisionSobreTotal).toFixed(6)),
    imagenesConError: mejorActual.summary.imagenesConError - baseline.summary.imagenesConError
  };

  const runs = Array.from(cache.values())
    .map((r) => ({
      name: r.name,
      thresholds: r.thresholds,
      score: r.score,
      scoreParts: r.scoreParts,
      summary: r.summary
    }))
    .sort((a, b) => b.score - a.score);

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: datasetAbs,
    mode: options.mode,
    search: {
      algorithm: 'coordinate_descent',
      maxPasses: options.maxPasses,
      evaluatedConfigs: runs.length
    },
    baseline: {
      thresholds: baseline.thresholds,
      score: baseline.score,
      scoreParts: baseline.scoreParts,
      summary: baseline.summary
    },
    best: {
      thresholds: mejorActual.thresholds,
      score: mejorActual.score,
      scoreParts: mejorActual.scoreParts,
      summary: mejorActual.summary,
      deltaVsBaseline: delta
    },
    trace,
    top5: runs.slice(0, 5),
    runs
  };

  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify({
      outputPath: outAbs,
      evaluatedConfigs: runs.length,
      baselineScore: baseline.score,
      bestScore: mejorActual.score,
      deltaVsBaseline: delta,
      bestThresholds: mejorActual.thresholds
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});

