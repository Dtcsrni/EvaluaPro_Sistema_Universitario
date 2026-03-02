import fs from 'node:fs/promises';
import type { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { requerirPermiso } from '../modulo_autenticacion/middlewarePermisos';
import { validarCuerpo } from '../../compartido/validaciones/validar';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { ExamenPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { analizarOmr, leerQrDesdeImagen } from '../modulo_escaneo_omr/servicioOmr';
import { listarFamiliasOmrV1, recomendarFamiliaOmrV1, resolverFamiliaOmrV1 } from './familiasOmrV1';
import {
  OMR_RUNTIME_VERSION_V1,
  type AssessmentPreviewV1,
  type GeneratedAssessmentSummaryV1,
  type OmrExceptionV1,
  type OmrScanStatus
} from './contratosOmrV1';
import { OmrSheetFamily } from './modeloOmrSheetFamily';
import { OmrSheetRevision } from './modeloOmrSheetRevision';
import { OmrScanJob } from './modeloOmrScanJob';
import { esquemaCrearOmrScanJob, esquemaCrearOmrSheetFamily, esquemaCrearOmrSheetRevision, esquemaResolverOmrException } from './validacionesOmrV1';
import { generarBundleAssessmentOmrV1, persistirArtifactsAssessmentOmrV1 } from './servicioRenderOmrV1';
import {
  agruparPaginasPorHojaV1,
  type AnswerKeyEntryV1,
  calificarRespuestasV1,
  crearGenerationSeedV1,
  crearPreviewFingerprintV1,
  crearTemplateSnapshotV1,
  generarVersionesDeterministasV1,
  resolverAutoGradableV1,
  resolverBindingsOmrV1,
  resolverScanStatusV1,
  resumirPaginasJobV1,
  type PreguntaBaseWorkflowV1
} from './workflowOmrV1';

type MapaPaginaOmrV1 = Parameters<typeof analizarOmr>[1] & {
  qr?: { texto?: unknown };
};

type ParsedQrPayloadV1 = {
  sheetSerial: string;
  familyCode: string;
  revision: number;
  pageIndex: number;
  versionPolicy: string;
};

type CapturaInputOmrV1 = {
  nombreArchivo?: string;
  imagenBase64: string;
};

type CapturaExpandidaOmrV1 = {
  nombreArchivo?: string;
  imagenBase64: string;
  paginaOrigen?: number;
};

function resolverChromiumSistemaOmrV1() {
  const candidatos = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  return candidatos[0] ?? '';
}

async function rasterizarPdfConNavegadorOmrV1(buffer: Buffer, nombreArchivo?: string) {
  const executablePath = resolverChromiumSistemaOmrV1();
  if (!executablePath) {
    throw new Error('No hay un ejecutable Chromium/Edge disponible para rasterizar PDF.');
  }

  const pdf = await PDFDocument.load(buffer);
  const paginas = pdf.getPages();
  const dirTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evalupro-omr-pdf-'));
  const rutaPdf = path.join(dirTemporal, nombreArchivo && /\.pdf$/i.test(nombreArchivo) ? nombreArchivo : `${randomUUID()}.pdf`);

  try {
    await fs.writeFile(rutaPdf, buffer);
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      executablePath,
      headless: true
    });

    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
      const capturas: CapturaExpandidaOmrV1[] = [];
      for (let index = 0; index < paginas.length; index += 1) {
        const pdfPage = paginas[index]!;
        const widthPx = Math.max(900, Math.round((pdfPage.getWidth() * 200) / 72));
        const heightPx = Math.max(1200, Math.round((pdfPage.getHeight() * 200) / 72));
        const fileUrl = `file:///${rutaPdf.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1%3A')}`;
        const html = `<!doctype html><html><body style="margin:0;background:#ffffff"><embed id="pdf" src="${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&page=${index + 1}" type="application/pdf" width="${widthPx}" height="${heightPx}"></body></html>`;
        await page.setViewportSize({ width: widthPx, height: heightPx });
        await page.setContent(html, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        const embed = page.locator('#pdf');
        const raw = await embed.screenshot({ type: 'png' });
        const normalized = await sharp(raw).rotate().grayscale().normalize().png().toBuffer();
        capturas.push({
          nombreArchivo: `${String(nombreArchivo || 'captura.pdf').replace(/\.pdf$/i, '')}_p${index + 1}.png`,
          imagenBase64: `data:image/png;base64,${normalized.toString('base64')}`,
          paginaOrigen: index + 1
        });
      }
      return capturas;
    } finally {
      await browser.close();
    }
  } finally {
    await fs.rm(dirTemporal, { recursive: true, force: true });
  }
}

