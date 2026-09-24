/**
 * Eventos de uso del portal alumno (telemetria ligera).
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat.js';

export const EventoUsoAlumno = buildCompatModel('eventoUsoAlumno', {
  jsonFields: ['meta']
});
