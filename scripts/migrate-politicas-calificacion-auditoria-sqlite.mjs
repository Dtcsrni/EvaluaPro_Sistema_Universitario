import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const argumentoDatabase = argumento('--database');
const databasePath = path.resolve(argumentoDatabase);
if (!argumentoDatabase || databasePath === path.parse(process.cwd()).root) {
  throw new Error('Uso: migrate-politicas-calificacion-auditoria-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20261004-politicas-calificacion-auditoria-v1';
const database = new DatabaseSync(databasePath);
try {
  const tablaPoliticas = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='politicas_calificacion'").get();
  if (!tablaPoliticas) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
    if (aplicada) {
      console.log(JSON.stringify({ migrationId, applied: false }));
    } else {
      const backupPath = `${databasePath}.bak-politicas-auditoria-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      database.exec('BEGIN IMMEDIATE;');
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS auditoria_politicas_calificacion (
            id TEXT PRIMARY KEY NOT NULL,
            docenteId TEXT NOT NULL,
            codigo TEXT NOT NULL,
            version INTEGER NOT NULL,
            accion TEXT NOT NULL,
            motivo TEXT,
            clientRequestId TEXT NOT NULL,
            requestHash TEXT NOT NULL,
            antes TEXT,
            despues TEXT NOT NULL,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT auditoria_politicas_calificacion_docenteId_fkey
              FOREIGN KEY (docenteId) REFERENCES docentes(id) ON DELETE RESTRICT ON UPDATE CASCADE
          );
          CREATE UNIQUE INDEX IF NOT EXISTS auditoria_politicas_calificacion_docenteId_clientRequestId_key
            ON auditoria_politicas_calificacion(docenteId, clientRequestId);
          CREATE UNIQUE INDEX IF NOT EXISTS auditoria_politicas_calificacion_docenteId_codigo_version_key
            ON auditoria_politicas_calificacion(docenteId, codigo, version);
          CREATE INDEX IF NOT EXISTS auditoria_politicas_calificacion_docenteId_codigo_createdAt_idx
            ON auditoria_politicas_calificacion(docenteId, codigo, createdAt, id);
          CREATE TRIGGER IF NOT EXISTS auditoria_politicas_calificacion_no_update
            BEFORE UPDATE ON auditoria_politicas_calificacion
            BEGIN SELECT RAISE(ABORT, 'auditoria_politicas_calificacion is append-only'); END;
          CREATE TRIGGER IF NOT EXISTS auditoria_politicas_calificacion_no_delete
            BEFORE DELETE ON auditoria_politicas_calificacion
            BEGIN SELECT RAISE(ABORT, 'auditoria_politicas_calificacion is append-only'); END;
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
