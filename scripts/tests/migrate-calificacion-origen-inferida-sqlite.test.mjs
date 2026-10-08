import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'scripts', 'migrate-calificacion-origen-inferida-sqlite.mjs');

test('agrega procedencia a calificaciones existentes de forma aditiva e idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalua-calificacion-origen-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`CREATE TABLE calificaciones (id TEXT PRIMARY KEY, calificacion REAL NOT NULL);
      INSERT INTO calificaciones VALUES ('c1', 8.5);`);
  } finally {
    db.close();
  }

  try {
    const first = await execFileAsync(process.execPath, [script, '--database', dbPath]);
    assert.match(first.stdout, /"applied":true/);
    const second = await execFileAsync(process.execPath, [script, '--database', dbPath]);
    assert.match(second.stdout, /"applied":false/);

    const verify = new DatabaseSync(dbPath);
    try {
      const columns = verify.prepare('PRAGMA table_info(calificaciones)').all().map((column) => column.name);
      assert.ok(columns.includes('origen'));
      assert.ok(columns.includes('origenEvidencia'));
      const existing = verify.prepare('SELECT id, calificacion FROM calificaciones').get();
      assert.equal(existing.id, 'c1');
      assert.equal(existing.calificacion, 8.5);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