function shuffleDeterminista<T>(items: T[], seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function parseOmrQrPayloadV1(value?: string | null): ParsedQrPayloadV1 | null {
  const clean = String(value ?? '').trim();
  const match = /^OMR1:([^:]+):([^:]+):(\d+):(\d+):([^:]+)$/i.exec(clean);
  if (!match) return null;
  return {
    sheetSerial: String(match[1] ?? '').trim().toUpperCase(),
    familyCode: String(match[2] ?? '').trim().toUpperCase(),
    revision: Number(match[3] ?? 1),
    pageIndex: Number(match[4] ?? 1),
    versionPolicy: String(match[5] ?? '')
  };
}

function resolvePreviewState(args: { blockingIssues: string[]; warnings: string[] }) {
  if (args.blockingIssues.length > 0) return 'blocked' as const;
  if (args.warnings.length > 0) return 'warning' as const;
  return 'ready' as const;
}

function normalizarTextoPreviewOmrV1(value: unknown) {
  return String(value ?? '')
    .replace(/[→⇒⟶]/g, '->')
    .replace(/[←⇐⟵]/g, '<-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^	\n\r\x20-\x7E\u00A1-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerBase64ContenidoOmrV1(base64: string): { mimeType: string; contenido: string } {
  const limpio = String(base64 || '').trim();
  const match = /^data:([a-z0-9/+.-]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(limpio);
  if (match) {
    return {
      mimeType: String(match[1] || 'image/png').toLowerCase(),
      contenido: String(match[2] || '').replace(/\s+/g, '')
    };
  }
  return {
    mimeType: 'image/png',
    contenido: limpio.replace(/\s+/g, '')
  };
}

async function expandirCapturasOmrV1(capturas: CapturaInputOmrV1[], sourceType: 'pdf' | 'image_batch' | 'camera_capture') {
  const resultado: CapturaExpandidaOmrV1[] = [];
  for (const captura of Array.isArray(capturas) ? capturas : []) {
    const { mimeType, contenido } = extraerBase64ContenidoOmrV1(captura.imagenBase64);
    if (!contenido) continue;
    const buffer = Buffer.from(contenido, 'base64');
    const esPdf = sourceType === 'pdf' || mimeType === 'application/pdf' || /\.pdf$/i.test(String(captura.nombreArchivo ?? ''));
    if (!esPdf) {
      resultado.push({
        nombreArchivo: captura.nombreArchivo,
        imagenBase64: captura.imagenBase64
      });
      continue;
    }
    try {
      const meta = await sharp(buffer, { density: 200, page: 0 }).metadata().catch(() => null);
      const totalPaginas = Math.max(1, Number(meta?.pages ?? 1));
      for (let pagina = 0; pagina < totalPaginas; pagina += 1) {
        const png = await sharp(buffer, { density: 200, page: pagina, pages: 1 })
          .rotate()
          .grayscale()
          .normalize()
          .png()
          .toBuffer();
        resultado.push({
          nombreArchivo: `${String(captura.nombreArchivo || 'captura.pdf').replace(/\.pdf$/i, '')}_p${pagina + 1}.png`,
          imagenBase64: `data:image/png;base64,${png.toString('base64')}`,
          paginaOrigen: pagina + 1
        });
      }
    } catch {
      const capturasFallback = await rasterizarPdfConNavegadorOmrV1(buffer, captura.nombreArchivo);
      resultado.push(...capturasFallback);
    }
  }
  return resultado;
}

function warningsFromPreview(args: {
  targetPages: number;
  pagesEstimated: number;
  familyCapacity: number;
  questionCount: number;
  imageHeavy: number;
}) {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  if (args.pagesEstimated > args.targetPages) warnings.push(`El cuadernillo requiere ${args.pagesEstimated} pagina(s) estimadas para ${args.targetPages} configuradas.`);
  if (args.familyCapacity < args.questionCount) blockingIssues.push(`La familia OMR solo soporta ${args.familyCapacity} reactivos y la plantilla usa ${args.questionCount}.`);
  if (args.imageHeavy > 0) warnings.push(`${args.imageHeavy} reactivo(s) tienen imagen; el cuadernillo se desacopla de la hoja OMR, pero conviene revisar densidad.`);
  return { warnings, blockingIssues };
}

async function cargarPlantillaDocente(plantillaId: string, docenteId: string) {
  const plantilla = await ExamenPlantilla.findById(plantillaId).lean();
  if (!plantilla) throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  if (String(plantilla.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }
  return plantilla;
}

async function construirPreguntasPlantillaV1(plantilla: Record<string, unknown>, docenteId: string, seed: string) {
  const temas = Array.isArray(plantilla.temas) ? plantilla.temas.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
  const preguntasIds = Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds : [];
  const baseFiltro: Record<string, unknown> = { docenteId, activo: true };
  if (plantilla.periodoId) baseFiltro.periodoId = plantilla.periodoId;
  const preguntasDb =
    temas.length > 0
      ? await BancoPregunta.find({ ...baseFiltro, tema: { $in: temas } }).lean()
      : await BancoPregunta.find({ ...baseFiltro, _id: { $in: preguntasIds } }).lean();
  if (!Array.isArray(preguntasDb) || preguntasDb.length === 0) {
    throw new ErrorAplicacion('SIN_PREGUNTAS', 'La plantilla no tiene preguntas disponibles', 400);
  }
  const reactivosObjetivo = Math.max(1, Number(plantilla.reactivosObjetivo ?? preguntasDb.length));
  const ordered = shuffleDeterminista(preguntasDb, seed).slice(0, reactivosObjetivo);
  return ordered.map((pregunta) => {
    const version =
      pregunta.versiones.find((item: { numeroVersion: number }) => item.numeroVersion === pregunta.versionActual) ??
      pregunta.versiones[0];
    return {
      id: String(pregunta._id),
      enunciado: normalizarTextoPreviewOmrV1(version?.enunciado),
      imagenUrl: String(version?.imagenUrl ?? '').trim() || undefined,
      opciones: Array.isArray(version?.opciones)
        ? version.opciones.map((opcion: { texto?: unknown; esCorrecta?: unknown }) => ({
            texto: normalizarTextoPreviewOmrV1(opcion.texto),
            esCorrecta: Boolean(opcion.esCorrecta)
          }))
        : []
    } satisfies PreguntaBaseWorkflowV1;
  });
}

function aExceptions(args: {
  qrTexto?: string | null;
  qrEsperado?: string | null;
  familyCode?: string | null;
  expectedFamilyCode?: string | null;
  sheetInstance?: Record<string, unknown> | null;
  resultado: {
    advertencias?: string[];
    motivosRevision?: string[];
    respuestasDetectadas?: Array<{ opcion?: string | null; flags?: string[] }>;
  };
  studentId?: string | null;
  versionCode?: string | null;
}) {
  const warnings = Array.isArray(args.resultado.advertencias) ? args.resultado.advertencias : [];
  const reasons = Array.isArray(args.resultado.motivosRevision) ? args.resultado.motivosRevision : [];
  const exceptions: OmrExceptionV1[] = [];
  if (!args.qrTexto) {
    exceptions.push({ code: 'qr_missing', severity: 'blocking', message: 'No se detectó QR en la hoja.', recommendedAction: 'Vuelve a capturar la hoja completa.' });
  }
  if (args.qrTexto && args.qrEsperado && args.qrTexto !== args.qrEsperado) {
    exceptions.push({ code: 'qr_mismatch', severity: 'blocking', message: 'El QR detectado no coincide con la hoja esperada.', recommendedAction: 'Revisa que la captura corresponda a la hoja correcta.' });
  }
  if (args.familyCode && args.expectedFamilyCode && args.familyCode !== args.expectedFamilyCode) {
    exceptions.push({ code: 'sheet_family_unknown', severity: 'blocking', message: 'La familia OMR detectada no coincide con la evaluación.', recommendedAction: 'Vuelve a capturar usando la hoja correcta.' });
  }
  if (!args.sheetInstance) {
    exceptions.push({ code: 'sheet_serial_unknown', severity: 'blocking', message: 'La hoja no está registrada en este assessment.', recommendedAction: 'Valida que pertenezca a la evaluación generada.' });
  }
  if (!String(args.studentId ?? '').trim()) {
    exceptions.push({ code: 'student_id_missing', severity: 'warning', message: 'La hoja no tiene identidad de alumno resuelta.', recommendedAction: 'Asigna o corrige el alumno en revisión manual.' });
  }
  if (!String(args.versionCode ?? '').trim()) {
    exceptions.push({ code: 'version_missing', severity: 'warning', message: 'La versión del examen no está resuelta.', recommendedAction: 'Selecciona la versión correcta en revisión manual.' });
  }
  for (const warning of warnings) {
    const text = String(warning).toLowerCase();
    if (text.includes('no se detecto qr')) continue;
    exceptions.push({
      code: text.includes('calidad') ? 'low_contrast' : 'manual_review_required',
      severity: 'warning',
      message: String(warning),
      recommendedAction: 'Revisar la hoja en modo de corrección.'
    });
  }
  for (const reason of reasons) {
    const lower = String(reason).toLowerCase();
    exceptions.push({
      code: lower.includes('alineacion') ? 'anchors_unstable' : lower.includes('multiple marca') ? 'double_mark' : 'manual_review_required',
      severity: 'warning',
      message: String(reason),
      recommendedAction: 'Corregir manualmente o volver a escanear.'
    });
  }
  for (const respuesta of Array.isArray(args.resultado.respuestasDetectadas) ? args.resultado.respuestasDetectadas : []) {
    const flags = Array.isArray(respuesta.flags) ? respuesta.flags : [];
    if (flags.includes('doble_marca')) {
      exceptions.push({
        code: 'double_mark',
        severity: 'warning',
        message: 'Se detectó doble marca en al menos una respuesta.',
        recommendedAction: 'Confirma la respuesta correcta en revisión manual.'
      });
      break;
    }
  }
  return exceptions;
}

function sanitizeExceptionsAfterResolution(exceptions: OmrExceptionV1[], args: { studentId?: string | null; versionCode?: string | null; finalResponses?: unknown[] }) {
  return exceptions.filter((exception) => {
    if (exception.code === 'student_id_missing' && String(args.studentId ?? '').trim()) return false;
    if (exception.code === 'version_missing' && String(args.versionCode ?? '').trim()) return false;
    if ((exception.code === 'double_mark' || exception.code === 'manual_review_required') && Array.isArray(args.finalResponses) && args.finalResponses.length > 0) {
      return false;
    }
    return true;
  });
}

function resolverGeneratedAssessmentSummary(examenGenerado: Record<string, unknown>): GeneratedAssessmentSummaryV1 {
  const id = String(examenGenerado._id ?? '');
  return {
    _id: id,
    folio: String(examenGenerado.folio ?? ''),
    generationSeed: String(examenGenerado.generationSeed ?? ''),
    previewFingerprint: String(examenGenerado.previewFingerprint ?? ''),
    bookletPdfUrl: id ? `/assessments/generated/${encodeURIComponent(id)}/booklet.pdf` : undefined,
    omrSheetPdfUrl: id ? `/assessments/generated/${encodeURIComponent(id)}/omr-sheet.pdf` : undefined,
    studentPacketZipUrl:
      id && String((examenGenerado as { studentPacketZipArtifact?: { path?: unknown } }).studentPacketZipArtifact?.path ?? '').trim()
        ? `/assessments/generated/${encodeURIComponent(id)}/student-packets.zip`
        : undefined,
    answerKeyUrl:
      id && String((examenGenerado as { answerKeyArtifact?: { path?: unknown } }).answerKeyArtifact?.path ?? '').trim()
        ? `/assessments/generated/${encodeURIComponent(id)}/answer-key.json`
        : undefined,
    manifestUrl:
      id && String((examenGenerado as { manifestArtifact?: { path?: unknown } }).manifestArtifact?.path ?? '').trim()
        ? `/assessments/generated/${encodeURIComponent(id)}/manifest.json`
        : undefined,
    versionSet: Array.isArray(examenGenerado.versionSet)
      ? (examenGenerado.versionSet as Array<{ versionCode?: unknown; questionCount?: unknown }>).map((item) => ({
          versionCode: String(item.versionCode ?? ''),
          questionCount: Number(item.questionCount ?? 0)
        }))
      : [],
    statisticsSummary: {
      sheetCount: Number((examenGenerado as { statisticsSummary?: { sheetCount?: unknown } }).statisticsSummary?.sheetCount ?? 0),
      studentPacketCount: Number((examenGenerado as { statisticsSummary?: { studentPacketCount?: unknown } }).statisticsSummary?.studentPacketCount ?? 0),
      versionCount: Number((examenGenerado as { statisticsSummary?: { versionCount?: unknown } }).statisticsSummary?.versionCount ?? 0)
    }
  };
}

async function construirPreview(args: {
  plantillaId: string;
  docenteId: string;
  generationSeed?: string | null;
}) {
  const plantilla = await cargarPlantillaDocente(args.plantillaId, args.docenteId);
  const snapshot = crearTemplateSnapshotV1(plantilla as unknown as Record<string, unknown>);
  const previewFingerprint = crearPreviewFingerprintV1(snapshot);
  const generationSeed = crearGenerationSeedV1(args.generationSeed);
  const preguntas = await construirPreguntasPlantillaV1(plantilla as unknown as Record<string, unknown>, args.docenteId, generationSeed);
  const family = resolverFamiliaOmrV1(String((plantilla as { omrConfig?: { sheetFamilyCode?: unknown } }).omrConfig?.sheetFamilyCode ?? ''));
  const bookletConfig = (plantilla as { bookletConfig?: { targetPages?: unknown } }).bookletConfig ?? {};
  const versionCount = Math.max(1, Number((plantilla as { defaultVersionCount?: unknown }).defaultVersionCount ?? 1));
  const versions = generarVersionesDeterministasV1({ preguntas, versionCount, generationSeed });
  const bindings = resolverBindingsOmrV1({
    prefillMode: 'none',
    folio: 'PREVIEW-V1',
    versionCodes: versions.map((version) => version.versionCode)
  });
  const bundle = await generarBundleAssessmentOmrV1({
    plantilla,
    versions,
    family,
    folio: 'PREVIEW-V1',
    versionCount,
    bindings
  });
  const targetPages = Math.max(1, Number(bookletConfig.targetPages ?? (plantilla as { numeroPaginas?: unknown }).numeroPaginas ?? 1));
  const warningSummary = warningsFromPreview({
    targetPages,
    pagesEstimated: bundle.bookletDiagnostics.pagesEstimated,
    familyCapacity: family.questionCapacity,
    questionCount: preguntas.length,
    imageHeavy: bundle.bookletDiagnostics.imageHeavyQuestions.length
  });
  const warnings = [...warningSummary.warnings, ...bundle.bookletDiagnostics.layoutWarnings];
  const blockingIssues = [...warningSummary.blockingIssues];
  const preview: AssessmentPreviewV1 = {
    omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
    assessmentTemplateId: String(plantilla._id),
    questionCount: preguntas.length,
    proposedGenerationSeed: generationSeed,
    previewFingerprint,
    recommendedSheetFamily: recomendarFamiliaOmrV1(preguntas.length).familyCode,
    previewState: resolvePreviewState({ blockingIssues, warnings }),
    bookletPreview: {
      pagesConfigured: targetPages,
      pagesEstimated: bundle.bookletDiagnostics.pagesEstimated,
      questionsPerPage: bundle.bookletDiagnostics.questionsPerPage,
      imageHeavyQuestions: bundle.bookletDiagnostics.imageHeavyQuestions,
      layoutWarnings: bundle.bookletDiagnostics.layoutWarnings,
      pdfUrl: `/assessments/templates/${String(plantilla._id)}/preview/booklet.pdf?generationSeed=${encodeURIComponent(generationSeed)}`
    },
    omrSheetPreview: {
      familyCode: family.familyCode,
      familyRevision: 1,
      questionCapacity: family.questionCapacity,
      questionsUsed: preguntas.length,
      unusedQuestionsIgnored: Math.max(0, family.questionCapacity - preguntas.length),
      studentIdDigits: family.studentIdDigits,
      versionBubbleCount: family.versionBubbleCount,
      identityMode: 'qr_plus_bubbled_id',
      pdfUrl: `/assessments/templates/${String(plantilla._id)}/preview/omr-sheet.pdf?generationSeed=${encodeURIComponent(generationSeed)}`
    },
    diagnostics: {
      bookletDensityScore: Number(Math.max(0, 1 - Math.max(0, bundle.bookletDiagnostics.pagesEstimated - targetPages) * 0.3).toFixed(4)),
      omrReadabilityScore: Number(Math.min(1, bundle.omrDiagnostics.bubbleSpacingScore * 0.55 + (1 - bundle.omrDiagnostics.anchorFootprintRatio) * 0.45).toFixed(4)),
      anchorFootprintRatio: bundle.omrDiagnostics.anchorFootprintRatio,
      qrFootprintRatio: bundle.omrDiagnostics.qrFootprintRatio,
      bubbleSpacingScore: bundle.omrDiagnostics.bubbleSpacingScore,
      pagesWithLowDensity: bundle.bookletDiagnostics.questionsPerPage.map((count, idx) => ({ count, idx })).filter((item) => item.count < 6).map((item) => item.idx + 1),
      hardLayoutWarnings: [...warningSummary.blockingIssues]
    },
    blockingIssues,
    warnings
  };
  return { preview, bundle };
}

async function cargarGeneratedAssessment(id: string, docenteId: string) {
  const generado = await ExamenGenerado.findById(id).lean();
  if (!generado) throw new ErrorAplicacion('ASSESSMENT_NO_ENCONTRADO', 'Assessment generado no encontrado', 404);
  if (String(generado.docenteId) !== String(docenteId)) throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a esta evaluación', 403);
  return generado;
}

function findSheetInstance(assessment: Record<string, unknown>, sheetSerial: string, pageIndex: number) {
  const instances = Array.isArray(assessment.sheetInstances) ? assessment.sheetInstances : [];
  return (
    instances.find(
      (instance) =>
        String((instance as { sheetSerial?: unknown }).sheetSerial ?? '').trim().toUpperCase() === sheetSerial &&
        Number((instance as { pageIndex?: unknown }).pageIndex ?? 0) === Number(pageIndex)
    ) ?? null
  );
}

function findPageBlueprint(assessment: Record<string, unknown>, pageIndex: number) {
  const pages = Array.isArray((assessment as { mapaOmr?: { paginas?: unknown[] } }).mapaOmr?.paginas)
    ? (((assessment as { mapaOmr?: { paginas?: unknown[] } }).mapaOmr?.paginas ?? []) as Array<MapaPaginaOmrV1>)
    : [];
  return pages.find((page) => Number((page as { numeroPagina?: unknown }).numeroPagina ?? 0) === Number(pageIndex)) ?? pages[0] ?? null;
}

function findQuestionRangeForPage(assessment: Record<string, unknown>, pageIndex: number) {
  const pages = Array.isArray((assessment as { mapaOmr?: { paginas?: unknown[] } }).mapaOmr?.paginas)
    ? (((assessment as { mapaOmr?: { paginas?: unknown[] } }).mapaOmr?.paginas ?? []) as Array<MapaPaginaOmrV1>)
    : [];
  const page = pages.find((item) => Number((item as { numeroPagina?: unknown }).numeroPagina ?? 0) === Number(pageIndex));
  const preguntas = Array.isArray(page?.preguntas) ? page!.preguntas : [];
  const numbers = preguntas.map((pregunta) => Number(pregunta.numeroPregunta)).filter((value) => Number.isFinite(value));
  if (numbers.length === 0) return { start: 1, end: 0 };
  return { start: Math.min(...numbers), end: Math.max(...numbers) };
}

function selectAnswerKeyRange(assessment: Record<string, unknown>, versionCode: string | null, pageIndex: number) {
  const answerKeySet = (assessment as { answerKeySet?: Record<string, Array<{ numeroPregunta?: unknown; idPregunta?: unknown; correcta?: unknown }>> }).answerKeySet;
  const allKeys =
    (answerKeySet && typeof answerKeySet === 'object'
      ? (answerKeySet[String(versionCode ?? '').trim().toUpperCase()] ??
          answerKeySet[Object.keys(answerKeySet).sort()[0] ?? ''] ??
          [])
      : []) ?? [];
  const range = findQuestionRangeForPage(assessment, pageIndex);
  return Array.isArray(allKeys)
    ? allKeys.filter((entry) => {
        const numeroPregunta = Number(entry.numeroPregunta ?? 0);
        return Number.isInteger(numeroPregunta) && numeroPregunta >= range.start && numeroPregunta <= range.end;
      }).map((entry) => ({
        numeroPregunta: Number(entry.numeroPregunta ?? 0),
        idPregunta: String(entry.idPregunta ?? ''),
        correcta: String(entry.correcta ?? '').trim() || null
      } satisfies AnswerKeyEntryV1))
    : [];
}

function buildGeneratedAssessmentResponse(examenGenerado: Record<string, unknown>) {
  return {
    examenGenerado,
    generatedAssessment: resolverGeneratedAssessmentSummary(examenGenerado),
    advertencias: Array.isArray((examenGenerado as { statisticsSummary?: { warnings?: unknown[] } }).statisticsSummary?.warnings)
      ? (((examenGenerado as { statisticsSummary?: { warnings?: unknown[] } }).statisticsSummary?.warnings ?? []) as string[])
      : []
  };
}

export async function listarFamiliasOmr(_req: SolicitudDocente, res: Response) {
  const families = await OmrSheetFamily.find({}).sort({ familyCode: 1 }).lean();
  res.json({ families: families.length > 0 ? families : listarFamiliasOmrV1() });
}

export async function obtenerFamiliaOmr(req: SolicitudDocente, res: Response) {
  const familyCode = String(req.params.id || '').trim().toUpperCase();
  const family = await OmrSheetFamily.findOne({ familyCode }).lean();
  if (!family) throw new ErrorAplicacion('OMR_FAMILY_NO_ENCONTRADA', 'Familia OMR no encontrada', 404);
  const revisions = await OmrSheetRevision.find({ familyId: family._id }).sort({ revision: 1 }).lean();
  res.json({ family, revisions });
}

export async function crearFamiliaOmr(req: SolicitudDocente, res: Response) {
  const payload = req.body as z.infer<typeof esquemaCrearOmrSheetFamily>;
  const family = await OmrSheetFamily.create(payload);
  res.status(201).json({ family });
}

export async function crearRevisionFamiliaOmr(req: SolicitudDocente, res: Response) {
  const familyCode = String(req.params.id || '').trim().toUpperCase();
  const family = await OmrSheetFamily.findOne({ familyCode });
  if (!family) throw new ErrorAplicacion('OMR_FAMILY_NO_ENCONTRADA', 'Familia OMR no encontrada', 404);
  const payload = req.body as z.infer<typeof esquemaCrearOmrSheetRevision>;
  const revision = await OmrSheetRevision.create({
    familyId: family._id,
    revision: payload.revision,
    geometry: payload.geometry,
    qualityThresholds: payload.qualityThresholds ?? {},
    renderTemplateVersion: 1,
    recognitionEngineVersion: 1,
    isActive: payload.isActive ?? true
  });
  res.status(201).json({ revision });
}

export async function previsualizarAssessment(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { preview } = await construirPreview({
    plantillaId: String(req.params.id || ''),
    docenteId,
    generationSeed: String(req.query.generationSeed ?? '')
  });
  res.json(preview);
}

export async function previsualizarAssessmentBookletPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { bundle } = await construirPreview({
    plantillaId: String(req.params.id || ''),
    docenteId,
    generationSeed: String(req.query.generationSeed ?? '')
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="assessment-booklet-v1.pdf"');
  res.send(bundle.bookletPdfBytes);
}

export async function previsualizarAssessmentOmrSheetPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { bundle } = await construirPreview({
    plantillaId: String(req.params.id || ''),
    docenteId,
    generationSeed: String(req.query.generationSeed ?? '')
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="assessment-omr-sheet-v1.pdf"');
  res.send(bundle.omrSheetPdfBytes);
}

export async function generarAssessment(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const plantilla = await cargarPlantillaDocente(String(req.params.id || ''), docenteId);
  const snapshot = crearTemplateSnapshotV1(plantilla as unknown as Record<string, unknown>);
  const previewFingerprint = crearPreviewFingerprintV1(snapshot);
  const requestedFingerprint = String((req.body as { previewFingerprint?: unknown }).previewFingerprint ?? '').trim();
  if (requestedFingerprint && requestedFingerprint !== previewFingerprint) {
    throw new ErrorAplicacion('ASSESSMENT_PREVIEW_STALE', 'La preview ya no coincide con el estado actual de la plantilla.', 409, {
      expected: previewFingerprint,
      received: requestedFingerprint
    });
  }

  const generationSeed = crearGenerationSeedV1(String((req.body as { generationSeed?: unknown }).generationSeed ?? '').trim());
  const preguntas = await construirPreguntasPlantillaV1(plantilla as unknown as Record<string, unknown>, docenteId, generationSeed);
  const requestedFamily = String((req.body as { sheetFamilyCode?: unknown }).sheetFamilyCode ?? '').trim();
  const family = resolverFamiliaOmrV1(
    requestedFamily || String((plantilla as { omrConfig?: { sheetFamilyCode?: unknown } }).omrConfig?.sheetFamilyCode ?? '')
  );
  if (family.questionCapacity < preguntas.length) {
    throw new ErrorAplicacion('OMR_FAMILY_CAPACIDAD_INSUFICIENTE', 'La familia OMR no cubre el total de reactivos de la evaluación.', 409);
  }
  const requestedVersionCount = Number((req.body as { versionCount?: unknown }).versionCount ?? 0);
  const versionCount = Math.max(1, requestedVersionCount || Number((plantilla as { defaultVersionCount?: unknown }).defaultVersionCount ?? 1));
  const versions = generarVersionesDeterministasV1({ preguntas, versionCount, generationSeed });
  const prefillMode: 'none' = 'none';
  const [docente, periodo] = await Promise.all([
    Docente.findById(docenteId).lean(),
    plantilla.periodoId ? Periodo.findById(plantilla.periodoId).lean() : Promise.resolve(null)
  ]);
  const folio = createHash('sha1').update(`${String(plantilla._id)}:${generationSeed}`).digest('hex').slice(0, 10).toUpperCase();
  const bindings = resolverBindingsOmrV1({
    prefillMode,
    folio,
    students: [],
    versionCodes: versions.map((version) => version.versionCode)
  });
  const bundle = await generarBundleAssessmentOmrV1({
    plantilla,
    versions,
    family,
    folio,
    versionCount,
    bindings
  });
  const artifacts = await persistirArtifactsAssessmentOmrV1({
    folio,
    bookletPdfBytes: bundle.bookletPdfBytes,
    omrSheetPdfBytes: bundle.omrSheetPdfBytes,
    studentPackets: bundle.studentPackets,
    manifestBytes: bundle.manifestBytes,
    answerKeyBytes: bundle.answerKeyBytes
  });
  const paginas = bundle.mapaOmrV1.paginas.map((pagina) => {
    const preguntasPagina = Array.isArray(pagina.preguntas) ? pagina.preguntas : [];
    const numeros = preguntasPagina.map((pregunta) => Number(pregunta.numeroPregunta ?? 0)).filter((numero) => Number.isFinite(numero));
    return {
      numero: pagina.numeroPagina,
      qrTexto: `OMR1:${folio}:${family.familyCode}:1:${pagina.numeroPagina}:${versionCount > 1 ? 'multi' : 'single'}`,
      preguntasDel: numeros.length > 0 ? Math.min(...numeros) : 0,
      preguntasAl: numeros.length > 0 ? Math.max(...numeros) : 0
    };
  });
  const versionSet = bundle.versionSet.map((version) => ({ versionCode: version.versionCode, questionCount: version.questionCount }));
  const answerKeySet = Object.fromEntries(bundle.versionSet.map((version) => [version.versionCode, version.answerKey]));
  const statisticsSummary = {
    sheetCount: bundle.sheetInstances.length,
    studentPacketCount: artifacts.studentPacketArtifacts.length,
    versionCount: versionSet.length,
    warnings: bundle.bookletDiagnostics.layoutWarnings
  };

  const examenGenerado = await ExamenGenerado.create({
    docenteId,
    periodoId: plantilla.periodoId,
    plantillaId: plantilla._id,
    folio,
    loteId: createHash('md5').update(`${folio}:lote`).digest('hex').slice(0, 8).toUpperCase(),
    estado: 'generado',
    preguntasIds: versions[0]?.preguntas.map((pregunta) => pregunta.id) ?? [],
    mapaVariante: {
      versions: Object.fromEntries(
        versions.map((version) => [
          version.versionCode,
          {
            ordenPreguntas: version.orderQuestions,
            ordenOpcionesPorPregunta: version.optionOrderByQuestion
          }
        ])
      )
    },
    paginas,
    rutaPdf: artifacts.bookletPath,
    bookletArtifact: { path: artifacts.bookletPath, docente: String((docente as { nombreCompleto?: unknown } | null)?.nombreCompleto ?? '') },
    omrSheetArtifact: { path: artifacts.omrSheetPath },
    studentPacketArtifacts: artifacts.studentPacketArtifacts,
    studentPacketZipArtifact: artifacts.studentPacketZipPath ? { path: artifacts.studentPacketZipPath } : null,
    manifestArtifact: { path: artifacts.manifestPath },
    answerKeyArtifact: { path: artifacts.answerKeyPath },
    questionMap: {
      totalPreguntas: preguntas.length,
      materia: String((periodo as { nombre?: unknown } | null)?.nombre ?? ''),
      versions: Object.fromEntries(
        versions.map((version) => [
          version.versionCode,
          {
            questionIds: version.orderQuestions,
            questionCount: version.preguntas.length
          }
        ])
      )
    },
    answerKeySet,
    versionSet,
    sheetInstances: bundle.sheetInstances,
    generationSeed,
    previewFingerprint,
    statisticsSummary,
    omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
    mapaOmr: {
      margenMm: 10,
      templateVersion: 1,
      paginas: bundle.mapaOmrV1.paginas,
      omrRuntimeVersion: OMR_RUNTIME_VERSION_V1,
      sheetFamilyCode: family.familyCode,
      sheetFamilyRevision: 1
    }
  });
  res.status(201).json(buildGeneratedAssessmentResponse(examenGenerado.toObject()));
}

export async function obtenerGeneratedAssessment(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  res.json({
    assessment: resolverGeneratedAssessmentSummary(generado as unknown as Record<string, unknown>),
    sheetInstances: Array.isArray(generado.sheetInstances) ? generado.sheetInstances : [],
    statisticsSummary: generado.statisticsSummary ?? {},
    versionSet: Array.isArray(generado.versionSet) ? generado.versionSet : [],
    studentPacketArtifacts: Array.isArray(generado.studentPacketArtifacts) ? generado.studentPacketArtifacts : []
  });
}

async function enviarArchivoAssessment(args: { res: Response; ruta: string; fileName: string; contentType: string }) {
  args.res.setHeader('Content-Type', args.contentType);
  args.res.setHeader('Content-Disposition', `attachment; filename="${args.fileName}"`);
  args.res.send(await fs.readFile(args.ruta));
}

export async function descargarGeneratedBooklet(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { bookletArtifact?: { path?: unknown } }).bookletArtifact?.path ?? generado.rutaPdf ?? '');
  if (!ruta) throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'No existe cuadernillo para esta evaluación', 404);
  await enviarArchivoAssessment({ res, ruta, fileName: `${String(generado.folio ?? 'assessment')}_booklet_v1.pdf`, contentType: 'application/pdf' });
}

export async function descargarGeneratedOmrSheet(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { omrSheetArtifact?: { path?: unknown } }).omrSheetArtifact?.path ?? '');
  if (!ruta) throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'No existe hoja OMR para esta evaluación', 404);
  await enviarArchivoAssessment({ res, ruta, fileName: `${String(generado.folio ?? 'assessment')}_omr_sheet_v1.pdf`, contentType: 'application/pdf' });
}

