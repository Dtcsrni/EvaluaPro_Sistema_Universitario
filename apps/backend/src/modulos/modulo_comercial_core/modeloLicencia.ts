/**
 * modeloLicencia
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const Licencia = buildCompatModel('licencia', {
  jsonFields: ['metaDispositivo']
});
