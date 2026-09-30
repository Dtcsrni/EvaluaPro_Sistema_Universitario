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
  throw new Error('Uso: migrate-examen-lote-artefactos-pdf-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20260925-examen-lote-artefactos-pdf-v1';
const database = new DatabaseSync(databasePath);

try {
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  if (aplicada) {
    console.log(JSON.stringify({ migrationId, applied: false }));
  } else {
    const backupPath = `${databasePath}.bak-examen-lote-artifactos-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS examen_lote_artefactos_pdf (
          id TEXT NOT NULL PRIMARY KEY,
          docenteId TEXT NOT NULL,
          loteId TEXT NOT NULL,
          plantillaId TEXT NOT NULL,
          archivoNombre TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          totalPaginas INTEGER NOT NULL,
          totalExamenes INTEGER NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (docenteId) REFERENCES docentes(id) ON DELETE CASCADE,
          UNIQUE (docenteId, loteId)
        );
        CREATE INDEX IF NOT EXISTS examen_lote_artefactos_pdf_plantillaId_idx
          ON examen_lote_artefactos_pdf(plantillaId);
      `);
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
