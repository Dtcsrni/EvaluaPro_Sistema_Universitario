/**
 * sqlite
 *
 * Responsabilidad: Singleton del cliente de Prisma para conexion local a SQLite.
 */
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

// Asegurar que el directorio data/ existe para guardar evaluapro.db
import fs from 'node:fs';
const dataDir = path.resolve(process.cwd(), 'data');
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
}

export async function desconectarSqlite(): Promise<void> {
  await prisma.$disconnect();
}
