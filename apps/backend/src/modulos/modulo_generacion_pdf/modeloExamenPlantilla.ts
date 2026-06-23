/**
 * modeloExamenPlantilla
 *
 * Responsabilidad: Definición de modelo compatible con Prisma/SQLite.
 */
import { buildCompatModel } from '../../compartido/compat';

export const ExamenPlantilla = buildCompatModel('examenPlantilla', {
  jsonFields: ['temas', 'bookletConfig', 'omrConfig', 'configuracionPdf'],
  defaultInclude: {
    preguntas: true
  },
  columns: [
    'id',
    'docenteId',
    'periodoId',
    'tipo',
    'titulo',
    'tituloNormalizado',
    'instrucciones',
    'numeroPaginas',
    'reactivosObjetivo',
    'defaultVersionCount',
    'answerKeyMode',
    'temas',
    'archivadoEn',
    'bookletConfig',
    'omrConfig',
    'configuracionPdf',
    'createdAt',
    'updatedAt'
  ]
});

export function normalizarTituloPlantilla(titulo: string): string {
  return String(titulo ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

