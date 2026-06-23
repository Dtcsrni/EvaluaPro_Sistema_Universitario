/**
 * modeloSincronizacion
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const Sincronizacion = buildCompatModel('sincronizacion', {
  jsonFields: ['detalles'],
  fieldMappings: {
    detalles: 'metadata',
    ejecutadoEn: 'sincronizadoEn'
  },
  columns: [
    'id',
    'docenteId',
    'tipo',
    'estado',
    'metadata',
    'sincronizadoEn',
    'createdAt',
    'updatedAt'
  ]
});
