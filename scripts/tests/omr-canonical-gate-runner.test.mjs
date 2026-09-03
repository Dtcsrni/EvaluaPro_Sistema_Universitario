/**
 * omr-canonical-gate-runner.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../testing/run-omr-canonical-gate.mjs';

test('runner OMR resuelve la única plantilla canónica', () => {
  const resolved = resolveConfig();
  assert.equal(resolved.gate, 'omr-canonical-pilot-real');
  assert.match(resolved.datasetManifest, /omr_samples_tv4_pilot_real\/manifest\.json/);
  assert.match(resolved.wrapperReport, /omr-canonical-gate-wrapper\.json/);
  assert.match(resolved.command, /omr:validate:pilot-real/);
});
