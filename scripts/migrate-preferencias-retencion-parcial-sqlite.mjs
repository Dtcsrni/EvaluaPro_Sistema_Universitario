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
  throw new Error('Uso: migrate-preferencias-retencion-parcial-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20261006-preferencias-retencion-parcial-v1';
const database = new DatabaseSync(databasePath);
try {
  const docentes = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='docentes'").get();
  if (!docentes) {
    console.log(JSON.stringify({ migrationId, applied: false, reason: 'table_not_created_yet' }));
  } else {
    database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
    const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
    if (aplicada) {
      console.log(JSON.stringify({ migrationId, applied: false }));
    } else {
      const backupPath = `${databasePath}.bak-retencion-parcial-${Date.now()}`;
      fs.copyFileSync(databasePath, backupPath);
      database.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS preferencias_retencion_parcial (
            docenteId TEXT NOT NULL PRIMARY KEY,
            meses INTEGER,
            updatedAt DATETIME NOT NULL,
            CONSTRAINT preferencias_retencion_parcial_docenteId_fkey
              FOREIGN KEY (docenteId) REFERENCES docentes(id) ON DELETE CASCADE ON UPDATE CASCADE
          );
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
