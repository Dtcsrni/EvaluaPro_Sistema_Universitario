/**
 * modeloCalificacion
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const Calificacion = buildCompatModel('calificacion', {
  jsonFields: ['fraccion', 'respuestasDetectadas', 'omrAuditoria', 'componentesExamen']
});
