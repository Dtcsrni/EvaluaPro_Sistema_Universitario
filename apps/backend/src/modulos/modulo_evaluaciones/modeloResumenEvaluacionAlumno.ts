/**
 * modeloResumenEvaluacionAlumno
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const ResumenEvaluacionAlumno = buildCompatModel('resumenEvaluacionAlumno', {
  jsonFields: ['continuaPorCorte', 'examenesPorCorte', 'faltantes', 'auditoria']
});
