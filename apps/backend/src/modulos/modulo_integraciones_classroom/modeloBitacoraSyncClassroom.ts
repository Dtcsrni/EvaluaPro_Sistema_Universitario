/**
 * modeloBitacoraSyncClassroom
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const BitacoraSyncClassroom = buildCompatModel('bitacoraSyncClassroom', {
  jsonFields: ['resumen', 'errores'],
  fieldMappings: {
    ejecutadoEn: 'createdAt'
  }
});
