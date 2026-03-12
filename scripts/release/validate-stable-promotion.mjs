#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { evaluateStreak, fetchRunsFromGitHub } from './check-ci-streak.mjs';
import { validateEvidenceContract } from './check-release-evidence.mjs';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function parseRunsFixture(fixturePath) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), fixturePath), 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.workflow_runs)) return raw.workflow_runs;
  return [];
}

export function evaluateStablePromotion(options) {
  const checks = [];
  const runs = options.runs || [];
  const streakVerdict = evaluateStreak(runs, options.requiredStreak);
  checks.push({
    id: 'ci-streak',
    ok: streakVerdict.ok,
    detail: `streak=${streakVerdict.streak}/${options.requiredStreak}`
  });

  try {
    validateEvidenceContract(options.evidenceDir);
    checks.push({ id: 'release-evidence', ok: true, detail: options.evidenceDir });
  } catch (error) {
    checks.push({ id: 'release-evidence', ok: false, detail: String(error?.message || error) });
  }

  try {
    const manifestPath = path.resolve(process.cwd(), options.installerManifestPath || 'dist/installer/EvaluaPro-release-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const flavors = Array.isArray(manifest?.flavors) ? manifest.flavors : [];
    const required = ['saas-completo', 'docente-local'];
    const missing = required.filter((flavorId) => !flavors.some((item) => String(item?.flavorId || '') === flavorId));
    if (missing.length > 0) {
      throw new Error(`Manifest multi-flavor incompleto: ${missing.join(', ')}`);
    }
    checks.push({ id: 'installer-multi-flavor', ok: true, detail: manifestPath });
  } catch (error) {
    checks.push({ id: 'installer-multi-flavor', ok: false, detail: String(error?.message || error) });
  }

  if (options.prodFlowResult) {
    checks.push({
      id: 'prod-flow',
      ok: options.prodFlowResult.ok,
      detail: options.prodFlowResult.ok ? 'OK' : options.prodFlowResult.stderr || 'FAIL'
    });
  } else {
    checks.push({
      id: 'prod-flow',
      ok: true,
      detail: 'Verificado por evidencia persistida (sin ejecucion activa).'
    });
  }

  const ok = checks.every((item) => item.ok);
  return { ok, checks };
}

export async function main() {
  const version = getArg('version', process.env.RELEASE_VERSION || '');
  const requiredStreak = Number(getArg('required-streak', process.env.CI_STREAK_REQUIRED || '10'));
  const branch = getArg('branch', process.env.CI_STREAK_BRANCH || 'main');
  const workflowFile = getArg('workflow', process.env.CI_STREAK_WORKFLOW || 'ci.yml');
  const repo = getArg('repo', process.env.GITHUB_REPOSITORY || '');
  const runsFixture = getArg('runs-fixture', process.env.CI_STREAK_RUNS_FIXTURE || '');
  const evidenceDirArg = getArg('evidence-dir', '');
  const runProdFlow = getArg('run-prod-flow', '0') === '1';
  const reportDirArg = getArg('report-dir', '');

  if (!version && !evidenceDirArg) {
    throw new Error('Falta --version=<semver> o --evidence-dir=<path>');
  }

  const evidenceDir = evidenceDirArg
    ? path.resolve(process.cwd(), evidenceDirArg)
    : path.resolve(process.cwd(), `docs/release/evidencias/${version}`);
  const reportDir = reportDirArg
    ? path.resolve(process.cwd(), reportDirArg)
    : path.resolve(process.cwd(), `reports/release/stable-gate/${version || 'adhoc'}`);
  fs.mkdirSync(reportDir, { recursive: true });

  if (!runsFixture && !repo) {
    throw new Error('Falta --repo=<owner/repo> o GITHUB_REPOSITORY para consultar racha CI');
  }

  const runs = runsFixture
    ? parseRunsFixture(runsFixture)
    : fetchRunsFromGitHub(repo, branch, workflowFile, Math.max(requiredStreak + 5, 30));
  let prodFlowResult = null;
  if (runProdFlow) {
    const scriptPath = path.resolve(process.cwd(), 'scripts/release/gate-prod-flow.mjs');
    prodFlowResult = runNodeScript(scriptPath, process.argv.slice(2));
  }

  const result = evaluateStablePromotion({
    requiredStreak,
    runs,
    evidenceDir,
    prodFlowResult,
    installerManifestPath: getArg('installer-manifest', '')
  });

  const decision = {
    timestamp: new Date().toISOString(),
    version: version || path.basename(evidenceDir),
    decision: result.ok ? 'Go' : 'No-Go',
    checks: result.checks
  };
  fs.writeFileSync(path.join(reportDir, 'decision.json'), `${JSON.stringify(decision, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(decision)}\n`);

  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[release:stable-gate] ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
