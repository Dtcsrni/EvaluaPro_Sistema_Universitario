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

test('guardas WCAG activan frontend antes de integrar cambios en PR', () => {
  const guards = [
    'scripts/wcag-guard.mjs',
    'scripts/tests/ui-contrast-audit.mjs',
    'scripts/tests/wcag-guard.contract.test.mjs',
    'docs/WCAG_UI_POLICY.md'
  ];

  for (const guard of guards) {
    const result = evaluateAffectedChangeSet(config, [guard]);
    assert.equal(result.matchedGroups.frontend, true, `${guard} debe activar el grupo frontend`);
    assert.equal(result.matchedJobs.core_frontend, true, `${guard} debe ejecutar el core frontend`);
    assert.equal(result.matchedGates['ux-visual-check'], true, `${guard} debe ejecutar el gate UX`);
  }
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

test('cambios CI y release ejecutan contratos específicos sin correr todos los gates extendidos', () => {
  const fromCi = evaluateAffectedChangeSet(config, ['ci/pipeline.matrix.json']);
  const fromRelease = evaluateAffectedChangeSet(config, ['scripts/release/promote-stable.mjs']);

  assert.equal(fromCi.escalation, 'affected');
  assert.equal(fromCi.matchedGroups.ci_tooling, true);
  assert.equal(fromCi.matchedJobs.core_contract_docs_gov, true);
  assert.equal(fromCi.matchedJobs.ext_funcionales, false);
  assert.equal(fromCi.matchedJobs.ext_perf_arquitectura, false);
  assert.equal(fromRelease.escalation, 'affected');
  assert.equal(fromRelease.matchedGroups.release, true);
  assert.equal(fromRelease.matchedJobs.core_contract_docs_gov, true);
  assert.equal(fromRelease.matchedJobs.ext_funcionales, false);
  assert.equal(fromRelease.matchedJobs.ext_perf_arquitectura, false);
});

test('workflow Package Images y contratos de workflows activan las suites que validan cambios CI', () => {
  const packageWorkflow = evaluateAffectedChangeSet(config, ['.github/workflows/package.yml']);
  const workflowContract = evaluateAffectedChangeSet(config, ['scripts/tests/ci-workflow-contract.test.mjs']);
  const rootScriptPolicy = evaluateAffectedChangeSet(config, ['package.json']);

  assert.equal(packageWorkflow.matchedGroups.release, true);
  assert.equal(packageWorkflow.escalation, 'affected');
  assert.equal(packageWorkflow.matchedJobs.core_contract_docs_gov, true);
  assert.equal(packageWorkflow.matchedGates['perf-check'], false);
  assert.equal(workflowContract.matchedGroups.ci_tooling, true);
  assert.equal(workflowContract.matchedGroups.shared, false);
  assert.equal(workflowContract.escalation, 'affected');
  assert.equal(workflowContract.matchedJobs.core_contract_docs_gov, true);
  assert.equal(rootScriptPolicy.matchedGroups.ci_tooling, true);
  assert.equal(rootScriptPolicy.matchedGroups.shared, false);
  assert.equal(rootScriptPolicy.escalation, 'affected');
  assert.equal(rootScriptPolicy.matchedJobs.ext_funcionales, false);
});

test('los gates OMR solo corren cuando cambia OMR o su dataset', () => {
  const unrelatedBackend = evaluateAffectedChangeSet(config, [
    'apps/backend/src/modulos/modulo_asistencias/servicioAsistencia.ts'
  ]);
  const omrTest = evaluateAffectedChangeSet(config, [
    'apps/backend/tests/archivoTemporalOmr.test.ts'
  ]);

  assert.equal(unrelatedBackend.matchedGroups.backend, true);
  assert.equal(unrelatedBackend.matchedGroups.backend_omr, false);
  assert.equal(unrelatedBackend.matchedGates['omr-tv-extended-gate'], false);
  assert.equal(unrelatedBackend.matchedJobs.ext_funcionales, false);
  assert.equal(omrTest.matchedGroups.backend_omr, true);
  assert.equal(omrTest.matchedGates['omr-tv-extended-gate'], true);
  assert.equal(omrTest.matchedGates['pdf-print-check'], false);
  assert.equal(omrTest.matchedGates['dataset-prodlike-check'], false);
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

test('cambios en carga de env del runtime activan contrato installer', () => {
  const runtimeEnv = evaluateAffectedChangeSet(config, ['scripts/runtime-env.mjs']);
  const launcher = evaluateAffectedChangeSet(config, ['scripts/start-docente-native.mjs']);

  for (const result of [runtimeEnv, launcher]) {
    assert.equal(result.escalation, 'affected');
    assert.equal(result.matchedGroups.installer, true);
    assert.equal(result.matchedJobs.core_contract_docs_gov, true);
  }
});
