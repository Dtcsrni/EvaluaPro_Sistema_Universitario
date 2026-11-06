/**
 * omr-canonical-gate-runner.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarDatasetPiloto, resolveConfig, tieneCapturasPiloto } from '../testing/run-omr-canonical-gate.mjs';

test('runner OMR resuelve la única plantilla canónica', () => {
  const resolved = resolveConfig();
  assert.equal(resolved.gate, 'omr-canonical-pilot-real');
  assert.match(resolved.datasetManifest, /omr_samples_tv4_pilot_real\/manifest\.json/);
  assert.match(resolved.wrapperReport, /omr-canonical-gate-wrapper\.json/);
assert.match(resolved.command, /omr:validate:pilot-real/);
assert.equal(tieneCapturasPiloto({ capturas: [] }), false);
assert.equal(tieneCapturasPiloto({ capturas: [{ captureId: 'pilot-001' }] }), true);

test('el piloto real vacío bloquea la liberación en lugar de producir un falso pase', () => {
  assert.deepEqual(clasificarDatasetPiloto({ capturas: [] }), {
    allowed: false,
    status: 'not_applicable',
    reason: 'dataset_vacio',
    captureCount: 0
  });
});

test('el piloto con capturas se valida en el comando canónico', () => {
  assert.deepEqual(clasificarDatasetPiloto({ capturas: [{ captureId: 'pilot-001' }] }), {
    allowed: true,
    status: 'ready',
    reason: null,
    captureCount: 1
  });
});
});
