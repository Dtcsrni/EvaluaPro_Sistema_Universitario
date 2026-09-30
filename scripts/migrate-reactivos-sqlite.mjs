/**
 * Migración aditiva de reactivos canónicos para SQLite docente.
 * No modifica tablas del banco legado ni elimina datos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const databasePath = path.resolve(argumento('--database'));
if (!databasePath || databasePath === path.parse(process.cwd()).root) throw new Error('Uso: migrate-reactivos-sqlite.mjs --database <ruta>');
if (!fs.existsSync(databasePath)) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.closeSync(fs.openSync(databasePath, 'a'));
}

const database = new DatabaseSync(databasePath);
const migrationId = '20260919-reactivos-v1';

try {
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(`CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  const applied = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  if (!applied) {
    const backupPath = `${databasePath}.bak-reactivos-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS reactivos (id TEXT PRIMARY KEY NOT NULL, docenteId TEXT NOT NULL, externalKey TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'draft', versionActual INTEGER NOT NULL DEFAULT 1, legacyPreguntaId TEXT, archivadoEn DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivos_docenteId_externalKey_key ON reactivos(docenteId, externalKey);
        CREATE INDEX IF NOT EXISTS reactivos_docenteId_estado_idx ON reactivos(docenteId, estado);
        CREATE TABLE IF NOT EXISTS reactivo_versiones (id TEXT PRIMARY KEY NOT NULL, reactivoId TEXT NOT NULL, numeroVersion INTEGER NOT NULL, formato TEXT NOT NULL DEFAULT 'omr.mcq5', enunciado TEXT NOT NULL, metadataJson TEXT NOT NULL DEFAULT '{}', procedenciaJson TEXT NOT NULL DEFAULT '{}', contentHash TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (reactivoId) REFERENCES reactivos(id) ON DELETE CASCADE);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_versiones_reactivoId_numeroVersion_key ON reactivo_versiones(reactivoId, numeroVersion);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_versiones_reactivoId_contentHash_key ON reactivo_versiones(reactivoId, contentHash);
        CREATE INDEX IF NOT EXISTS reactivo_versiones_contentHash_idx ON reactivo_versiones(contentHash);
        CREATE TABLE IF NOT EXISTS reactivo_opciones (id TEXT PRIMARY KEY NOT NULL, reactivoVersionId TEXT NOT NULL, clave TEXT NOT NULL, texto TEXT NOT NULL, esCorrecta BOOLEAN NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (reactivoVersionId) REFERENCES reactivo_versiones(id) ON DELETE CASCADE);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_opciones_reactivoVersionId_clave_key ON reactivo_opciones(reactivoVersionId, clave);
        CREATE TABLE IF NOT EXISTS reactivo_asignaciones (id TEXT PRIMARY KEY NOT NULL, reactivoId TEXT NOT NULL, periodoId TEXT NOT NULL, temaId TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (reactivoId) REFERENCES reactivos(id) ON DELETE CASCADE);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_asignaciones_reactivoId_periodoId_temaId_key ON reactivo_asignaciones(reactivoId, periodoId, temaId);
        CREATE INDEX IF NOT EXISTS reactivo_asignaciones_periodoId_temaId_idx ON reactivo_asignaciones(periodoId, temaId);
        CREATE TABLE IF NOT EXISTS reactivo_importaciones (id TEXT PRIMARY KEY NOT NULL, docenteId TEXT NOT NULL, batchId TEXT NOT NULL, schemaVersion INTEGER NOT NULL DEFAULT 1, inputSha256 TEXT NOT NULL, planHash TEXT NOT NULL, payloadJson TEXT NOT NULL, planJson TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'preview', confirmadoEn DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_importaciones_docenteId_inputSha256_key ON reactivo_importaciones(docenteId, inputSha256);
        CREATE INDEX IF NOT EXISTS reactivo_importaciones_docenteId_createdAt_idx ON reactivo_importaciones(docenteId, createdAt);
        CREATE TABLE IF NOT EXISTS reactivo_importacion_filas (id TEXT PRIMARY KEY NOT NULL, importacionId TEXT NOT NULL, linea INTEGER NOT NULL, externalKey TEXT NOT NULL, operacion TEXT NOT NULL, estado TEXT NOT NULL, contentHash TEXT, reactivoId TEXT, detalleJson TEXT NOT NULL DEFAULT '{}', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (importacionId) REFERENCES reactivo_importaciones(id) ON DELETE CASCADE);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_importacion_filas_importacionId_linea_key ON reactivo_importacion_filas(importacionId, linea);
        CREATE INDEX IF NOT EXISTS reactivo_importacion_filas_reactivoId_idx ON reactivo_importacion_filas(reactivoId);
        CREATE TABLE IF NOT EXISTS reactivo_assets (id TEXT PRIMARY KEY NOT NULL, docenteId TEXT NOT NULL, sha256 TEXT NOT NULL, mediaType TEXT NOT NULL, nombre TEXT, ruta TEXT, metadataJson TEXT NOT NULL DEFAULT '{}', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_assets_docenteId_sha256_key ON reactivo_assets(docenteId, sha256);
        CREATE TABLE IF NOT EXISTS reactivo_calibraciones (id TEXT PRIMARY KEY NOT NULL, reactivoId TEXT NOT NULL, reactivoVersionId TEXT NOT NULL, cohorteKey TEXT NOT NULL, respuestasValidas INTEGER NOT NULL DEFAULT 0, aciertos INTEGER NOT NULL DEFAULT 0, proporcionCorrecta REAL, puntoBiserial REAL, distractoresJson TEXT NOT NULL DEFAULT '{}', estadoEvidencia TEXT NOT NULL DEFAULT 'sin_evidencia', intervaloJson TEXT NOT NULL DEFAULT '{}', calculadoEn DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (reactivoId) REFERENCES reactivos(id) ON DELETE CASCADE, FOREIGN KEY (reactivoVersionId) REFERENCES reactivo_versiones(id) ON DELETE CASCADE);
        CREATE UNIQUE INDEX IF NOT EXISTS reactivo_calibraciones_reactivoVersionId_cohorteKey_key ON reactivo_calibraciones(reactivoVersionId, cohorteKey);
        CREATE INDEX IF NOT EXISTS reactivo_calibraciones_reactivoId_estadoEvidencia_idx ON reactivo_calibraciones(reactivoId, estadoEvidencia);
      `);
      database.prepare('INSERT INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
      database.exec('COMMIT;');
      console.log(JSON.stringify({ migrationId, applied: true, backupPath }));
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  } else {
    console.log(JSON.stringify({ migrationId, applied: false }));
  }
} finally {
  database.close();
}
