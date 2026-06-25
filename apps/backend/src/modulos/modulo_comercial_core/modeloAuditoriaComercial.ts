/**
 * modeloAuditoriaComercial
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const AuditoriaComercial = buildCompatModel('auditoriaComercial', {
  jsonFields: ['diff']
});
