/**
 * PlantillasOmrWorkflow
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Boton } from '../../../../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../../../../ui/ux/componentes/InlineMensaje';
import { emitToast } from '../../../../../ui/toast/toastBus';
import { OMR_CANONICAL_DISPLAY_LABEL } from '../../../../../ui/version/versionInfo';
import { useConfirmDialog } from '../../../../../ui/feedback/ConfirmDialogProvider';
import type { GeneratedAssessmentDetalle, OmrJobDetalle } from '../../../tipos';

export type ArchivoOmrLote = { assessmentId: string; loteId: string; etiqueta: string; cantidad: number };
export type TrabajoOmrResumen = {
  jobId: string;
  workflow: 'scan' | 'pdf_ingesta';
  assessmentId: string;
  folio?: string;
  sourceType: 'pdf' | 'image_batch' | 'camera_capture';
  status: string;
  pagesTotal: number;
  pagesProcessed: number;
  summary?: { accepted?: number; needsReview?: number; rejected?: number };
  createdAt: string;
  updatedAt: string;
};

type Props = {
  assessmentDetalle: GeneratedAssessmentDetalle | null;
  trabajosOmr?: TrabajoOmrResumen[];
  cargandoTrabajosOmr?: boolean;
  errorTrabajosOmr?: string;
  hayMasTrabajosOmr?: boolean;
  onReintentarTrabajosOmr?: () => void;
  onCargarMasTrabajosOmr?: () => void;
  onAbrirTrabajoOmr?: (trabajo: TrabajoOmrResumen) => Promise<void>;
  lotesArchivadosOmr: ArchivoOmrLote[];
  cargandoLotesArchivadosOmr: boolean;
  errorCargaLotesArchivadosOmr?: string;
  puedeLeerLotesArchivadosOmr?: boolean;
  onReintentarCargaLotesArchivadosOmr?: () => void;
  onSeleccionarLoteArchivado: (assessmentId: string) => Promise<void>;
  prevalidarReferenciaOmr?: (args: { assessmentIds: string[]; referencePdf: File }) => Promise<{
    reference: { pages: number; pagesWithSignedQr: number };
    candidatesEvaluated: number;
    matches: Array<{ assessmentId: string; loteId: string; examCount: number; expectedPages: number; matchedPages: number }>;
  }>;
  jobOmr: OmrJobDetalle | null;
  cargandoAssessmentId: string | null;
  procesandoOmr: boolean;
  descargarArtifact: (url: string | undefined, fileName: string) => Promise<void>;
  descargarDatasetOmr?: (jobId: string, pageIndexes: number[]) => Promise<{ sha256: string; sourceCount: number; labelCount: number }>;
  puedeAnalizarOmr?: boolean;
  obtenerPreviewPaginaOmr: (jobId: string, pageIndex: number) => Promise<Blob>;
  obtenerPreviewReferenciaOmr: (jobId: string, pageIndex: number, generatedAssessmentId: string, examPage: number) => Promise<Blob>;
  crearJobOmr: (args: { assessmentId: string; files: File[]; sourceType: 'image_batch' | 'camera_capture' | 'pdf'; referencePdf?: File }) => Promise<void>;
  onReintentarIngestaPdf?: (jobId: string) => Promise<void>;
  resolverHojaOmr: (args: {
    jobId: string;
    sheetSerial: string;
    resolutionReason: string;
    ingestionResolution?: { pageIndex: number; generatedAssessmentId?: string; examPage?: number };
    finalIdentity?: Record<string, unknown>;
    finalResponses?: Array<{ numeroPregunta: number; opcion: string | null }>;
    overrides?: Record<string, unknown>;
  }) => Promise<void>;
  finalizarJobOmr: (jobId: string) => Promise<void>;
};

type DraftHoja = {
  studentId: string;
  versionCode: string;
  responses: Array<{ numeroPregunta: number; opcion: string | null }>;
};

function construirDraftHoja(pagina: OmrJobDetalle['pages'][number] | null): DraftHoja {
  if (!pagina) {
    return { studentId: '', versionCode: '', responses: [] };
  }

  return {
    studentId: String(pagina.identityResult?.studentId ?? ''),
    versionCode: String(pagina.versionResult?.versionCode ?? ''),
    responses: Array.isArray(pagina.responses)
      ? pagina.responses.map((item) => ({
          numeroPregunta: Number(item.numeroPregunta),
          opcion: typeof item.opcion === 'string' ? item.opcion : null
        }))
      : []
  };
}

function etiquetaEstadoRespuesta(estado?: string) {
  switch (estado) {
    case 'respondida': return 'Respondida por OMR';
    case 'sin_marca': return 'En blanco';
    case 'ambigua': return 'Ambigua';
    case 'doble_marca': return 'Varias marcas';
    case 'tachada': return 'Tachadura';
    case 'manual_review': return 'Corregida manualmente';
    default: return 'Estado OMR no disponible';
  }
}

function etiquetaSenalOmr(senal: string) {
  const etiquetas: Record<string, string> = {
    bajo_contraste: 'Bajo contraste',
    doble_marca: 'Varias marcas',
    fuera_roi: 'Fuera del área de respuesta',
    parcial_detectada: 'Marca parcial',
    tachada_detectada: 'Respuesta tachada'
  };
  return etiquetas[senal] ?? `Señal técnica: ${senal}`;
}

function etiquetaEstadoJobOmr(estado: string) {
  const etiquetas: Record<string, string> = {
    queued: 'En cola',
    processing: 'En proceso',
    completed: 'Completado',
    failed: 'Fallido',
    finalized: 'Finalizado',
    review_pending: 'Revisión pendiente',
    pending: 'Pendiente',
    pendiente: 'Pendiente'
  };
  return etiquetas[estado.trim().toLowerCase()] ?? estado;
}

function etiquetaEstadoPaginaOmr(estado: string) {
  const etiquetas: Record<string, string> = {
    accepted: 'Aceptada',
    needs_review: 'Requiere revisión',
    rejected: 'Rechazada',
    ignored: 'Omitida'
  };
  return etiquetas[estado.trim().toLowerCase()] ?? estado;
}

function mensajeErrorTrabajoOmr(job: OmrJobDetalle, esIngestaOmr: boolean, folio?: string) {
  if (esIngestaOmr) {
    return 'No se pudo completar la ingesta OMR. Los archivos originales se conservan; puedes reprocesarlos con el botón inferior.';
  }
  const hayCodigoTecnico = job.errors?.some((error) => typeof error.code === 'string' && error.code.trim().length > 0);
  if (hayCodigoTecnico) {
    return 'No se pudo completar el procesamiento OMR. Si el problema continúa, comparte el código técnico con soporte.';
  }
  const referenciaSoporte = folio?.trim() ? `el folio ${folio.trim()}` : 'la fecha aproximada de este trabajo';
  return `No se pudo completar el procesamiento OMR. El servicio no devolvió un código técnico; si necesitas ayuda, comparte ${referenciaSoporte} con soporte.`;
}

function etiquetaEstadoMarca(estado: string) {
  switch (estado) {
    case 'marcada': return 'marcada';
    case 'parcial': return 'parcial';
    case 'tachada': return 'tachada';
    default: return 'sin señal suficiente';
  }
}

function resumirVersionesAssessment(versionSet: Array<{ versionCode: string; questionCount: number }>) {
  const resumen = new Map<string, number>();
  for (const version of versionSet) {
    const codigo = String(version.versionCode || 'A').trim() || 'A';
    const cantidad = Number(version.questionCount);
    resumen.set(codigo, (resumen.get(codigo) ?? 0) + (Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1));
  }
  return Array.from(resumen, ([versionCode, questionCount]) => ({ versionCode, questionCount }));
}

function esArchivoPdf(file: File) {
  return file.type.toLowerCase() === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

const MAX_INGESTA_PDF_FILES = 10;
const MAX_INGESTA_PDF_BYTES = 120 * 1024 * 1024;
const MAX_INGESTA_PDF_JOB_BYTES = 250 * 1024 * 1024;

function validarSeleccionOmr(files: File[], referencePdf?: File) {
  if (files.length === 0) return '';
  const pdfs = files.filter(esArchivoPdf).length;
  if (referencePdf && pdfs === 0) return 'La referencia solo se usa en jobs de capturas PDF.';
  if (pdfs > 0 && pdfs < files.length) return 'Separa los PDF y las imágenes en jobs distintos.';
  if (pdfs === files.length) {
    if (files.length > MAX_INGESTA_PDF_FILES) return `Divide los PDF en grupos de hasta ${MAX_INGESTA_PDF_FILES} archivos.`;
    if (files.some((file) => file.size > MAX_INGESTA_PDF_BYTES)) return 'Cada PDF debe pesar como máximo 120 MiB; comprime o divide los archivos más grandes.';
    if (referencePdf && !esArchivoPdf(referencePdf)) return 'El PDF de referencia debe ser un archivo PDF.';
    if (referencePdf && referencePdf.size > MAX_INGESTA_PDF_BYTES) return 'El PDF de referencia debe pesar como máximo 120 MiB.';
    if (files.reduce((total, file) => total + file.size, referencePdf?.size ?? 0) > MAX_INGESTA_PDF_JOB_BYTES) return 'El grupo de PDF, incluida la referencia, supera 250 MiB; divide la selección en jobs más pequeños.';
    return '';
  }
  if (pdfs === 0 && files.every((file) => file.type.toLowerCase().startsWith('image/'))) return '';
  return 'Selecciona únicamente archivos PDF o imágenes compatibles.';
}

function formatearTamanoArchivo(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return 'menos de 1 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

type BotonDescargaArtefactoProps = {
  folio: string;
  etiqueta: string;
  etiquetaNoDisponible: string;
  url?: string;
  nombreArchivo: string;
  onDescargar: (url: string | undefined, nombreArchivo: string) => Promise<void>;
};

function BotonDescargaArtefacto({
  folio,
  etiqueta,
  etiquetaNoDisponible,
  url,
  nombreArchivo,
  onDescargar
}: BotonDescargaArtefactoProps) {
  const disponible = Boolean(url);
  return (
    <Boton
      type="button"
      variante="secundario"
      aria-label={disponible ? `${etiqueta} del folio ${folio}` : `${etiquetaNoDisponible} para el folio ${folio}`}
      disabled={!disponible}
      onClick={() => void onDescargar(url, nombreArchivo)}
    >
      {disponible ? etiqueta : etiquetaNoDisponible}
    </Boton>
  );
}

export function PlantillasOmrWorkflow({
  assessmentDetalle,
  trabajosOmr = [],
  cargandoTrabajosOmr = false,
  errorTrabajosOmr = '',
  hayMasTrabajosOmr = false,
  onReintentarTrabajosOmr = () => {},
  onCargarMasTrabajosOmr = () => {},
  onAbrirTrabajoOmr = async () => {},
  lotesArchivadosOmr,
  cargandoLotesArchivadosOmr,
  errorCargaLotesArchivadosOmr = '',
  puedeLeerLotesArchivadosOmr = true,
  onReintentarCargaLotesArchivadosOmr = () => {},
  onSeleccionarLoteArchivado,
  prevalidarReferenciaOmr,
  jobOmr,
  cargandoAssessmentId,
  procesandoOmr,
  descargarArtifact,
  descargarDatasetOmr,
  puedeAnalizarOmr = true,
  obtenerPreviewPaginaOmr,
  obtenerPreviewReferenciaOmr,
  crearJobOmr,
  onReintentarIngestaPdf = async () => {},
  resolverHojaOmr,
  finalizarJobOmr
}: Props) {
  const versionesAssessment = useMemo(
    () => resumirVersionesAssessment(assessmentDetalle?.assessment.versionSet ?? []),
    [assessmentDetalle?.assessment.versionSet]
  );
  const confirm = useConfirmDialog();
  const [files, setFiles] = useState<File[]>([]);
  const [referencePdf, setReferencePdf] = useState<File | undefined>();
  const omrFilesInputRef = useRef<HTMLInputElement>(null);
  const omrReferenceInputRef = useRef<HTMLInputElement>(null);
  const referencePdfInputRef = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState('');
  const [sheetSerialActivo, setSheetSerialActivo] = useState<string | null>(null);
  const paginaActiva = useMemo(
    () => (Array.isArray(jobOmr?.pages) ? jobOmr!.pages.find((page) => page.sheetSerial === sheetSerialActivo) ?? null : null),
    [jobOmr, sheetSerialActivo]
  );
  const [draftsPorHoja, setDraftsPorHoja] = useState<Record<string, DraftHoja>>({});
  const [resolutionReason, setResolutionReason] = useState(`Corrección manual de ${OMR_CANONICAL_DISPLAY_LABEL}`);
  const [ingestaExamId, setIngestaExamId] = useState('');
  const [ingestaExamPage, setIngestaExamPage] = useState<number | ''>('');
  const [pagePreview, setPagePreview] = useState<{ pageIndex: number; url: string } | null>(null);
  const [referencePreview, setReferencePreview] = useState<{ pageIndex: number; examId: string; examPage: number; url: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [loteArchivadoSeleccionado, setLoteArchivadoSeleccionado] = useState('');
  const [mensajePrevalidacion, setMensajePrevalidacion] = useState<{ tipo: 'info' | 'ok' | 'warning' | 'error'; texto: string } | null>(null);
  const [prevalidandoReferencia, setPrevalidandoReferencia] = useState(false);
  const [paginasDatasetSeleccionadas, setPaginasDatasetSeleccionadas] = useState<number[]>([]);
  const [exportandoDataset, setExportandoDataset] = useState(false);
  const loteArchivadoActivo = useMemo(
    () => lotesArchivadosOmr.find((lote) => lote.assessmentId === loteArchivadoSeleccionado) ?? null,
    [loteArchivadoSeleccionado, lotesArchivadosOmr]
  );
  const buscarLotePorReferencia = async () => {
    if (!referencePdf || !esArchivoPdf(referencePdf)) {
      setMensajePrevalidacion({ tipo: 'error', texto: 'Selecciona el PDF generado que quieres cotejar.' });
      return;
    }
    if (referencePdf.size <= 0 || referencePdf.size > MAX_INGESTA_PDF_BYTES) {
      setMensajePrevalidacion({ tipo: 'error', texto: 'El PDF de referencia debe pesar como máximo 120 MiB.' });
      return;
    }
    if (lotesArchivadosOmr.length === 0) {
      setMensajePrevalidacion({ tipo: 'warning', texto: 'No hay lotes archivados disponibles para cotejar.' });
      return;
    }
    setPrevalidandoReferencia(true);
    setMensajePrevalidacion({ tipo: 'info', texto: 'Validando los QR firmados del PDF contra los lotes archivados…' });
    try {
      if (!prevalidarReferenciaOmr) throw new Error('La prevalidación de referencias no está disponible en este momento.');
      const resultado = await prevalidarReferenciaOmr({
        assessmentIds: lotesArchivadosOmr.map((lote) => lote.assessmentId),
        referencePdf
      });
      if (resultado.matches.length === 1) {
        const coincidencia = resultado.matches[0]!;
        setLoteArchivadoSeleccionado(coincidencia.assessmentId);
        await onSeleccionarLoteArchivado(coincidencia.assessmentId);
        setMensajePrevalidacion({
          tipo: 'ok',
          texto: `Coincidencia única: lote ${coincidencia.loteId}, ${coincidencia.examCount} exámenes y ${coincidencia.matchedPages} páginas. No se cargaron capturas ni se creó un job.`
        });
      } else if (resultado.matches.length > 1) {
        setMensajePrevalidacion({ tipo: 'warning', texto: `El PDF coincide con ${resultado.matches.length} lotes. Selecciona el lote correcto manualmente; no se creó un job.` });
      } else {
        setMensajePrevalidacion({
          tipo: 'error',
          texto: `Ninguno de los ${resultado.candidatesEvaluated} lotes tuvo coincidencia completa: ${resultado.reference.pagesWithSignedQr}/${resultado.reference.pages} páginas tienen QR firmado válido. No se creó un job.`
        });
      }
    } catch (error) {
      setMensajePrevalidacion({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo cotejar el PDF.' });
    } finally {
      setPrevalidandoReferencia(false);
    }
  };
  useEffect(() => () => {
    if (pagePreview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(pagePreview.url);
  }, [pagePreview]);
  useEffect(() => () => {
    if (referencePreview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(referencePreview.url);
  }, [referencePreview]);
  const draftActivo = useMemo(() => {
    if (!paginaActiva) return construirDraftHoja(null);
    const sheetSerial = String(paginaActiva.sheetSerial || '').trim();
    const existente = draftsPorHoja[sheetSerial];
    return existente ?? construirDraftHoja(paginaActiva);
  }, [draftsPorHoja, paginaActiva]);
  const jobOmrTerminal = ['completed', 'finalized', 'closed'].includes(String(jobOmr?.status ?? '').toLowerCase());
  const jobOmrIngesta = jobOmr as (OmrJobDetalle & {
    packages?: Array<{ id: string; fileName: string; status: string; pageCount: number; course: string; subject: string; partial: string; teacher: string; student: string; group: string; folio: string }>;
    files?: Array<{ id: string; nombre: string; bytes: number; pages: number; sha256: string }>;
  }) | null;
  const paquetesOmr = jobOmrIngesta?.packages ?? [];
  const originalesOmr = jobOmrIngesta?.files ?? [];
  const esIngestaOmr = Boolean(jobOmrIngesta && Array.isArray(jobOmrIngesta.packages) && Array.isArray(jobOmrIngesta.files));
  const estadoJobOmr = String(jobOmr?.status ?? '').trim().toLowerCase();
  const ingestaEnCurso = esIngestaOmr && ['queued', 'processing'].includes(estadoJobOmr);
  const paginasOmrTotales = jobOmr && Number.isFinite(jobOmr.pagesTotal)
    ? Math.max(0, Math.trunc(jobOmr.pagesTotal))
    : 0;
  const paginasOmrProcesadas = jobOmr && Number.isFinite(jobOmr.pagesProcessed)
    ? Math.max(0, Math.trunc(jobOmr.pagesProcessed))
    : 0;
  const paginaPuedeResolverse = Boolean(
    paginaActiva
    && paginaActiva.pageType !== 'reverso-vacio'
    && paginaActiva.scanStatus !== 'ignored'
    && (!esIngestaOmr || paginaActiva.scanStatus === 'needs_review')
  );
  const paginasDatasetElegibles = useMemo(() => (jobOmr?.pages ?? []).filter((page) =>
    esIngestaOmr
    && page.scanStatus === 'needs_review'
    && Boolean(page.examId && page.examPage && page.folio && page.identitySource && page.resolutionReason?.trim())
    && page.responses.length > 0
    && page.responses.every((answer) => answer.estadoRespuesta === 'manual_review')
  ), [esIngestaOmr, jobOmr?.pages]);
  useEffect(() => setPaginasDatasetSeleccionadas([]), [jobOmr?.jobId]);
  const exportarDataset = async () => {
    if (!jobOmr || !descargarDatasetOmr || paginasDatasetSeleccionadas.length === 0) return;
    const aceptado = await confirm({
      title: 'Exportar dataset OMR',
      message: 'El ZIP conservará páginas originales para QA. Los píxeles pueden mostrar nombres, matrícula o códigos QR identificables.',
      confirmLabel: 'Confirmar y descargar',
      tone: 'warning',
      details: [
        `${paginasDatasetSeleccionadas.length} páginas con resolución manual guardada se etiquetarán.`,
        'Se incluyen los PDF fuente completos necesarios; pueden contener otras páginas no seleccionadas. El manifiesto omite nombres, matrícula, folio y contenido QR.',
        'Guarda el ZIP en una ubicación protegida y compártelo únicamente con personas autorizadas.'
      ]
    });
    if (!aceptado) return;
    setExportandoDataset(true);
    try {
      const resultado = await descargarDatasetOmr(jobOmr.jobId, paginasDatasetSeleccionadas);
      emitToast({
        level: 'ok',
        title: 'Dataset OMR descargado',
        message: `${resultado.labelCount} etiquetas · ${resultado.sourceCount} fuentes · SHA-256 ${resultado.sha256}`,
        durationMs: 9000
      });
    } catch (error) {
      emitToast({ level: 'error', title: 'Exportación OMR', message: error instanceof Error ? error.message : 'No se pudo generar el dataset. Puedes reintentar sin modificar el job.', durationMs: 7000 });
    } finally {
      setExportandoDataset(false);
    }
  };
  const panelHistorialOmr = (
    <section className="resultado plantillas-omr__history" aria-labelledby="plantillas-omr-history-title">
      <div className="plantillas-omr__history-head">
        <div>
          <h4 id="plantillas-omr-history-title">Trabajos OMR recientes</h4>
          <p className="nota">Reabre revisiones de PDF e imágenes guardadas para este docente. La lista muestra un resumen sin datos de alumnos.</p>
        </div>
        <Boton type="button" variante="secundario" cargando={cargandoTrabajosOmr} disabled={cargandoTrabajosOmr} onClick={onReintentarTrabajosOmr}>Actualizar historial</Boton>
      </div>
      {errorTrabajosOmr && <InlineMensaje tipo="error">{errorTrabajosOmr}</InlineMensaje>}
      {cargandoTrabajosOmr && trabajosOmr.length === 0 && <InlineMensaje tipo="info">Cargando historial OMR…</InlineMensaje>}
      {!cargandoTrabajosOmr && !errorTrabajosOmr && trabajosOmr.length === 0 && <InlineMensaje tipo="info">Aún no hay trabajos OMR guardados. Para iniciar uno, abre Generación y carga un PDF o capturas de páginas.</InlineMensaje>}
      {trabajosOmr.length > 0 && (
        <ul className="lista plantillas-omr__history-list" aria-label="Historial de trabajos OMR">
          {trabajosOmr.map((trabajo) => {
            const fechaCreacion = Number.isFinite(Date.parse(trabajo.createdAt))
              ? new Date(trabajo.createdAt).toLocaleString()
              : 'fecha no disponible';
            const contextoTrabajo = trabajo.folio
              ? `folio ${trabajo.folio}`
              : `trabajo OMR sin folio, creado ${fechaCreacion}`;
            return (
              <li key={trabajo.jobId}>
                <div>
                  <strong>{trabajo.folio ? `Folio: ${trabajo.folio}` : 'Trabajo OMR sin folio'}</strong>
                  <span> · {trabajo.workflow === 'pdf_ingesta' ? 'PDF clasificado' : trabajo.sourceType === 'pdf' ? 'PDF' : 'Capturas de imagen'}</span>
                  <div className="item-meta">
                    <span>Estado: {etiquetaEstadoJobOmr(trabajo.status)}</span>
                    <span>Páginas: {trabajo.pagesProcessed}/{trabajo.pagesTotal}</span>
                    <span>Revisión: {trabajo.summary?.needsReview ?? 0}</span>
                    <span>{fechaCreacion}</span>
                  </div>
                </div>
                <Boton
                  type="button"
                  variante="secundario"
                  aria-label={`Reabrir revisión: ${contextoTrabajo}`}
                  cargando={cargandoAssessmentId === trabajo.assessmentId}
                  disabled={!trabajo.assessmentId || Boolean(cargandoAssessmentId)}
                  onClick={() => void onAbrirTrabajoOmr(trabajo)}
                >
                  Reabrir revisión
                </Boton>
              </li>
            );
          })}
        </ul>
      )}
      {hayMasTrabajosOmr && <Boton type="button" variante="secundario" cargando={cargandoTrabajosOmr} disabled={cargandoTrabajosOmr} onClick={onCargarMasTrabajosOmr}>Cargar más trabajos</Boton>}
    </section>
  );

  if (!assessmentDetalle) {
    return (
      <div className="resultado plantillas-omr">
        <h4>{OMR_CANONICAL_DISPLAY_LABEL}</h4>
        <p className="nota">Selecciona un lote generado para vincular capturas con su referencia OMR. Los lotes archivados siguen protegidos; esta selección no los restaura.</p>
        {panelHistorialOmr}
        {cargandoLotesArchivadosOmr ? <InlineMensaje tipo="info">Cargando lotes archivados…</InlineMensaje> : (
          <>
          {!puedeLeerLotesArchivadosOmr && <InlineMensaje tipo="error">Tu perfil no tiene permiso para consultar los exámenes archivados.</InlineMensaje>}
          {errorCargaLotesArchivadosOmr && (
            <div className="acciones">
              <InlineMensaje tipo="error">No se pudo cargar el archivo de lotes: {errorCargaLotesArchivadosOmr}</InlineMensaje>
              {puedeLeerLotesArchivadosOmr && <Boton type="button" variante="secundario" onClick={onReintentarCargaLotesArchivadosOmr}>Reintentar carga</Boton>}
            </div>
          )}
          {puedeLeerLotesArchivadosOmr && !errorCargaLotesArchivadosOmr && lotesArchivadosOmr.length === 0 && (
            <InlineMensaje tipo="info">No se encontraron lotes archivados con exámenes disponibles para OMR.</InlineMensaje>
          )}
          <section className="resultado plantillas-omr__prevalidacion" aria-labelledby="omr-prevalidar-referencia-titulo">
            <h4 id="omr-prevalidar-referencia-titulo">Primero, coteja el PDF generado</h4>
            <p className="nota">Puedes localizar el lote por los QR firmados de cada examen antes de cargar las capturas. Esta consulta no guarda archivos, crea jobs ni escribe calificaciones.</p>
            <div className="campo">
              <span>PDF de referencia</span>
              <div className="plantillas-archivo-selector">
                <input
                  ref={referencePdfInputRef}
                  id="omr-referencia-lote"
                  className="input-file-oculto"
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={!puedeLeerLotesArchivadosOmr || prevalidandoReferencia || procesandoOmr}
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(event) => {
                    setReferencePdf(event.target.files?.[0] || undefined);
                    setMensajePrevalidacion(null);
                  }}
                />
                <Boton
                  type="button"
                  variante="secundario"
                  aria-label="Seleccionar PDF de referencia"
                  aria-describedby="omr-referencia-lote-estado"
                  disabled={!puedeLeerLotesArchivadosOmr || prevalidandoReferencia || procesandoOmr}
                  onClick={() => referencePdfInputRef.current?.click()}
                >
                  Seleccionar PDF
                </Boton>
                <p id="omr-referencia-lote-estado" className="plantillas-archivo-selector__estado" role="status" aria-atomic="true">
                  {referencePdf
                    ? `Seleccionado: ${referencePdf.name} (${formatearTamanoArchivo(referencePdf.size)}).`
                    : 'Sin PDF seleccionado.'}
                </p>
              </div>
            </div>
            <Boton
              type="button"
              variante="secundario"
              cargando={prevalidandoReferencia}
              disabled={!referencePdf || !prevalidarReferenciaOmr || !puedeLeerLotesArchivadosOmr || lotesArchivadosOmr.length === 0 || procesandoOmr}
              onClick={() => void buscarLotePorReferencia()}
            >
              Cotejar y localizar lote
            </Boton>
            {mensajePrevalidacion && <InlineMensaje tipo={mensajePrevalidacion.tipo}>{mensajePrevalidacion.texto}</InlineMensaje>}
          </section>
          {lotesArchivadosOmr.length > 0 && (
            <div className="campo-formulario">
              <label htmlFor="omr-lote-archivado">Lote de examen</label>
              <select
                id="omr-lote-archivado"
                value={loteArchivadoSeleccionado}
                disabled={!puedeLeerLotesArchivadosOmr || Boolean(errorCargaLotesArchivadosOmr) || Boolean(cargandoAssessmentId)}
                onChange={(event) => {
                  const assessmentId = event.currentTarget.value;
                  setLoteArchivadoSeleccionado(assessmentId);
                  if (assessmentId) void onSeleccionarLoteArchivado(assessmentId);
                }}
              >
                <option value="">Selecciona un lote…</option>
                {lotesArchivadosOmr.map((lote) => (
                  <option key={lote.loteId} value={lote.assessmentId}>{lote.etiqueta} · {lote.cantidad} exámenes</option>
                ))}
              </select>
            </div>
          )}
          </>
        )}
        {cargandoAssessmentId && <InlineMensaje tipo="info">Cargando detalle del lote…</InlineMensaje>}
      </div>
    );
  }

  return (
    <div className="resultado plantillas-omr">
      <div className="plantillas-panel__hero">
        <div>
          <h4>{OMR_CANONICAL_DISPLAY_LABEL}</h4>
          <p className="nota">Descarga artefactos, procesa capturas y corrige hojas OMR dentro del mismo contexto de assessment.</p>
        </div>
      </div>
      {cargandoAssessmentId && <InlineMensaje tipo="info">Cargando detalle de assessment…</InlineMensaje>}
      {loteArchivadoActivo && (
        <p className="nota" role="status">
          Lote archivado seleccionado: {loteArchivadoActivo.etiqueta} · {loteArchivadoActivo.cantidad} exámenes. El archivo permanece sin restaurar.
        </p>
      )}
      <div className="item-meta">
        <span>Folio: {assessmentDetalle.assessment.folio}</span>
        <span>Seed: {assessmentDetalle.assessment.generationSeed || '-'}</span>
        <span>Versiones: {versionesAssessment.length || assessmentDetalle.assessment.statisticsSummary.versionCount}</span>
        <span>Hojas: {assessmentDetalle.assessment.statisticsSummary.sheetCount}</span>
        <span>
          Paquetes de alumno: {Number.isFinite(assessmentDetalle.assessment.statisticsSummary.studentPacketCount)
            ? assessmentDetalle.assessment.statisticsSummary.studentPacketCount
            : 'No disponible'}
        </span>
      </div>
      {versionesAssessment.length > 0 && (
        <div className="item-meta">
          {versionesAssessment.map((version) => (
            <span key={`${assessmentDetalle.assessment._id}-${version.versionCode}`}>
              Versión {version.versionCode}: {version.questionCount} reactivos
            </span>
          ))}
        </div>
      )}
      {Array.isArray(assessmentDetalle.studentPacketArtifacts) && assessmentDetalle.studentPacketArtifacts.length > 0 && (
        <div className="resultado">
          <h4>Paquetes de alumno emitidos</h4>
          <ul className="lista">
            {assessmentDetalle.studentPacketArtifacts.map((packet) => (
              <li key={`${packet.sheetSerial}-${packet.studentId || 'na'}`}>
                <b>{packet.sheetSerial}</b> · {packet.studentName || 'Alumno sin nombre'} · {packet.studentId || 'Sin ID'} · Versión {packet.versionCode}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="acciones acciones--mt plantillas-omr__artifact-actions" role="group" aria-label={`Archivos del folio ${assessmentDetalle.assessment.folio}`}>
        <BotonDescargaArtefacto
          folio={assessmentDetalle.assessment.folio}
          etiqueta="Descargar cuadernillo"
          etiquetaNoDisponible="Cuadernillo no disponible"
          url={assessmentDetalle.assessment.bookletPdfUrl}
          nombreArchivo={`${assessmentDetalle.assessment.folio}_booklet.pdf`}
          onDescargar={descargarArtifact}
        />
        <BotonDescargaArtefacto
          folio={assessmentDetalle.assessment.folio}
          etiqueta="Descargar hoja OMR"
          etiquetaNoDisponible="Hoja OMR no disponible"
          url={assessmentDetalle.assessment.omrSheetPdfUrl}
          nombreArchivo={`${assessmentDetalle.assessment.folio}_omr_sheet.pdf`}
          onDescargar={descargarArtifact}
        />
        <BotonDescargaArtefacto
          folio={assessmentDetalle.assessment.folio}
          etiqueta="Descargar clave de respuestas"
          etiquetaNoDisponible="Clave de respuestas no disponible"
          url={assessmentDetalle.assessment.answerKeyUrl}
          nombreArchivo={`${assessmentDetalle.assessment.folio}_answer_key.json`}
          onDescargar={descargarArtifact}
        />
        <BotonDescargaArtefacto
          folio={assessmentDetalle.assessment.folio}
          etiqueta="Descargar manifiesto"
          etiquetaNoDisponible="Manifiesto no disponible"
          url={assessmentDetalle.assessment.manifestUrl}
          nombreArchivo={`${assessmentDetalle.assessment.folio}_manifest.json`}
          onDescargar={descargarArtifact}
        />
        <BotonDescargaArtefacto
          folio={assessmentDetalle.assessment.folio}
          etiqueta="Descargar paquetes de alumno (ZIP)"
          etiquetaNoDisponible="Paquetes de alumno (ZIP) no disponibles"
          url={assessmentDetalle.assessment.studentPacketZipUrl}
          nombreArchivo={`${assessmentDetalle.assessment.folio}_student_packets.zip`}
          onDescargar={descargarArtifact}
        />
      </div>

      <div className="acciones acciones--mt">
        <div className="campo" role="group" aria-labelledby="omr-capturas-lote-label">
          <span id="omr-capturas-lote-label">Capturas o PDF</span>
          <div className="plantillas-archivo-selector">
            <input
              ref={omrFilesInputRef}
              id="omr-capturas-lote"
              className="input-file-oculto"
              type="file"
              multiple
              accept="image/*,application/pdf"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const seleccionados = Array.from(event.target.files ?? []);
                const error = validarSeleccionOmr(seleccionados, referencePdf);
                setFiles(seleccionados);
                setSelectionError(error);
              }}
            />
            <Boton
              type="button"
              variante="secundario"
              aria-label="Seleccionar capturas o PDF"
              aria-describedby="omr-capturas-lote-ayuda omr-capturas-lote-estado"
              onClick={() => omrFilesInputRef.current?.click()}
            >
              Seleccionar archivos
            </Boton>
            <p id="omr-capturas-lote-ayuda" className="plantillas-archivo-selector__estado">
              Imágenes o PDF; puedes seleccionar varios archivos.
            </p>
            <p id="omr-capturas-lote-estado" className="plantillas-archivo-selector__estado" role="status" aria-atomic="true">
              {files.length > 0
                ? `Seleccionados (${files.length}): ${files.map((file) => `${file.name} (${formatearTamanoArchivo(file.size)})`).join(', ')}. Total: ${formatearTamanoArchivo(files.reduce((total, file) => total + file.size, referencePdf?.size ?? 0))}.`
                : 'Sin archivos seleccionados.'}
            </p>
          </div>
        </div>
        <div className="campo" role="group" aria-labelledby="omr-referencia-job-lote-label">
          <span id="omr-referencia-job-lote-label">PDF generado del lote (opcional si EvaluaPro no conserva el original)</span>
          <div className="plantillas-archivo-selector">
            <input
              ref={omrReferenceInputRef}
              id="omr-referencia-job-lote"
              className="input-file-oculto"
              type="file"
              accept="application/pdf,.pdf"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const seleccionado = event.target.files?.[0];
                const siguiente = seleccionado || undefined;
                setReferencePdf(siguiente);
                setSelectionError(validarSeleccionOmr(files, siguiente));
              }}
            />
            <Boton
              type="button"
              variante="secundario"
              aria-label="Seleccionar PDF generado del lote"
              aria-describedby="omr-referencia-job-lote-ayuda omr-referencia-job-lote-estado"
              onClick={() => omrReferenceInputRef.current?.click()}
            >
              Seleccionar PDF
            </Boton>
            <p id="omr-referencia-job-lote-ayuda" className="plantillas-archivo-selector__estado">
              Opcional. Permite cotejar las capturas cuando EvaluaPro no conserva el PDF original.
            </p>
            <p id="omr-referencia-job-lote-estado" className="plantillas-archivo-selector__estado" role="status" aria-atomic="true">
              {referencePdf
                ? `Seleccionado: ${referencePdf.name} (${formatearTamanoArchivo(referencePdf.size)}).`
                : 'Sin PDF de referencia seleccionado.'}
            </p>
          </div>
        </div>
        <Boton
          type="button"
          variante="secundario"
          cargando={procesandoOmr}
          disabled={files.length === 0 || Boolean(selectionError) || procesandoOmr}
          onClick={() => {
            const error = validarSeleccionOmr(files, referencePdf);
            if (error) {
              setSelectionError(error);
              return;
            }
            void crearJobOmr({
              assessmentId: assessmentDetalle.assessment._id,
              files,
              sourceType: files.every(esArchivoPdf) ? 'pdf' : 'image_batch',
              ...(referencePdf ? { referencePdf } : {})
            });
          }}
        >
          Procesar capturas
        </Boton>
      </div>
      {selectionError && <InlineMensaje tipo="error">{selectionError}</InlineMensaje>}
      {files.some(esArchivoPdf) && !selectionError && <InlineMensaje tipo="info">EvaluaPro conservará el original, procesará páginas por bloques, validará cada QR contra el lote y preparará paquetes descargables. Las hojas ambiguas quedarán para revisión; este flujo no guarda calificaciones.</InlineMensaje>}
      {referencePdf && !selectionError && <InlineMensaje tipo="info">El PDF de referencia se conserva solo con este job. La ingesta falla si no coinciden todas las páginas y los QR firmados del lote.</InlineMensaje>}

      {panelHistorialOmr}

      {jobOmr && (
        <>
          <div className="resultado plantillas-omr__job">
            <h4>Trabajo OMR</h4>
            <div className="item-meta" role="status">
              <span>Estado: {etiquetaEstadoJobOmr(jobOmr.status)}</span>
            </div>
            <div className="item-meta">
              <span>Aceptadas: {jobOmr.summary?.accepted ?? 'No disponible'}</span>
              <span>Revisión: {jobOmr.summary?.needsReview ?? 'No disponible'}</span>
              <span>Rechazadas: {jobOmr.summary?.rejected ?? 'No disponible'}</span>
              <span>Calificables automáticamente: {jobOmr.summary?.autoGradable ?? 'No disponible'}</span>
              <span>
                Promedio: {jobOmr.summary?.averageScore == null ? 'No disponible' : `${jobOmr.summary.averageScore}%`}
              </span>
            </div>
            {ingestaEnCurso && (
              <div className="plantillas-omr__progress">
                <div className="plantillas-omr__progress-label">
                  <span>{estadoJobOmr === 'queued' ? 'En cola para procesar' : 'Procesando páginas del PDF'}</span>
                  <span>
                    {paginasOmrTotales > 0
                      ? `${Math.min(paginasOmrProcesadas, paginasOmrTotales)} de ${paginasOmrTotales} páginas`
                      : 'Preparando páginas…'}
                  </span>
                </div>
                <progress
                  max={paginasOmrTotales > 0 ? paginasOmrTotales : undefined}
                  value={paginasOmrTotales > 0 ? Math.min(paginasOmrProcesadas, paginasOmrTotales) : undefined}
                  aria-label="Avance de ingesta PDF OMR"
                />
              </div>
            )}
            <p className="ayuda">Este proceso OMR no guarda ni modifica calificaciones.</p>
            {jobOmr.status === 'failed' && (
              <>
                <InlineMensaje tipo="error">
                  {mensajeErrorTrabajoOmr(jobOmr, esIngestaOmr, assessmentDetalle?.assessment.folio)}
                </InlineMensaje>
                {(jobOmr.errors?.length ?? 0) > 0 && (
                  <details className="ayuda">
                    <summary>Ver código técnico para soporte</summary>
                    <code>{jobOmr.errors!.map((error) => error.code).join(', ')}</code>
                  </details>
                )}
              </>
            )}
            <div className="plantillas-omr__pages">
              {jobOmr.pages.map((page) => (
                <button
                  key={`${page.sheetSerial}-${page.pageIndex}`}
                  type="button"
                  className={`badge ${sheetSerialActivo === page.sheetSerial ? 'badge-activo' : ''}`}
                  aria-pressed={sheetSerialActivo === page.sheetSerial}
                  onClick={() => {
                    setSheetSerialActivo(page.sheetSerial);
                    const sugerenciaOcrRedundante = page.ocrSuggestion?.source === 'ocr_two_position_consensus'
                      && page.ocrSuggestion.matchingPositions === 2;
                    setIngestaExamId(sugerenciaOcrRedundante ? page.ocrSuggestion?.generatedAssessmentId ?? '' : '');
                    setIngestaExamPage(sugerenciaOcrRedundante ? page.ocrSuggestion?.examPage ?? '' : '');
                  }}
                >
                  {page.sheetSerial} · P{page.pageIndex} · {etiquetaEstadoPaginaOmr(page.scanStatus)}
                </button>
              ))}
            </div>
            <div className="acciones acciones--mt">
              {esIngestaOmr && jobOmr.status === 'failed' && (
                <Boton
                  type="button"
                  variante="secundario"
                  cargando={procesandoOmr}
                  disabled={!jobOmr.jobId || procesandoOmr}
                  onClick={async () => {
                    const aceptado = await confirm({
                      title: 'Reprocesar ingesta PDF',
                      message: 'EvaluaPro verificará los originales, continuará las páginas pendientes y reconstruirá los paquetes.',
                      confirmLabel: 'Reprocesar',
                      tone: 'warning',
                      details: ['Se validarán nuevamente los hashes de cada original y de la referencia.', 'No se guardan ni modifican calificaciones.']
                    });
                    if (aceptado) await onReintentarIngestaPdf(jobOmr.jobId);
                  }}
                >
                  Reprocesar desde originales
                </Boton>
              )}
              {!esIngestaOmr && (
                <Boton
                  type="button"
                  variante="secundario"
                  cargando={procesandoOmr}
                  disabled={!jobOmr.jobId || jobOmrTerminal || jobOmr.status === 'processing'}
                  onClick={() => void finalizarJobOmr(jobOmr.jobId)}
                >
                  Finalizar trabajo
                </Boton>
              )}
            </div>
          </div>
          {esIngestaOmr && (
            <div className="resultado plantillas-omr__sources">
              <h4>Archivos originales conservados</h4>
              <section aria-label="Selección de páginas para dataset OMR">
                <h5>Dataset de QA con etiquetas confirmadas</h5>
                <p>Solo aparecen páginas con identidad y respuestas guardadas mediante revisión manual. Las páginas automáticas o pendientes no se etiquetan.</p>
                {paginasDatasetElegibles.length > 0 ? (
                  <ul className="lista">
                    {paginasDatasetElegibles.map((page) => (
                      <li key={`dataset-${page.pageIndex}`}>
                        <label className="campo">
                          <input
                            type="checkbox"
                            aria-label={`Incluir página ${page.pageIndex} con etiquetas revisadas`}
                            checked={paginasDatasetSeleccionadas.includes(page.pageIndex)}
                            onChange={(event) => setPaginasDatasetSeleccionadas((current) => event.target.checked
                              ? [...new Set([...current, page.pageIndex])]
                              : current.filter((index) => index !== page.pageIndex))}
                          />
                          Página {page.pageIndex} · origen {page.sourcePage ?? page.pageIndex} · {page.responses.length} respuestas revisadas
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : <InlineMensaje tipo="info">Aún no hay páginas con resolución manual completa guardada.</InlineMensaje>}
                {descargarDatasetOmr && puedeAnalizarOmr && (
                  <Boton
                    type="button"
                    variante="secundario"
                    cargando={exportandoDataset}
                    disabled={exportandoDataset || paginasDatasetSeleccionadas.length === 0}
                    onClick={() => void exportarDataset()}
                  >
                    Exportar páginas seleccionadas a ZIP QA
                  </Boton>
                )}
              </section>
              <ul className="lista">
                {originalesOmr.map((archivo) => (
                  <li key={archivo.id}>
                    {archivo.nombre} · {archivo.pages} páginas · {(archivo.bytes / (1024 * 1024)).toFixed(1)} MB · SHA-256 {archivo.sha256}
                    <div className="acciones acciones--mt">
                      <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(`/omr/ingestas/${encodeURIComponent(jobOmr.jobId)}/originales/${encodeURIComponent(archivo.id)}`, archivo.nombre)}>
                        Descargar original
                      </Boton>
                      <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(`/omr/ingestas/${encodeURIComponent(jobOmr.jobId)}/manifiesto`, `omr-${jobOmr.jobId}-manifest.json`)}>
                        Descargar manifiesto anonimizado
                      </Boton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {paquetesOmr.length > 0 && (
            <div className="resultado plantillas-omr__packages">
              <h4>Paquetes por alumno</h4>

              <ul className="lista">
                {paquetesOmr.map((paquete) => (
                  <li key={paquete.id}>
                    <b>{paquete.folio}</b> · {paquete.course} · {paquete.subject} · {paquete.partial} · {paquete.teacher} · {paquete.student} · {paquete.group || 'Sin grupo'} · {paquete.pageCount} páginas · {paquete.status === 'complete' ? 'Completo' : 'Revisión requerida'}
                    <div className="acciones acciones--mt">
                      <Boton type="button" variante="secundario" onClick={() => void descargarArtifact(`/omr/ingestas/${encodeURIComponent(jobOmr.jobId)}/paquetes/${encodeURIComponent(paquete.id)}`, paquete.fileName)}>
                        Descargar PDF
                      </Boton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {paginaActiva && (
            <div className="resultado plantillas-omr__review">
              <h4>{paginaPuedeResolverse ? 'Revisión y ajuste' : 'Detalle de página'}: {paginaActiva.sheetSerial}</h4>
              <div className="item-meta">
                <span>Estado: {etiquetaEstadoPaginaOmr(paginaActiva.scanStatus)}</span>
                {paginaActiva.scanStatus !== 'ignored' && paginaActiva.pageType !== 'reverso-vacio' && (
                  <span>Confianza de lectura: {(paginaActiva.confidence * 100).toFixed(1)}%</span>
                )}
                <span>Calificable automáticamente: {paginaActiva.autoGradable ? 'Sí' : 'No'}</span>
                {paginaActiva.sourceFileName && <span>Origen: {paginaActiva.sourceFileName} · página {paginaActiva.sourcePage}</span>}
              </div>
              {paginaActiva.scanStatus !== 'ignored' && paginaActiva.pageType !== 'reverso-vacio' && (
                <p role="note">
                  La confianza resume la lectura. La decisión automática también evalúa calidad de imagen, cobertura y respuestas ambiguas. Si aparece «No», verifica las respuestas contra la captura.
                </p>
              )}
              {paginaActiva.exceptions.length > 0 && (
                <ul className="lista">
                  {paginaActiva.exceptions.map((exception, index) => (
                    <li key={`${paginaActiva.sheetSerial}-${exception.code}-${index}`}>
                      {exception.message}
                      <details className="ayuda">
                        <summary>Ver código técnico para soporte</summary>
                        <code>{exception.code}</code>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              {paginaActiva.ocrSuggestion && (
                <InlineMensaje tipo="info">
                  {paginaActiva.ocrSuggestion.source === 'ocr_two_position_consensus' && paginaActiva.ocrSuggestion.matchingPositions === 2
                    ? `OCR coincide en 2 posiciones: folio ${paginaActiva.ocrSuggestion.folio}, página ${paginaActiva.ocrSuggestion.examPage} (confianza mínima ${paginaActiva.ocrSuggestion.confidence}%). Confirma visualmente esta sugerencia; el QR no quedó validado.`
                    : `Sugerencia OCR previa sin constancia de dos posiciones: folio ${paginaActiva.ocrSuggestion.folio}, página ${paginaActiva.ocrSuggestion.examPage} (confianza ${paginaActiva.ocrSuggestion.confidence}%). No se preselecciona; valida manualmente contra la referencia porque el QR no quedó validado.`}
                </InlineMensaje>
              )}
              {esIngestaOmr && (
                <section className="plantillas-omr__page-preview" aria-label="Página original para revisión visual">
                  <h5>Comparación con el PDF generado</h5>
                  <p>Se muestran ambas páginas desde los PDF conservados. La sugerencia QR u OCR solo ubica la referencia; compara visualmente las páginas antes de confirmar.</p>
                  <Boton
                    type="button"
                    variante="secundario"
                    cargando={loadingPreview}
                    disabled={!paginaActiva.sourceFileId || !Number.isSafeInteger(paginaActiva.pageIndex) || paginaActiva.pageIndex < 1}
                    onClick={() => {
                      setLoadingPreview(true);
                      setPreviewError('');
                      void obtenerPreviewPaginaOmr(jobOmr.jobId, paginaActiva.pageIndex)
                        .then((blob) => {
                          if (blob.type !== 'image/png') throw new Error('La API no devolvió una imagen PNG.');
                          setPagePreview({ pageIndex: paginaActiva.pageIndex, url: URL.createObjectURL(blob) });
                        })
                        .catch((error: unknown) => setPreviewError(error instanceof Error ? error.message : 'No se pudo cargar la página original.'))
                        .finally(() => setLoadingPreview(false));
                    }}
                  >
                    Mostrar página de origen {paginaActiva.sourcePage ?? paginaActiva.pageIndex}
                  </Boton>
                  {(() => {
                    const examId = paginaActiva.examId ?? ingestaExamId;
                    const examPage = paginaActiva.examPage ?? ingestaExamPage;
                    const destinoValido = Boolean(examId && Number.isSafeInteger(examPage) && Number(examPage) > 0);
                    return <>
                      <Boton
                        type="button"
                        variante="secundario"
                        cargando={loadingPreview}
                        disabled={!destinoValido}
                        onClick={() => {
                          if (!destinoValido) return;
                          setLoadingPreview(true);
                          setPreviewError('');
                          void obtenerPreviewReferenciaOmr(jobOmr.jobId, paginaActiva.pageIndex, examId, Number(examPage))
                            .then((blob) => {
                              if (blob.type !== 'image/png') throw new Error('La API no devolvió una imagen PNG.');
                              setReferencePreview({ pageIndex: paginaActiva.pageIndex, examId, examPage: Number(examPage), url: URL.createObjectURL(blob) });
                            })
                            .catch((error: unknown) => setPreviewError(error instanceof Error ? error.message : 'No se pudo cargar la página del PDF generado.'))
                            .finally(() => setLoadingPreview(false));
                        }}
                      >
                        Mostrar página {examPage || '…'} del PDF generado
                      </Boton>
                    </>;
                  })()}
                  {previewError && <InlineMensaje tipo="error">{previewError}</InlineMensaje>}
                  <div className="plantillas-omr__comparison-pages">
                    <figure>
                      <figcaption>Escaneo · {paginaActiva.sourceFileName} · página {paginaActiva.sourcePage ?? paginaActiva.pageIndex}</figcaption>
                      {pagePreview?.pageIndex === paginaActiva.pageIndex
                        ? <img className="plantillas-omr__page-preview-image" src={pagePreview.url} alt={`Página original ${paginaActiva.sourcePage ?? paginaActiva.pageIndex} de ${paginaActiva.sourceFileName ?? 'el PDF'}`} />
                        : <p>Usa “Mostrar página de origen” para cargar esta vista.</p>}
                    </figure>
                    <figure>
                      <figcaption>PDF generado · {referencePreview?.examId === (paginaActiva.examId ?? ingestaExamId) ? `página ${referencePreview.examPage}` : 'referencia'}</figcaption>
                      {referencePreview?.pageIndex === paginaActiva.pageIndex && referencePreview.examId === (paginaActiva.examId ?? ingestaExamId) && referencePreview.examPage === Number(paginaActiva.examPage ?? ingestaExamPage)
                        ? <img className="plantillas-omr__page-preview-image" src={referencePreview.url} alt={`Página ${referencePreview.examPage} del examen generado ${referencePreview.examId}`} />
                        : <p>{paginaActiva.examId && paginaActiva.examPage
                          ? `Carga la página ${paginaActiva.examPage} ya asociada a este examen para compararla con el escaneo.`
                          : 'Selecciona examen y página si hace falta, luego carga la página de referencia.'}</p>}
                    </figure>
                  </div>
                </section>
              )}
              {paginaPuedeResolverse ? (
                <>
                  <div className="plantillas-omr__review-grid">
                {esIngestaOmr && paginaActiva.scanStatus === 'needs_review' && !paginaActiva.examId && (
                  <>
                    <label className="campo">
                      Examen del lote
                      <select value={ingestaExamId} onChange={(event) => { setIngestaExamId(event.target.value); setIngestaExamPage(''); }}>
                        <option value="">Selecciona examen</option>
                        {(jobOmr.candidateExams ?? []).map((exam) => (
                          <option key={exam.id} value={exam.id}>{exam.folio} · {exam.studentName || 'Alumno sin nombre'} · {exam.group || 'Sin grupo'}</option>
                        ))}
                      </select>
                    </label>
                    <label className="campo">
                      Página del examen
                      <select value={ingestaExamPage} onChange={(event) => setIngestaExamPage(event.target.value ? Number(event.target.value) : '')}>
                        <option value="">Selecciona página</option>
                        {(jobOmr.candidateExams?.find((exam) => exam.id === ingestaExamId)?.pages ?? []).map((page) => <option key={page} value={page}>{page}</option>)}
                      </select>
                    </label>
                  </>
                )}
                <label className="campo">
                  Identificador del alumno
                  <input
                    value={draftActivo.studentId}
                    onChange={(event) => {
                      const serial = String(paginaActiva.sheetSerial || '').trim();
                      if (!serial) return;
                      setDraftsPorHoja((prev) => ({
                        ...prev,
                        [serial]: { ...draftActivo, studentId: event.target.value }
                      }));
                    }}
                  />
                </label>
                <label className="campo">
                  Versión
                  <input
                    value={draftActivo.versionCode}
                    onChange={(event) => {
                      const serial = String(paginaActiva.sheetSerial || '').trim();
                      if (!serial) return;
                      setDraftsPorHoja((prev) => ({
                        ...prev,
                        [serial]: { ...draftActivo, versionCode: event.target.value.toUpperCase() }
                      }));
                    }}
                    maxLength={4}
                  />
                </label>
                <label className="campo">
                  Motivo
                  <input value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} />
                </label>
              </div>
              <div className="plantillas-omr__responses">
                {draftActivo.responses.map((response, index) => (
                  (() => {
                    const evidencia = paginaActiva.responses.find((item) => item.numeroPregunta === response.numeroPregunta);
                    return (
                      <div key={`${paginaActiva.sheetSerial}-${response.numeroPregunta}`} className="resultado">
                        <label className="campo">
                          Reactivo {response.numeroPregunta}
                          <select
                            value={response.opcion ?? ''}
                            onChange={(event) => {
                              const serial = String(paginaActiva.sheetSerial || '').trim();
                              if (!serial) return;
                              const siguiente = draftActivo.responses.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, opcion: event.target.value || null } : item
                              );
                              setDraftsPorHoja((prev) => ({
                                ...prev,
                                [serial]: { ...draftActivo, responses: siguiente }
                              }));
                            }}
                          >
                            <option value="">Sin marca</option>
                            {['A', 'B', 'C', 'D', 'E'].map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                        <p>Estado: {etiquetaEstadoRespuesta(evidencia?.estadoRespuesta)}</p>
                        <p>Opción detectada: {evidencia?.opcionDetectada ?? 'Ninguna'}</p>
                        <p>
                          Marcas candidatas del análisis:{' '}
                          {evidencia?.candidatas?.length
                            ? evidencia.candidatas.map((candidata) => `${candidata.opcion} (${Math.round(candidata.score * 100)}%, ${etiquetaEstadoMarca(candidata.estadoMarca)})`).join(' · ')
                            : 'No hay marcas candidatas disponibles'}
                        </p>
                        {evidencia?.flags?.length ? <p>Señales: {evidencia.flags.map(etiquetaSenalOmr).join(' · ')}</p> : null}
                      </div>
                    );
                  })()
                ))}
                  </div>
                  <div className="acciones acciones--mt">
                    <Boton
                      type="button"
                      variante="secundario"
                      cargando={procesandoOmr}
                      onClick={() =>
                        void resolverHojaOmr({
                          jobId: jobOmr.jobId,
                          sheetSerial: paginaActiva.sheetSerial,
                          resolutionReason,
                          ...(esIngestaOmr ? { ingestionResolution: { pageIndex: paginaActiva.pageIndex, ...(!paginaActiva.examId ? { generatedAssessmentId: ingestaExamId, examPage: Number(ingestaExamPage) } : {}) } } : {}),
                          finalIdentity: { studentId: draftActivo.studentId },
                          finalResponses: draftActivo.responses,
                          overrides: { versionCode: draftActivo.versionCode }
                        })
                      }
                      disabled={!resolutionReason.trim() || (esIngestaOmr && !paginaActiva.examId && (!ingestaExamId || !ingestaExamPage))}
                    >
                      Guardar resolución
                    </Boton>
                  </div>
                </>
              ) : (
                <InlineMensaje tipo="info">
                  {paginaActiva.pageType === 'reverso-vacio'
                    ? 'No requiere resolución manual: es un reverso vacío sin respuestas OMR.'
                    : paginaActiva.scanStatus === 'ignored'
                      ? 'Esta página fue omitida por el análisis y no admite resolución manual.'
                      : `Esta página está ${etiquetaEstadoPaginaOmr(paginaActiva.scanStatus).toLowerCase()}. La ingesta PDF solo permite guardar resoluciones para páginas que requieren revisión.`}
                </InlineMensaje>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
