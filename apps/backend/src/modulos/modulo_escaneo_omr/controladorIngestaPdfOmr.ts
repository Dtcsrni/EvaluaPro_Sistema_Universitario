import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Response } from 'express';
import { PDFDocument } from 'pdf-lib';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { resolverRutaPdfExamen } from '../../infraestructura/archivos/almacenLocal.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { extraerResumenQrExamen } from '../modulo_generacion_pdf/domain/qrExamen.js';
import { rasterizarPdfParaPreview } from '../modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';
import { descargarPdfLoteUseCase } from '../modulo_generacion_pdf/application/usecases/generacionPlantillas.js';
import { analizarImagen } from './controladorEscaneoOmr.js';
import { leerQrDesdeImagen } from './servicioOmr.js';
import { proyectarRespuestaParaRevisionOmr, type RespuestaRevisionOmr } from './omr/decision/respuestaRevision.js';
import { crearLectorPieOmr, leerReferenciaPieOmr, limitarTiempoOcrPie, type LectorPieOmr } from './infra/ocrPieOmr.js';
import { localizarQrsEsperadosEnRaster, prepararQrsEsperados, type GeometriaQrPdf, type QrReferenciaEsperado } from './infra/qrReferenciaPdf.js';
import { MAX_JOB_BYTES, MAX_JOB_PAGES, MAX_PDF_BYTES, MAX_PDF_PAGES } from './limitesIngestaPdfOmr.js';
const PAGE_BLOCK_SIZE = 8;
const RASTER_DPI = 144;

type ArchivoCargado = Express.Multer.File;
type ExamenConRelaciones = Awaited<ReturnType<typeof buscarExamenesLote>>[number];
type PaginaProcesada = {
  sheetSerial: string;
  pageIndex: number;
  sourceFileId: string;
  sourceFileName: string;
  sourcePage: number;
  scanStatus: 'accepted' | 'needs_review' | 'rejected';
  confidence: number;
  autoGradable: false;
  manualReviewRequired: boolean;
  examId?: string;
  folio?: string;
  examPage?: number;
  identitySource?: 'qr' | 'manual';
  ocrSuggestion?: {
    generatedAssessmentId: string;
    folio: string;
    examPage: number;
    confidence: number;
    source: 'ocr_two_position_consensus';
    matchingPositions: 2;
  };
  resolutionReason?: string;
  identityResult?: { studentId: string | null; studentName: string | null };
  responses: RespuestaRevisionOmr[];
  exceptions: Array<{ code: string; severity: 'warning' | 'blocking'; message: string }>;
};
type ArchivoOrigen = { id: string; nombre: string; relativePath: string; sha256: string; bytes: number; pages: number };
type ReferenciaLote = { nombre: string; relativePath: string; sha256: string; pages: number; pagesWithQr: number; pageMap?: Record<string, number[]>; origen?: 'generada' | 'aportada' };
type PaqueteClasificado = {
  id: string;
  examId: string;
  fileName: string;
  relativePath: string;
  sha256: string;
  pageCount: number;
  status: 'complete' | 'needs_review';
  course: string;
  subject: string;
  partial: string;
  teacher: string;
  student: string;
  group: string;
  folio: string;
};
type MetadataIngesta = {
  version: 1;
  retryCount?: number;
  lastRetryRequestId?: string;
  clientRequestId?: string;
  requestHash?: string;
  assessmentId: string;
  loteId: string | null;
  status: 'processing' | 'completed' | 'failed';
  reference: ReferenciaLote;
  files: ArchivoOrigen[];
  pages: PaginaProcesada[];
  packages: PaqueteClasificado[];
  errors: Array<{ fileName: string; code: string }>;
  startedAt: string;
  completedAt?: string;
};

const ingestasPdfActivas = new Set<string>();

async function buscarExamenesLote(assessmentId: string, docenteId: string) {
  const seleccionado = await prisma.examenGenerado.findFirst({
    where: { id: assessmentId, docenteId },
    include: {
      alumno: { select: { id: true, nombreCompleto: true, grupo: true } },
      docente: { select: { nombreCompleto: true } },
      periodo: { select: { nombre: true } },
      plantilla: { select: { titulo: true, tipo: true } }
    }
  });
  if (!seleccionado) throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen generado no encontrado', 404);
  const examenes = seleccionado.loteId
    ? await prisma.examenGenerado.findMany({
        where: { loteId: seleccionado.loteId, docenteId },
        include: {
          alumno: { select: { id: true, nombreCompleto: true, grupo: true } },
          docente: { select: { nombreCompleto: true } },
          periodo: { select: { nombre: true } },
          plantilla: { select: { titulo: true, tipo: true } }
        }
      })
    : [seleccionado];
  return examenes;
}

function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function slug(value: unknown, fallback: string) {
  const normalized = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const clean = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  return clean || fallback;
}

function ubicacionPaquete(jobId: string, exam: ExamenConRelaciones, revisionId?: string) {
  const student = exam.alumno?.nombreCompleto ?? 'alumno-sin-registro';
  const group = exam.alumno?.grupo ?? '';
  const categorias = [
    slug(exam.periodo?.nombre, 'sin-curso'),
    slug(exam.plantilla.titulo, 'sin-materia'),
    slug(exam.plantilla.tipo, 'sin-parcial'),
    slug(exam.docente.nombreCompleto, 'sin-docente'),
    slug(student, 'sin-alumno'),
    slug(group, 'sin-grupo')
  ].map((categoria) => categoria.slice(0, 12));
  // Los componentes acotados mantienen compatibilidad con Windows; el ID
  // canónico evita colisiones entre folios y nombres similares.
  const revision = revisionId ? `-${revisionId}` : '';
  const fileName = `${slug(student, 'alumno-sin-registro').slice(0, 24)}-${slug(exam.folio, 'sin-folio').slice(0, 16)}-${exam.id}${revision}.pdf`;
  return {
    fileName,
    relativePath: path.join(rootJob(jobId), 'clasificados', ...categorias, fileName),
    student,
    group
  };
}

