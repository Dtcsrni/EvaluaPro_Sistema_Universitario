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
import { asociarPaginasIngestaParaManual, type CalificacionManualDesdeIngesta } from '../../../capturasRevisionManual';

export type ArchivoOmrLote = { assessmentId: string; loteId: string; etiqueta: string; cantidad: number; archivado?: boolean | null };
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
    reference: {
      pages: number;
      pagesWithSignedQr: number;
      pagesWithExpectedQrPattern?: number;
      pagesWithAmbiguousExpectedQrPatterns?: number;
      pagesWithInvalidSignature?: number;
    };
    candidatesEvaluated: number;
    candidateDiagnostics?: Array<{
      structureValid: boolean;
      reasons: { firmaInvalida: number; geometriaAusente: number; qrAusente: number; qrMalformado: number };
    }>;
    matches: Array<{ assessmentId: string; loteId: string; examCount: number; expectedPages: number; matchedPages: number }>;
  }>;
  jobOmr: OmrJobDetalle | null;
  cargandoAssessmentId: string | null;
  procesandoOmr: boolean;
  descargarArtifact: (url: string | undefined, fileName: string) => Promise<void>;
  descargarDatasetOmr?: (jobId: string, pageIndexes: number[]) => Promise<{ sha256: string; sourceCount: number; labelCount: number }>;
  puedeAnalizarOmr?: boolean;
  puedeCalificarOmr?: boolean;
  calificarLoteOmr?: (jobId: string) => Promise<NonNullable<OmrJobDetalle['autoGrading']>>;
  registrarVerdadTerrenoOmr?: (args: {
    jobId: string;
    pageIndex: number;
    finalResponses: Array<{ numeroPregunta: number; opcion: string | null; tipoMarcaManual: 'valid' | 'blank' | 'double' | 'smudge'; selectedOptions: Array<'A' | 'B' | 'C' | 'D' | 'E'> }>;
    bonusVisible?: boolean;
  }) => Promise<void>;
  obtenerPreviewPaginaOmr: (jobId: string, pageIndex: number) => Promise<Blob>;
  obtenerPreviewReferenciaOmr: (jobId: string, pageIndex: number, generatedAssessmentId: string, examPage: number) => Promise<Blob>;
  crearJobOmr: (args: { assessmentId: string; files: File[]; sourceType: 'image_batch' | 'camera_capture' | 'pdf'; referencePdf?: File }) => Promise<void>;
  onReintentarIngestaPdf?: (jobId: string) => Promise<void>;
  resolverHojaOmr: (args: {
    jobId: string;
    sheetSerial: string;
    resolutionReason: string;
    confirmOriginalVisualReview?: boolean;
    confirmBlindOmrReview?: boolean;
    ingestionResolution?: { pageIndex: number; generatedAssessmentId?: string; examPage?: number };
    finalIdentity?: Record<string, unknown>;
    finalResponses?: Array<{
      numeroPregunta: number;
      opcion: string | null;
      tipoMarcaManual?: 'valid' | 'blank' | 'double' | 'smudge';
      selectedOptions?: Array<'A' | 'B' | 'C' | 'D' | 'E'>;
    }>;
    overrides?: Record<string, unknown>;
  }) => Promise<void>;
  finalizarJobOmr: (jobId: string) => Promise<void>;
  onPrepararCalificacionManual?: (captura: CalificacionManualDesdeIngesta) => Promise<void>;
};

function blobComoDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('La captura no pudo convertirse a imagen.'));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la captura original.'));
    reader.readAsDataURL(blob);
  });
}

type DraftHoja = {
  studentId: string;
  versionCode: string;
  bonusVisible: boolean | null;
  responses: Array<{
    numeroPregunta: number;
    opcion: string | null;
    tipoMarcaManual: 'valid' | 'blank' | 'double' | 'smudge' | null;
    selectedOptions: Array<'A' | 'B' | 'C' | 'D' | 'E'>;
  }>;
};

