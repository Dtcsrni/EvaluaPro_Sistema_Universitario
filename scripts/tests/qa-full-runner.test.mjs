import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_QA_REPORTS, validateQaReports } from '../testing/validate-qa-reports.mjs';
import { QA_FULL_TASKS, runQaFull } from '../testing/run-qa-full.mjs';
import { REQUIRED_QA_ARTIFACTS } from '../release/required-qa-artifacts.mjs';

test('QA local comparte con stable promotion el mismo conjunto requerido de reportes', () => {
  assert.deepEqual(REQUIRED_QA_REPORTS, REQUIRED_QA_ARTIFACTS);
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-qa-full-'));
  const dir = path.join(root, 'reports/qa/latest');
  fs.mkdirSync(dir, { recursive: true });
  for (const id of REQUIRED_QA_REPORTS) {
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ ok: true }));
  }
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    resumen: { estado: 'ok', faltantes: 0 },
    artefactos: REQUIRED_QA_REPORTS.map((id) => ({ archivo: `reports/qa/latest/${id}.json`, existe: true }))
  }));
  return { root, dir, manifestPath };
}

test('QA reports accept a complete green manifest', () => {
  const f = fixture();
  try {
    assert.deepEqual(validateQaReports(f.manifestPath), { ok: true, errors: [] });
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('QA reports reject false, missing, invalid JSON, and malformed manifest entries', () => {
  for (const scenario of ['false', 'missing', 'invalid', 'manifest-missing']) {
    const f = fixture();
    try {
      if (scenario === 'false') fs.writeFileSync(path.join(f.dir, 'clean-architecture.json'), '{"ok":false}');
      if (scenario === 'missing') fs.rmSync(path.join(f.dir, 'pdf-print.json'));
      if (scenario === 'invalid') fs.writeFileSync(path.join(f.dir, 'global-grade.json'), '{');
      if (scenario === 'manifest-missing') {
        const manifest = JSON.parse(fs.readFileSync(f.manifestPath, 'utf8'));
        manifest.artefactos = manifest.artefactos.filter((x) => !x.archivo.endsWith('ux-visual.json'));
        fs.writeFileSync(f.manifestPath, JSON.stringify(manifest));
      }
      const result = validateQaReports(f.manifestPath);
      assert.equal(result.ok, false, scenario);
      assert.ok(result.errors.length > 0, scenario);
    } finally {
      fs.rmSync(f.root, { recursive: true, force: true });
    }
  }
});

test('qa:full runs all diagnostic gates and the manifest before failing closed on a report', async () => {
  const tasks = [];
  const exitCode = await runQaFull({
    runTask: (task) => {
      tasks.push(task);
      return { status: task === QA_FULL_TASKS[1] ? 1 : 0 };
    },
    validateReports: () => ({ ok: false, errors: ['clean-architecture: ok=false'] })
  });
  assert.equal(exitCode, 1);
  assert.deepEqual(tasks, QA_FULL_TASKS);
});

test('qa:full returns success only when every task and report validation succeed', async () => {
  const tasks = [];
  const exitCode = await runQaFull({
    runTask: (task) => { tasks.push(task); return { status: 0 }; },
    validateReports: () => ({ ok: true, errors: [] })
  });
  assert.equal(exitCode, 0);
  assert.deepEqual(tasks, QA_FULL_TASKS);
});
