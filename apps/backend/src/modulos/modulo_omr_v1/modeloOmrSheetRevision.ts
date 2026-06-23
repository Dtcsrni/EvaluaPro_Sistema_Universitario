/**
 * modeloOmrSheetRevision
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const OmrSheetRevision = buildCompatModel('omrSheetRevision', {
  jsonFields: ['geometry', 'qualityThresholds'],
  columns: [
    'id',
    'familyId',
    'revision',
    'geometry',
    'qualityThresholds',
    'renderTemplateVersion',
    'recognitionEngineVersion',
    'isActive',
    'createdAt'
  ]
});
