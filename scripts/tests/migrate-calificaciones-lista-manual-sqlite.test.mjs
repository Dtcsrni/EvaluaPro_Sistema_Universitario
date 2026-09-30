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
const script = path.join(root, 'scripts', 'migrate-calificaciones-lista-manual-sqlite.mjs');

test('crea la tabla manual de forma aditiva, idempotente y con unicidad por componente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalua-lista-migration-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
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
      const tables = verify.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
      assert.ok(tables.includes('docentes'));
      assert.ok(tables.includes('calificaciones_lista_manual'));
      verify.prepare(`INSERT INTO calificaciones_lista_manual
        (id, docenteId, periodoId, alumnoId, componente, calificacion, capturadoPor)
        VALUES ('g1','d1','p1','a1','Practica 2do Parcial',8,'d1')`).run();
      assert.throws(() => verify.prepare(`INSERT INTO calificaciones_lista_manual
        (id, docenteId, periodoId, alumnoId, componente, calificacion, capturadoPor)
        VALUES ('g2','d1','p1','a1','Practica 2do Parcial',9,'d1')`).run());
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM calificaciones_lista_manual').get().total, 1);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
