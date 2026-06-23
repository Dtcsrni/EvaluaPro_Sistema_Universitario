/**
 * modeloEventoComercial
 *
 * Responsabilidad: Definición de modelo de persistencia compatible con Prisma/SQLite.
 */
import { buildCompatModel } from './compat';

export const EventoComercial = buildCompatModel('eventoComercial', {
  jsonFields: ['payload']
});
