#!/usr/bin/env node
/**
 * validate-stable-promotion
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { evaluateStreak, fetchRunsFromGitHub } from './check-ci-streak.mjs';
import { validateEvidenceContract } from './check-release-evidence.mjs';

const REQUIRED_QA_ARTIFACTS = [
  'dataset-prodlike',
  'e2e-docente-alumno',
  'global-grade',
  'evaluaciones-policy',
  'evaluaciones-e2e',
  'pdf-print',
  'ux-visual',
  'clean-architecture'
];

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
  const raw = JSON.parse(readJsonFile(path.resolve(process.cwd(), fixturePath)));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.workflow_runs)) return raw.workflow_runs;
  return [];
}

function readJsonFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function validateAutomatedQaEvidence(qaManifestPath) {
  const manifestPath = path.resolve(process.cwd(), qaManifestPath || 'reports/qa/latest/manifest.json');
  const manifest = JSON.parse(readJsonFile(manifestPath));
  const artifacts = Array.isArray(manifest?.artefactos) ? manifest.artefactos : [];
  const resumen = manifest?.resumen || {};
  const estado = String(resumen?.estado || '').trim().toLowerCase();
  const faltantes = Number(resumen?.faltantes ?? NaN);

  if (estado !== 'ok' || faltantes !== 0) {
    throw new Error(`Manifest QA no esta en verde: estado=${estado || 'invalido'} faltantes=${Number.isNaN(faltantes) ? 'invalido' : faltantes}`);
  }

  const missing = REQUIRED_QA_ARTIFACTS.filter((artifactId) => {
    return !artifacts.some((artifact) => {
      const artifactPath = String(artifact?.archivo || '').replace(/\\/g, '/');
      return artifact?.existe === true && artifactPath.endsWith(`${artifactId}.json`);
    });
  });
  if (missing.length > 0) {
    throw new Error(`Manifest QA incompleto: ${missing.join(', ')}`);
  }

  const failing = [];
  for (const artifact of artifacts) {
    const artifactPath = String(artifact?.archivo || '').trim();
    if (!artifactPath) continue;
    const artifactName = path.basename(artifactPath, '.json');
    if (!REQUIRED_QA_ARTIFACTS.includes(artifactName)) continue;
    const absoluteArtifactPath = path.resolve(process.cwd(), artifactPath);
    const payload = JSON.parse(readJsonFile(absoluteArtifactPath));
    if (Object.prototype.hasOwnProperty.call(payload, 'ok') && payload.ok !== true) {
      failing.push(artifactName);
    }
  }
  if (failing.length > 0) {
    throw new Error(`Artefactos QA en fallo: ${failing.join(', ')}`);
  }

  return manifestPath;
}

function validateInstallerReleaseManifest(manifestPathArg, expectedVersion = '') {
  const manifestPath = path.resolve(process.cwd(), manifestPathArg || 'dist/installer/EvaluaPro-release-manifest.json');
  const manifest = JSON.parse(readJsonFile(manifestPath));
  const flavors = Array.isArray(manifest?.flavors) ? manifest.flavors : [];
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  const buildVersion = String(manifest?.build?.version || '').trim();
  const topLevelVersion = String(manifest?.version || '').trim();
  const buildCommit = String(manifest?.build?.commit || '').trim();
  const deploymentTarget = String(manifest?.deployment?.target || '').trim();
  const required = ['saas-completo', 'docente-local'];
  const missing = required.filter((flavorId) => !flavors.some((item) => String(item?.flavorId || '') === flavorId));

  if (missing.length > 0) {
    throw new Error(`Manifest multi-flavor incompleto: ${missing.join(', ')}`);
  }
  if (!buildVersion || !buildCommit || !deploymentTarget) {
    throw new Error('Manifest release incompleto: faltan build.version, build.commit o deployment.target');
  }
  if (expectedVersion && buildVersion !== expectedVersion) {
    throw new Error(`Manifest release version invalida: build.version=${buildVersion}, esperado=${expectedVersion}`);
  }
  if (expectedVersion && topLevelVersion && topLevelVersion !== expectedVersion) {
    throw new Error(`Manifest release version invalida: version=${topLevelVersion}, esperado=${expectedVersion}`);
  }
  if (artifacts.length === 0) {
    throw new Error('Manifest release incompleto: falta catalogo de artifacts');
  }
  const incompleteArtifacts = artifacts
    .filter((artifact) => !String(artifact?.name || '').trim() || !String(artifact?.path || '').trim() || !String(artifact?.sha256 || '').trim())
    .map((artifact) => String(artifact?.name || '<sin-nombre>'));
  if (incompleteArtifacts.length > 0) {
    throw new Error(`Manifest release contiene artefactos sin path o sha256: ${incompleteArtifacts.join(', ')}`);
  }
  const unsignedArtifacts = artifacts
    .filter((artifact) => artifact?.signed !== true)
    .map((artifact) => String(artifact?.name || '<sin-nombre>'));
  if (unsignedArtifacts.length > 0) {
    throw new Error(`Manifest release contiene artefactos sin firma: ${unsignedArtifacts.join(', ')}`);
  }
  if (expectedVersion) {
    const expectedToken = `-v${expectedVersion}.exe`;
    const staleInstallerArtifacts = artifacts
      .filter((artifact) => /^EvaluaPro-InstallerHub-.+\.exe$/i.test(String(artifact?.name || '').trim()))
      .filter((artifact) => !String(artifact?.name || '').trim().endsWith(expectedToken))
      .map((artifact) => String(artifact?.name || '<sin-nombre>'));
    if (staleInstallerArtifacts.length > 0) {
      throw new Error(`Manifest release contiene artefactos Installer Hub de otra version: ${staleInstallerArtifacts.join(', ')}, esperado *${expectedToken}`);
    }
  }

  for (const flavor of flavors) {
    const flavorId = String(flavor?.flavorId || '').trim();
    const bundleName = String(flavor?.assetName || '').trim();
    const msiName = String(flavor?.msiName || '').trim();
    const installerHubName = String(flavor?.installerHubName || '').trim();
    const installerHubVersionedName = String(flavor?.installerHubVersionedName || '').trim();
    if (!flavorId || !bundleName || !msiName || !installerHubName) {
      throw new Error(`Manifest release incompleto para flavor ${flavorId || '<sin-id>'}`);
    }
    if (expectedVersion) {
      const expectedToken = `-v${expectedVersion}.exe`;
      for (const [label, value] of Object.entries({ assetName: bundleName, installerHubName, installerHubVersionedName })) {
        if (value && !value.endsWith(expectedToken)) {
          throw new Error(`Manifest release contiene ${label} invalido para ${flavorId}: ${value}, esperado *${expectedToken}`);
        }
      }
    }
  }

  return manifestPath;
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
    if (options.version) {
      const evidenceManifestPath = path.join(options.evidenceDir, 'manifest.json');
      const evidenceManifest = JSON.parse(readJsonFile(evidenceManifestPath));
      const evidenceVersion = String(evidenceManifest?.version || '').trim();
      if (evidenceVersion !== options.version) {
        throw new Error(`manifest.json: version no coincide con objetivo stable. version=${evidenceVersion || 'invalida'}, esperado=${options.version}`);
      }
    }
    checks.push({ id: 'release-evidence', ok: true, detail: options.evidenceDir });
  } catch (error) {
    checks.push({ id: 'release-evidence', ok: false, detail: String(error?.message || error) });
  }

  try {
    const qaManifestPath = validateAutomatedQaEvidence(options.qaManifestPath);
    checks.push({ id: 'automated-qa-evidence', ok: true, detail: qaManifestPath });
  } catch (error) {
    checks.push({ id: 'automated-qa-evidence', ok: false, detail: String(error?.message || error) });
  }

  try {
    const manifestPath = validateInstallerReleaseManifest(options.installerManifestPath, options.version || '');
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
    version,
    requiredStreak,
    runs,
    evidenceDir,
    prodFlowResult,
    installerManifestPath: getArg('installer-manifest', ''),
    qaManifestPath: getArg('qa-manifest', process.env.RELEASE_GATE_QA_MANIFEST || '')
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
