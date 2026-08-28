#!/usr/bin/env node
/**
 * run-backend-test-batches
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-backend-test-batches
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * run-backend-test-batches
 *
 * Responsabilidad: Ejecutar la suite backend por lotes para evitar crashes de
 * workers en Windows sin reducir la seleccion de pruebas.
 * Limites: No cambia assertions ni filtros funcionales; solo particiona la ejecucion.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCoveragePlan } from './run-backend-coverage-batches.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const backendDir = path.join(rootDir, 'apps', 'backend');
const vitestEntry = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs');
const batchAttempts = 3;

function toTestArgs(batch) {
  const args = Array.isArray(batch?.args) ? batch.args : [];
  const filters = [];
  for (const arg of args.slice(2)) {
    if (String(arg).startsWith('--coverage')) continue;
    if (String(arg).startsWith('--reporter=')) continue;
    if (String(arg).startsWith('--outputFile.')) continue;
    filters.push(arg);
  }
  return ['run', ...filters, '--pool=forks', '--reporter=default'];
}

function runVitest(args, name) {
  return new Promise((resolve) => {
    process.stdout.write(`[backend-tests] ${name}\n`);
    const child = spawn(process.execPath, [vitestEntry, ...args], {
      cwd: backendDir,
      env: process.env,
      stdio: 'inherit'
    });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(typeof code === 'number' ? code : 1));
  });
}

async function runBatch(batch) {
  const args = toTestArgs(batch);
  for (let attempt = 1; attempt <= batchAttempts; attempt += 1) {
    const code = await runVitest(args, `${batch.name} ${attempt}/${batchAttempts}`);
    if (code === 0) return 0;
    if (attempt < batchAttempts) {
      process.stderr.write(`[backend-tests] retry ${batch.name} tras exit ${code}\n`);
    }
  }
  return 1;
}

async function main() {
  const plan = buildCoveragePlan();
  for (const batch of plan.batches) {
    const code = await runBatch(batch);
    if (code !== 0) process.exit(code);
  }
  process.exit(0);
}

export { toTestArgs };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[backend-tests] ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
