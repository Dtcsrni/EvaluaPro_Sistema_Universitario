/**
 * modeloOmrScanJob
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const OmrScanJob = buildCompatModel('omrScanJob', {
  jsonFields: ['metadata'],
  fieldMappings: {
    submittedBy: 'docenteId',
    status: 'estado',
    pagesTotal: 'totalHojas',
    pagesProcessed: 'procesadas',
    errors: 'errores'
  },
  columns: [
    'id',
    'docenteId',
    'periodoId',
    'plantillaId',
    'estado',
    'totalHojas',
    'procesadas',
    'errores',
    'metadata',
    'iniciadoEn',
    'completadoEn',
    'createdAt',
    'updatedAt'
  ]
});
