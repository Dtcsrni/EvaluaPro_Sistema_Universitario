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
import { clienteApi } from '../src/apps/app_docente/clienteApiDocente';

describe('hooks de plantillas', () => {
  it('verifica el hash del PDF de lote y difiere la liberación del Object URL', async () => {
    localStorage.setItem('tokenDocente', 'token-test');
    const bytes = new Blob(['%PDF-1.4 paquete QA']);
    const digest = await crypto.subtle.digest('SHA-256', await bytes.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => bytes,
      headers: { get: (name: string) => name === 'X-EvaluaPro-PDF-SHA256' ? hash : null }
    } as Response);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lote-qa');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const { result } = renderHook(() => usePlantillasGeneradosActions({
      avisarSinPermiso: vi.fn(),
      puedeDescargarExamenes: true,
      puedeRegenerarExamenes: false,
      puedeArchivarExamenes: false,
      descargandoExamenId: null,
      regenerandoExamenId: null,
      archivandoExamenId: null,
      setDescargandoExamenId: vi.fn(),
      setRegenerandoExamenId: vi.fn(),
      setArchivandoExamenId: vi.fn(),
      setMensajeGeneracion: vi.fn(),
      cargarExamenesGenerados: async () => {},
      enviarConPermiso: async () => ({}),
      lotePdfUrl: null
    }));

    await act(async () => result.current.descargarPdfLotePorId('LOT-QA'));
    expect(createObjectUrl).toHaveBeenCalledWith(bytes);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
  });

  it('rechaza un PDF de lote cuyo hash no coincide antes de iniciar la descarga', async () => {
    localStorage.setItem('tokenDocente', 'token-test');
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['%PDF-1.4 alterado']),
      headers: { get: () => '0'.repeat(64) }
    } as Response);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:no-debe-crearse');
    const setMensajeGeneracion = vi.fn();
    const { result } = renderHook(() => usePlantillasGeneradosActions({
      avisarSinPermiso: vi.fn(),
      puedeDescargarExamenes: true,
      puedeRegenerarExamenes: false,
      puedeArchivarExamenes: false,
      descargandoExamenId: null,
      regenerandoExamenId: null,
      archivandoExamenId: null,
      setDescargandoExamenId: vi.fn(),
      setRegenerandoExamenId: vi.fn(),
      setArchivandoExamenId: vi.fn(),
      setMensajeGeneracion,
      cargarExamenesGenerados: async () => {},
      enviarConPermiso: async () => ({}),
      lotePdfUrl: null
    }));

    await act(async () => result.current.descargarPdfLotePorId('LOT-QA'));
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(setMensajeGeneracion).toHaveBeenCalledWith(expect.stringContaining('integridad'));
  });

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
        omrSheetPages: [{ numero: 1, width: 100, height: 140, dataUrl: 'data:image/png;base64,AAAA' }],
        omrSheetPagesTotal: 1
      }
    });
  });

  it('valida la vista previa extraordinaria contra la preferencia global de páginas', async () => {
    localStorage.setItem('tokenDocente', 'token-test');
    vi.spyOn(clienteApi, 'obtener').mockResolvedValue({
      numeroPaginas: 6,
      totalDisponibles: 10,
      totalUsados: 10,
      preguntasOmitidasPorFormato: 0,
      preguntasOmitidasPorOmr: [],
      layoutConfirmado: true
    });
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        pdfBase64: btoa('%PDF-1.4 preview'),
        paginas: Array.from({ length: 6 }, (_, indice) => ({
          numero: indice + 1,
          width: 816,
          height: 1056,
          dataUrl: 'data:image/png;base64,AAAA'
        }))
      })
    } as Response);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-extra');
    const { result } = renderHook(() => usePlantillasPreviewActions({
      paginasExtraordinarioObjetivo: 6,
      puedePrevisualizarPlantillas: true,
      avisarSinPermiso: vi.fn(),
      previewPorPlantillaId: {},
      cargandoPreviewPlantillaId: null,
      cargandoPreviewPdfPlantillaId: null,
      setPreviewPorPlantillaId: vi.fn(),
      setCargandoPreviewPlantillaId: vi.fn(),
      setPlantillaPreviewId: vi.fn(),
      setPreviewPdfUrlPorPlantillaId: vi.fn(),
      setCargandoPreviewPdfPlantillaId: vi.fn()
    }));

    let preview: Awaited<ReturnType<typeof result.current.previsualizarPdfConfirmado>> = null;
    await act(async () => {
      preview = await result.current.previsualizarPdfConfirmado('pla-extra');
    });

    expect(preview?.layoutConfirmado).toBe(true);
    expect(preview?.paginas).toHaveLength(6);
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

  it('carga el detalle de assessment desde la ruta de exámenes generados', async () => {
    const obtener = vi.spyOn(clienteApi, 'obtener').mockResolvedValue({ assessment: {}, jobs: [] } as never);
    const setCargandoAssessmentId = vi.fn();
    const setAssessmentDetalle = vi.fn();
    const setMensajeGeneracion = vi.fn();
    const { result } = renderHook(() =>
      usePlantillasOmrActions({
        avisarSinPermiso: vi.fn(),
        puedeDescargarExamenes: true,
        puedeAnalizarOmr: true,
        setCargandoAssessmentId,
        setAssessmentDetalle,
        setProcesandoOmr: vi.fn(),
        setJobOmr: vi.fn(),
        setMensajeGeneracion
      })
    );

    await act(async () => {
      await result.current.cargarAssessmentDetalle('ass id/1');
    });

    expect(obtener).toHaveBeenCalledWith('/examenes/generados/ass%20id%2F1');
    expect(setCargandoAssessmentId).toHaveBeenNthCalledWith(1, 'ass id/1');
    expect(setAssessmentDetalle).toHaveBeenCalledWith({ assessment: {}, jobs: [] });
    expect(setCargandoAssessmentId).toHaveBeenLastCalledWith(null);
    expect(setMensajeGeneracion).not.toHaveBeenCalled();
    obtener.mockRestore();
  });
});
