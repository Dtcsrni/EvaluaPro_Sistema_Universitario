/**
 * Resultado publicado para portal alumno.
 */
import { buildCompatModel } from '../infraestructura/baseDatos/compat.js';

export const ResultadoAlumno = buildCompatModel('resultadoAlumno', {
  jsonFields: [
    'componentesExamen',
    'respuestasDetectadas',
    'comparativaRespuestas',
    'omrCapturas',
    'omrAuditoria',
    'banderas'
  ]
});