export async function descargarGeneratedStudentPackets(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { studentPacketZipArtifact?: { path?: unknown } }).studentPacketZipArtifact?.path ?? '');
  if (!ruta) throw new ErrorAplicacion('ZIP_NO_DISPONIBLE', 'No existen paquetes por alumno para esta evaluación', 404);
  await enviarArchivoAssessment({ res, ruta, fileName: `${String(generado.folio ?? 'assessment')}_student_packets_v1.zip`, contentType: 'application/zip' });
}

export async function descargarGeneratedManifest(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { manifestArtifact?: { path?: unknown } }).manifestArtifact?.path ?? '');
  if (!ruta) throw new ErrorAplicacion('MANIFEST_NO_DISPONIBLE', 'No existe manifest para esta evaluación', 404);
  await enviarArchivoAssessment({ res, ruta, fileName: `${String(generado.folio ?? 'assessment')}_manifest_v1.json`, contentType: 'application/json' });
}

export async function descargarGeneratedAnswerKey(req: SolicitudDocente, res: Response) {
  const generado = await cargarGeneratedAssessment(String(req.params.id || ''), obtenerDocenteId(req));
  const ruta = String((generado as { answerKeyArtifact?: { path?: unknown } }).answerKeyArtifact?.path ?? '');
  if (!ruta) throw new ErrorAplicacion('ANSWER_KEY_NO_DISPONIBLE', 'No existe answer key para esta evaluación', 404);
  await enviarArchivoAssessment({ res, ruta, fileName: `${String(generado.folio ?? 'assessment')}_answer_key_v1.json`, contentType: 'application/json' });
}

