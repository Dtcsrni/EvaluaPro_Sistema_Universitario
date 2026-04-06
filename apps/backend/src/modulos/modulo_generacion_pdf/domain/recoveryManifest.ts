import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { configuracion } from '../../../configuracion';
import type { MapaOmr, MapaVariante, PreguntaBase, TemplateVersion } from '../shared/tiposPdf';
import { extraerResumenQrExamen } from './qrExamen';

type Identificador = string | undefined;

export type RecoveryQuestionSnapshot = {
  questionId: string;
  questionRef: string;
  pageNumber: number;
  visibleNumber: number;
  variantOrder: number[];
  correctLetterVisible: string;
  enunciado: string;
  opcionesBase: Array<{ index: number; texto: string; esCorrecta: boolean }>;
  opcionesVisibles: Array<{ letra: string; originalIndex: number; texto: string; esCorrecta: boolean }>;
};

export type RecoveryManifest = {
  version: 1;
  kind: 'exam-recovery';
  keyId: string;
  generatedAt: string;
  examId: string;
  docenteId?: string;
  periodoId?: string;
  plantillaId?: string;
  loteId?: string;
  folio: string;
  templateVersion: TemplateVersion;
  totalPreguntas: number;
  totalPaginas: number;
  variantHash?: string;
  answerKeyHash?: string;
  qrKeyId?: string;
  questionBankHash: string;
  pages: Array<{
    numeroPagina: number;
    qrTexto: string;
    preguntaDesde?: number;
    preguntaHasta?: number;
    questionRefs: string[];
    optionOrders: string[];
    questionIds: string[];
  }>;
  questions: RecoveryQuestionSnapshot[];
  signature: string;
  manifestHash: string;
};

export type RecoveryBundle = {
  version: 1;
  kind: 'lot-recovery';
  keyId: string;
  generatedAt: string;
  loteId: string;
  docenteId?: string;
  periodoId?: string;
  plantillaId?: string;
  templateVersion: TemplateVersion;
  totalExamenes: number;
  questionBankHash: string;
  questionBank: Array<{
    questionId: string;
    questionRef: string;
    enunciado: string;
    opcionesBase: Array<{ index: number; texto: string; esCorrecta: boolean }>;
    sourceExamIds: string[];
    sourceFolios: string[];
  }>;
  examenes: Array<{
    examId: string;
    folio: string;
    manifestHash: string;
    variantHash?: string;
    answerKeyHash?: string;
    totalPreguntas: number;
    totalPaginas: number;
  }>;
  manifests: RecoveryManifest[];
  signature: string;
  bundleHash: string;
};

type BuildRecoveryManifestInput = {
  examId: string;
  docenteId?: Identificador;
  periodoId?: Identificador;
  plantillaId?: Identificador;
  loteId?: string;
  folio: string;
  templateVersion: TemplateVersion;
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  mapaOmr: MapaOmr;
  paginas: Array<{ numero: number; qrTexto: string; preguntasDel?: number; preguntasAl?: number }>;
};

