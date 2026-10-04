import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'scripts', 'migrate-calificaciones-lista-idempotencia-sqlite.mjs');

test('crea el registro idempotente de calificaciones de forma aditiva e idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalua-lista-idempotencia-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("CREATE TABLE docentes (id TEXT PRIMARY KEY); INSERT INTO docentes VALUES ('d1'), ('d2');");
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
      verify.prepare(`INSERT INTO calificaciones_lista_manual_mutaciones
        (id, docenteId, clientRequestId, payloadHash, calificacionId)
        VALUES ('m1','d1','request-1','hash-1','grade-1')`).run();
      assert.throws(() => verify.prepare(`INSERT INTO calificaciones_lista_manual_mutaciones
        (id, docenteId, clientRequestId, payloadHash, calificacionId)
        VALUES ('m2','d1','request-1','hash-2','grade-2')`).run());
      verify.prepare(`INSERT INTO calificaciones_lista_manual_mutaciones
        (id, docenteId, clientRequestId, payloadHash, calificacionId)
        VALUES ('m3','d2','request-1','hash-3','grade-3')`).run();
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM calificaciones_lista_manual_mutaciones').get().total, 2);
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM docentes').get().total, 2);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
