/**
 * plantillasOmrWorkflow.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantillasOmrWorkflow } from '../src/apps/app_docente/features/plantillas/components/PlantillasOmrWorkflow';
import * as toastBus from '../src/ui/toast/toastBus';
import type { GeneratedAssessmentDetalle, OmrJobDetalle } from '../src/apps/app_docente/tipos';
import { ConfirmDialogProvider } from '../src/ui/feedback/ConfirmDialogProvider';

describe('PlantillasOmrWorkflow', () => {
  it('explica un fallo OMR aunque el servicio no devuelva códigos técnicos', () => {
    const job = {
      jobId: 'job-failed-without-code', sourceType: 'images', status: 'failed', pagesTotal: 1, pagesProcessed: 0,
      pages: [], errors: []
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-failed-without-code', folio: 'ASS-FAILED-001', generationSeed: 'seed', title: 'Global', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar el procesamiento OMR. El servicio no devolvió un código técnico; si necesitas ayuda, comparte el folio ASS-FAILED-001 con soporte.');
    expect(screen.getByText('Aceptadas: No disponible')).toBeInTheDocument();
    expect(screen.getByText('Promedio: No disponible')).toBeInTheDocument();
    expect(screen.queryByText('Ver código técnico para soporte')).not.toBeInTheDocument();
  });

  it('expone selectores OMR accesibles y muestra el nombre de los archivos elegidos', () => {
    const job = {
      jobId: 'job-file-picker', sourceType: 'images', status: 'failed', pagesTotal: 1, pagesProcessed: 0,
      pages: [], errors: []
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-file-picker', folio: 'FOLIO-FILE-001', generationSeed: 'seed', title: 'Parcial', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const inputCapturas = document.getElementById('omr-capturas-lote') as HTMLInputElement;
    const inputReferencia = document.getElementById('omr-referencia-job-lote') as HTMLInputElement;
    const abrirCapturas = vi.spyOn(inputCapturas, 'click');
    const abrirReferencia = vi.spyOn(inputReferencia, 'click');
    const botonCapturas = screen.getByRole('button', { name: 'Seleccionar capturas o PDF' });
    const botonReferencia = screen.getByRole('button', { name: 'Seleccionar PDF generado del lote' });

    expect(botonCapturas).toHaveAttribute('aria-describedby', 'omr-capturas-lote-ayuda omr-capturas-lote-estado');
    expect(botonReferencia).toHaveAttribute('aria-describedby', 'omr-referencia-job-lote-ayuda omr-referencia-job-lote-estado');
    expect(document.getElementById('omr-capturas-lote-estado')).toHaveAttribute('role', 'status');
    expect(document.getElementById('omr-referencia-job-lote-estado')).toHaveAttribute('role', 'status');
    expect(document.getElementById('omr-capturas-lote-estado')).toHaveTextContent('Sin archivos seleccionados.');
    expect(document.getElementById('omr-referencia-job-lote-estado')).toHaveTextContent('Sin PDF de referencia seleccionado.');

    fireEvent.click(botonCapturas);
    fireEvent.click(botonReferencia);
    expect(abrirCapturas).toHaveBeenCalledOnce();
    expect(abrirReferencia).toHaveBeenCalledOnce();
    fireEvent.change(inputCapturas, { target: { files: [
      new File(['png'], 'hoja-alumno-01.png', { type: 'image/png' }),
      new File([new Uint8Array(2048)], 'referencia-global-2A.pdf', { type: 'application/pdf' })
    ] } });
    fireEvent.change(inputReferencia, { target: { files: [new File([new Uint8Array(1024)], 'lote-global-2A.pdf', { type: 'application/pdf' })] } });

    expect(document.getElementById('omr-capturas-lote-estado')).toHaveTextContent(
      'Seleccionados (2): hoja-alumno-01.png (menos de 1 KB), referencia-global-2A.pdf (2.0 KB). Total: 3.0 KB.'
    );
    expect(document.getElementById('omr-referencia-job-lote-estado')).toHaveTextContent('Seleccionado: lote-global-2A.pdf (1.0 KB).');
  });

  it('conserva el cero real cuando el resumen OMR sí lo informa', () => {
    const job = {
      jobId: 'job-with-zero-summary', sourceType: 'images', status: 'completed', pagesTotal: 1, pagesProcessed: 1,
      pages: [], errors: [], summary: { accepted: 0, needsReview: 0, rejected: 0, autoGradable: 0, averageScore: 0 }
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-zero-summary', folio: 'ASS-ZERO-001', generationSeed: 'seed', title: 'Global', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Aceptadas: 0')).toBeInTheDocument();
    expect(screen.getByText('Promedio: 0%')).toBeInTheDocument();
  });

  it('no ofrece guardar resoluciones para páginas PDF aceptadas o rechazadas', () => {
    const job = {
      jobId: 'ingesta-completada', sourceType: 'pdf', status: 'completed', pagesTotal: 2, pagesProcessed: 2,
      files: [{ id: 'file-completed', nombre: 'parcial.pdf', bytes: 2048, pages: 2, sha256: 'd'.repeat(64) }],
      packages: [], errors: [], summary: { accepted: 1, needsReview: 0, rejected: 1 },
      pages: [
        { sheetSerial: 'HOJA-ACEPTADA', pageIndex: 1, pageType: 'examen', scanStatus: 'accepted', examId: 'ass-completed', examPage: 1, confidence: 0.99, responses: [], exceptions: [] },
        { sheetSerial: 'HOJA-RECHAZADA', pageIndex: 2, pageType: 'examen', scanStatus: 'rejected', examId: 'ass-completed', examPage: 2, confidence: 0.2, responses: [], exceptions: [] }
      ]
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-completed', folio: 'ASS-COMPLETED-001', generationSeed: 'seed', title: 'Parcial', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 2, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'HOJA-ACEPTADA · P1 · Aceptada' }));
    expect(screen.getByRole('heading', { name: 'Detalle de página: HOJA-ACEPTADA' })).toBeInTheDocument();
    expect(screen.getByText(/Esta página está aceptada/).closest('[role="status"]')).toHaveTextContent('La ingesta PDF solo permite guardar resoluciones para páginas que requieren revisión.');
    expect(screen.getByText('Carga la página 1 ya asociada a este examen para compararla con el escaneo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar resolución' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'HOJA-RECHAZADA · P2 · Rechazada' }));
    expect(screen.getByText(/Esta página está rechazada/).closest('[role="status"]')).toHaveTextContent('La ingesta PDF solo permite guardar resoluciones para páginas que requieren revisión.');
    expect(screen.queryByRole('button', { name: 'Guardar resolución' })).not.toBeInTheDocument();
  });

  it('explica que el reverso vacío omitido no admite resolución manual', () => {
    const job = {
      jobId: 'scan-with-empty-reverse', sourceType: 'image_batch', status: 'completed', pagesTotal: 2, pagesProcessed: 2,
      summary: { accepted: 0, needsReview: 0, rejected: 1 }, errors: [],
      pages: [
        {
          sheetSerial: 'HOJA-REVERSO', pageIndex: 2, pageType: 'reverso-vacio', scanStatus: 'ignored', confidence: 1,
          responses: [], exceptions: [{ code: 'OMR_REVERSO_VACIO', severity: 'info', message: 'Reverso dúplex vacío omitido: no contiene elementos OMR.' }]
        },
        {
          sheetSerial: 'HOJA-REVERSO-ESTADO-RECHAZADO', pageIndex: 4, pageType: 'reverso-vacio', scanStatus: 'rejected', confidence: 0.72,
          responses: [], exceptions: [{ code: 'OMR_REVERSO_VACIO', severity: 'info', message: 'Reverso dúplex vacío omitido: no contiene elementos OMR.' }]
        }
      ]
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-reverse', folio: 'ASS-REVERSE-001', generationSeed: 'seed', title: 'Parcial', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'HOJA-REVERSO · P2 · Omitida' }));
    expect(screen.getByRole('heading', { name: 'Detalle de página: HOJA-REVERSO' })).toBeInTheDocument();
    expect(screen.getByText('No requiere resolución manual: es un reverso vacío sin respuestas OMR.').closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByText(/Confianza de lectura/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar resolución' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Identificador del alumno')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'HOJA-REVERSO-ESTADO-RECHAZADO · P4 · Rechazada' }));
    expect(screen.getByText('No requiere resolución manual: es un reverso vacío sin respuestas OMR.').closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByText(/Confianza de lectura/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar resolución' })).not.toBeInTheDocument();
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
    expect(screen.getByText('Paquetes de alumno: No disponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cuadernillo no disponible para el folio ASS-RETRY-001' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clave de respuestas no disponible para el folio ASS-RETRY-001' })).toHaveTextContent('Clave de respuestas no disponible');

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar la ingesta OMR. Los archivos originales se conservan; puedes reprocesarlos con el botón inferior.');
    const detalleTecnico = screen.getByText('Ver código técnico para soporte');
    expect(detalleTecnico).toBeInTheDocument();
    expect(detalleTecnico.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(detalleTecnico);
    expect(screen.getByText('OMR_TEST_INTERRUPCION')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprocesar desde originales' }));
    expect(onReintentarIngestaPdf).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reprocesar' }));
    await waitFor(() => expect(onReintentarIngestaPdf).toHaveBeenCalledWith('ingesta-fallida'));
  });

  it('presenta el avance accesible de páginas para una ingesta OMR en curso', () => {
    const job = {
      jobId: 'ingesta-en-curso', sourceType: 'pdf', status: 'processing', pagesTotal: 5, pagesProcessed: 2,
      files: [{ id: 'file-processing', nombre: 'capturas.pdf', bytes: 2048, pages: 5, sha256: 'b'.repeat(64) }],
      pages: [], packages: [], errors: []
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-processing', folio: 'ASS-PROCESSING-001', generationSeed: 'seed', title: 'Parcial', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 5, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Procesando páginas del PDF')).toBeInTheDocument();
    expect(screen.getByText('2 de 5 páginas')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Avance de ingesta PDF OMR' })).toHaveProperty('value', 2);
    expect(screen.getByRole('progressbar', { name: 'Avance de ingesta PDF OMR' })).toHaveProperty('max', 5);
    expect(screen.queryByRole('button', { name: 'Reprocesar desde originales' })).not.toBeInTheDocument();
  });

  it('expresa como indeterminado el trabajo en cola mientras prepara el total de páginas', () => {
    const job = {
      jobId: 'ingesta-en-cola', sourceType: 'pdf', status: 'queued', pagesTotal: 0, pagesProcessed: 0,
      files: [{ id: 'file-queued', nombre: 'capturas.pdf', bytes: 2048, pages: 0, sha256: 'c'.repeat(64) }],
      pages: [], packages: [], errors: []
    } as unknown as OmrJobDetalle;
    const assessmentDetalle: GeneratedAssessmentDetalle = {
      assessment: {
        _id: 'ass-queued', folio: 'ASS-QUEUED-001', generationSeed: 'seed', title: 'Parcial', templateId: 'template-1', templateVersion: 4,
        statisticsSummary: { versionCount: 1, pageCount: 1, questionCount: 1, uniqueQuestionCount: 1 }, artifacts: []
      }, jobs: []
    };

    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={assessmentDetalle} jobOmr={job} cargandoAssessmentId={null} procesandoOmr={false}
        lotesArchivadosOmr={[]} cargandoLotesArchivadosOmr={false} onSeleccionarLoteArchivado={vi.fn().mockResolvedValue(undefined)}
        descargarArtifact={vi.fn().mockResolvedValue(undefined)} obtenerPreviewPaginaOmr={vi.fn().mockResolvedValue(new Blob())}
        obtenerPreviewReferenciaOmr={vi.fn().mockResolvedValue(new Blob())} crearJobOmr={vi.fn().mockResolvedValue(undefined)}
        resolverHojaOmr={vi.fn().mockResolvedValue(undefined)} finalizarJobOmr={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Estado: En cola')).toBeInTheDocument();
    expect(screen.getByText('En cola para procesar')).toBeInTheDocument();
    expect(screen.getByText('Preparando páginas…')).toBeInTheDocument();
    const progreso = screen.getByRole('progressbar', { name: 'Avance de ingesta PDF OMR' });
    expect(progreso).not.toHaveAttribute('value');
    expect(progreso).not.toHaveAttribute('max');
  });

  it('rechaza antes de enviar una selección mixta y conserva el envío conjunto de varios PDF', () => {
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
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
    const input = document.getElementById('omr-capturas-lote') as HTMLInputElement;
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
    expect(toastSpy).not.toHaveBeenCalled();
    fireEvent.click(botonProcesar);
    expect(crearJobOmr).toHaveBeenCalledWith({ assessmentId: 'ass-multi-pdf', files: [pdfUno, pdfDos], sourceType: 'pdf' });
    expect(toastSpy).not.toHaveBeenCalled();

    const referencia = new File(['referencia'], 'lote-generado.pdf', { type: 'application/pdf' });
    fireEvent.change(document.getElementById('omr-referencia-job-lote') as HTMLInputElement, { target: { files: [referencia] } });
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
    const lotesArchivadosOmr = [{ assessmentId: 'exam-1', loteId: 'batch-1', etiqueta: 'Inteligencia de Negocios · Lote batch-1 · archivado', cantidad: 12, archivado: true }];
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

    expect(screen.getByRole('heading', { name: /OMR · 1.0.0-dev.1/i })).toBeInTheDocument();
    const selector = screen.getByLabelText('Lote de referencia');
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
    expect(screen.getByText(/Lote seleccionado: Inteligencia de Negocios · Lote batch-1 · archivado · 12 exámenes\. El lote continúa archivado; la consulta no lo restaura\./)).toBeInTheDocument();
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
    const nombreReferenciaLargo = 'Referencia del examen global de demostración para el grupo 2A - parcial.pdf';
    const referencia = new File(['pdf'], nombreReferenciaLargo, { type: 'application/pdf' });
    const inputPdfReferencia = document.getElementById('omr-referencia-lote') as HTMLInputElement;
    const abrirSelectorPdf = vi.spyOn(inputPdfReferencia, 'click');
    const botonSeleccionarPdf = screen.getByRole('button', { name: 'Seleccionar PDF de referencia' });
    expect(botonSeleccionarPdf).toBeEnabled();
    fireEvent.click(botonSeleccionarPdf);
    expect(abrirSelectorPdf).toHaveBeenCalledOnce();
    fireEvent.change(inputPdfReferencia, { target: { files: [referencia] } });
    expect(document.getElementById('omr-referencia-lote-estado')).toHaveTextContent(`Seleccionado: ${nombreReferenciaLargo}`);
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
        lotesArchivadosOmr={[{ assessmentId: 'exam-1', loteId: 'batch-1', etiqueta: 'BI · Lote batch-1 · activo', cantidad: 12, archivado: false }]}
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
    fireEvent.change(document.getElementById('omr-referencia-lote') as HTMLInputElement, { target: { files: [new File(['pdf'], 'global.pdf', { type: 'application/pdf' })] } });
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
    expect(screen.getByText(/No se encontraron lotes con exámenes disponibles/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Lote de examen')).not.toBeInTheDocument();

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
    expect(screen.queryByLabelText('Lote de examen')).not.toBeInTheDocument();
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
    expect(historial.queryByText(/job-pdf-1|assessment-1/)).not.toBeInTheDocument();
    expect(historial.getByText(/PDF clasificado/)).toBeInTheDocument();
    expect(historial.getByText('Estado: Completado')).toBeInTheDocument();
    fireEvent.click(historial.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-1' }));
    expect(onAbrirTrabajoOmr).toHaveBeenCalledWith(trabajo);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más trabajos' }));
    expect(onCargarMasTrabajosOmr).toHaveBeenCalledOnce();
  });

  it('orienta al siguiente paso cuando el historial OMR está vacío', () => {
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        trabajosOmr={[]}
        cargandoTrabajosOmr={false}
        errorTrabajosOmr=""
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

    const estadoVacio = screen.getByText(/Aún no hay trabajos OMR guardados/).closest('[role="status"]');
    expect(estadoVacio).toHaveTextContent('Aún no hay trabajos OMR guardados.');
    expect(estadoVacio).toHaveTextContent('abre Generación y carga un PDF o capturas de páginas');
    expect(screen.queryByRole('list', { name: 'Historial de trabajos OMR' })).not.toBeInTheDocument();
  });

  it('oculta IDs internos y da contexto al trabajo OMR sin folio', () => {
    const trabajo = {
      jobId: 'job-internal-2', workflow: 'scan' as const, assessmentId: 'assessment-internal-2',
      sourceType: 'image_batch' as const, status: 'review_pending', pagesTotal: 3, pagesProcessed: 2,
      createdAt: '2026-10-30T12:00:00.000Z', updatedAt: '2026-10-30T12:01:00.000Z'
    };
    render(
      <PlantillasOmrWorkflow
        assessmentDetalle={null}
        trabajosOmr={[trabajo]}
        onAbrirTrabajoOmr={vi.fn().mockResolvedValue(undefined)}
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

    const historial = within(screen.getByRole('list', { name: 'Historial de trabajos OMR' }));
    expect(historial.getByText('Trabajo OMR sin folio')).toBeInTheDocument();
    expect(historial.queryByText(/job-internal-2|assessment-internal-2/)).not.toBeInTheDocument();
    expect(historial.getByRole('button', { name: /Reabrir revisión: trabajo OMR sin folio, creado/ })).toBeEnabled();
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
          uniqueQuestionCount: 10,
          studentPacketCount: 12
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
      automaticGrade: { status: 'needs_review', reasonCodes: ['OMR_ANALISIS_NO_VERIFICADO'] },
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
    expect(screen.getByText('Paquetes de alumno: 12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paquetes por alumno' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Archivos originales conservados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar original' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar manifiesto anonimizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SH-001 · P1 · Requiere revisión/i })).toBeInTheDocument();
    const estadoJob = screen.getByText('Estado: Revisión pendiente').closest('[role="status"]');
    expect(estadoJob).toBeInTheDocument();
    expect(estadoJob).not.toHaveTextContent('Calificables automáticamente');
    expect(screen.getByText('Calificables automáticamente: 0')).toBeInTheDocument();
    expect(screen.getByText('Calificables automáticamente: 0').closest('[role="status"]')).toBeNull();
    expect(screen.getByText('Calificación pendiente de revisión')).toBeInTheDocument();
    expect(screen.getByText('Al terminar el análisis, EvaluaPro guarda automáticamente las calificaciones que pasan todos los controles. Una nota existente no se sobrescribe; los casos no verificables quedan pendientes de revisión.')).toBeInTheDocument();

    // Seleccionar hoja para revisión
    const botonHoja = screen.getByRole('button', { name: /SH-001 · P1 · Requiere revisión/i });
    fireEvent.click(botonHoja);

    expect(screen.getByRole('heading', { name: /Revisión y ajuste: SH-001/i })).toBeInTheDocument();
    expect(screen.getByText('Confianza de lectura: 85.0%')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/La decisión automática también evalúa calidad de imagen, cobertura y respuestas ambiguas/);
    expect(screen.getByRole('note')).toHaveTextContent(/verifica las respuestas contra la captura/);
    expect(screen.getByLabelText('Identificador del alumno')).toBeInTheDocument();
    expect(screen.getByLabelText('Reactivo 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Reactivo 1')).toBeDisabled();
    expect(screen.getByDisplayValue('CUH111')).toBeInTheDocument();
    expect(screen.getByText('Estado: Varias marcas / ambigua: se calificará incorrecta')).toBeInTheDocument();
    expect(screen.getByText('Estado: Requiere revisión')).toBeInTheDocument();
    expect(screen.getByText('Revisión requerida')).toBeInTheDocument();
    const codigoTecnico = screen.getByText('Ver código técnico para soporte');
    expect(codigoTecnico.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(codigoTecnico);
    expect(codigoTecnico.closest('details')).toHaveAttribute('open');
    expect(screen.getByText('LOW_CONFIDENCE')).toBeInTheDocument();
    expect(screen.getByText('Opción detectada: Ninguna')).toBeInTheDocument();
    expect(screen.getByText(/Marcas candidatas del análisis: C \(68%, marcada\) · D \(53%, marcada\)/i)).toBeInTheDocument();
    expect(screen.getByText('Señales: Bajo contraste · Varias marcas')).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole('button', { name: 'Descargar cuadernillo del folio ASS-FOLIO-101' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar hoja OMR del folio ASS-FOLIO-101' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar clave de respuestas del folio ASS-FOLIO-101' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar manifiesto del folio ASS-FOLIO-101' }));
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
      candidateExams: [{
        id: 'exam-2', folio: 'EX-002', studentName: 'Ana Pérez', group: '2A', pages: [1, 2],
        questionNumbersByPage: { '1': [1, 2], '2': [3] }
      }],
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

    fireEvent.click(screen.getByRole('button', { name: /PENDIENTE-1 · P1 · Requiere revisión/i }));
    expect(screen.getByLabelText('Examen del lote')).toHaveValue('exam-2');
    expect(screen.getByLabelText('Página del examen')).toHaveValue('2');
    expect(screen.getByText(/OCR coincide en 2 posiciones/i)).toBeInTheDocument();
    expect(screen.getByText(/compara visualmente las páginas antes de confirmar/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin detección OMR; captura la respuesta tras cotejar la imagen/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Reactivo 3')).toHaveValue('__PENDIENTE__');
    const guardar = screen.getByRole('button', { name: /Guardar resolución/i });
    expect(guardar).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar página 2 del PDF generado/i }));
    await waitFor(() => expect(screen.getByAltText('Página 2 del examen generado exam-2')).toHaveAttribute('src', 'blob:manual-reference'));
    expect(obtenerPreviewReferenciaOmr).toHaveBeenCalledWith('ingesta-1', 1, 'exam-2', 2);
    fireEvent.change(screen.getByLabelText('Reactivo 3'), { target: { value: 'A' } });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'ingesta-1',
      sheetSerial: 'PENDIENTE-1',
      ingestionResolution: { pageIndex: 1, generatedAssessmentId: 'exam-2', examPage: 2 },
      finalResponses: [{ numeroPregunta: 3, opcion: 'A' }]
    }));
    if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
    else delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    else delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
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
      pages: [
        {
          sheetSerial: 'QR-PRIVADO', pageIndex: 1, sourceFileId: 'source-1', sourcePage: 1,
          scanStatus: 'needs_review', examId: 'exam-1', folio: 'FOLIO-PRIVADO', examPage: 1,
          identitySource: 'manual', resolutionReason: 'Comparada visualmente',
          responses: [{ numeroPregunta: 1, opcion: 'B', estadoRespuesta: 'manual_review', opcionDetectada: 'A', confianza: 0.8, flags: [], candidatas: [] }],
          exceptions: []
        },
        {
          sheetSerial: 'AUTOMATICA', pageIndex: 2, sourceFileId: 'source-1', sourcePage: 2,
          scanStatus: 'accepted', examId: 'exam-2', folio: 'FOLIO-2', examPage: 1,
          identitySource: 'qr', responses: [{ numeroPregunta: 1, opcion: 'A', estadoRespuesta: 'respondida', opcionDetectada: 'A', confianza: 0.9, flags: [], candidatas: [] }],
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
    const toastSpy = vi.spyOn(toastBus, 'emitToast');
    const hoja = screen.getByRole('button', { name: /QR-PRIVADO · P1 · Requiere revisión/i });
    fireEvent.click(hoja);
    expect(hoja).toHaveAttribute('aria-pressed', 'true');
    expect(toastSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir página 1 con etiquetas revisadas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar páginas seleccionadas a ZIP QA' }));
    expect(screen.getByText(/nombres, matrícula o códigos QR identificables/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y descargar' }));

    await waitFor(() => expect(descargarDatasetOmr).toHaveBeenCalledWith('job-dataset', [1]));
  });
});
