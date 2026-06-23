/**
 * Avisos comunicados al alumno desde docente/sistema.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const AvisoAlumno = buildCompatModel('avisoAlumno', {
  jsonFields: ['metadata']
});
