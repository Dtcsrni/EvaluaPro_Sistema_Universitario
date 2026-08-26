/**
 * sqlite
 *
 * Responsabilidad: Singleton del cliente de Prisma para conexion local a SQLite.
 */
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

// Asegurar que el directorio data/ existe para guardar evaluapro.db
import fs from 'node:fs';

let dataDir = path.resolve(process.cwd(), 'data');
if (process.env.NODE_ENV === 'production') {
  // In native production, always use ProgramData to persist across upgrades/uninstalls and avoid System32
  dataDir = path.resolve(process.env.PROGRAMDATA || 'C:\\ProgramData', 'EvaluaPro', 'data');
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKEND_DATABASE_URL || process.env.DATABASE_URL || `file:${path.resolve(dataDir, 'evaluapro.db').replace(/\\/g, '/')}`
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

export async function conectarSqlite(): Promise<void> {
  await prisma.$connect();
  await asegurarEsquemaSqlite();
}

async function asegurarEsquemaSqlite(): Promise<void> {
  try {
    const tablas = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='docentes';"
    );
    if (!tablas || tablas.length === 0) {
      const schemaPath = path.resolve(process.cwd(), 'apps', 'backend', 'prisma', 'schema.prisma');
      const fallbackSchema = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
      const targetSchema = fs.existsSync(schemaPath) ? schemaPath : (fs.existsSync(fallbackSchema) ? fallbackSchema : null);
      if (targetSchema) {
        const { execSync } = await import('node:child_process');
        const prismaCli = path.resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
        if (fs.existsSync(prismaCli)) {
          execSync(`node "${prismaCli}" db push --schema "${targetSchema}" --skip-generate`, {
            stdio: 'ignore'
          });
        }
      }
    }
  } catch {
    // Si la conexion es en memoria de tests o no permite queryRaw, continuar
  }
}

export async function desconectarSqlite(): Promise<void> {
  await prisma.$disconnect();
}
