/**
 * Materias activas/publicadas para el alumno.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const MateriaAlumno = buildCompatModel('materiaAlumno', {
  jsonFields: ['metadata']
});
