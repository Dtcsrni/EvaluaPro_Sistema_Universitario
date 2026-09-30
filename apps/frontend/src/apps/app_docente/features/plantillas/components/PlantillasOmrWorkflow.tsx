/**
 * PlantillasOmrWorkflow
 *
 * Responsabilidad: Componente de UI del dominio docente (presentacion y eventos de vista).
 * Limites: Evitar acoplar IO directo; preferir hooks/services del feature.
 */
import { useEffect, useMemo, useState } from 'react';
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

function etiquetaEstadoMarca(estado: string) {
  switch (estado) {
    case 'marcada': return 'marcada';
    case 'parcial': return 'parcial';
    case 'tachada': return 'tachada';
    default: return 'sin señal suficiente';
  }
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
  obtenerPreviewPaginaOmr,
  obtenerPreviewReferenciaOmr,
  crearJobOmr,
  onReintentarIngestaPdf = async () => {},
  resolverHojaOmr,
  finalizarJobOmr
}: Props) {
  const confirm = useConfirmDialog();
  const [files, setFiles] = useState<File[]>([]);
  const [referencePdf, setReferencePdf] = useState<File | undefined>();
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
      {!cargandoTrabajosOmr && !errorTrabajosOmr && trabajosOmr.length === 0 && <InlineMensaje tipo="info">Aún no hay trabajos OMR guardados.</InlineMensaje>}
      {trabajosOmr.length > 0 && (
        <ul className="lista plantillas-omr__history-list" aria-label="Historial de trabajos OMR">
          {trabajosOmr.map((trabajo) => (
            <li key={trabajo.jobId}>
              <div>
                <strong>{trabajo.folio ? `Folio: ${trabajo.folio}` : `Evaluación: ${trabajo.assessmentId}`}</strong>
                <span> · Job OMR: {trabajo.jobId}</span>
                <span> · {trabajo.workflow === 'pdf_ingesta' ? 'PDF clasificado' : trabajo.sourceType === 'pdf' ? 'PDF' : 'Capturas de imagen'}</span>
                <div className="item-meta">
                  <span>Estado: {trabajo.status}</span>
                  <span>Páginas: {trabajo.pagesProcessed}/{trabajo.pagesTotal}</span>
                  <span>Revisión: {trabajo.summary?.needsReview ?? 0}</span>
                  <span>{Number.isFinite(Date.parse(trabajo.createdAt)) ? new Date(trabajo.createdAt).toLocaleString() : 'Fecha no disponible'}</span>
                </div>
              </div>
              <Boton
                type="button"
                variante="secundario"
                cargando={cargandoAssessmentId === trabajo.assessmentId}
                disabled={!trabajo.assessmentId || Boolean(cargandoAssessmentId)}
                onClick={() => void onAbrirTrabajoOmr(trabajo)}
              >
                Reabrir revisión
              </Boton>
            </li>
          ))}
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
            <label className="campo" htmlFor="omr-referencia-lote">
              PDF de referencia
              <input
                id="omr-referencia-lote"
                type="file"
                accept="application/pdf,.pdf"
                disabled={!puedeLeerLotesArchivadosOmr || prevalidandoReferencia || procesandoOmr}
                onChange={(event) => {
                  setReferencePdf(event.target.files?.[0] || undefined);
                  setMensajePrevalidacion(null);
                }}
              />
            </label>
            {referencePdf && <p className="nota">Seleccionado: {referencePdf.name} · {(referencePdf.size / (1024 * 1024)).toFixed(2)} MiB</p>}
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
          <div className="campo-formulario">
            <label htmlFor="omr-lote-archivado">Lote de examen</label>
            <select
              id="omr-lote-archivado"
              value={loteArchivadoSeleccionado}
              disabled={!puedeLeerLotesArchivadosOmr || Boolean(errorCargaLotesArchivadosOmr) || lotesArchivadosOmr.length === 0 || Boolean(cargandoAssessmentId)}
              onChange={(event) => {
                const assessmentId = event.currentTarget.value;
                setLoteArchivadoSeleccionado(assessmentId);
                if (assessmentId) void onSeleccionarLoteArchivado(assessmentId);
              }}
            >
              <option value="">{lotesArchivadosOmr.length ? 'Selecciona un lote…' : 'No hay lotes archivados disponibles'}</option>
              {lotesArchivadosOmr.map((lote) => (
                <option key={lote.loteId} value={lote.assessmentId}>{lote.etiqueta} · {lote.cantidad} exámenes</option>
              ))}
            </select>
          </div>
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
        <span>Versiones: {assessmentDetalle.assessment.statisticsSummary.versionCount}</span>
        <span>Hojas: {assessmentDetalle.assessment.statisticsSummary.sheetCount}</span>
        <span>Packets: {assessmentDetalle.assessment.statisticsSummary.studentPacketCount}</span>
      </div>
      {Array.isArray(assessmentDetalle.assessment.versionSet) && assessmentDetalle.assessment.versionSet.length > 0 && (
        <div className="item-meta">
          {assessmentDetalle.assessment.versionSet.map((version) => (
            <span key={`${assessmentDetalle.assessment._id}-${version.versionCode}`}>
              Versión {version.versionCode}: {version.questionCount} reactivos
            </span>
          ))}
        </div>
      )}
      {Array.isArray(assessmentDetalle.studentPacketArtifacts) && assessmentDetalle.studentPacketArtifacts.length > 0 && (
        <div className="resultado">
          <h4>Packets emitidos</h4>
          <ul className="lista">
            {assessmentDetalle.studentPacketArtifacts.map((packet) => (
              <li key={`${packet.sheetSerial}-${packet.studentId || 'na'}`}>
                <b>{packet.sheetSerial}</b> · {packet.studentName || 'Alumno sin nombre'} · {packet.studentId || 'Sin ID'} · Versión {packet.versionCode}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="acciones acciones--mt">
        <Boton type="button" variante="secundario" disabled={!assessmentDetalle.assessment.bookletPdfUrl} onClick={() => void descargarArtifact(assessmentDetalle.assessment.bookletPdfUrl, `${assessmentDetalle.assessment.folio}_booklet.pdf`)}>
          Descargar cuadernillo
        </Boton>
        <Boton type="button" variante="secundario" disabled={!assessmentDetalle.assessment.omrSheetPdfUrl} onClick={() => void descargarArtifact(assessmentDetalle.assessment.omrSheetPdfUrl, `${assessmentDetalle.assessment.folio}_omr_sheet.pdf`)}>
          Descargar hoja OMR
        </Boton>
        <Boton type="button" variante="secundario" disabled={!assessmentDetalle.assessment.answerKeyUrl} onClick={() => void descargarArtifact(assessmentDetalle.assessment.answerKeyUrl, `${assessmentDetalle.assessment.folio}_answer_key.json`)}>
          Descargar answer key
        </Boton>
        <Boton type="button" variante="secundario" disabled={!assessmentDetalle.assessment.manifestUrl} onClick={() => void descargarArtifact(assessmentDetalle.assessment.manifestUrl, `${assessmentDetalle.assessment.folio}_manifest.json`)}>
          Descargar manifest
        </Boton>
        <Boton
          type="button"
          variante="secundario"
          disabled={!assessmentDetalle.assessment.studentPacketZipUrl}
          onClick={() => void descargarArtifact(assessmentDetalle.assessment.studentPacketZipUrl, `${assessmentDetalle.assessment.folio}_student_packets.zip`)}
        >
          Descargar packets ZIP
        </Boton>
      </div>

      <div className="acciones acciones--mt">
        <label className="campo">
          Capturas o PDF
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(event) => {
              const seleccionados = Array.from(event.target.files ?? []);
              const error = validarSeleccionOmr(seleccionados, referencePdf);
              setFiles(seleccionados);
              setSelectionError(error);
              if (!error) {
                emitToast({
                  level: seleccionados.length > 0 ? 'ok' : 'info',
                  title: 'OMR',
                  message: seleccionados.length > 0
                    ? `${seleccionados.length} archivo${seleccionados.length === 1 ? '' : 's'} seleccionado${seleccionados.length === 1 ? '' : 's'}`
                    : 'Selección de archivos cancelada',
                  durationMs: 1600
                });
              }
            }}
          />
        </label>
        <label className="campo">
          PDF generado del lote (opcional si EvaluaPro no conserva el original)
          {referencePdf && <span>Referencia seleccionada: {referencePdf.name}</span>}
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const seleccionado = event.target.files?.[0];
              const siguiente = seleccionado || undefined;
              setReferencePdf(siguiente);
              setSelectionError(validarSeleccionOmr(files, siguiente));
            }}
          />
        </label>
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
            emitToast({ level: 'info', title: 'OMR', message: `Procesando ${files.length} archivo${files.length === 1 ? '' : 's'}…`, durationMs: 1800 });
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
            <h4>Job OMR</h4>
            <div className="item-meta">
              <span>Estado: {jobOmr.status}</span>
              <span>Aceptadas: {jobOmr.summary?.accepted ?? 0}</span>
              <span>Revisión: {jobOmr.summary?.needsReview ?? 0}</span>
              <span>Rechazadas: {jobOmr.summary?.rejected ?? 0}</span>
              <span>Auto: {jobOmr.summary?.autoGradable ?? 0}</span>
              <span>Promedio: {jobOmr.summary?.averageScore ?? 0}%</span>
            </div>
            {jobOmr.status === 'failed' && (jobOmr.errors?.length ?? 0) > 0 && (
              <InlineMensaje tipo="error">
                Falló el procesamiento. Código(s): {jobOmr.errors!.map((error) => error.code).join(', ')}
              </InlineMensaje>
            )}
            <div className="plantillas-omr__pages">
              {jobOmr.pages.map((page) => (
                <button
                  key={`${page.sheetSerial}-${page.pageIndex}`}
                  type="button"
                  className={`badge ${sheetSerialActivo === page.sheetSerial ? 'badge-activo' : ''}`}
                  onClick={() => {
                    setSheetSerialActivo(page.sheetSerial);
                    const sugerenciaOcrRedundante = page.ocrSuggestion?.source === 'ocr_two_position_consensus'
                      && page.ocrSuggestion.matchingPositions === 2;
                    setIngestaExamId(sugerenciaOcrRedundante ? page.ocrSuggestion?.generatedAssessmentId ?? '' : '');
                    setIngestaExamPage(sugerenciaOcrRedundante ? page.ocrSuggestion?.examPage ?? '' : '');
                    emitToast({ level: 'info', title: 'Hoja OMR', message: `Hoja ${page.sheetSerial} seleccionada`, durationMs: 1400 });
                  }}
                >
                  {page.sheetSerial} · P{page.pageIndex} · {page.scanStatus}
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
              <Boton
                type="button"
                variante="secundario"
                cargando={procesandoOmr}
                disabled={!jobOmr.jobId || jobOmrTerminal || esIngestaOmr || jobOmr.status === 'processing'}
                onClick={() => void finalizarJobOmr(jobOmr.jobId)}
              >
                Finalizar job
              </Boton>
            </div>
          </div>
          {esIngestaOmr && (
            <div className="resultado plantillas-omr__sources">
              <h4>Archivos originales conservados</h4>
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
              <h4>Review & Fix: {paginaActiva.sheetSerial}</h4>
              <div className="item-meta">
                <span>Estado: {paginaActiva.scanStatus}</span>
                <span>Confianza: {(paginaActiva.confidence * 100).toFixed(1)}%</span>
                <span>Auto: {paginaActiva.autoGradable ? 'Sí' : 'No'}</span>
                {paginaActiva.sourceFileName && <span>Origen: {paginaActiva.sourceFileName} · página {paginaActiva.sourcePage}</span>}
              </div>
              {paginaActiva.exceptions.length > 0 && (
                <ul className="lista">
                  {paginaActiva.exceptions.map((exception, index) => (
                    <li key={`${paginaActiva.sheetSerial}-${exception.code}-${index}`}>
                      <b>{exception.code}</b>: {exception.message}
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
                        : <p>Selecciona examen y página si hace falta, luego carga la página de referencia.</p>}
                    </figure>
                  </div>
                </section>
              )}
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
                  Student ID
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
                          P{response.numeroPregunta}
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
                          Candidatas OMR:{' '}
                          {evidencia?.candidatas?.length
                            ? evidencia.candidatas.map((candidata) => `${candidata.opcion} (${Math.round(candidata.score * 100)}%, ${etiquetaEstadoMarca(candidata.estadoMarca)})`).join(' · ')
                            : 'sin evidencia candidata conservada'}
                        </p>
                        {evidencia?.flags?.length ? <p>Señales: {evidencia.flags.join(', ')}</p> : null}
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
