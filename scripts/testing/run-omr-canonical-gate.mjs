#!/usr/bin/env node
/**
 * run-omr-canonical-gate
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-omr-canonical-gate
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-omr-canonical-gate
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CANONICAL_GATE_CONFIG = {
  gate: 'omr-canonical-pilot-real',
  datasetManifest: 'omr_samples_tv4_pilot_real/manifest.json',
  wrapperReport: 'reports/qa/latest/omr-canonical-gate-wrapper.json',
  command: 'npm -C apps/backend run omr:validate:pilot-real'
};

function parseArgs(argv) {
  const values = {
    dryRun: false
  };

  for (const arg of argv) {
    if (arg === '--dry-run') values.dryRun = true;
  }

  return values;
}

function resolveConfig() {
  return { ...CANONICAL_GATE_CONFIG };
}

async function ensureDatasetManifestExists(relativePath) {
  const absolute = path.resolve(process.cwd(), relativePath);
  await fs.access(absolute);
  return absolute;
}

async function readDatasetManifest(absolutePath) {
  const raw = await fs.readFile(absolutePath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('El manifest del piloto OMR debe ser un objeto JSON.');
  }
  return manifest;
}

function tieneCapturasPiloto(manifest) {
  return Array.isArray(manifest.capturas) && manifest.capturas.length > 0;
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

export { resolveConfig, tieneCapturasPiloto };

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const resolved = resolveConfig();
  const datasetManifestPath = await ensureDatasetManifestExists(resolved.datasetManifest);
  const manifest = await readDatasetManifest(datasetManifestPath);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({
      gate: resolved.gate,
      datasetManifest: resolved.datasetManifest,
      datasetManifestPath,
      wrapperReport: resolved.wrapperReport,
      command: resolved.command,
      captureCount: Array.isArray(manifest.capturas) ? manifest.capturas.length : null
    }, null, 2)}\n`);
    return;
  }

  if (!tieneCapturasPiloto(manifest)) {
    const now = new Date().toISOString();
    await writeReport(resolved.wrapperReport, {
      version: '1',
      gate: resolved.gate,
      datasetManifest: resolved.datasetManifest,
      datasetManifestPath,
      command: resolved.command,
      ok: true,
      status: 'not_applicable',
      validated: false,
      reason: 'dataset_vacio',
      captureCount: 0,
      startedAt: now,
      finishedAt: now,
      durationMs: 0
    });
    process.stdout.write(`[omr-canonical-gate] SKIP (dataset vacio; no validacion real) -> ${resolved.wrapperReport}\n`);
    return;
  }

  const started = new Date();
  const result = await runCommand(resolved.command);
  const finished = new Date();
  const payload = {
    version: '1',
    gate: resolved.gate,
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
    process.stderr.write(`[omr-canonical-gate] FAIL -> ${resolved.wrapperReport}\n`);
    process.exit(result.code);
  }

  process.stdout.write(`[omr-canonical-gate] OK -> ${resolved.wrapperReport}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[omr-canonical-gate] ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
