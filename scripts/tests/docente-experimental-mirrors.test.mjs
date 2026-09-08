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
