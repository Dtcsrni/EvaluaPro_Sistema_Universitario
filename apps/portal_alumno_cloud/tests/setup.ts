/**
 * setup
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import path from 'node:path';
const workerId = process.env.VITEST_WORKER_ID || '1';
const dbFile = `portal_test_${workerId}.db`;
const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.resolve(dataDir, dbFile);

// Configurar la variable de entorno DATABASE_URL para el test runner
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORTAL_DATABASE_URL = `file:${dbPath}`;

import { instalarTestHardening } from '../../../test-utils/vitestStrict';

// Setup comun para pruebas del portal.
process.env.NODE_ENV = 'test';
process.env.PORTAL_API_KEY = 'TEST_PORTAL_KEY';

instalarTestHardening();

