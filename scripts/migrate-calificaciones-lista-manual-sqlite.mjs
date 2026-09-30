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
  throw new Error('Uso: migrate-calificaciones-lista-manual-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20260925-calificaciones-lista-manual-v1';
const database = new DatabaseSync(databasePath);

try {
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  if (aplicada) {
    console.log(JSON.stringify({ migrationId, applied: false }));
  } else {
    const backupPath = `${databasePath}.bak-calificaciones-lista-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS calificaciones_lista_manual (
          id TEXT NOT NULL PRIMARY KEY,
          docenteId TEXT NOT NULL,
          periodoId TEXT NOT NULL,
          alumnoId TEXT NOT NULL,
          componente TEXT NOT NULL,
          calificacion REAL NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          auditoria TEXT NOT NULL DEFAULT '[]',
          capturadoPor TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (docenteId) REFERENCES docentes(id) ON DELETE CASCADE,
          FOREIGN KEY (periodoId) REFERENCES periodos(id) ON DELETE CASCADE,
          FOREIGN KEY (alumnoId) REFERENCES alumnos(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS calificaciones_lista_manual_docente_periodo_alumno_componente_key
          ON calificaciones_lista_manual(docenteId, periodoId, alumnoId, componente);
        CREATE INDEX IF NOT EXISTS calificaciones_lista_manual_docente_periodo_idx
          ON calificaciones_lista_manual(docenteId, periodoId);
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
