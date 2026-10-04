#!/usr/bin/env node
/**
 * Benchmark reproducible de concurrencia para lotes de cobertura backend.
 * Ejecuta cada lote una vez por ronda; no fusiona la cobertura parcial.
 */
import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCoveragePlan } from './run-backend-coverage-batches.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const backendDir = path.join(rootDir, 'apps', 'backend');
const reportsRootDir = path.join(backendDir, '.vitest-reports', 'backend-concurrency-benchmarks');
const vitestEntry = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs');
const maxConcurrency = 4;

function parseBenchmarkArgs(argv, availableBatchNames) {
  const parsed = Object.fromEntries(argv.map((arg) => {
    const match = /^--(batches|concurrency|repeats)=(.*)$/.exec(arg);
    if (!match) throw new Error(`Argumento no reconocido: ${arg}`);
    return [match[1], match[2]];
  }));
  if (!parsed.batches || !parsed.concurrency) {
    throw new Error('Uso: --batches=lote-a,lote-b --concurrency=2,3 [--repeats=2]');
  }
  const batchNames = [...new Set(parsed.batches.split(',').map((value) => value.trim()).filter(Boolean))];
  if (!batchNames.length) throw new Error('--batches debe incluir al menos un lote.');
  const unknownBatches = batchNames.filter((name) => !availableBatchNames.includes(name));
  if (unknownBatches.length) throw new Error(`Lotes desconocidos: ${unknownBatches.join(', ')}`);
  const concurrencyLevels = [...new Set(parsed.concurrency.split(',').map(Number))];
  if (!concurrencyLevels.length || concurrencyLevels.some((value) => !Number.isInteger(value) || value < 1 || value > maxConcurrency)) {
    throw new RangeError(`--concurrency acepta enteros entre 1 y ${maxConcurrency}.`);
  }
  const repeats = parsed.repeats === undefined ? 2 : Number(parsed.repeats);
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) {
    throw new RangeError('--repeats debe ser un entero entre 1 y 5.');
  }
  return { batchNames, concurrencyLevels, repeats };
}

function buildConcurrencySchedule(concurrencyLevels, repeats) {
  if (!Array.isArray(concurrencyLevels) || concurrencyLevels.length === 0) {
    throw new TypeError('Se requiere al menos un nivel de concurrencia.');
  }
  if (concurrencyLevels.some((value) => !Number.isInteger(value) || value < 1 || value > maxConcurrency)) {
    throw new RangeError(`Los niveles de concurrencia deben estar entre 1 y ${maxConcurrency}.`);
  }
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) {
    throw new RangeError('repeats debe ser un entero entre 1 y 5.');
  }
  return Array.from({ length: repeats }, (_, index) => {
    const round = index % 2 === 0 ? concurrencyLevels : [...concurrencyLevels].reverse();
    return round.map((concurrency) => ({ concurrency, repetition: index + 1 }));
  }).flat();
}

function buildIsolatedBatchArgs(batch, runDirectory) {
  const blobPath = path.join(runDirectory, `${batch.name}.blob.json`);
  const coverageDirectory = path.join(runDirectory, 'coverage', batch.name);
  return batch.args.slice(1).map((argument) => {
    if (argument.startsWith('--outputFile.blob=')) return `--outputFile.blob=${blobPath}`;
    if (argument.startsWith('--coverage.reportsDirectory=')) return `--coverage.reportsDirectory=${coverageDirectory}`;
    return argument;
  });
}

function runConcurrentRound(batches, concurrency, executeBatch) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > maxConcurrency) {
    throw new RangeError(`concurrency debe ser un entero entre 1 y ${maxConcurrency}.`);
  }
  let nextIndex = 0;
  const results = new Array(batches.length);
  const startedAt = performance.now();
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      const batch = batches[index];
      if (!batch) return;
      const startedBatchAt = performance.now();
      let exitCode = 1;
      try {
        exitCode = await executeBatch(batch);
      } catch {
        // El fallo queda explícito en el resultado; no se reintenta ni aborta
        // lotes hermanos, para que la ronda siga siendo comparable.
      }
      results[index] = { name: batch.name, exitCode, durationMs: Math.round(performance.now() - startedBatchAt) };
    }
  };
  return Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()))
    .then(() => ({ concurrency, durationMs: Math.round(performance.now() - startedAt), passed: results.every(({ exitCode }) => exitCode === 0), results }));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function summarizeRounds(rounds) {
  const levels = [...new Set(rounds.map(({ concurrency }) => concurrency))].sort((a, b) => a - b);
  return levels.map((concurrency) => {
    const selected = rounds.filter((round) => round.concurrency === concurrency);
    return {
      concurrency,
      rounds: selected.length,
      allPassed: selected.every(({ passed }) => passed),
      medianDurationMs: median(selected.map(({ durationMs }) => durationMs)),
      medianBatchDurationMs: Object.fromEntries(
        [...new Set(selected.flatMap(({ results }) => results.map(({ name }) => name)))].map((name) => [
          name,
          median(selected.flatMap(({ results }) => results.filter((result) => result.name === name).map(({ durationMs }) => durationMs)))
        ])
      )
    };
  });
}

