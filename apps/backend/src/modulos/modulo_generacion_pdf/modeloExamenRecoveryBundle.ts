/**
 * modeloExamenRecoveryBundle
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const ExamenRecoveryBundle = buildCompatModel('examenRecoveryBundle', {
  jsonFields: ['metadata'],
  columns: ['id', 'docenteId', 'bundleHash', 'nombre', 'metadata', 'createdAt']
});
