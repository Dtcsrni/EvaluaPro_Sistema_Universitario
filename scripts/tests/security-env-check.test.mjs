/**
 * security-env-check.test
 *
 * Responsabilidad: Validar la configuración de entorno estricta para SQLite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const root = process.cwd();
const checker = path.join(root, 'scripts', 'security-env-check.mjs');
const insecureProductionSecret = /cambia-este-secreto|admin|1234|test/i;

function createProductionJwtSecret(generateRandomBytes = () => randomBytes(48)) {
  let secret;
  do {
    secret = generateRandomBytes().toString('hex');
  } while (insecureProductionSecret.test(secret));
  return secret;
}

test('el secreto JWT de prueba vuelve a sortear secuencias que producción rechaza', () => {
  const generated = [
    Buffer.from(`1234${'a'.repeat(92)}`, 'hex'),
    Buffer.from('b'.repeat(96), 'hex')
  ];
  const secret = createProductionJwtSecret(() => generated.shift());

  assert.equal(secret, 'b'.repeat(96));
  assert.equal(generated.length, 0);
});

function runChecker(databaseEnv) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'evaluapro-security-env-'));
  try {
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      STRICT_ENV_CHECK: '1',
      JWT_SECRETO: createProductionJwtSecret(),
      PORTAL_ALUMNO_API_KEY: randomBytes(32).toString('hex'),
      CORS_ORIGENES: 'http://127.0.0.1:4173',
      DATABASE_URL: '',
      BACKEND_DATABASE_URL: '',
      MONGODB_URI: '',
      ...databaseEnv
    };
    return spawnSync(process.execPath, [checker], { cwd, env, encoding: 'utf8' });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('el modo estricto acepta BACKEND_DATABASE_URL SQLite y no imprime secretos', () => {
  const result = runChecker({ BACKEND_DATABASE_URL: 'file:./data/evaluapro_ci.db' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[env-check\] OK/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /JWT_SECRETO=.*[0-9a-f]{32,}/);
});

test('el modo estricto acepta DATABASE_URL SQLite como alternativa', () => {
  const result = runChecker({ DATABASE_URL: 'file:./data/evaluapro_ci.db' });
  assert.equal(result.status, 0, result.stderr);
});

test('MONGODB_URI no satisface el requisito de SQLite', () => {
  const result = runChecker({ MONGODB_URI: 'mongodb://127.0.0.1:27017/evaluapro_ci' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKEND_DATABASE_URL o DATABASE_URL \(SQLite\)/);
});

test('el modo estricto rechaza una URL que no sea file SQLite', () => {
  const result = runChecker({ DATABASE_URL: 'postgresql://127.0.0.1/evaluapro_ci' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /debe usar SQLite con el esquema file:/);
});
