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

const migrationId = '20260928-politicas-calificacion-auditoria-v1';
const database = new DatabaseSync(databasePath);
try {
  const table = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='politicas_calificacion'").get();
  if (!table) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
    if (aplicada) {
      console.log(JSON.stringify({ migrationId, applied: false }));
    } else {
      const backupPath = `${databasePath}.bak-politicas-calificacion-auditoria-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      const columnas = new Set(database.prepare('PRAGMA table_info(politicas_calificacion)').all().map((columna) => columna.name));
      database.exec('BEGIN IMMEDIATE;');
      try {
        if (!columnas.has('codigo')) database.exec('ALTER TABLE politicas_calificacion ADD COLUMN codigo TEXT;');
        if (!columnas.has('familia')) database.exec('ALTER TABLE politicas_calificacion ADD COLUMN familia TEXT;');
        if (!columnas.has('version')) database.exec('ALTER TABLE politicas_calificacion ADD COLUMN version INTEGER NOT NULL DEFAULT 1;');
        if (!columnas.has('descripcion')) database.exec('ALTER TABLE politicas_calificacion ADD COLUMN descripcion TEXT;');
        if (!columnas.has('activa')) database.exec('ALTER TABLE politicas_calificacion ADD COLUMN activa BOOLEAN NOT NULL DEFAULT 1;');
        database.exec(`
          CREATE TABLE IF NOT EXISTS auditoria_politicas_calificacion (
            id TEXT PRIMARY KEY NOT NULL,
            docenteId TEXT NOT NULL,
            codigo TEXT NOT NULL,
            version INTEGER NOT NULL,
            accion TEXT NOT NULL,
            clientRequestId TEXT NOT NULL,
            requestHash TEXT NOT NULL,
            antes TEXT,
            despues TEXT NOT NULL,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (docenteId) REFERENCES docentes(id) ON DELETE RESTRICT
          );
          CREATE UNIQUE INDEX IF NOT EXISTS auditoria_politicas_calificacion_docenteId_clientRequestId_key
            ON auditoria_politicas_calificacion(docenteId, clientRequestId);
          CREATE INDEX IF NOT EXISTS auditoria_politicas_calificacion_docenteId_codigo_createdAt_idx
            ON auditoria_politicas_calificacion(docenteId, codigo, createdAt, id);
          CREATE UNIQUE INDEX IF NOT EXISTS politicas_calificacion_docenteId_codigo_version_key
            ON politicas_calificacion(docenteId, codigo, version);
          CREATE INDEX IF NOT EXISTS politicas_calificacion_docenteId_codigo_version_activa_idx
            ON politicas_calificacion(docenteId, codigo, version, activa);
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
