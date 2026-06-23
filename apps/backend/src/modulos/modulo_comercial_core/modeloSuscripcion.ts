/**
 * modeloSuscripcion
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const Suscripcion = buildCompatModel('suscripcion', {
  jsonFields: ['trial']
});
