/**
 * modeloEventoUso
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const EventoUso = buildCompatModel('eventoUso', {
  jsonFields: ['meta']
});
