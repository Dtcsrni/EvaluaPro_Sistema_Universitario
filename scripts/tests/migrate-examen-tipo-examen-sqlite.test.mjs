import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const migration = path.join(root, 'scripts', 'migrate-examen-tipo-examen-sqlite.mjs');

test('agrega tipoExamen sin reclasificar datos existentes y puede reintentarse', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-examen-tipo-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE examenes_generados (
        id TEXT PRIMARY KEY,
        folio TEXT NOT NULL,
        plantillaId TEXT NOT NULL,
        alumnoId TEXT
      );
      INSERT INTO examenes_generados (id, folio, plantillaId, alumnoId)
      VALUES ('legacy-1', 'FOLIO-LEGACY', 'plantilla-1', 'alumno-1');
    `);
  } finally {
    db.close();
  }

  try {
    const first = await execFileAsync(process.execPath, [migration, '--database', dbPath]);
    assert.match(first.stdout, /"applied":true/);
    const second = await execFileAsync(process.execPath, [migration, '--database', dbPath]);
    assert.match(second.stdout, /"applied":false/);

    const verify = new DatabaseSync(dbPath);
    try {
      const row = verify.prepare('SELECT id, folio, tipoExamen, cohorteLoteHash FROM examenes_generados WHERE id = ?').get('legacy-1');
      assert.equal(row.id, 'legacy-1');
      assert.equal(row.folio, 'FOLIO-LEGACY');
      assert.equal(row.tipoExamen, null);
      assert.equal(row.cohorteLoteHash, null);
      assert.equal(verify.prepare('SELECT COUNT(*) AS total FROM evaluapro_schema_migrations').get().total, 1);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('amplía una base que ya registró la migración de tipo de examen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-examen-cohorte-'));
  const dbPath = path.join(dir, 'evaluapro.db');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE examenes_generados (
        id TEXT PRIMARY KEY,
        folio TEXT NOT NULL,
        plantillaId TEXT NOT NULL,
        tipoExamen TEXT,
        alumnoId TEXT
      );
      INSERT INTO examenes_generados (id, folio, plantillaId, tipoExamen, alumnoId)
      VALUES ('extra-1', 'FOLIO-EXTRA', 'plantilla-1', 'extraordinario', 'alumno-1');
      CREATE TABLE evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO evaluapro_schema_migrations (id) VALUES ('20261002-examen-tipo-examen-v1');
    `);
  } finally {
    db.close();
  }

  try {
    const result = await execFileAsync(process.execPath, [migration, '--database', dbPath]);
    assert.match(result.stdout, /"applied":true/);
    const verify = new DatabaseSync(dbPath);
    try {
      const row = verify.prepare('SELECT tipoExamen, cohorteLoteHash FROM examenes_generados WHERE id = ?').get('extra-1');
      assert.equal(row.tipoExamen, 'extraordinario');
      assert.equal(row.cohorteLoteHash, null);
    } finally {
      verify.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
