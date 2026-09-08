import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const nativeLauncher = fs.readFileSync(path.join(root, 'scripts', 'start-docente-native.mjs'), 'utf8');
const staticServer = fs.readFileSync(path.join(root, 'scripts', 'serve-docente-static.mjs'), 'utf8');

test('el arranque nativo evita duplicar API o web cuando el puerto ya está ocupado', () => {
  assert.match(nativeLauncher, /probeHttpEndpoint/);
  assert.match(nativeLauncher, /isPortInUse/);
  assert.match(nativeLauncher, /canLaunchHttpService\('api'/);
  assert.match(nativeLauncher, /canLaunchHttpService\('web'/);
  assert.match(nativeLauncher, /se evita un segundo proceso/);
  assert.match(nativeLauncher, /se mantiene el supervisor activo/);
});

test('el servidor estático registra EADDRINUSE sin dejar un error no controlado', () => {
  assert.match(staticServer, /server\.on\('error'/);
  assert.match(staticServer, /no se pudo iniciar/);
  assert.doesNotMatch(staticServer, /server\.listen\([^\n]+\);\s*\n\s*function stop/);
});
