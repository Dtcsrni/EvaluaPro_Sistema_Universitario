/**
 * release-ci-candidate.test
 *
 * Contratos para validar CI del SHA que se promociona.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLatestCandidateRun, validateCiCandidate } from '../release/check-ci-candidate.mjs';

const candidateSha = 'a'.repeat(40);

function run(overrides = {}) {
  return {
    id: 501,
    name: 'CI Checks',
    head_branch: 'main',
    head_sha: candidateSha,
    status: 'completed',
    conclusion: 'success',
    run_attempt: 1,
    updated_at: '2026-10-12T12:00:00Z',
    ...overrides
  };
}

test('CI candidato pasa con una sola ejecución verde ligada al SHA y main', () => {
  const result = selectLatestCandidateRun([run()], {
    candidateSha,
    branch: 'main',
    workflowName: 'CI Checks'
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.run, {
    id: 501,
    workflow: 'CI Checks',
    branch: 'main',
    sha: candidateSha,
    status: 'completed',
    conclusion: 'success',
    runAttempt: 1,
    completedAt: '2026-10-12T12:00:00Z'
  });
});

test('CI candidato rechaza SHA, rama o workflow distintos', () => {
  for (const invalidRun of [
    run({ head_sha: 'b'.repeat(40) }),
    run({ head_branch: 'feature/release' }),
    run({ name: 'CI Frontend Module' })
  ]) {
    const result = selectLatestCandidateRun([invalidRun], {
      candidateSha,
      branch: 'main',
      workflowName: 'CI Checks'
    });
    assert.equal(result.ok, false);
    assert.equal(result.run, null);
  }
});

test('CI candidato rechaza ejecuciones pendientes o fallidas', () => {
  for (const invalidRun of [
    run({ status: 'in_progress', conclusion: null }),
    run({ conclusion: 'failure' })
  ]) {
    const result = selectLatestCandidateRun([invalidRun], {
      candidateSha,
      branch: 'main',
      workflowName: 'CI Checks'
    });
    assert.equal(result.ok, false);
    assert.match(result.detail, /status=|conclusion=/i);
  }
});

test('CI candidato evalúa el intento más reciente del mismo workflow y SHA', () => {
  const result = selectLatestCandidateRun([
    run({ id: 501, run_attempt: 1, updated_at: '2026-10-12T12:00:00Z' }),
    run({ id: 502, run_attempt: 2, conclusion: 'failure', updated_at: '2026-10-12T12:01:00Z' })
  ], {
    candidateSha,
    branch: 'main',
    workflowName: 'CI Checks'
  });

  assert.equal(result.ok, false);
  assert.equal(result.run.id, 502);
  assert.equal(result.run.conclusion, 'failure');
});

test('promoción exige CI Checks e Installer Windows exitosos sobre el mismo SHA', () => {
  const result = validateCiCandidate({
    ciRuns: [run()],
    installerRun: run({ id: 601, name: 'CI Installer Windows' }),
    candidateSha
  });

  assert.equal(result.ok, true);
  assert.equal(result.ci.run.id, 501);
  assert.equal(result.installer.run.id, 601);
});

test('promoción rechaza artefacto Installer Windows de otro SHA', () => {
  const result = validateCiCandidate({
    ciRuns: [run()],
    installerRun: run({ id: 601, name: 'CI Installer Windows', head_sha: 'b'.repeat(40) }),
    candidateSha
  });

  assert.equal(result.ok, false);
  assert.equal(result.ci.ok, true);
  assert.equal(result.installer.ok, false);
});
