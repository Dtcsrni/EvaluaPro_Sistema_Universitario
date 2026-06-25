import test from 'node:test';
import assert from 'node:assert/strict';
import { toTestArgs } from '../testing/run-backend-test-batches.mjs';

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
    '--pool=threads',
    '--reporter=default'
  ]);
});
