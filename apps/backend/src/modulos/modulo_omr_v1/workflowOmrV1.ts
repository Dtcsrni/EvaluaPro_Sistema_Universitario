import { createHash, randomUUID } from 'node:crypto';

export type PreguntaBaseWorkflowV1 = {
  id: string;
  enunciado: string;
  imagenUrl?: string;
  opciones: Array<{ texto: string; esCorrecta: boolean }>;
};

export type RespuestaWorkflowV1 = {
  numeroPregunta: number;
  opcion: string | null;
  confianza?: number;
};

export type AnswerKeyEntryV1 = {
  numeroPregunta: number;
  idPregunta: string;
  correcta: string | null;
};

export type VersionAssessmentV1 = {
  versionCode: string;
  preguntas: PreguntaBaseWorkflowV1[];
  answerKey: AnswerKeyEntryV1[];
  orderQuestions: string[];
  optionOrderByQuestion: Record<string, number[]>;
};

export type SheetBindingV1 = {
  alumnoId?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  versionCode?: string | null;
};

type ResolveStatusArgs = {
  confidence: number;
  exceptions: Array<{ severity?: string }>;
  studentId: string | null;
  versionCode: string | null;
};

export function slugOmrV1(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function shuffleDeterministaV1<T>(items: T[], seedText: string) {
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

export function crearGenerationSeedV1(explicitSeed?: string | null) {
  const seed = String(explicitSeed ?? '').trim();
  return seed || randomUUID();
}

export function crearPreviewFingerprintV1(snapshot: unknown) {
  return createHash('sha1').update(JSON.stringify(snapshot)).digest('hex');
}

export function crearTemplateSnapshotV1(plantilla: Record<string, unknown>) {
  return {
    id: String(plantilla._id ?? ''),
    updatedAt: String(plantilla.updatedAt ?? ''),
    titulo: String(plantilla.titulo ?? ''),
    numeroPaginas: Number(plantilla.numeroPaginas ?? 1),
    reactivosObjetivo: Number(plantilla.reactivosObjetivo ?? 0),
    defaultVersionCount: Number(plantilla.defaultVersionCount ?? 1),
    preguntasIds: Array.isArray(plantilla.preguntasIds) ? plantilla.preguntasIds.map((item) => String(item)) : [],
    temas: Array.isArray(plantilla.temas) ? plantilla.temas.map((item) => String(item)) : [],
    bookletConfig: plantilla.bookletConfig ?? {},
    omrConfig: plantilla.omrConfig ?? {}
  };
}

export function crearVersionCodeV1(index: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < letters.length) return letters[index]!;
  return `V${index + 1}`;
}

function construirOrdenOpciones(opciones: Array<{ texto: string; esCorrecta: boolean }>, seed: string) {
  return shuffleDeterministaV1(
    opciones.map((_, index) => index),
    seed
  );
}

export function generarVersionesDeterministasV1(args: {
  preguntas: PreguntaBaseWorkflowV1[];
  versionCount: number;
  generationSeed: string;
}) {
  const versionCount = Math.max(1, Math.min(12, Number(args.versionCount ?? 1)));
  const versions: VersionAssessmentV1[] = [];
  for (let index = 0; index < versionCount; index += 1) {
    const versionCode = crearVersionCodeV1(index);
    const orderedQuestions = shuffleDeterministaV1(args.preguntas, `${args.generationSeed}:version:${versionCode}:questions`);
    const optionOrderByQuestion: Record<string, number[]> = {};
    const preguntasVersion = orderedQuestions.map((pregunta) => {
      const optionOrder = construirOrdenOpciones(pregunta.opciones, `${args.generationSeed}:version:${versionCode}:question:${pregunta.id}:options`);
      optionOrderByQuestion[pregunta.id] = optionOrder;
      return {
        ...pregunta,
        opciones: optionOrder.map((optionIndex) => pregunta.opciones[optionIndex]!)
      };
    });
    const answerKey: AnswerKeyEntryV1[] = preguntasVersion.map((pregunta, questionIndex) => ({
      numeroPregunta: questionIndex + 1,
      idPregunta: pregunta.id,
      correcta:
        pregunta.opciones.findIndex((opcion) => opcion.esCorrecta) >= 0
          ? String.fromCharCode(65 + pregunta.opciones.findIndex((opcion) => opcion.esCorrecta))
          : null
    }));
    versions.push({
      versionCode,
      preguntas: preguntasVersion,
      answerKey,
      orderQuestions: preguntasVersion.map((pregunta) => pregunta.id),
      optionOrderByQuestion
    });
  }
  return versions;
}

export function resolverBindingsOmrV1(args: {
  prefillMode: 'none' | 'roster' | 'per-student';
  folio: string;
  students?: Array<{ _id?: unknown; matricula?: unknown; nombreCompleto?: unknown }> | null;
  versionCodes: string[];
}) {
  if (args.prefillMode === 'none') {
    return [
      {
        serialBase: `${String(args.folio).toUpperCase()}-GEN`,
        alumnoId: null,
        studentId: null,
        studentName: null,
        versionCode: args.versionCodes[0] ?? 'A'
      }
    ];
  }
  const students = Array.isArray(args.students) ? args.students : [];
  return students.map((student, index) => ({
    serialBase: `${String(args.folio).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
    alumnoId: String(student._id ?? ''),
    studentId: String(student.matricula ?? '').trim() || null,
    studentName: String(student.nombreCompleto ?? '').trim() || null,
    versionCode: args.versionCodes[index % Math.max(1, args.versionCodes.length)] ?? 'A'
  }));
}

export function encontrarAnswerKeyPorVersionV1(
  answerKeySet: Record<string, AnswerKeyEntryV1[]> | undefined,
  versionCode: string | null | undefined
) {
  if (!answerKeySet || typeof answerKeySet !== 'object') return [];
  const cleanVersion = String(versionCode ?? '').trim().toUpperCase();
  if (cleanVersion && Array.isArray(answerKeySet[cleanVersion])) return answerKeySet[cleanVersion]!;
  const fallback = Object.keys(answerKeySet).sort()[0];
  return fallback && Array.isArray(answerKeySet[fallback]) ? answerKeySet[fallback]! : [];
}

export function normalizarOpcionV1(value: unknown) {
  const clean = String(value ?? '')
    .trim()
    .toUpperCase();
  return clean || null;
}

export function calificarRespuestasV1(args: {
  answerKey: AnswerKeyEntryV1[];
  responses: RespuestaWorkflowV1[];
}) {
  const responseMap = new Map<number, string | null>();
  for (const response of Array.isArray(args.responses) ? args.responses : []) {
    const numeroPregunta = Number(response.numeroPregunta);
    if (!Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
    responseMap.set(numeroPregunta, normalizarOpcionV1(response.opcion));
  }
  let correctas = 0;
  let contestadas = 0;
  let invalidas = 0;
  const detalles = args.answerKey.map((entry) => {
    const detected = responseMap.get(Number(entry.numeroPregunta)) ?? null;
    const expected = normalizarOpcionV1(entry.correcta);
    const answered = Boolean(detected);
    const correcta = Boolean(expected && detected && expected === detected);
    if (answered) contestadas += 1;
    if (correcta) correctas += 1;
    if (answered && !correcta) invalidas += 1;
    return {
      numeroPregunta: entry.numeroPregunta,
      expected,
      detected,
      correcta
    };
  });
  const total = Math.max(1, args.answerKey.length);
  return {
    totalPreguntas: args.answerKey.length,
    correctas,
    contestadas,
    invalidas,
    porcentaje: Number(((correctas / total) * 100).toFixed(2)),
    detalles
  };
}

export function resolverAutoGradableV1(args: ResolveStatusArgs) {
  const blockingExceptions = args.exceptions.filter((exception) => String(exception.severity ?? '') === 'blocking');
  return (
    args.confidence >= 0.92 &&
    blockingExceptions.length === 0 &&
    Boolean(String(args.studentId ?? '').trim()) &&
    Boolean(String(args.versionCode ?? '').trim())
  );
}

export function resolverScanStatusV1(args: ResolveStatusArgs) {
  const blockingExceptions = args.exceptions.filter((exception) => String(exception.severity ?? '') === 'blocking');
  const warningExceptions = args.exceptions.filter((exception) => String(exception.severity ?? '') === 'warning');
  if (blockingExceptions.length > 0) return 'rejected' as const;
  if (args.confidence < 0.82 || warningExceptions.length > 0) return 'needs_review' as const;
  return 'accepted' as const;
}

export function resumirPaginasJobV1(
  pages: Array<{ scanStatus?: string; autoGradable?: boolean; sheetSerial?: string; scoreResult?: { porcentaje?: number } }>
) {
  let accepted = 0;
  let needsReview = 0;
  let rejected = 0;
  let autoGradable = 0;
  let totalScore = 0;
  let scoredPages = 0;
  const uniqueSheets = new Set<string>();
  for (const page of Array.isArray(pages) ? pages : []) {
    if (page.scanStatus === 'accepted') accepted += 1;
    else if (page.scanStatus === 'needs_review') needsReview += 1;
    else rejected += 1;
    if (page.autoGradable) autoGradable += 1;
    if (Number.isFinite(Number(page.scoreResult?.porcentaje))) {
      totalScore += Number(page.scoreResult?.porcentaje);
      scoredPages += 1;
    }
    if (page.sheetSerial) uniqueSheets.add(String(page.sheetSerial));
  }
  return {
    accepted,
    needsReview,
    rejected,
    autoGradable,
    sheets: uniqueSheets.size,
    averageScore: scoredPages > 0 ? Number((totalScore / scoredPages).toFixed(2)) : 0
  };
}

export function agruparPaginasPorHojaV1<T extends { sheetSerial?: unknown; pageIndex?: unknown }>(pages: T[]) {
  const grouped = new Map<string, T[]>();
  for (const page of Array.isArray(pages) ? pages : []) {
    const serial = String(page.sheetSerial ?? '').trim();
    if (!serial) continue;
    const current = grouped.get(serial) ?? [];
    current.push(page);
    grouped.set(serial, current);
  }
  for (const value of grouped.values()) {
    value.sort((a, b) => Number(a.pageIndex ?? 0) - Number(b.pageIndex ?? 0));
  }
  return grouped;
}
