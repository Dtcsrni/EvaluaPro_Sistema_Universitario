import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoveragePlan } from '../testing/run-backend-coverage-batches.mjs';

test('suites OMR costosas en cobertura corren aisladas con plazo suficiente', () => {
  const batches = buildCoveragePlan().batches;
  const expectedTimeouts = new Map([
    ['tests/omr.test.ts', 12 * 60 * 1000],
    ['tests/omr.geometry.reference.test.ts', 5 * 60 * 1000],
    ['tests/omr.tv4.synthetic.metrics.test.ts', 12 * 60 * 1000]
  ]);

  for (const [file, timeoutMs] of expectedTimeouts) {
    const batch = batches.find(({ args }) => args.includes(file));
    assert.ok(batch, `falta el lote de cobertura para ${file}`);
    assert.equal(batch.exclusive, true, `${file} debe esperar a que terminen los workers paralelos`);
    assert.equal(batch.timeoutMs, timeoutMs, `${file} debe conservar un timeout con margen medido`);
  }
});
