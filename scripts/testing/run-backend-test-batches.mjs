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
const defaultBatchConcurrency = 2;
const maximumBatchConcurrency = 4;

function resolveBatchConcurrency(value, fallback = defaultBatchConcurrency) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximumBatchConcurrency) {
    throw new RangeError(`BACKEND_TEST_BATCH_CONCURRENCY debe ser un entero entre 1 y ${maximumBatchConcurrency}`);
  }
  return parsed;
}

const batchConcurrency = resolveBatchConcurrency(process.env.BACKEND_TEST_BATCH_CONCURRENCY);

function toTestArgs(batch) {
  const args = Array.isArray(batch?.args) ? batch.args : [];
  const filters = [];
  for (const arg of args.slice(2)) {
    if (String(arg).startsWith('--coverage')) continue;
    if (String(arg).startsWith('--pool=')) continue;
    if (String(arg).startsWith('--reporter=')) continue;
    if (String(arg).startsWith('--outputFile.')) continue;
    filters.push(arg);
  }
  // `forks` aísla mejor los módulos nativos en Windows. El E2E de dos
  // equipos ya crea sus procesos independientes y no necesita compartir
  // workers de Vitest mediante `threads`.
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

async function runBatches(batches, concurrency, executeBatch = runBatch) {
  let nextIndex = 0;
  let failureCode = 0;
  const worker = async () => {
    while (failureCode === 0) {
      const batch = batches[nextIndex++];
      if (!batch) return;
      const code = await executeBatch(batch);
      if (code !== 0) failureCode = code;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()));
  return failureCode;
}

async function main() {
  const plan = buildCoveragePlan();
  process.stdout.write(`[backend-tests] concurrencia=${batchConcurrency}; lotes=${plan.batches.length}\n`);
  const code = await runBatches(plan.batches, batchConcurrency);
  process.exit(code);
}

export { resolveBatchConcurrency, runBatches, toTestArgs };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[backend-tests] ERROR: ${String(error?.message || error)}\n`);
    process.exit(1);
  });
}
