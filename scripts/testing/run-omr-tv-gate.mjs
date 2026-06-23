#!/usr/bin/env node
/**
 * run-omr-tv-gate
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TV_GATE_CONFIG = {
  tv3: {
    gate: 'omr-tv-por-folio',
    datasetManifest: 'omr_samples_tv3_real_por_folio/manifest.json',
    wrapperReport: 'reports/qa/latest/omr-tv-gate-wrapper.json',
    command: 'npm -C apps/backend run omr:tv3:validate:por-folio -- --dataset ../../omr_samples_tv3_real_por_folio --report ../../reports/qa/latest/omr/tv3-por-folio-validation.ci.json --failure-report ../../reports/qa/latest/omr/tv3-por-folio-failures.ci.json'
  },
  tv4: {
    gate: 'omr-tv-pilot-real',
    datasetManifest: 'omr_samples_tv4_pilot_real/manifest.json',
    wrapperReport: 'reports/qa/latest/omr-tv-gate-wrapper.json',
    command: 'npm -C apps/backend run omr:tv4:validate:pilot-real -- --dataset ../../omr_samples_tv4_pilot_real --report ../../reports/qa/latest/omr/tv4-pilot-real-validation.ci.json --failure-report ../../reports/qa/latest/omr/tv4-pilot-real-failures.ci.json'
  }
};

function parseArgs(argv) {
  const values = {
    version: process.env.OMR_TV_GATE_VERSION || 'tv3',
    dryRun: false
  };

  for (const arg of argv) {
    if (arg.startsWith('--version=')) values.version = arg.slice('--version='.length).trim();
    if (arg === '--dry-run') values.dryRun = true;
  }

  return values;
}

function resolveConfig(versionInput) {
  const version = String(versionInput || '').trim().toLowerCase();
  const selected = TV_GATE_CONFIG[version];
  if (!selected) {
    const supported = Object.keys(TV_GATE_CONFIG).sort().join(', ');
    throw new Error(`Version OMR TV no soportada: ${version || '<vacia>'}. Soportadas: ${supported}`);
  }

  return {
    version,
    gate: selected.gate,
    datasetManifest: selected.datasetManifest,
    wrapperReport: selected.wrapperReport,
    command: selected.command
  };
}

async function ensureDatasetManifestExists(relativePath) {
  const absolute = path.resolve(process.cwd(), relativePath);
  await fs.access(absolute);
  return absolute;
}

async function writeReport(reportPath, payload) {
  const absolute = path.resolve(process.cwd(), reportPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code, signal) => {
      resolve({ code: typeof code === 'number' ? code : 1, signal: signal ?? null });
    });

    child.on('error', () => {
      resolve({ code: 1, signal: null });
    });
  });
}

export { resolveConfig };

async function main() {
  const { version, dryRun } = parseArgs(process.argv.slice(2));
  const resolved = resolveConfig(version);
  const datasetManifestPath = await ensureDatasetManifestExists(resolved.datasetManifest);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({
      version: resolved.version,
      gate: resolved.gate,
      datasetManifest: resolved.datasetManifest,
      datasetManifestPath,
      wrapperReport: resolved.wrapperReport,
      command: resolved.command
    }, null, 2)}\n`);
    return;
  }

  const started = new Date();
  const result = await runCommand(resolved.command);
  const finished = new Date();
  const payload = {
    version: '1',
    gate: resolved.gate,
    tvVersion: resolved.version,
    datasetManifest: resolved.datasetManifest,
    datasetManifestPath,
    command: resolved.command,
    ok: result.code === 0,
    exitCode: result.code,
    signal: result.signal,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime()
  };

  await writeReport(resolved.wrapperReport, payload);

  if (result.code !== 0) {
    process.stderr.write(`[omr-tv-gate] FAIL ${resolved.version} -> ${resolved.wrapperReport}\n`);
    process.exit(result.code);
  }

  process.stdout.write(`[omr-tv-gate] OK ${resolved.version} -> ${resolved.wrapperReport}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[omr-tv-gate] ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
