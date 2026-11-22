/**
 * Prepara la base SQLite nativa docente desde un esquema SQL ya generado.
 * Responsabilidad: bootstrap local idempotente sin depender de Prisma CLI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const databasePath = path.resolve(readArg('--database'));
const schemaPath = path.resolve(readArg('--schema-sql'));
if (!databasePath || !schemaPath) {
  throw new Error('Uso: prepare-docente-sqlite.mjs --database <ruta> --schema-sql <ruta>');
}
if (!fs.existsSync(schemaPath)) {
  throw new Error(`No existe esquema SQL: ${schemaPath}`);
}

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
try {
  database.exec('PRAGMA foreign_keys = ON;');
  // El esquema actual contiene un índice sobre alumnos.ordenLista. En una
  // instalación previa a ese campo, SQLite intentaría crear el índice antes
  // de la tabla existente pudiera actualizarse, y abortaría el bootstrap.
  // Aplicar la ampliación antes del DDL conserva los registros y permite que
  // el índice se cree en la pasada idempotente de abajo.
  const alumnosExistente = database.prepare('PRAGMA table_info("alumnos")').all();
  if (alumnosExistente.length > 0 && !alumnosExistente.some((column) => column.name === 'ordenLista')) {
    const columnasRequeridas = new Set(alumnosExistente.map((column) => column.name));
    for (const columna of ['id', 'periodoId', 'createdAt', 'matricula']) {
      if (!columnasRequeridas.has(columna)) {
        throw new Error(`No se puede preservar el orden del padrón: la tabla alumnos no contiene ${columna}.`);
      }
    }
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec('ALTER TABLE "alumnos" ADD COLUMN "ordenLista" INTEGER NOT NULL DEFAULT 0;');
      const periodos = database.prepare('SELECT DISTINCT "periodoId" FROM "alumnos" ORDER BY "periodoId"').all();
      const leer = database.prepare('SELECT "id" FROM "alumnos" WHERE "periodoId" = ? ORDER BY "createdAt" ASC, "matricula" COLLATE NOCASE ASC, "id" ASC');
      const actualizar = database.prepare('UPDATE "alumnos" SET "ordenLista" = ? WHERE "id" = ?');
      for (const { periodoId } of periodos) {
        leer.all(periodoId).forEach((alumno, indice) => actualizar.run(indice + 1, alumno.id));
      }
      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  }
  // Prisma genera DDL pensado para una base vacía. El instalador también se
  // usa en repair/update, por lo que convertir objetos existentes en no-op es
  // obligatorio para no perder datos ni fallar por "already exists".
  const schema = fs.readFileSync(schemaPath, 'utf8')
    .replace(/CREATE TABLE(?!\s+IF NOT EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS')
    .replace(/CREATE UNIQUE INDEX(?!\s+IF NOT EXISTS)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS')
    .replace(/CREATE INDEX(?!\s+IF NOT EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS');
  database.exec(schema);

  // El SQL de Prisma solo crea objetos ausentes. Aplicar esta migración
  // aditiva permite que una base v1.2.3 existente use el perfil actualizado.
  const docenteColumns = database.prepare('PRAGMA table_info("docentes")').all();
  if (docenteColumns.length > 0 && !docenteColumns.some((column) => column.name === 'imagenPerfil')) {
    database.exec('ALTER TABLE "docentes" ADD COLUMN "imagenPerfil" TEXT;');
  }
} finally {
  database.close();
}

console.log(`SQLite docente preparado: ${databasePath}`);
