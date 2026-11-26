import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/index.js';
import { analizarPaginasOmrParaCalificacion } from '../src/modulos/modulo_escaneo_omr/servicioCalificacionOmrLocal.js';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';
import { evaluarAutoCalificableOmr, OMR_TV4_REAL_PILOT_GATE_PASSED } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';

type MapaPaginaReal = {
  numeroPagina: number;
  templateVersion?: number;
  templateId?: string;
  qr?: { texto?: string };
  preguntas?: Array<{ numeroPregunta?: number }>;
  [key: string]: unknown;
};

type CapturaManifiesto = {
  imageFile: string;
  folio: string;
  sourcePage: number;
  loteQr: string;
  qrEsperado: string;
  mapaPagina: MapaPaginaReal;
};

type ManifiestoLote = { pages?: CapturaManifiesto[] };

export type OpcionesReplayReal = {
  loteIds: string[];
  templateId: string;
  templateVersion: number;
  expectedPages?: number;
  expectedFolios?: number;
  allowUnverifiedSignatures?: boolean;
};

export type ArgumentosReplayReal = OpcionesReplayReal & {
  manifest: string;
  report?: string;
  requireEligible: boolean;
  readerOnly: boolean;
};

function valorSiguiente(argv: string[], index: number, option: string) {
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith('--')) throw new Error(`Falta el valor de ${option}.`);
  return value;
}

export function parsearArgsReplayReal(argv: string[]): ArgumentosReplayReal {
  let manifest = '';
  let templateId = '';
  let templateVersion = Number.NaN;
  let expectedPages: number | undefined;
  let expectedFolios: number | undefined;
  let report: string | undefined;
  let requireEligible = false;
  let readerOnly = false;
  const loteIds: string[] = [];

  for (let index = 2; index < argv.length; index += 1) {
    const option = argv[index];
    if (!option?.startsWith('--')) throw new Error(`Argumento inesperado: ${option ?? ''}`);
    const value = ['--require-eligible', '--reader-only'].includes(option) ? undefined : valorSiguiente(argv, index, option);
    if (value !== undefined) index += 1;

    switch (option) {
      case '--manifest': manifest = value!; break;
      case '--lot-id': loteIds.push(value!.toUpperCase()); break;
      case '--template-id': templateId = value!; break;
      case '--template-version': templateVersion = Number(value); break;
      case '--expected-pages': expectedPages = Number(value); break;
      case '--expected-folios': expectedFolios = Number(value); break;
      case '--report': report = value; break;
      case '--require-eligible': requireEligible = true; break;
      case '--reader-only': readerOnly = true; break;
      default: throw new Error(`Opción desconocida: ${option}`);
    }
  }

  if (!manifest) throw new Error('Indica el manifiesto con --manifest.');
  if (loteIds.length === 0 || loteIds.some((id) => !/^[A-Z0-9-]{4,64}$/.test(id))) {
    throw new Error('Indica al menos un --lot-id válido.');
  }
  if (new Set(loteIds).size !== loteIds.length) throw new Error('No repitas --lot-id.');
  if (!templateId || !Number.isSafeInteger(templateVersion) || templateVersion < 1) {
    throw new Error('Indica --template-id y --template-version de la plantilla vigente que se probará.');
  }
  if (readerOnly && requireEligible) throw new Error('--reader-only no puede combinarse con --require-eligible.');
  for (const [label, count] of [['--expected-pages', expectedPages], ['--expected-folios', expectedFolios]] as const) {
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 1)) {
      throw new Error(`${label} debe ser un entero positivo.`);
    }
  }

  return {
    manifest,
    loteIds,
    templateId,
    templateVersion,
    ...(expectedPages === undefined ? {} : { expectedPages }),
    ...(expectedFolios === undefined ? {} : { expectedFolios }),
    ...(report ? { report } : {}),
    requireEligible,
    readerOnly
  };
}

export function validarPlantillaVigenteReplay(
  opciones: Pick<ArgumentosReplayReal, 'templateId' | 'templateVersion'>,
  politica: { active?: { contractId?: unknown; templateVersion?: unknown } }
) {
  const idActivo = String(politica.active?.contractId ?? '').trim();
  const versionActiva = Number(politica.active?.templateVersion);
  if (!idActivo || !Number.isSafeInteger(versionActiva) ||
      opciones.templateId !== idActivo || opciones.templateVersion !== versionActiva) {
    throw new Error(`La reproducción solo admite la plantilla OMR activa (${idActivo || 'sin definir'}, versión ${versionActiva || 'sin definir'}).`);
  }
}

