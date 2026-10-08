import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = fs.readFileSync(path.join(repoRoot, '.github', 'dependabot.yml'), 'utf8');

test('Dependabot revisa actualizaciones semanales en cada workspace npm', () => {
  const entries = config.split(/^  - package-ecosystem:/m).slice(1);
  const npmEntries = entries.filter((entry) => /^\s*"npm"/m.test(entry));

  assert.deepEqual(
    npmEntries.map((entry) => entry.match(/^    directory: "([^"]+)"/m)?.[1]),
    ['/', '/apps/backend', '/apps/frontend', '/apps/portal_alumno_cloud'],
  );

  for (const entry of npmEntries) {
    assert.match(entry, /^    open-pull-requests-limit: 5$/m);
    assert.match(entry, /^    schedule:\n      interval: "weekly"$/m);
    assert.doesNotMatch(entry, /^    target-branch:/m);
  }

  assert.match(config, /^version: 2$/m);
  assert.doesNotMatch(config, /open-pull-requests-limit: 0/);
});
