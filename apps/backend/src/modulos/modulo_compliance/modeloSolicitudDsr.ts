/**
 * modeloSolicitudDsr
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const SolicitudDsr = buildCompatModel('solicitudDsr', {
  jsonFields: ['metadata']
});
