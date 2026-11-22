import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { obtenerConfiguracionRuntime, PUERTOS_RUNTIME, resolverPerfilRuntime } from '../runtime-profiles.mjs';

test('producción conserva sus puertos y fija SQLite en ProgramData', () => {
  const config = obtenerConfiguracionRuntime('prod', 'C:/checkout', 'C:/ProgramData');
  assert.deepEqual(config.puertos, { api: 4000, web: 4173, dashboard: 4519 });
  assert.equal(config.databasePath, path.join('C:/ProgramData', 'EvaluaPro', 'data', 'evaluapro.db'));
  assert.equal(config.nodeEnv, 'production');
});

test('desarrollo y pruebas usan puertos y bases separados de producción', () => {
  const dev = obtenerConfiguracionRuntime('dev', 'C:/checkout', 'C:/ProgramData');
  const testProfile = obtenerConfiguracionRuntime('test', 'C:/checkout', 'C:/ProgramData');
  assert.deepEqual(dev.puertos, { api: 4001, web: 4174, dashboard: 4520 });
  assert.deepEqual(testProfile.puertos, { api: 4100, web: 4175, dashboard: 4521 });
  assert.notEqual(dev.databasePath, obtenerConfiguracionRuntime('prod', 'C:/checkout', 'C:/ProgramData').databasePath);
  assert.notEqual(testProfile.databasePath, dev.databasePath);
  assert.match(dev.databasePath, /data-dev/);
  assert.equal(dev.databaseIdentity, createHash('sha256').update(`dev\n${dev.databaseUrl}`).digest('hex').slice(0, 16));
});

test('el modo de pruebas tiene precedencia y el modo predeterminado es producción', () => {
  assert.equal(resolverPerfilRuntime({ EVALUAPRO_E2E_BUILD: '1', EVALUAPRO_MODE: 'prod' }), 'test');
  assert.equal(resolverPerfilRuntime({ EVALUAPRO_MODE: 'dev' }), 'dev');
  assert.equal(resolverPerfilRuntime({}), 'prod');
  assert.notDeepEqual(PUERTOS_RUNTIME.dev, PUERTOS_RUNTIME.prod);
});
