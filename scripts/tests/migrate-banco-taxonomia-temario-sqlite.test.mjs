import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts', 'migrate-banco-taxonomia-temario-sqlite.mjs');

test('crea la taxonomía y conserva temas existentes bajo Sin categoría', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-banco-taxonomia-'));
  const database = path.join(tempDir, 'evaluapro.db');
  const db = new DatabaseSync(database);
  db.exec(`CREATE TABLE docentes (id TEXT PRIMARY KEY);
    CREATE TABLE periodos (id TEXT PRIMARY KEY, docenteId TEXT);
    INSERT INTO docentes (id) VALUES ('doc-a');
    INSERT INTO periodos (id, docenteId) VALUES ('periodo-a', 'doc-a');
    CREATE TABLE banco_temas (id TEXT PRIMARY KEY, docenteId TEXT NOT NULL, periodoId TEXT NOT NULL, nombre TEXT NOT NULL, clave TEXT NOT NULL, activo BOOLEAN NOT NULL DEFAULT 1, archivadoEn DATETIME, createdAt DATETIME, updatedAt DATETIME);
    INSERT INTO banco_temas (id, docenteId, periodoId, nombre, clave) VALUES ('tema-a', 'doc-a', 'periodo-a', 'Tema A', 'tema a'), ('tema-b', 'doc-a', 'periodo-a', 'Tema B', 'tema b');`);
  db.close();
  try {
    await execFileAsync(process.execPath, [script, '--database', database], { windowsHide: true });
    await execFileAsync(process.execPath, [script, '--database', database], { windowsHide: true });
    const check = new DatabaseSync(database);
    try {
      const categorias = check.prepare('SELECT id, nombre FROM banco_categorias').all();
      const temas = check.prepare('SELECT id, categoriaId, temarioNodoId FROM banco_temas ORDER BY id').all();
      assert.equal(categorias.length, 1);
      assert.equal(categorias[0].nombre, 'Sin categoría');
      assert.equal(temas.length, 2);
      assert.ok(temas.every((tema) => tema.categoriaId === categorias[0].id && tema.temarioNodoId === null));
      assert.equal(check.prepare('SELECT COUNT(*) AS total FROM evaluapro_schema_migrations').get().total, 1);
    } finally {
      check.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