function sha256(buffer: Buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function idJobIngesta(docenteId: string, clientRequestId: string) {
  const hex = createHash('sha256').update(`${docenteId}\n${clientRequestId}`, 'utf8').digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}
async function limpiarArchivosCargados(files: ArchivoCargado[]) {
  await Promise.all(files.map((file) => fs.rm(path.dirname(file.path), { recursive: true, force: true }).catch(() => undefined)));
}

type ResumenExamenLoteArchivadoOmr = { id: string; folio: string; paginas: string; mapaOmr: string | null };
type QrReferenciaOmr = { raw: string; numeroPagina: number; examId?: string; folio: string };

function claveQrExamenPagina(qr: { examId?: string; folio: string; numeroPagina: number }) {
  const identidad = qr.examId ? `id:${qr.examId.toUpperCase()}` : `folio:${qr.folio.toUpperCase()}`;
  return `${identidad}:p${qr.numeroPagina}`;
}

async function indexarQrPdfReferencia(bytes: Buffer, expected: QrReferenciaEsperado[]) {
  const documento = await PDFDocument.load(bytes);
  const paginas = documento.getPageCount();
  if (paginas < 1 || paginas > MAX_PDF_PAGES) {
    throw new ErrorAplicacion('OMR_REFERENCIA_PAGINAS_INVALIDAS', 'El PDF de referencia debe contener de 1 a 600 páginas', 413);
  }
  const qrsPorClave = new Map<string, QrReferenciaOmr[]>();
  let paginasConQrFirmado = 0;
  if (expected.length === 0) return { paginas, paginasConQrFirmado, qrsPorClave };
  const preparedExpected = prepararQrsEsperados(expected);
  for (let desde = 1; desde <= paginas; desde += PAGE_BLOCK_SIZE) {
    const raster = await rasterizarPdfParaPreview(bytes, { dpi: RASTER_DPI, desdePagina: desde, cantidadPaginas: PAGE_BLOCK_SIZE });
    for (const pagina of raster.paginas) {
      const [, encoded = ''] = pagina.dataUrl.split(',', 2);
      if (!encoded) continue;
      const { data, info } = await sharp(Buffer.from(encoded, 'base64')).greyscale().raw().toBuffer({ resolveWithObject: true });
      const page = documento.getPage(pagina.numero - 1);
      const encontrados = localizarQrsEsperadosEnRaster({
        grayscale: data,
        width: info.width,
        height: info.height,
        pageWidthPoints: page.getWidth(),
        pageHeightPoints: page.getHeight(),
        expected,
        preparedExpected
      });
      if (encontrados.length !== 1) continue;
      const qr = extraerResumenQrExamen(encontrados[0]!.raw);
      if (!qr || qr.payloadSignatureValid !== true || !Number.isInteger(qr.numeroPagina) || qr.numeroPagina < 1 || !qr.folio) continue;
      paginasConQrFirmado += 1;
      const clave = claveQrExamenPagina(qr);
      const ocurrencias = qrsPorClave.get(clave) ?? [];
      ocurrencias.push({ raw: qr.raw, numeroPagina: pagina.numero, examId: qr.examId, folio: qr.folio });
      qrsPorClave.set(clave, ocurrencias);
    }
  }
  return { paginas, paginasConQrFirmado, qrsPorClave };
}

function construirQrEsperadosLote(examenes: ResumenExamenLoteArchivadoOmr[]) {
  const esperados = new Map<string, string>();
  const referencias: QrReferenciaEsperado[] = [];
  let estructuraValida = examenes.length > 0;
  for (const examen of examenes) {
    const paginas = json<Array<{ numero?: unknown; qrTexto?: unknown }>>(examen.paginas, []);
    const mapaOmr = json<{ paginas?: Array<{ numeroPagina?: unknown; qr?: GeometriaQrPdf }> }>(examen.mapaOmr, {});
    if (!Array.isArray(paginas) || paginas.length === 0) estructuraValida = false;
    for (const pagina of paginas) {
      const numero = Number(pagina?.numero);
      const raw = String(pagina?.qrTexto ?? '').trim();
      const qr = extraerResumenQrExamen(raw);
      if (!raw || !qr || qr.payloadSignatureValid !== true || qr.folio.toUpperCase() !== examen.folio.toUpperCase() || qr.numeroPagina !== numero || !Number.isInteger(numero) || numero < 1) {
        estructuraValida = false;
        continue;
      }
      const clave = claveQrExamenPagina(qr);
      if (esperados.has(clave)) estructuraValida = false;
      esperados.set(clave, raw);
      const geometry = mapaOmr.paginas?.find((item) => Number(item.numeroPagina) === numero)?.qr;
      if (!geometry || !Number.isFinite(geometry.x) || !Number.isFinite(geometry.y) || !Number.isFinite(geometry.size)) {
        estructuraValida = false;
        continue;
      }
      referencias.push({ key: clave, raw, geometry });
    }
  }
  return { esperados, referencias, estructuraValida };
}

function evaluarIndiceQrReferencia(
  indexado: Awaited<ReturnType<typeof indexarQrPdfReferencia>>,
  esperados: Map<string, string>
) {
  let paginasCoincidentes = 0;
  for (const [clave, rawEsperado] of esperados) {
    const encontradas = indexado.qrsPorClave.get(clave) ?? [];
    if (encontradas.length === 1 && encontradas[0]?.raw === rawEsperado) paginasCoincidentes += 1;
  }
  const exacta = esperados.size > 0
    && indexado.paginas === esperados.size
    && indexado.paginasConQrFirmado === esperados.size
    && indexado.qrsPorClave.size === esperados.size
    && paginasCoincidentes === esperados.size;
  return { exacta, paginasCoincidentes };
}

export async function prevalidarReferenciaIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const archivos = req.files as Record<string, ArchivoCargado[]> | ArchivoCargado[] | undefined;
  const archivosCaptura = Array.isArray(archivos) ? archivos : archivos?.archivos ?? [];
  const referencia = Array.isArray(archivos) ? undefined : archivos?.referencia?.[0];
  const cargados = [...archivosCaptura, ...(referencia ? [referencia] : [])];
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Authorization');
    if (archivosCaptura.length > 0 || !referencia) {
      throw new ErrorAplicacion('OMR_REFERENCIA_ENTRADA_INVALIDA', 'Adjunta únicamente un PDF en el campo referencia', 400);
    }
    if (referencia.size <= 0 || referencia.size > MAX_PDF_BYTES) {
      throw new ErrorAplicacion('OMR_PDF_TAMANO_INVALIDO', 'El PDF de referencia debe pesar como máximo 120 MiB', 413);
    }
    const bytes = await fs.readFile(referencia.path);
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new ErrorAplicacion('OMR_REFERENCIA_PDF_INVALIDO', 'El archivo de referencia no tiene una cabecera PDF válida', 400);
    }
    const assessmentIds = (req.body as { assessmentIds?: string[] }).assessmentIds ?? [];
    const seleccionados = await prisma.examenGenerado.findMany({
      where: { id: { in: assessmentIds }, docenteId },
      select: { id: true, loteId: true }
    });
    const seleccionadosPorId = new Map(seleccionados.map((seleccionado) => [seleccionado.id, seleccionado]));
    const lotes = new Map<string, { assessmentId: string; examenes: ResumenExamenLoteArchivadoOmr[]; esperados: Map<string, string>; referencias: QrReferenciaEsperado[] }>();
    // Prisma no garantiza que findMany conserve el orden de `where.id.in`.
    // La respuesta usa como representante el primer candidato recibido para
    // cada lote, de modo que el assessmentId sea determinista para GUI y API.
    for (const assessmentId of assessmentIds) {
      const seleccionado = seleccionadosPorId.get(assessmentId);
      if (!seleccionado) continue;
      if (!seleccionado.loteId || lotes.has(seleccionado.loteId)) continue;
      const examenes = await prisma.examenGenerado.findMany({
        where: { docenteId, loteId: seleccionado.loteId },
        select: { id: true, folio: true, paginas: true, mapaOmr: true }
      });
      const { esperados, referencias, estructuraValida } = construirQrEsperadosLote(examenes);
      if (estructuraValida && esperados.size > 0 && referencias.length === esperados.size) {
        lotes.set(seleccionado.loteId, { assessmentId: seleccionado.id, examenes, esperados, referencias });
      }
    }
    const referencias = [...new Map([...lotes.values()].flatMap((lote) => lote.referencias).map((qr) => [qr.key, qr])).values()];
    let indexado: Awaited<ReturnType<typeof indexarQrPdfReferencia>>;
    try { indexado = await indexarQrPdfReferencia(bytes, referencias); }
    catch (error) {
      if (error instanceof ErrorAplicacion) throw error;
      throw new ErrorAplicacion('OMR_REFERENCIA_PDF_INVALIDO', 'No se pudo analizar el PDF de referencia', 400);
    }

    const coincidencias: Array<{ assessmentId: string; loteId: string; examCount: number; expectedPages: number; matchedPages: number }> = [];
    for (const [loteId, lote] of lotes) {
      const { exacta, paginasCoincidentes } = evaluarIndiceQrReferencia(indexado, lote.esperados);
      if (exacta) coincidencias.push({ assessmentId: lote.assessmentId, loteId, examCount: lote.examenes.length, expectedPages: lote.esperados.size, matchedPages: paginasCoincidentes });
    }
    res.status(200).json({
      reference: { pages: indexado.paginas, pagesWithSignedQr: indexado.paginasConQrFirmado, sha256: sha256(bytes) },
      candidatesEvaluated: assessmentIds.length,
      matches: coincidencias
    });
  } finally {
    await limpiarArchivosCargados(cargados);
  }
}

function rootJob(jobId: string) { return path.join('omr-ingestas', jobId); }
function relativeStoredPath(value: string) { return path.join(...value.split(/[\\/]+/).filter(Boolean)); }
function resolverRutaIngesta(jobId: string, relativePath: string) {
  const root = path.resolve(resolverRutaPdfExamen(rootJob(jobId)));
  const resolved = path.resolve(resolverRutaPdfExamen(relativeStoredPath(relativePath)));
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) throw new ErrorAplicacion('OMR_RUTA_INVALIDA', 'Ruta de archivo OMR inválida', 400);
  return resolved;
}

function errorPage(index: number, fileId: string, fileName: string, sourcePage: number, code: string, message: string): PaginaProcesada {
  return {
    sheetSerial: `PENDIENTE-${index}`,
    pageIndex: index,
    sourceFileId: fileId,
    sourceFileName: fileName,
    sourcePage,
    scanStatus: 'needs_review',
    confidence: 0,
    autoGradable: false,
    manualReviewRequired: true,
    responses: [],
    exceptions: [{ code, severity: 'warning', message }]
  };
}

function analizarImagenPromesa(params: { docenteId: string; folio: string; numeroPagina: number; imagenBase64: string }) {
  return new Promise<any>((resolve, reject) => {
    const req = { body: { folio: params.folio, numeroPagina: params.numeroPagina, imagenBase64: params.imagenBase64 }, docenteId: params.docenteId } as unknown as SolicitudDocente;
    const res = { json(payload: unknown) { resolve(payload); return res; } } as unknown as Response;
    void analizarImagen(req, res).catch(reject);
  });
}

async function leerQrEnOrientacionExacta(
  dataUrl: string,
  examenes: Map<string, ExamenConRelaciones>,
  examenesPorFolio: Map<string, ExamenConRelaciones>,
  referenciaQr: Map<string, Set<string>>
) {
  const originalBuffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  let primeraLectura: { qr: ReturnType<typeof extraerResumenQrExamen> } | undefined;
  for (const grados of [0, 90, 180, 270]) {
    const rotado = grados === 0 ? originalBuffer : await sharp(originalBuffer).rotate(grados).png().toBuffer();
    const imagen = grados === 0 ? dataUrl : `data:image/png;base64,${rotado.toString('base64')}`;
    let texto: string | undefined;
    try { texto = await leerQrDesdeImagen(imagen); } catch { texto = undefined; }
    const qr = extraerResumenQrExamen(texto);
    if (!primeraLectura) primeraLectura = { qr };
    if (!qr || qr.payloadSignatureValid !== true) continue;
    const exam = qr.examId ? examenes.get(qr.examId.toUpperCase()) : examenesPorFolio.get(qr.folio.toUpperCase());
    if (!exam || exam.folio.toUpperCase() !== qr.folio.toUpperCase()) continue;
    const pageSpecs = json<any[]>(exam.paginas, []);
    const map = json<any>(exam.mapaOmr, null);
    const exactos = [
      pageSpecs.find((page) => Number(page.numero) === qr.numeroPagina)?.qrTexto,
      map?.paginas?.find((page: any) => Number(page.numeroPagina) === qr.numeroPagina)?.qr?.texto
    ].filter((value) => typeof value === 'string' && value.length > 0);
    const clave = `${exam.id.toUpperCase()}:${qr.numeroPagina}`;
    if (exactos.some((esperado) => esperado === qr.raw) && referenciaQr.get(clave)?.has(qr.raw)) {
      return { qr, grados };
    }
  }
  return { qr: primeraLectura?.qr, grados: 0 };
}

