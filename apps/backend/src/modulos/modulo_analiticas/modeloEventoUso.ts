/**
 * modeloEventoUso
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const EventoUso = buildCompatModel('eventoUso', {
  jsonFields: ['meta']
});
