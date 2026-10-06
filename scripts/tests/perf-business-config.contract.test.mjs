import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('perf business carga explícitamente la configuración Prisma del backend', () => {
  const collector = fs.readFileSync(path.join(root, 'scripts', 'perf-collect-business.ts'), 'utf8');
  const prismaConfig = fs.readFileSync(path.join(root, 'apps', 'backend', 'prisma.config.mjs'), 'utf8');

  assert.match(collector, /prisma\.config\.mjs/);
  assert.match(collector, /db push --config=/);
  assert.match(prismaConfig, /datasource:\s*\{\s*url:\s*process\.env\.DATABASE_URL/);
});
