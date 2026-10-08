import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModuleCoveragePlan, isSafeGitRef, parseApps } from '../testing/run-module-coverage.mjs';

test('omits coverage when a PR has no changed source files for the selected module', () => {
  assert.deepEqual(buildModuleCoveragePlan('frontend', 'origin/main', []).mode, 'skip');
  assert.deepEqual(buildModuleCoveragePlan('portal', 'origin/main', ['apps/frontend/src/App.tsx']).mode, 'skip');
});

test('runs related tests with coverage and zero global thresholds for changed module sources', () => {
  const plan = buildModuleCoveragePlan('frontend', 'origin/main', ['apps/frontend/src/App.tsx']);
  assert.equal(plan.mode, 'changed');
  assert.ok(plan.args.includes('--changed=origin/main'));
  assert.ok(plan.args.includes('--coverage.thresholds.lines=0'));
  assert.ok(plan.args.includes('--coverage.thresholds.functions=0'));
  assert.ok(plan.args.includes('--coverage.thresholds.branches=0'));
  assert.ok(plan.args.includes('--coverage.thresholds.statements=0'));
  assert.ok(plan.args.includes('--pool=forks'));
});

test('preserves full coverage mode outside PRs', () => {
  assert.equal(buildModuleCoveragePlan('frontend').mode, 'full');
  assert.equal(buildModuleCoveragePlan('portal').mode, 'full');
});

test('rejects unsafe refs and module selectors', () => {
  assert.equal(isSafeGitRef('origin/main'), true);
  assert.equal(isSafeGitRef('--run'), false);
  assert.throws(() => buildModuleCoveragePlan('frontend', '--run', []), /referencia Git válida/);
  assert.throws(() => buildModuleCoveragePlan('saas-completo', '', []), /no admitido/);
  assert.throws(() => parseApps('frontend,unknown'), /--apps/);
});
