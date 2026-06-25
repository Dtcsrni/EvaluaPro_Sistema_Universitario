/**
 * modeloConfiguracionPeriodoEvaluacion
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const ConfiguracionPeriodoEvaluacion = buildCompatModel('configuracionPeriodoEvaluacion', {
  jsonFields: ['cortes', 'pesosGlobales', 'pesosExamenes', 'reglasCierre']
});
