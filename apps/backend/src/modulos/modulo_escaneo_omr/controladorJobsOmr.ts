/**
 * Controladores del workflow OMR por jobs.
 *
 * El job es una fachada transaccional sobre el pipeline OMR existente:
 * conserva progreso/resoluciones y reutiliza el mismo análisis canónico que
 * `/omr/analizar`, evitando dos motores con reglas distintas.
 */
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { rasterizarPdfParaPreview } from '../modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';
import { analizarImagen } from './controladorEscaneoOmr.js';
import { esquemaListarJobsOmr } from './validacionesOmr.js';
import { proyectarRespuestaParaRevisionOmr, type RespuestaRevisionOmr } from './omr/decision/respuestaRevision.js';

type CapturaOmr = { nombreArchivo?: string; imagenBase64: string };
type TipoFuenteOmr = 'image_batch' | 'camera_capture' | 'pdf';
type EntradaPaginaJob = { pageIndex: number; imagenBase64?: string; nombreArchivo?: string; error?: string };
type ErrorJob = { pageIndex: number; message: string; nombreArchivo?: string };

type PaginaJob = {
  sheetSerial: string;
  pageIndex: number;
  pageType?: 'examen' | 'reverso-vacio';
  sourceFileName?: string;
  scanStatus: 'accepted' | 'needs_review' | 'rejected' | 'ignored';
  confidence: number;
  autoGradable: boolean;
  manualReviewRequired: boolean;
  identityResult?: { studentId?: string | null; studentName?: string | null };
  versionResult?: { versionCode?: string | null };
  responses: RespuestaRevisionOmr[];
  exceptions: Array<{ code: string; severity: 'info' | 'warning' | 'blocking'; message: string; recommendedAction?: string }>;
  resultado?: {
    estadoAnalisis: string;
    calidadPagina: number;
    ratioAmbiguas: number;
  };
};

