import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOmrWorkflowState } from '../src/apps/app_docente/hooks/useOmrWorkflowState';
import type { ResultadoOmr } from '../src/apps/app_docente/tipos';

describe('useOmrWorkflowState hook', () => {
  it('inicializa con valores por defecto y maneja selección y edición de páginas OMR', () => {
    const { result } = renderHook(() => useOmrWorkflowState());

    expect(result.current.resultadoOmr).toBeNull();
    expect(result.current.examenIdOmr).toBeNull();
    expect(result.current.examenOmrActivo).toBeNull();
    expect(result.current.hayCambiosPendientesOmrActiva).toBe(false);

    const resultadoMock: ResultadoOmr = {
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.95 }],
      esValido: true,
      rawOutput: ''
    };

    // Cargar revisión histórica
    act(() => {
      result.current.cargarRevisionHistoricaCalificada({
        examenId: 'ex-100',
        folio: 'FOLIO-100',
        alumnoId: 'al-1',
        numeroPagina: 1,
        respuestas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.95 }],
        paginas: [
          {
            numeroPagina: 1,
            resultado: resultadoMock,
            respuestas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.95 }]
          }
        ],
        claveCorrectaPorNumero: { 1: 'A' },
        ordenPreguntas: [1],
        resultado: resultadoMock
      });
    });

    expect(result.current.examenIdOmr).toBe('ex-100');
    expect(result.current.examenAlumnoId).toBe('al-1');
    expect(result.current.paginaOmrActiva).toBe(1);
    expect(result.current.examenOmrActivo?.folio).toBe('FOLIO-100');
    expect(result.current.claveCorrectaOmrActiva).toEqual({ 1: 'A' });
    expect(result.current.ordenPreguntasClaveOmrActiva).toEqual([1]);
    expect(result.current.respuestasParaCalificarOmrActiva).toHaveLength(1);

    // Modificar una respuesta
    act(() => {
      result.current.actualizarRespuestaPreguntaOmrActiva(1, 'B');
    });

    expect(result.current.hayCambiosPendientesOmrActiva).toBe(true);
    expect(result.current.respuestasEditadas[0]?.opcion).toBe('B');

    // Confirmar revisión
    act(() => {
      result.current.confirmarRevisionOmrActiva(true);
    });

    expect(result.current.revisionOmrConfirmada).toBe(true);
    expect(result.current.hayCambiosPendientesOmrActiva).toBe(false);

    // Actualizar respuestas en lote
    act(() => {
      result.current.actualizarRespuestasOmrActivas([
        { numeroPregunta: 1, opcion: 'C', confianza: 1.0 }
      ]);
    });

    expect(result.current.respuestasEditadas[0]?.opcion).toBe('C');
    expect(result.current.revisionOmrConfirmada).toBe(false);
  });
});
