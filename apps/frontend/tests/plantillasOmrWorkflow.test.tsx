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
  it('abre cotejo manual solo con todas las páginas aceptadas por QR y conserva las capturas de origen', async () => {
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'assessment-1', folio: 'LOTE-001', generationSeed: 'seed', title: 'Segundo Parcial', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 2, questionCount: 2, uniqueQuestionCount: 2 }, artifacts: []
      }, jobs: []
    };
    const job: OmrJobDetalle = {
      jobId: 'ingesta-manual-1', sourceType: 'pdf', status: 'completed', pagesTotal: 2, pagesProcessed: 2,
      files: [{ id: 'source-1', nombre: 'examenes.pdf', bytes: 2048, pages: 2, sha256: 'a'.repeat(64) }],
      packages: [{ id: 'package-1', fileName: 'FOL-001.pdf', status: 'complete', pageCount: 2, course: 'Curso', subject: 'Segundo Parcial', partial: 'parcial', teacher: 'Docente', student: 'Ana', group: '23A', folio: 'FOL-001' }],
      candidateExams: [{ id: 'exam-1', folio: 'FOL-001', studentName: 'Ana', group: '23A', pages: [1, 2] }],
      pages: [
        { sheetSerial: 'S-2', pageIndex: 2, scanStatus: 'accepted', confidence: 1, sourceFileId: 'source-1', sourceFileName: 'examenes.pdf', sourcePage: 2, examId: 'exam-1', folio: 'FOL-001', examPage: 2, identitySource: 'qr', identityResult: { studentId: 'alu-1' }, responses: [] },
        { sheetSerial: 'S-1', pageIndex: 1, scanStatus: 'accepted', confidence: 1, sourceFileId: 'source-1', sourceFileName: 'examenes.pdf', sourcePage: 1, examId: 'exam-1', folio: 'FOL-001', examPage: 1, identitySource: 'qr', identityResult: { studentId: 'alu-1' }, responses: [] }
      ]
    };
    const obtenerPreviewPaginaOmr = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    const onPrepararCalificacionManual = vi.fn().mockResolvedValue(undefined);
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={obtenerPreviewPaginaOmr}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }))}
        crearJobOmr={vi.fn().mockResolvedValue(undefined)} resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
        finalizarJobOmr={vi.fn().mockResolvedValue(undefined)} onPrepararCalificacionManual={onPrepararCalificacionManual}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Revisar manualmente con captura y clave' }));
    await waitFor(() => expect(onPrepararCalificacionManual).toHaveBeenCalledWith({
      examenId: 'exam-1', folio: 'FOL-001', alumnoId: 'alu-1',
      paginas: [
        { numeroPagina: 1, imagenBase64: 'data:image/png;base64,cG5n', nombreArchivo: 'examenes.pdf' },
        { numeroPagina: 2, imagenBase64: 'data:image/png;base64,cG5n', nombreArchivo: 'examenes.pdf' }
      ]
    }));
    expect(obtenerPreviewPaginaOmr).toHaveBeenNthCalledWith(1, 'ingesta-manual-1', 1);
    expect(obtenerPreviewPaginaOmr).toHaveBeenNthCalledWith(2, 'ingesta-manual-1', 2);
  });

  it('mantiene el autocalificador oculto hasta aprobar el piloto real y lo muestra con gate abierto', () => {
    const job = {
      jobId: 'ingesta-calificacion', sourceType: 'pdf', status: 'completed', pagesTotal: 1, pagesProcessed: 1,
      pages: [], files: [],
      packages: [{ id: 'package-1', examId: 'exam-1', fileName: 'folio.pdf', status: 'complete', pageCount: 1, course: 'Curso', subject: 'Materia', partial: 'parcial', teacher: 'Docente', student: 'Alumno', group: 'A', folio: 'FOL-001' }],
      autoGradingAvailable: false,
      loteId: 'LOTE-001',
      candidateExams: [{
        id: 'exam-1', folio: 'FOL-001', studentName: 'Alumno', group: 'A', pages: [1], totalQuestions: 19,
        templateVersion: 4, variantHashes: ['VAR-001'], answerKeyHashes: ['KEY-001'], variantVerified: true,
        answerKeySnapshotVerified: true, answerKeySnapshotQuestions: 19
      }],
      autoGradingGateReason: 'Piloto TV4 real pendiente de validación independiente.'
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'assessment-1', folio: 'ASS-001', generationSeed: 'seed', title: 'Examen', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    const calificarLoteOmr = vi.fn().mockResolvedValue({ clientRequestId: 'request', status: 'completed', startedAt: '', results: [] });
    const props = {
      assessmentDetalle, jobOmr: job, cargandoAssessmentId: null, procesandoOmr: false,
      lotesArchivadosOmr: [], cargandoLotesArchivadosOmr: false, onSeleccionarLoteArchivado: vi.fn().mockResolvedValue(undefined),
      descargarArtifact: vi.fn().mockResolvedValue(undefined), obtenerPreviewPaginaOmr: vi.fn().mockResolvedValue(new Blob()),
      obtenerPreviewReferenciaOmr: vi.fn().mockResolvedValue(new Blob()), crearJobOmr: vi.fn().mockResolvedValue(undefined),
      resolverHojaOmr: vi.fn().mockResolvedValue(undefined), finalizarJobOmr: vi.fn().mockResolvedValue(undefined),
      puedeCalificarOmr: true, calificarLoteOmr
    };
    const view = render(<PlantillasOmrWorkflow {...props} />);
    expect(screen.getByRole('region', { name: 'Vista previa de calificación OMR' })).toHaveTextContent('LOTE-001 · 1 examen · 1 páginas procesadas · 1 paquetes completos de 1');
    expect(screen.getByText(/Escala 0–5 · omisión confirmada cuenta como incorrecta/i)).toBeInTheDocument();
    expect(screen.getByText(/VAR-001 \(verificada\) · clave KEY-001 · snapshot verificado 19\/19/i)).toBeInTheDocument();
    expect(screen.getByText(/Piloto TV4 real pendiente de validación independiente/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calificar automáticamente los elegibles' })).not.toBeInTheDocument();

    view.rerender(<PlantillasOmrWorkflow {...props} jobOmr={{ ...job, autoGradingAvailable: true }} />);
    expect(screen.getByRole('button', { name: 'Calificar automáticamente los elegibles' })).toBeInTheDocument();
    expect(calificarLoteOmr).not.toHaveBeenCalled();
  });

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

  it('permite elegir lotes activos y archivados e identifica el estado sin restaurar el archivo', async () => {
    const onSeleccionarLoteArchivado = vi.fn().mockResolvedValue(undefined);
    const lotesArchivadosOmr = [
      { assessmentId: 'exam-1', loteId: 'batch-1', etiqueta: 'Inteligencia de Negocios · Lote batch-1', cantidad: 12, archivado: true },
      { assessmentId: 'exam-active', loteId: 'batch-active', etiqueta: 'Legalidad · Lote batch-active', cantidad: 12, archivado: false }
    ];
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
    expect(screen.getByRole('option', { name: /batch-active · 12 exámenes · Activo/ })).toBeInTheDocument();
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
        prevalidarReferenciaOmr={vi.fn().mockResolvedValue({
          reference: { pages: 48, pagesWithSignedQr: 47, pagesWithExpectedQrPattern: 46, pagesWithInvalidSignature: 1 },
          candidatesEvaluated: 1,
          candidateDiagnostics: [{ structureValid: true, reasons: { firmaInvalida: 0, geometriaAusente: 0, qrAusente: 0, qrMalformado: 0 } }],
          matches: []
        })}
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
    expect(screen.getByText(/Diagnóstico: 46\/48 patrones QR esperados localizados; 1 página con firma inválida/)).toBeInTheDocument();
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
    expect(screen.getByText(/No se encontraron lotes generados/i)).toBeInTheDocument();

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
          // Las respuestas de jobs históricos pueden omitir exceptions.
          exceptions: undefined,
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

    expect(screen.getByRole('heading', { name: /Revisión de página: SH-001/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('CUH111')).toBeInTheDocument();
    expect(screen.getByText(/Las respuestas sugeridas, candidatas y señales del lector OMR están ocultas/i)).toBeInTheDocument();
    expect(screen.getByText('Predicción automática oculta hasta terminar esta revisión.')).toBeInTheDocument();
    expect(screen.queryByText('Estado: Varias marcas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Candidatas OMR:/i)).not.toBeInTheDocument();
    const botonResolver = screen.getByRole('button', { name: /Guardar resolución/i });
    expect(botonResolver).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Marca observada P1'), { target: { value: 'double' } });
    fireEvent.click(screen.getByLabelText('C'));
    fireEvent.click(screen.getByLabelText('D'));
    expect(botonResolver).toBeDisabled();

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
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que registré cada respuesta desde la captura original/i }));
    if (createObjectUrlOriginal) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrlOriginal });
    else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    if (revokeObjectUrlOriginal) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrlOriginal });
    else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;

    expect(botonResolver).not.toBeDisabled();
    fireEvent.click(botonResolver);

    expect(mockResolver).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-101',
        sheetSerial: 'SH-001',
        confirmOriginalVisualReview: true,
        confirmBlindOmrReview: true,
        finalResponses: [{ numeroPregunta: 1, opcion: null, tipoMarcaManual: 'double', selectedOptions: ['C', 'D'] }]
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

  it('captura secuencia de verdad terreno ciega, rechaza longitudes incompletas y conserva ocultas sus predicciones', async () => {
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'exam-1', folio: 'EX-001', generationSeed: 'seed', title: 'Ciencias', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    const job = {
      jobId: 'ingesta-accepted', sourceType: 'pdf', status: 'completed', pagesTotal: 1, pagesProcessed: 1,
      files: [{ id: 'file-1', nombre: 'accepted.pdf', bytes: 1024, pages: 1, sha256: 'a'.repeat(64) }],
      packages: [{ id: 'package-1', examId: 'exam-1', fileName: 'exam.pdf', status: 'complete', pageCount: 1, course: 'Curso', subject: 'Materia', partial: 'P2', teacher: 'Docente', student: 'Ana', group: 'A', folio: 'FOL-1' }],
      pages: [{
        sheetSerial: 'FOL-1-P1', pageIndex: 1, sourceFileId: 'file-1', sourceFileName: 'accepted.pdf', sourcePage: 1,
        examId: 'exam-1', folio: 'FOL-1', examPage: 1, identitySource: 'qr', scanStatus: 'accepted', confidence: 0.99,
        autoGradable: false, manualReviewRequired: false,
        responses: [
          { numeroPregunta: 1, opcion: 'A', opcionDetectada: 'A', estadoRespuesta: 'respondida', candidatas: [{ opcion: 'A', score: 0.99 }] },
          { numeroPregunta: 2, opcion: 'C', opcionDetectada: 'C', estadoRespuesta: 'respondida', candidatas: [{ opcion: 'C', score: 0.91 }] },
          { numeroPregunta: 3, opcion: 'D', opcionDetectada: 'D', estadoRespuesta: 'respondida', candidatas: [{ opcion: 'D', score: 0.88 }] },
          { numeroPregunta: 4, opcion: 'E', opcionDetectada: 'E', estadoRespuesta: 'respondida', candidatas: [{ opcion: 'E', score: 0.86 }] }
        ],
        exceptions: []
      }]
    } as unknown as OmrJobDetalle;
    const guardarVerdadTerreno = vi.fn().mockResolvedValue(undefined);
    const obtenerPreviewPaginaOmr = vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:accepted-page') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    try {
      render(
        <PlantillasOmrWorkflow
          assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
          lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
          descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={obtenerPreviewPaginaOmr}
          obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' }))}
          crearJobOmr={vi.fn().mockResolvedValue(undefined)} resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
          registrarVerdadTerrenoOmr={guardarVerdadTerreno} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /FOL-1-P1 · P1 · accepted/i }));
      expect(screen.queryByText('Opción detectada: A')).not.toBeInTheDocument();
      expect(screen.queryByText(/Candidatas OMR:/i)).not.toBeInTheDocument();
      const secuencia = screen.getByLabelText('Secuencia de marcas observadas');
      fireEvent.change(secuencia, { target: { value: 'B - ?' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar secuencia' }));
      expect(screen.getByText('La secuencia tiene 3 marcas y esta página requiere 4.')).toBeInTheDocument();
      expect(screen.getByLabelText('Marca observada P1')).toHaveValue('');
      fireEvent.change(secuencia, { target: { value: 'B - ? CE' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar secuencia' }));
      expect(screen.getByText(/Marca 4.*no válida.*!AB para doble marca/i)).toBeInTheDocument();
      fireEvent.change(secuencia, { target: { value: 'B - ? !CE' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar secuencia' }));
      expect(screen.getByLabelText('Marca observada P1')).toHaveValue('valid:B');
      expect(screen.getByLabelText('Marca observada P2')).toHaveValue('blank');
      expect(screen.getByLabelText('Marca observada P3')).toHaveValue('smudge');
      expect(screen.getByLabelText('Marca observada P4')).toHaveValue('double');
      expect(screen.getByLabelText('C')).toBeChecked();
      expect(screen.getByLabelText('E')).toBeChecked();
      fireEvent.click(screen.getByRole('button', { name: /Mostrar página de origen 1/i }));
      await waitFor(() => expect(screen.getByAltText('Página original 1 de accepted.pdf')).toHaveAttribute('src', 'blob:accepted-page'));
      fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que registré cada respuesta desde la captura original/i }));
      const guardar = screen.getByRole('button', { name: 'Guardar etiqueta ciega' });
      expect(guardar).toBeDisabled();
      fireEvent.click(screen.getByRole('radio', { name: 'No aparece' }));
      expect(guardar).toBeEnabled();
      fireEvent.click(guardar);
      expect(guardarVerdadTerreno).toHaveBeenCalledWith({
        jobId: 'ingesta-accepted', pageIndex: 1,
        bonusVisible: false,
         finalResponses: [
           { numeroPregunta: 1, opcion: 'B', tipoMarcaManual: 'valid', selectedOptions: ['B'] },
           { numeroPregunta: 2, opcion: null, tipoMarcaManual: 'blank', selectedOptions: [] },
           { numeroPregunta: 3, opcion: null, tipoMarcaManual: 'smudge', selectedOptions: [] },
           { numeroPregunta: 4, opcion: null, tipoMarcaManual: 'double', selectedOptions: ['C', 'E'] }
         ]
      });
      expect(obtenerPreviewPaginaOmr).toHaveBeenCalledWith('ingesta-accepted', 1);
    } finally {
      if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
      else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
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
    expect(screen.queryByText(/OCR coincide en 2 posiciones/i)).not.toBeInTheDocument();
    expect(screen.getByText(/compara visualmente las páginas antes de confirmar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar página de origen 1/i }));
    await waitFor(() => expect(screen.getByAltText('Página original 1 de scan.pdf')).toHaveAttribute('src', 'blob:manual-reference'));
    fireEvent.click(screen.getByRole('button', { name: /Mostrar página 2 del PDF generado/i }));
    await waitFor(() => expect(screen.getByAltText('Página 2 del examen generado exam-2')).toHaveAttribute('src', 'blob:manual-reference'));
    expect(obtenerPreviewReferenciaOmr).toHaveBeenCalledWith('ingesta-1', 1, 'exam-2', 2);
    const botonGuardar = screen.getByRole('button', { name: /Guardar resolución/i });
    expect(botonGuardar).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que registré cada respuesta desde la captura original/i }));
    expect(botonGuardar).not.toBeDisabled();
    fireEvent.click(botonGuardar);

    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'ingesta-1',
      sheetSerial: 'PENDIENTE-1',
      confirmOriginalVisualReview: true,
      confirmBlindOmrReview: true,
      ingestionResolution: { pageIndex: 1, generatedAssessmentId: 'exam-2', examPage: 2 }
    }));
    if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it('mantiene abierta la revisión de jobs históricos sin respuestas por reactivo y evita tratarlos como etiquetas completas', () => {
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'exam-legacy', folio: 'LEGACY-001', generationSeed: 'seed', title: 'Ciencias', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 2, uniqueQuestionCount: 2 }, artifacts: []
      }, jobs: []
    };
    const job = {
      jobId: 'job-historico', sourceType: 'pdf', status: 'completed', pagesTotal: 1, pagesProcessed: 1,
      files: [{ id: 'source-1', nombre: 'captura.pdf', bytes: 1024, pages: 1, sha256: 'a'.repeat(64) }], packages: [],
      candidateExams: [{ id: 'exam-legacy', folio: 'LEGACY-001', studentName: 'Ana', group: '23A', pages: [1], totalQuestions: 2 }],
      pages: [{
        sheetSerial: 'LEGACY-P1', pageIndex: 1, sourceFileId: 'source-1', sourceFileName: 'captura.pdf', sourcePage: 1,
        scanStatus: 'needs_review', confidence: 0, examId: 'exam-legacy', folio: 'LEGACY-001', examPage: 1, identitySource: 'qr',
        humanReview: { method: 'visual_original_capture', reviewedAt: '2026-10-23T12:00:00.000Z', independentOfOmr: true, omrPredictionsHidden: true },
        groundTruthReview: { bonusVisible: false }
      }]
    } as unknown as OmrJobDetalle;

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /LEGACY-P1 · P1 · needs_review/i }));

    expect(screen.getByRole('heading', { name: /Revisión de página: LEGACY-P1/i })).toBeInTheDocument();
    expect(screen.getByText(/no contiene respuestas por reactivo/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Incluir página 1 con etiquetas revisadas/i })).not.toBeInTheDocument();
  });

  it('exporta solo páginas con resolución manual guardada tras advertir sobre identificadores en los píxeles', async () => {
    const descargarDatasetOmr = vi.fn().mockResolvedValue({ sha256: 'f'.repeat(64), sourceCount: 1, labelCount: 1 });
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'exam-1', folio: 'EX-001', generationSeed: 'seed', title: 'Ciencias', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    const job = {
      jobId: 'job-dataset', sourceType: 'pdf', status: 'completed', pagesTotal: 2, pagesProcessed: 2,
      files: [{ id: 'source-1', nombre: 'scan.pdf', bytes: 1024, pages: 2, sha256: 'a'.repeat(64) }], packages: [],
      candidateExams: [
        { id: 'exam-1', folio: 'FOLIO-PRIVADO', studentName: 'Ana', group: '23A', pages: [1] },
        { id: 'exam-2', folio: 'FOLIO-2', studentName: 'Luis', group: '23A', pages: [1, 2] }
      ],
      pages: [
        {
          sheetSerial: 'QR-PRIVADO', pageIndex: 1, sourceFileId: 'source-1', sourcePage: 1,
          scanStatus: 'needs_review', examId: 'exam-1', folio: 'FOLIO-PRIVADO', examPage: 1,
          identitySource: 'manual', resolutionReason: 'Comparada visualmente',
          humanReview: { method: 'visual_original_capture', reviewerIdHash: 'a'.repeat(64), reviewedAt: '2026-10-24T12:00:00.000Z', reviewerAttested: true, independentOfOmr: true, omrPredictionsHidden: true },
          groundTruthReview: { bonusVisible: false },
          responses: [{ numeroPregunta: 1, opcion: 'B', estadoRespuesta: 'manual_review', opcionDetectada: 'A', confianza: 0.8, flags: [], candidatas: [] }],
          exceptions: []
        },
        {
          sheetSerial: 'AUTOMATICA', pageIndex: 2, sourceFileId: 'source-1', sourcePage: 2,
          scanStatus: 'accepted', examId: 'exam-2', folio: 'FOLIO-2', examPage: 1,
          identitySource: 'qr', responses: [{ numeroPregunta: 1, opcion: 'A', estadoRespuesta: 'manual_review', tipoMarcaManual: 'valid', selectedOptions: ['A'], opcionDetectada: 'A', confianza: 0.9, flags: [], candidatas: [] }],
          groundTruthReview: {
            humanReview: { method: 'visual_original_capture', reviewerIdHash: 'b'.repeat(64), reviewedAt: '2026-10-24T12:00:00.000Z', independentOfOmr: true, omrPredictionsHidden: true },
            bonusVisible: false,
            responses: [{ numeroPregunta: 1, opcion: 'A', estadoRespuesta: 'manual_review', tipoMarcaManual: 'valid', selectedOptions: ['A'] }]
          },
          exceptions: []
        }
      ]
    } as unknown as OmrJobDetalle;
    render(
      <ConfirmDialogProvider>
        <PlantillasOmrWorkflow
          assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
          lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
          descargarArtifact={vi.fn().mockResolvedValue(undefined)} descargarDatasetOmr={descargarDatasetOmr}
          obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
          obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob([], { type: 'image/png' }))}
          crearJobOmr={vi.fn().mockResolvedValue(undefined)} resolverHojaOmr={vi.fn().mockResolvedValue(undefined)}
          finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
        />
      </ConfirmDialogProvider>
    );

    expect(screen.getByRole('checkbox', { name: 'Incluir página 1 con etiquetas revisadas' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Incluir página 2 con etiquetas revisadas' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Selección de páginas para dataset OMR' })).getByRole('status'))
      .toHaveTextContent('Verdad terreno ciega en este job: 1 de 3 páginas y 1 de 2 exámenes completos.');
    fireEvent.click(screen.getByRole('button', { name: /AUTOMATICA · P2 · accepted/i }));
    expect(screen.getByText(/Etiqueta histórica sin constancia de revisión ciega; no cuenta para el piloto/i)).toBeInTheDocument();
    expect(screen.getByText(/vuelve a cargar el original en una ingesta nueva para revisarla/i)).toBeInTheDocument();
    expect(screen.getByText(/Las casillas solo seleccionan páginas ya etiquetadas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir página 1 con etiquetas revisadas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar páginas seleccionadas a ZIP QA' }));
    expect(screen.getByText(/nombres, matrícula o códigos QR identificables/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y descargar' }));

    await waitFor(() => expect(descargarDatasetOmr).toHaveBeenCalledWith('job-dataset', [1]));
  });
});
