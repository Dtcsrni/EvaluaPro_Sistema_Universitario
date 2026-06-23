/**
 * omr-tv-gate-runner.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../testing/run-omr-tv-gate.mjs';

test('runner TV OMR resuelve tv3 como baseline por defecto soportado', () => {
  const resolved = resolveConfig('tv3');
  assert.equal(resolved.version, 'tv3');
  assert.equal(resolved.gate, 'omr-tv-por-folio');
  assert.match(resolved.datasetManifest, /omr_samples_tv3_real_por_folio\/manifest\.json/);
  assert.match(resolved.wrapperReport, /reports\/qa\/latest\/omr-tv-gate-wrapper\.json/);
  assert.match(resolved.command, /omr:tv3:validate:por-folio/);
});

test('runner TV OMR resuelve tv4 sin cambiar el contrato del wrapper', () => {
  const resolved = resolveConfig('tv4');
  assert.equal(resolved.version, 'tv4');
  assert.equal(resolved.gate, 'omr-tv-pilot-real');
  assert.match(resolved.datasetManifest, /omr_samples_tv4_pilot_real\/manifest\.json/);
  assert.match(resolved.wrapperReport, /reports\/qa\/latest\/omr-tv-gate-wrapper\.json/);
  assert.match(resolved.command, /omr:tv4:validate:pilot-real/);
});

test('runner TV OMR falla con versiones no registradas', () => {
  assert.throws(() => resolveConfig('tv99'), /Version OMR TV no soportada/);
});
