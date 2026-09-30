import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = fs.readFileSync(path.join(root, 'scripts', 'sync-docente-experimental-mirrors.ps1'), 'utf8');

test('el flujo docente experimental define instalación primaria y espejos verificables', () => {
  assert.match(script, /ValidateSet\('publish', 'mirror', 'verify'\)/);
  assert.match(script, /apps\\frontend\\dist-docente/);
  assert.match(script, /frontend-dist-docente/);
  assert.match(script, /Get-TreeSha256/);
  assert.match(script, /sha256Tree/);
  assert.match(script, /operationalAuthority/);
  assert.match(script, /Copy-TreeExact/);
  assert.match(script, /Acquire-SyncLock/);
  assert.match(script, /experimental-mirror-manifest\.json/);
  assert.match(script, /SkipBackup/);
  assert.match(script, /Los espejos no coinciden/);
  assert.doesNotMatch(script, /Path\]::GetRelativePath/);
  assert.doesNotMatch(script, /Get-FileHash/);
  assert.match(script, /Get-RelativePathCompat/);
  assert.match(script, /Get-FileSha256/);
});

test('el modo publish respalda el bundle instalado antes de reemplazarlo', () => {
  const backup = script.indexOf('Get-ChildItem -LiteralPath $entry.Path -Force | Copy-Item -Destination $destination -Recurse -Force');
  const replacePrimary = script.indexOf('Copy-TreeExact $buildMirror $installedPrimary');
  assert.notEqual(backup, -1, 'el flujo debe conservar una copia del árbol instalado');
  assert.notEqual(replacePrimary, -1, 'el modo publish debe actualizar la instalación primaria');
  assert.ok(backup < replacePrimary, 'el respaldo debe ocurrir antes de reemplazar la instalación primaria');
});
