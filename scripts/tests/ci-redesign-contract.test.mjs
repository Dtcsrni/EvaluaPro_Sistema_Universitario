import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowDir = path.join(root, '.github', 'workflows');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('solo CI Checks ejecuta validaciones automáticamente; módulos quedan bajo dispatch', () => {
  const central = read('.github/workflows/ci.yml');
  assert.match(central, /^  pull_request:/m);
  assert.match(central, /^  push:\n    branches:\n      - "main"/m);
  assert.match(central, /^  schedule:/m);

  for (const name of ['ci-backend.yml', 'ci-frontend.yml', 'ci-portal.yml', 'ci-docs.yml']) {
    const workflow = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    const triggers = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1] ?? '';
    assert.match(triggers, /^  workflow_dispatch:/m, name);
    assert.doesNotMatch(triggers, /^  (?:push|pull_request|schedule):/m, name);
  }
});

test('Core y Extended exigen detector y plan, y guardan un resumen reproducible', () => {
  const workflow = read('.github/workflows/ci.yml');
  for (const [job, mode] of [['verificaciones_core', 'core'], ['verificaciones_ext', 'extended']]) {
    const block = workflow.match(new RegExp(`  ${job}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9_]+:\\n|$)`))?.[0] ?? '';
    assert.match(block, /needs:[\s\S]*?- detectar_cambios/);
    assert.match(block, new RegExp(`--mode=${mode}`));
    assert.match(block, /CI_GATE_NEEDS_JSON:\s*\$\{\{\s*toJSON\(needs\)\s*\}\}/);
    assert.match(block, /name: Publicar decisión del gate/);
    assert.match(block, /retention-days:\s*14/);
  }
});

test('la preparación de Node comparte versiones/cache y sharp usa el lockfile', () => {
  const action = read('.github/actions/setup-node-project/action.yml');
  const backendPackage = JSON.parse(read('apps/backend/package.json'));
  const backendLock = JSON.parse(read('apps/backend/package-lock.json'));
  assert.match(action, /actions\/setup-node@[^\s]+ # v6/);
  assert.match(action, /npm install --global npm@\$\{\{ inputs\.npm-version \}\}/);
  assert.match(action, /npm ci --foreground-scripts/);
  assert.equal(backendPackage.dependencies.sharp, '^0.35.5');
  assert.equal(backendLock.packages['node_modules/sharp'].version, '0.35.5');

  for (const name of ['ci.yml', 'ci-backend.yml', 'ci-frontend.yml', 'ci-portal.yml', 'ci-docs.yml', 'autogen-docs.yml']) {
    assert.match(read(`.github/workflows/${name}`), /uses: \.\/\.github\/actions\/setup-node-project/);
  }
  assert.doesNotMatch(read('.github/workflows/ci.yml'), /npm install --no-save[^\n]*sharp/);
  assert.doesNotMatch(read('.github/workflows/ci-backend.yml'), /npm install --no-save[^\n]*sharp/);
});

test('las suites de CI ejecutan una pasada y el gate OMR canónico no se duplica automáticamente', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  for (const key of ['test:frontend:ci', 'test:portal:ci', 'test:coverage:ci']) {
    assert.doesNotMatch(scripts[key], /scripts\/retry\.mjs/, key);
  }
  const backend = read('.github/workflows/ci-backend.yml');
  const gate = backend.match(/- name: Etapa gate OMR canónico[\s\S]*?(?=\n      - name:|$)/)?.[0] ?? '';
  assert.match(gate, /if: github\.event_name == 'workflow_dispatch'/);
});

test('validaciones integrales y publicaciones no se cancelan por un push ordinario', () => {
  const central = read('.github/workflows/ci.yml');
  const installer = read('.github/workflows/ci-installer-windows.yml');
  const autogen = read('.github/workflows/autogen-docs.yml');
  for (const workflow of [central, installer]) assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \|\| github\.event_name == 'push' \}\}/);
  assert.match(central, /format\('\{0\}-\{1\}', github\.event_name, github\.run_id\)/);
  assert.match(installer, /format\('dispatch-\{0\}', github\.run_id\)/);
  assert.match(autogen, /cancel-in-progress:\s*false/);
});
