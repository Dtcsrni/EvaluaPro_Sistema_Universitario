import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = fs.readFileSync(path.join(repoRoot, '.github', 'dependabot.yml'), 'utf8');
const installerBuild = fs.readFileSync(path.join(repoRoot, 'scripts', 'build-msi.ps1'), 'utf8');

test('Dependabot mantiene npm desde la raíz para sincronizar manifests y lockfiles del workspace', () => {
  const entries = config.split(/^  - package-ecosystem:/m).slice(1);
  const npmEntries = entries.filter((entry) => /^\s*"npm"/m.test(entry));

  assert.deepEqual(npmEntries.map((entry) => entry.match(/^    directory: "([^"]+)"/m)?.[1]), ['/']);

  for (const entry of npmEntries) {
    assert.match(entry, /^    open-pull-requests-limit: 5$/m);
    assert.match(entry, /^    schedule:\n      interval: "weekly"$/m);
    assert.match(entry, /^    rebase-strategy: "auto"$/m);
    assert.doesNotMatch(entry, /^    target-branch:/m);
  }

  assert.match(config, /^version: 2$/m);
  assert.doesNotMatch(config, /open-pull-requests-limit: 0/);
});

test('el MSI docente instala desde el lock npm raíz y no consume el lock hijo del backend', () => {
  assert.match(installerBuild, /Join-Path \$RootPath 'package-lock\.json'/);
  assert.match(installerBuild, /& \$npmCommand ci --workspace=apps\/backend --include-workspace-root=false --omit=dev --ignore-scripts/);
  assert.match(installerBuild, /& \$npmCommand prune --omit=dev --ignore-scripts --package-lock=false/);
  assert.doesNotMatch(installerBuild, /apps\/backend\/package-lock\.json/);
});
