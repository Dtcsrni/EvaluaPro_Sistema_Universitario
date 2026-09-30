/**
 * runtime-env.test
 *
 * Responsabilidad: Proteger la carga del `.env` instalado frente a overrides vacíos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { cargarVariablesEnvDesdeArchivo, obtenerClavesEnvAutoritativas } from '../runtime-env.mjs';

test('carga valores del .env cuando el proceso solo heredó variables vacías', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, 'GOOGLE_OAUTH_CLIENT_ID=login-from-file\nGOOGLE_CLASSROOM_CLIENT_ID=classroom-from-file\n', 'utf8');

  const target = {
    GOOGLE_OAUTH_CLIENT_ID: '',
    GOOGLE_CLASSROOM_CLIENT_ID: 'classroom-from-parent'
  };

  cargarVariablesEnvDesdeArchivo(envPath, target);

  assert.equal(target.GOOGLE_OAUTH_CLIENT_ID, 'login-from-file');
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_ID, 'classroom-from-parent');
});

test('permite que el launcher nativo priorice las URLs SQLite del .env instalado', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, 'DATABASE_URL=file:C:/Users/evega/AppData/Local/EvaluaPro/data/evaluapro.db\n', 'utf8');

  const target = { DATABASE_URL: 'file:./data/evaluapro.db' };

  cargarVariablesEnvDesdeArchivo(envPath, target, { overrideKeys: ['DATABASE_URL'] });

  assert.equal(target.DATABASE_URL, 'file:C:/Users/evega/AppData/Local/EvaluaPro/data/evaluapro.db');
});

test('el runtime docente local recarga Classroom desde .env aunque el supervisor conserve valores antiguos', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, [
    'CLASSROOM_ENABLED=0',
    'GOOGLE_CLASSROOM_CLIENT_ID=',
    'GOOGLE_CLASSROOM_CLIENT_SECRET=',
    'GOOGLE_CLASSROOM_REDIRECT_URI=',
    'CLASSROOM_TOKEN_CIPHER_KEY=',
    'CLASSROOM_ENABLED=1',
    'GOOGLE_CLASSROOM_CLIENT_ID=classroom-current',
    'GOOGLE_CLASSROOM_CLIENT_SECRET=secret-current',
    'GOOGLE_CLASSROOM_REDIRECT_URI=http://127.0.0.1:4000/api/integraciones/classroom/oauth/callback',
    'CLASSROOM_TOKEN_CIPHER_KEY=cipher-current'
  ].join('\n'), 'utf8');

  const target = {
    CLASSROOM_ENABLED: '0',
    GOOGLE_CLASSROOM_CLIENT_ID: 'stale-client',
    GOOGLE_CLASSROOM_CLIENT_SECRET: 'stale-secret',
    GOOGLE_CLASSROOM_REDIRECT_URI: 'http://127.0.0.1:3999/stale',
    CLASSROOM_TOKEN_CIPHER_KEY: 'stale-cipher'
  };
  const overrideKeys = obtenerClavesEnvAutoritativas({ nodeEnv: 'production', flavor: 'docente-local' });
  cargarVariablesEnvDesdeArchivo(envPath, target, { overrideKeys });

  assert.equal(target.CLASSROOM_ENABLED, '1');
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_ID, 'classroom-current');
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_SECRET, 'secret-current');
  assert.equal(target.GOOGLE_CLASSROOM_REDIRECT_URI, 'http://127.0.0.1:4000/api/integraciones/classroom/oauth/callback');
  assert.equal(target.CLASSROOM_TOKEN_CIPHER_KEY, 'cipher-current');
});

test('un runtime que no es producción docente-local no reemplaza overrides Classroom del proceso', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, 'CLASSROOM_ENABLED=1\nGOOGLE_CLASSROOM_CLIENT_ID=file-client\n', 'utf8');
  const target = { CLASSROOM_ENABLED: '0', GOOGLE_CLASSROOM_CLIENT_ID: 'parent-client' };
  const overrideKeys = obtenerClavesEnvAutoritativas({ nodeEnv: 'production', flavor: 'docente-cloud' });

  cargarVariablesEnvDesdeArchivo(envPath, target, { overrideKeys });

  assert.deepEqual(overrideKeys, []);
  assert.equal(target.CLASSROOM_ENABLED, '0');
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_ID, 'parent-client');
});
