/**
 * mongo
 *
 * Responsabilidad: SQLite temporal real para pruebas del portal.
 * Redirige las llamadas heredadas de MongoDB/Mongoose a SQLite/Prisma Client con aislamiento por worker de Vitest.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const workerId = process.env.VITEST_WORKER_ID || '1';
const dbFile = `portal_test_${workerId}.db`;
const dataDir = path.resolve(String(process.env.PORTAL_TEST_DATA_DIR || '').trim() || fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-portal-test-')));
const managedDataDir = path.resolve(dataDir);
const testOwnsDataDir = path.dirname(managedDataDir) === path.resolve(os.tmpdir())
  && ['evaluapro-portal-setup-', 'evaluapro-portal-test-'].some((prefix) => path.basename(managedDataDir).startsWith(prefix));
process.env.PORTAL_TEST_DATA_DIR = dataDir;
const dbPath = path.resolve(dataDir, dbFile);

// Configurar la variable de entorno DATABASE_URL para el test runner
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORTAL_DATABASE_URL = `file:${dbPath}`;

import { prisma } from '../../src/infraestructura/baseDatos/sqlite';

export async function conectarMongoTest() {
  if (!testOwnsDataDir) throw new Error('La base de pruebas del portal debe estar en un directorio temporal exclusivo del proceso.');
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.PORTAL_DATABASE_URL = `file:${dbPath}`;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, 'w'));
  }

  // Resolver rutas de Prisma CLI y esquema de forma robusta usando __dirname
  let prismaBin = path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'prisma');
  if (!fs.existsSync(prismaBin)) {
    prismaBin = path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', '.bin', 'prisma');
  }
  if (!fs.existsSync(prismaBin)) {
    prismaBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
  }

  let schemaPath = path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  }

  const cmd = `"${prismaBin}" db push --schema="${schemaPath}" --config="${path.resolve(__dirname, '..', '..', 'prisma.config.mjs')}"`;
  
  try {
    execSync(cmd, {
      env: { ...process.env, DATABASE_URL: process.env.PORTAL_DATABASE_URL },
      stdio: 'pipe'
    });
  } catch (error: unknown) {
    const err = error as { stderr?: { toString(): string }; message?: string };
    console.error("Error executing portal prisma db push during tests:", err.stderr?.toString() || err.message);
    throw error;
  }

  await prisma.$connect();
}

export async function limpiarMongoTest() {
  if (!testOwnsDataDir) throw new Error('No se limpiará una base de datos del portal fuera del directorio temporal propio.');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
  try {
    const existingTables = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table';"
    );
    const existingNames = new Set(existingTables.map((t) => t.name.toLowerCase()));

    const tables = [
      'perfil_alumno',
      'resultados_alumno',
      'materias_alumno',
      'agenda_alumno',
      'avisos_alumno',
      'historial_alumno',
      'codigos_acceso',
      'eventos_uso_alumno',
      'sesiones_alumno',
      'solicitudes_revision',
      'paquetes_sync_docente'
    ];

    for (const table of tables) {
      if (existingNames.has(table.toLowerCase())) {
        await prisma.$executeRawUnsafe(`DELETE FROM ${table};`);
      }
    }
  } catch {
    // Ignorar errores
  }
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
}

export async function cerrarMongoTest() {
  await prisma.$disconnect();
  // Limpieza del archivo de base de datos del test
  if (testOwnsDataDir && fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // Ignorar si está bloqueado temporalmente
    }
  }
}
