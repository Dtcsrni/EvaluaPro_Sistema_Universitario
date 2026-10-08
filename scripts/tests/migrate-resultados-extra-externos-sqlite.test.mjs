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
const script = path.join(root, 'scripts', 'migrate-resultados-extra-externos-sqlite.mjs');

test('crea los resultados Extra externos con FKs, unicidad e idempotencia', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-extra-externo-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE docentes (id TEXT PRIMARY KEY);
      CREATE TABLE periodos (id TEXT PRIMARY KEY);
      CREATE TABLE alumnos (id TEXT PRIMARY KEY);
      INSERT INTO docentes VALUES ('d1');
      INSERT INTO periodos VALUES ('p1');
      INSERT INTO alumnos VALUES ('a1');
    `);
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
      verify.exec('PRAGMA foreign_keys = ON;');
      const columns = verify.prepare('PRAGMA table_info(resultados_extra_externos)').all().map((row) => row.name);
      assert.ok(columns.includes('documentoSha256'));
      assert.ok(columns.includes('clientRequestId'));
      const insert = `INSERT INTO resultados_extra_externos
        (id, docenteId, periodoId, alumnoId, folio, fuenteArchivo, documentoSha256, aciertos, totalReactivos,
        calificacionSobre5Exacta, calificacionSobre5Texto, calificacionSobre10Texto, estadoAprobatorio, evidencia,
        clientRequestId, payloadHash, capturadoPor)
        VALUES (?, 'd1', 'p1', 'a1', ?, 'extra.pdf', ?, 16, 35, '16/7', '2.29', '4.57', 'No aprobatoria', '{}', ?, 'hash', 'd1')`;
      verify.prepare(insert).run('r1', '88DC8464', 'a'.repeat(64), 'request-1');
      assert.throws(() => verify.prepare(insert).run('r2', '88DC8464', 'a'.repeat(64), 'request-2'));
      assert.throws(() => verify.prepare(insert).run('r3', '88DC8465', 'a'.repeat(64), 'request-1'));
      const invalidDocente = insert.replace("VALUES (?, 'd1'", "VALUES (?, 'missing'");
      assert.throws(() => verify.prepare(invalidDocente).run('r4', '88DC8466', 'a'.repeat(64), 'request-4'));
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM resultados_extra_externos').get().total, 1);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
