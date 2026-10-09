import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = packageJson.scripts;

test('el gate Installer Hub requerido se limita a docente-local y conserva contratos futuros aislados', () => {
  const docenteContract = scripts['test:installer-hub:contract'];
  const allFlavorsContract = scripts['test:installer-hub:contract:all'];

  assert.match(docenteContract, /--test-skip-pattern=/);
  for (const futureFlavorMarker of ['Docker', 'WSL', 'flavor', 'institucional', 'SaaS']) {
    assert.ok(docenteContract.includes(futureFlavorMarker), `El gate debe excluir casos futuros por nombre: ${futureFlavorMarker}`);
  }
  assert.doesNotMatch(docenteContract, /installer-flavor-diff-resolver\.test\.mjs/);
  assert.match(allFlavorsContract, /installer-flavor-diff-resolver\.test\.mjs/);
  assert.match(allFlavorsContract, /installer-hub-contract\.test\.mjs/);
});