type JobMetadata = {
  version: 1;
  clientRequestId?: string;
  requestHash?: string;
  assessmentId: string;
  folio: string;
  sourceType: TipoFuenteOmr;
  pages: PaginaJob[];
  errors: ErrorJob[];
  reviewResolutions: Array<{ sheetSerial: string; resolvedAt: string; resolutionReason: string }>;
  finalizedAt?: string;
};

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function quitarPrefijoDataUrl(value: string) {
  return String(value || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
}

function hashSolicitudJobOmr(body: { generatedAssessmentId: string; sourceType: TipoFuenteOmr; capturas: CapturaOmr[] }) {
  const hash = createHash('sha256');
  const agregar = (value: string) => {
    hash.update(`${Buffer.byteLength(value, 'utf8')}:`).update(value);
  };
  agregar(body.generatedAssessmentId);
  agregar(body.sourceType);
  for (const captura of body.capturas) {
    agregar(captura.nombreArchivo ?? '');
    agregar(captura.imagenBase64);
  }
  return hash.digest('hex');
}

function esPdf(captura: CapturaOmr, sourceType: TipoFuenteOmr) {
  return sourceType === 'pdf' || /^data:application\/pdf[;,]/i.test(String(captura.imagenBase64 || '').trim());
}

async function expandirCapturas(capturas: CapturaOmr[], sourceType: TipoFuenteOmr) {
  const paginas: EntradaPaginaJob[] = [];
  for (const captura of capturas) {
    if (!esPdf(captura, sourceType)) {
      paginas.push({ pageIndex: paginas.length + 1, imagenBase64: captura.imagenBase64, nombreArchivo: captura.nombreArchivo });
      continue;
    }
    try {
      const buffer = Buffer.from(quitarPrefijoDataUrl(captura.imagenBase64), 'base64');
      const render = await rasterizarPdfParaPreview(buffer);
      for (const pagina of render.paginas) {
        paginas.push({ pageIndex: paginas.length + 1, imagenBase64: pagina.dataUrl, nombreArchivo: `${captura.nombreArchivo || 'captura'}/pagina-${pagina.numero}.png` });
      }
    } catch {
      // Una captura inválida no debe descartar las demás páginas del lote. Se
      // conserva como página rechazada para que el panel pueda mostrar el
      // error y la trazabilidad de la captura original.
      paginas.push({
        pageIndex: paginas.length + 1,
        nombreArchivo: captura.nombreArchivo,
        error: 'No se pudo rasterizar el PDF de capturas OMR'
      });
    }
  }
  return paginas;
}

function ejecutarAnalisisInterno(params: {
  docenteId: string;
  folio: string;
  numeroPagina: number;
  imagenBase64: string;
}) {
  return new Promise<any>((resolve, reject) => {
    const req = {
      body: {
        folio: params.folio,
        numeroPagina: params.numeroPagina,
        imagenBase64: params.imagenBase64
      },
      docenteId: params.docenteId
    } as unknown as SolicitudDocente;
    const res = {
      json(payload: unknown) {
        resolve(payload);
        return res;
      }
    } as unknown as Response;
    void analizarImagen(req, res).catch(reject);
  });
}

function convertirResultadoAPagina(
  folio: string,
  pageIndex: number,
  payload: any,
  sourceFileName?: string,
  forzarRevisionManual = false
): PaginaJob {
  const resultado = payload?.resultado ?? {};
  const estado = String(resultado.estadoAnalisis ?? 'requiere_revision');
  const scanStatus: PaginaJob['scanStatus'] = estado === 'ok' ? 'accepted' : estado === 'rechazado_calidad' ? 'rejected' : 'needs_review';
  const motivos = Array.isArray(resultado.motivosRevision) ? resultado.motivosRevision.map((item: unknown) => String(item)).filter(Boolean) : [];
  const respuestas = Array.isArray(resultado.respuestasDetectadas)
    ? resultado.respuestasDetectadas.map(proyectarRespuestaParaRevisionOmr)
    : [];
  const confidence = Number(resultado.confianzaPromedioPagina ?? 0);
  const pagina: PaginaJob = {
    sheetSerial: `${folio}-P${pageIndex}`,
    pageIndex,
    ...(sourceFileName ? { sourceFileName } : {}),
    scanStatus,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    autoGradable: !forzarRevisionManual && scanStatus === 'accepted',
    manualReviewRequired: forzarRevisionManual || scanStatus !== 'accepted',
    identityResult: { studentId: payload?.alumnoId ?? null },
    versionResult: { versionCode: null },
    responses: respuestas,
    exceptions: motivos.map((message: string, index: number) => ({
      code: `OMR_REVIEW_${index + 1}`,
      severity: scanStatus === 'rejected' ? 'blocking' : 'warning',
      message,
      recommendedAction: 'Revisar la captura y resolver la hoja antes de finalizar el job.'
    })),
    resultado: {
      estadoAnalisis: estado,
      calidadPagina: Number(resultado.calidadPagina ?? 0),
      ratioAmbiguas: Number(resultado.ratioAmbiguas ?? 1)
    }
  };
  if (forzarRevisionManual && scanStatus === 'accepted') {
    pagina.scanStatus = 'needs_review';
    pagina.exceptions.push({
      code: 'OMR_TEMPLATE_EXPERIMENTAL',
      severity: 'warning',
      message: 'La plantilla OMR integrada es experimental y requiere revisión humana completa.',
      recommendedAction: 'Confirmar identidad y cada respuesta contra la captura original.'
    });
  }
  return pagina;
}

function toPublicJob(job: { id: string; estado: string; totalHojas: number; procesadas: number; metadata: string | null }) {
  const metadata = parseJsonSafe<JobMetadata>(job.metadata, {
    version: 1,
    assessmentId: '',
    folio: '',
    sourceType: 'image_batch',
    pages: [],
    errors: [],
    reviewResolutions: []
  });
  const pages = Array.isArray(metadata.pages) ? metadata.pages.map((page) => ({
    ...page,
    responses: Array.isArray(page.responses) ? page.responses.map(proyectarRespuestaParaRevisionOmr) : []
  })) : [];
  const accepted = pages.filter((page) => page.scanStatus === 'accepted').length;
  const needsReview = pages.filter((page) => page.scanStatus === 'needs_review').length;
  const rejected = pages.filter((page) => page.scanStatus === 'rejected').length;
  const ignored = pages.filter((page) => page.scanStatus === 'ignored').length;
  const autoGradable = pages.filter((page) => page.autoGradable).length;
  const paginasAnalizadas = pages.filter((page) => page.scanStatus !== 'ignored');
  const averageScore = paginasAnalizadas.length > 0
    ? paginasAnalizadas.reduce((total, page) => total + Math.max(0, Math.min(1, page.confidence)), 0) / paginasAnalizadas.length * 100
    : 0;
  return {
    jobId: job.id,
    assessmentId: metadata.assessmentId,
    sourceType: metadata.sourceType,
    status: job.estado,
    pagesTotal: job.totalHojas,
    pagesProcessed: job.procesadas,
    summary: {
      accepted,
      needsReview,
      rejected,
      ignored,
      autoGradable,
      sheets: pages.length,
      averageScore: Number(averageScore.toFixed(2)),
    finalizedAt: metadata.finalizedAt,
      errors: metadata.errors,
      results: pages.map((page) => ({
        sheetSerial: page.sheetSerial,
        studentId: page.identityResult?.studentId ?? null,
        versionCode: page.versionResult?.versionCode ?? null,
        confidence: page.confidence,
        autoGradable: page.autoGradable
      }))
    },
    pages,
    errors: metadata.errors,
    reviewResolutions: metadata.reviewResolutions
  };
}

async function obtenerJob(docenteId: string, jobId: string) {
  const job = await prisma.omrScanJob.findFirst({ where: { id: jobId, docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  return job;
}

export async function listarJobsOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = esquemaListarJobsOmr.safeParse(req.query);
  if (!filtros.success) throw new ErrorAplicacion('OMR_QUERY_INVALIDA', 'Los filtros de jobs OMR no cumplen el contrato', 400, filtros.error.flatten());
  let cursor: { id: string; createdAt: Date } | undefined;
  if (filtros.data.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(filtros.data.cursor, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
      const createdAt = new Date(String(decoded.createdAt ?? ''));
      if (typeof decoded.id !== 'string' || !decoded.id || !Number.isFinite(createdAt.getTime())) throw new Error('invalid cursor');
      cursor = { id: decoded.id, createdAt };
    } catch {
      throw new ErrorAplicacion('OMR_CURSOR_INVALIDO', 'El cursor de jobs OMR no es válido', 400);
    }
  }
  const where: Record<string, unknown> = {
    docenteId,
    ...(filtros.data.status ? { estado: filtros.data.status } : {}),
    ...(filtros.data.generatedAssessmentId ? { metadata: { contains: `"assessmentId":"${filtros.data.generatedAssessmentId}"` } } : {}),
    ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {})
  };
  const jobs = await prisma.omrScanJob.findMany({ where, take: filtros.data.limite + 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const hasNext = jobs.length > filtros.data.limite;
  const visibles = jobs.slice(0, filtros.data.limite).map((job) => {
    const metadata = parseJsonSafe<JobMetadata>(job.metadata, { version: 1, assessmentId: '', folio: '', sourceType: 'image_batch', pages: [], errors: [], reviewResolutions: [] });
    const pages = Array.isArray(metadata.pages) ? metadata.pages : [];
    return {
      jobId: job.id, workflow: metadata.sourceType ? 'scan' : 'pdf_ingesta', assessmentId: metadata.assessmentId,
      folio: metadata.folio, sourceType: metadata.sourceType ?? 'pdf', status: job.estado,
      pagesTotal: job.totalHojas, pagesProcessed: job.procesadas,
      summary: {
        accepted: pages.filter((page) => page.scanStatus === 'accepted').length,
        needsReview: pages.filter((page) => page.scanStatus === 'needs_review').length,
        rejected: pages.filter((page) => page.scanStatus === 'rejected').length
      },
      createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString()
    };
  });
  const last = hasNext ? jobs[filtros.data.limite - 1] : undefined;
  const nextCursor = last ? Buffer.from(JSON.stringify({ id: last.id, createdAt: last.createdAt.toISOString() }), 'utf8').toString('base64url') : null;
  res.json({ jobs: visibles, nextCursor });
}

export async function obtenerJobOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await obtenerJob(docenteId, String(req.params.jobId || '').trim());
  res.json({ job: toPublicJob(job) });
}

export async function crearJobOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const body = req.body as { generatedAssessmentId: string; sourceType: TipoFuenteOmr; capturas: CapturaOmr[]; clientRequestId?: string };
  const clientRequestId = String(body.clientRequestId || '').trim();
  const requestHash = hashSolicitudJobOmr(body);
  const recuperarReintento = async () => {
    if (!clientRequestId) return false;
    const existente = await prisma.omrScanJob.findFirst({ where: { id: clientRequestId, docenteId } });
    if (!existente) return false;
    const metadataExistente = parseJsonSafe<JobMetadata>(existente.metadata, {
      version: 1, assessmentId: '', folio: '', sourceType: body.sourceType, pages: [], errors: [], reviewResolutions: []
    });
    if (metadataExistente.requestHash !== requestHash) {
      throw new ErrorAplicacion('OMR_IDEMPOTENCY_CONFLICT', 'clientRequestId ya fue usado con otra solicitud OMR', 409);
    }
    res.status(200).json({ job: toPublicJob(existente) });
    return true;
  };
  if (await recuperarReintento()) return;
  const examen = await prisma.examenGenerado.findFirst({ where: { id: body.generatedAssessmentId, docenteId } });
  if (!examen) throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen generado no encontrado', 404);
  const mapaOmr = parseJsonSafe<any>(examen.mapaOmr, null);
  if (Number(examen.omrRuntimeVersion ?? mapaOmr?.templateVersion ?? 0) !== 4 && Number(mapaOmr?.templateVersion ?? 0) !== 4) {
    throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'El examen no corresponde al contrato OMR canónico', 422);
  }

  let job: NonNullable<Awaited<ReturnType<typeof prisma.omrScanJob.findFirst>>>;
  try {
    job = await prisma.omrScanJob.create({
      data: {
        ...(clientRequestId ? { id: clientRequestId } : {}),
        docenteId,
        periodoId: examen.periodoId,
        plantillaId: examen.plantillaId,
        estado: 'processing',
        metadata: JSON.stringify({
          version: 1,
          clientRequestId: clientRequestId || undefined,
          requestHash: clientRequestId ? requestHash : undefined,
          assessmentId: examen.id,
          folio: examen.folio,
          sourceType: body.sourceType,
          pages: [],
          errors: [],
          reviewResolutions: []
        } satisfies JobMetadata)
      }
    });
  } catch (error) {
    // El ID primario impide que dos solicitudes concurrentes creen dos jobs.
    if (clientRequestId && await recuperarReintento()) return;
    throw error;
  }

  const paginasEntrada = await expandirCapturas(body.capturas, body.sourceType);
  const paginas: PaginaJob[] = [];
  const errors: ErrorJob[] = [];
  await prisma.omrScanJob.update({ where: { id: job.id }, data: { totalHojas: paginasEntrada.length } });

  for (const entrada of paginasEntrada) {
    if (entrada.error) {
      errors.push({ pageIndex: entrada.pageIndex, message: entrada.error, nombreArchivo: entrada.nombreArchivo });
      paginas.push({
        sheetSerial: `${examen.folio}-P${entrada.pageIndex}`,
        pageIndex: entrada.pageIndex,
        ...(entrada.nombreArchivo ? { sourceFileName: entrada.nombreArchivo } : {}),
        scanStatus: 'rejected',
        confidence: 0,
        autoGradable: false,
        manualReviewRequired: true,
        responses: [],
        exceptions: [{
          code: 'OMR_PDF_INVALIDO',
          severity: 'blocking',
          message: entrada.error,
          recommendedAction: 'Sustituir la captura por un PDF válido o una imagen legible.'
        }]
      });
      await prisma.omrScanJob.update({ where: { id: job.id }, data: { procesadas: paginas.length } });
      continue;
    }
    const paginaMapa = Array.isArray(mapaOmr?.paginas)
      ? mapaOmr.paginas.find((pagina: { numeroPagina?: number }) => Number(pagina.numeroPagina) === entrada.pageIndex)
      : undefined;
    if (paginaMapa?.tipoPagina === 'reverso-vacio') {
      paginas.push({
        sheetSerial: `${examen.folio}-P${entrada.pageIndex}`,
        pageIndex: entrada.pageIndex,
        pageType: 'reverso-vacio',
        ...(entrada.nombreArchivo ? { sourceFileName: entrada.nombreArchivo } : {}),
        scanStatus: 'ignored',
        confidence: 1,
        autoGradable: false,
        manualReviewRequired: false,
        responses: [],
        exceptions: [{
          code: 'OMR_REVERSO_VACIO',
          severity: 'info',
          message: 'Reverso dúplex vacío omitido: no contiene elementos OMR.',
          recommendedAction: 'No escanear ni calificar esta página.'
        }],
        resultado: {
          estadoAnalisis: 'reverso-vacio',
          calidadPagina: 1,
          ratioAmbiguas: 0
        }
      });
      await prisma.omrScanJob.update({ where: { id: job.id }, data: { procesadas: paginas.length } });
      continue;
    }
    try {
      const payload = await ejecutarAnalisisInterno({ docenteId, folio: examen.folio, numeroPagina: entrada.pageIndex, imagenBase64: entrada.imagenBase64 ?? '' });
      paginas.push(convertirResultadoAPagina(
        examen.folio,
        entrada.pageIndex,
        payload,
        entrada.nombreArchivo,
        mapaOmr?.templateId === 'omr-inline-exam-v1'
      ));
    } catch (error) {
      errors.push({
        pageIndex: entrada.pageIndex,
        message: error instanceof Error ? error.message : 'No se pudo procesar la captura OMR',
        nombreArchivo: entrada.nombreArchivo
      });
      paginas.push({
        sheetSerial: `${examen.folio}-P${entrada.pageIndex}`,
        pageIndex: entrada.pageIndex,
        ...(entrada.nombreArchivo ? { sourceFileName: entrada.nombreArchivo } : {}),
        scanStatus: 'rejected',
        confidence: 0,
        autoGradable: false,
        manualReviewRequired: true,
        responses: [],
        exceptions: [{ code: 'OMR_PROCESSING_ERROR', severity: 'blocking', message: errors[errors.length - 1]?.message ?? 'Error de procesamiento' }]
      });
    }
    await prisma.omrScanJob.update({ where: { id: job.id }, data: { procesadas: paginas.length } });
  }

  const metadata: JobMetadata = { version: 1, clientRequestId: clientRequestId || undefined, requestHash: clientRequestId ? requestHash : undefined, assessmentId: examen.id, folio: examen.folio, sourceType: body.sourceType, pages: paginas, errors, reviewResolutions: [] };
  const actualizado = await prisma.omrScanJob.update({
    where: { id: job.id },
    data: { estado: errors.length === paginas.length ? 'failed' : 'completed', procesadas: paginas.length, completadoEn: new Date(), metadata: JSON.stringify(metadata) }
  });
  res.status(201).json({ job: toPublicJob(actualizado) });
}

export async function resolverHojaOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await obtenerJob(docenteId, String(req.params.jobId || '').trim());
  const body = req.body as { resolutionReason: string; finalIdentity?: Record<string, unknown>; finalResponses?: Array<{ numeroPregunta: number; opcion: string | null }>; overrides?: Record<string, unknown> };
  const metadata = parseJsonSafe<JobMetadata>(job.metadata, { version: 1, assessmentId: '', folio: '', sourceType: 'image_batch', pages: [], errors: [], reviewResolutions: [] });
  const sheetSerial = String(req.params.sheetSerial || '').trim();
  const pagina = metadata.pages.find((item) => item.sheetSerial === sheetSerial);
  if (!pagina) throw new ErrorAplicacion('OMR_HOJA_NO_ENCONTRADA', 'Hoja OMR no encontrada en el job', 404);
  if (pagina.scanStatus === 'ignored' || pagina.pageType === 'reverso-vacio') {
    throw new ErrorAplicacion('OMR_REVERSO_VACIO', 'El reverso vacío no contiene respuestas calificables', 409);
  }
  const identity = String(body.finalIdentity?.studentId ?? '').trim();
  if (body.finalIdentity) pagina.identityResult = { ...(pagina.identityResult ?? {}), ...(identity ? { studentId: identity } : {}) };
  if (Array.isArray(body.finalResponses)) {
    pagina.responses = body.finalResponses.map((item) => {
      const detectada = pagina.responses.find((respuesta) => respuesta.numeroPregunta === item.numeroPregunta);
      return {
        ...(detectada ?? proyectarRespuestaParaRevisionOmr({ numeroPregunta: item.numeroPregunta, opcion: null })),
        opcion: item.opcion,
        opcionDetectada: detectada?.opcionDetectada ?? detectada?.opcion ?? null,
        estadoRespuesta: 'manual_review'
      };
    });
  }
  if (body.overrides && typeof body.overrides.versionCode === 'string') pagina.versionResult = { versionCode: body.overrides.versionCode.trim().toUpperCase() || null };
  pagina.scanStatus = 'accepted';
  pagina.manualReviewRequired = false;
  pagina.autoGradable = true;
  pagina.exceptions = [];
  metadata.reviewResolutions = [...metadata.reviewResolutions, { sheetSerial, resolvedAt: new Date().toISOString(), resolutionReason: body.resolutionReason }];
  const actualizado = await prisma.omrScanJob.update({ where: { id: job.id }, data: { metadata: JSON.stringify(metadata) } });
  res.json({ job: toPublicJob(actualizado) });
}

export async function finalizarJobOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await obtenerJob(docenteId, String(req.params.jobId || '').trim());
  const metadata = parseJsonSafe<JobMetadata>(job.metadata, { version: 1, assessmentId: '', folio: '', sourceType: 'image_batch', pages: [], errors: [], reviewResolutions: [] });
  metadata.finalizedAt = new Date().toISOString();
  const actualizado = await prisma.omrScanJob.update({ where: { id: job.id }, data: { estado: 'finalized', completadoEn: new Date(), metadata: JSON.stringify(metadata) } });
  res.json({ job: toPublicJob(actualizado) });
}
