import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..', '..');

test('la migracion de reactivos es aditiva e idempotente', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-reactivos-migration-'));
  const database = path.join(dir, 'evaluapro.db');
  const script = path.join(root, 'scripts', 'migrate-reactivos-sqlite.mjs');
  const legacyDb = new DatabaseSync(database);
  try {
    legacyDb.exec(`
      CREATE TABLE docentes (id TEXT PRIMARY KEY, correo TEXT NOT NULL);
      CREATE TABLE banco_preguntas (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, periodoId TEXT NOT NULL, tema TEXT, enunciado TEXT);
      INSERT INTO docentes (id, correo) VALUES ('docente-legacy', 'legacy@evaluapro.test');
      INSERT INTO banco_preguntas (id, docenteId, periodoId, tema, enunciado) VALUES ('pregunta-legacy', 'docente-legacy', 'periodo-legacy', 'Segundo Parcial', 'Reactivo histórico');
    `);
  } finally {
    legacyDb.close();
  }
  const primera = await execFileAsync(process.execPath, [script, '--database', database]);
  const resultadoPrimero = JSON.parse(primera.stdout);
  assert.equal(resultadoPrimero.applied, true);
  assert.equal(fs.existsSync(resultadoPrimero.backupPath), true);
  const backupDb = new DatabaseSync(resultadoPrimero.backupPath);
  try {
    assert.equal(backupDb.prepare("SELECT enunciado FROM banco_preguntas WHERE id='pregunta-legacy'").get().enunciado, 'Reactivo histórico');
  } finally {
    backupDb.close();
  }
  const segunda = await execFileAsync(process.execPath, [script, '--database', database]);
  assert.equal(JSON.parse(segunda.stdout).applied, false);
  const db = new DatabaseSync(database);
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('reactivos','reactivo_versiones','reactivo_importaciones','evaluapro_schema_migrations') ORDER BY name").all();
    assert.deepEqual(tables.map((row) => row.name), ['evaluapro_schema_migrations', 'reactivo_importaciones', 'reactivo_versiones', 'reactivos']);
    assert.equal(db.prepare("SELECT enunciado FROM banco_preguntas WHERE id='pregunta-legacy'").get().enunciado, 'Reactivo histórico');
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM evaluapro_schema_migrations').get().total, 1);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
