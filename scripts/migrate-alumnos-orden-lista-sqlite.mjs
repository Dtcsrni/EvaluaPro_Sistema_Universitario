import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

function argumento(nombre) {
  const indice = process.argv.indexOf(nombre);
  return indice >= 0 ? String(process.argv[indice + 1] || '') : '';
}

const rawPath = argumento('--database');
const databasePath = path.resolve(rawPath);
if (!rawPath || databasePath === path.parse(process.cwd()).root) {
  throw new Error('Uso: migrate-alumnos-orden-lista-sqlite.mjs --database <ruta>');
}
if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error('La migración requiere una base SQLite existente y explícita.');
}

const migrationId = '20261120-alumnos-orden-lista-v1';
const database = new DatabaseSync(databasePath);
try {
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('CREATE TABLE IF NOT EXISTS evaluapro_schema_migrations (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const aplicada = database.prepare('SELECT id FROM evaluapro_schema_migrations WHERE id = ?').get(migrationId);
  if (aplicada) {
    console.log(JSON.stringify({ migrationId, applied: false }));
  } else {
    const backupPath = `${databasePath}.bak-alumnos-orden-lista-${Date.now()}`;
    fs.copyFileSync(databasePath, backupPath);
    database.exec('BEGIN IMMEDIATE;');
    try {
      const columnas = database.prepare('PRAGMA table_info("alumnos")').all();
      if (columnas.length === 0) throw new Error('No existe la tabla alumnos; inicializa el esquema antes de migrar.');
      if (!columnas.some((columna) => columna.name === 'ordenLista')) {
        database.exec('ALTER TABLE "alumnos" ADD COLUMN "ordenLista" INTEGER NOT NULL DEFAULT 0;');
      }
      const periodos = database.prepare('SELECT DISTINCT "periodoId" FROM "alumnos" ORDER BY "periodoId"').all();
      const leer = database.prepare('SELECT "id", "ordenLista" FROM "alumnos" WHERE "periodoId" = ? ORDER BY "createdAt" ASC, "matricula" COLLATE NOCASE ASC, "id" ASC');
      const actualizar = database.prepare('UPDATE "alumnos" SET "ordenLista" = ? WHERE "id" = ?');
      for (const { periodoId } of periodos) {
        const alumnos = leer.all(periodoId);
        alumnos.forEach((alumno, indice) => {
          if (Number(alumno.ordenLista) !== indice + 1) actualizar.run(indice + 1, alumno.id);
        });
      }
      database.exec('CREATE INDEX IF NOT EXISTS "alumnos_periodoId_ordenLista_idx" ON "alumnos" ("periodoId", "ordenLista");');
      database.prepare('INSERT INTO evaluapro_schema_migrations (id) VALUES (?)').run(migrationId);
      database.exec('COMMIT;');
      console.log(JSON.stringify({ migrationId, applied: true, periodos: periodos.length, backupPath }));
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }
} finally {
  database.close();
}