export async function crearOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { generatedAssessmentId, sourceType, capturas } = req.body as z.infer<typeof esquemaCrearOmrScanJob>;
  const assessment = await cargarGeneratedAssessment(generatedAssessmentId, docenteId);
  const capturasExpandidas = await expandirCapturasOmrV1(capturas as CapturaInputOmrV1[], sourceType);
  if (capturasExpandidas.length === 0) {
    throw new ErrorAplicacion('OMR_CAPTURAS_VACIAS', 'No se pudieron procesar capturas válidas para el job OMR.', 400);
  }
  const jobId = createHash('sha1').update(`${generatedAssessmentId}:${Date.now()}`).digest('hex');
  const resultados = [];

  for (let idx = 0; idx < capturasExpandidas.length; idx += 1) {
    const captura = capturasExpandidas[idx]!;
    const qrTexto = await leerQrDesdeImagen(captura.imagenBase64).catch(() => undefined);
    const qrParsed = parseOmrQrPayloadV1(qrTexto);
    const pageIndex = Number(qrParsed?.pageIndex ?? idx + 1);
    const pageMap = findPageBlueprint(assessment as unknown as Record<string, unknown>, pageIndex);
    const sheetInstance = qrParsed ? findSheetInstance(assessment as unknown as Record<string, unknown>, qrParsed.sheetSerial, pageIndex) : null;
    const qrEsperado = sheetInstance ? String((sheetInstance as { qrPayload?: unknown }).qrPayload ?? '') : undefined;
    const resultadoOmr = pageMap
      ? await analizarOmr(
          captura.imagenBase64,
          pageMap,
          qrEsperado,
          Number((assessment as { mapaOmr?: { margenMm?: unknown } }).mapaOmr?.margenMm ?? 10),
          { folio: String(assessment.folio ?? ''), numeroPagina: pageIndex, templateVersionDetectada: 1 }
        ).catch(() => ({
          respuestasDetectadas: [],
          advertencias: ['No se pudo analizar la captura OMR V1.'],
          qrTexto,
          calidadPagina: 0,
          estadoAnalisis: 'rechazado_calidad',
          motivosRevision: ['Fallo del motor OMR V1'],
          templateVersionDetectada: 1,
          confianzaPromedioPagina: 0,
          ratioAmbiguas: 1,
          engineVersion: 'omr-v1-cv',
          geomQuality: 0,
          photoQuality: 0,
          decisionPolicy: 'conservadora_v1'
        }))
      : {
          respuestasDetectadas: [],
          advertencias: ['No existe un mapa OMR para esta página.'],
          qrTexto,
          calidadPagina: 0,
          estadoAnalisis: 'rechazado_calidad' as const,
          motivosRevision: ['Pagina sin mapa OMR'],
          templateVersionDetectada: 1 as const,
          confianzaPromedioPagina: 0,
          ratioAmbiguas: 1,
          engineVersion: 'omr-v1-cv' as const,
          geomQuality: 0,
          photoQuality: 0,
          decisionPolicy: 'conservadora_v1' as const
        };
    const versionCode = String((sheetInstance as { versionCode?: unknown } | null)?.versionCode ?? '').trim().toUpperCase() || null;
    const studentId = String((sheetInstance as { studentBinding?: { studentId?: unknown } } | null)?.studentBinding?.studentId ?? '').trim() || null;
    const answerKey = selectAnswerKeyRange(assessment as unknown as Record<string, unknown>, versionCode, pageIndex);
    const pageScore = calificarRespuestasV1({
      answerKey,
      responses: Array.isArray(resultadoOmr.respuestasDetectadas)
        ? resultadoOmr.respuestasDetectadas.map((item) => ({
            numeroPregunta: Number(item.numeroPregunta),
            opcion: typeof item.opcion === 'string' ? item.opcion : null,
            confianza: Number(item.confianza ?? 0)
          }))
        : []
    });
    const exceptions = aExceptions({
      qrTexto,
      qrEsperado,
      familyCode: qrParsed?.familyCode ?? null,
      expectedFamilyCode: String((assessment as { mapaOmr?: { sheetFamilyCode?: unknown } }).mapaOmr?.sheetFamilyCode ?? '').trim().toUpperCase() || null,
      sheetInstance: sheetInstance as Record<string, unknown> | null,
      resultado: resultadoOmr,
      studentId,
      versionCode
    });
    const confidence = Number(resultadoOmr.confianzaPromedioPagina ?? 0);
    const autoGradable = resolverAutoGradableV1({
      confidence,
      exceptions,
      studentId,
      versionCode
    });
    const scanStatus = resolverScanStatusV1({
      confidence,
      exceptions,
      studentId,
      versionCode
    }) as OmrScanStatus;
    resultados.push({
      sheetSerial: qrParsed?.sheetSerial ?? `UNKNOWN-${idx + 1}`,
      pageIndex,
      sourceFingerprint: createHash('sha1').update(String(captura.imagenBase64).slice(0, 5000)).digest('hex'),
      qualityMetrics: {
        calidadPagina: resultadoOmr.calidadPagina,
        confianzaPromedioPagina: resultadoOmr.confianzaPromedioPagina,
        ratioAmbiguas: resultadoOmr.ratioAmbiguas
      },
      qrResult: { qrTexto: resultadoOmr.qrTexto ?? null, qrExpected: qrEsperado ?? null },
      anchorResult: { geomQuality: (resultadoOmr as { geomQuality?: unknown }).geomQuality ?? null },
      identityResult: {
        source: studentId ? 'sheet_binding' : 'manual_required',
        studentId,
        alumnoId: (sheetInstance as { studentBinding?: { alumnoId?: unknown } } | null)?.studentBinding?.alumnoId ?? null,
        studentName: (sheetInstance as { studentBinding?: { studentName?: unknown } } | null)?.studentBinding?.studentName ?? null
      },
      versionResult: { versionCode, source: versionCode ? 'sheet_binding' : 'manual_required' },
      responses: resultadoOmr.respuestasDetectadas,
      scanStatus,
      exceptions,
      confidence,
      autoGradable,
      scoreResult: pageScore,
      manualReviewRequired: scanStatus !== 'accepted',
      canonicalizationMetrics: {
        geomQuality: Number((resultadoOmr as { geomQuality?: unknown }).geomQuality ?? 0),
        photoQuality: Number((resultadoOmr as { photoQuality?: unknown }).photoQuality ?? 0)
      },
      markMetrics: {
        respuestasDetectadas: Array.isArray(resultadoOmr.respuestasDetectadas) ? resultadoOmr.respuestasDetectadas.length : 0,
        contestadas: Array.isArray(resultadoOmr.respuestasDetectadas) ? resultadoOmr.respuestasDetectadas.filter((item) => item.opcion).length : 0
      },
      resolvedState: null,
      canonicalImageArtifact: null,
      debugArtifacts: []
    });
  }

  const summary = resumirPaginasJobV1(resultados as Array<{ scanStatus?: string; autoGradable?: boolean; sheetSerial?: string; scoreResult?: { porcentaje?: number } }>);
  const job = await OmrScanJob.create({
    jobId,
    sourceType,
    generatedAssessmentId,
    submittedBy: docenteId,
    status: 'completed',
    pagesTotal: capturasExpandidas.length,
    pagesProcessed: resultados.length,
    summary,
    pages: resultados
  });
  res.status(201).json({ jobId: job.jobId, job });
}

