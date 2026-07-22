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
  database.exec(fs.readFileSync(schemaPath, 'utf8'));
} finally {
  database.close();
}

console.log(`SQLite docente preparado: ${databasePath}`);
