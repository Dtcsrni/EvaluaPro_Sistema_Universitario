import { describe, expect, it } from 'vitest';
import type { Periodo, Pregunta } from '../src/apps/app_docente/tipos';
import { derivarDisponibilidadPlantilla, resumirLotesArchivadosOmr } from '../src/apps/app_docente/features/plantillas/datosPlantilla';

describe('derivaciones de datos de plantillas', () => {
  it('filtra por periodo, normaliza nombres de tema y calcula cobertura seleccionada', () => {
    const preguntas = [
      { periodoId: 'p-1', tema: ' Álgebra   básica ' },
      { periodoId: 'p-1', tema: 'álgebra básica' },
      { periodoId: 'p-1', tema: '   ' },
      { periodoId: 'p-2', tema: 'Geometría' }
    ] as unknown as Pregunta[];

    const resultado = derivarDisponibilidadPlantilla(preguntas, 'p-1', ['ÁLGEBRA BÁSICA']);

    expect(resultado.temasDisponibles).toEqual([{ tema: 'Álgebra básica', total: 2 }]);
    expect(resultado.totalDisponiblePorTemas).toBe(2);
    expect(derivarDisponibilidadPlantilla(preguntas, '', ['Álgebra básica'])).toEqual({
      temasDisponibles: [],
      totalDisponiblePorTemas: 0
    });
  });

  it('agrupa lotes archivados, cuenta exámenes y etiqueta con la materia disponible', () => {
    const examenes = [
      { _id: 'assessment-a', loteId: 'lote-a', periodoId: 'p-1' },
      { _id: 'assessment-b', loteId: 'lote-a', periodoId: 'p-1' },
      { _id: 'assessment-c', loteId: 'lote-b', periodoId: 'p-2' },
      { _id: 'assessment-sin-lote', periodoId: 'p-1' }
    ];
    const periodos = [{ _id: 'p-2', nombre: 'Zoología' }] as unknown as Periodo[];
    const archivados = [{ _id: 'p-1', nombre: 'Álgebra' }] as unknown as Periodo[];

    expect(resumirLotesArchivadosOmr(examenes, periodos, archivados)).toEqual([
      { assessmentId: 'assessment-a', loteId: 'lote-a', etiqueta: 'Álgebra · Lote lote-a', cantidad: 2 },
      { assessmentId: 'assessment-c', loteId: 'lote-b', etiqueta: 'Zoología · Lote lote-b', cantidad: 1 }
    ]);
  });
});