function esObjeto(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function validarManifestLoteReal(manifest: unknown, opciones: OpcionesReplayReal) {
  if (!esObjeto(manifest) || !Array.isArray(manifest.pages)) {
    throw new Error('El manifiesto debe contener pages[].');
  }
  const allPages = (manifest as ManifiestoLote).pages!;
  if (allPages.some((page) => !esObjeto(page))) throw new Error('El manifiesto contiene una página inválida.');
  const selected = allPages.filter((page) => opciones.loteIds.includes(String(page.loteQr ?? '').toUpperCase()));
  if (selected.length === 0) throw new Error('El manifiesto no contiene páginas de los lotes solicitados.');
  if (opciones.expectedPages !== undefined && selected.length !== opciones.expectedPages) {
    throw new Error(`El lote trae ${selected.length} páginas; se esperaban ${opciones.expectedPages}.`);
  }

  const folios = new Map<string, Map<number, CapturaManifiesto>>();
  const preguntasPorFolio = new Map<string, Set<number>>();
  const clavesPagina = new Set<string>();
  for (const page of selected) {
    const folio = String(page.folio ?? '').trim().toUpperCase();
    const loteId = String(page.loteQr ?? '').trim().toUpperCase();
    const mapa = page.mapaPagina;
    if (!folio || !loteId || !String(page.imageFile ?? '').trim()) throw new Error('Hay una página sin folio, lote o ruta de imagen.');
    if (!Number.isSafeInteger(page.sourcePage) || page.sourcePage < 1 || page.sourcePage !== mapa?.numeroPagina) {
      throw new Error(`La página fuente no coincide con el número del mapa (${folio}).`);
    }
    if (mapa.templateVersion !== opciones.templateVersion || mapa.templateId !== opciones.templateId) {
      throw new Error(`La plantilla de ${folio} P${page.sourcePage} no coincide con la plantilla solicitada.`);
    }
    const qrEsperado = String(page.qrEsperado ?? '').trim();
    const qrMapa = String(mapa.qr?.texto ?? '').trim();
    const identidadQr = extraerResumenQrExamen(qrEsperado);
    if (!qrEsperado || qrMapa !== qrEsperado || !identidadQr ||
        identidadQr.raw !== qrEsperado || String(identidadQr.folio).toUpperCase() !== folio ||
        Number(identidadQr.numeroPagina) !== page.sourcePage ||
        Number(identidadQr.templateVersion) !== opciones.templateVersion) {
      throw new Error(`El QR del manifiesto/mapa no identifica exactamente ${folio} P${page.sourcePage}.`);
    }
    if (!opciones.allowUnverifiedSignatures && Boolean(identidadQr.payloadSignature) && identidadQr.payloadSignatureValid !== true) {
      throw new Error(`Firma HMAC del QR inválida o no disponible (keyId=${identidadQr.keyId ?? 'desconocida'}).`);
    }
    const questions = mapa.preguntas;
    if (!Array.isArray(questions) || questions.length === 0 ||
        questions.some((question) => !Number.isSafeInteger(question.numeroPregunta) || Number(question.numeroPregunta) < 1)) {
      throw new Error(`El mapa de ${folio} P${page.sourcePage} no contiene reactivos válidos.`);
    }

    const pageKey = `${loteId}:${folio}:${page.sourcePage}`;
    if (clavesPagina.has(pageKey)) throw new Error(`Página duplicada en el manifiesto: ${folio} P${page.sourcePage}.`);
    clavesPagina.add(pageKey);
    if (!folios.has(`${loteId}:${folio}`)) folios.set(`${loteId}:${folio}`, new Map());
    folios.get(`${loteId}:${folio}`)!.set(page.sourcePage, page);
    if (!preguntasPorFolio.has(`${loteId}:${folio}`)) preguntasPorFolio.set(`${loteId}:${folio}`, new Set());
    const questionsForFolio = preguntasPorFolio.get(`${loteId}:${folio}`)!;
    for (const question of questions) {
      const number = Number(question.numeroPregunta);
      if (questionsForFolio.has(number)) throw new Error(`Reactivo ${number} repetido entre páginas del folio ${folio}.`);
      questionsForFolio.add(number);
    }
  }

  for (const [key, pages] of folios) {
    const numbers = [...pages.keys()].sort((a, b) => a - b);
    if (numbers.some((number, index) => number !== index + 1)) {
      throw new Error(`Las páginas de ${key.split(':')[1]} no cubren una secuencia que inicia en P1.`);
    }
  }
  const folioCount = folios.size;
  if (opciones.expectedFolios !== undefined && folioCount !== opciones.expectedFolios) {
    throw new Error(`El manifiesto contiene ${folioCount} folios; se esperaban ${opciones.expectedFolios}.`);
  }

  return {
    pages: selected,
    folioCount,
    questionCount: [...preguntasPorFolio.values()].reduce((sum, questions) => sum + questions.size, 0)
  };
}

export function resolverImagenLoteReal(manifestPath: string, imageFile: string) {
  if (path.isAbsolute(imageFile)) throw new Error('La ruta de imagen debe ser relativa al manifiesto.');
  const root = path.dirname(path.resolve(manifestPath));
  const resolved = path.resolve(root, imageFile);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('La ruta de imagen sale de la carpeta del manifiesto.');
  }
  const extension = path.extname(resolved).toLowerCase();
  const mimeType = extension === '.png' ? 'image/png' : ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg' : undefined;
  if (!mimeType) throw new Error(`Formato de imagen no admitido: ${extension || '(sin extensión)'}.`);
  return { path: resolved, mimeType };
}

