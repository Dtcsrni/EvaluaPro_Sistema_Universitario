/**
 * modeloDocente
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const Docente = buildCompatModel('docente', {
  jsonFields: ['roles', 'preferenciasPdf']
});
