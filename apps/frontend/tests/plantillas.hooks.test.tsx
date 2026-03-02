import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePlantillasGeneradosActions } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasGeneradosActions';
import { usePlantillasOmrV1Actions } from '../src/apps/app_docente/features/plantillas/hooks/usePlantillasOmrV1Actions';
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

  it('usePlantillasOmrV1Actions avisa cuando no hay permiso para analizar OMR', async () => {
    const avisarSinPermiso = vi.fn();
    const { result } = renderHook(() =>
      usePlantillasOmrV1Actions({
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
