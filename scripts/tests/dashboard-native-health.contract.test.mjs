import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'launcher-dashboard.mjs'), 'utf8');

test('el flavor docente-local no queda bloqueado por MongoDB', () => {
  assert.match(source, /requireMongo\s*=\s*requiresDockerRuntime\(\)/);
  assert.match(source, /const mongoOk = !requireMongo \|\| Boolean\(services\?\.mongoLocal\?\.ok\)/);
  assert.match(source, /flavorPolicy\.requireDockerRuntime/);
  assert.match(source, /waitForLifecycleHealth\(desiredMode, requireLocalPortal, requireMongo/);
});

test('repara procesos nativos obsoletos y espera su salida antes de reiniciar', () => {
  assert.match(source, /shouldRestartUnhealthyTask\(desiredMode, servicesBefore, desiredMode\)/);
  assert.match(source, /const webKey = desiredMode === 'prod' \? 'webDocenteProd' : 'webDocenteDev'/);
  assert.match(source, /if \(isRunning\(name\)\)/);
  assert.match(source, /el proceso anterior no termino/);
  assert.match(source, /startupCheck = startedDesired \|\| restartedUnhealthyDesired \|\| startedPortal/);
});