const RECOVERY_SIGNATURE_PREFIX = 'R1';
function resolverSecretoRecoveryPorKeyId(keyId: string | undefined) {
  const normalizedKeyId = String(keyId ?? '').trim();
  if (!normalizedKeyId) return null;
  return (
    configuracion.omrRecoverySecrets[normalizedKeyId] ??
    configuracion.omrRecoverySecrets[normalizedKeyId.toLowerCase()] ??
    configuracion.omrRecoverySecrets[normalizedKeyId.toUpperCase()] ??
    null
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

function hashHex(value: string, length = 24) {
  return createHash('sha256').update(value).digest('hex').slice(0, length).toUpperCase();
}

function signPayload(payload: unknown, keyId = configuracion.omrRecoveryKeyId) {
  const canonical = stableStringify(payload);
  const secret = resolverSecretoRecoveryPorKeyId(keyId) ?? configuracion.omrRecoverySecret;
  const signature = `${RECOVERY_SIGNATURE_PREFIX}${createHmac('sha256', secret)
    .update(canonical)
    .digest('hex')
    .slice(0, 32)
    .toUpperCase()}`;
  return {
    keyId,
    canonical,
    signature,
    digest: hashHex(canonical, 32)
  };
}

function compareToken(expected: string, received: string) {
  const a = Buffer.from(String(expected ?? '').trim(), 'utf8');
  const b = Buffer.from(String(received ?? '').trim(), 'utf8');
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function buildQuestionRef(questionId: string) {
  return hashHex(String(questionId ?? ''), 8);
}

function normalizeId(value: Identificador) {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function resolveVisibleQuestionSnapshots(params: {
  preguntas: PreguntaBase[];
  mapaVariante: MapaVariante;
  mapaOmr: MapaOmr;
}) {
  const byId = new Map(params.preguntas.map((question) => [String(question.id), question]));
  const snapshots: RecoveryQuestionSnapshot[] = [];
  for (const page of params.mapaOmr?.paginas ?? []) {
    for (const question of page?.preguntas ?? []) {
      const questionId = String(question?.idPregunta ?? '').trim();
      const source = byId.get(questionId);
      if (!questionId || !source) continue;
      const variantOrder = Array.isArray(params.mapaVariante?.ordenOpcionesPorPregunta?.[questionId])
        ? params.mapaVariante.ordenOpcionesPorPregunta[questionId]!.map((index) => Math.max(0, Number(index) || 0))
        : [0, 1, 2, 3, 4];
      const opcionesBase = Array.isArray(source.opciones)
        ? source.opciones.map((option, index) => ({
            index,
            texto: String(option?.texto ?? ''),
            esCorrecta: Boolean(option?.esCorrecta)
          }))
        : [];
      const opcionesVisibles = variantOrder.map((originalIndex, visibleIndex) => {
        const option = opcionesBase[originalIndex] ?? { index: originalIndex, texto: '', esCorrecta: false };
        return {
          letra: String.fromCharCode(65 + visibleIndex),
          originalIndex,
          texto: option.texto,
          esCorrecta: option.esCorrecta
        };
      });
      const correctOption = opcionesVisibles.find((option) => option.esCorrecta);
      snapshots.push({
        questionId,
        questionRef: buildQuestionRef(questionId),
        pageNumber: Math.max(1, Number(page?.numeroPagina) || 1),
        visibleNumber: Math.max(1, Number(question?.numeroPregunta) || 1),
        variantOrder,
        correctLetterVisible: correctOption?.letra ?? 'X',
        enunciado: String(source.enunciado ?? ''),
        opcionesBase,
        opcionesVisibles
      });
    }
  }
  return snapshots.sort((a, b) => a.pageNumber - b.pageNumber || a.visibleNumber - b.visibleNumber || a.questionId.localeCompare(b.questionId));
}

export function construirRecoveryManifest(input: BuildRecoveryManifestInput): RecoveryManifest {
  const questions = resolveVisibleQuestionSnapshots({
    preguntas: input.preguntas,
    mapaVariante: input.mapaVariante,
    mapaOmr: input.mapaOmr
  });
  const pageSummaries = (Array.isArray(input.paginas) ? input.paginas : []).map((page) => {
    const qr = extraerResumenQrExamen(String(page?.qrTexto ?? ''));
    const pageOmr = (input.mapaOmr?.paginas ?? []).find((candidate) => Number(candidate?.numeroPagina) === Number(page?.numero));
    const questionIds = Array.isArray(pageOmr?.preguntas)
      ? pageOmr!.preguntas.map((question) => String(question?.idPregunta ?? '').trim()).filter(Boolean)
      : [];
    return {
      numeroPagina: Math.max(1, Number(page?.numero) || 1),
      qrTexto: String(page?.qrTexto ?? ''),
      preguntaDesde: Number.isFinite(Number(page?.preguntasDel)) && Number(page?.preguntasDel) > 0 ? Number(page?.preguntasDel) : undefined,
      preguntaHasta: Number.isFinite(Number(page?.preguntasAl)) && Number(page?.preguntasAl) > 0 ? Number(page?.preguntasAl) : undefined,
      questionRefs: Array.isArray(qr?.questionRefs) ? qr!.questionRefs : [],
      optionOrders: Array.isArray(qr?.optionOrders) ? qr!.optionOrders : [],
      questionIds
    };
  });
  const firstQr = extraerResumenQrExamen(String(pageSummaries[0]?.qrTexto ?? ''));
  const questionBankHash = hashHex(
    stableStringify(
      questions.map((question) => ({
        questionId: question.questionId,
        enunciado: question.enunciado,
        opcionesBase: question.opcionesBase
      }))
    ),
    24
  );

  const unsignedPayload = {
    version: 1 as const,
    kind: 'exam-recovery' as const,
    generatedAt: new Date().toISOString(),
    examId: String(input.examId),
    docenteId: normalizeId(input.docenteId),
    periodoId: normalizeId(input.periodoId),
    plantillaId: normalizeId(input.plantillaId),
    loteId: String(input.loteId ?? '').trim() || undefined,
    folio: String(input.folio ?? '').trim().toUpperCase(),
    templateVersion: input.templateVersion,
    totalPreguntas: questions.length,
    totalPaginas: pageSummaries.length,
    variantHash: firstQr?.variantHash,
    answerKeyHash: firstQr?.answerKeyHash,
    qrKeyId: firstQr?.keyId,
    questionBankHash,
    pages: pageSummaries,
    questions
  };
  const signed = signPayload(unsignedPayload);
  return {
    ...unsignedPayload,
    keyId: signed.keyId,
    signature: signed.signature,
    manifestHash: signed.digest
  };
}

export function verificarRecoveryManifest(manifest: RecoveryManifest) {
  const unsignedPayload = {
    version: manifest.version,
    kind: manifest.kind,
    generatedAt: manifest.generatedAt,
    examId: manifest.examId,
    docenteId: manifest.docenteId,
    periodoId: manifest.periodoId,
    plantillaId: manifest.plantillaId,
    loteId: manifest.loteId,
    folio: manifest.folio,
    templateVersion: manifest.templateVersion,
    totalPreguntas: manifest.totalPreguntas,
    totalPaginas: manifest.totalPaginas,
    variantHash: manifest.variantHash,
    answerKeyHash: manifest.answerKeyHash,
    qrKeyId: manifest.qrKeyId,
    questionBankHash: manifest.questionBankHash,
    pages: manifest.pages,
    questions: manifest.questions
  };
  if (!resolverSecretoRecoveryPorKeyId(manifest.keyId)) {
    return false;
  }
  const signed = signPayload(unsignedPayload, manifest.keyId);
  return compareToken(signed.signature, manifest.signature) && compareToken(signed.digest, manifest.manifestHash);
}

export function construirRecoveryBundle(params: {
  loteId: string;
  docenteId?: Identificador;
  periodoId?: Identificador;
  plantillaId?: Identificador;
  templateVersion: TemplateVersion;
  manifests: RecoveryManifest[];
}): RecoveryBundle {
  const questionBank = new Map<
    string,
    {
      questionId: string;
      questionRef: string;
      enunciado: string;
      opcionesBase: Array<{ index: number; texto: string; esCorrecta: boolean }>;
      sourceExamIds: Set<string>;
      sourceFolios: Set<string>;
    }
  >();
  for (const manifest of params.manifests) {
    for (const question of manifest.questions) {
      const current =
        questionBank.get(question.questionId) ??
        {
          questionId: question.questionId,
          questionRef: question.questionRef,
          enunciado: question.enunciado,
          opcionesBase: question.opcionesBase,
          sourceExamIds: new Set<string>(),
          sourceFolios: new Set<string>()
        };
      current.sourceExamIds.add(manifest.examId);
      current.sourceFolios.add(manifest.folio);
      questionBank.set(question.questionId, current);
    }
  }
  const normalizedQuestionBank = Array.from(questionBank.values())
    .map((entry) => ({
      questionId: entry.questionId,
      questionRef: entry.questionRef,
      enunciado: entry.enunciado,
      opcionesBase: entry.opcionesBase,
      sourceExamIds: Array.from(entry.sourceExamIds).sort(),
      sourceFolios: Array.from(entry.sourceFolios).sort()
    }))
    .sort((a, b) => a.questionId.localeCompare(b.questionId));
  const questionBankHash = hashHex(stableStringify(normalizedQuestionBank), 24);
  const unsignedPayload = {
    version: 1 as const,
    kind: 'lot-recovery' as const,
    generatedAt: new Date().toISOString(),
    loteId: String(params.loteId ?? '').trim().toUpperCase(),
    docenteId: normalizeId(params.docenteId),
    periodoId: normalizeId(params.periodoId),
    plantillaId: normalizeId(params.plantillaId),
    templateVersion: params.templateVersion,
    totalExamenes: params.manifests.length,
    questionBankHash,
    questionBank: normalizedQuestionBank,
    examenes: params.manifests
      .map((manifest) => ({
        examId: manifest.examId,
        folio: manifest.folio,
        manifestHash: manifest.manifestHash,
        variantHash: manifest.variantHash,
        answerKeyHash: manifest.answerKeyHash,
        totalPreguntas: manifest.totalPreguntas,
        totalPaginas: manifest.totalPaginas
      }))
      .sort((a, b) => a.folio.localeCompare(b.folio)),
    manifests: [...params.manifests].sort((a, b) => a.folio.localeCompare(b.folio))
  };
  const signed = signPayload(unsignedPayload);
  return {
    ...unsignedPayload,
    keyId: signed.keyId,
    signature: signed.signature,
    bundleHash: signed.digest
  };
}

export function verificarRecoveryBundle(bundle: RecoveryBundle) {
  const unsignedPayload = {
    version: bundle.version,
    kind: bundle.kind,
    generatedAt: bundle.generatedAt,
    loteId: bundle.loteId,
    docenteId: bundle.docenteId,
    periodoId: bundle.periodoId,
    plantillaId: bundle.plantillaId,
    templateVersion: bundle.templateVersion,
    totalExamenes: bundle.totalExamenes,
    questionBankHash: bundle.questionBankHash,
    questionBank: bundle.questionBank,
    examenes: bundle.examenes,
    manifests: bundle.manifests
  };
  if (!resolverSecretoRecoveryPorKeyId(bundle.keyId)) {
    return false;
  }
  const signed = signPayload(unsignedPayload, bundle.keyId);
  return compareToken(signed.signature, bundle.signature) && compareToken(signed.digest, bundle.bundleHash);
}
