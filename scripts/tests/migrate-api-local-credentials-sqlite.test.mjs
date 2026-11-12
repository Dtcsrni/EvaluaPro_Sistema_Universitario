import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts', 'migrate-api-local-credentials-sqlite.mjs');

test('crea la tabla de credenciales delegadas, índices y ledger de forma idempotente', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-api-credentials-'));
  const database = path.join(tempDir, 'evaluapro.db');
  const db = new DatabaseSync(database);
  db.exec("CREATE TABLE docentes (id TEXT PRIMARY KEY); INSERT INTO docentes VALUES ('doc-a');");
  db.close();
  try {
    await execFileAsync(process.execPath, [script, '--database', database], { windowsHide: true });
    await execFileAsync(process.execPath, [script, '--database', database], { windowsHide: true });
    const check = new DatabaseSync(database);
    try {
      const columns = check.prepare('PRAGMA table_info(credenciales_api_docente)').all().map((row) => row.name);
      assert.deepEqual(columns, ['id', 'docenteId', 'nombre', 'permisos', 'refreshTokenHash', 'createdAt', 'lastUsedAt', 'expiresAt', 'revokedAt']);
      assert.equal(check.prepare('SELECT COUNT(*) AS total FROM evaluapro_schema_migrations WHERE id = ?').get('20261023-api-local-credentials-v1').total, 1);
      assert.equal(check.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='index' AND name='credenciales_api_docente_docenteId_revokedAt_expiresAt_idx'").get().total, 1);
    } finally {
      check.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
