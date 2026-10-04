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
  throw new Error('Uso: migrate-evidencias-evaluacion-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20260927-evidencias-evaluacion-auditoria-v1';
const database = new DatabaseSync(databasePath);
try {
  const table = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evidencias_evaluacion'").get();
  if (!table) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
    if (aplicada) {
      console.log(JSON.stringify({ migrationId, applied: false }));
    } else {
      const columnas = new Set(database.prepare("PRAGMA table_info('evidencias_evaluacion')").all().map((columna) => columna.name));
      const backupPath = `${databasePath}.bak-evidencias-evaluacion-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      database.exec('BEGIN IMMEDIATE;');
      try {
        if (!columnas.has('archivadaEn')) database.exec('ALTER TABLE evidencias_evaluacion ADD COLUMN archivadaEn DATETIME;');
        if (!columnas.has('archivadaPorDocenteId')) database.exec('ALTER TABLE evidencias_evaluacion ADD COLUMN archivadaPorDocenteId TEXT;');
        if (!columnas.has('motivoArchivo')) database.exec('ALTER TABLE evidencias_evaluacion ADD COLUMN motivoArchivo TEXT;');
        if (!columnas.has('auditoriaCambios')) database.exec('ALTER TABLE evidencias_evaluacion ADD COLUMN auditoriaCambios TEXT;');
        database.exec('CREATE INDEX IF NOT EXISTS evidencias_evaluacion_docenteId_archivadaEn_fechaEvidencia_idx ON evidencias_evaluacion(docenteId, archivadaEn, fechaEvidencia);');
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