export async function obtenerOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await OmrScanJob.findOne({ jobId: String(req.params.id || '') }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  res.json({ job });
}

export async function obtenerPaginasOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await OmrScanJob.findOne({ jobId: String(req.params.id || '') }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  res.json({ pages: Array.isArray(job.pages) ? job.pages : [] });
}

export async function obtenerExcepcionesOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await OmrScanJob.findOne({ jobId: String(req.params.id || '') }).lean();
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  const exceptions = (Array.isArray(job.pages) ? job.pages : []).flatMap((page: { exceptions?: unknown[]; sheetSerial?: unknown; pageIndex?: unknown }) =>
    (Array.isArray(page.exceptions) ? page.exceptions : []).map((item: unknown) => ({
      ...(item as Record<string, unknown>),
      sheetSerial: page.sheetSerial,
      pageIndex: page.pageIndex
    }))
  );
  res.json({ exceptions });
}

export async function resolverExcepcionOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const jobId = String(req.params.id || '');
  const sheetSerial = String(req.params.sheetSerial || '').trim().toUpperCase();
  const payload = req.body as z.infer<typeof esquemaResolverOmrException>;
  const job = await OmrScanJob.findOne({ jobId });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const assessment = await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  const pages = Array.isArray(job.pages) ? job.pages : [];
  const page = pages.find((item: { sheetSerial?: unknown }) => String(item.sheetSerial ?? '').trim().toUpperCase() === sheetSerial);
  if (!page) throw new ErrorAplicacion('OMR_PAGE_NO_ENCONTRADA', 'La hoja indicada no existe en el job', 404);
  const versionCode =
    String((payload.overrides as { versionCode?: unknown } | undefined)?.versionCode ?? (page as { versionResult?: { versionCode?: unknown } }).versionResult?.versionCode ?? '')
      .trim()
      .toUpperCase() || null;
  const studentId =
    String((payload.finalIdentity as { studentId?: unknown } | undefined)?.studentId ?? (page as { identityResult?: { studentId?: unknown } }).identityResult?.studentId ?? '')
      .trim() || null;
  const finalResponses = Array.isArray(payload.finalResponses) && payload.finalResponses.length > 0 ? payload.finalResponses : ((page.responses as unknown[]) ?? []);
  const answerKey = selectAnswerKeyRange(assessment as unknown as Record<string, unknown>, versionCode, Number(page.pageIndex ?? 1));
  const rescoredResult = calificarRespuestasV1({
    answerKey,
    responses: finalResponses.map((item) => ({
      numeroPregunta: Number((item as { numeroPregunta?: unknown }).numeroPregunta ?? 0),
      opcion: String((item as { opcion?: unknown }).opcion ?? '').trim() || null
    }))
  });
  const nextExceptions = sanitizeExceptionsAfterResolution(Array.isArray(page.exceptions) ? (page.exceptions as OmrExceptionV1[]) : [], {
    studentId,
    versionCode,
    finalResponses
  });
  const confidence = Number(page.confidence ?? 0);
  const autoGradable = resolverAutoGradableV1({
    confidence,
    exceptions: nextExceptions,
    studentId,
    versionCode
  });
  const scanStatus = resolverScanStatusV1({
    confidence,
    exceptions: nextExceptions,
    studentId,
    versionCode
  }) as OmrScanStatus;

  page.responses = finalResponses as never;
  page.identityResult = {
    ...(page.identityResult ?? {}),
    ...(payload.finalIdentity ?? {}),
    studentId
  } as never;
  page.versionResult = {
    ...(page.versionResult ?? {}),
    versionCode
  } as never;
  page.exceptions = nextExceptions as never;
  page.scanStatus = scanStatus as never;
  page.autoGradable = autoGradable as never;
  page.scoreResult = rescoredResult as never;
  page.manualReviewRequired = (scanStatus !== 'accepted') as never;
  page.resolvedState = {
    resolvedAt: new Date().toISOString(),
    resolvedBy: docenteId,
    resolutionReason: payload.resolutionReason
  } as never;

  job.reviewResolutions.push({
    sheetSerial,
    resolvedBy: docenteId as never,
    resolvedAt: new Date(),
    overrides: payload.overrides ?? {},
    finalResponses: finalResponses as never,
    finalIdentity: payload.finalIdentity ?? {},
    resolvedVersion: { versionCode },
    rescoredResult,
    auditTrail: [
      {
        at: new Date().toISOString(),
        by: docenteId,
        reason: payload.resolutionReason
      }
    ],
    resolutionReason: payload.resolutionReason
  } as never);
  job.summary = resumirPaginasJobV1(job.pages as never) as never;
  await job.save();
  res.json({ job: job.toObject() });
}

