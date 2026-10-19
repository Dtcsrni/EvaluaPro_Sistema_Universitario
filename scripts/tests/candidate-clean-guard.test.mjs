import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guardPath = path.join(root, 'scripts', 'release', 'assert-candidate-clean.mjs');
const workflowPath = path.join(root, '.github', 'workflows', 'release-stable-gate.yml');
const allowedPath = 'scripts/testing/run-backend-coverage-batches.mjs';

async function withFixture(
  callback,
  trackedPath = allowedPath,
  initialContents = 'const first = 1;\nconst second = 2;\n'
) {
  const tempRoot = path.join(root, 'tmp', 'candidate-clean-guard-tests');
  fs.mkdirSync(tempRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(tempRoot, 'fixture-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: fixture });
    execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: fixture });
    execFileSync('git', ['config', 'user.name', 'EvaluaPro Test'], { cwd: fixture });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: fixture });
    const filePath = path.join(fixture, trackedPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, initialContents, 'utf8');
    execFileSync('git', ['add', trackedPath], { cwd: fixture });
    execFileSync('git', ['commit', '-qm', 'baseline'], { cwd: fixture });
    await callback(fixture, filePath);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function runGuard(fixture) {
  return spawnSync(process.execPath, [guardPath, 'prueba de regresión'], { cwd: fixture, encoding: 'utf8' });
}

test('Stable Gate invoca el mismo guard para checkout inicial, checkpoints y guard final', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const guard = fs.readFileSync(guardPath, 'utf8');
  const calls = workflow.match(/node scripts\/release\/assert-candidate-clean\.mjs/g) ?? [];

  assert.ok(calls.length >= 11, 'el workflow debe comprobar checkout inicial, todas las etapas y el guard final');
  assert.match(workflow, /assert-candidate-clean\.mjs 'checkout inicial'/);
  assert.match(workflow, /assert-candidate-clean\.mjs 'guard final previo a QA completa'/);
  for (const stage of [
    'npm ci', 'generación de Prisma', 'instalación de Poppler', 'instalación de Playwright',
    'matriz GUI', 'contrato visual', 'E2E responsive', 'E2E de ciclo', 'E2E PDF'
  ]) {
    assert.match(workflow, new RegExp(`assert-candidate-clean\\.mjs '${stage}'`), `falta guard en ${stage}`);
  }
  assert.match(guard, /--ignore-cr-at-eol/);
  assert.match(guard, /staged \|\| untracked/);
  assert.match(guard, /staged \|\| untracked \|\| !unstagedModification/);
});

test('el guard del checkout candidato solo permite EOL sin cambios semánticos', async (t) => {
  await t.test('acepta diferencias CRLF/LF sin contenido distinto', async () => {
    await withFixture((fixture, filePath) => {
      fs.writeFileSync(filePath, 'const first = 1;\r\nconst second = 2;\r\n', 'utf8');
      const result = runGuard(fixture);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Diferencias EOL sin cambio semántico permitidas/);
    });
  });

  await t.test('acepta EOL-only en JSON de evidencia fuera de la allowlist histórica', async () => {
    await withFixture((fixture, filePath) => {
      fs.writeFileSync(filePath, '{\r\n  "version": "1.2.8"\r\n}\r\n', 'utf8');
      const result = runGuard(fixture);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /manifest\.json/);
    }, 'docs/release/evidencias/1.2.8/manifest.json', '{\n  "version": "1.2.8"\n}\n');
  });

  await t.test('rechaza contenido semántico en una ruta permitida', async () => {
    await withFixture((fixture, filePath) => {
      fs.writeFileSync(filePath, 'const first = 3;\nconst second = 2;\n', 'utf8');
      const result = runGuard(fixture);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /diferencia de contenido/);
      assert.match(result.stderr, /run-backend-coverage-batches\.mjs/);
    });
  });

  await t.test('rechaza una ruta fuera de la allowlist', async () => {
    await withFixture((fixture) => {
      fs.writeFileSync(path.join(fixture, 'unexpected.txt'), 'unexpected\n', 'utf8');
      const result = runGuard(fixture);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /unexpected\.txt/);
    });
  });

  await t.test('rechaza cambios preparados aunque su contenido sea EOL-only', async () => {
    await withFixture((fixture, filePath) => {
      fs.writeFileSync(filePath, 'const first = 1;\r\nconst second = 2;\r\n', 'utf8');
      execFileSync('git', ['add', path.relative(fixture, filePath)], { cwd: fixture });
      const result = runGuard(fixture);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /cambios no permitidos/);
    });
  });

  await t.test('rechaza archivos sin seguimiento', async () => {
    await withFixture((fixture) => {
      fs.writeFileSync(path.join(fixture, 'untracked.txt'), 'untracked\n', 'utf8');
      const result = runGuard(fixture);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /untracked\.txt/);
    });
  });
});
