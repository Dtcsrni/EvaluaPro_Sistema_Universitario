import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const databasePath = path.resolve(argumento('--database'));
if (!argumento('--database') || databasePath === path.parse(process.cwd()).root) {
  throw new Error('Uso: migrate-temas-banco-auditoria-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20260928-temas-banco-auditoria-v1';
const database = new DatabaseSync(databasePath);
try {
  const table = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='banco_temas'").get();
  if (!table) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
    if (aplicada) {
      console.log(JSON.stringify({ migrationId, applied: false }));
    } else {
      const backupPath = `${databasePath}.bak-temas-banco-auditoria-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      database.exec('BEGIN IMMEDIATE;');
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS auditoria_temas_banco (
            id TEXT PRIMARY KEY NOT NULL,
            docenteId TEXT NOT NULL,
            periodoId TEXT NOT NULL,
            temaId TEXT NOT NULL,
            accion TEXT NOT NULL,
            clientRequestId TEXT NOT NULL,
            requestHash TEXT NOT NULL,
            antes TEXT,
            despues TEXT NOT NULL,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE UNIQUE INDEX IF NOT EXISTS auditoria_temas_banco_docenteId_clientRequestId_key
            ON auditoria_temas_banco(docenteId, clientRequestId);
          CREATE INDEX IF NOT EXISTS auditoria_temas_banco_docenteId_temaId_createdAt_idx
            ON auditoria_temas_banco(docenteId, temaId, createdAt);
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