export async function finalizarOmrScanJob(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const jobId = String(req.params.id || '');
  const job = await OmrScanJob.findOne({ jobId });
  if (!job) throw new ErrorAplicacion('OMR_JOB_NO_ENCONTRADO', 'Job OMR no encontrado', 404);
  const assessment = await cargarGeneratedAssessment(String(job.generatedAssessmentId), docenteId);
  const pages = Array.isArray(job.pages) ? job.pages : [];
  if (pages.some((page: { scanStatus?: unknown }) => String(page.scanStatus ?? '') === 'rejected')) {
    throw new ErrorAplicacion('OMR_JOB_REJECTED_PAGES', 'No se puede finalizar mientras existan hojas rechazadas.', 409);
  }
  if (pages.some((page: { scanStatus?: unknown }) => String(page.scanStatus ?? '') === 'needs_review')) {
    throw new ErrorAplicacion('OMR_JOB_NEEDS_REVIEW', 'No se puede finalizar mientras existan hojas pendientes de revisión.', 409);
  }

  const grouped = agruparPaginasPorHojaV1(pages as Array<{ sheetSerial?: unknown; pageIndex?: unknown; responses?: unknown[]; identityResult?: unknown; versionResult?: unknown; confidence?: unknown; exceptions?: unknown[] }>);
  const results = Array.from(grouped.entries()).map(([serial, groupedPages]) => {
    const allResponses = groupedPages.flatMap((page) => (Array.isArray(page.responses) ? page.responses : []));
    const versionCode =
      String((groupedPages[0] as { versionResult?: { versionCode?: unknown } }).versionResult?.versionCode ?? '').trim().toUpperCase() ||
      String(findSheetInstance(assessment as unknown as Record<string, unknown>, serial, Number(groupedPages[0]?.pageIndex ?? 1))?.versionCode ?? '')
        .trim()
        .toUpperCase();
    const answerKeySet = (assessment as { answerKeySet?: Record<string, Array<{ numeroPregunta?: unknown; idPregunta?: unknown; correcta?: unknown }>> }).answerKeySet;
    const answerKey =
      (answerKeySet && typeof answerKeySet === 'object'
        ? (answerKeySet[versionCode] ?? answerKeySet[Object.keys(answerKeySet).sort()[0] ?? ''] ?? [])
        : [])?.map((entry) => ({
          numeroPregunta: Number(entry.numeroPregunta ?? 0),
          idPregunta: String(entry.idPregunta ?? ''),
          correcta: String(entry.correcta ?? '').trim() || null
        } satisfies AnswerKeyEntryV1)) ?? [];
    const scoreResult = calificarRespuestasV1({
      answerKey,
      responses: allResponses.map((item) => ({
        numeroPregunta: Number((item as { numeroPregunta?: unknown }).numeroPregunta ?? 0),
        opcion: String((item as { opcion?: unknown }).opcion ?? '').trim() || null
      }))
    });
    const confidence =
      groupedPages.reduce((acc, page) => acc + Number((page as { confidence?: unknown }).confidence ?? 0), 0) / Math.max(1, groupedPages.length);
    const studentId = String((groupedPages[0] as { identityResult?: { studentId?: unknown } }).identityResult?.studentId ?? '').trim() || null;
    const exceptions = groupedPages.flatMap((page) => (Array.isArray((page as { exceptions?: unknown[] }).exceptions) ? ((page as { exceptions?: unknown[] }).exceptions ?? []) : []));
    const autoGradable = resolverAutoGradableV1({
      confidence,
      exceptions: exceptions as Array<{ severity?: string }>,
      studentId,
      versionCode
    });
    return {
      sheetSerial: serial,
      studentId,
      versionCode,
      responses: allResponses,
      confidence: Number(confidence.toFixed(4)),
      scanStatus: 'accepted',
      exceptions,
      autoGradable,
      scoreResult
    };
  });

  job.summary = {
    ...(job.summary ?? {}),
    finalizedAt: new Date().toISOString(),
    results,
    ...resumirPaginasJobV1(job.pages as never)
  } as never;
  job.status = 'finalized';
  await job.save();
  res.json({ job: job.toObject(), finalized: true, results });
}

