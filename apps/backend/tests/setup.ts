import { instalarTestHardening } from '../../../test-utils/vitestStrict';

// Setup comun para pruebas del backend.
process.env.NODE_ENV = 'test';

// En pruebas de integracion se realizan muchas requests en poco tiempo.
// Subimos el limite para evitar falsos negativos por rate limiting.
process.env.RATE_LIMIT_LIMIT = '100000';

// En pruebas se permiten correos de cualquier dominio.
process.env.DOMINIOS_CORREO_PERMITIDOS = '';

instalarTestHardening();

