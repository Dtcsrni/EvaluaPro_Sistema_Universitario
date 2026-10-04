import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertDocenteBundle } from '../docente-bundle-guard.mjs';

const contract = 'docente-frosted-editorial-v2';

function crearBundle(js) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-docente-bundle-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), `<meta name="evaluapro-ui-contract" content="${contract}"><script type="module" src="/assets/index.js"></script><link href="/assets/index.css" rel="stylesheet">`);
  fs.writeFileSync(path.join(root, 'assets', 'index.js'), js);
  fs.writeFileSync(path.join(root, 'assets', 'index.css'), `:root{--docente-style-contract:${contract}}`);
  return root;
}

test('acepta bundle que carga Google Client ID desde capacidades runtime', (t) => {
  const root = crearBundle('fetch("/api/autenticacion/capacidades-integraciones").then(x=>x.googleOauthClientId)');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(assertDocenteBundle({ distRoot: root }).googleRuntimeBootstrap, true);
});

test('rechaza bundle docente sin el bootstrap de Google OAuth runtime', (t) => {
  const root = crearBundle('const login="Acceso docente"');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => assertDocenteBundle({ distRoot: root }), /bootstrap OAuth runtime/);
});