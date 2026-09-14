/**
 * Perfil académico visible del alumno en portal.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat.js';

export const PerfilAlumno = buildCompatModel('perfilAlumno', {
  jsonFields: ['metadata']
});
