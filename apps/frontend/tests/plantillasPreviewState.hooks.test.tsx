/**
 * plantillasPreviewState.hooks.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlantillasPreviewState } from '../src/apps/app_docente/hooks/usePlantillasPreviewState';
import type { Plantilla } from '../src/apps/app_docente/tipos';

describe('usePlantillasPreviewState hook', () => {
  it('inicializa con estados vacíos y calcula paginasEstimadasBackendPorTema correctamente', () => {
    const plantillasMock: Plantilla[] = [
      {
        _id: 'pl-1',
        nombre: 'Plantilla Álgebra',
        materiaId: 'm-1',
        totalReactivos: 10,
        temas: ['Álgebra Lineal']
      } as unknown as Plantilla,
      {
        _id: 'pl-2',
        nombre: 'Plantilla Varios Temas',
        materiaId: 'm-1',
        totalReactivos: 20,
        temas: ['Álgebra Lineal', 'Cálculo']
      } as unknown as Plantilla
    ];

    const { result } = renderHook(() => usePlantillasPreviewState(plantillasMock));

    expect(result.current.previewPorPlantillaId).toEqual({});
    expect(result.current.cargandoPreviewPlantillaId).toBeNull();
    expect(result.current.plantillaPreviewId).toBeNull();
    expect(result.current.previewPdfUrlPorPlantillaId).toEqual({});
    expect(result.current.paginasEstimadasBackendPorTema.size).toBe(0);

    // Actualizar preview para pl-1
    act(() => {
      result.current.setPreviewPorPlantillaId({
        'pl-1': {
          plantillaId: 'pl-1',
          examPreview: { header: 'Examen', questions: [] },
          bookletPreview: { pagesEstimated: 3, rawOutput: '' },
          omrPreview: { totalPages: 1 }
        }
      });
      result.current.setPlantillaPreviewId('pl-1');
      result.current.setCargandoPreviewPlantillaId('pl-1');
      result.current.setPreviewPdfUrlPorPlantillaId({
        'pl-1': { booklet: 'blob://test' }
      });
      result.current.setCargandoPreviewPdfPlantillaId('pl-1');
    });

    expect(result.current.plantillaPreviewId).toBe('pl-1');
    expect(result.current.cargandoPreviewPlantillaId).toBe('pl-1');
    expect(result.current.previewPdfUrlPorPlantillaId['pl-1']?.booklet).toBe('blob://test');
    expect(result.current.cargandoPreviewPdfPlantillaId).toBe('pl-1');

    // Comprobar paginas estimadas por tema
    expect(result.current.paginasEstimadasBackendPorTema.get('álgebra lineal')).toBe(3);
  });
});
