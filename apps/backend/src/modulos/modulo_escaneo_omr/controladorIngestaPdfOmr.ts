Warning: truncated output (original token count: 37494)
Total output lines: 2457

import { createHash, createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { PDFDocument } from 'pdf-lib';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/index.js';
import { resolverRutaPdfExamen } from '../../infraestructura/archivos/almacenLocal.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { obtenerRutaTemporalOmr, retirarRutaTemporalOmr } from './archivoTemporalOmr.js';
import {
  construirFirmaClave,
  construirFirmaVariante,
  descargarPdfLoteUseCase,
  extraerResumenQrExamen,
  rasterizarPdfParaPreview,
  type MapaOmr,
  type RecoveryManifest,
  verificarRecoveryManifest
} from '../modulo_generacion_pdf/index.js';
import { analizarImagen } from './controladorEscaneoOmr.js';
import { analizarOmr, leerQrDesdeImagen } from './servicioOmr.js';
import { proyectarRespuestaParaRevisionOmr, type RespuestaRevisionOmr } from './omr/decision/respuestaRevision.js';
import { crearLectorPieOmr, leerReferenciaPieOmr, limitarTiempoOcrPie, sugerirFolioCercanoOmr, type LectorPieOmr } from './infra/ocrPieOmr.js';
import { localizarQrsEsperadosEnRaster, prepararQrsEsperados, type GeometriaQrPdf, type QrReferenciaEsperado } from './infra/qrReferenciaPdf.js';
import { MAX_JOB_BYTES, MAX_JOB_PAGES, MAX_PDF_BYTES, MAX_PDF_PAGES } from './limitesIngestaPdfOmr.js';
import { esPaginaDatasetOmrConfirmada, generarZipDatasetOmr } from './exportadorDatasetOmr.js';
import { construirGroundTruthManualOmr, construirMapaOmrPaginaPilotoReal, extraerClaveCompletaRecoveryManifest } from './construirImportPilotoReal.js';
import { recuperarQrIngestaPorGeometria } from './recuperarQrIngesta.js';
import { segmentarCopiasFormulario, type CopiaFormulario } from './copiasFormularioOmr.js';
import { rasterizarBloqueIngestaOmr } from './infra/rasterizadorIngestaPdfOmr.js';
import { evaluarAutoCalificableOmr, OMR_TV4_REAL_PILOT_GATE_PASSED } from './politicaAutoCalificacionOmr.js';
import { diagnosticoGatePilotoRealOmr, MENSAJE_PLANTILLA_OMR_NO_COMPATIBLE } from './diagnosticosOmr.js';
const PAGE_BLOCK_SIZE = 4;
const RASTER_DPI = 144;
const UMBRAL_CONFIANZA_RECUPERACION_FOLIO_OCR = 30;

type CalificadorExamenOmr = (req: SolicitudDocente, res: Response) => Promise<void>;
let calificadorExamenOmr: CalificadorExamenOmr | undefined;

export function configurarCalificadorExamenOmr(calificador: CalificadorExamenOmr) {
  calificadorExamenOmr = calificador;
}

type ArchivoCargado = Express.Multer.File;
type ExamenConRelaciones = Awaited<ReturnType<typeof buscarExamenesLote>>[number];
type HumanReviewOmr = {
  method: 'visual_original_capture';
  reviewerIdHash: string;
  reviewedAt: string;
  reviewerAttested: true;
  independentOfOmr: true;
  omrPredictionsHidden: true;
};
type PaginaProcesada = {
  sheetSerial: string;
  pageIndex: number;
  sourceFileId: string;
  sourceFileName: string;
  sourcePage: number;
  sourcePageSha256?: string;
  scanStatus: 'accepted' | 'needs_review' | 'rejected';
  confidence: number;
  autoGradable: boolean;
  omrAnalysis?: {
    estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    templateVersionDetectada?: 4;
    motivosRevision: string[];
    engineVersion: string;
    geomQuality: number;
    photoQuality: number;
    decisionPolicy: string;
    qrTexto: string;
  };
  manualReviewRequired: boolean;
  examId?: string;
  folio?: string;
  examPage?: number;
  submissionId?: string;
  identitySource?: 'qr' | 'manual';
  ocrSuggestion?: {
    generatedAssessmentId: string;
    folio: string;
    examPage: number;
    confidence: number;
    source: 'ocr_two_position_consensus' | 'ocr_single_position_consensus' | 'ocr_single_character_recovery' | 'ocr_partial_folio_recovery';
    matchingPositions: 1 | 2;
    ocrFolioLeido?: string;
  };
  resolutionReason?: string;
  humanReview?: HumanReviewOmr;
  groundTruthReview?: {
    humanReview: HumanReviewOmr;
    bonusVisible?: boolean;
    responses: Array<{
      numeroPregunta: number;
      opcion: string | null;
      tipoMarcaManual: 'valid' | 'blank' | 'double' | 'smudge';
      selectedOptions: Array<'A' | 'B' | 'C' | 'D' | 'E'>;
      estadoRespuesta: 'manual_review';
    }>;
  };
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
  submissionId?: string;
};
export type ResultadoAutoCalificacionOmr = {
  status: 'saved' | 'already_recorded' | 'needs_review' | 'failed';
  calificacionId?: string;
  aciertos?: number;
  totalReactivos?: number;
  calificacionExamen?: string;
  reasonCodes?: string[];
};
type CalificadorAutomaticoOmr = (args: { docenteId: string; body: unknown }) => Promise<{ statusCode: number; body: unknown }>;
let calificadorAutomaticoOmr: CalificadorAutomaticoOmr | null = null;

export function configurarCalificadorAutomaticoOmr(calificador: CalificadorAutomaticoOmr) {
  calificadorAutomaticoOmr = calificador;
}

type MetadataIngesta = {
  version: 1;
  retryCount?: number;
  lastRetryRequestId?: string;
  clientRequestId?: string;
  requestHash?: string;
  sharedFormCopies?: boolean;
  sharedGroup?: string | null;
  sharedSubmissions?: CopiaFormulario[];
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
  autoGrading?: {
    clientRequestId: string;
    status: 'processing' | 'completed' | 'partial';
    startedAt: string;
    completedAt?: string;
    results: Array<Record<string, unknown>>;
  };
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

export function coincideLecturaCalificacionOmr(respuesta: unknown, persistida: unknown) {
  if (!respuesta || typeof respuesta !== 'object' || !persistida || typeof persistida !== 'object') return false;
  const grade = respuesta as Record<string, any>;
  const stored = persistida as Record<string, any>;
  const expectedFraction = grade.fraccion as Record<string, unknown> | null;
  const storedFraction = json<Record<string, unknown>>(stored.fraccion, {});
  return typeof grade.id === 'string'
    && grade.id === stored.id
    && Number.isInteger(grade.aciertos)
    && grade.aciertos === stored.aciertos
    && Number.isInteger(grade.totalReactivos)
    && grade.totalReactivos === stored.totalReactivos
    && typeof grade.bonoTexto === 'string'
    && grade.bonoTexto === stored.bonoTexto
    && typeof grade.calificacionExamenTexto === 'string'
    && grade.calificacionExamenTexto === stored.calificacionExamenTexto
    && typeof grade.calificacionExamenFinalTexto === 'string'
    && grade.calificacionExamenFinalTexto === stored.calificacionExamenFinalTexto
    && expectedFraction !== null
    && typeof expectedFraction === 'object'
    && String(expectedFraction.numerador) === String(storedFraction.numerador)
    && String(expectedFraction.denominador) === String(storedFraction.denominador);
}

export function candidatosIngestaOmr(examenes: ExamenConRelaciones[]) {
  return examenes.map((exam) => {
    const mapaOmr = json<any>(exam.mapaOmr, null);
    const mapaVariante = json<any>(exam.mapaVariante, null);
    const paginasQr = json<any[]>(exam.paginas, []).map((pagina) => String(pagina?.qrTexto ?? ''));
    const paginasMapa = mapaOmr?.paginas
      ?.filter((page: any) => page.tipoPagina !== 'reverso-vacio')
      ?? [];
    const paginasEsperadas: number[] = paginasMapa.map((page: any) => Number(page.numeroPagina));
    const qrPorPagina = paginasEsperadas.map((numeroPagina: number) => {
      const pagina = mapaOmr?.paginas?.find((item: any) => Number(item.numeroPagina) === numeroPagina);
      return String(pagina?.qr?.texto ?? '');
    });
    const recovery = json<RecoveryManifest>(exam.recoveryManifest, null as never);
    const recoveryPages = Array.isArray(recovery?.pages) ? recovery.pages : [];
    const recoveryByPage = new Map(recoveryPages.map((page) => [Number(page.numeroPagina), page]));
    const qrSummaries: Array<{ numeroPagina: number; valid: boolean; summary: ReturnType<typeof extraerResumenQrExamen> }> = paginasEsperadas.map((numeroPagina) => {
      const paginaMapa = paginasMapa.filter((page: any) => Number(page.numeroPagina) === numeroPagina);
      const paginaPersistida = json<any[]>(exam.paginas, []).filter((page) => Number(page?.numero) === numeroPagina);
      const paginaRecovery = recoveryByPage.get(numeroPagina);
      const qrMapa = String(paginaMapa[0]?.qr?.texto ?? '');
      const qrPersistido = String(paginaPersistida[0]?.qrTexto ?? '');
      const qrManifiesto = String(paginaRecovery?.qrTexto ?? '');
      const summary = extraerResumenQrExamen(qrMapa);
      return {
        numeroPagina,
        valid: paginaMapa.length === 1
          && paginaPersistida.length === 1
          && paginaRecovery !== undefined
          && qrMapa.length > 0
          && qrMapa === qrPersistido
          && qrMapa === qrManifiesto
          && summary?.payloadSignatureValid === true
          && summary.folio === String(exam.folio).toUpperCase()
          && summary.numeroPagina === numeroPagina
          && summary.templateVersion === 4,
        summary
      };
    });
    const recoveryQuestions = Array.isArray(recovery?.questions) ? recovery.questions : [];
    const answerKeyEntries = Array.isArray(recovery?.answerKeySnapshot?.entries) ? recovery.answerKeySnapshot.entries : [];
    const snapshotVersions = json<any[]>(exam.versionSet, []);
    const recoveryQuestionIds = recoveryQuestions.map((question) => String(question.questionId));
    const recoveryVariantMap = {
      ordenPreguntas: recoveryQuestions.map((question) => String(question.questionId)),
      ordenOpcionesPorPregunta: Object.fromEntries(recoveryQuestions.map((question) => [String(question.questionId), question.variantOrder]))
    };
    const recoveryKeyQuestions = recoveryQuestions.map((question) => ({
      id: String(question.questionId),
      enunciado: String(question.enunciado ?? ''),
      opciones: (Array.isArray(question.opcionesBase) ? question.opcionesBase : []).map((option) => ({
        texto: String(option.texto ?? ''),
        esCorrecta: option.esCorrecta === true
      }))
    }));
    const keySnapshotMatchesQuestions = answerKeyEntries.length === recoveryQuestions.length
      && answerKeyEntries.every((entry, index) =>
        String(entry.questionId) === recoveryQuestionIds[index]
        && String(entry.correctLetterVisible) === String(recoveryQuestions[index]?.correctLetterVisible)
        && String(entry.correctOriginalIndex ?? '') === String(recoveryQuestions[index]?.opcionesBase?.find((option) => option.esCorrecta)?.index ?? ''));
    const recoveryVerified = Boolean(
      recovery
      && verificarRecoveryManifest(recovery)
      && recovery.examId === exam.id
      && recovery.docenteId === exam.docenteId
      && String(recovery.loteId ?? '') === String(exam.loteId ?? '')
      && recovery.folio === String(exam.folio).toUpperCase()
      && JSON.stringify(recovery.mapaOmrSnapshot) === JSON.stringify(mapaOmr)
      && recovery.templateVersion === 4
      && recovery.totalPreguntas === recoveryQuestions.length
      && recoveryQuestions.length === answerKeyEntries.length
      && recoveryQuestions.length === (Array.isArray(mapaVariante?.ordenPreguntas) ? mapaVariante.ordenPreguntas.length : -1)
      && recoveryQuestions.length === snapshotVersions.length
      && keySnapshotMatchesQuestions
      && recovery.variantHash
      && recovery.answerKeyHash
      && construirFirmaVariante(mapaVariante) === recovery.variantHash
      && construirFirmaVariante(recoveryVariantMap) === recovery.variantHash
      && construirFirmaClave(recoveryKeyQuestions, mapaVariante) === recovery.answerKeyHash
      && construirFirmaClave(recoveryKeyQuestions, recoveryVariantMap) === recovery.answerKeyHash
      && paginasEsperadas.length > 0
      && new Set(paginasEsperadas).size === paginasEsperadas.length
      && recoveryPages.length === paginasEsperadas.length
      && qrSummaries.length === paginasEsperadas.length
      && qrSummaries.every(({ valid, summary }) => valid
        && (!summary?.variantHash || summary.variantHash === recovery.variantHash)
        && (!summary?.answerKeyHash || summary.answerKeyHash === recovery.answerKeyHash))
    );
    const resumenes = [...paginasQr, ...qrPorPagina].map(extraerResumenQrExamen).filter(Boolean);
    return {
      id: exam.id,
      folio: exam.folio,
      studentName: exam.alumno?.nombreCompleto ?? '',
      group: exam.alumno?.grupo ?? '',
      pages: paginasEsperadas,
      totalQuestions: Array.isArray(mapaVariante?.ordenPreguntas) ? mapaVariante.ordenPreguntas.length : 0,
      templateVersion: Number(mapaOmr?.templateVersion ?? 0),
      variantHashes: recoveryVerified ? [String(recovery.variantHash)] : [...new Set(resumenes.map((summary) => summary?.variantHash).filter((value): value is string => Boolean(value)))],
      answerKeyHashes: recoveryVerified ? [String(recovery.answerKeyHash)] : [...new Set(resumenes.map((summary) => summary?.answerKeyHash).filter((value): value is string => Boolean(value)))],
      variantVerified: Boolean(recoveryVerified),
      answerKeySnapshotVerified: Boolean(recoveryVerified),
      answerKeySnapshotQuestions: recoveryVerified ? recoveryQuestions.length : json<any[]>(exam.versionSet, []).length
    };
  });
}

function slug(value: unknown, fallback: string) {
  const normalized = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const clean = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  return clean || fallback;
}

function ubicacionPaquete(jobId: string, exam: ExamenConRelaciones, revisionId?: string, copiaCompartida = false) {
  const student = exam.alumno?.nombreCompleto ?? (copiaCompartida ? 'copia-compartida-sin-asignar' : 'alumno-sin-registro');
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
function idempotenciaCalificacionIngesta(docenteId: string, examId: string) {
  const hex = createHash('sha256').update(`evaluapro-omr-local-v1\n${docenteId}\n${examId}`, 'utf8').digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}
function idJobIngesta(docenteId: string, clientRequestId: string) {
  const hex = createHash('sha256').update(`${docenteId}\n${clientRequestId}`, 'utf8').digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}
async function limpiarArchivosCargados(files: ArchivoCargado[]) {
  await Promise.all(files.map((file) => {
    const ruta = retirarRutaTemporalOmr(file);
    return ruta ? fs.rm(path.dirname(ruta), { recursive: true, force: true }).catch(() => undefined) : Promise.resolve();
  }));
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
  let paginasConPatronEsperado = 0;
  let paginasConPatronesAmbiguos = 0;
  let paginasConFirmaInvalida = 0;
  if (expected.length === 0) return { paginas, paginasConQrFirmado, qrsPorClave, paginasConPatronEsperado, paginasConPatronesAmbiguos, paginasConFirmaInvalida };
  const preparedExpected = prepararQrsEsperados(expected);
  for (let desde = 1; desde <= paginas; desde += PAGE_BLOCK_SIZE) {
    const cantidad = Math.min(PAGE_BLOCK_SIZE, paginas - desde + 1);
    const raster = await rasterizarBloqueIngestaOmr(bytes, desde, cantidad);
    for (const numero of Array.from({ length: cantidad }, (_, index) => desde + index)) {
      const pagina = raster.paginas.get(numero);
      if (!pagina || raster.fallidas.has(numero)) continue;
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
      if (encontrados.length === 0) continue;
      if (encontrados.length > 1) {
        paginasConPatronesAmbiguos += 1;
        continue;
      }
      paginasConPatronEsperado += 1;
      const qr = extraerResumenQrExamen(encontrados[0]!.raw);
      if (!qr || qr.payloadSignatureValid !== true || !Number.isInteger(qr.numeroPagina) || qr.numeroPagina < 1 || !qr.folio) {
        if (qr?.payloadSignature && qr.payloadSignatureValid !== true) paginasConFirmaInvalida += 1;
        continue;
      }
      paginasConQrFirmado += 1;
      const clave = claveQrExamenPagina(qr);
      const ocurrencias = qrsPorClave.get(clave) ?? [];
      ocurrencias.push({ raw: qr.raw, numeroPagina: pagina.numero, examId: qr.examId, folio: qr.folio });
      qrsPorClave.set(clave, ocurrencias);
    }
  }
  return { paginas, paginasConQrFirmado, qrsPorClave, paginasConPatronEsperado, paginasConPatronesAmbiguos, paginasConFirmaInvalida };
}

function construirQrEsperadosLote(examenes: ResumenExamenLoteArchivadoOmr[]) {
  const esperados = new Map<string, string>();
  const referencias: QrReferenciaEsperado[] = [];
  let estructuraValida = examenes.length > 0;
  const diagnostico = {
    paginasRegistradas: 0,
    qrAusente: 0,
    qrMalformado: 0,
    firmaInvalida: 0,
    identidadInvalida: 0,
    numeroPaginaInvalido: 0,
    geometriaAusente: 0,
    qrDuplicado: 0
  };
  for (const examen of examenes) {
    const paginas = json<Array<{ numero?: unknown; qrTexto?: unknown }>>(examen.paginas, []);
    const mapaOmr = json<{ paginas?: Array<{ numeroPagina?: unknown; qr?: GeometriaQrPdf }> }>(examen.mapaOmr, {});
    if (!Array.isArray(paginas) || paginas.length === 0) estructuraValida = false;
    diagnostico.paginasRegistradas += Array.isArray(paginas) ? paginas.length : 0;
    for (const pagina of paginas) {
      const numero = Number(pagina?.numero);
      const raw = String(pagina?.qrTexto ?? '').trim();
      const qr = extraerResumenQrExamen(raw);
      if (!raw) diagnostico.qrAusente += 1;
      else if (!qr) diagnostico.qrMalformado += 1;
      else {
        if (qr.payloadSignatureValid !== true) diagnostico.firmaInvalida += 1;
        if (qr.folio.toUpperCase() !== examen.folio.toUpperCase()) diagnostico.identidadInvalida += 1;
        if (qr.numeroPagina !== numero || !Number.isInteger(numero) || numero < 1) diagnostico.numeroPaginaInvalido += 1;
      }
      if (!raw || !qr || qr.payloadSignatureValid !== true || qr.folio.toUpperCase() !== examen.folio.toUpperCase() || qr.numeroPagina !== numero || !Number.isInteger(numero) || numero < 1) {
        estructuraValida = false;
        continue;
      }
      const clave = claveQrExamenPagina(qr);
      if (esperados.has(clave)) {
        estructuraValida = false;
        diagnostico.qrDuplicado += 1;
      }
      esperados.set(clave, raw);
      const geometry = mapaOmr.paginas?.find((item) => Number(item.numeroPagina) === numero)?.qr;
      if (!geometry || !Number.isFinite(geometry.x) || !Number.isFinite(geometry.y) || !Number.isFinite(geometry.size)) {
        estructuraValida = false;
        diagnostico.geometriaAusente += 1;
        continue;
      }
      referencias.push({ key: clave, raw, geometry });
    }
  }
  return { esperados, referencias, estructuraValida, diagnostic…25494 tokens truncated…DAD_TERRENO_INCOMPLETA', 'La etiqueta debe incluir exactamente una observación manual por reactivo de la página.', 422);
  }
  if (page.groundTruthReview) {
    const existentes = page.groundTruthReview.responses.map(({ numeroPregunta, opcion, tipoMarcaManual, selectedOptions }) => ({ numeroPregunta, opcion, tipoMarcaManual, selectedOptions }))
      .sort((left, right) => left.numeroPregunta - right.numeroPregunta);
    if (JSON.stringify(existentes) === JSON.stringify(respuestasCanonicas) && page.groundTruthReview.bonusVisible === bonusVisible) return res.status(200).json({ job: serializarEstado(job), repeated: true });
    throw new ErrorAplicacion('OMR_VERDAD_TERRENO_INMUTABLE', 'La etiqueta ciega ya está registrada y el nuevo payload difiere; usa una nueva ingesta para conservar la trazabilidad.', 409);
  }
  const source = metadata.files.find((item) => item.id === page.sourceFileId);
  if (!source) throw new ErrorAplicacion('OMR_ORIGINAL_NO_ENCONTRADO', 'El PDF original no está disponible.', 404);
  const original = await fs.readFile(resolverRutaIngesta(job.id, source.relativePath));
  if (sha256(original) !== source.sha256) throw new ErrorAplicacion('OMR_ORIGINAL_HASH_INVALIDO', 'El PDF original no coincide con el hash registrado.', 409);
  const reviewedAt = new Date().toISOString();
  const humanReview = {
    method: 'visual_original_capture' as const,
    reviewerIdHash: createHmac('sha256', configuracion.jwtSecreto).update(docenteId).digest('hex'),
    reviewedAt,
    reviewerAttested: true as const,
    independentOfOmr: true as const,
    omrPredictionsHidden: true as const
  };
  page.groundTruthReview = {
    humanReview,
    ...(page.examPage === 1 ? { bonusVisible: bonusVisible as boolean } : {}),
    responses: respuestasCanonicas.map((answer) => ({ ...answer, estadoRespuesta: 'manual_review' as const }))
  };
  const updated = await prisma.omrScanJob.updateMany({
    where: { id: jobId, docenteId, estado: 'completed', metadata: job.metadata },
    data: { metadata: JSON.stringify(metadata) }
  });
  if (updated.count !== 1) throw new ErrorAplicacion('OMR_INGESTA_CAMBIO_CONCURRENTE', 'El job cambió durante el etiquetado; vuelve a cargarlo antes de continuar.', 409);
  const actualizado = { ...job, metadata: JSON.stringify(metadata) };
  res.status(200).json({ job: serializarEstado(actualizado) });
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
      const cantidad = Math.min(PAGE_BLOCK_SIZE, metadata.reference.pages - start + 1);
      const raster = await rasterizarBloqueIngestaOmr(bytesReference, start, cantidad);
      for (const numero of Array.from({ length: cantidad }, (_, index) => start + index)) {
        const image = raster.paginas.get(numero);
        if (!image || raster.fallidas.has(numero)) continue;
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

export async function exportarDatasetIngestaPdfOmr(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await prisma.omrScanJob.findFirst({ where: { id: String(req.params.jobId || ''), docenteId } });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  if (job.estado !== 'completed') throw new ErrorAplicacion('OMR_INGESTA_NO_LISTA', 'Solo se exportan ingestas completadas', 409);

  const metadata = json<MetadataIngesta>(job.metadata, { version: 1, assessmentId: '', loteId: null, status: 'failed', reference: { nombre: '', relativePath: '', sha256: '', pages: 0, pagesWithQr: 0 }, files: [], pages: [], packages: [], errors: [], startedAt: '' });
  if (metadata.status !== 'completed') throw new ErrorAplicacion('OMR_INGESTA_NO_LISTA', 'La ingesta no tiene un estado completado válido', 409);
  const indexes = (req.body as { pageIndexes: number[] }).pageIndexes;
  const selected = new Set(indexes);
  const pages = metadata.pages.filter((page) => selected.has(page.pageIndex));
  if (pages.length !== selected.size) throw new ErrorAplicacion('OMR_DATASET_PAGINA_INVALIDA', 'La selección contiene páginas que no pertenecen al job', 422);
  if (pages.some((page) => !esPaginaDatasetOmrConfirmada(page))) {
    throw new ErrorAplicacion('OMR_DATASET_PAGINA_SIN_CONFIRMAR', 'Solo se exportan páginas con identidad y respuestas revisadas y guardadas manualmente', 422);
  }

  const examenes = await buscarExamenesLote(metadata.assessmentId, docenteId);
  for (const page of pages) {
    const exam = examenes.find((candidate) => candidate.id === page.examId);
    const map = exam ? json<{ paginas?: Array<{ numeroPagina?: number; tipoPagina?: string }> }>(exam.mapaOmr, {}) : {};
    const pageExists = map.paginas?.some((candidate) => Number(candidate.numeroPagina) === page.examPage && candidate.tipoPagina !== 'reverso-vacio');
    if (!exam || exam.folio !== page.folio || !pageExists) {
      throw new ErrorAplicacion('OMR_DATASET_IDENTIDAD_INVALIDA', 'La identidad de una página seleccionada no coincide con el lote confirmado', 422);
    }
  }
  const sourceIds = new Set(pages.map((page) => page.sourceFileId));
  const sources = metadata.files.filter((file) => sourceIds.has(file.id)).map((file) => ({
    id: file.id,
    path: resolverRutaIngesta(job.id, file.relativePath),
    sha256: file.sha256,
    bytes: file.bytes,
    pages: file.pages
  }));
  if (sources.length !== sourceIds.size || sources.reduce((total, source) => total + source.bytes, 0) > MAX_JOB_BYTES) {
    throw new ErrorAplicacion('OMR_DATASET_ORIGEN_INVALIDO', 'Una fuente seleccionada no está disponible para exportación', 409);
  }

  const tempCaptureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-pilot-captures-'));
  let archivo: Awaited<ReturnType<typeof generarZipDatasetOmr>> | undefined;
  try {
    const archivosFuente = new Map<string, Buffer>();
    const answerKeyByFolio: Record<string, Record<number, import('./porFolioDataset.js').OpcionOmr>> = {};
    const captures = [];
    for (const page of pages) {
      const exam = examenes.find((candidate) => candidate.id === page.examId)!;
      const mapaOmr = json<MapaOmr>(exam.mapaOmr, null as never);
      const recovery = json<RecoveryManifest>(exam.recoveryManifest, null as never);
      if (!mapaOmr || !recovery || !verificarRecoveryManifest(recovery)
        || recovery.examId !== exam.id
        || recovery.docenteId !== docenteId
        || recovery.loteId !== String(exam.loteId ?? '')
        || recovery.folio !== String(exam.folio).toUpperCase()
        || JSON.stringify(recovery.mapaOmrSnapshot) !== JSON.stringify(mapaOmr)) {
        throw new ErrorAplicacion('OMR_DATASET_MANIFIESTO_NO_VERIFICADO', 'No se exporta una página sin mapa y clave cubiertos por el manifiesto firmado del examen', 422);
      }
      const answerKey = extraerClaveCompletaRecoveryManifest(recovery);
      const existingKey = answerKeyByFolio[String(exam.folio).toUpperCase()];
      if (existingKey && JSON.stringify(existingKey) !== JSON.stringify(answerKey)) {
        throw new ErrorAplicacion('OMR_DATASET_CLAVE_VARIANTE_CONFLICTIVA', 'Un mismo folio produjo claves distintas durante la exportación', 422);
      }
      answerKeyByFolio[String(exam.folio).toUpperCase()] = answerKey;
      const examPage = Number(page.examPage);
      const mapaPagina = construirMapaOmrPaginaPilotoReal(mapaOmr, examPage);
      if (mapaPagina.qr.texto !== recovery.pages.find((entry) => entry.numeroPagina === examPage)?.qrTexto) {
        throw new ErrorAplicacion('OMR_DATASET_QR_MANIFIESTO_CONFLICTIVO', 'El QR del mapa de página no coincide con el manifiesto firmado', 422);
      }
      const respuestasVerdadTerreno = page.groundTruthReview?.responses ?? page.responses;
      const humanReviewVerdadTerreno = page.groundTruthReview?.humanReview ?? page.humanReview;
      const manualQuestions = respuestasVerdadTerreno.map((response) => response.numeroPregunta).sort((a, b) => a - b);
      const mapQuestions = mapaPagina.preguntas.map((question) => question.numeroPregunta).sort((a, b) => a - b);
      if (manualQuestions.length !== mapQuestions.length || new Set(manualQuestions).size !== manualQuestions.length || mapQuestions.some((number) => !manualQuestions.includes(number))) {
        throw new ErrorAplicacion('OMR_DATASET_REVISION_INCOMPLETA', 'La página debe tener una etiqueta revisada por cada reactivo del mapa OMR', 422);
      }
      const source = sources.find((item) => item.id === page.sourceFileId);
      if (!source) throw new ErrorAplicacion('OMR_DATASET_ORIGEN_INVALIDO', 'No se encontró el PDF fuente de una página seleccionada', 409);
      const imageSource = archivosFuente.get(page.sourceFileId) ?? await fs.readFile(source.path);
      if (!archivosFuente.has(page.sourceFileId)) {
        if (sha256(imageSource) !== source.sha256) throw new ErrorAplicacion('OMR_DATASET_ORIGEN_INVALIDO', 'El PDF original cambió antes de rasterizar la página revisada', 409);
        archivosFuente.set(page.sourceFileId, imageSource);
      }
      const raster = await rasterizarPdfParaPreview(imageSource, { dpi: 300, desdePagina: page.sourcePage, cantidadPaginas: 1 });
      const image = raster.paginas[0];
      if (!image || !image.dataUrl.startsWith('data:image/png;base64,')) throw new ErrorAplicacion('OMR_DATASET_RASTER_INVALIDO', 'No se generó una imagen PNG de la página fuente', 409);
      const imageBytes = Buffer.from(image.dataUrl.slice('data:image/png;base64,'.length), 'base64');
      const imageSha256 = sha256(imageBytes);
      const captureId = `page-${createHash('sha256').update(`${job.id}\n${page.pageIndex}\n${exam.id}\n${examPage}`).digest('hex').slice(0, 24)}`;
      const imageSourcePath = path.join(tempCaptureRoot, `${captureId}.png`);
      await fs.writeFile(imageSourcePath, imageBytes, { flag: 'wx' });
      const questions = [...mapaPagina.preguntas].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
      const responses = [...respuestasVerdadTerreno].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
      const bonusVisible = page.examPage === 1 ? page.groundTruthReview?.bonusVisible : undefined;
      if (page.examPage === 1 && typeof bonusVisible !== 'boolean') {
        throw new ErrorAplicacion('OMR_DATASET_BONO_SIN_ETIQUETA', 'La primera página requiere una etiqueta ciega sobre el bono visible para validar la nota final.', 422);
      }
      const truthRows = construirGroundTruthManualOmr({
        captureId,
        folio: String(exam.folio).toUpperCase(),
        numeroPagina: examPage,
        sourcePage: page.sourcePage,
        pageImageSha256: imageSha256,
        ...(examPage === 1 ? { bonusVisible: bonusVisible as boolean } : {}),
        humanReview: humanReviewVerdadTerreno!,
        responses: responses.map((response) => ({
          numeroPregunta: response.numeroPregunta,
          opcion: response.opcion,
          tipoMarcaManual: response.tipoMarcaManual!,
          selectedOptions: response.selectedOptions ?? []
        }))
      });
      captures.push({
        captureId,
        folio: String(exam.folio).toUpperCase(),
        numeroPagina: examPage,
        captureOrdinal: 1,
        imageSourcePath,
        imagePath: `images/${captureId}.png`,
        imageSha256,
        imageBytes: imageBytes.byteLength,
        mapaOmr: mapaPagina,
        questionRange: { from: questions[0]!.numeroPregunta, to: questions[questions.length - 1]!.numeroPregunta },
        sourcePath: `source-page-${page.sourcePage}`,
        sourceGroup: `review-${createHash('sha256').update(job.id).digest('hex').slice(0, 12)}`,
        expectedQr: mapaPagina.qr.texto,
        ...(examPage === 1 ? { bonusVisible: bonusVisible as boolean } : {}),
        truthRows
      });
    }
    archivo = await generarZipDatasetOmr({
      sources,
      pages,
      pageIndexes: indexes,
      pilotReal: { captures, answerKeyByFolio }
    });
  } finally {
    await fs.rm(tempCaptureRoot, { recursive: true, force: true }).catch(() => undefined);
  }
  res.status(200);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="omr-dataset.zip"');
  res.setHeader('Content-Length', String(archivo.bytes));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-SHA256', archivo.sha256);
  res.setHeader('X-OMR-Source-Count', String(archivo.sourceCount));
  res.setHeader('X-OMR-Label-Count', String(archivo.labelCount));
  try {
    await pipeline(createReadStream(archivo.path), res);
  } finally {
    await archivo?.cleanup().catch(() => undefined);
  }
}

