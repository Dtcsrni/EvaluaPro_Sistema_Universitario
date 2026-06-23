/**
 * modeloOmrSheetFamily
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const OmrSheetFamily = buildCompatModel('omrSheetFamily', {
  jsonFields: ['geometryDefaults', 'printSpec', 'scanSpec'],
  columns: [
    'id',
    'familyCode',
    'displayName',
    'status',
    'pageFormat',
    'questionCapacity',
    'choiceCountMax',
    'studentIdDigits',
    'versionBubbleCount',
    'supportsPrefill',
    'supportsBlankGeneric',
    'geometryDefaults',
    'printSpec',
    'scanSpec',
    'createdAt',
    'updatedAt'
  ]
});
