/**
 * Eventos de uso del portal alumno (telemetria ligera).
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const EventoUsoAlumno = buildCompatModel('eventoUsoAlumno', {
  jsonFields: ['meta']
});