export const middlewaresOmrV1 = {
  listarFamilias: [requerirPermiso('plantillas:previsualizar'), listarFamiliasOmr],
  obtenerFamilia: [requerirPermiso('plantillas:previsualizar'), obtenerFamiliaOmr],
  crearFamilia: [requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaCrearOmrSheetFamily, { strict: true }), crearFamiliaOmr],
  crearRevisionFamilia: [requerirPermiso('plantillas:gestionar'), validarCuerpo(esquemaCrearOmrSheetRevision, { strict: true }), crearRevisionFamiliaOmr],
  preview: [requerirPermiso('plantillas:previsualizar'), previsualizarAssessment],
  previewBookletPdf: [requerirPermiso('plantillas:previsualizar'), previsualizarAssessmentBookletPdf],
  previewOmrPdf: [requerirPermiso('plantillas:previsualizar'), previsualizarAssessmentOmrSheetPdf],
  generate: [requerirPermiso('examenes:generar'), generarAssessment],
  getGenerated: [requerirPermiso('examenes:leer'), obtenerGeneratedAssessment],
  createJob: [requerirPermiso('omr:analizar'), validarCuerpo(esquemaCrearOmrScanJob, { strict: true }), crearOmrScanJob],
  getJob: [requerirPermiso('omr:analizar'), obtenerOmrScanJob],
  getPages: [requerirPermiso('omr:analizar'), obtenerPaginasOmrScanJob],
  getExceptions: [requerirPermiso('omr:analizar'), obtenerExcepcionesOmrScanJob],
  resolveException: [requerirPermiso('omr:analizar'), validarCuerpo(esquemaResolverOmrException, { strict: true }), resolverExcepcionOmrScanJob],
  finalizeJob: [requerirPermiso('omr:analizar'), finalizarOmrScanJob],
  downloadBooklet: [requerirPermiso('examenes:descargar'), descargarGeneratedBooklet],
  downloadOmrSheet: [requerirPermiso('examenes:descargar'), descargarGeneratedOmrSheet],
  downloadStudentPackets: [requerirPermiso('examenes:descargar'), descargarGeneratedStudentPackets],
  downloadManifest: [requerirPermiso('examenes:descargar'), descargarGeneratedManifest],
  downloadAnswerKey: [requerirPermiso('examenes:descargar'), descargarGeneratedAnswerKey]
};
