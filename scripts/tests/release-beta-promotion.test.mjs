/**
 * release-beta-promotion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBetaDiffSummary, buildBetaNotes, classifyBetaScope, evaluateBetaGateState, parseCandidateRunsFile, resolveNextBetaVersion } from '../release/validate-beta-promotion.mjs';

const CANDIDATE_SHA = 'a'.repeat(40);
const gateRun = (name, status, conclusion = null, headSha = CANDIDATE_SHA) => ({ name, status, conclusion, head_sha: headSha, run_attempt: 1, created_at: '2026-10-16T00:00:00Z' });

test('beta solo se permite mientras un gate del SHA exacto sigue en curso', () => {
  const state = evaluateBetaGateState([
    gateRun('CI Checks', 'completed', 'success'),
    gateRun('CI Installer Windows', 'in_progress')
  ], CANDIDATE_SHA);
  assert.equal(state.canPublish, true);
  assert.equal(state.state, 'gates-pending');
});

test('beta se rechaza cuando todos los gates del candidato pasaron', () => {
  const state = evaluateBetaGateState([
    gateRun('CI Checks', 'completed', 'success'),
    gateRun('CI Installer Windows', 'completed', 'success')
  ], CANDIDATE_SHA);
  assert.equal(state.canPublish, false);
  assert.equal(state.state, 'all-gates-passed');
});

test('beta se rechaza ante gates faltantes, fallidos o de otro SHA', () => {
  assert.equal(evaluateBetaGateState([gateRun('CI Checks', 'in_progress')], CANDIDATE_SHA).state, 'missing-gates');
  assert.equal(evaluateBetaGateState([
    gateRun('CI Checks', 'completed', 'failure'),
    gateRun('CI Installer Windows', 'in_progress')
  ], CANDIDATE_SHA).state, 'failed-gates');
  assert.equal(evaluateBetaGateState([
    gateRun('CI Checks', 'in_progress', null, 'b'.repeat(40)),
    gateRun('CI Installer Windows', 'in_progress')
  ], CANDIDATE_SHA).state, 'missing-gates');
});

test('el parser de corridas admite JSON paginado y salida NDJSON de gh api', () => {
  const runs = [gateRun('CI Checks', 'in_progress'), gateRun('CI Installer Windows', 'queued')];
  assert.deepEqual(parseCandidateRunsFile(JSON.stringify({ workflow_runs: runs })), runs);
  assert.deepEqual(parseCandidateRunsFile(runs.map((run) => JSON.stringify(run)).join('\n')), runs);
});

test('beta scope considera docs y outputs regenerables como no significativos', () => {
  const scope = classifyBetaScope([
    'docs/VERSIONADO.md',
    'reports/qa/latest/manifest.json',
    'CHANGELOG.md'
  ]);

  assert.equal(scope.hasChanges, true);
  assert.equal(scope.significant, false);
  assert.equal(scope.docsOnly, true);
});

test('beta scope detecta cambios funcionales y de contrato', () => {
  const scope = classifyBetaScope([
    'apps/backend/src/modulos/modulo_autenticacion/rutasAutenticacion.ts',
    'scripts/release/validate-beta-promotion.mjs'
  ]);

  assert.equal(scope.hasChanges, true);
  assert.equal(scope.significant, true);
  assert.deepEqual(scope.significantFiles, [
    'apps/backend/src/modulos/modulo_autenticacion/rutasAutenticacion.ts',
    'scripts/release/validate-beta-promotion.mjs'
  ]);
  assert.deepEqual(scope.releaseRelevantFiles, [
    'apps/backend/src/modulos/modulo_autenticacion/rutasAutenticacion.ts',
    'scripts/release/validate-beta-promotion.mjs'
  ]);
});

test('beta scope ignora cambios fuera de superficies relevantes aunque no sean docs', () => {
  const scope = classifyBetaScope([
    'notes/decision-log.txt'
  ]);

  assert.equal(scope.hasChanges, true);
  assert.equal(scope.significant, false);
  assert.equal(scope.docsOnly, false);
  assert.deepEqual(scope.releaseRelevantFiles, []);
});

test('next beta version incrementa el sufijo existente', () => {
  const next = resolveNextBetaVersion('1.0.0', ['app-v1.0.0-beta.1', 'app-v1.0.0-beta.2']);

  assert.equal(next.baseVersion, '1.0.0');
  assert.equal(next.betaVersion, '1.0.0-beta.3');
  assert.equal(next.tagName, 'app-v1.0.0-beta.3');
});

test('beta decision puede conservar un motivo manual explicito', async () => {
  const scope = await (await import('../release/validate-beta-promotion.mjs')).evaluateBetaPromotion({
    version: '1.0.0',
    headSha: 'HEAD',
    baseRef: '',
    reason: 'publicacion manual fuera de main'
  });

  assert.equal(typeof scope.reason, 'string');
  assert.ok(scope.reason.length > 0);
});

test('beta notes resumen el diff y los archivos relevantes', () => {
  const notes = buildBetaNotes({
    betaVersion: '1.0.0-beta.1',
    baseVersion: '1.0.0',
    tagName: 'app-v1.0.0-beta.1',
    baseRef: 'v1.0.0',
    headSha: 'abc123',
    decision: 'Go',
    reason: 'corte funcional',
    scopeReason: 'diff relevante',
    changedFiles: ['apps/backend/src/a.ts', 'docs/VERSIONADO.md'],
    releaseRelevantFiles: ['apps/backend/src/a.ts']
  });

  assert.match(notes, /# Beta Release Notes 1\.0\.0-beta\.1/);
  assert.match(notes, /apps\/backend\/src\/a\.ts/);
  assert.match(notes, /docs\/VERSIONADO\.md/);
});

test('beta diff summary es estructurado y estable', () => {
  const summary = buildBetaDiffSummary({
    betaVersion: '1.0.0-beta.1',
    baseVersion: '1.0.0',
    tagName: 'app-v1.0.0-beta.1',
    baseRef: 'v1.0.0',
    headSha: 'abc123',
    decision: 'Go',
    reason: 'corte funcional',
    scopeReason: 'diff relevante',
    timestamp: '2026-03-26T00:00:00.000Z',
    changedFiles: ['apps/backend/src/a.ts', 'docs/VERSIONADO.md'],
    significantFiles: ['apps/backend/src/a.ts', 'scripts/release/validate-beta-promotion.mjs'],
    releaseRelevantFiles: ['apps/backend/src/a.ts']
  });

  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.betaVersion, '1.0.0-beta.1');
  assert.equal(summary.counts.releaseRelevantFiles, 1);
  assert.deepEqual(summary.files.changed, ['apps/backend/src/a.ts', 'docs/VERSIONADO.md']);
});
