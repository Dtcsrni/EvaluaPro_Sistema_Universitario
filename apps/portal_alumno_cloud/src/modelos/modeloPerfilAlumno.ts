/**
 * Perfil académico visible del alumno en portal.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const PerfilAlumno = buildCompatModel('perfilAlumno', {
  jsonFields: ['metadata']
});
