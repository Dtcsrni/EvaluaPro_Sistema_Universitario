/**
 * modeloCodigoAcceso
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const CodigoAcceso = buildCompatModel('codigoAcceso', {
  columns: [
    'id',
    'docenteId',
    'periodoId',
    'codigo',
    'expiraEn',
    'usado',
    'createdAt',
    'updatedAt'
  ]
});
