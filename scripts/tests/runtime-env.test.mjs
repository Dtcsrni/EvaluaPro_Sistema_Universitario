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

import { cargarVariablesEnvDesdeArchivo } from '../runtime-env.mjs';

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
