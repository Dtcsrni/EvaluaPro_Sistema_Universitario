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

import {
  cargarVariablesEnvDesdeArchivo,
  leerVariablesEnvDesdeArchivo,
  obtenerClavesEnvAutoritativas,
  obtenerClavesEnvIgnorar,
  obtenerClavesEnvLimpiarSiAusentes,
  resolverContextoEnvRuntime
} from '../runtime-env.mjs';

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

test('el runtime docente local recarga solo el interruptor y la llave legado de Classroom', () => {
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
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_ID, 'stale-client');
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_SECRET, 'stale-secret');
  assert.equal(target.GOOGLE_CLASSROOM_REDIRECT_URI, 'http://127.0.0.1:3999/stale');
  assert.equal(target.CLASSROOM_TOKEN_CIPHER_KEY, 'cipher-current');
});

test('el runtime productivo local prioriza el JWT y las claves OMR del .env instalado', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, [
    'JWT_SECRETO=jwt-installed-current',
    'OMR_QR_HMAC_KEY_ID=QR-H1-V1',
    'OMR_QR_HMAC_SECRET=qr-secret-installed-current'
  ].join('\n'), 'utf8');

  const target = {
    JWT_SECRETO: 'jwt-stale-from-supervisor',
    OMR_QR_HMAC_KEY_ID: 'old-key-id',
    OMR_QR_HMAC_SECRET: 'old-qr-secret',
    OMR_QR_HMAC_SECRETS_JSON: '{"old-key-id":"old-qr-secret"}',
    OMR_QR_RECOVERY_SECRET: 'old-recovery-secret'
  };
  const runtime = { nodeEnv: 'production', flavor: 'docente-local' };

  cargarVariablesEnvDesdeArchivo(envPath, target, {
    overrideKeys: obtenerClavesEnvAutoritativas(runtime),
    clearMissingKeys: obtenerClavesEnvLimpiarSiAusentes(runtime),
    ignoreKeys: obtenerClavesEnvIgnorar(runtime)
  });

  assert.equal(target.JWT_SECRETO, 'jwt-installed-current');
  assert.equal(target.OMR_QR_HMAC_KEY_ID, 'QR-H1-V1');
  assert.equal(target.OMR_QR_HMAC_SECRET, 'qr-secret-installed-current');
  assert.equal(Object.hasOwn(target, 'OMR_QR_HMAC_SECRETS_JSON'), false);
  assert.equal(Object.hasOwn(target, 'OMR_QR_RECOVERY_SECRET'), false);
});

test('el modo de producción instalado define la autoridad aunque el supervisor herede otro flavor', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, [
    'NODE_ENV=production',
    'EVALUAPRO_FLAVOR=docente-local',
    'JWT_SECRETO=jwt-installed-current',
    'OMR_QR_HMAC_KEY_ID=QR-H1-V1',
    'OMR_QR_HMAC_SECRET=qr-secret-installed-current'
  ].join('\n'), 'utf8');

  const target = {
    NODE_ENV: 'development',
    EVALUAPRO_FLAVOR: 'docente-cloud',
    JWT_SECRETO: 'jwt-stale-from-supervisor',
    OMR_QR_HMAC_KEY_ID: 'old-key-id',
    OMR_QR_HMAC_SECRET: 'old-qr-secret'
  };
  const installed = leerVariablesEnvDesdeArchivo(envPath);
  const runtime = resolverContextoEnvRuntime(installed, {
    NODE_ENV: 'development',
    EVALUAPRO_FLAVOR: 'docente-cloud'
  });

  cargarVariablesEnvDesdeArchivo(envPath, target, {
    overrideKeys: obtenerClavesEnvAutoritativas(runtime),
    clearMissingKeys: obtenerClavesEnvLimpiarSiAusentes(runtime)
  });

  assert.equal(target.NODE_ENV, 'production');
  assert.equal(target.EVALUAPRO_FLAVOR, 'docente-local');
  assert.equal(target.JWT_SECRETO, 'jwt-installed-current');
  assert.equal(target.OMR_QR_HMAC_KEY_ID, 'QR-H1-V1');
  assert.equal(target.OMR_QR_HMAC_SECRET, 'qr-secret-installed-current');
});

