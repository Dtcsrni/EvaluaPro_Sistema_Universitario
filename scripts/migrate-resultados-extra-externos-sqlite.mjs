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
  throw new Error('Uso: migrate-resultados-extra-externos-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20261006-resultados-extra-externos-v1';
const database = new DatabaseSync(databasePath);
try {
  database.exec('PRAGMA foreign_keys = ON;');
  const padres = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('docentes', 'periodos', 'alumnos')").all();
  if (padres.length !== 3) throw new Error('Faltan tablas docentes, periodos o alumnos.');
  database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  const tabla = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'resultados_extra_externos'").get();
  if (aplicada && tabla) {
    console.log(JSON.stringify({ migrationId, applied: false }));
  } else {
    const backupPath = `${databasePath}.bak-resultados-extra-externos-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(`CREATE TABLE IF NOT EXISTS resultados_extra_externos (
        id TEXT PRIMARY KEY NOT NULL,
        docenteId TEXT NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
        periodoId TEXT NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
        alumnoId TEXT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        folio TEXT NOT NULL,
        loteId TEXT,
        fuenteArchivo TEXT NOT NULL,
        documentoSha256 TEXT NOT NULL,
        aciertos INTEGER NOT NULL CHECK (aciertos >= 0),
        totalReactivos INTEGER NOT NULL CHECK (totalReactivos > 0 AND aciertos <= totalReactivos),
        calificacionSobre5Exacta TEXT NOT NULL,
        calificacionSobre5Texto TEXT NOT NULL,
        calificacionSobre10Texto TEXT NOT NULL,
        estadoAprobatorio TEXT NOT NULL CHECK (estadoAprobatorio IN ('Aprobatoria', 'No aprobatoria')),
        origen TEXT NOT NULL DEFAULT 'inferida manualmente',
        evidencia TEXT NOT NULL,
        clientRequestId TEXT NOT NULL,
        payloadHash TEXT NOT NULL,
        capturadoPor TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (docenteId, clientRequestId),
        UNIQUE (docenteId, periodoId, alumnoId, folio)
      );
      CREATE INDEX IF NOT EXISTS idx_resultados_extra_externos_docente_periodo_alumno
        ON resultados_extra_externos(docenteId, periodoId, alumnoId);`);
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
