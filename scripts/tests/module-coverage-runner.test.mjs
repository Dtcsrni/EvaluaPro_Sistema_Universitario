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


test('excludes TypeScript declaration files from the executable coverage denominator', async () => {
  const { isCoverableFile } = await import('../testing/check-diff-coverage.mjs');

  assert.equal(isCoverableFile('apps/frontend/src/tipos/api.d.ts'), false);
  assert.equal(isCoverableFile('apps/backend/src/types/api.d.mts'), false);
  assert.equal(isCoverableFile('apps/portal_alumno_cloud/src/types/api.d.cts'), false);
  assert.equal(isCoverableFile('apps/frontend/src/App.tsx'), true);
  assert.equal(isCoverableFile('apps/backend/src/index.ts'), true);
});

test('distinguishes uncovered executable lines from lines without LCOV instrumentation', async () => {
  const { getLineCoverageStatus } = await import('../testing/check-diff-coverage.mjs');

  assert.equal(getLineCoverageStatus(undefined, 17), 'missing-file');
  assert.equal(getLineCoverageStatus(new Map(), 17), 'missing-file');
  assert.equal(getLineCoverageStatus(new Map([[10, 1]]), 17), 'uninstrumented');
  assert.equal(getLineCoverageStatus(new Map([[17, 0]]), 17), 'uncovered');
  assert.equal(getLineCoverageStatus(new Map([[17, 1]]), 17), 'covered');
});

test('excludes TypeScript type declarations from the diff coverage denominator', async () => {
  const { getTypeOnlyLines } = await import('../testing/check-diff-coverage.mjs');
  const source = [
    'export type Preview = {',
    '  fuentes?: string[];',
    '  reactivos?: Array<{ id: string; problemas: string[] }>;',
    '};',
    'const cantidad = 4;'
  ].join('\n');
  const typeOnlyLines = getTypeOnlyLines('preview.tsx', source);

  assert.equal(typeOnlyLines.has(2), true);
  assert.equal(typeOnlyLines.has(3), true);
  assert.equal(typeOnlyLines.has(5), false);
});
