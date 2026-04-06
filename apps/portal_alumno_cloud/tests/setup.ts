/**
 * setup
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { instalarTestHardening } from '../../../test-utils/vitestStrict';

// Setup comun para pruebas del portal.
process.env.NODE_ENV = 'test';
process.env.PORTAL_API_KEY = 'TEST_PORTAL_KEY';

instalarTestHardening();

