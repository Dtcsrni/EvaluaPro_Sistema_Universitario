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

  assert.deepEqual(
    plan.batches.map((batch) => batch.name),
    [
      'backend-root',
      'backend-calificacion-omr-payload',
      'backend-integracion-a-m-01',
      'backend-integracion-a-m-02',
      'backend-integracion-a-m-03',
      'backend-integracion-a-m-04',
      'backend-integracion-a-m-05',
      'backend-integracion-n-z-01',
      'backend-integracion-n-z-02',
      'backend-integracion-n-z-03',
      'backend-integracion-n-z-04',
      'backend-aislamiento'
    ]
  );
  assert.equal(plan.batches[0].args.includes('tests/integracion/**'), true);
  assert.equal(plan.batches[0].args.includes('tests/calificacion.omr.payload.test.ts'), true);
  assert.equal(plan.batches[1].args.includes('tests/calificacion.omr.payload.test.ts'), true);
  assert.equal(plan.batches[2].args.includes('tests/integracion/classroom.pull.test.ts'), false);
  assert.equal(plan.batches[4].args.includes('tests/integracion/classroom.pull.test.ts'), true);
  assert.equal(plan.batches[7].args.includes('tests/integracion/flujoDocenteGlobalE2E.test.ts'), true);
  assert.equal(plan.batches[9].args.includes('tests/integracion/qrEscaneoOmr.test.ts'), true);
  assert.equal(plan.batches[11].args.includes('tests/integracion/aislamientoDocente.test.ts'), true);
});

test('cobertura backend conserva umbrales solo en el merge final', () => {
  const plan = buildCoveragePlan();
  const batchArgs = plan.batches.flatMap((batch) => batch.args);

  assert.equal(batchArgs.includes('--coverage.thresholds.lines=0'), true);
  assert.equal(plan.merge.args.some((arg) => arg.startsWith('--coverage.thresholds.')), false);
  assert.equal(plan.merge.args.includes('--coverage'), true);
});
