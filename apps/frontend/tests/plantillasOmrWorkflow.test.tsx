/**
 * plantillasOmrWorkflow.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasOmrWorkflow } from '../src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow';
import type { GeneratedAssessmentDetalle, OmrJobDetalle } from '../src/apps/app_docente/tipos';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';

describe('PlantillasOmrWorkflow', () => {
  it('permite reintentar explícitamente una ingesta fallida desde los originales conservados', async () => {
    const onReintentarIngestaPdf = vi.fn().mockResolvedValue(undefined);
    const job = {
      jobId: 'ingesta-fallida', sourceType: 'pdf', status: 'failed', pagesTotal: 2, pagesProcessed: 1,
      files: [{ id: 'file-1', nombre: 'captura.pdf', bytes: 1024, pages: 2, sha256: 'a'.repeat(64) }],
      pages: [], packages: [], errors: [{ fileName: 'job', code: 'OMR_TEST_INTERRUPCION' }]
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-retry', folio: 'ASS-RETRY-001', generationSeed: 'seed', title: 'Global', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    render(
      <ConfirmDialogProvider>
        <PlantillasOmrWorkflow
          assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
          lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
          descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
          obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
          onReintentarIngestaPdf={onReintentarIngestaPdf} resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
        />
      </ConfirmDialogProvider>
    );

    expect(screen.getByText(/Falló el procesamiento\. Código\(s\): OMR_TEST_INTERRUPCION/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprocesar desde originales' }));
    expect(onReintentarIngestaPdf).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reprocesar' }));
    await waitFor(() => expect(onReintentarIngestaPdf).toHaveBeenCalledWith('ingesta-fallida'));
  });

  it('rechaza antes de enviar una selección mixta y conserva el envío conjunto de varios PDF', () => {
    const crearJobOmr = vi.fn().mockResolvedValue(undefined);
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-multi-pdf', folio: 'ASS-MULTI-001', generationSeed: 'seed', title: 'Examen', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={null} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        crearJobOmr={crearJobOmr} resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const input = screen.getByLabelText('Capturas o PDF');
    const botonProcesar = screen.getByRole('button', { name: 'Procesar capturas' });
    const pdfUno = new File(['pdf-1'], 'uno.pdf', { type: 'application/pdf' });
    const pdfDos = new File(['pdf-2'], 'dos.PDF', { type: 'application/pdf' });
    const imagen = new File(['image'], 'pagina.jpg', { type: 'image/jpeg' });

    fireEvent.change(input, { target: { files: [pdfUno, imagen] } });
    expect(screen.getByText(/Separa los PDF y las imágenes en jobs distintos/i)).toBeInTheDocument();
    expect(botonProcesar).toBeDisabled();
    fireEvent.click(botonProcesar);
    expect(crearJobOmr).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [pdfUno, pdfDos] } });
    expect(screen.queryByText(/Separa los PDF y las imágenes en jobs distintos/i)).not.toBeInTheDocument();
    expect(botonProcesar).toBeEnabled();
    fireEvent.click(botonProcesar);
    expect(crearJobOmr).toHaveBeenCalledWith({ assessmentId: 'ass-multi-pdf', files: [pdfUno, pdfDos], sourceType: 'pdf' });

    const referencia = new File(['referencia'], 'lote-generado.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('PDF generado del lote (opcional si EvaluaPro no conserva el original)'), { target: { files: [referencia] } });
    fireEvent.click(botonProcesar);
    expect(crearJobOmr).toHaveBeenLastCalledWith({ assessmentId: 'ass-multi-pdf', files: [pdfUno, pdfDos], sourceType: 'pdf', referencePdf: referencia });

    const pdfsPorEncimaDelLimite = Array.from({ length: 11 }, (_, index) => new File(['pdf'], `${index + 1}.pdf`, { type: 'application/pdf' }));
    fireEvent.change(input, { target: { files: pdfsPorEncimaDelLimite } });
    expect(screen.getByText('Divide los PDF en grupos de hasta 10 archivos.')).toBeInTheDocument();
    expect(botonProcesar).toBeDisabled();

    const pdfGrande = new File(['pdf'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfGrande, 'size', { configurable: true, value: 120 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [pdfGrande] } });
    expect(screen.getByText(/Cada PDF debe pesar como máximo 120 MiB/i)).toBeInTheDocument();
    expect(botonProcesar).toBeDisabled();

    const grupoGrande = Array.from({ length: 3 }, (_, index) => {
      const pdf = new File(['pdf'], `grupo-${index + 1}.pdf`, { type: 'application/pdf' });
      Object.defineProperty(pdf, 'size', { configurable: true, value: 90 * 1024 * 1024 });
      return pdf;
    });
    fireEvent.change(input, { target: { files: grupoGrande } });
    expect(screen.getByText(/grupo de PDF, incluida la referencia, supera 250 MiB/i)).toBeInTheDocument();
    expect(botonProcesar).toBeDisabled();
    expect(crearJobOmr).toHaveBeenCalledTimes(2);
  });

  it('permite elegir un lote archivado sin restaurarlo cuando no hay assessment cargado', async () => {
    const onSeleccionarLoteArchivado = vi.fn().mockResolvedValue(undefined);
    const lotesArchivadosOmr = [{ assessmentId: 'exam-1', loteId: 'batch-1', etiqueta: 'Inteligencia de Negocios · Lote batch-1', cantidad: 12 }];
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'exam-1', folio: 'FOLIO-1', generationSeed: 'seed', title: 'Global', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 0, pageCount: 0, questionCount: 0, uniqueQuestionCount: 0 }, artifacts: []
      }, jobs: []
    };
    const view = render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        lotesArchivadosOmr={lotesArchivadosOmr}
        cargandoLotesArchivadosOmr={false}
        onSeleccionarLoteArchivado={onSeleccionarLoteArchivado}
        jobOmr={null}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('heading', { name: /OMR canónico · v4/i })).toBeInTheDocument();
    const selector = screen.getByLabelText('Lote de examen');
    fireEvent.change(selector, { target: { value: 'exam-1' } });
    await waitFor(() => expect(onSeleccionarLoteArchivado).toHaveBeenCalledWith('exam-1'));

    view.rerender(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle}
        lotesArchivadosOmr={lotesArchivadosOmr}
        cargandoLotesArchivadosOmr={false}
        onSeleccionarLoteArchivado={onSeleccionarLoteArchivado}
        jobOmr={null}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.getByText(/Lote archivado seleccionado: Inteligencia de Negocios · Lote batch-1 · 12 exámenes/)).toBeInTheDocument();
  });

  it('coteja el PDF por QR contra los lotes disponibles antes de seleccionar el coincidente', async () => {
    const onSeleccionarLoteArchivado = vi.fn().mockResolvedValue(undefined);
    const prevalidarReferenciaOmr = vi.fn().mockResolvedValue({
      reference: { pages: 48, pagesWithSignedQr: 48 }, candidatesEvaluated: 2,
      matches: [{ assessmentId: 'exam-bi', loteId: 'batch-bi', examCount: 12, expectedPages: 48, matchedPages: 48 }]
    });
    const crearJobOmr = vi.fn().mockResolvedValue(undefined);
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        lotesArchivadosOmr={[
          { assessmentId: 'exam-ddaw', loteId: 'batch-ddaw', etiqueta: 'DDAW · Lote batch-ddaw', cantidad: 4 },
          { assessmentId: 'exam-bi', loteId: 'batch-bi', etiqueta: 'BI · Lote batch-bi', cantidad: 12 }
        ]}
        cargandoLotesArchivadosOmr={false}
        onSeleccionarLoteArchivado={onSeleccionarLoteArchivado}
        prevalidarReferenciaOmr={prevalidarReferenciaOmr}
        jobOmr={null}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        crearJobOmr={crearJobOmr}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const referencia = new File(['pdf'], 'Examen_Global_BI.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('PDF de referencia'), { target: { files: [referencia] } });
    fireEvent.click(screen.getByRole('button', { name: 'Cotejar y localizar lote' }));
    await waitFor(() => expect(onSeleccionarLoteArchivado).toHaveBeenCalledWith('exam-bi'));
    expect(prevalidarReferenciaOmr).toHaveBeenCalledWith({ assessmentIds: ['exam-ddaw', 'exam-bi'], referencePdf: referencia });
    expect(screen.getByText(/Coincidencia única: lote batch-bi, 12 exámenes y 48 páginas/)).toBeInTheDocument();
    expect(crearJobOmr).not.toHaveBeenCalled();
  });

  it('no selecciona lote ni crea job cuando la referencia no coincide exactamente', async () => {
    const onSeleccionarLoteArchivado = vi.fn().mockResolvedValue(undefined);
    const crearJobOmr = vi.fn().mockResolvedValue(undefined);
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        lotesArchivadosOmr={[{ assessmentId: 'exam-1', loteId: 'batch-1', etiqueta: 'BI · Lote batch-1', cantidad: 12 }]}
        cargandoLotesArchivadosOmr={false}
        onSeleccionarLoteArchivado={onSeleccionarLoteArchivado}
        prevalidarReferenciaOmr={vi.fn().mockResolvedValue({ reference: { pages: 48, pagesWithSignedQr: 47 }, candidatesEvaluated: 1, matches: [] })}
        jobOmr={null}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        crearJobOmr={crearJobOmr}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );
    fireEvent.change(screen.getByLabelText('PDF de referencia'), { target: { files: [new File(['pdf'], 'global.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Cotejar y localizar lote' }));
    await waitFor(() => expect(screen.getByText(/Ninguno de los 1 lotes tuvo coincidencia completa: 47\/48/)).toBeInTheDocument());
    expect(onSeleccionarLoteArchivado).not.toHaveBeenCalled();
    expect(crearJobOmr).not.toHaveBeenCalled();
  });

  it('distingue archivo vacío de error y permite reintentar una carga fallida', () => {
    const reintentar = vi.fn();
    const props = {
      assessmentDetalle: null,
      lotesArchivadosOmr: [],
      cargandoLotesArchivadosOmr: false,
      onSeleccionarLoteArchivado: vi.fn().mockResolvedValue(undefined),
      jobOmr: null,
      cargandoAssessmentId: null,
      procesandoOmr: false,
      descargarArtifact: vi.fn().mockResolvedValue(undefined),
      obtenerPreviewPaginaOmr: vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' })),
      obtenerPreviewReferenciaOmr: vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' })),
      crearJobOmr: vi.fn().mockResolvedValue(undefined),
      resolverHojaOmr: vi.fn().mockResolvedValue(undefined),
      finalizarJobOmr: vi.fn().mockResolvedValue(undefined)
    };

    const view = render(<PlantillasOmrWorkflow {...props} />);
    expect(screen.getByText(/No se encontraron lotes archivados/i)).toBeInTheDocument();

    view.rerender(
      <PlantillasOmrWorkflow
        {...props}
        errorCargaLotesArchivadosOmr="Servicio temporalmente no disponible"
        onReintentarCargaLotesArchivadosOmr={reintentar}
      />
    );
    expect(screen.getByText(/Servicio temporalmente no disponible/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(reintentar).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Lote de examen')).toBeDisabled();
  });

  it('muestra el historial OMR paginado y permite reabrir una ingesta aunque no haya examen seleccionado', async () => {
    const trabajo = {
      jobId: 'job-pdf-1', workflow: 'pdf_ingesta' as const, assessmentId: 'assessment-1', folio: 'FOLIO-1',
      sourceType: 'pdf' as const, status: 'completed', pagesTotal: 12, pagesProcessed: 12,
      summary: { accepted: 10, needsReview: 2, rejected: 0 }, createdAt: '2026-09-29T12:00:00.000Z', updatedAt: '2026-09-29T12:01:00.000Z'
    };
    const onAbrirTrabajoOmr = vi.fn().mockResolvedValue(undefined);
    const onCargarMasTrabajosOmr = vi.fn();
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        trabajosOmr={[trabajo]}
        hayMasTrabajosOmr
        onCargarMasTrabajosOmr={onCargarMasTrabajosOmr}
        onAbrirTrabajoOmr={onAbrirTrabajoOmr}
        lotesArchivadosOmr={[]}
        cargandoLotesArchivadosOmr={false}
        onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        jobOmr={null}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)}
        obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('heading', { name: 'Trabajos OMR recientes' })).toBeInTheDocument();
    const historial = within(screen.getByRole('list', { name: 'Historial de trabajos OMR' }));
    expect(historial.getByText('Folio: FOLIO-1')).toBeInTheDocument();
    expect(historial.getByText(/Job OMR:.*job-pdf-1/)).toBeInTheDocument();
    expect(historial.getByText(/PDF clasificado/)).toBeInTheDocument();
    fireEvent.click(historial.getByRole('button', { name: 'Reabrir revisión' }));
    expect(onAbrirTrabajoOmr).toHaveBeenCalledWith(trabajo);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más trabajos' }));
    expect(onCargarMasTrabajosOmr).toHaveBeenCalledOnce();
  });

  it('renderiza resumen de assessment y job OMR con hojas para revisión', async () => {
    const descargarArtifact = vi.fn().mockResolvedValue(undefined);
    const assessmentMock: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-1',
        folio: 'ASS-FOLIO-101',
        generationSeed: 'seed-xyz',
        title: 'Examen Biología Celular',
        templateId: 'plan-1',
        templateVersion: 4,
        bookletPdfUrl: '/examenes/generados/ass-1/pdf',
        omrSheetPdfUrl: '/examenes/generados/ass-1/pdf?tipo=omr',
        answerKeyUrl: '/examenes/generados/ass-1/answer-key',
        manifestUrl: '/examenes/generados/ass-1/manifest',
        statisticsSummary: {
          versionCount: 2,
          pageCount: 1,
          questionCount: 10,
          uniqueQuestionCount: 10
        },
        artifacts: []
      },
      jobs: []
    };

    const jobOmrMock: OmrJobDetalle & { packages?: Array<{ id: string; fileName: string; status: string; pageCount: number; course: string; subject: string; partial: string; teacher: string; student: string; group: string; folio: string }>; files?: Array<{ id: string; nombre: string; bytes: number; pages: number; sha256: string }> } = {
      jobId: 'job-101',
      assessmentId: 'ass-1',
      packages: [{ id: 'pkg-1', fileName: 'alumno.pdf', status: 'complete', pageCount: 1, course: 'Curso', subject: 'Materia', partial: 'Global', teacher: 'Docente', student: 'Alumno', group: '23A', folio: 'FOLIO-1' }],
      files: [{ id: 'src-1', nombre: 'scan.pdf', bytes: 1024, pages: 1, sha256: 'a'.repeat(64) }],
      status: 'review_pending',
      summary: {
        total: 1,
        accepted: 0,
        needsReview: 1,
        rejected: 0,
        autoGradable: 0,
        averageScore: 0
      },
      pages: [
        {
          sheetSerial: 'SH-001',
          pageIndex: 1,
          sourceFileId: 'src-1',
          sourceFileName: 'scan.pdf',
          sourcePage: 2,
          examId: 'ass-1',
          examPage: 1,
          scanStatus: 'needs_review',
          confidence: 0.85,
          autoGradable: false,
          exceptions: [{ code: 'LOW_CONFIDENCE', message: 'Revisión requerida' }],
          identityResult: { studentId: 'CUH111' },
          versionResult: { versionCode: 'A' },
          responses: [{
            numeroPregunta: 1,
            opcion: null,
            opcionDetectada: null,
            confianza: 0.44,
            estadoRespuesta: 'doble_marca',
            flags: ['bajo_contraste', 'doble_marca'],
            candidatas: [
              { opcion: 'C', score: 0.68, fillRatioCore: 0.76, estadoMarca: 'marcada' },
              { opcion: 'D', score: 0.53, fillRatioCore: 0.59, estadoMarca: 'marcada' }
            ]
          }]
        }
      ]
    };

    const mockResolver = vi.fn().mockResolvedValue(undefined);
    const mockFinalizar = vi.fn().mockResolvedValue(undefined);
    const obtenerPreviewPaginaOmr = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    const obtenerPreviewReferenciaOmr = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentMock}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        jobOmr={jobOmrMock}
        cargandoAssessmentId={null}
        procesandoOmr={false}
        descargarArtifact={descargarArtifact}
        obtenerPreviewPaginaOmr={obtenerPreviewPaginaOmr}
        obtenerPreviewReferenciaOmr={obtenerPreviewReferenciaOmr}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={mockResolver}
        finalizarJobOmr={mockFinalizar}
      />
    );

    expect(screen.getByText(/Folio: ASS-FOLIO-101/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paquetes por alumno' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Archivos originales conservados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar original' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar manifiesto anonimizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SH-001 · P1 · needs_review/i })).toBeInTheDocument();

    // Seleccionar hoja para revisión
    const botonHoja = screen.getByRole('button', { name: /SH-001 · P1 · needs_review/i });
    fireEvent.click(botonHoja);

    expect(screen.getByRole('heading', { name: /Review & Fix: SH-001/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('CUH111')).toBeInTheDocument();
    expect(screen.getByText('Estado: Varias marcas')).toBeInTheDocument();
    expect(screen.getByText('Opción detectada: Ninguna')).toBeInTheDocument();
    expect(screen.getByText(/Candidatas OMR: C \(68%, marcada\) · D \(53%, marcada\)/i)).toBeInTheDocument();
    expect(screen.getByText('Señales: bajo_contraste, doble_marca')).toBeInTheDocument();

    const createObjectUrlOriginal = URL.createObjectURL;
    const revokeObjectUrlOriginal = URL.revokeObjectURL;
    const createObjectUrl = vi.fn().mockReturnValue('blob:omr-page-preview');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar página de origen 2/i }));
    await waitFor(() => expect(screen.getByAltText('Página original 2 de scan.pdf')).toHaveAttribute('src', 'blob:omr-page-preview'));
    expect(obtenerPreviewPaginaOmr).toHaveBeenCalledWith('job-101', 1);
    fireEvent.click(screen.getByRole('button', { name: /Mostrar página 1 del PDF generado/i }));
    await waitFor(() => expect(screen.getByAltText('Página 1 del examen generado ass-1')).toHaveAttribute('src', 'blob:omr-page-preview'));
    expect(obtenerPreviewReferenciaOmr).toHaveBeenCalledWith('job-101', 1, 'ass-1', 1);
    if (createObjectUrlOriginal) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrlOriginal });
    else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    if (revokeObjectUrlOriginal) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrlOriginal });
    else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;

    const botonResolver = screen.getByRole('button', { name: /Guardar resolución/i });
    expect(botonResolver).not.toBeDisabled();
    fireEvent.click(botonResolver);

    expect(mockResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-101',
        sheetSerial: 'SH-001'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Descargar cuadernillo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar hoja OMR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar answer key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar manifest' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar original' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar manifiesto anonimizado' }));
    expect(descargarArtifact).toHaveBeenCalledTimes(7);
  });

  it('previsualiza la referencia elegida antes de vincular manualmente una página pendiente', async () => {
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'exam-1', folio: 'EX-001', generationSeed: 'seed', title: 'Ciencias', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 2, uniqueQuestionCount: 2 }, artifacts: []
      }, jobs: []
    };
    const job: OmrJobDetalle = {
      jobId: 'ingesta-1', sourceType: 'pdf', status: 'completed', pagesTotal: 1, pagesProcessed: 1,
      packages: [], files: [{ id: 'file-1', nombre: 'scan.pdf', bytes: 1024, pages: 1, sha256: 'a'.repeat(64) }],
      candidateExams: [{ id: 'exam-2', folio: 'EX-002', studentName: 'Ana Pérez', group: '2A', pages: [1, 2] }],
      pages: [{
        sheetSerial: 'PENDIENTE-1', pageIndex: 1, sourceFileId: 'file-1', sourceFileName: 'scan.pdf', sourcePage: 1,
        scanStatus: 'needs_review', confidence: 0, autoGradable: false, manualReviewRequired: true, responses: [],
        ocrSuggestion: { generatedAssessmentId: 'exam-2', folio: 'EX-002', examPage: 2, confidence: 88, source: 'ocr_two_position_consensus', matchingPositions: 2 },
        exceptions: [{ code: 'OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE', severity: 'warning', message: 'QR pendiente' }]
      }]
    } as OmrJobDetalle;
    const resolver = vi.fn().mockResolvedValue(undefined);
    const obtenerPreviewReferenciaOmr = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:manual-reference') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }))} obtenerPreviewReferenciaOmr={obtenerPreviewReferenciaOmr} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={resolver} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /PENDIENTE-1 · P1 · needs_review/i }));
    expect(screen.getByLabelText('Examen del lote')).toHaveValue('exam-2');
    expect(screen.getByLabelText('Página del examen')).toHaveValue('2');
    expect(screen.getByText(/OCR coincide en 2 posiciones/i)).toBeInTheDocument();
    expect(screen.getByText(/compara visualmente las páginas antes de confirmar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar página 2 del PDF generado/i }));
    await waitFor(() => expect(screen.getByAltText('Página 2 del examen generado exam-2')).toHaveAttribute('src', 'blob:manual-reference'));
    expect(obtenerPreviewReferenciaOmr).toHaveBeenCalledWith('ingesta-1', 1, 'exam-2', 2);
    fireEvent.click(screen.getByRole('button', { name: /Guardar resolución/i }));

    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'ingesta-1',
      sheetSerial: 'PENDIENTE-1',
      ingestionResolution: { pageIndex: 1, generatedAssessmentId: 'exam-2', examPage: 2 }
    }));
    if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });
});
