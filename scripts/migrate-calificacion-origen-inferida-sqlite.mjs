import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const databaseArgument = argumento('--database');
const databasePath = path.resolve(databaseArgument);
if (!databaseArgument || databasePath === path.parse(process.cwd()).root) {
  throw new Error('Uso: migrate-calificacion-origen-inferida-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20261006-calificacion-origen-inferida-v1';
const database = new DatabaseSync(databasePath);
function columnasCalificacion() {
  return new Set(database.prepare('PRAGMA table_info("calificaciones")').all().map((columna) => columna.name));
}

try {
  database.exec('PRAGMA foreign_keys = ON;');
  const tabla = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'calificaciones'").get();
  if (!tabla) throw new Error('La tabla calificaciones no existe; ejecute primero la preparación del esquema.');
  database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  const columnas = columnasCalificacion();
  if (aplicada && columnas.has('origen') && columnas.has('origenEvidencia')) {
    console.log(JSON.stringify({ migrationId, applied: false }));
  } else {
    const backupPath = `${databasePath}.bak-calificacion-origen-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      const actuales = columnasCalificacion();
      if (!actuales.has('origen')) database.exec('ALTER TABLE calificaciones ADD COLUMN origen TEXT;');
      if (!actuales.has('origenEvidencia')) database.exec('ALTER TABLE calificaciones ADD COLUMN origenEvidencia TEXT;');
      database.prepare('INSERT OR IGNORE INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
      database.exec('COMMIT;');
      console.log(JSON.stringify({ migrationId, applied: true, backupPath }));
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }
} finally {
  database.close();
}
