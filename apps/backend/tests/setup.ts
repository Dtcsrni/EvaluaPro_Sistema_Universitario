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
import { resolverNombreDbTest } from './utils/testDbPath';

const dbFile = resolverNombreDbTest();
const configuredDataDir = String(process.env.EVALUAPRO_TEST_DATA_DIR || '').trim();
const dataDir = configuredDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'evaluapro-backend-setup-'));
const resolvedDataDir = path.resolve(dataDir);
process.env.EVALUAPRO_TEST_DATA_DIR = dataDir;
process.env.EVALUAPRO_ARCHIVOS_DIR = path.join(dataDir, 'examenes');
process.env.EVALUAPRO_ENCUADRES_DIR = path.join(dataDir, 'encuadres');
const dbPath = path.resolve(dataDir, dbFile);
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = dbUrl;
process.env.BACKEND_DATABASE_URL = dbUrl;
async function limpiarDataTest() {
  // En Windows, los hooks pueden ejecutarse mientras el singleton Prisma aún
  // mantiene abierta SQLite. Desconectar primero evita residuos temporales.
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

import { instalarTestHardening } from '../../../test-utils/vitestStrict';

// Setup comun para pruebas del backend.
process.env.NODE_ENV = 'test';

// En pruebas de integracion se realizan muchas requests en poco tiempo.
// Subimos el limite para evitar falsos negativos por rate limiting.
process.env.RATE_LIMIT_LIMIT = '100000';
process.env.EVALUAPRO_LOG_SILENT = '1';

// En pruebas se permiten correos de cualquier dominio.
process.env.DOMINIOS_CORREO_PERMITIDOS = '';

instalarTestHardening({
  // Node 24 emite este warning transitorio desde dependencias de terceros
  // durante tests HTTP; no representa fallo funcional del sistema.
  allowNodeWarningPatterns: [/The `punycode` module is deprecated/i]
});

