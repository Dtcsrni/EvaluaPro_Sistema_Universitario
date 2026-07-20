/**
 * backend-coverage-batches.test
 *
 * Responsabilidad: Proteger el contrato de lotes de cobertura backend.
 * Limites: Validar plan de ejecucion sin disparar la suite pesada de Vitest.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCoveragePlan } from '../testing/run-backend-coverage-batches.mjs';

test('cobertura backend separa el lote pesado de aislamiento docente', () => {
  const plan = buildCoveragePlan();

  const payloadIndex = plan.batches.findIndex((batch) => batch.name === 'backend-calificacion-omr-payload');
  assert.ok(payloadIndex > 0);
  assert.equal(plan.batches.slice(0, payloadIndex).every((batch) => batch.name.startsWith('backend-root-')), true);
  assert.equal(plan.batches[payloadIndex].args.includes('tests/calificacion.omr.payload.test.ts'), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/classroom.pull.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/flujoDocenteGlobalE2E.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/qrEscaneoOmr.test.ts')), true);
  assert.equal(plan.batches.some((batch) => batch.args.includes('tests/integracion/aislamientoDocente.test.ts')), true);
});

test('cobertura backend conserva umbrales solo en el merge final', () => {
  const plan = buildCoveragePlan();
  const batchArgs = plan.batches.flatMap((batch) => batch.args);

  assert.equal(batchArgs.includes('--coverage.thresholds.lines=0'), true);
  assert.equal(plan.merge.args.some((arg) => arg.startsWith('--coverage.thresholds.')), false);
  assert.equal(plan.merge.args.includes('--coverage'), true);
});
