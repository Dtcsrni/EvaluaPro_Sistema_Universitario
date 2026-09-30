/**
 * modeloComponenteExamen
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const ComponenteExamen = buildCompatModel('componenteExamen', {
  jsonFields: ['practicas', 'metadata']
});