function runVitestBatch(batch, runDirectory, timeoutMs) {
  return new Promise((resolve) => {
    const args = buildIsolatedBatchArgs(batch, runDirectory);
    const logPath = path.join(runDirectory, `${batch.name}.log`);
    const logFd = openSync(logPath, 'w');
    const child = spawn(process.execPath, [vitestEntry, ...args], {
      cwd: backendDir,
      env: process.env,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true
    });
    let finalized = false;
    const finish = (exitCode) => {
      if (finalized) return;
      finalized = true;
      clearTimeout(timeout);
      closeSync(logFd);
      resolve(exitCode);
    };
    const timeout = setTimeout(() => {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
      finish(124);
    }, timeoutMs);
    child.on('error', () => finish(1));
    child.on('close', (code) => finish(typeof code === 'number' ? code : 1));
  });
}

async function main() {
  const plan = buildCoveragePlan();
  const options = parseBenchmarkArgs(process.argv.slice(2), plan.batches.map(({ name }) => name));
  const batchByName = new Map(plan.batches.map((batch) => [batch.name, batch]));
  const batches = options.batchNames.map((name) => batchByName.get(name));
  const schedule = buildConcurrencySchedule(options.concurrencyLevels, options.repeats);
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`;
  const benchmarkDir = path.join(reportsRootDir, runId);
  const timeoutMs = Number(process.env.BACKEND_COVERAGE_BATCH_TIMEOUT_MS || 8 * 60 * 1000);
  await fs.mkdir(benchmarkDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const rounds = [];

  for (let index = 0; index < schedule.length; index += 1) {
    const { concurrency, repetition } = schedule[index];
    const runDirectory = path.join(benchmarkDir, `round-${String(index + 1).padStart(2, '0')}-c${concurrency}-r${repetition}`);
    await fs.mkdir(runDirectory, { recursive: true });
    process.stdout.write(`[backend-benchmark] ronda=${index + 1}/${schedule.length}; concurrencia=${concurrency}; lotes=${batches.length}\n`);
    const result = await runConcurrentRound(batches, concurrency, (batch) => runVitestBatch(batch, runDirectory, timeoutMs));
    rounds.push({ ...result, repetition });
    await fs.writeFile(path.join(benchmarkDir, 'benchmark.json'), JSON.stringify({
      startedAt,
      updatedAt: new Date().toISOString(),
      selection: options.batchNames,
      schedule,
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        logicalCpus: os.availableParallelism?.() ?? os.cpus().length,
        totalMemoryBytes: os.totalmem(),
        freeMemoryBytesAtStart: os.freemem()
      },
      rounds,
      summary: summarizeRounds(rounds),
      recommendation: null
    }, null, 2));
  }
  process.stdout.write(`[backend-benchmark] informe=${path.join(benchmarkDir, 'benchmark.json')}\n`);
  for (const summary of summarizeRounds(rounds)) {
    process.stdout.write(
      `[backend-benchmark] concurrencia=${summary.concurrency}; mediana=${summary.medianDurationMs} ms; `
      + `rondas=${summary.rounds}; todasPasaron=${summary.allPassed}\n`
    );
  }
  if (rounds.some(({ passed }) => !passed)) process.exitCode = 1;
}

export {
  buildConcurrencySchedule,
  buildIsolatedBatchArgs,
  median,
  parseBenchmarkArgs,
  runConcurrentRound,
  summarizeRounds
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`[backend-benchmark] ERROR: ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}
