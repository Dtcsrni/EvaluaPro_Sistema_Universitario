/**
 * modeloMapeoClassroomEvidencia
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const MapeoClassroomEvidencia = buildCompatModel('mapeoClassroomEvidencia', {
  jsonFields: ['metadata'],
  columns: ['id', 'docenteId', 'periodoId', 'alumnoId', 'courseId', 'courseWorkId', 'submissionId', 'evidenciaId', 'estado', 'metadata', 'createdAt', 'updatedAt']
});
