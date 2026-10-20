import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PRODLIKE_CI_SCRIPTS,
  PRODLIKE_GENERATED_FIXTURE,
  runProdlikeDatasetCi
} from '../testing/run-dataset-prodlike-ci.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('prodlike CI exporta, valida e importa una copia temporal sin modificar el fixture versionado', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-prodlike-ci-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  for (const script of PRODLIKE_CI_SCRIPTS) {
    const target = path.join(tempRoot, script);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, script), target);
  }

  const fixtureDir = path.join(tempRoot, 'tests/fixtures/prodlike');
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'source.raw.json'), JSON.stringify({
    alumnos: [{ nombre: 'Nombre de prueba', correo: 'persona@example.com', matricula: 'CUH123456' }],
    docentes: [],
    examenes: [],
    periodos: []
  }));
  const canonicalFixture = path.join(fixtureDir, 'prodlike-anon.json.gz');
  fs.copyFileSync(path.join(repoRoot, 'tests/fixtures/prodlike/prodlike-anon.json.gz'), canonicalFixture);
  const canonicalHashBefore = hashFile(canonicalFixture);

  const status = runProdlikeDatasetCi({ root: tempRoot });

  assert.equal(status, 0);
  assert.equal(hashFile(canonicalFixture), canonicalHashBefore, 'el fixture canónico debe permanecer byte por byte intacto');
  assert.ok(fs.statSync(path.join(tempRoot, PRODLIKE_GENERATED_FIXTURE)).size > 0);
  assert.ok(fs.existsSync(path.join(tempRoot, 'reports/qa/latest/dataset-prodlike.json')));
  assert.ok(fs.existsSync(path.join(tempRoot, 'reports/qa/generated/prodlike-imported.json')));
});

test('prodlike CI detiene el flujo si falla una etapa', () => {
  const calls = [];
  const status = runProdlikeDatasetCi({
    root: repoRoot,
    writeError: () => {},
    runScript: (script, env) => {
      calls.push({ script, env });
      return { status: script === PRODLIKE_CI_SCRIPTS[1] ? 7 : 0 };
    }
  });

  assert.equal(status, 7);
  assert.deepEqual(calls.map(({ script }) => script), PRODLIKE_CI_SCRIPTS.slice(0, 2));
  assert.equal(calls[0].env.ANON_OUTPUT_GZ, path.resolve(repoRoot, PRODLIKE_GENERATED_FIXTURE));
  assert.equal(calls[1].env.ANON_INPUT_GZ, path.resolve(repoRoot, PRODLIKE_GENERATED_FIXTURE));
  assert.notEqual(calls[0].env.ANON_OUTPUT_GZ, path.resolve(repoRoot, 'tests/fixtures/prodlike/prodlike-anon.json.gz'));
});

test('la salida temporal prodlike queda excluida del checkout por gitignore', () => {
  const result = spawnSync('git', ['check-ignore', '--quiet', '--', PRODLIKE_GENERATED_FIXTURE], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, `${PRODLIKE_GENERATED_FIXTURE} debe permanecer fuera de los cambios rastreables`);
});

test('prodlike CI falla explícitamente si el subproceso no puede iniciarse', () => {
  const status = runProdlikeDatasetCi({
    root: repoRoot,
    writeError: () => {},
    runScript: () => ({ status: null, error: new Error('spawn denied') })
  });

  assert.equal(status, 1);
});
