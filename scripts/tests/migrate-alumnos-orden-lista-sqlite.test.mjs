import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');

test('agrega y ordena alumnos existentes de forma reproducible, y es idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-alumno-order-'));
  const databasePath = path.join(dir, 'evaluapro.db');
  const database = new DatabaseSync(databasePath);
  database.exec(`CREATE TABLE alumnos (id TEXT PRIMARY KEY, periodoId TEXT, matricula TEXT, createdAt TEXT);
    INSERT INTO alumnos VALUES ('b','p1','CUH2','2026-01-02');
    INSERT INTO alumnos VALUES ('a','p1','CUH1','2026-01-01');
    INSERT INTO alumnos VALUES ('c','p2','CUH3','2026-01-01');`);
  database.close();

  try {
    const migracion = path.join(root, 'scripts', 'migrate-alumnos-orden-lista-sqlite.mjs');
    const primera = await execFileAsync(process.execPath, [migracion, '--database', databasePath]);
    assert.match(primera.stdout, /"applied":true/);
    const verificacion = new DatabaseSync(databasePath);
    try {
      assert.deepEqual(verificacion.prepare('SELECT id, ordenLista FROM alumnos WHERE periodoId = ? ORDER BY ordenLista').all('p1').map((row) => ({ ...row })),
        [{ id: 'a', ordenLista: 1 }, { id: 'b', ordenLista: 2 }]);
      assert.deepEqual(verificacion.prepare('SELECT id, ordenLista FROM alumnos WHERE periodoId = ? ORDER BY ordenLista').all('p2').map((row) => ({ ...row })),
        [{ id: 'c', ordenLista: 1 }]);
    } finally {
      verificacion.close();
    }
    const segunda = await execFileAsync(process.execPath, [migracion, '--database', databasePath]);
    assert.match(segunda.stdout, /"applied":false/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
