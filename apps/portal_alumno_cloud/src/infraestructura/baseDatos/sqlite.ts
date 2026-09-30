/**
 * sqlite
 *
 * Responsabilidad: Singleton del cliente de Prisma para conexion local a SQLite del portal.
 */
import { PrismaClient } from './generado/cliente/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// Asegurar que el directorio data/ existe para guardar portal.db
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const databaseUrl = process.env.PORTAL_DATABASE_URL || process.env.DATABASE_URL ||
  `file:${path.resolve(dataDir, 'portal.db').replace(/\\/g, '/')}`;
export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

export async function conectarSqlite(): Promise<void> {
  await prisma.$connect();
}

export async function desconectarSqlite(): Promise<void> {
  await prisma.$disconnect();
}
