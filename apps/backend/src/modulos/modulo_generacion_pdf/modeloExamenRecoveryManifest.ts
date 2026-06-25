/**
 * modeloExamenRecoveryManifest
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const ExamenRecoveryManifest = buildCompatModel('examenRecoveryManifest', {
  jsonFields: ['metadata'],
  columns: ['id', 'docenteId', 'manifestHash', 'nombre', 'metadata', 'createdAt']
});
