/** Contratos del benchmark de concurrencia backend; no inicia Vitest real. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import {
  buildConcurrencySchedule,
  buildIsolatedBatchArgs,
  median,
  parseBenchmarkArgs,
  runConcurrentRound,
  summarizeRounds
} from '../testing/benchmark-backend-concurrency.mjs';

const names = ['backend-root-01', 'backend-root-02', 'backend-pdf'];

test('benchmark exige lotes conocidos y concurrencia explícita dentro del límite', () => {
  assert.deepEqual(parseBenchmarkArgs(
    ['--batches=backend-root-01,backend-pdf', '--concurrency=2,3', '--repeats=2'], names
  ), {
    batchNames: ['backend-root-01', 'backend-pdf'],
    concurrencyLevels: [2, 3],
    repeats: 2
  });
  assert.throws(() => parseBenchmarkArgs(['--concurrency=2'], names), /--batches/);
  assert.throws(() => parseBenchmarkArgs(['--batches=unknown', '--concurrency=2'], names), /Lotes desconocidos/);
  assert.throws(() => parseBenchmarkArgs(['--batches=backend-root-01', '--concurrency=5'], names), /entre 1 y 4/);
  assert.throws(() => parseBenchmarkArgs(['--batches=backend-root-01', '--concurrency=2', '--repeats=0'], names), /repeats/);
});

test('benchmark alterna el orden de niveles para compensar calentamiento y deriva temporal', () => {
  assert.deepEqual(buildConcurrencySchedule([2, 3], 2), [
    { concurrency: 2, repetition: 1 },
    { concurrency: 3, repetition: 1 },
    { concurrency: 3, repetition: 2 },
    { concurrency: 2, repetition: 2 }
  ]);
  assert.throws(() => buildConcurrencySchedule([5], 1), /entre 1 y 4/);
});

test('cada lote usa destinos de cobertura y blob aislados por ronda', () => {
  const batch = {
    name: 'backend-root-01',
    args: [
      'vitest', 'run', '--coverage', 'tests/a.test.ts',
      '--outputFile.blob=.vitest-reports/coverage/root.blob.json',
      '--coverage.reportsDirectory=coverage/root'
    ]
  };
  const argsA = buildIsolatedBatchArgs(batch, 'run-a');
  const argsB = buildIsolatedBatchArgs(batch, 'run-b');
  assert.notEqual(argsA.find((arg) => arg.startsWith('--outputFile.blob=')), argsB.find((arg) => arg.startsWith('--outputFile.blob=')));
  assert.notEqual(argsA.find((arg) => arg.startsWith('--coverage.reportsDirectory=')), argsB.find((arg) => arg.startsWith('--coverage.reportsDirectory=')));
  assert.equal(argsA.includes('tests/a.test.ts'), true);
  assert.equal(argsA.includes('--coverage'), true);
});

test('ronda ejecuta todos los lotes con límite paralelo y conserva fallos sin reintentar', async () => {
  let active = 0;
  let maximumActive = 0;
  const calls = [];
  const batches = ['ok-a', 'error', 'ok-b', 'ok-c'].map((name) => ({ name }));
  const round = await runConcurrentRound(batches, 2, async ({ name }) => {
    calls.push(name);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await delay(3);
    active -= 1;
    if (name === 'error') throw new Error('fallo deliberado');
    return 0;
  });
  assert.equal(maximumActive, 2);
  assert.equal(calls.length, batches.length);
  assert.equal(round.passed, false);
  assert.deepEqual(round.results.map(({ exitCode }) => exitCode), [0, 1, 0, 0]);
  assert.equal(round.results.every(({ durationMs }) => durationMs >= 0), true);
});

test('resumen compara medianas, duración por lote y estado correcto', () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([10, 20]), 15);
  const summary = summarizeRounds([
    { concurrency: 2, durationMs: 100, passed: true, results: [{ name: 'a', durationMs: 60 }] },
    { concurrency: 2, durationMs: 120, passed: false, results: [{ name: 'a', durationMs: 80 }] },
    { concurrency: 3, durationMs: 90, passed: true, results: [{ name: 'a', durationMs: 50 }] }
  ]);
  assert.deepEqual(summary, [
    { concurrency: 2, rounds: 2, allPassed: false, medianDurationMs: 110, medianBatchDurationMs: { a: 70 } },
    { concurrency: 3, rounds: 1, allPassed: true, medianDurationMs: 90, medianBatchDurationMs: { a: 50 } }
  ]);
});
