/**
 * Agenda y eventos cronológicos para el alumno.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const AgendaAlumno = buildCompatModel('agendaAlumno', {
  jsonFields: ['metadata']
});
