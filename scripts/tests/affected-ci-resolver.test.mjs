/**
 * affected-ci-resolver.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { evaluateAffectedChangeSet } from '../testing/resolve-affected-ci.mjs';

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'ci', 'affected-test-map.json'), 'utf8'));

test('frontend-only activa frontend y ux, pero no backend ni perf/compliance', () => {
  const result = evaluateAffectedChangeSet(config, ['apps/frontend/src/ui/App.tsx']);

  assert.equal(result.escalation, 'affected');
  assert.equal(result.matchedGroups.frontend, true);
  assert.equal(result.matchedGroups.backend, false);
  assert.equal(result.matchedGates['ux-visual-check'], true);
  assert.equal(result.matchedGates['perf-check'], false);
  assert.equal(result.matchedGates['clean-architecture-check'], false);
  assert.equal(result.matchedGates['compliance-evidence'], false);
  assert.equal(result.matchedJobs.core_frontend, true);
  assert.equal(result.matchedJobs.ext_funcionales, true);
  assert.equal(result.matchedJobs.ext_perf_arquitectura, false);
  assert.equal(result.matchedJobs.ext_compliance_evidencia, false);
});

test('docs-only activa docs y evita gates extended no relacionados', () => {
  const result = evaluateAffectedChangeSet(config, ['docs/README.md']);

  assert.equal(result.escalation, 'affected');
  assert.equal(result.matchedGroups.docs, true);
  assert.equal(result.matchedJobs.core_contract_docs_gov, true);
  assert.equal(result.matchedJobs.ext_funcionales, false);
  assert.equal(result.matchedJobs.ext_perf_arquitectura, false);
  assert.equal(result.matchedJobs.ext_compliance_evidencia, false);
});

test('cambios en ci o release escalan a full-extended', () => {
  const fromCi = evaluateAffectedChangeSet(config, ['ci/pipeline.matrix.json']);
  const fromRelease = evaluateAffectedChangeSet(config, ['scripts/release/promote-stable.mjs']);

  assert.equal(fromCi.escalation, 'full-extended');
  assert.equal(fromRelease.escalation, 'full-extended');
});

test('shared backend compartido escala al menos a full-core', () => {
  const result = evaluateAffectedChangeSet(config, ['apps/backend/src/compartido/seguridad/token.ts']);

  assert.equal(result.escalation, 'full-core');
  assert.equal(result.matchedGroups.shared, true);
  assert.equal(result.matchedJobs.core_backend_portal, true);
  assert.equal(result.matchedJobs.core_frontend, true);
});

test('cambios classroom activan auditoria focal desde el mapa afectado', () => {
  const result = evaluateAffectedChangeSet(config, [
    'apps/backend/src/modulos/modulo_integraciones_classroom/servicioSyncClassroom.ts'
  ]);

  assert.equal(result.matchedGroups.classroom, true);
  assert.equal(result.matchedGates['classroom-audit-check'], true);
  assert.equal(result.matchedJobs.core_backend_portal, true);
});

test('cambios installer activan contrato en el integrador core', () => {
  const result = evaluateAffectedChangeSet(config, [
    'scripts/installer-burn/InstallerBurnHelper.ps1'
  ]);

  assert.equal(result.escalation, 'affected');
  assert.equal(result.matchedGroups.installer, true);
  assert.equal(result.matchedJobs.core_contract_docs_gov, true);
});