test('el launcher E2E mantiene el perfil y JWT de prueba aunque encuentre un .env productivo', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, [
    'NODE_ENV=production',
    'EVALUAPRO_FLAVOR=docente-local',
    'JWT_SECRETO=jwt-production',
    'OMR_QR_HMAC_SECRET=qr-secret-production'
  ].join('\n'), 'utf8');

  const target = {
    NODE_ENV: 'test',
    JWT_SECRETO: 'jwt-e2e-only',
    OMR_QR_HMAC_SECRET: 'qr-secret-e2e-only'
  };
  const installed = leerVariablesEnvDesdeArchivo(envPath);
  const runtime = resolverContextoEnvRuntime(installed, {
    NODE_ENV: 'test',
    EVALUAPRO_E2E_BUILD: '1',
    JWT_SECRETO: 'jwt-e2e-only'
  });

  cargarVariablesEnvDesdeArchivo(envPath, target, {
    overrideKeys: obtenerClavesEnvAutoritativas(runtime),
    clearMissingKeys: obtenerClavesEnvLimpiarSiAusentes(runtime),
    ignoreKeys: obtenerClavesEnvIgnorar(runtime)
  });

  assert.equal(target.NODE_ENV, 'test');
  assert.equal(target.JWT_SECRETO, 'jwt-e2e-only');
  assert.equal(Object.hasOwn(target, 'OMR_QR_HMAC_SECRET'), false);
  assert.equal(obtenerClavesEnvIgnorar(runtime).includes('JWT_SECRETO'), false);
});

test('un .env instalado sin modo explícito no hereda el flavor o modo viejo del supervisor', () => {
  const runtime = resolverContextoEnvRuntime({}, {
    NODE_ENV: 'development',
    EVALUAPRO_FLAVOR: 'docente-cloud'
  }, { installedEnvPresent: true });

  assert.deepEqual(runtime, { nodeEnv: 'production', flavor: 'docente-local' });
});

test('sin .env ni modo dev explícito, el launcher falla cerrado como producción local', () => {
  const runtime = resolverContextoEnvRuntime({}, {
    NODE_ENV: 'development',
    EVALUAPRO_FLAVOR: 'docente-cloud'
  }, { installedEnvPresent: false });

  assert.deepEqual(runtime, { nodeEnv: 'production', flavor: 'docente-local' });
});

test('el modo dev explícito permanece disponible sin .env', () => {
  const runtime = resolverContextoEnvRuntime({}, {
    NODE_ENV: 'production',
    EVALUAPRO_MODE: 'dev'
  }, { installedEnvPresent: false });

  assert.deepEqual(runtime, { nodeEnv: 'development', flavor: 'docente-local-dev' });
});

test('producción elimina JWT y claves OMR heredados cuando no existe el .env instalado', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env-missing');
  const target = {
    JWT_SECRETO: 'jwt-stale-from-supervisor',
    OMR_QR_HMAC_SECRET: 'old-qr-secret',
    OMR_QR_HMAC_SECRETS_JSON: '{"old":"secret"}'
  };
  const runtime = { nodeEnv: 'production', flavor: 'docente-local' };

  cargarVariablesEnvDesdeArchivo(envPath, target, {
    clearMissingKeys: obtenerClavesEnvLimpiarSiAusentes(runtime)
  });

  assert.equal(Object.hasOwn(target, 'JWT_SECRETO'), false);
  assert.equal(Object.hasOwn(target, 'OMR_QR_HMAC_SECRET'), false);
  assert.equal(Object.hasOwn(target, 'OMR_QR_HMAC_SECRETS_JSON'), false);
});

test('un runtime que no es producción docente-local no reemplaza overrides Classroom del proceso', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-runtime-env-'));
  const envPath = path.join(tempRoot, '.env');
  fs.writeFileSync(envPath, 'CLASSROOM_ENABLED=1\nGOOGLE_CLASSROOM_CLIENT_ID=file-client\n', 'utf8');
  const target = { CLASSROOM_ENABLED: '0', GOOGLE_CLASSROOM_CLIENT_ID: 'parent-client' };
  const overrideKeys = obtenerClavesEnvAutoritativas({ nodeEnv: 'production', flavor: 'docente-cloud' });
  const clearMissingKeys = obtenerClavesEnvLimpiarSiAusentes({ nodeEnv: 'production', flavor: 'docente-cloud' });

  cargarVariablesEnvDesdeArchivo(envPath, target, { overrideKeys });

  assert.deepEqual(overrideKeys, []);
  assert.deepEqual(clearMissingKeys, []);
  assert.equal(target.CLASSROOM_ENABLED, '0');
  assert.equal(target.GOOGLE_CLASSROOM_CLIENT_ID, 'parent-client');
});
