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
  throw new Error('Uso: migrate-examen-tipo-examen-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20261003-examen-tipo-cohorte-v1';
const database = new DatabaseSync(databasePath);

function columnasTabla(nombre) {
  return new Set(database.prepare(`PRAGMA table_info("${nombre}")`).all().map((columna) => columna.name));
}

try {
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  if (aplicada) {
    console.log(JSON.stringify({ migrationId, applied: false }));
  } else {
    const tablas = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'examenes_generados'").get();
    if (!tablas) throw new Error('La tabla examenes_generados no existe; ejecute primero la preparación del esquema.');

    const backupPath = `${databasePath}.bak-examen-tipo-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      if (!columnasTabla('examenes_generados').has('tipoExamen')) {
        database.exec('ALTER TABLE examenes_generados ADD COLUMN tipoExamen TEXT;');
      }
      if (!columnasTabla('examenes_generados').has('cohorteLoteHash')) {
        database.exec('ALTER TABLE examenes_generados ADD COLUMN cohorteLoteHash TEXT;');
      }
      database.prepare('INSERT INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
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
