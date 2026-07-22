/** Smoke contractual del servidor estático docente-local. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

const port = 4873;
const child = spawn(process.execPath, ['scripts/serve-docente-static.mjs'], {
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

test.after(() => { if (!child.killed) child.kill(); });

test('servidor docente responde 200 en la raíz y fallback SPA', async () => {
  const deadline = Date.now() + 10_000;
  let response;
  while (Date.now() < deadline) {
    try { response = await fetch(`http://127.0.0.1:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  assert.ok(response, 'el servidor estático no inició');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<html|<!doctype/i);
});
