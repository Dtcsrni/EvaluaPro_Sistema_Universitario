/**
 * setup
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
const workerId = process.env.VITEST_WORKER_ID || '1';
const dbFile = `portal_test_${workerId}.db`;
const configuredDataDir = String(process.env.PORTAL_TEST_DATA_DIR || '').trim();
const dataDir = configuredDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-portal-setup-'));
const resolvedDataDir = path.resolve(dataDir);
const dbPath = path.resolve(resolvedDataDir, dbFile);
process.env.PORTAL_TEST_DATA_DIR = dataDir;

// Configurar la variable de entorno DATABASE_URL para el test runner
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORTAL_DATABASE_URL = `file:${dbPath}`;

import { instalarTestHardening } from '../../../test-utils/vitestStrict';

// Setup comun para pruebas del portal.
process.env.NODE_ENV = 'test';
process.env.PORTAL_API_KEY = 'TEST_PORTAL_KEY';

async function limpiarDataTest() {
  if (!configuredDataDir) {
    try {
      const { prisma } = await import('../src/infraestructura/baseDatos/sqlite');
      await prisma.$disconnect();
    } catch {
      // Algunos tests no cargan Prisma; la limpieza del directorio continúa.
    }
    try {
      await fs.promises.rm(resolvedDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // La limpieza es best-effort; no ocultar el resultado del test.
    }
  }
}

afterAll(() => limpiarDataTest());
process.on('exit', () => {
  if (!configuredDataDir) {
    try { fs.rmSync(resolvedDataDir, { recursive: true, force: true }); } catch { /* higiene best-effort */ }
  }
});

instalarTestHardening();

