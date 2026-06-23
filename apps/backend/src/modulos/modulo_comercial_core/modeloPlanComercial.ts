/**
 * modeloPlanComercial
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const PlanComercial = buildCompatModel('planComercial', {
  jsonFields: ['limites']
});
