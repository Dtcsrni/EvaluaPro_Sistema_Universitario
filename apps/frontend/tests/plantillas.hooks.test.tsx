/**
 * plantillas.hooks.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePlantillasGeneradosActions } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasGeneradosActions';
import { usePlantillasOmrActions } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasOmrActions';
import { usePlantillasPreviewActions } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasPreviewActions';

describe('hooks de plantillas', () => {
  it('usePlantillasGeneradosActions avisa cuando no hay permiso para descargar lote', async () => {
    const avisarSinPermiso = vi.fn();
    const { result } = renderHook(() =>
      usePlantillasGeneradosActions({
        avisarSinPermiso,
        puedeDescargarExamenes: false,
        puedeRegenerarExamenes: false,
        puedeArchivarExamenes: false,
        descargandoExamenId: null,
        regenerandoExamenId: null,
        archivandoExamenId: null,
        setDescargandoExamenId: () => {},
        setRegenerandoExamenId: () => {},
        setArchivandoExamenId: () => {},
        setMensajeGeneracion: () => {},
        cargarExamenesGenerados: async () => {},
        enviarConPermiso: async () => ({}),
        lotePdfUrl: '/examenes/generados/lote/abc/pdf'
      })
    );

    await result.current.descargarPdfLote();
    expect(avisarSinPermiso).toHaveBeenCalled();
  });

  it('usePlantillasPreviewActions avisa cuando no hay permiso de previsualizacion', async () => {
    const avisarSinPermiso = vi.fn();
    const setPreviewPorPlantillaId = vi.fn();
    const { result } = renderHook(() =>
      usePlantillasPreviewActions({
        puedePrevisualizarPlantillas: false,
        avisarSinPermiso,
        previewPorPlantillaId: {},
        cargandoPreviewPlantillaId: null,
        cargandoPreviewPdfPlantillaId: null,
        setPreviewPorPlantillaId,
        setCargandoPreviewPlantillaId: () => {},
        setPlantillaPreviewId: () => {},
        setPreviewPdfUrlPorPlantillaId: () => {},
        setCargandoPreviewPdfPlantillaId: () => {}
      })
    );

    await result.current.cargarPreviewPlantilla('pla-1');
    expect(avisarSinPermiso).toHaveBeenCalled();
    expect(setPreviewPorPlantillaId).not.toHaveBeenCalled();
  });

  it('fuerza la regeneracion del PDF y conserva el tipo de preview solicitado', async () => {
    localStorage.setItem('tokenDocente', 'token-test');
    const fetchMock = vi.mocked(global.fetch);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-actualizado');
    const pdfBase64 = btoa('%PDF-1.4 preview');
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        pdfBase64,
        paginas: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AAAA' }]
      })
    } as Response);
    const setPreviewPdfUrlPorPlantillaId = vi.fn();
    const { result } = renderHook(() =>
      usePlantillasPreviewActions({
        puedePrevisualizarPlantillas: true,
        avisarSinPermiso: () => {},
        previewPorPlantillaId: {},
        cargandoPreviewPlantillaId: null,
        cargandoPreviewPdfPlantillaId: null,
        setPreviewPorPlantillaId: () => {},
        setCargandoPreviewPlantillaId: () => {},
        setPlantillaPreviewId: () => {},
        setPreviewPdfUrlPorPlantillaId,
        setCargandoPreviewPdfPlantillaId: () => {}
      })
    );

    await act(async () => {
      await result.current.cargarPreviewPdfPlantilla('pla-1', 'omrSheet');
    });

    const llamada = fetchMock.mock.calls.find(([input]) => String(input).includes('/examenes/plantillas/pla-1/previsualizar/pdf'));
    expect(llamada).toBeTruthy();
    expect(String(llamada?.[0])).toMatch(/\/previsualizar\/pdf\/visual[?&]refresh=\d+/);
    expect(createObjectUrl).toHaveBeenCalled();
    const actualizador = setPreviewPdfUrlPorPlantillaId.mock.calls[0]?.[0] as (prev: Record<string, unknown>) => Record<string, unknown>;
    expect(actualizador({})).toEqual({
      'pla-1': {
        omrSheet: 'blob:preview-actualizado',
        omrSheetPages: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AAAA' }]
      }
    });
  });

  it('usePlantillasOmrActions avisa cuando no hay permiso para analizar OMR', async () => {
    const avisarSinPermiso = vi.fn();
    const { result } = renderHook(() =>
      usePlantillasOmrActions({
        avisarSinPermiso,
        puedeDescargarExamenes: true,
        puedeAnalizarOmr: false,
        setCargandoAssessmentId: () => {},
        setAssessmentDetalle: () => {},
        setProcesandoOmr: () => {},
        setJobOmr: () => {},
        setMensajeGeneracion: () => {}
      })
    );

    await result.current.crearJobOmr({
      assessmentId: 'ass-1',
      files: [new File(['hola'], 'captura.png', { type: 'image/png' })],
      sourceType: 'image_batch'
    });

    expect(avisarSinPermiso).toHaveBeenCalled();
  });
});
