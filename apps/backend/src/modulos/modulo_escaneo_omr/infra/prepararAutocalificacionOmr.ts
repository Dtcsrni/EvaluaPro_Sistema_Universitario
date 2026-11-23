import { evaluarAutoCalificableOmr } from '../politicaAutoCalificacionOmr.js';

type EstadoPagina = 'accepted' | 'needs_review' | 'rejected';
type EstadoRespuesta = 'respondida' | 'sin_marca' | 'ambigua' | 'doble_marca' | 'tachada';

export type EvidenciaPaginaAutoOmr = {
  examId?: string;
  folio?: string;
  examPage?: number;
  attemptId?: string;
  identityStatus?: 'confirmed' | 'needs_confirmation';
  identityResult?: { studentId: string | null; studentName: string | null };
  scanStatus: EstadoPagina;
  exceptions: Array<{ code: string; severity: 'warning' | 'blocking'; message: string }>;
  responses: Array<{
    numeroPregunta: number;
    opcion: string | null;
    confianza: number;
    estadoRespuesta?: EstadoRespuesta | 'manual_review';
    flags: string[];
  }>;
  analysisEvidence?: {
    estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    templateVersionDetectada: number;
    engineVersion: string;
    geomQuality: number;
    photoQuality: number;
    decisionPolicy: string;
    qrTexto: string;
    motivosRevision: string[];
  };
};

export type PreparacionAutocalificacionOmr = {
  elegible: boolean;
  causas: string[];
  respuestas: Array<{
    numeroPregunta: number;
    opcion: 'A' | 'B' | 'C' | 'D' | 'E' | null;
    confianza: number;
    estadoRespuesta: EstadoRespuesta;
    flags: string[];
  }>;
  omrAnalisis?: {
    estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
    calidadPagina: number;
    confianzaPromedioPagina: number;
    ratioAmbiguas: number;
    templateVersionDetectada: 4;
    engineVersion: string;
    geomQuality: number;
    photoQuality: number;
    decisionPolicy: string;
    qrTexto: string;
    motivosRevision: string[];
  };
};

const ESTADOS_VALIDOS = new Set<EstadoRespuesta>(['respondida', 'sin_marca', 'ambigua', 'doble_marca', 'tachada']);
const OPCIONES_VALIDAS = new Set(['A', 'B', 'C', 'D', 'E']);

