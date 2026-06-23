/**
 * modeloPeriodo
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const Periodo = buildCompatModel('periodo', {
  jsonFields: ['grupos', 'resumenArchivado']
});
