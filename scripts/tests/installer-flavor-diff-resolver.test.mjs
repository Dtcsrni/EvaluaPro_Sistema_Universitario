import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const resolverPath = path.join(root, 'scripts', 'release', 'resolve-affected-installer-flavors.mjs');

test('resolver de flavors sin refs de diff cae en all (seguro)', () => {
  const stdout = execFileSync(process.execPath, [resolverPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const parsed = JSON.parse(String(stdout || '{}'));
  assert.equal(parsed.build_flavor_arg, 'all');
  assert.match(String(parsed.flavors_csv || ''), /docente-local/);
  assert.match(String(parsed.flavors_csv || ''), /saas-completo/);
});
