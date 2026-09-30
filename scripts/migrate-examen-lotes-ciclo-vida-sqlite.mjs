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
  throw new Error('Uso: migrate-examen-lotes-ciclo-vida-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20260928-examen-lotes-ciclo-vida-v1';
const database = new DatabaseSync(databasePath);

function existeTabla(nombre) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nombre));
}

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
    if (!existeTabla('examen_lote_artefactos_pdf')) {
      throw new Error('La tabla examen_lote_artefactos_pdf no existe; ejecute primero la migración base.');
    }
    const backupPath = `${databasePath}.bak-examen-lotes-ciclo-vida-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      const columnas = columnasTabla('examen_lote_artefactos_pdf');
      if (!columnas.has('archivadoEn')) {
        database.exec('ALTER TABLE examen_lote_artefactos_pdf ADD COLUMN archivadoEn DATETIME;');
      }
      if (!columnas.has('archivadoPor')) {
        database.exec('ALTER TABLE examen_lote_artefactos_pdf ADD COLUMN archivadoPor TEXT;');
      }
      database.exec(`
        CREATE TABLE IF NOT EXISTS examen_lote_artefactos_pdf_auditoria (
          id TEXT NOT NULL PRIMARY KEY,
          docenteId TEXT NOT NULL,
          artefactoId TEXT NOT NULL,
          loteId TEXT NOT NULL,
          accion TEXT NOT NULL,
          clientRequestId TEXT NOT NULL,
          archivadoResultante BOOLEAN NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (docenteId) REFERENCES docentes(id) ON DELETE CASCADE,
          FOREIGN KEY (artefactoId) REFERENCES examen_lote_artefactos_pdf(id) ON DELETE CASCADE,
          UNIQUE (docenteId, clientRequestId)
        );
        CREATE INDEX IF NOT EXISTS examen_lote_artefactos_pdf_auditoria_lote_idx
          ON examen_lote_artefactos_pdf_auditoria(docenteId, loteId, createdAt);
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