function hashFolio(folio: string) {
  return createHash('sha256').update(folio.trim().toUpperCase()).digest('hex').slice(0, 16);
}

async function ejecutarReplay(args: ArgumentosReplayReal) {
  const manifestPath = path.resolve(process.cwd(), args.manifest);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown;
  const validado = validarManifestLoteReal(manifest, {
    ...args,
    allowUnverifiedSignatures: args.readerOnly
  });
  const selectedByFolio = new Map<string, CapturaManifiesto[]>();
  for (const page of validado.pages) {
    const key = `${page.loteQr.toUpperCase()}:${page.folio.toUpperCase()}`;
    if (!selectedByFolio.has(key)) selectedByFolio.set(key, []);
    selectedByFolio.get(key)!.push(page);
  }

  const exams = [];
  for (const [key, pages] of selectedByFolio) {
    const [loteId, folio] = key.split(':') as [string, string];
    const capturedPages = [];
    for (const page of [...pages].sort((a, b) => a.sourcePage - b.sourcePage)) {
      const image = resolverImagenLoteReal(manifestPath, page.imageFile);
      const bytes = await fs.readFile(image.path);
      capturedPages.push({
        numeroPagina: page.sourcePage,
        imagenBase64: `data:${image.mimeType};base64,${bytes.toString('base64')}`
      });
    }
    const maps = [...pages].sort((a, b) => a.sourcePage - b.sourcePage).map((page) => page.mapaPagina);
    const pageMetadata = [...pages].sort((a, b) => a.sourcePage - b.sourcePage).map((page) => ({
      numero: page.sourcePage,
      qrTexto: page.qrEsperado
    }));
    const expectedQuestions = new Set(maps.flatMap((map) => map.preguntas!.map((question) => Number(question.numeroPregunta))));
    const pageReadResults: Awaited<ReturnType<typeof analizarOmr>>[] = [];
    if (args.readerOnly) {
      for (let index = 0; index < capturedPages.length; index += 1) {
        const page = capturedPages[index]!;
          pageReadResults.push(await analizarOmr(
          page.imagenBase64,
          maps[index]!,
          pageMetadata[index]!.qrTexto,
          10,
          { folio, numeroPagina: page.numeroPagina, templateVersionDetectada: args.templateVersion },
          `replay-reader-${hashFolio(folio)}-p${page.numeroPagina}`
        ));
      }
    }
    const result = args.readerOnly
      ? {
        paginas: pageReadResults.map((page, index) => ({
          numeroPagina: capturedPages[index]!.numeroPagina,
          qrTexto: page.qrTexto,
          estadoAnalisis: page.estadoAnalisis
        })),
        respuestasDetectadas: pageReadResults.flatMap((page) => page.respuestasDetectadas),
        analisis: {
          estadoAnalisis: pageReadResults.every((page) => page.estadoAnalisis === 'ok') ? 'ok' : 'requiere_revision',
          calidadPagina: pageReadResults.length ? Math.min(...pageReadResults.map((page) => page.calidadPagina)) : 0,
          confianzaPromedioPagina: pageReadResults.length
            ? pageReadResults.reduce((sum, page) => sum + page.confianzaPromedio, 0) / pageReadResults.length
            : 0,
          ratioAmbiguas: expectedQuestions.size
            ? pageReadResults.flatMap((page) => page.respuestasDetectadas).filter((answer) => answer.opcion === null).length / expectedQuestions.size
            : 1,
          bonoOcrResuelto: false,
          bonoVisible: false
        }
      }
      : await analizarPaginasOmrParaCalificacion({
        folio,
        mapaOmr: {
          templateId: args.templateId,
          templateVersion: args.templateVersion,
          margenMm: 10,
          paginas: maps
        },
        paginasExamen: pageMetadata,
        paginasCapturadas: capturedPages,
        totalPreguntasEsperadas: expectedQuestions.size
      });
    const eligibility = args.readerOnly
      ? { autoCalificableOmr: false, motivos: ['LECTURA_SIN_VALIDACION_HMAC_NI_CLAVE'] }
      : evaluarAutoCalificableOmr({
        estadoAnalisis: result.analisis.estadoAnalisis,
        calidadPagina: result.analisis.calidadPagina,
        confianzaPromedioPagina: result.analisis.confianzaPromedioPagina,
        ratioAmbiguas: result.analisis.ratioAmbiguas,
        coberturaDeteccion: result.respuestasDetectadas.length / Math.max(1, expectedQuestions.size),
        respuestasDetectadas: result.respuestasDetectadas
      });
    const stateCounts: Record<string, number> = {};
    for (const response of result.respuestasDetectadas) {
      const state = String(response.estadoRespuesta ?? 'estado_ausente');
      stateCounts[state] = (stateCounts[state] ?? 0) + 1;
    }
    exams.push({
      loteId,
      folioRef: hashFolio(folio),
      pageCount: result.paginas.length,
      questionCount: expectedQuestions.size,
      detectedQuestionCount: result.respuestasDetectadas.length,
      stateCounts,
      pageStatus: result.analisis.estadoAnalisis,
      pageQuality: result.analisis.calidadPagina,
      pageConfidence: result.analisis.confianzaPromedioPagina,
      qrMismatches: result.paginas.filter((page) => !pages.some((source) =>
        source.sourcePage === page.numeroPagina && source.qrEsperado === page.qrTexto)).length,
      pageReviewRequired: result.paginas.filter((page) => page.estadoAnalisis !== 'ok').length,
      autoGradeEligible: eligibility.autoCalificableOmr,
      autoGradeEligibilityReasons: eligibility.motivos,
      qrSignaturesVerified: !args.readerOnly,
      bonusOcrResolved: result.analisis.bonoOcrResuelto,
      bonusVisible: result.analisis.bonoVisible,
      reviewQuestions: result.respuestasDetectadas
        .filter((response) => ['ambigua', 'doble_marca', 'tachada'].includes(String(response.estadoRespuesta)))
        .map((response) => ({ question: response.numeroPregunta, state: response.estadoRespuesta }))
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'originales OMR del manifiesto; sin clave ni verdad-terreno humana',
    analysisOnly: true,
    gradesWritten: false,
    replayMode: args.readerOnly ? 'reader-only; no verifica HMAC ni habilita calificación' : 'calificación local con validación de integridad QR',
    templateId: args.templateId,
    templateVersion: args.templateVersion,
    requestedLots: args.loteIds,
    pageCount: validado.pages.length,
    folioCount: validado.folioCount,
    questionCount: validado.questionCount,
    pageAnalysisFailures: exams.reduce((sum, exam) => sum + Number(exam.pageStatus !== 'ok'), 0),
    qrMismatches: exams.reduce((sum, exam) => sum + exam.qrMismatches, 0),
    pageReviewRequired: exams.reduce((sum, exam) => sum + exam.pageReviewRequired, 0),
    autoGradeEligibleExams: exams.filter((exam) => exam.autoGradeEligible).length,
    globalPilotGatePassed: OMR_TV4_REAL_PILOT_GATE_PASSED,
    exams
  };
  const structurallyValid = report.pageAnalysisFailures === 0 && report.qrMismatches === 0 && report.pageReviewRequired === 0;
  const eligibleValid = !args.requireEligible || report.autoGradeEligibleExams === report.folioCount;
  return { report, exitCode: structurallyValid && eligibleValid ? 0 : 1 };
}

async function main() {
  const args = parsearArgsReplayReal(process.argv);
  const manifestPath = path.resolve(process.cwd(), args.manifest);
  const policyPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../config/omr-version-policy.json');
  const policy = JSON.parse(await fs.readFile(policyPath, 'utf8')) as { active?: { contractId?: unknown; templateVersion?: unknown } };
  validarPlantillaVigenteReplay(args, policy);
  const { report, exitCode } = await ejecutarReplay(args);
  if (args.report) {
    const reportPath = path.resolve(process.cwd(), args.report);
    if (reportPath === manifestPath) throw new Error('El reporte no puede sobrescribir el manifiesto fuente.');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({
    ok: exitCode === 0,
    templateId: report.templateId,
    templateVersion: report.templateVersion,
    lots: report.requestedLots,
    pages: report.pageCount,
    folios: report.folioCount,
    questions: report.questionCount,
    pageAnalysisFailures: report.pageAnalysisFailures,
    qrMismatches: report.qrMismatches,
    pageReviewRequired: report.pageReviewRequired,
    autoGradeEligibleExams: report.autoGradeEligibleExams,
    globalPilotGatePassed: report.globalPilotGatePassed,
    replayMode: report.replayMode,
    gradesWritten: false,
    ...(args.report ? { report: path.resolve(process.cwd(), args.report) } : {})
  })}\n`);
  process.exitCode = exitCode;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    process.exit(1);
  });
}
