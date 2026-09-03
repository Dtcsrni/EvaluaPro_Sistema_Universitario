/**
 * classroom-doctor.test
 *
 * Responsabilidad: Contrato del doctor no sensible de Classroom.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateClassroomConfig, loadEnvForDoctor } from '../classroom-doctor.mjs';

function validEnv() {
  return {
    GOOGLE_CLASSROOM_CLIENT_ID: 'client-id',
    GOOGLE_CLASSROOM_CLIENT_SECRET: 'client-secret',
    GOOGLE_CLASSROOM_REDIRECT_URI: 'https://example.edu/api/integraciones/classroom/oauth/callback',
    CLASSROOM_TOKEN_CIPHER_KEY: crypto.randomBytes(32).toString('base64')
  };
}

test('classroom doctor pasa con prerequisitos presentes y formatos validos', () => {
  const result = evaluateClassroomConfig(validEnv());
  assert.equal(result.ok, true);
  assert.equal(result.checks.every((check) => check.ok), true);
});

test('classroom doctor falla si falta client secret', () => {
  const env = validEnv();
  delete env.GOOGLE_CLASSROOM_CLIENT_SECRET;
  const result = evaluateClassroomConfig(env);
  assert.equal(result.ok, false);
  assert.equal(result.checks.some((check) => check.id === 'GOOGLE_CLASSROOM_CLIENT_SECRET' && check.detail === 'faltante'), true);
});

test('classroom doctor no expone valores sensibles en detalles', () => {
  const env = validEnv();
  const result = evaluateClassroomConfig(env);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(env.GOOGLE_CLASSROOM_CLIENT_SECRET), false);
  assert.equal(serialized.includes(env.CLASSROOM_TOKEN_CIPHER_KEY), false);
});

test('classroom doctor rechaza llave de cifrado con longitud invalida', () => {
  const env = { ...validEnv(), CLASSROOM_TOKEN_CIPHER_KEY: Buffer.from('short').toString('base64') };
  const result = evaluateClassroomConfig(env);
  assert.equal(result.ok, false);
  assert.equal(result.checks.some((check) => check.id === 'CLASSROOM_TOKEN_CIPHER_KEY_FORMAT' && check.ok === false), true);
});

test('classroom doctor con ruta explicita no hereda secretos del proceso padre', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-classroom-doctor-'));
  const envPath = path.join(tempRoot, '.env');
  const previousSecret = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET;
  process.env.GOOGLE_CLASSROOM_CLIENT_SECRET = 'ambient-secret-must-not-be-used';
  try {
    fs.writeFileSync(envPath, 'GOOGLE_CLASSROOM_CLIENT_ID=file-client\n', 'utf8');
    const loaded = loadEnvForDoctor(envPath);
    assert.equal(loaded.env.GOOGLE_CLASSROOM_CLIENT_ID, 'file-client');
    assert.equal(loaded.env.GOOGLE_CLASSROOM_CLIENT_SECRET, undefined);
  } finally {
    if (previousSecret === undefined) delete process.env.GOOGLE_CLASSROOM_CLIENT_SECRET;
    else process.env.GOOGLE_CLASSROOM_CLIENT_SECRET = previousSecret;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
