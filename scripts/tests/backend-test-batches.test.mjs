/**
 * backend-test-batches.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { buildChangedTestArgs, resolveBatchConcurrency, runBatches, toTestArgs } from '../testing/run-backend-test-batches.mjs';
import {
  getDefaultBatchConcurrency as getCoverageDefaultConcurrency,
  resolveBatchConcurrency as resolveCoverageConcurrency,
  runBatches as runCoverageBatches
} from '../testing/run-backend-coverage-batches.mjs';

test('backend test batches valida concurrencia acotada para runners reproducibles', () => {
  assert.equal(resolveBatchConcurrency(undefined), 2);
  assert.equal(resolveBatchConcurrency('1'), 1);
  assert.equal(resolveBatchConcurrency('4'), 4);
  assert.throws(() => resolveBatchConcurrency('0'), /entero entre 1 y 4/);
  assert.throws(() => resolveBatchConcurrency('5'), /entero entre 1 y 4/);
  assert.throws(() => resolveBatchConcurrency('auto'), /entero entre 1 y 4/);
});

test('coverage batches permite concurrencia acotada y predeterminada reproducible', async () => {
  assert.equal(getCoverageDefaultConcurrency({ totalMemoryBytes: 16 * 1024 ** 3, logicalCpus: 8 }), 3);
  assert.equal(getCoverageDefaultConcurrency({ totalMemoryBytes: 8 * 1024 ** 3, logicalCpus: 8 }), 2);
  assert.equal(getCoverageDefaultConcurrency({ totalMemoryBytes: 16 * 1024 ** 3, logicalCpus: 2 }), 2);
  assert.equal(resolveCoverageConcurrency(undefined), getCoverageDefaultConcurrency({
    totalMemoryBytes: os.totalmem(),
    logicalCpus: os.availableParallelism?.() ?? os.cpus().length
  }));
  assert.equal(resolveCoverageConcurrency('1'), 1);
  assert.equal(resolveCoverageConcurrency('4'), 4);
  assert.throws(() => resolveCoverageConcurrency('0'), /entero entre 1 y 4/);
  assert.throws(() => resolveCoverageConcurrency('5'), /entero entre 1 y 4/);
  assert.throws(() => resolveCoverageConcurrency('auto'), /entero entre 1 y 4/);
  await assert.rejects(runCoverageBatches([], 0), /entero entre 1 y 4/);
});

test('coverage batches repone dinámicamente el worker libre y registra duraciones', async () => {
  const started = [];
  const beforeSlowCompletes = [];
  let slowFinished = false;
  const batches = ['slow', 'short-a', 'short-b', 'short-c'].map((name) => ({ name }));
  const result = await runCoverageBatches(batches, 2, async ({ name }) => {
    started.push(name);
    if (name !== 'slow' && !slowFinished) beforeSlowCompletes.push(name);
    await delay(name === 'slow' ? 30 : 2);
    if (name === 'slow') slowFinished = true;
    return 0;
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(started.slice(0, 2), ['slow', 'short-a']);
  assert.deepEqual(beforeSlowCompletes, ['short-a', 'short-b', 'short-c']);
  assert.equal(started.length, 4);
  assert.deepEqual(result.results.map(({ name }) => name), ['slow', 'short-a', 'short-b', 'short-c']);
  assert.ok(result.results.every(({ durationMs }) => durationMs >= 0));
});

test('coverage batches deja de asignar lotes nuevos tras un fallo', async () => {
  const started = [];
  const result = await runCoverageBatches(
    ['failure', 'in-flight', 'not-started'].map((name) => ({ name })),
    2,
    async ({ name }) => {
      started.push(name);
      await delay(name === 'failure' ? 1 : 10);
      return name === 'failure' ? 9 : 0;
    }
  );

  assert.equal(result.exitCode, 9);
  assert.deepEqual(started, ['failure', 'in-flight']);
  assert.equal(result.results.length, 2);
});

test('backend test batches procesa en paralelo con el límite indicado y para despachos al fallar', async () => {
  let active = 0;
  let peak = 0;
  const started = [];
  const batches = ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name }));
  const code = await runBatches(batches, 2, async ({ name }) => {
    started.push(name);
    active += 1;
    peak = Math.max(peak, active);
    await delay(name === 'b' ? 10 : 0);
    active -= 1;
    return name === 'a' ? 7 : 0;
  });

  assert.equal(code, 7);
  assert.equal(peak, 2);
  assert.equal(started.length, 2);
});

test('backend test batches conserva filtros y elimina flags de coverage', () => {
  const args = toTestArgs({
    name: 'backend-root',
    args: [
      'vitest',
      'run',
      '--coverage',
      '--exclude',
      'tests/integracion/**',
      '--reporter=blob',
      '--outputFile.blob=.vitest-reports/backend-coverage-batches/backend-root.blob.json',
      '--coverage.thresholds.lines=0',
      'tests/unitario.test.ts'
    ]
  });

  assert.deepEqual(args, [
    'run',
    '--exclude',
    'tests/integracion/**',
    'tests/unitario.test.ts',
    '--pool=forks',
    '--reporter=default'
  ]);
});

test('backend test batches aísla sincronización E2E en forks sobre Windows', () => {
  const args = toTestArgs({
    name: 'backend-sync',
    args: [
      'vitest',
      'run',
      'tests/sincronizacion.dos-equipos.e2e.test.ts',
      '--pool=threads',
      '--reporter=blob'
    ]
  });

  assert.deepEqual(args, [
    'run',
    'tests/sincronizacion.dos-equipos.e2e.test.ts',
    '--pool=forks',
    '--reporter=default'
  ]);
});

test('backend changed test selection validates the ref and avoids coverage instrumentation', () => {
  assert.deepEqual(buildChangedTestArgs('origin/main'), ['run', '--changed=origin/main', '--pool=forks', '--reporter=default']);
  assert.deepEqual(buildChangedTestArgs('0123456789abcdef'), ['run', '--changed=0123456789abcdef', '--pool=forks', '--reporter=default']);
  assert.throws(() => buildChangedTestArgs('--inject'), /referencia Git válida/);
  assert.throws(() => buildChangedTestArgs('origin/../main'), /referencia Git válida/);
});