function construirDraftHoja(pagina: OmrJobDetalle['pages'][number] | null, ocultarPredicciones = false): DraftHoja {
  if (!pagina) {
    return { studentId: '', versionCode: '', bonusVisible: null, responses: [] };
  }

  const respuestasPagina = Array.isArray(pagina.responses)
    ? pagina.responses.filter((item): item is NonNullable<typeof item> => Boolean(item && typeof item === 'object'))
    : [];

  return {
    studentId: String(pagina.identityResult?.studentId ?? ''),
    versionCode: String(pagina.versionResult?.versionCode ?? ''),
    bonusVisible: null,
    responses: respuestasPagina
      .filter((item) => Number.isSafeInteger(Number(item.numeroPregunta)) && Number(item.numeroPregunta) > 0)
      .map((item) => ({
          numeroPregunta: Number(item.numeroPregunta),
          opcion: ocultarPredicciones ? null : (typeof item.opcion === 'string' ? item.opcion : null),
          tipoMarcaManual: ocultarPredicciones ? null : (item.tipoMarcaManual ?? null),
          selectedOptions: ocultarPredicciones ? [] : (item.selectedOptions ?? [])
        }))
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

function respuestaManualCompleta(response: DraftHoja['responses'][number]) {
  const seleccionadas = response.selectedOptions;
  switch (response.tipoMarcaManual) {
    case 'valid': return /^[A-E]$/.test(response.opcion ?? '') && seleccionadas.length === 1 && seleccionadas[0] === response.opcion;
    case 'blank': return response.opcion === null && seleccionadas.length === 0;
    case 'double': return response.opcion === null && seleccionadas.length >= 2;
    case 'smudge': return response.opcion === null;
    default: return false;
  }
}

type ResultadoSecuenciaMarcas =
  | { ok: true; responses: DraftHoja['responses'] }
  | { ok: false; error: string };

function parsearSecuenciaMarcas(responses: DraftHoja['responses'], value: string): ResultadoSecuenciaMarcas {
  const tokens = value.trim().split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length) return { ok: false, error: 'Escribe una marca por reactivo.' };
  if (tokens.length !== responses.length) {
    return { ok: false, error: `La secuencia tiene ${tokens.length} marcas y esta página requiere ${responses.length}.` };
  }
  const parsed: DraftHoja['responses'] = [];
  for (const [index, token] of tokens.entries()) {
    const numeroPregunta = responses[index]!.numeroPregunta;
    const normalized = token.toUpperCase();
    if (/^[A-E]$/.test(normalized)) {
      parsed.push({ numeroPregunta, opcion: normalized, tipoMarcaManual: 'valid', selectedOptions: [normalized as 'A' | 'B' | 'C' | 'D' | 'E'] });
      continue;
    }
    if (normalized === '-') {
      parsed.push({ numeroPregunta, opcion: null, tipoMarcaManual: 'blank', selectedOptions: [] });
      continue;
    }
    if (normalized === '?') {
      parsed.push({ numeroPregunta, opcion: null, tipoMarcaManual: 'smudge', selectedOptions: [] });
      continue;
    }
    const doble = /^!([A-E]{2,5})$/.exec(normalized);
    if (doble && new Set(doble[1]).size === doble[1]!.length) {
      parsed.push({
        numeroPregunta,
        opcion: null,
        tipoMarcaManual: 'double',
        selectedOptions: [...doble[1]!].sort() as DraftHoja['responses'][number]['selectedOptions']
      });
      continue;
    }
    return { ok: false, error: `Marca ${index + 1} («${token}») no válida. Usa A–E, -, ?, o !AB para doble marca.` };
  }
  return { ok: true, responses: parsed };
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
  puedeCalificarOmr = false,
  calificarLoteOmr,
  registrarVerdadTerrenoOmr,
  obtenerPreviewPaginaOmr,
  obtenerPreviewReferenciaOmr,
  crearJobOmr,
  onReintentarIngestaPdf = async () => {},
  resolverHojaOmr,
  finalizarJobOmr,
  onPrepararCalificacionManual
}: Props) {
  const versionesAssessment = useMemo(
    () => resumirVersionesAssessment(assessmentDetalle?.assessment.versionSet ?? []),
    [assessmentDetalle?.assessment.versionSet]
  );
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
  const [confirmacionVisualPageIndex, setConfirmacionVisualPageIndex] = useState<number | null>(null);
  const [secuenciaMarcas, setSecuenciaMarcas] = useState('');
  const [errorSecuenciaMarcas, setErrorSecuenciaMarcas] = useState('');
  const [mensajeSecuenciaMarcas, setMensajeSecuenciaMarcas] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [loteArchivadoSeleccionado, setLoteArchivadoSeleccionado] = useState('');
  const [mensajePrevalidacion, setMensajePrevalidacion] = useState<{ tipo: 'info' | 'ok' | 'warning' | 'error'; texto: string } | null>(null);
  const [prevalidandoReferencia, setPrevalidandoReferencia] = useState(false);
  const [paginasDatasetSeleccionadas, setPaginasDatasetSeleccionadas] = useState<number[]>([]);
  const [exportandoDataset, setExportandoDataset] = useState(false);
  const [calificandoLote, setCalificandoLote] = useState(false);
  const [preparandoCalificacionManualId, setPreparandoCalificacionManualId] = useState<string | null>(null);
  const [errorCalificacionManual, setErrorCalificacionManual] = useState('');
  useEffect(() => {
    setSecuenciaMarcas('');
    setErrorSecuenciaMarcas('');
    setMensajeSecuenciaMarcas('');
  }, [jobOmr?.jobId, paginaActiva?.pageIndex]);
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
      setMensajePrevalidacion({ tipo: 'warning', texto: 'No hay lotes generados disponibles para cotejar.' });
      return;
    }
    setPrevalidandoReferencia(true);
    setMensajePrevalidacion({ tipo: 'info', texto: 'Validando los QR firmados del PDF contra los lotes activos y archivados…' });
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
        const diagnosticos = resultado.candidateDiagnostics ?? [];
        const lotesFirmaInvalida = diagnosticos.filter((lote) => lote.reasons.firmaInvalida > 0).length;
        const lotesGeometriaAusente = diagnosticos.filter((lote) => lote.reasons.geometriaAusente > 0).length;
        const patronesEsperados = resultado.reference.pagesWithExpectedQrPattern ?? 0;
        const patronesAmbiguos = resultado.reference.pagesWithAmbiguousExpectedQrPatterns ?? 0;
        const firmasReferenciaInvalidas = resultado.reference.pagesWithInvalidSignature ?? 0;
        const detalle = resultado.candidateDiagnostics
          ? ` Diagnóstico: ${patronesEsperados}/${resultado.reference.pages} patrones QR esperados localizados; ${firmasReferenciaInvalidas} ${firmasReferenciaInvalidas === 1 ? 'página' : 'páginas'} con firma inválida; ${lotesFirmaInvalida} lotes candidatos con firmas inválidas y ${lotesGeometriaAusente} con geometría incompleta${patronesAmbiguos ? `; ${patronesAmbiguos} páginas con coincidencias QR ambiguas` : ''}.`
          : '';
        setMensajePrevalidacion({
          tipo: 'error',
          texto: `Ninguno de los ${resultado.candidatesEvaluated} lotes tuvo coincidencia completa: ${resultado.reference.pagesWithSignedQr}/${resultado.reference.pages} páginas tienen QR firmado válido.${detalle} No se creó un job.`
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
  const jobOmrIngesta = jobOmr as (OmrJobDetalle & {
    packages?: Array<{ id: string; fileName: string; status: string; pageCount: number; course: string; subject: string; partial: string; teacher: string; student: string; group: string; folio: string }>;
    files?: Array<{ id: string; nombre: string; bytes: number; pages: number; sha256: string }>;
  }) | null;
  const paquetesOmr = jobOmrIngesta?.packages ?? [];
  const originalesOmr = jobOmrIngesta?.files ?? [];
  const esIngestaOmr = Boolean(jobOmrIngesta && Array.isArray(jobOmrIngesta.packages) && Array.isArray(jobOmrIngesta.files));
  const paginaEnRevisionCiega = Boolean(esIngestaOmr && paginaActiva && paginaActiva.scanStatus !== 'rejected');
  const paginaPuedeEtiquetarseCiega = Boolean(paginaEnRevisionCiega && paginaActiva?.examId && paginaActiva.examPage && paginaActiva.folio && paginaActiva.identitySource);
  const respuestasPaginaActiva = Array.isArray(paginaActiva?.responses) ? paginaActiva.responses : [];
  const draftActivo = useMemo(() => {
    if (!paginaActiva) return construirDraftHoja(null);
    const sheetSerial = String(paginaActiva.sheetSerial || '').trim();
    const existente = draftsPorHoja[sheetSerial];
    return existente ?? construirDraftHoja(paginaActiva, paginaEnRevisionCiega);
  }, [draftsPorHoja, paginaEnRevisionCiega, paginaActiva]);
  const jobOmrTerminal = ['completed', 'finalized', 'closed'].includes(String(jobOmr?.status ?? '').toLowerCase());
  const paginasDatasetElegibles = useMemo(() => (jobOmr?.pages ?? []).filter((page) => {
    if (!esIngestaOmr || !page || typeof page !== 'object') return false;
    const respuestasEtiquetadas = Array.isArray(page.groundTruthReview?.responses)
      ? page.groundTruthReview.responses
      : Array.isArray(page.responses) ? page.responses : [];
    return (page.groundTruthReview?.humanReview?.reviewerAttested === true || page.humanReview?.reviewerAttested === true)
      && (page.groundTruthReview?.humanReview?.omrPredictionsHidden === true || page.humanReview?.omrPredictionsHidden === true)
      && Boolean(page.examId && page.examPage && page.folio && page.identitySource)
      && (Boolean(page.groundTruthReview) || Boolean(page.resolutionReason?.trim()))
      && respuestasEtiquetadas.length > 0
      && (page.examPage !== 1 || typeof page.groundTruthReview?.bonusVisible === 'boolean')
      && respuestasEtiquetadas.every((answer) => answer?.estadoRespuesta === 'manual_review');
  }), [esIngestaOmr, jobOmr?.pages]);
  const candidatosCalificacion = jobOmrIngesta?.candidateExams ?? [];
  const paginasEsperadasVerdadTerreno = candidatosCalificacion.reduce((total, exam) => total + exam.pages.length, 0);
  const paginasEtiquetadasVerdadTerreno = paginasDatasetElegibles.filter((page) =>
    candidatosCalificacion.some((exam) => exam.id === page.examId && exam.pages.includes(Number(page.examPage)))
  ).length;
  const examenesConVerdadTerrenoCompleta = candidatosCalificacion.filter((exam) =>
    exam.pages.length > 0 && exam.pages.every((examPage) => paginasDatasetElegibles.some((page) => page.examId === exam.id && page.examPage === examPage))
  ).length;
  const paquetesCompletosCalificacion = paquetesOmr.filter((paquete) => paquete.status === 'complete').length;
  const variantesCalificacion = [...new Set(candidatosCalificacion.flatMap((exam) => exam.variantHashes ?? []))];
  const snapshotsClaveVerificados = candidatosCalificacion.filter((exam) => exam.answerKeySnapshotVerified === true).length;
  const totalExamenesCalificacion = candidatosCalificacion.length;
  const etiquetaExamenesCalificacion = totalExamenesCalificacion === 1 ? 'examen' : 'exámenes';
  const etiquetaVariantesCalificacion = variantesCalificacion.length === 1 ? '1 huella registrada' : `${variantesCalificacion.length} huellas registradas`;
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
  const aplicarSecuenciaMarcas = () => {
    if (!paginaActiva || !paginaPuedeEtiquetarseCiega) return;
    const resultado = parsearSecuenciaMarcas(draftActivo.responses, secuenciaMarcas);
    if (!resultado.ok) {
      setErrorSecuenciaMarcas(resultado.error);
      setMensajeSecuenciaMarcas('');
      return;
    }
    const serial = String(paginaActiva.sheetSerial || '').trim();
    if (!serial) return;
    setDraftsPorHoja((current) => ({
      ...current,
      [serial]: { ...draftActivo, responses: resultado.responses }
    }));
    setConfirmacionVisualPageIndex(null);
    setErrorSecuenciaMarcas('');
    setMensajeSecuenciaMarcas(`Se aplicaron ${resultado.responses.length} marcas en el orden de preguntas mostrado. Revísalas en la captura antes de guardar.`);
  };
  const iniciarCalificacionLote = async () => {
    if (!jobOmr || !esIngestaOmr || !calificarLoteOmr || !puedeCalificarOmr) return;
    const paquetesCompletos = paquetesOmr.filter((paquete) => paquete.status === 'complete').length;
    const aceptado = await confirm({
      title: 'Calificar lote con OMR local',
      message: 'EvaluaPro volverá a leer las páginas originales y registrará solo las notas que pasen todas las verificaciones.',
      confirmLabel: 'Calificar elegibles',
      tone: 'warning',
      details: [
        `${paquetesCompletos} paquetes completos se evaluarán; los que tengan dudas quedarán para revisión.`,
        'No se reemplazarán notas existentes ni se publicarán resultados en Classroom.',
        'La nota máxima es 5 y solo se aplica +0.25 si el OCR local confirma ese texto en el área de calificación.'
      ]
    });
    if (!aceptado) return;
    setCalificandoLote(true);
    try {
      await calificarLoteOmr(jobOmr.jobId);
    } catch {
      // El hook presenta el error y conserva el ID para un reintento idempotente.
    } finally {
      setCalificandoLote(false);
    }
  };
  const iniciarRevisionManualDesdeIngesta = async (examId: string) => {
    if (!jobOmr || jobOmr.status !== 'completed' || !onPrepararCalificacionManual) return;
    const exam = candidatosCalificacion.find((item) => item.id === examId);
    if (!exam) {
      setErrorCalificacionManual('No se encontró el examen dentro de esta ingesta.');
      return;
    }
    const asociacion = asociarPaginasIngestaParaManual(exam, jobOmr.pages);
    if (!asociacion.ok) {
      setErrorCalificacionManual(asociacion.motivo);
      return;
    }
    setPreparandoCalificacionManualId(exam.id);
    setErrorCalificacionManual('');
    try {
      const paginas = [] as CalificacionManualDesdeIngesta['paginas'];
      for (const pagina of asociacion.paginas) {
        const blob = await obtenerPreviewPaginaOmr(jobOmr.jobId, pagina.pageIndex);
        if (blob.type !== 'image/png' || blob.size === 0) {
          throw new Error(`La captura original de la página ${pagina.numeroPagina} no está disponible como PNG.`);
        }
        paginas.push({
          numeroPagina: pagina.numeroPagina,
          imagenBase64: await blobComoDataUrl(blob),
          ...(pagina.nombreArchivo ? { nombreArchivo: pagina.nombreArchivo } : {})
        });
      }
      await onPrepararCalificacionManual({
        examenId: asociacion.examenId,
        folio: asociacion.folio,
        alumnoId: asociacion.alumnoId,
        paginas
      });
    } catch (error) {
      setErrorCalificacionManual(error instanceof Error ? error.message : 'No se pudo preparar la revisión manual del examen.');
    } finally {
      setPreparandoCalificacionManualId(null);
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
        <p className="nota">Se consultan lotes activos y archivados. Seleccionar uno archivado permite revisar capturas y no lo restaura.</p>
        {panelHistorialOmr}
        {cargandoLotesArchivadosOmr ? <InlineMensaje tipo="info">Cargando lotes generados…</InlineMensaje> : (
          <>
          {!puedeLeerLotesArchivadosOmr && <InlineMensaje tipo="error">Tu perfil no tiene permiso para consultar los exámenes generados.</InlineMensaje>}
          {errorCargaLotesArchivadosOmr && (
            <div className="acciones">
              <InlineMensaje tipo="error">No se pudieron cargar los lotes generados: {errorCargaLotesArchivadosOmr}</InlineMensaje>
              {puedeLeerLotesArchivadosOmr && <Boton type="button" variante="secundario" onClick={onReintentarCargaLotesArchivadosOmr}>Reintentar carga</Boton>}
            </div>
          )}
          {puedeLeerLotesArchivadosOmr && !errorCargaLotesArchivadosOmr && lotesArchivadosOmr.length === 0 && (
            <InlineMensaje tipo="info">No se encontraron lotes generados con exámenes disponibles para OMR.</InlineMensaje>
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
              <option value="">{lotesArchivadosOmr.length ? 'Selecciona un lote…' : 'No hay lotes generados disponibles'}</option>
              {lotesArchivadosOmr.map((lote) => (
                <option key={lote.loteId} value={lote.assessmentId}>
                  {lote.etiqueta} · {lote.cantidad} exámenes · {lote.archivado === true ? 'Archivado' : lote.archivado === false ? 'Activo' : 'Estado mixto'}
                </option>
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
          Lote {loteArchivadoActivo.archivado === true ? 'archivado' : loteArchivadoActivo.archivado === false ? 'activo' : 'con estado mixto'} seleccionado: {loteArchivadoActivo.etiqueta} · {loteArchivadoActivo.cantidad} exámenes.{loteArchivadoActivo.archivado === true ? ' El archivo permanece sin restaurar.' : ''}
        </p>
      )}
      <div className="item-meta">
        <span>Folio: {assessmentDetalle.assessment.folio}</span>
        <span>Seed: {assessmentDetalle.assessment.generationSeed || '-'}</span>
        <span>Versiones: {versionesAssessment.length || assessmentDetalle.assessment.statisticsSummary.versionCount}</span>
        <span>Hojas: {assessmentDetalle.assessment.statisticsSummary.sheetCount}</span>
        <span>Packets: {assessmentDetalle.assessment.statisticsSummary.studentPacketCount}</span>
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
              {esIngestaOmr ? (
                <>
                  <span>Etiquetas ciegas pendientes: {jobOmr.summary?.blindReviewRequired ?? 0}</span>
                  <span>Paquetes: {jobOmr.summary?.packages ?? 0}</span>
                </>
              ) : (
                <>
                  <span>Aceptadas: {jobOmr.summary?.accepted ?? 0}</span>
                  <span>Revisión: {jobOmr.summary?.needsReview ?? 0}</span>
                  <span>Rechazadas: {jobOmr.summary?.rejected ?? 0}</span>
                  <span>Auto: {jobOmr.summary?.autoGradable ?? 0}</span>
                  <span>Promedio: {jobOmr.summary?.averageScore ?? 0}%</span>
                </>
              )}
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
                    setConfirmacionVisualPageIndex(null);
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
              <section aria-label="Selección de páginas para dataset OMR">
                <h5>Dataset de QA con etiquetas confirmadas</h5>
                <p>Se pueden etiquetar a ciegas páginas aceptadas o pendientes, sin alterar las predicciones OMR originales.</p>
                <p role="status">
                  Verdad terreno ciega en este job: {paginasEtiquetadasVerdadTerreno} de {paginasEsperadasVerdadTerreno} páginas y {examenesConVerdadTerrenoCompleta} de {candidatosCalificacion.length} exámenes completos.
                </p>
                <p>Las casillas solo seleccionan páginas ya etiquetadas para preparar el ZIP QA; no capturan respuestas ni habilitan la autocalificación.</p>
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

              {esIngestaOmr && jobOmr.status === 'completed' && (
                <section className="resultado" aria-label="Vista previa de calificación OMR">
                  <h5>Vista previa de calificación OMR</h5>
                  <p>
                    Lote {jobOmrIngesta?.loteId ?? 'sin identificador'} · {totalExamenesCalificacion} {etiquetaExamenesCalificacion} · {jobOmr.pagesTotal} páginas procesadas · {paquetesCompletosCalificacion} paquetes completos de {paquetesOmr.length}.
                  </p>
                  <p>
                    Escala 0–5 · omisión confirmada cuenta como incorrecta · bono +0.25 solo con OCR local visible en el área de calificaciones · tope 5.
                  </p>
                  <p>
                    Variante TV4: {variantesCalificacion.length > 0 ? etiquetaVariantesCalificacion : 'huella pendiente'} · snapshot de clave firmado verificado en {snapshotsClaveVerificados}/{totalExamenesCalificacion} exámenes. El servidor vuelve a validar QR, variante, snapshot de clave e identidad antes de guardar.
                  </p>
                  <ul className="lista">
                    {candidatosCalificacion.map((exam) => (
                      <li key={exam.id}>
                        {exam.folio} · {exam.pages.length} páginas · {exam.totalQuestions ?? 0} reactivos · TV{exam.templateVersion ?? '—'} · variante {(exam.variantHashes ?? []).join(', ') || 'pendiente'} ({exam.variantVerified ? 'verificada' : 'sin verificar'}) · clave {(exam.answerKeyHashes ?? []).join(', ') || 'pendiente'} · snapshot {exam.answerKeySnapshotVerified ? 'verificado' : 'sin verificar'} {exam.answerKeySnapshotQuestions ?? 0}/{exam.totalQuestions ?? 0}
                        {onPrepararCalificacionManual && (() => {
                          const asociacion = asociarPaginasIngestaParaManual(exam, jobOmr.pages);
                          return (
                            <div className="acciones acciones--mt">
                              <Boton
                                type="button"
                                variante="secundario"
                                cargando={preparandoCalificacionManualId === exam.id}
                                disabled={!asociacion.ok || Boolean(preparandoCalificacionManualId)}
                                aria-describedby={!asociacion.ok ? `manual-ingesta-${exam.id}` : undefined}
                                onClick={() => void iniciarRevisionManualDesdeIngesta(exam.id)}
                              >
                                Revisar manualmente con captura y clave
                              </Boton>
                              {!asociacion.ok && <small id={`manual-ingesta-${exam.id}`}>{asociacion.motivo}</small>}
                            </div>
                          );
                        })()}
                      </li>
                    ))}
                  </ul>
                  {errorCalificacionManual && <InlineMensaje tipo="error">{errorCalificacionManual}</InlineMensaje>}
                  <p>Se reanalizarán los paquetes completos. La cantidad definitiva de elegibles se determina después de la lectura local; cualquier incertidumbre queda para revisión y no genera nota automática.</p>
                </section>
              )}

              {esIngestaOmr && jobOmr.status === 'completed' && !jobOmrIngesta?.autoGradingAvailable && (
                <InlineMensaje tipo="info">Autocalificación deshabilitada: {jobOmrIngesta?.autoGradingGateReason || 'falta aprobar el piloto OMR TV4 con capturas reales y etiquetas independientes.'}</InlineMensaje>
              )}
              {esIngestaOmr && jobOmr.status === 'completed' && jobOmrIngesta?.autoGradingAvailable && puedeCalificarOmr && calificarLoteOmr && (
                <div className="acciones acciones--mt">
                  <Boton
                    type="button"
                    variante="primario"
                    cargando={calificandoLote || procesandoOmr}
                    disabled={calificandoLote || procesandoOmr || jobOmrIngesta?.autoGrading?.status === 'processing'}
                    onClick={() => void iniciarCalificacionLote()}
                  >
                    Calificar automáticamente los elegibles
                  </Boton>
                </div>
              )}
              {jobOmrIngesta?.autoGrading && (
                <section aria-label="Resultado de calificación automática">
                  <p>
                    Estado: {jobOmrIngesta.autoGrading.status} · {jobOmrIngesta.autoGrading.results.filter((result) => result.status === 'graded').length} registradas y verificadas · {jobOmrIngesta.autoGrading.results.filter((result) => result.status === 'requires_review').length} requieren revisión · {jobOmrIngesta.autoGrading.results.filter((result) => result.status === 'already_graded').length} ya tenían nota.
                  </p>
                  <ul className="lista">
                    {jobOmrIngesta.autoGrading.results.map((result) => (
                      <li key={`${result.examId ?? 'batch'}-${result.status}`}>
                        <b>{result.folio ?? result.examId ?? 'Lote'}</b> · {result.status}
                        {result.status === 'graded' && ` · ${result.correct}/${result.total} · bono ${result.bonusText ?? '0'} · nota ${result.gradeText ?? '—'}`}
                        {result.message && ` · ${result.message}`}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

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
              <h4>Revisión de página: {paginaActiva.sheetSerial}</h4>
              <div className="item-meta">
                <span>Estado: {paginaEnRevisionCiega ? 'Revisión visual ciega' : paginaActiva.scanStatus}</span>
                {!paginaEnRevisionCiega && <span>Confianza: {(paginaActiva.confidence * 100).toFixed(1)}%</span>}
                {!paginaEnRevisionCiega && <span>Auto: {paginaActiva.autoGradable ? 'Sí' : 'No'}</span>}
                {paginaActiva.sourceFileName && <span>Origen: {paginaActiva.sourceFileName} · página {paginaActiva.sourcePage}</span>}
              </div>
              {paginaEnRevisionCiega && (
                <InlineMensaje tipo="info">Las respuestas sugeridas, candidatas y señales del lector OMR están ocultas. Registra cada marca únicamente desde la captura original; la etiqueta independiente no modifica el resultado OMR.</InlineMensaje>
              )}
              {paginaActiva.groundTruthReview && (paginaActiva.groundTruthReview.humanReview?.reviewerAttested === true
                ? <InlineMensaje tipo="ok">Etiqueta ciega confirmada y guardada. La página no se puede volver a etiquetar en esta ingesta.</InlineMensaje>
                : <InlineMensaje tipo="warning">Etiqueta histórica sin constancia de revisión ciega; no cuenta para el piloto. Como esta etiqueta es inmutable, vuelve a cargar el original en una ingesta nueva para revisarla.</InlineMensaje>)}
              {!paginaEnRevisionCiega && Array.isArray(paginaActiva.exceptions) && paginaActiva.exceptions.length > 0 && (
                <ul className="lista">
                  {paginaActiva.exceptions.map((exception, index) => (
                    <li key={`${paginaActiva.sheetSerial}-${exception.code}-${index}`}>
                      <b>{exception.code}</b>: {exception.message}
                    </li>
                  ))}
                </ul>
              )}
              {!paginaEnRevisionCiega && paginaActiva.ocrSuggestion && (
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
                {draftActivo.responses.length === 0 && (
                  <InlineMensaje tipo="warning">Este registro no contiene respuestas por reactivo. No se puede confirmar ni etiquetar desde esta página hasta recuperar el detalle del job.</InlineMensaje>
                )}
                {paginaPuedeEtiquetarseCiega && (
                  <section className="resultado" aria-label="Captura rápida ciega de respuestas">
                    <h5>Captura rápida</h5>
                    <p>Una marca por reactivo, en el orden mostrado: A–E = opción; - = blanco; ? = tachadura/borrón; !AB = doble marca en A y B. Separa tokens con espacios o comas.</p>
                    <label className="campo">
                      Secuencia de marcas observadas
                      <input
                        type="text"
                        aria-label="Secuencia de marcas observadas"
                        value={secuenciaMarcas}
                        onChange={(event) => {
                          setSecuenciaMarcas(event.target.value);
                          setErrorSecuenciaMarcas('');
                          setMensajeSecuenciaMarcas('');
                        }}
                        placeholder="A B - C !DE ?"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    <Boton type="button" variante="secundario" onClick={aplicarSecuenciaMarcas} disabled={!secuenciaMarcas.trim()}>
                      Aplicar secuencia
                    </Boton>
                    {errorSecuenciaMarcas && <InlineMensaje tipo="error">{errorSecuenciaMarcas}</InlineMensaje>}
                    {mensajeSecuenciaMarcas && <InlineMensaje tipo="info">{mensajeSecuenciaMarcas}</InlineMensaje>}
                  </section>
                )}
                {paginaEnRevisionCiega && <p>También puedes capturar cada reactivo por separado. Revisa siempre la captura original antes de confirmar la etiqueta.</p>}
                {draftActivo.responses.map((response, index) => (
                  (() => {
                    const evidencia = respuestasPaginaActiva.find((item) => item.numeroPregunta === response.numeroPregunta);
                    return (
                      <div key={`${paginaActiva.sheetSerial}-${response.numeroPregunta}`} className="resultado">
                        {paginaEnRevisionCiega ? (
                          <label className="campo">
                            Marca observada P{response.numeroPregunta}
                            <select
                              value={response.tipoMarcaManual === 'valid' && response.opcion ? `valid:${response.opcion}` : response.tipoMarcaManual ?? ''}
                              onChange={(event) => {
                                const serial = String(paginaActiva.sheetSerial || '').trim();
                                if (!serial) return;
                                const valor = event.target.value;
                                const esRespuestaValida = /^valid:[A-E]$/.test(valor);
                                const opcion = esRespuestaValida ? valor.slice(-1) as 'A' | 'B' | 'C' | 'D' | 'E' : null;
                                const tipoMarcaManual: DraftHoja['responses'][number]['tipoMarcaManual'] = esRespuestaValida
                                  ? 'valid'
                                  : valor === 'blank' ? 'blank'
                                    : valor === 'double' ? 'double'
                                      : valor === 'smudge' ? 'smudge' : null;
                                const siguiente = draftActivo.responses.map((item, itemIndex) => itemIndex !== index ? item : ({
                                  ...item,
                                  tipoMarcaManual,
                                  opcion,
                                  selectedOptions: opcion ? [opcion] : []
                                }));
                                setDraftsPorHoja((prev) => ({ ...prev, [serial]: { ...draftActivo, responses: siguiente } }));
                                setConfirmacionVisualPageIndex(null);
                              }}
                            >
                              <option value="">Selecciona la marca observada</option>
                              {(['A', 'B', 'C', 'D', 'E'] as const).map((option) => (
                                <option key={option} value={`valid:${option}`}>{option} — una marca válida</option>
                              ))}
                              <option value="blank">En blanco</option>
                              <option value="double">Doble marca</option>
                              <option value="smudge">Tachadura o borrón</option>
                            </select>
                          </label>
                        ) : (
                          <>
                            <label className="campo">
                              P{response.numeroPregunta}
                              <select
                                value={response.opcion ?? ''}
                                disabled={response.tipoMarcaManual !== 'valid'}
                                onChange={(event) => {
                                  const serial = String(paginaActiva.sheetSerial || '').trim();
                                  if (!serial) return;
                                  const opcion = (event.target.value || null) as 'A' | 'B' | 'C' | 'D' | 'E' | null;
                                  const siguiente = draftActivo.responses.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, opcion, selectedOptions: item.tipoMarcaManual === 'valid' && opcion ? [opcion] : item.selectedOptions } : item
                                  );
                                  setDraftsPorHoja((prev) => ({ ...prev, [serial]: { ...draftActivo, responses: siguiente } }));
                                  setConfirmacionVisualPageIndex(null);
                                }}
                              >
                                <option value="">Sin marca</option>
                                {['A', 'B', 'C', 'D', 'E'].map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </label>
                            <label className="campo">
                              Tipo de marca observada
                              <select
                                value={response.tipoMarcaManual ?? ''}
                                onChange={(event) => {
                                  const serial = String(paginaActiva.sheetSerial || '').trim();
                                  if (!serial) return;
                                  const tipoMarcaManual = (event.target.value || null) as DraftHoja['responses'][number]['tipoMarcaManual'];
                                  const siguiente = draftActivo.responses.map((item, itemIndex) => itemIndex !== index ? item : ({
                                    ...item,
                                    tipoMarcaManual,
                                    opcion: tipoMarcaManual === 'valid' ? item.opcion : null,
                                    selectedOptions: tipoMarcaManual === 'valid' && item.opcion ? [item.opcion as 'A' | 'B' | 'C' | 'D' | 'E'] : []
                                  }));
                                  setDraftsPorHoja((prev) => ({ ...prev, [serial]: { ...draftActivo, responses: siguiente } }));
                                  setConfirmacionVisualPageIndex(null);
                                }}
                              >
                                <option value="">Selecciona tras revisar</option>
                                <option value="valid">Una marca válida</option>
                                <option value="blank">En blanco</option>
                                <option value="double">Doble marca</option>
                                <option value="smudge">Tachadura o borrón</option>
                              </select>
                            </label>
                          </>
                        )}
                        {response.tipoMarcaManual === 'double' && (
                          <fieldset className="campo">
                            <legend>Opciones marcadas</legend>
                            {(['A', 'B', 'C', 'D', 'E'] as const).map((option) => (
                              <label key={option}>
                                <input
                                  type="checkbox"
                                  checked={response.selectedOptions.includes(option)}
                                  onChange={(event) => {
                                    const serial = String(paginaActiva.sheetSerial || '').trim();
                                    if (!serial) return;
                                    const selectedOptions: DraftHoja['responses'][number]['selectedOptions'] = event.target.checked
                                      ? [...new Set([...response.selectedOptions, option])]
                                      : response.selectedOptions.filter((selected) => selected !== option);
                                    const siguiente = draftActivo.responses.map((item, itemIndex) => itemIndex === index ? { ...item, selectedOptions } : item);
                                    setDraftsPorHoja((prev) => ({ ...prev, [serial]: { ...draftActivo, responses: siguiente } }));
                                    setConfirmacionVisualPageIndex(null);
                                  }}
                                />
                                {option}
                              </label>
                            ))}
                          </fieldset>
                        )}
                        {paginaEnRevisionCiega ? (
                          <p>Predicción automática oculta hasta terminar esta revisión.</p>
                        ) : (
                          <>
                            <p>Estado: {etiquetaEstadoRespuesta(evidencia?.estadoRespuesta)}</p>
                            <p>Opción detectada: {evidencia?.opcionDetectada ?? 'Ninguna'}</p>
                            <p>
                              Candidatas OMR:{' '}
                              {evidencia?.candidatas?.length
                                ? evidencia.candidatas.map((candidata) => `${candidata.opcion} (${Math.round(candidata.score * 100)}%, ${etiquetaEstadoMarca(candidata.estadoMarca)})`).join(' · ')
                                : 'sin evidencia candidata conservada'}
                            </p>
                            {evidencia?.flags?.length ? <p>Señales: {evidencia.flags.join(', ')}</p> : null}
                          </>
                        )}
                      </div>
                    );
                  })()
                ))}
              </div>
              {paginaPuedeEtiquetarseCiega && paginaActiva.examPage === 1 && (
                <fieldset className="plantillas-omr__bonus-label">
                  <legend>En el área de calificaciones de esta página, ¿aparece “+0.25”?</legend>
                  <label className="campo">
                    <input
                      type="radio"
                      name={`bonus-visible-${paginaActiva.pageIndex}`}
                      checked={draftActivo.bonusVisible === false}
                      onChange={() => {
                        const serial = String(paginaActiva.sheetSerial || '').trim();
                        if (serial) setDraftsPorHoja((prev) => ({ ...prev, [serial]: { ...draftActivo, bonusVisible: false } }));
                      }}
                    />
                    No aparece
                  </label>
                  <label className="campo">
                    <input
                      type="radio"
                      name={`bonus-visible-${paginaActiva.pageIndex}`}
                      checked={draftActivo.bonusVisible === true}
                      onChange={() => {
                        const serial = String(paginaActiva.sheetSerial || '').trim();
                        if (serial) setDraftsPorHoja((prev) => ({ ...prev, [serial]: { ...draftActivo, bonusVisible: true } }));
                      }}
                    />
                    Sí, aparece “+0.25”
                  </label>
                </fieldset>
              )}
              {esIngestaOmr && (
                <label className="campo">
                  <input
                    type="checkbox"
                    checked={confirmacionVisualPageIndex === paginaActiva.pageIndex}
                    disabled={pagePreview?.pageIndex !== paginaActiva.pageIndex}
                    onChange={(event) => setConfirmacionVisualPageIndex(event.target.checked ? paginaActiva.pageIndex : null)}
                  />
                  {paginaEnRevisionCiega
                    ? 'Confirmo que registré cada respuesta desde la captura original mostrada sin ver las predicciones ni candidatas OMR.'
                    : 'Confirmo que cotejé visualmente cada respuesta con la captura original mostrada. Esta revisión se registrará con un identificador seudónimo y fecha.'}
                </label>
              )}
              <div className="acciones acciones--mt">
                <Boton
                  type="button"
                  variante="secundario"
                  cargando={procesandoOmr}
                  onClick={() => {
                    if (paginaPuedeEtiquetarseCiega && registrarVerdadTerrenoOmr) {
                      void registrarVerdadTerrenoOmr({
                        jobId: jobOmr.jobId,
                        pageIndex: paginaActiva.pageIndex,
                        ...(paginaActiva.examPage === 1 ? { bonusVisible: draftActivo.bonusVisible === true } : {}),
                        finalResponses: draftActivo.responses.map(({ numeroPregunta, opcion, tipoMarcaManual, selectedOptions }) => ({
                          numeroPregunta,
                          opcion,
                          tipoMarcaManual: tipoMarcaManual!,
                          selectedOptions
                        }))
                      });
                      return;
                    }
                    void resolverHojaOmr({
                      jobId: jobOmr.jobId,
                      sheetSerial: paginaActiva.sheetSerial,
                      resolutionReason,
                      ...(esIngestaOmr ? { confirmOriginalVisualReview: confirmacionVisualPageIndex === paginaActiva.pageIndex } : {}),
                      ...(paginaEnRevisionCiega && confirmacionVisualPageIndex === paginaActiva.pageIndex ? { confirmBlindOmrReview: true } : {}),
                      ...(esIngestaOmr ? { ingestionResolution: { pageIndex: paginaActiva.pageIndex, ...(!paginaActiva.examId ? { generatedAssessmentId: ingestaExamId, examPage: Number(ingestaExamPage) } : {}) } } : {}),
                      finalIdentity: { studentId: draftActivo.studentId },
                      finalResponses: draftActivo.responses.map(({ numeroPregunta, opcion, tipoMarcaManual, selectedOptions }) => ({ numeroPregunta, opcion, tipoMarcaManual: tipoMarcaManual ?? undefined, selectedOptions })),
                      overrides: { versionCode: draftActivo.versionCode }
                    });
                  }}
                  disabled={(!paginaPuedeEtiquetarseCiega && !resolutionReason.trim()) || (paginaPuedeEtiquetarseCiega && !registrarVerdadTerrenoOmr) || (esIngestaOmr && paginaPuedeEtiquetarseCiega && paginaActiva.examPage === 1 && draftActivo.bonusVisible === null) || (esIngestaOmr && (!draftActivo.responses.every(respuestaManualCompleta) || confirmacionVisualPageIndex !== paginaActiva.pageIndex)) || (esIngestaOmr && !paginaPuedeEtiquetarseCiega && !paginaActiva.examId && (!ingestaExamId || !ingestaExamPage)) || Boolean(paginaActiva.groundTruthReview)}
                >
                  {paginaPuedeEtiquetarseCiega ? 'Guardar etiqueta ciega' : 'Guardar resolución'}
                </Boton>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
