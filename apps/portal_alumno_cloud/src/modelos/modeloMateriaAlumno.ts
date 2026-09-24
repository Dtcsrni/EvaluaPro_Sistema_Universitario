/**
 * Materias activas/publicadas para el alumno.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat.js';

export const MateriaAlumno = buildCompatModel('materiaAlumno', {
  jsonFields: ['metadata']
});
