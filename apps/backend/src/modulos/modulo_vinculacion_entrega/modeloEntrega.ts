/**
 * modeloEntrega
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const Entrega = buildCompatModel('entrega', {
  columns: [
    'id',
    'examenGeneradoId',
    'alumnoId',
    'docenteId',
    'estado',
    'fechaEntrega',
    'acordeonEntregado',
    'bonoAcordeon',
    'motivoDeshacer',
    'createdAt',
    'updatedAt'
  ]
});