function serializarEstado(job: { id: string; estado: string; totalHojas: number; procesadas: number; metadata: string | null }) {
  const meta = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  const accepted = meta.pages.filter((page) => page.scanStatus === 'accepted').length;
  const needsReview = meta.pages.filter((page) => page.scanStatus === 'needs_review').length;
  const rejected = meta.pages.filter((page) => page.scanStatus === 'rejected').length;
  return {
    jobId: job.id,
    sourceType: 'pdf' as const,
    status: job.estado,
    pagesTotal: job.totalHojas,
    pagesProcessed: job.procesadas,
    summary: { accepted, needsReview, rejected, packages: meta.packages.length },
    reference: { sha256: meta.reference.sha256, pages: meta.reference.pages, pagesWithQr: meta.reference.pagesWithQr, origen: meta.reference.origen ?? 'generada' },
    pages: meta.pages.map((page) => ({
      ...page,
      responses: Array.isArray(page.responses) ? page.responses.map(proyectarRespuestaParaRevisionOmr) : []
    })),
    packages: meta.packages,
    errors: meta.errors,
    files: meta.files.map(({ id, nombre, bytes, pages, sha256: digest }) => ({ id, nombre, bytes, pages, sha256: digest })),
    startedAt: meta.startedAt,
    completedAt: meta.completedAt
  };
}

function iniciarProcesamientoIngesta(jobId: string, docenteId: string, examenes: ExamenConRelaciones[], metadata: MetadataIngesta) {
  if (ingestasPdfActivas.has(jobId)) return;
  ingestasPdfActivas.add(jobId);
  void procesarIngesta(jobId, docenteId, examenes, metadata)
    .catch(async (error: unknown) => {
      metadata.status = 'failed';
      metadata.errors.push({ fileName: 'job', code: error instanceof ErrorAplicacion ? error.codigo : 'OMR_INGESTA_FAILED' });
      metadata.completedAt = new Date().toISOString();
      await prisma.omrScanJob.update({ where: { id: jobId }, data: { estado: 'failed', completadoEn: new Date(), metadata: JSON.stringify(metadata) } }).catch(() => undefined);
    })
    .finally(() => { ingestasPdfActivas.delete(jobId); });
}

