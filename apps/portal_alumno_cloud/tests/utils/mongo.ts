/**
 * mongo
 *
 * Responsabilidad: Mock de base de datos para pruebas del portal.
 * Redirige llamadas de MongoDB/Mongoose a SQLite/Prisma Client con aislamiento por worker de Vitest.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const workerId = process.env.VITEST_WORKER_ID || '1';
const dbFile = `portal_test_${workerId}.db`;
const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.resolve(dataDir, dbFile);

// Configurar la variable de entorno DATABASE_URL para el test runner
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORTAL_DATABASE_URL = `file:${dbPath}`;

import { prisma } from '../../src/infraestructura/baseDatos/sqlite';

export async function conectarMongoTest() {
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.PORTAL_DATABASE_URL = `file:${dbPath}`;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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

  const cmd = `"${prismaBin}" db push --schema="${schemaPath}" --skip-generate --accept-data-loss`;
  
  try {
    execSync(cmd, {
      env: { ...process.env, DATABASE_URL: process.env.PORTAL_DATABASE_URL },
      stdio: 'pipe'
    });
  } catch (error: any) {
    console.error("Error executing portal prisma db push during tests:", error.stderr?.toString() || error.message);
    throw error;
  }

  await prisma.$connect();
}

export async function limpiarMongoTest() {
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
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // Ignorar si está bloqueado temporalmente
    }
  }
}
