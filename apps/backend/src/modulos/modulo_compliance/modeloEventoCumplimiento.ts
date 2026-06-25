/**
 * modeloEventoCumplimiento
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const EventoCumplimiento = buildCompatModel('eventoCumplimiento', {
  jsonFields: ['detalles']
});
