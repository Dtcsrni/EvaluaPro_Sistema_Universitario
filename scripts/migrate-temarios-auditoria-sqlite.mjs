import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const databasePath = path.resolve(argumento('--database'));
if (!databasePath || databasePath === path.parse(process.cwd()).root) {
  throw new Error('Uso: migrate-temarios-auditoria-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20260928-temarios-auditoria-v2';
const database = new DatabaseSync(databasePath);
try {
  const table = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='temarios'").get();
  if (!table) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
    if (aplicada) {
      console.log(JSON.stringify({ migrationId, applied: false }));
    } else {
      const columnas = new Set(database.prepare("PRAGMA table_info('temarios')").all().map((columna) => columna.name));
      const backupPath = `${databasePath}.bak-temarios-auditoria-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      database.exec('BEGIN IMMEDIATE;');
      try {
        if (!columnas.has('auditoriaCambios')) database.exec('ALTER TABLE temarios ADD COLUMN auditoriaCambios TEXT;');
        database.exec(`
          CREATE TABLE IF NOT EXISTS auditoria_temarios (
            id TEXT PRIMARY KEY NOT NULL,
            temarioId TEXT NOT NULL,
            docenteId TEXT NOT NULL,
            periodoId TEXT NOT NULL,
            accion TEXT NOT NULL,
            motivo TEXT NOT NULL,
            antes TEXT,
            despues TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS auditoria_temarios_docenteId_temarioId_createdAt_idx
            ON auditoria_temarios(docenteId, temarioId, createdAt);
        `);
        database.prepare('INSERT INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
        database.exec('COMMIT;');
        console.log(JSON.stringify({ migrationId, applied: true, backupPath }));
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    }
  }
} finally {
  database.close();
}
