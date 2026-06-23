/**
 * modeloCobranza
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const Cobranza = buildCompatModel('cobranza', {
  jsonFields: ['metadata']
});
