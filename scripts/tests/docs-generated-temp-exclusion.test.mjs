import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceGenerator = path.join(repoRoot, 'scripts', 'docs.mjs');

test('docs generator ignores temporary directories and files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-docs-temp-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp', 'checkout-copiado'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'backend', 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'docs.mjs'), fs.readFileSync(sourceGenerator));
  fs.writeFileSync(path.join(root, 'apps', 'backend', 'src', 'runtime.mjs'), 'process.env.RUNTIME_VARIABLE;\n');
  fs.writeFileSync(path.join(root, '.tmp', 'checkout-copiado', 'debug.mjs'), 'process.env.COPIED_DEBUG_VARIABLE;\n');
  fs.writeFileSync(path.join(root, 'apps', 'backend', 'src', '.tmp-debug.mjs'), 'process.env.TEMP_FILE_VARIABLE;\n');

  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'docs.mjs'), '--write'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const generated = fs.readFileSync(path.join(root, 'docs', 'AUTO_ENV.md'), 'utf8');
  assert.match(generated, /RUNTIME_VARIABLE/);
  assert.doesNotMatch(generated, /COPIED_DEBUG_VARIABLE|TEMP_FILE_VARIABLE/);
});
