/**
 * modeloMapeoClassroomAlumnoCurso
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const MapeoClassroomAlumnoCurso = buildCompatModel('mapeoClassroomAlumnoCurso', {
  jsonFields: ['metadata'],
  columns: ['id', 'docenteId', 'periodoId', 'alumnoId', 'courseId', 'classroomUserId', 'classroomEmail', 'metadata', 'createdAt', 'updatedAt']
});