export async function crearIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const assessmentId = String(req.body?.generatedAssessmentId ?? '').trim();
  const clientRequestId = String(req.body?.clientRequestId ?? '').trim();
  const archivosMultipart = req.files as Record<string, ArchivoCargado[]> | ArchivoCargado[] | undefined;
  const files = (Array.isArray(archivosMultipart) ? archivosMultipart : archivosMultipart?.archivos ?? []) as ArchivoCargado[];
  const archivoReferencia = Array.isArray(archivosMultipart) ? undefined : archivosMultipart?.referencia?.[0];
  const archivosCargados = archivoReferencia ? [...files, archivoReferencia] : files;
  if (!assessmentId || !clientRequestId || files.length === 0) {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_PDF_ENTRADA_INVALIDA', 'Envía generatedAssessmentId, clientRequestId UUID y al menos un PDF', 400);
  }
  if (archivosCargados.some((file) => file.size <= 0 || file.size > MAX_PDF_BYTES) || archivosCargados.reduce((total, file) => total + file.size, 0) > MAX_JOB_BYTES) {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_PDF_TAMANO_INVALIDO', 'El ingreso supera los límites de 120 MB por archivo o 250 MB por job', 413);
  }

  let examenes: ExamenConRelaciones[];
  try {
    examenes = await buscarExamenesLote(assessmentId, docenteId);
  } catch (error) {
    await limpiarArchivosCargados(archivosCargados);
    throw error;
  }
  const seleccionado = examenes.find((exam) => exam.id === assessmentId)!;
  const loteIdConsolidado = seleccionado.origenGeneracion === 'lote' ? seleccionado.loteId : null;
  let artefactoReferencia: Awaited<ReturnType<typeof prisma.examenLoteArtefactoPdf.findFirst>>;
  try {
    artefactoReferencia = loteIdConsolidado
      ? await prisma.examenLoteArtefactoPdf.findFirst({ where: { docenteId, loteId: loteIdConsolidado } })
      : null;
  } catch (error) {
    await limpiarArchivosCargados(archivosCargados);
    throw error;
  }
  let nombreReferencia = path.basename(String(artefactoReferencia?.archivoNombre ?? seleccionado.rutaPdf ?? '').trim());
  let bytesReferencia: Buffer | null;
  try {
    if (archivoReferencia) {
      bytesReferencia = await fs.readFile(archivoReferencia.path);
      nombreReferencia = path.basename(archivoReferencia.originalname || 'referencia-lote.pdf');
    } else if (loteIdConsolidado && !artefactoReferencia) {
      const paquete = await descargarPdfLoteUseCase({ docenteId, loteId: loteIdConsolidado });
      nombreReferencia = path.basename(paquete.fileName);
      bytesReferencia = paquete.buffer;
      if (sha256(bytesReferencia).toLowerCase() !== paquete.pdfSha256.toLowerCase()) {
        throw new ErrorAplicacion('OMR_REFERENCIA_HASH_INVALIDO', 'El PDF consolidado no coincide con la huella calculada para el lote', 409);
      }
    } else {
      if (!nombreReferencia) {
        throw new ErrorAplicacion('OMR_REFERENCIA_NO_DISPONIBLE', 'No existe el PDF generado de referencia para este examen/lote', 409);
      }
      bytesReferencia = await fs.readFile(resolverRutaPdfExamen(nombreReferencia)).catch(() => null);
      if (!bytesReferencia) {
        throw new ErrorAplicacion('OMR_REFERENCIA_NO_DISPONIBLE', 'No se pudo abrir el PDF generado de referencia', 409);
      }
    }
  } catch (error) {
    await limpiarArchivosCargados(archivosCargados);
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion('OMR_REFERENCIA_NO_DISPONIBLE', 'No se pudo recuperar y validar el PDF generado del lote', 409);
  }
  if (!bytesReferencia || !nombreReferencia) {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_REFERENCIA_NO_DISPONIBLE', 'No se pudo abrir el PDF generado de referencia', 409);
  }
  const hashReferencia = sha256(bytesReferencia);
  if (artefactoReferencia?.sha256 && hashReferencia.toLowerCase() !== artefactoReferencia.sha256.toLowerCase()) {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_REFERENCIA_HASH_INVALIDO', 'El PDF de referencia no coincide con el hash registrado para el lote', 409);
  }
  if (bytesReferencia.subarray(0, 5).toString('ascii') !== '%PDF-') {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_REFERENCIA_PDF_INVALIDO', 'El PDF de referencia no tiene una cabecera válida', 400);
  }
  let paginasReferencia: number;
  try {
    paginasReferencia = (await PDFDocument.load(bytesReferencia)).getPageCount();
  } catch {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_REFERENCIA_PDF_INVALIDO', 'El PDF de referencia no se pudo analizar', 400);
  }
  if (paginasReferencia < 1 || paginasReferencia > MAX_PDF_PAGES) {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_REFERENCIA_PAGINAS_INVALIDAS', 'El PDF de referencia debe contener de 1 a 600 páginas', 413);
  }
  if (artefactoReferencia && paginasReferencia !== artefactoReferencia.totalPaginas) {
    await limpiarArchivosCargados(archivosCargados);
    throw new ErrorAplicacion('OMR_REFERENCIA_PAGINAS_INVALIDAS', 'El PDF generado no coincide con el conteo registrado para el lote', 409);
  }
  for (const exam of examenes) {
    const mapa = json<any>(exam.mapaOmr, null);
    if (Number(exam.omrRuntimeVersion ?? mapa?.templateVersion ?? 0) !== 4 || Number(mapa?.templateVersion ?? 0) !== 4) {
      await limpiarArchivosCargados(archivosCargados);
      throw new ErrorAplicacion('OMR_TEMPLATE_NO_COMPATIBLE', 'El lote contiene una plantilla que no es compatible con OMR v4', 422);
    }
  }

  const jobId = idJobIngesta(docenteId, clientRequestId);
  const archivosPreparados: Array<ArchivoOrigen & { tempPath: string }> = [];
  try {
    let totalPaginas = 0;
    for (const [index, file] of files.entries()) {
      const bytes = await fs.readFile(file.path);
      if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new ErrorAplicacion('OMR_PDF_INVALIDO', 'Uno de los archivos no tiene una cabecera PDF válida', 400);
      const paginas = (await PDFDocument.load(bytes)).getPageCount();
      if (paginas < 1 || paginas > MAX_PDF_PAGES || totalPaginas + paginas > MAX_JOB_PAGES) {
        throw new ErrorAplicacion('OMR_PDF_PAGINAS_INVALIDAS', 'El ingreso supera 600 páginas por archivo o por job', 413);
      }
      totalPaginas += paginas;
      const nombre = path.basename(file.originalname || `captura-${index + 1}.pdf`).slice(0, 180);
      const relativePath = path.join(rootJob(jobId), 'originales', `${String(index + 1).padStart(2, '0')}-${randomUUID()}-${slug(nombre, 'captura')}.pdf`);
      archivosPreparados.push({ id: String(index + 1), nombre, relativePath, sha256: sha256(bytes), bytes: bytes.length, pages: paginas, tempPath: file.path });
    }
  } catch (error) {
    await limpiarArchivosCargados(archivosCargados);
    throw error;
  }
  const requestHash = sha256(Buffer.from(JSON.stringify({
    assessmentId: seleccionado.id,
    loteId: seleccionado.loteId ?? null,
    referenceSha256: hashReferencia,
    files: archivosPreparados.map(({ nombre, sha256: digest, bytes, pages }) => ({ nombre, sha256: digest, bytes, pages }))
  }), 'utf8'));
  const existente = await prisma.omrScanJob.findFirst({ where: { id: jobId, docenteId } });
  if (existente) {
    await limpiarArchivosCargados(archivosCargados);
    const metaExistente = json<MetadataIngesta>(existente.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
    if (metaExistente.clientRequestId !== clientRequestId || metaExistente.requestHash !== requestHash) {
      throw new ErrorAplicacion('OMR_INGESTA_IDEMPOTENCY_CONFLICT', 'clientRequestId ya fue usado con otro PDF o referencia', 409);
    }
    return res.status(200).json({ job: serializarEstado(existente) });
  }
  const metadata: MetadataIngesta = {
    version: 1,
    clientRequestId,
    requestHash,
    assessmentId: seleccionado.id,
    loteId: seleccionado.loteId ?? null,
    status: 'processing',
    reference: { nombre: nombreReferencia, relativePath: path.join(rootJob(jobId), 'referencia', `${randomUUID()}-${slug(nombreReferencia, 'lote')}.pdf`), sha256: hashReferencia, pages: paginasReferencia, pagesWithQr: 0, origen: archivoReferencia ? 'aportada' : 'generada' },
    files: archivosPreparados.map(({ tempPath, ...archivo }) => {
      void tempPath;
      return archivo;
    }),
    pages: [],
    packages: [],
    errors: [],
    startedAt: new Date().toISOString()
  };
  try {
    await prisma.omrScanJob.create({
      data: {
        id: jobId,
        docenteId,
        periodoId: seleccionado.periodoId,
        plantillaId: seleccionado.plantillaId,
        estado: 'processing',
        metadata: JSON.stringify(metadata)
      }
    });
  } catch (error) {
    const ganador = await prisma.omrScanJob.findFirst({ where: { id: jobId, docenteId } });
    await limpiarArchivosCargados(archivosCargados);
    if (ganador) {
      const ganadorMetadata = json<MetadataIngesta>(ganador.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
      if (ganadorMetadata.clientRequestId === clientRequestId && ganadorMetadata.requestHash === requestHash) return res.status(200).json({ job: serializarEstado(ganador) });
      throw new ErrorAplicacion('OMR_INGESTA_IDEMPOTENCY_CONFLICT', 'clientRequestId ya fue usado con otro PDF o referencia', 409);
    }
    throw error;
  }

  try {
    const referencePath = resolverRutaIngesta(jobId, metadata.reference.relativePath);
    await fs.mkdir(path.dirname(referencePath), { recursive: true });
    await fs.writeFile(referencePath, bytesReferencia);
    for (const archivo of archivosPreparados) {
      const storedPath = resolverRutaIngesta(jobId, archivo.relativePath);
      await fs.mkdir(path.dirname(storedPath), { recursive: true });
      await fs.copyFile(archivo.tempPath, storedPath);
    }
  } catch (error) {
    await prisma.omrScanJob.update({ where: { id: jobId }, data: { estado: 'failed', completadoEn: new Date(), metadata: JSON.stringify({ ...metadata, status: 'failed', errors: [{ fileName: 'upload', code: error instanceof ErrorAplicacion ? error.codigo : 'OMR_PDF_UPLOAD_FAILED' }] }) } });
    throw error;
  } finally {
    await limpiarArchivosCargados(archivosCargados);
  }

  await prisma.omrScanJob.update({ where: { id: jobId }, data: { totalHojas: metadata.files.reduce((total, file) => total + file.pages, 0), metadata: JSON.stringify(metadata) } });
  res.status(202).json({ job: serializarEstado({ id: jobId, estado: 'processing', totalHojas: metadata.files.reduce((total, file) => total + file.pages, 0), procesadas: 0, metadata: JSON.stringify(metadata) }) });
  iniciarProcesamientoIngesta(jobId, docenteId, examenes, metadata);
}

export async function reintentarIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const jobId = String(req.params.jobId || '');
  const job = await prisma.omrScanJob.findFirst({ where: { id: jobId, docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  const clientRequestId = String(req.body?.clientRequestId ?? '').trim();
  if (clientRequestId && metadata.lastRetryRequestId === clientRequestId) return res.status(200).json({ job: serializarEstado(job) });
  if (job.estado !== 'failed' || ingestasPdfActivas.has(jobId)) {
    throw new ErrorAplicacion('OMR_INGESTA_NO_REINTENTABLE', 'Solo se puede reintentar una ingesta fallida e inactiva', 409);
  }
  if (metadata.status !== 'failed' || !metadata.files.length || !metadata.reference.relativePath) {
    throw new ErrorAplicacion('OMR_INGESTA_NO_REINTENTABLE', 'La ingesta no conserva archivos completos para reintento', 409);
  }

  const examenes = await buscarExamenesLote(metadata.assessmentId, docenteId);
  if (!examenes.some((exam) => exam.id === metadata.assessmentId)) throw new ErrorAplicacion('OMR_EXAMEN_FUERA_DE_LOTE', 'El examen del job ya no pertenece al docente', 409);
  for (const archivo of metadata.files) {
    const original = await fs.readFile(resolverRutaIngesta(jobId, archivo.relativePath)).catch(() => null);
    if (!original || sha256(original) !== archivo.sha256 || original.byteLength !== archivo.bytes) {
      throw new ErrorAplicacion('OMR_ORIGINAL_HASH_INVALIDO', `El original ${archivo.nombre} falta o su hash cambió`, 409);
    }
    if (original.subarray(0, 5).toString('ascii') !== '%PDF-' || (await PDFDocument.load(original)).getPageCount() !== archivo.pages) {
      throw new ErrorAplicacion('OMR_ORIGINAL_PDF_INVALIDO', `El original ${archivo.nombre} ya no coincide con la estructura registrada`, 409);
    }
  }
  const referencia = await fs.readFile(resolverRutaIngesta(jobId, metadata.reference.relativePath)).catch(() => null);
  if (!referencia || sha256(referencia) !== metadata.reference.sha256 || referencia.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new ErrorAplicacion('OMR_REFERENCIA_HASH_INVALIDO', 'El PDF de referencia falta o su hash cambió', 409);
  }
  if ((await PDFDocument.load(referencia)).getPageCount() !== metadata.reference.pages) {
    throw new ErrorAplicacion('OMR_REFERENCIA_PAGINAS_INVALIDAS', 'El PDF de referencia ya no coincide con el conteo registrado', 409);
  }

  const reintento: MetadataIngesta = {
    ...metadata,
    retryCount: (metadata.retryCount ?? 0) + 1,
    lastRetryRequestId: clientRequestId,
    status: 'processing',
    reference: { ...metadata.reference },
    // Una interrupción de proceso conserva las páginas ya persistidas. El loop
    // las omite y continúa desde la primera página que falta.
    pages: metadata.errors.some((error) => error.code === 'OMR_INGESTA_PROCESO_INTERRUMPIDO') ? metadata.pages : [],
    packages: [],
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: undefined
  };
  const claim = await prisma.omrScanJob.updateMany({
    where: { id: jobId, docenteId, estado: 'failed' },
    data: { estado: 'processing', procesadas: reintento.pages.length, iniciadoEn: new Date(), completadoEn: null, metadata: JSON.stringify(reintento) }
  });
  if (claim.count !== 1) throw new ErrorAplicacion('OMR_INGESTA_NO_REINTENTABLE', 'El estado cambió; actualiza el job antes de reintentar', 409);

  try {
    await fs.rm(resolverRutaIngesta(jobId, path.join(rootJob(jobId), 'clasificados')), { recursive: true, force: true });
    await fs.rm(resolverRutaIngesta(jobId, path.join(rootJob(jobId), 'manifest.json')), { force: true });
  } catch (error) {
    reintento.status = 'failed';
    reintento.errors.push({ fileName: 'job', code: 'OMR_DERIVADOS_NO_LIMPIADOS' });
    await prisma.omrScanJob.update({ where: { id: jobId }, data: { estado: 'failed', completadoEn: new Date(), metadata: JSON.stringify(reintento) } });
    throw error;
  }

  iniciarProcesamientoIngesta(jobId, docenteId, examenes, reintento);
  res.status(202).json({ job: serializarEstado({ ...job, estado: 'processing', procesadas: reintento.pages.length, metadata: JSON.stringify(reintento) }) });
}

async function procesarIngesta(jobId: string, docenteId: string, examenes: ExamenConRelaciones[], metadata: MetadataIngesta) {
  const examenesPorId = new Map(examenes.map((exam) => [exam.id.toUpperCase(), exam]));
  const examenesPorFolio = new Map(examenes.map((exam) => [exam.folio.toUpperCase(), exam]));
  const referenciaQr = new Map<string, Set<string>>();
  const paginaReferenciaPorExamen = new Map<string, number[]>();
  const rutaPdfReferencia = resolverRutaIngesta(jobId, metadata.reference.relativePath);
  const bytesPdfReferencia = await fs.readFile(rutaPdfReferencia);
  if (sha256(bytesPdfReferencia) !== metadata.reference.sha256) throw new Error('OMR_REFERENCE_HASH_CHANGED');
  const loteQr = construirQrEsperadosLote(examenes.map((exam) => ({
    id: exam.id,
    folio: exam.folio,
    paginas: exam.paginas,
    mapaOmr: exam.mapaOmr
  })));
  const pageMapPersistido = metadata.reference.pageMap;
  const clavesEsperadas = [...loteQr.esperados.keys()];
  const mapaPersistidoCompleto = Boolean(pageMapPersistido)
    && clavesEsperadas.length > 0
    && clavesEsperadas.every((clave) => pageMapPersistido?.[clave]?.length === 1)
    && Object.keys(pageMapPersistido ?? {}).length === clavesEsperadas.length
    && metadata.reference.pagesWithQr === clavesEsperadas.length;
  const indiceReferencia = mapaPersistidoCompleto
    ? null
    : await indexarQrPdfReferencia(bytesPdfReferencia, loteQr.referencias);
  const coincidenciaReferencia = indiceReferencia
    ? evaluarIndiceQrReferencia(indiceReferencia, loteQr.esperados)
    : { exacta: true };
  for (const exam of examenes) {
    for (const pagina of json<Array<{ numero?: unknown; qrTexto?: unknown }>>(exam.paginas, [])) {
      const raw = String(pagina?.qrTexto ?? '').trim();
      const qr = extraerResumenQrExamen(raw);
      const numero = Number(pagina?.numero);
      if (!raw || !qr || !Number.isInteger(numero) || numero < 1) continue;
      const clave = claveQrExamenPagina(qr);
      const paginasEncontradas = indiceReferencia
        ? indiceReferencia.qrsPorClave.get(clave)?.filter((item) => item.raw === raw).map((item) => item.numeroPagina) ?? []
        : mapaPersistidoCompleto ? pageMapPersistido?.[`${exam.id.toUpperCase()}:${numero}`] ?? [] : [];
      if (paginasEncontradas.length !== 1) continue;
      const key = `${exam.id.toUpperCase()}:${numero}`;
      referenciaQr.set(key, new Set([raw]));
      paginaReferenciaPorExamen.set(key, paginasEncontradas);
    }
  }
  if (indiceReferencia) {
    metadata.reference.pagesWithQr = indiceReferencia.paginasConQrFirmado;
    metadata.reference.pageMap = Object.fromEntries(paginaReferenciaPorExamen);
  }
  if (metadata.reference.origen === 'aportada' && (!loteQr.estructuraValida || !coincidenciaReferencia.exacta)) {
    throw new ErrorAplicacion('OMR_REFERENCIA_NO_COINCIDE_LOTE', 'El PDF de referencia no contiene exactamente todas las páginas QR firmadas del lote seleccionado.', 409);
  }
  let globalIndex = 0;
  const paginasPersistidas = metadata.pages.length;
  let lectorOcr: LectorPieOmr | null = null;
  let ocrDeshabilitado = false;
  try {
  for (const file of metadata.files) {
    const storedPath = resolverRutaIngesta(jobId, file.relativePath);
    const original = await fs.readFile(storedPath);
    const pagesAlreadyProcessed = Math.min(file.pages, Math.max(0, paginasPersistidas - globalIndex));
    globalIndex += pagesAlreadyProcessed;
    for (let start = pagesAlreadyProcessed + 1; start <= file.pages; start += PAGE_BLOCK_SIZE) {
      const raster = await rasterizarPdfParaPreview(original, { dpi: RASTER_DPI, desdePagina: start, cantidadPaginas: PAGE_BLOCK_SIZE });
      for (const image of raster.paginas) {
        globalIndex += 1;
        const { qr, grados: gradosQr } = await leerQrEnOrientacionExacta(image.dataUrl, examenesPorId, examenesPorFolio, referenciaQr);
        const exam = qr?.examId ? examenesPorId.get(qr.examId.toUpperCase()) : qr ? examenesPorFolio.get(qr.folio.toUpperCase()) : undefined;
        if (!qr || qr.payloadSignatureValid !== true || !exam || exam.folio.toUpperCase() !== qr.folio.toUpperCase()) {
          const paginaPendiente = errorPage(globalIndex, file.id, file.nombre, image.numero, 'OMR_QR_NO_VALIDO_O_FUERA_DE_LOTE', 'El QR no se validó dentro del lote seleccionado; clasificar manualmente.');
          try {
            if (ocrDeshabilitado) {
              metadata.pages.push(paginaPendiente);
              await prisma.omrScanJob.update({ where: { id: jobId }, data: { procesadas: globalIndex, metadata: JSON.stringify(metadata) } });
              continue;
            }
            lectorOcr ??= await crearLectorPieOmr();
            const referenciaOcr = await limitarTiempoOcrPie(leerReferenciaPieOmr(image.dataUrl, lectorOcr));
            const examenSugerido = referenciaOcr
              ? examenesPorFolio.get(referenciaOcr.folio.toUpperCase())
              : undefined;
            const mapaSugerido = examenSugerido ? json<any>(examenSugerido.mapaOmr, null) : null;
            const paginaMapaSugerida = mapaSugerido?.paginas?.find((pagina: any) =>
              Number(pagina.numeroPagina) === referenciaOcr?.numeroPagina && pagina.tipoPagina !== 'reverso-vacio'
            );
            const paginaExamenSugerida = json<any[]>(examenSugerido?.paginas, []).find((pagina) =>
              Number(pagina.numero) === referenciaOcr?.numeroPagina
            );
            if (
              referenciaOcr
              && examenSugerido
              && examenSugerido.folio.toUpperCase() === referenciaOcr.folio.toUpperCase()
              && paginaMapaSugerida
              && paginaExamenSugerida
            ) {
              paginaPendiente.ocrSuggestion = {
                generatedAssessmentId: examenSugerido.id,
                folio: examenSugerido.folio,
                examPage: referenciaOcr.numeroPagina,
                confidence: referenciaOcr.confianza,
                source: 'ocr_two_position_consensus',
                matchingPositions: 2
              };
              paginaPendiente.exceptions.push({
                code: 'OMR_OCR_IDENTIDAD_SUGERIDA',
                severity: 'warning',
                message: `Dos lecturas OCR coinciden en el folio ${examenSugerido.folio}, página ${referenciaOcr.numeroPagina} (confianza mínima ${referenciaOcr.confianza}%). Confirma contra el original; no valida el QR ni clasifica automáticamente.`
              });
            }
          } catch (error) {
            // OCR es auxiliar: un fallo nunca invalida el job ni cambia el estado QR.
            if ((error as { code?: unknown })?.code === 'OMR_OCR_TIMEOUT') {
              ocrDeshabilitado = true;
              const lectorInterrumpido = lectorOcr;
              lectorOcr = null;
              await lectorInterrumpido?.terminate().catch(() => undefined);
              paginaPendiente.exceptions.push({
                code: 'OMR_OCR_TIMEOUT',
                severity: 'warning',
                message: 'El OCR auxiliar excedió su tiempo límite; la identidad queda para revisión manual.'
              });
            }
          }
          metadata.pages.push(paginaPendiente);
        } else {
          const expectedId = qr.examId ? exam.id.toUpperCase() === qr.examId.toUpperCase() : true;
          const pageSpecs = json<any[]>(exam.paginas, []);
          const expectedText = pageSpecs.find((page) => Number(page.numero) === qr.numeroPagina)?.qrTexto;
          const map = json<any>(exam.mapaOmr, null);
          const expectedMapText = map?.paginas?.find((page: any) => Number(page.numeroPagina) === qr.numeroPagina)?.qr?.texto;
          const exactReference = [expectedText, expectedMapText].filter((value) => typeof value === 'string' && value.length > 0);
          if (!expectedId || !exactReference.some((expected) => expected === qr.raw) || !referenciaQr.get(`${exam.id.toUpperCase()}:${qr.numeroPagina}`)?.has(qr.raw)) {
            metadata.pages.push(errorPage(globalIndex, file.id, file.nombre, image.numero, 'OMR_QR_NO_COINCIDE_REFERENCIA', 'El QR no coincide exactamente con el examen y página generados para el lote.'));
          } else {
            try {
              const payload = await analizarImagenPromesa({ docenteId, folio: qr.folio, numeroPagina: qr.numeroPagina, imagenBase64: image.dataUrl });
              const result = payload?.resultado ?? {};
              const accepted = result.estadoAnalisis === 'ok' && payload?.examenId === exam.id && Number(payload?.numeroPagina) === qr.numeroPagina;
              const confidence = Number(result.confianzaPromedioPagina ?? 0);
              const responses = Array.isArray(result.respuestasDetectadas) ? result.respuestasDetectadas.map(proyectarRespuestaParaRevisionOmr) : [];
              const motivos = Array.isArray(result.motivosRevision) ? result.motivosRevision.map(String) : [];
              const duplicate = metadata.pages.some((page) => page.examId === exam.id && page.examPage === qr.numeroPagina);
              metadata.pages.push({
                sheetSerial: `${qr.folio}-P${qr.numeroPagina}-${globalIndex}`,
                pageIndex: globalIndex,
                sourceFileId: file.id,
                sourceFileName: file.nombre,
                sourcePage: image.numero,
                scanStatus: accepted && !duplicate && gradosQr === 0 ? 'accepted' : 'needs_review',
                confidence: Number.isFinite(confidence) ? confidence : 0,
                autoGradable: false,
                manualReviewRequired: !accepted || duplicate || gradosQr !== 0,
                examId: exam.id,
                folio: exam.folio,
                examPage: qr.numeroPagina,
                identityResult: { studentId: exam.alumnoId ?? null, studentName: exam.alumno?.nombreCompleto ?? null },
                responses,
                exceptions: [
                  ...(duplicate ? [{ code: 'OMR_QR_DUPLICADO', severity: 'blocking' as const, message: 'La misma página del examen aparece más de una vez en el ingreso.' }] : []),
                  ...(gradosQr !== 0 ? [{ code: 'OMR_QR_ORIENTACION_REVISAR', severity: 'blocking' as const, message: `El QR solo coincide con el PDF de referencia al girar ${gradosQr} grados; el análisis OMR se ejecutó sobre el original y la hoja requiere revisión.` }] : []),
                  ...motivos.map((message: string) => ({ code: 'OMR_REVIEW', severity: 'warning' as const, message }))
                ]
              });
            } catch {
              metadata.pages.push(errorPage(globalIndex, file.id, file.nombre, image.numero, 'OMR_ENGINE_ERROR', 'El motor OMR no pudo analizar la página; requiere revisión.'));
            }
          }
        }
        await prisma.omrScanJob.update({ where: { id: jobId }, data: { procesadas: globalIndex, metadata: JSON.stringify(metadata) } });
      }
    }
  }
  } finally {
    await lectorOcr?.terminate().catch(() => undefined);
  }

  const conteoQr = new Map<string, number>();
  for (const pagina of metadata.pages) {
    if (!pagina.examId || !pagina.examPage) continue;
    const key = `${pagina.examId}:${pagina.examPage}`;
    conteoQr.set(key, (conteoQr.get(key) ?? 0) + 1);
  }
  for (const pagina of metadata.pages) {
    if (!pagina.examId || !pagina.examPage) continue;
    if ((conteoQr.get(`${pagina.examId}:${pagina.examPage}`) ?? 0) > 1) {
      pagina.scanStatus = 'needs_review';
      pagina.manualReviewRequired = true;
      if (!pagina.exceptions.some((exception) => exception.code === 'OMR_QR_DUPLICADO')) {
        pagina.exceptions.push({ code: 'OMR_QR_DUPLICADO', severity: 'blocking', message: 'La misma página del examen aparece más de una vez en el ingreso.' });
      }
    }
  }
  const grupos = new Map<string, PaginaProcesada[]>();
  for (const page of metadata.pages) {
    if (!page.examId || !page.folio || !page.examPage) continue;
    const group = grupos.get(page.examId) ?? [];
    group.push(page);
    grupos.set(page.examId, group);
  }
  for (const [examId, pages] of grupos) {
    const exam = examenesPorId.get(examId.toUpperCase());
    if (!exam) continue;
    const map = json<any>(exam.mapaOmr, null);
    const expectedPages: number[] = (Array.isArray(map?.paginas) ? map.paginas : []).filter((page: any) => page.tipoPagina !== 'reverso-vacio').map((page: any) => Number(page.numeroPagina)).filter((numero: number) => Number.isFinite(numero));
    const ordered = [...pages].sort((a, b) => Number(a.examPage) - Number(b.examPage));
    const hasAllPages = expectedPages.length > 0 && expectedPages.every((number) => ordered.some((page) => page.examPage === number && page.scanStatus === 'accepted'));
    const pdf = await PDFDocument.create();
    let lastFileId = '';
    let sourceDocument: PDFDocument | null = null;
    for (const page of ordered) {
      const file = metadata.files.find((item) => item.id === page.sourceFileId);
      if (!file) continue;
      if (file.id !== lastFileId) {
        sourceDocument = await PDFDocument.load(await fs.readFile(resolverRutaIngesta(jobId, file.relativePath)));
        lastFileId = file.id;
      }
      if (sourceDocument) {
        const [copied] = await pdf.copyPages(sourceDocument, [page.sourcePage - 1]);
        if (copied) pdf.addPage(copied);
      }
    }
    if (pdf.getPageCount() === 0) continue;
    const { fileName, relativePath, student, group } = ubicacionPaquete(jobId, exam);
    const rutaPaquete = resolverRutaIngesta(jobId, relativePath);
    await fs.mkdir(path.dirname(rutaPaquete), { recursive: true });
    const bytes = Buffer.from(await pdf.save());
    await fs.writeFile(rutaPaquete, bytes, { flag: 'wx' });
    metadata.packages.push({
      id: randomUUID(), examId: exam.id, fileName, relativePath, sha256: sha256(bytes), pageCount: pdf.getPageCount(),
      status: hasAllPages ? 'complete' : 'needs_review', course: exam.periodo?.nombre ?? '', subject: exam.plantilla.titulo,
      partial: exam.plantilla.tipo, teacher: exam.docente.nombreCompleto, student, group, folio: exam.folio
    });
  }
  const manifest = {
    format: 'evaluapro.omr.ingesta-manifest',
    version: 1,
    jobId,
    loteId: metadata.loteId,
    sourceFiles: metadata.files.map(({ id, sha256: hash, bytes, pages }) => ({ id, sha256: hash, bytes, pages })),
    pages: metadata.pages.map((page) => ({
      index: page.pageIndex,
      sourceFileId: page.sourceFileId,
      sourceFileSha256: metadata.files.find((file) => file.id === page.sourceFileId)?.sha256,
      sourcePage: page.sourcePage,
      folioHash: page.folio ? sha256(Buffer.from(page.folio)) : undefined,
      examPage: page.examPage,
      status: page.scanStatus,
      confidence: page.confidence,
      exceptionCodes: page.exceptions.map((exception) => exception.code)
    })),
    reference: { sha256: metadata.reference.sha256, pages: metadata.reference.pages, pagesWithQr: metadata.reference.pagesWithQr, origen: metadata.reference.origen ?? 'generada' },
    packages: metadata.packages.map(({ sha256: hash, pageCount, status }) => ({ sha256: hash, pageCount, status }))
  };
  await fs.writeFile(resolverRutaIngesta(jobId, path.join(rootJob(jobId), 'manifest.json')), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  metadata.status = 'completed';
  metadata.completedAt = new Date().toISOString();
  await prisma.omrScanJob.update({ where: { id: jobId }, data: { estado: 'completed', procesadas: globalIndex, completadoEn: new Date(), metadata: JSON.stringify(metadata) } });
}

async function regenerarPaqueteExamen(jobId: string, exam: ExamenConRelaciones, metadata: MetadataIngesta) {
  const examPages = metadata.pages.filter((page) => page.examId === exam.id && page.examPage);
  if (examPages.length === 0) return;
  const oldPackage = metadata.packages.find((item) => item.examId === exam.id);
  const pdf = await PDFDocument.create();
  const sourceDocuments = new Map<string, PDFDocument>();
  for (const page of [...examPages].sort((a, b) => Number(a.examPage) - Number(b.examPage))) {
    const source = metadata.files.find((item) => item.id === page.sourceFileId);
    if (!source) continue;
    let document = sourceDocuments.get(source.id);
    if (!document) {
      document = await PDFDocument.load(await fs.readFile(resolverRutaIngesta(jobId, source.relativePath)));
      sourceDocuments.set(source.id, document);
    }
    const [copied] = await pdf.copyPages(document, [page.sourcePage - 1]);
    if (copied) pdf.addPage(copied);
  }
  if (pdf.getPageCount() === 0) return;
  const { fileName, relativePath, student, group } = ubicacionPaquete(jobId, exam, randomUUID());
  const outputPath = resolverRutaIngesta(jobId, relativePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const bytes = Buffer.from(await pdf.save());
  await fs.writeFile(outputPath, bytes, { flag: 'wx' });
  const map = json<any>(exam.mapaOmr, null);
  const expectedPages: number[] = (Array.isArray(map?.paginas) ? map.paginas : [])
    .filter((page: any) => page.tipoPagina !== 'reverso-vacio')
    .map((page: any) => Number(page.numeroPagina))
    .filter((number: number) => Number.isFinite(number));
  const allAccepted = expectedPages.length > 0 && expectedPages.every((number) => examPages.some((page) => page.examPage === number && page.scanStatus === 'accepted'));
  const paquete: PaqueteClasificado = {
    id: oldPackage?.id ?? randomUUID(), examId: exam.id, fileName, relativePath, sha256: sha256(bytes), pageCount: pdf.getPageCount(),
    status: allAccepted ? 'complete' : 'needs_review', course: exam.periodo?.nombre ?? '', subject: exam.plantilla.titulo,
    partial: exam.plantilla.tipo, teacher: exam.docente.nombreCompleto, student, group, folio: exam.folio
  };
  metadata.packages = [...metadata.packages.filter((item) => item.examId !== exam.id), paquete];
  const manifest = {
    format: 'evaluapro.omr.ingesta-manifest', version: 1, jobId, loteId: metadata.loteId,
    sourceFiles: metadata.files.map(({ id, sha256: hash, bytes: size, pages }) => ({ id, sha256: hash, bytes: size, pages })),
    pages: metadata.pages.map((page) => ({
      index: page.pageIndex, sourceFileId: page.sourceFileId,
      sourceFileSha256: metadata.files.find((file) => file.id === page.sourceFileId)?.sha256,
      sourcePage: page.sourcePage, folioHash: page.folio ? sha256(Buffer.from(page.folio)) : undefined,
      examPage: page.examPage, status: page.scanStatus, confidence: page.confidence,
      exceptionCodes: page.exceptions.map((exception) => exception.code)
    })),
    reference: { sha256: metadata.reference.sha256, pages: metadata.reference.pages, pagesWithQr: metadata.reference.pagesWithQr, origen: metadata.reference.origen ?? 'generada' },
    packages: metadata.packages.map(({ sha256: hash, pageCount, status }) => ({ sha256: hash, pageCount, status }))
  };
  await fs.writeFile(resolverRutaIngesta(jobId, path.join(rootJob(jobId), 'manifest.json')), JSON.stringify(manifest, null, 2));
  return oldPackage?.relativePath;
}

export async function recuperarIngestasPdfOmrInterrumpidas() {
  const jobs = await prisma.omrScanJob.findMany({
    where: { estado: 'processing' },
    select: { id: true, docenteId: true, metadata: true }
  });
  let recuperados = 0;
  for (const job of jobs) {
    const metadata = json<MetadataIngesta>(job.metadata, {
      version: 1, assessmentId: '', loteId: null, status: 'failed',
      reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 },
      files: [], pages: [], packages: [], errors: [], startedAt: ''
    });
    metadata.status = 'failed';
    metadata.completedAt = new Date().toISOString();
    if (!metadata.errors.some((error) => error.code === 'OMR_INGESTA_PROCESO_INTERRUMPIDO')) {
      metadata.errors.push({ fileName: 'job', code: 'OMR_INGESTA_PROCESO_INTERRUMPIDO' });
    }
    const actualizado = await prisma.omrScanJob.updateMany({
      where: { id: job.id, docenteId: job.docenteId, estado: 'processing' },
      data: { estado: 'failed', completadoEn: new Date(metadata.completedAt), metadata: JSON.stringify(metadata) }
    });
    recuperados += actualizado.count;
  }
  return recuperados;
}

export async function obtenerIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  const examenes = await buscarExamenesLote(metadata.assessmentId, docenteId);
  res.json({
    job: serializarEstado(job),
    candidateExams: examenes.map((exam) => ({
      id: exam.id, folio: exam.folio, studentName: exam.alumno?.nombreCompleto ?? '', group: exam.alumno?.grupo ?? '',
      pages: json<any>(exam.mapaOmr, null)?.paginas?.filter((page: any) => page.tipoPagina !== 'reverso-vacio').map((page: any) => Number(page.numeroPagina)) ?? []
    }))
  });
}

export async function recuperarIngestaPdfOmrPorClave(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const clientRequestId = String(req.params.clientRequestId ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)) {
    throw new ErrorAplicacion('OMR_REQUEST_ID_INVALIDO', 'clientRequestId debe ser UUID', 400);
  }
  const jobId = idJobIngesta(docenteId, clientRequestId);
  const job = await prisma.omrScanJob.findFirst({ where: { id: jobId, docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'No existe una ingesta para este clientRequestId', 404);
  req.params.jobId = job.id;
  return obtenerIngestaPdfOmr(req, res);
}

export async function resolverPaginaIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  if (job.estado !== 'completed' || metadata.status !== 'completed') throw new ErrorAplicacion('OMR_INGESTA_NO_LISTA', 'La ingesta debe terminar antes de resolver páginas', 409);
  const sourcePageIndex = Number(req.params.pageIndex);
  const page = metadata.pages.find((item) => item.pageIndex === sourcePageIndex);
  if (!page || page.scanStatus !== 'needs_review') throw new ErrorAplicacion('OMR_PAGINA_NO_RESOLUBLE', 'La página no existe o no requiere revisión', 409);
  const generatedAssessmentId = String(req.body?.generatedAssessmentId ?? '').trim();
  const examPage = Number(req.body?.examPage);
  const resolutionReason = String(req.body?.resolutionReason ?? '').trim();
  const examenes = await buscarExamenesLote(metadata.assessmentId, docenteId);
  const exam = examenes.find((item) => item.id === (page.examId ?? generatedAssessmentId));
  if (!exam) throw new ErrorAplicacion('OMR_EXAMEN_FUERA_DE_LOTE', 'El examen seleccionado no pertenece al lote de esta ingesta', 422);
  const paginaFinal = page.examPage ?? examPage;
  if (!page.examId && (!generatedAssessmentId || !Number.isInteger(examPage))) throw new ErrorAplicacion('OMR_CLASIFICACION_INCOMPLETA', 'Selecciona el examen y la página generados', 400);
  const examMap = json<any>(exam.mapaOmr, null);
  const expectedPage = examMap?.paginas?.find((item: any) => Number(item.numeroPagina) === paginaFinal && item.tipoPagina !== 'reverso-vacio');
  if (!expectedPage) throw new ErrorAplicacion('OMR_PAGINA_EXAMEN_INVALIDA', 'La página seleccionada no pertenece al examen generado', 422);
  if (metadata.pages.some((item) => item.pageIndex !== sourcePageIndex && item.examId === exam.id && item.examPage === paginaFinal)) throw new ErrorAplicacion('OMR_PAGINA_DUPLICADA', 'Esa página del examen ya está asociada a otra hoja', 409);
  if (!resolutionReason) throw new ErrorAplicacion('OMR_MOTIVO_REQUERIDO', 'Indica el motivo de la resolución manual', 400);
  const file = metadata.files.find((item) => item.id === page.sourceFileId);
  if (!file) throw new ErrorAplicacion('OMR_ORIGINAL_NO_ENCONTRADO', 'El PDF original no está disponible', 404);
  const original = await fs.readFile(resolverRutaIngesta(job.id, file.relativePath));
  if (sha256(original) !== file.sha256) throw new ErrorAplicacion('OMR_ORIGINAL_HASH_INVALIDO', 'El PDF original no coincide con el hash registrado', 409);
  const raster = await rasterizarPdfParaPreview(original, { dpi: RASTER_DPI, desdePagina: page.sourcePage, cantidadPaginas: 1 });
  const image = raster.paginas[0];
  if (!image) throw new ErrorAplicacion('OMR_PAGINA_ORIGINAL_NO_DISPONIBLE', 'No se pudo rasterizar la página original', 409);
  const payload = await analizarImagenPromesa({ docenteId, folio: exam.folio, numeroPagina: paginaFinal, imagenBase64: image.dataUrl });
  const result = payload?.resultado ?? {};
  const identidadYaClasificada = Boolean(page.examId);
  page.examId = exam.id;
  page.folio = exam.folio;
  page.examPage = paginaFinal;
  page.identitySource = page.identitySource ?? (identidadYaClasificada ? 'qr' : 'manual');
  page.resolutionReason = resolutionReason;
  page.identityResult = { studentId: exam.alumnoId ?? null, studentName: exam.alumno?.nombreCompleto ?? null };
  const respuestasDetectadas = Array.isArray(result.respuestasDetectadas) ? result.respuestasDetectadas.map(proyectarRespuestaParaRevisionOmr) : [];
  const respuestasManuales = Array.isArray(req.body?.finalResponses) ? req.body.finalResponses as Array<{ numeroPregunta: number; opcion: string | null }> : null;
  page.responses = respuestasManuales
    ? respuestasManuales.map((answer) => {
        const detectada = page.responses.find((respuesta) => respuesta.numeroPregunta === answer.numeroPregunta);
        return {
          ...(detectada ?? proyectarRespuestaParaRevisionOmr({ numeroPregunta: answer.numeroPregunta, opcion: null })),
          opcion: answer.opcion,
          opcionDetectada: detectada?.opcionDetectada ?? detectada?.opcion ?? null,
          estadoRespuesta: 'manual_review'
        };
      })
    : page.responses.length ? page.responses : respuestasDetectadas;
  page.confidence = Number(result.confianzaPromedioPagina ?? 0);
  page.scanStatus = 'needs_review';
  page.manualReviewRequired = true;
  page.exceptions = [{ code: page.identitySource === 'manual' ? 'OMR_IDENTIDAD_RESUELTA_MANUALMENTE' : 'OMR_RESPUESTAS_REVISADAS_MANUALMENTE', severity: 'warning', message: resolutionReason }];
  const oldPackagePath = await regenerarPaqueteExamen(job.id, exam, metadata);
  await prisma.omrScanJob.update({ where: { id: job.id }, data: { metadata: JSON.stringify(metadata) } });
  if (oldPackagePath) {
    const prior = resolverRutaIngesta(job.id, oldPackagePath);
    await fs.rm(prior, { force: true }).catch(() => undefined);
  }
  const actualizado = await prisma.omrScanJob.findUniqueOrThrow({ where: { id: job.id } });
  res.json({ job: serializarEstado(actualizado) });
}

export async function descargarOriginalIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  const file = metadata.files.find((item) => item.id === String(req.params.fileId || ''));
  if (!file) throw new ErrorAplicacion('OMR_ORIGINAL_NO_ENCONTRADO', 'PDF original no encontrado', 404);
  const bytes = await fs.readFile(resolverRutaIngesta(job.id, file.relativePath)).catch(() => null);
  if (!bytes || sha256(bytes) !== file.sha256) throw new ErrorAplicacion('OMR_ORIGINAL_NO_DISPONIBLE', 'El PDF original no está disponible o su hash cambió', 404);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.nombre.replace(/[\r\n"\\]/g, '_')}"`);
  res.send(bytes);
}

export async function previsualizarPaginaIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  if (job.estado !== 'completed') throw new ErrorAplicacion('OMR_INGESTA_NO_LISTA', 'La ingesta debe terminar antes de previsualizar páginas', 409);

  const pageIndex = Number(req.params.pageIndex);
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 1) throw new ErrorAplicacion('OMR_PAGINA_INVALIDA', 'El índice de página debe ser un entero positivo', 400);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  if (metadata.status !== 'completed') throw new ErrorAplicacion('OMR_INGESTA_NO_LISTA', 'La ingesta debe terminar antes de previsualizar páginas', 409);
  const page = metadata.pages.find((item) => item.pageIndex === pageIndex);
  if (!page) throw new ErrorAplicacion('OMR_PAGINA_NO_ENCONTRADA', 'La página no existe en esta ingesta', 404);
  const file = metadata.files.find((item) => item.id === page.sourceFileId);
  if (!file) throw new ErrorAplicacion('OMR_ORIGINAL_NO_ENCONTRADO', 'El PDF original no está disponible', 404);
  const bytes = await fs.readFile(resolverRutaIngesta(job.id, file.relativePath)).catch(() => null);
  if (!bytes || sha256(bytes) !== file.sha256) throw new ErrorAplicacion('OMR_ORIGINAL_NO_DISPONIBLE', 'El PDF original no está disponible o su hash cambió', 404);
  const raster = await rasterizarPdfParaPreview(bytes, { dpi: RASTER_DPI, desdePagina: page.sourcePage, cantidadPaginas: 1 });
  const image = raster.paginas[0];
  if (!image) throw new ErrorAplicacion('OMR_PAGINA_ORIGINAL_NO_DISPONIBLE', 'No se pudo rasterizar la página original', 409);
  const contenido = Buffer.from(image.dataUrl.slice('data:image/png;base64,'.length), 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', String(contenido.byteLength));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(contenido);
}

export async function previsualizarReferenciaIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  if (job.estado !== 'completed') throw new ErrorAplicacion('OMR_INGESTA_NO_LISTA', 'La ingesta debe terminar antes de previsualizar páginas', 409);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  const pageIndex = Number(req.params.pageIndex);
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 1) throw new ErrorAplicacion('OMR_PAGINA_INVALIDA', 'El índice de página debe ser un entero positivo', 400);
  const page = metadata.pages.find((item) => item.pageIndex === pageIndex);
  if (!page) throw new ErrorAplicacion('OMR_PAGINA_NO_ENCONTRADA', 'La página no existe en esta ingesta', 404);
  const examenes = await buscarExamenesLote(metadata.assessmentId, docenteId);
  const requestedExamId = String(req.query.generatedAssessmentId ?? '').trim();
  const requestedExamPage = String(req.query.examPage ?? '').trim();
  if (Boolean(requestedExamId) !== Boolean(requestedExamPage)) throw new ErrorAplicacion('OMR_CLASIFICACION_INCOMPLETA', 'generatedAssessmentId y examPage deben enviarse juntos', 400);
  if (page.examId && requestedExamId && page.examId !== requestedExamId) throw new ErrorAplicacion('OMR_DESTINO_REFERENCIA_CONFLICTIVO', 'El examen solicitado no coincide con el examen ya vinculado a esta página', 422);
  if (page.examPage && requestedExamPage && page.examPage !== Number(requestedExamPage)) throw new ErrorAplicacion('OMR_DESTINO_REFERENCIA_CONFLICTIVO', 'La página solicitada no coincide con la página ya vinculada', 422);
  const examId = page.examId ?? requestedExamId;
  const examPage = page.examPage ?? Number(requestedExamPage);
  if (!examId || (!requestedExamPage && !page.examPage)) throw new ErrorAplicacion('OMR_CLASIFICACION_INCOMPLETA', 'Selecciona examen y página válidos del lote', 400);
  const exam = examenes.find((item) => item.id === examId);
  if (!exam) throw new ErrorAplicacion('OMR_EXAMEN_FUERA_DE_LOTE', 'El examen seleccionado no pertenece al lote de esta ingesta', 422);
  if (!Number.isSafeInteger(examPage) || examPage < 1) throw new ErrorAplicacion('OMR_PAGINA_INVALIDA', 'La página del examen debe ser un entero positivo', 400);
  const expectedPage = json<any>(exam.mapaOmr, null)?.paginas?.find((item: any) => Number(item.numeroPagina) === examPage && item.tipoPagina !== 'reverso-vacio');
  if (!expectedPage) throw new ErrorAplicacion('OMR_PAGINA_EXAMEN_INVALIDA', 'La página seleccionada no pertenece al examen generado', 422);
  const key = `${exam.id.toUpperCase()}:${examPage}`;
  let referencePage = metadata.reference.pageMap?.[key];
  if (!referencePage) {
    const expectedQr = [
      json<any[]>(exam.paginas, []).find((item) => Number(item.numero) === examPage)?.qrTexto,
      json<any>(exam.mapaOmr, null)?.paginas?.find((item: any) => Number(item.numeroPagina) === examPage)?.qr?.texto
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    const bytesReference = await fs.readFile(resolverRutaIngesta(job.id, metadata.reference.relativePath)).catch(() => null);
    if (!bytesReference || sha256(bytesReference) !== metadata.reference.sha256) throw new ErrorAplicacion('OMR_REFERENCE_NO_DISPONIBLE', 'El PDF de referencia no está disponible o su hash cambió', 404);
    const candidatas: number[] = [];
    for (let start = 1; start <= metadata.reference.pages; start += PAGE_BLOCK_SIZE) {
      const raster = await rasterizarPdfParaPreview(bytesReference, { dpi: RASTER_DPI, desdePagina: start, cantidadPaginas: PAGE_BLOCK_SIZE });
      for (const image of raster.paginas) {
        let texto: string | undefined;
        try { texto = await leerQrDesdeImagen(image.dataUrl); } catch { texto = undefined; }
        const qr = extraerResumenQrExamen(texto);
        const qrPerteneceAlExamen = qr?.examId
          ? qr.examId.toUpperCase() === exam.id.toUpperCase()
          : qr?.folio.toUpperCase() === exam.folio.toUpperCase();
        if (qr?.payloadSignatureValid === true && qrPerteneceAlExamen && qr.numeroPagina === examPage && expectedQr.includes(qr.raw)) {
          candidatas.push(image.numero);
        }
      }
    }
    referencePage = candidatas;
  }
  if (!referencePage?.length) throw new ErrorAplicacion('OMR_PAGINA_REFERENCIA_NO_ENCONTRADA', 'No se encontró una página equivalente y validada en el PDF de referencia', 404);
  if (referencePage.length !== 1) throw new ErrorAplicacion('OMR_PAGINA_REFERENCIA_AMBIGUA', 'Hay más de una página de referencia para este examen y página', 409);
  const bytesReference = await fs.readFile(resolverRutaIngesta(job.id, metadata.reference.relativePath)).catch(() => null);
  if (!bytesReference || sha256(bytesReference) !== metadata.reference.sha256) throw new ErrorAplicacion('OMR_REFERENCE_NO_DISPONIBLE', 'El PDF de referencia no está disponible o su hash cambió', 404);
  const raster = await rasterizarPdfParaPreview(bytesReference, { dpi: RASTER_DPI, desdePagina: referencePage[0], cantidadPaginas: 1 });
  const image = raster.paginas[0];
  if (!image) throw new ErrorAplicacion('OMR_PAGINA_REFERENCIA_NO_DISPONIBLE', 'No se pudo rasterizar la página de referencia', 409);
  const contenido = Buffer.from(image.dataUrl.slice('data:image/png;base64,'.length), 'base64');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', String(contenido.byteLength));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(contenido);
}

export async function descargarManifiestoIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const manifestPath = resolverRutaIngesta(job.id, path.join(rootJob(job.id), 'manifest.json'));
  const bytes = await fs.readFile(manifestPath).catch(() => null);
  if (!bytes) throw new ErrorAplicacion('OMR_MANIFIESTO_NO_DISPONIBLE', 'El manifiesto todavía no está disponible', 404);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="omr-${job.id}-manifest.json"`);
  res.send(bytes);
}
export async function descargarPaqueteIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  const paquete = metadata.packages.find((item) => item.id === String(req.params.packageId || ''));
  if (!paquete) throw new ErrorAplicacion('OMR_PAQUETE_NO_ENCONTRADO', 'Paquete clasificado no encontrado', 404);
  const target = resolverRutaIngesta(job.id, paquete.relativePath);
  const bytes = await fs.readFile(target).catch(() => null);
  if (!bytes) throw new ErrorAplicacion('OMR_PAQUETE_NO_DISPONIBLE', 'El PDF clasificado no está disponible', 404);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${paquete.fileName.replace(/[\r\n"\\]/g, '_')}"`);
  res.send(bytes);
}
