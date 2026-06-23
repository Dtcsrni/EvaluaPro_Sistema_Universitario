/**
 * modeloTenant
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const Tenant = buildCompatModel('tenant', {
  jsonFields: ['contacto', 'configAislamiento', 'tags']
});
