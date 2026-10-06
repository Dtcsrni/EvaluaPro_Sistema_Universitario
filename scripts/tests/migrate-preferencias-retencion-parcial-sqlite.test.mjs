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
const script = path.join(root, 'scripts', 'migrate-preferencias-retencion-parcial-sqlite.mjs');

test('crea la preferencia de retención con FK sin cambiar docentes existentes y es idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalua-retencion-parcial-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("CREATE TABLE docentes (id TEXT PRIMARY KEY); INSERT INTO docentes VALUES ('d1');");
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
      const table = verify.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='preferencias_retencion_parcial'").get();
      assert.equal(table.name, 'preferencias_retencion_parcial');
      assert.equal(verify.prepare('SELECT id FROM docentes').get().id, 'd1');
      const foreignKeys = verify.prepare('PRAGMA foreign_key_list(preferencias_retencion_parcial)').all();
      assert.equal(foreignKeys.length, 1);
      assert.equal(foreignKeys[0].table, 'docentes');
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
