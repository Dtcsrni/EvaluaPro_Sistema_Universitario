/**
 * setup
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import path from 'node:path';
import { resolverNombreDbTest } from './utils/testDbPath';

const dbFile = resolverNombreDbTest();
const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.resolve(dataDir, dbFile);
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = dbUrl;
process.env.BACKEND_DATABASE_URL = dbUrl;

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

