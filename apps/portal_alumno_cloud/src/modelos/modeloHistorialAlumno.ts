/**
 * Historial académico resumido del alumno.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat.js';

export const HistorialAlumno = buildCompatModel('historialAlumno', {
  jsonFields: ['metadata']
});
