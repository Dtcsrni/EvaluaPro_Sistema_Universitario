import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

test('build-msi compila MSI + Bundle multi-flavor con -IncludeBundle (solo Windows)', () => {
  if (process.platform !== 'win32') {
    test.skip('Prueba solo valida en Windows.');
    return;
  }

  const scriptPath = path.join(root, 'scripts', 'build-msi.ps1');
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-SkipStabilityChecks',
      '-IncludeBundle',
      '-Flavor',
      'all'
    ],
    { cwd: root, encoding: 'utf8' }
  );

  assert.equal(
    result.status,
    0,
    `build-msi con bundle fallo.\nstdout:\n${result.stdout || ''}\nstderr:\n${result.stderr || ''}`
  );

  const installerDir = path.join(root, 'dist', 'installer');
  const internalDir = path.join(installerDir, '_internal');
  assert.equal(fs.existsSync(path.join(internalDir, 'EvaluaPro-saas-completo.msi')), true);
  assert.equal(fs.existsSync(path.join(installerDir, 'EvaluaPro-InstallerHub-saas-completo.exe')), true);
  assert.equal(fs.existsSync(path.join(internalDir, 'EvaluaPro-docente-local.msi')), true);
  assert.equal(fs.existsSync(path.join(installerDir, 'EvaluaPro-InstallerHub-docente-local.exe')), true);
  assert.equal(fs.existsSync(path.join(internalDir, 'installer-local-paths.json')), true);
  assert.equal(fs.existsSync(path.join(installerDir, 'EvaluaPro-saas-completo.msi')), false);
  assert.equal(fs.existsSync(path.join(installerDir, 'EvaluaPro-docente-local.msi')), false);
  assert.equal(fs.existsSync(path.join(installerDir, 'EvaluaPro-saas-completo-Setup.exe')), false);
  assert.equal(fs.existsSync(path.join(installerDir, 'installer-hub-payload-docente-local')), false);
});