/** Valida la estructura completa de una copia y prepara exclusivamente evidencia OMR del servidor. */
export function prepararAutocalificacionOmr(args: {
  pages: readonly EvidenciaPaginaAutoOmr[];
  expectedExamId: string;
  expectedFolio: string;
  expectedPages: readonly number[];
  expectedQuestions: number;
  expectedQrByPage: ReadonlyMap<number, string>;
  identityStudentId?: string | null;
}) : PreparacionAutocalificacionOmr {
  const causas = new Set<string>();
  const pages = [...args.pages].sort((a, b) => Number(a.examPage) - Number(b.examPage));
  const identityAssigned = Boolean(String(args.identityStudentId ?? '').trim());

  if (pages.length === 0 || args.expectedPages.length === 0) causas.add('OMR_PAGINAS_ESPERADAS_INVALIDAS');
  if (pages.some((page) => page.identityStatus === 'needs_confirmation') && !identityAssigned) causas.add('OMR_IDENTIDAD_PENDIENTE');
  if (pages.some((page) => page.exceptions.some((exception) => exception.severity === 'blocking' && exception.code !== 'OMR_QR_REUTILIZADO_IDENTIDAD_PENDIENTE'))) {
    causas.add('OMR_EXCEPCION_BLOQUEANTE');
  }

  const pageCounts = new Map<number, number>();
  for (const page of pages) {
    const pageNumber = Number(page.examPage);
    if (page.examId !== args.expectedExamId || String(page.folio ?? '').toUpperCase() !== args.expectedFolio.toUpperCase()) causas.add('OMR_EXAMEN_O_FOLIO_NO_COINCIDE');
    if (page.scanStatus === 'rejected' || (page.scanStatus === 'needs_review' && page.identityStatus !== 'needs_confirmation')) causas.add('OMR_PAGINA_REQUIERE_REVISION');
    if (!Number.isSafeInteger(pageNumber)) {
      causas.add('OMR_PAGINA_INVALIDA');
      continue;
    }
    pageCounts.set(pageNumber, (pageCounts.get(pageNumber) ?? 0) + 1);
    const expectedQr = args.expectedQrByPage.get(pageNumber);
    const actualQr = page.analysisEvidence?.qrTexto;
    if (!expectedQr || !actualQr || actualQr !== expectedQr) causas.add('OMR_QR_NO_COINCIDE_PAGINA');
    if (!page.analysisEvidence || page.analysisEvidence.estadoAnalisis !== 'ok' || page.analysisEvidence.templateVersionDetectada !== 4) causas.add('OMR_ANALISIS_PAGINA_INVALIDO');
    if (page.exceptions.some((exception) => exception.severity === 'blocking' && exception.code === 'OMR_QR_ORIENTACION_REVISAR')) causas.add('OMR_QR_ORIENTACION_REQUIERE_REVISION');
  }
  if (args.expectedPages.some((pageNumber) => pageCounts.get(pageNumber) !== 1) || [...pageCounts.keys()].some((pageNumber) => !args.expectedPages.includes(pageNumber))) {
    causas.add('OMR_PAGINAS_INCOMPLETAS_O_DUPLICADAS');
  }

  const respuestas = pages.flatMap((page) => page.responses).sort((a, b) => a.numeroPregunta - b.numeroPregunta);
  const numerosEsperados = Array.from({ length: args.expectedQuestions }, (_, index) => index + 1);
  if (!Number.isSafeInteger(args.expectedQuestions) || args.expectedQuestions <= 0
    || respuestas.length !== args.expectedQuestions
    || respuestas.some((respuesta, index) => respuesta.numeroPregunta !== numerosEsperados[index])) {
    causas.add('OMR_REACTIVOS_INCOMPLETOS_O_DUPLICADOS');
  }

  const respuestasNormalizadas = respuestas.map((respuesta) => {
    const estado = respuesta.estadoRespuesta && ESTADOS_VALIDOS.has(respuesta.estadoRespuesta as EstadoRespuesta)
      ? respuesta.estadoRespuesta as EstadoRespuesta
      : undefined;
    if (!estado) {
      causas.add('OMR_ESTADO_RESPUESTA_INVALIDO');
    }
    const opcion = OPCIONES_VALIDAS.has(String(respuesta.opcion ?? '').toUpperCase())
      ? String(respuesta.opcion).toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E'
      : null;
    if (estado === 'respondida' && (!opcion || respuesta.confianza < 0.58)) causas.add('OMR_RESPUESTA_DE_BAJA_CONFIANZA');
    if (estado !== 'respondida' && opcion !== null) causas.add('OMR_RESPUESTA_INDETERMINADA_CON_OPCION');
    return {
      numeroPregunta: respuesta.numeroPregunta,
      opcion: estado === 'respondida' ? opcion : null,
      confianza: respuesta.confianza,
      estadoRespuesta: estado && ESTADOS_VALIDOS.has(estado) ? estado : 'ambigua' as const,
      flags: respuesta.flags
    };
  });

  const evidencias = pages.map((page) => page.analysisEvidence).filter((value): value is NonNullable<EvidenciaPaginaAutoOmr['analysisEvidence']> => Boolean(value));
  const primeraPaginaEsperada = args.expectedPages[0];
  const omrAnalisis = evidencias.length > 0 ? {
    estadoAnalisis: evidencias.every((evidence) => evidence.estadoAnalisis === 'ok') ? 'ok' as const : 'requiere_revision' as const,
    calidadPagina: Math.min(...evidencias.map((evidence) => evidence.calidadPagina)),
    confianzaPromedioPagina: Math.min(...evidencias.map((evidence) => evidence.confianzaPromedioPagina)),
    ratioAmbiguas: Math.max(...evidencias.map((evidence) => evidence.ratioAmbiguas)),
    templateVersionDetectada: 4 as const,
    engineVersion: evidencias[0]!.engineVersion,
    geomQuality: Math.min(...evidencias.map((evidence) => evidence.geomQuality)),
    photoQuality: Math.min(...evidencias.map((evidence) => evidence.photoQuality)),
    decisionPolicy: evidencias[0]!.decisionPolicy,
    qrTexto: evidencias.find((evidence) => evidence.qrTexto === args.expectedQrByPage.get(primeraPaginaEsperada ?? 1))?.qrTexto ?? '',
    motivosRevision: [...new Set(evidencias.flatMap((evidence) => evidence.motivosRevision))]
  } : undefined;
  if (!omrAnalisis?.qrTexto) causas.add('OMR_QR_PRIMERA_PAGINA_REQUERIDO');
  if (evidencias.some((evidence) => evidence.engineVersion !== omrAnalisis?.engineVersion || evidence.decisionPolicy !== omrAnalisis?.decisionPolicy)) {
    causas.add('OMR_VERSIONES_INCONSISTENTES');
  }

  const decision = evaluarAutoCalificableOmr({
    estadoAnalisis: omrAnalisis?.estadoAnalisis,
    calidadPagina: omrAnalisis?.calidadPagina ?? 0,
    confianzaPromedioPagina: omrAnalisis?.confianzaPromedioPagina ?? 0,
    ratioAmbiguas: omrAnalisis?.ratioAmbiguas ?? 1,
    coberturaDeteccion: args.expectedQuestions > 0 ? respuestas.length / args.expectedQuestions : 0,
    respuestasDetectadas: respuestasNormalizadas
  });
  if (!decision.autoCalificableOmr) causas.add('OMR_POLITICA_AUTO_RECHAZA');

  return { elegible: causas.size === 0, causas: [...causas], respuestas: respuestasNormalizadas, ...(omrAnalisis ? { omrAnalisis } : {}) };
}
