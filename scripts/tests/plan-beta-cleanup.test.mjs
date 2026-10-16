import test from 'node:test';
import assert from 'node:assert/strict';
import { planBetaCleanup } from '../release/plan-beta-cleanup.mjs';

const candidateSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const stableRelease = { tag_name: 'v1.2.8', draft: false, prerelease: false };

test('planifica quitar únicamente prereleases del mismo SHA y versión', () => {
  const plan = planBetaCleanup({
    version: '1.2.8', candidateSha, stableRelease, stableTagSha: candidateSha,
    betaReleases: [
      { tag_name: 'v1.2.8-beta.7', draft: false, prerelease: true },
      { tag_name: 'v1.2.8-beta.6', draft: false, prerelease: true },
      { tag_name: 'v1.2.7-beta.9', draft: false, prerelease: true },
      { tag_name: 'v1.2.8-beta.8', draft: true, prerelease: false }
    ],
    tagCommits: { 'v1.2.8-beta.7': candidateSha, 'v1.2.8-beta.6': otherSha }
  });
  assert.deepEqual(plan.remove, ['v1.2.8-beta.7']);
  assert.deepEqual(plan.preserve, [{ tag: 'v1.2.8-beta.6', sha: otherSha }]);
});

test('no elimina nada si la publicación estable no está confirmada o apunta a otro SHA', () => {
  assert.throws(() => planBetaCleanup({ version: '1.2.8', candidateSha, stableRelease: { ...stableRelease, draft: true }, stableTagSha: candidateSha }), /release estable pública/);
  assert.throws(() => planBetaCleanup({ version: '1.2.8', candidateSha, stableRelease, stableTagSha: otherSha }), /no apunta al SHA candidato/);
});

test('falla cerrado si falta el SHA verificable de una beta candidata', () => {
  assert.throws(() => planBetaCleanup({
    version: '1.2.8', candidateSha, stableRelease, stableTagSha: candidateSha,
    betaReleases: [{ tag_name: 'v1.2.8-beta.1', draft: false, prerelease: true }]
  }), /[Nn]o se pudo verificar el SHA/);
});

test('el reintento sin betas candidatas es idempotente', () => {
  const plan = planBetaCleanup({ version: '1.2.8', candidateSha, stableRelease, stableTagSha: candidateSha });
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.preserve, []);
});
