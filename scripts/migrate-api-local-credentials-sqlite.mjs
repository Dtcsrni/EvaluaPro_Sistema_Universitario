import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const rutaArgumento = argumento('--database');
if (!rutaArgumento) throw new Error('Uso: migrate-api-local-credentials-sqlite.mjs --database <ruta>');
const databasePath = path.resolve(rutaArgumento);
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) throw new Error('La migración requiere una base SQLite existente y explícita.');

const migrationId = '20261023-api-local-credentials-v1';
const db = new DatabaseSync(databasePath);
try {
  db.exec('PRAGMA foreign_keys = ON;');
  const docentes = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='docentes'").get();
  if (!docentes) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    db.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    if (!db.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId)) {
      const backupPath = `${databasePath}.bak-api-local-credentials-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS credenciales_api_docente (
            id TEXT PRIMARY KEY NOT NULL,
            docenteId TEXT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE ON UPDATE CASCADE,
            nombre TEXT NOT NULL,
            permisos TEXT NOT NULL,
            refreshTokenHash TEXT NOT NULL UNIQUE,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            lastUsedAt DATETIME,
            expiresAt DATETIME NOT NULL,
            revokedAt DATETIME
          );
          CREATE INDEX IF NOT EXISTS credenciales_api_docente_docenteId_revokedAt_expiresAt_idx ON credenciales_api_docente(docenteId, revokedAt, expiresAt);
        `);
        db.prepare('INSERT INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
        db.exec('COMMIT;');
        console.log(JSON.stringify({ migrationId, applied: true, backupPath }));
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
    } else {
      console.log(JSON.stringify({ migrationId, applied: false, reason: 'already_applied' }));
    }
  }
} finally {
  db.close();
}
