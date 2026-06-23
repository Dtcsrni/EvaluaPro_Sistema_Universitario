/**
 * Historial académico resumido del alumno.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const HistorialAlumno = buildCompatModel('historialAlumno', {
  jsonFields: ['metadata']
});
