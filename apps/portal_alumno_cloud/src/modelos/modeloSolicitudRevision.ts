/**
 * Solicitudes de revision creadas por alumnos desde el portal.
 *
 * Se almacenan en el portal para:
 * - Persistir el estado visible para alumno.
 * - Sincronizar con el backend docente por lotes.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat';

export const SolicitudRevision = buildCompatModel('solicitudRevision', {});
