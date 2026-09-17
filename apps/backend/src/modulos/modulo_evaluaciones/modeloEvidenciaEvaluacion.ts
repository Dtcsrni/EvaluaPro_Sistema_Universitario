/**
 * modeloEvidenciaEvaluacion
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat.js';

export const EvidenciaEvaluacion = buildCompatModel('evidenciaEvaluacion', {
  jsonFields: ['classroom', 'metadata'],
  fieldMappings: {
    classroom: 'classroomData'
  }
});
