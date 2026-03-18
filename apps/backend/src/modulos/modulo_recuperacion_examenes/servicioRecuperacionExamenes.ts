import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import { permisosParaRoles } from '../../infraestructura/seguridad/rbac';
import { Alumno } from '../modulo_alumnos/modeloAlumno';
import { Periodo } from '../modulo_alumnos/modeloPeriodo';
import { BancoPregunta } from '../modulo_banco_preguntas/modeloBancoPregunta';
import { Suscripcion } from '../modulo_comercial_core/modeloSuscripcion';
import { Tenant } from '../modulo_comercial_core/modeloTenant';
import { generarPdfExamen } from '../modulo_generacion_pdf/servicioGeneracionPdf';
import { ExamenGenerado } from '../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla, normalizarTituloPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
import { ExamenRecoveryBundle } from '../modulo_generacion_pdf/modeloExamenRecoveryBundle';
import { ExamenRecoveryManifest } from '../modulo_generacion_pdf/modeloExamenRecoveryManifest';
import {
  extraerResumenQrExamen
} from '../modulo_generacion_pdf/domain/qrExamen';
import {
  verificarRecoveryBundle,
  verificarRecoveryManifest,
  type RecoveryBundle,
  type RecoveryManifest,
  type RecoveryQuestionSnapshot
} from '../modulo_generacion_pdf/domain/recoveryManifest';
import type { PreguntaBase, MapaVariante } from '../modulo_generacion_pdf/servicioVariantes';
import type { TemplateVersion } from '../modulo_generacion_pdf/shared/tiposPdf';
import { Docente } from '../modulo_autenticacion/modeloDocente';
import { ReconstruccionExamen } from './modeloReconstruccionExamen';

type AccessContext = {
  actorDocenteId: string;
  actorRoles: string[];
  isAdmin: boolean;
  tenantIds: string[];
};

type VerificationSummary = {
  bundleHash?: string;
  manifestHash?: string;
  signatureValid: boolean;
  templateVersion?: TemplateVersion;
  examCount: number;
  questionBankCount: number;
  recoverable: boolean;
  causes: string[];
};

type ReconstructionResult = {
  status: 'verificada' | 'reconstruida' | 'conflicto' | 'fallida';
  reconstructedExamIds: string[];
  reconstructedQuestionBankIds: string[];
  conflicts: Array<Record<string, unknown>>;
  bundleHash?: string;
  manifestHashes: string[];
};

type BundleLookupCriteria = {
  bundleHash?: string;
  loteId?: string;
};

type ManifestLookupCriteria = {
  manifestHash?: string;
  examId?: string;
  folio?: string;
};

type PersistedQuestion = {
  _id: Types.ObjectId;
  enunciado: string;
  opciones: Array<{ texto: string; esCorrecta: boolean }>;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, current]) => current !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, current]) => `${JSON.stringify(key)}:${stableStringify(current)}`).join(',')}}`;
}

function hashHex(value: unknown, length = 24) {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, length).toUpperCase();
}

function normalizeId(value: unknown) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function resolveRecoverySecretKnown(keyId: string | undefined) {
  const normalizedKeyId = String(keyId ?? '').trim();
  if (!normalizedKeyId) return false;
  return Boolean(
    configuracion.omrRecoverySecrets[normalizedKeyId] ??
      configuracion.omrRecoverySecrets[normalizedKeyId.toLowerCase()] ??
      configuracion.omrRecoverySecrets[normalizedKeyId.toUpperCase()]
  );
}

function resolveQrSecretKnown(keyId: string | undefined) {
  const normalizedKeyId = String(keyId ?? '').trim();
  if (!normalizedKeyId) return false;
  return Boolean(
    configuracion.omrQrHmacSecrets[normalizedKeyId] ??
      configuracion.omrQrHmacSecrets[normalizedKeyId.toLowerCase()] ??
      configuracion.omrQrHmacSecrets[normalizedKeyId.toUpperCase()]
  );
}

function buildRecoveryPdfName(params: { folio: string; loteId?: string; templateVersion: TemplateVersion }) {
  const folio = String(params.folio ?? '').trim().toUpperCase();
  const loteId = String(params.loteId ?? '').trim().toUpperCase();
  return ['evaluapro', 'recovery', `tv${params.templateVersion}`, loteId || undefined, folio]
    .filter(Boolean)
    .join('_')
    .concat('.pdf');
}

function dedupeQuestionsFromManifest(manifest: RecoveryManifest) {
  const byId = new Map<string, RecoveryQuestionSnapshot>();
  for (const question of manifest.questions) {
    if (!byId.has(question.questionId)) byId.set(question.questionId, question);
  }
  return Array.from(byId.values()).sort((a, b) => a.pageNumber - b.pageNumber || a.visibleNumber - b.visibleNumber);
}

function buildMapVariantFromManifest(manifest: RecoveryManifest): MapaVariante {
  const orderedQuestions = [...manifest.questions]
    .sort((a, b) => a.pageNumber - b.pageNumber || a.visibleNumber - b.visibleNumber)
    .map((question) => question.questionId);
  const optionMap: Record<string, number[]> = {};
  for (const question of manifest.questions) {
    optionMap[question.questionId] = [...question.variantOrder];
  }
  return {
    ordenPreguntas: orderedQuestions,
    ordenOpcionesPorPregunta: optionMap
  };
}

function buildPreguntasBaseForPdf(questions: RecoveryQuestionSnapshot[]): PreguntaBase[] {
  return questions.map((question) => ({
    id: question.questionId,
    enunciado: question.enunciado,
    opciones: [...question.opcionesBase]
      .sort((a, b) => a.index - b.index)
      .map((option) => ({ texto: option.texto, esCorrecta: option.esCorrecta }))
  }));
}

async function resolveAccessContext(actorDocenteId: string, actorRoles: string[]): Promise<AccessContext> {
  const permissions = permisosParaRoles(actorRoles);
  const isAdmin = permissions.has('docentes:administrar') || permissions.has('comercial:auditoria:leer');
  if (isAdmin) {
    return {
      actorDocenteId,
      actorRoles,
      isAdmin: true,
      tenantIds: []
    };
  }
  if (!permissions.has('recuperacion:leer') && !permissions.has('recuperacion:reconstruir')) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin permisos de recuperacion', 403);
  }
  const tenants = await Tenant.find({ ownerDocenteId: actorDocenteId }).lean();
  const tenantIds = tenants.map((tenant) => String((tenant as { tenantId?: unknown }).tenantId ?? '').trim().toLowerCase()).filter(Boolean);
  if (!tenantIds.length) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'No hay tenant comercial asociado al docente', 403);
  }
  const subscriptions = await Suscripcion.find({
    tenantId: { $in: tenantIds },
    estado: { $in: ['activo', 'past_due'] }
  }).lean();
  if (!subscriptions.length) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Se requiere un plan activo para recuperar examenes', 403);
  }
  return {
    actorDocenteId,
    actorRoles,
    isAdmin: false,
    tenantIds
  };
}

async function resolveManifestByCriteria(
  access: AccessContext,
  criteria: ManifestLookupCriteria
): Promise<{ manifest: RecoveryManifest; sourceDocenteId?: string; recordId: string }> {
  const query: Record<string, unknown> = {};
  if (criteria.manifestHash) query.manifestHash = criteria.manifestHash;
  if (criteria.examId) query.examId = criteria.examId;
  if (criteria.folio) query.folio = String(criteria.folio).trim().toUpperCase();
  if (!access.isAdmin) query.docenteId = access.actorDocenteId;
  const persisted = await ExamenRecoveryManifest.findOne(query).lean();
  if (!persisted) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 'Recovery manifest no encontrado', 404, criteria);
  }
  return {
    manifest: (persisted as { manifest: RecoveryManifest }).manifest,
    sourceDocenteId: normalizeId((persisted as { docenteId?: unknown }).docenteId),
    recordId: String((persisted as { _id?: unknown })._id ?? '')
  };
}

async function resolveBundleByCriteria(
  access: AccessContext,
  criteria: BundleLookupCriteria
): Promise<{ bundle: RecoveryBundle; sourceDocenteId?: string; recordId: string }> {
  const query: Record<string, unknown> = {};
  if (criteria.bundleHash) query.bundleHash = criteria.bundleHash;
  if (criteria.loteId) query.loteId = String(criteria.loteId).trim().toUpperCase();
  if (!access.isAdmin) query.docenteId = access.actorDocenteId;
  const persisted = await ExamenRecoveryBundle.findOne(query).lean();
  if (!persisted) {
    throw new ErrorAplicacion('NO_ENCONTRADO', 'Recovery bundle no encontrado', 404, criteria);
  }
  return {
    bundle: (persisted as { bundle: RecoveryBundle }).bundle,
    sourceDocenteId: normalizeId((persisted as { docenteId?: unknown }).docenteId),
    recordId: String((persisted as { _id?: unknown })._id ?? '')
  };
}

function validateQrPages(manifest: RecoveryManifest, causes: string[]) {
  const byId = new Set(manifest.questions.map((question) => question.questionId));
  for (const page of manifest.pages) {
    const qr = extraerResumenQrExamen(page.qrTexto);
    if (!qr) {
      causes.push(`QR invalido en pagina ${page.numeroPagina}`);
      continue;
    }
  if (qr.payloadSignatureMode !== 'hmac-v1' || !qr.payloadSignatureValid) {
      causes.push(`QR sin firma valida en pagina ${page.numeroPagina}`);
    }
    for (const questionId of page.questionIds) {
      if (!byId.has(questionId)) {
        causes.push(`Pregunta ${questionId} declarada en pagina ${page.numeroPagina} no existe en manifest`);
      }
    }
  }
}

function buildVerificationForManifest(manifest: RecoveryManifest): VerificationSummary {
  const causes: string[] = [];
  const signatureValid = verificarRecoveryManifest(manifest);
  if (!signatureValid) causes.push('Firma de recovery manifest invalida');
  if (!resolveRecoverySecretKnown(manifest.keyId)) {
    causes.push(`keyId recovery desconocido: ${manifest.keyId}`);
  }
  if (!resolveQrSecretKnown(manifest.qrKeyId)) {
    causes.push(`keyId QR desconocido: ${manifest.qrKeyId ?? 'sin-key-id'}`);
  }
  if (![3, 4].includes(Number(manifest.templateVersion))) {
    causes.push(`templateVersion no soportada: ${manifest.templateVersion}`);
  }
  if ((manifest.pages?.length ?? 0) !== Number(manifest.totalPaginas)) {
    causes.push('totalPaginas no coincide con pages[]');
  }
  if ((manifest.questions?.length ?? 0) !== Number(manifest.totalPreguntas)) {
    causes.push('totalPreguntas no coincide con questions[]');
  }
  validateQrPages(manifest, causes);
  return {
    manifestHash: manifest.manifestHash,
    signatureValid,
    templateVersion: manifest.templateVersion,
    examCount: 1,
    questionBankCount: dedupeQuestionsFromManifest(manifest).length,
    recoverable: causes.length === 0,
    causes
  };
}

function buildVerificationForBundle(bundle: RecoveryBundle): VerificationSummary {
  const causes: string[] = [];
  const signatureValid = verificarRecoveryBundle(bundle);
  if (!signatureValid) causes.push('Firma de recovery bundle invalida');
  if (!resolveRecoverySecretKnown(bundle.keyId)) {
    causes.push(`keyId recovery desconocido: ${bundle.keyId}`);
  }
  if ((bundle.manifests?.length ?? 0) !== Number(bundle.totalExamenes)) {
    causes.push('totalExamenes no coincide con manifests[]');
  }
  if ((bundle.examenes?.length ?? 0) !== Number(bundle.totalExamenes)) {
    causes.push('totalExamenes no coincide con examenes[]');
  }
  const byHash = new Map(bundle.examenes.map((exam) => [exam.manifestHash, exam]));
  for (const manifest of bundle.manifests ?? []) {
    const examSummary = byHash.get(manifest.manifestHash);
    if (!examSummary) {
      causes.push(`Manifest ${manifest.manifestHash} no referenciado en examenes[]`);
      continue;
    }
    if (examSummary.folio !== manifest.folio || examSummary.examId !== manifest.examId) {
      causes.push(`Resumen de manifest ${manifest.manifestHash} inconsistente`);
    }
    const manifestVerification = buildVerificationForManifest(manifest);
    causes.push(...manifestVerification.causes.map((cause) => `[${manifest.folio}] ${cause}`));
  }
  return {
    bundleHash: bundle.bundleHash,
    signatureValid,
    templateVersion: bundle.templateVersion,
    examCount: bundle.examenes?.length ?? 0,
    questionBankCount: bundle.questionBank?.length ?? 0,
    recoverable: causes.length === 0,
    causes
  };
}

async function resolveTargetDocenteId(access: AccessContext, sourceDocenteId?: string) {
  if (sourceDocenteId) {
    const exists = await Docente.exists({ _id: sourceDocenteId });
    if (exists) return sourceDocenteId;
  }
  return access.actorDocenteId;
}

async function ensurePeriodo(params: {
  docenteId: string;
  actorDocenteId: string;
  manifest: RecoveryManifest;
  origin: 'recovery_manifest' | 'recovery_bundle';
  bundleHash?: string;
}) {
  if (params.manifest.periodoId) {
    const current = await Periodo.findOne({ _id: params.manifest.periodoId, docenteId: params.docenteId });
    if (current) return current;
  }
  const recoveryQuery = {
    docenteId: params.docenteId,
    'recoverySource.recoveryManifestHash': params.manifest.manifestHash
  };
  const existingRecovery = await Periodo.findOne(recoveryQuery);
  if (existingRecovery) return existingRecovery;
  const periodo = await Periodo.create({
    docenteId: params.docenteId,
    nombre: `Recuperacion ${params.manifest.loteId ?? params.manifest.folio}`,
    fechaInicio: new Date(),
    fechaFin: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    grupos: [],
    recoverySource: {
      origen: params.origin,
      recoveryBundleHash: params.bundleHash,
      recoveryManifestHash: params.manifest.manifestHash,
      reconstructedAt: new Date(),
      reconstructedBy: params.actorDocenteId
    }
  });
  return periodo;
}

async function ensureAlumnoPlaceholder(params: {
  docenteId: string;
  periodoId: string;
  actorDocenteId: string;
  manifest: RecoveryManifest;
  origin: 'recovery_manifest' | 'recovery_bundle';
  bundleHash?: string;
}) {
  const matricula = `REC-${params.manifest.folio}`.slice(0, 64);
  const existing = await Alumno.findOne({ docenteId: params.docenteId, periodoId: params.periodoId, matricula });
  if (existing) return existing;
  return Alumno.create({
    docenteId: params.docenteId,
    periodoId: params.periodoId,
    matricula,
    nombreCompleto: `Alumno Recuperado ${params.manifest.folio}`,
    grupo: 'RECOVERY',
    recoverySource: {
      origen: params.origin,
      recoveryBundleHash: params.bundleHash,
      recoveryManifestHash: params.manifest.manifestHash,
      sourceFolio: params.manifest.folio,
      reconstructedAt: new Date(),
      reconstructedBy: params.actorDocenteId
    }
  });
}

async function reconstructQuestionBank(params: {
  docenteId: string;
  periodoId: string;
  actorDocenteId: string;
  manifest: RecoveryManifest;
  origin: 'recovery_manifest' | 'recovery_bundle';
  bundleHash?: string;
}) {
  const conflicts: Array<Record<string, unknown>> = [];
  const reconstructed: PersistedQuestion[] = [];
  for (const question of dedupeQuestionsFromManifest(params.manifest)) {
    const payload = {
      enunciado: question.enunciado,
      opciones: [...question.opcionesBase]
        .sort((a, b) => a.index - b.index)
        .map((option) => ({ texto: option.texto, esCorrecta: option.esCorrecta }))
    };
    const existing = await BancoPregunta.findOne({
      docenteId: params.docenteId,
      periodoId: params.periodoId,
      'recoverySource.sourceQuestionId': question.questionId
    });
    if (existing) {
      const currentVersion =
        (existing.versiones ?? []).find((version: { numeroVersion?: number }) => version.numeroVersion === existing.versionActual) ??
        existing.versiones?.[0];
      const currentPayload = {
        enunciado: String(currentVersion?.enunciado ?? ''),
        opciones: Array.isArray(currentVersion?.opciones)
          ? currentVersion.opciones.map((option: { texto?: string; esCorrecta?: boolean }) => ({
              texto: String(option?.texto ?? ''),
              esCorrecta: Boolean(option?.esCorrecta)
            }))
          : []
      };
      if (stableStringify(currentPayload) !== stableStringify(payload)) {
        conflicts.push({
          type: 'question_bank_mismatch',
          sourceQuestionId: question.questionId,
          bancoPreguntaId: String(existing._id)
        });
        continue;
      }
      reconstructed.push({
        _id: existing._id,
        enunciado: payload.enunciado,
        opciones: payload.opciones
      });
      continue;
    }
    const created = await BancoPregunta.create({
      docenteId: params.docenteId,
      periodoId: params.periodoId,
      activo: true,
      versionActual: 1,
      versiones: [
        {
          numeroVersion: 1,
          enunciado: payload.enunciado,
          opciones: payload.opciones
        }
      ],
      recoverySource: {
        origen: params.origin,
        recoveryBundleHash: params.bundleHash,
        recoveryManifestHash: params.manifest.manifestHash,
        sourceQuestionId: question.questionId,
        reconstructedAt: new Date(),
        reconstructedBy: params.actorDocenteId
      }
    });
    reconstructed.push({
      _id: created._id,
      enunciado: payload.enunciado,
      opciones: payload.opciones
    });
  }
  return { questions: reconstructed, conflicts };
}

async function ensureTemplate(params: {
  docenteId: string;
  periodoId: string;
  actorDocenteId: string;
  manifest: RecoveryManifest;
  origin: 'recovery_manifest' | 'recovery_bundle';
  bundleHash?: string;
  preguntasIds: string[];
}) {
  if (params.manifest.plantillaId) {
    const original = await ExamenPlantilla.findOne({ _id: params.manifest.plantillaId, docenteId: params.docenteId });
    if (original) return original;
  }
  const title = `Recuperado ${params.manifest.loteId ?? params.manifest.folio}`;
  const normalizedTitle = normalizarTituloPlantilla(title);
  const existing = await ExamenPlantilla.findOne({
    docenteId: params.docenteId,
    periodoId: params.periodoId,
    tituloNormalizado: normalizedTitle
  });
  if (existing) return existing;
  return ExamenPlantilla.create({
    docenteId: params.docenteId,
    periodoId: params.periodoId,
    tipo: 'parcial',
    titulo: title,
    numeroPaginas: params.manifest.totalPaginas,
    reactivosObjetivo: params.manifest.totalPreguntas,
    preguntasIds: params.preguntasIds,
    omrConfig: {
      sheetFamilyCode: `TV${params.manifest.templateVersion}`,
      versionMode: 'single'
    },
    recoverySource: {
      origen: params.origin,
      recoveryBundleHash: params.bundleHash,
      recoveryManifestHash: params.manifest.manifestHash,
      reconstructedAt: new Date(),
      reconstructedBy: params.actorDocenteId
    }
  });
}

async function persistExecutionLog(payload: Record<string, unknown>) {
  await ReconstruccionExamen.create(payload);
}

async function reconstructFromManifestInternal(params: {
  access: AccessContext;
  manifest: RecoveryManifest;
  sourceDocenteId?: string;
  origin: 'recovery_manifest' | 'recovery_bundle';
  bundleHash?: string;
}): Promise<ReconstructionResult> {
  const verification = buildVerificationForManifest(params.manifest);
  const docenteDestinoId = await resolveTargetDocenteId(params.access, params.sourceDocenteId);
  if (!verification.recoverable) {
    await persistExecutionLog({
      tipo: 'manifest',
      estado: 'fallida',
      docenteSolicitanteId: params.access.actorDocenteId,
      docenteDestinoId,
      bundleHash: params.bundleHash,
      manifestHash: params.manifest.manifestHash,
      loteId: params.manifest.loteId,
      examId: params.manifest.examId,
      folio: params.manifest.folio,
      signatureValid: verification.signatureValid,
      recoverable: verification.recoverable,
      causes: verification.causes
    });
    return {
      status: 'fallida',
      reconstructedExamIds: [],
      reconstructedQuestionBankIds: [],
      conflicts: [],
      bundleHash: params.bundleHash,
      manifestHashes: [params.manifest.manifestHash]
    };
  }

  const existing = await ExamenGenerado.findOne({ folio: params.manifest.folio });
  if (existing) {
    if (String(existing.recoveryManifestHash ?? '') === params.manifest.manifestHash) {
      return {
        status: 'reconstruida',
        reconstructedExamIds: [String(existing._id)],
        reconstructedQuestionBankIds: [],
        conflicts: [],
        bundleHash: params.bundleHash,
        manifestHashes: [params.manifest.manifestHash]
      };
    }
    const conflict = [{ type: 'folio_conflict', folio: params.manifest.folio, examenGeneradoId: String(existing._id) }];
    await persistExecutionLog({
      tipo: 'manifest',
      estado: 'conflicto',
      docenteSolicitanteId: params.access.actorDocenteId,
      docenteDestinoId,
      bundleHash: params.bundleHash,
      manifestHash: params.manifest.manifestHash,
      loteId: params.manifest.loteId,
      examId: params.manifest.examId,
      folio: params.manifest.folio,
      signatureValid: verification.signatureValid,
      recoverable: verification.recoverable,
      causes: [],
      conflicts: conflict
    });
    return {
      status: 'conflicto',
      reconstructedExamIds: [],
      reconstructedQuestionBankIds: [],
      conflicts: conflict,
      bundleHash: params.bundleHash,
      manifestHashes: [params.manifest.manifestHash]
    };
  }

  const periodo = await ensurePeriodo({
    docenteId: docenteDestinoId,
    actorDocenteId: params.access.actorDocenteId,
    manifest: params.manifest,
    origin: params.origin,
    bundleHash: params.bundleHash
  });
  const alumno = await ensureAlumnoPlaceholder({
    docenteId: docenteDestinoId,
    periodoId: String(periodo._id),
    actorDocenteId: params.access.actorDocenteId,
    manifest: params.manifest,
    origin: params.origin,
    bundleHash: params.bundleHash
  });
  const questionBank = await reconstructQuestionBank({
    docenteId: docenteDestinoId,
    periodoId: String(periodo._id),
    actorDocenteId: params.access.actorDocenteId,
    manifest: params.manifest,
    origin: params.origin,
    bundleHash: params.bundleHash
  });
  if (questionBank.conflicts.length) {
    await persistExecutionLog({
      tipo: 'manifest',
      estado: 'conflicto',
      docenteSolicitanteId: params.access.actorDocenteId,
      docenteDestinoId,
      bundleHash: params.bundleHash,
      manifestHash: params.manifest.manifestHash,
      loteId: params.manifest.loteId,
      examId: params.manifest.examId,
      folio: params.manifest.folio,
      signatureValid: verification.signatureValid,
      recoverable: verification.recoverable,
      causes: [],
      conflicts: questionBank.conflicts
    });
    return {
      status: 'conflicto',
      reconstructedExamIds: [],
      reconstructedQuestionBankIds: [],
      conflicts: questionBank.conflicts,
      bundleHash: params.bundleHash,
      manifestHashes: [params.manifest.manifestHash]
    };
  }

  const plantilla = await ensureTemplate({
    docenteId: docenteDestinoId,
    periodoId: String(periodo._id),
    actorDocenteId: params.access.actorDocenteId,
    manifest: params.manifest,
    origin: params.origin,
    bundleHash: params.bundleHash,
    preguntasIds: questionBank.questions.map((question) => String(question._id))
  });
  const mapaVariante = buildMapVariantFromManifest(params.manifest);
  const preguntasBase = buildPreguntasBaseForPdf(dedupeQuestionsFromManifest(params.manifest));
  const encabezadoAlumno = {
    nombre: String(alumno.nombreCompleto ?? ''),
    grupo: String(alumno.grupo ?? 'RECOVERY')
  };
  const pdf = await generarPdfExamen({
    titulo: String(plantilla.titulo ?? 'Examen Recuperado'),
    folio: params.manifest.folio,
    examId: params.manifest.examId,
    preguntas: preguntasBase,
    mapaVariante,
    tipoExamen: String(plantilla.tipo ?? 'parcial') === 'global' ? 'global' : 'parcial',
    totalPaginas: params.manifest.totalPaginas,
    templateVersion: params.manifest.templateVersion,
    encabezado: {
      alumno: encabezadoAlumno,
      mostrarInstrucciones: true
    }
  });
  const rutaPdf = await guardarPdfExamen(
    buildRecoveryPdfName({
      folio: params.manifest.folio,
      loteId: params.manifest.loteId,
      templateVersion: params.manifest.templateVersion
    }),
    Buffer.from(pdf.pdfBytes)
  );
  const created = await ExamenGenerado.create({
    docenteId: docenteDestinoId,
    periodoId: periodo._id,
    plantillaId: plantilla._id,
    alumnoId: alumno._id,
    loteId: params.manifest.loteId,
    folio: params.manifest.folio,
    preguntasIds: questionBank.questions.map((question) => question._id),
    mapaVariante,
    mapaOmr: pdf.mapaOmr,
    paginas: pdf.paginas,
    rutaPdf,
    recoveryKeyId: params.manifest.keyId,
    recoveryManifestHash: params.manifest.manifestHash,
    recoveryManifest: params.manifest,
    recoveryBundleHash: params.bundleHash,
    reconstructedFrom: {
      origen: params.origin,
      recoveryBundleHash: params.bundleHash,
      recoveryManifestHash: params.manifest.manifestHash,
      reconstructedAt: new Date(),
      reconstructedBy: params.access.actorDocenteId
    }
  });

  await persistExecutionLog({
    tipo: 'manifest',
    estado: 'reconstruida',
    docenteSolicitanteId: params.access.actorDocenteId,
    docenteDestinoId,
    bundleHash: params.bundleHash,
    manifestHash: params.manifest.manifestHash,
    loteId: params.manifest.loteId,
    examId: params.manifest.examId,
    folio: params.manifest.folio,
    signatureValid: verification.signatureValid,
    recoverable: verification.recoverable,
    causes: [],
    reconstructedQuestionBankIds: questionBank.questions.map((question) => question._id),
    reconstructedExamIds: [created._id]
  });

  return {
    status: 'reconstruida',
    reconstructedExamIds: [String(created._id)],
    reconstructedQuestionBankIds: questionBank.questions.map((question) => String(question._id)),
    conflicts: [],
    bundleHash: params.bundleHash,
    manifestHashes: [params.manifest.manifestHash]
  };
}

export async function listarBundlesRecuperables(params: {
  actorDocenteId: string;
  actorRoles: string[];
}) {
  const access = await resolveAccessContext(params.actorDocenteId, params.actorRoles);
  const query: Record<string, unknown> = access.isAdmin ? {} : { docenteId: access.actorDocenteId };
  const bundles = await ExamenRecoveryBundle.find(query).sort({ createdAt: -1 }).lean();
  return bundles.map((record) => {
    const bundle = (record as { bundle: RecoveryBundle }).bundle;
    const verification = buildVerificationForBundle(bundle);
    return {
      bundleHash: bundle.bundleHash,
      loteId: bundle.loteId,
      templateVersion: bundle.templateVersion,
      examCount: bundle.totalExamenes,
      questionBankCount: bundle.questionBank.length,
      signatureValid: verification.signatureValid,
      recoverable: verification.recoverable,
      causes: verification.causes
    };
  });
}

export async function verificarArtifactsRecuperacion(params: {
  actorDocenteId: string;
  actorRoles: string[];
  bundleHash?: string;
  loteId?: string;
  manifestHash?: string;
  examId?: string;
  folio?: string;
}) {
  const access = await resolveAccessContext(params.actorDocenteId, params.actorRoles);
  if (params.bundleHash || params.loteId) {
    const { bundle } = await resolveBundleByCriteria(access, {
      bundleHash: params.bundleHash,
      loteId: params.loteId
    });
    return buildVerificationForBundle(bundle);
  }
  const { manifest } = await resolveManifestByCriteria(access, {
    manifestHash: params.manifestHash,
    examId: params.examId,
    folio: params.folio
  });
  return buildVerificationForManifest(manifest);
}

export async function reconstruirDesdeManifest(params: {
  actorDocenteId: string;
  actorRoles: string[];
  manifestHash?: string;
  examId?: string;
  folio?: string;
}) {
  const access = await resolveAccessContext(params.actorDocenteId, params.actorRoles);
  if (!permisosParaRoles(access.actorRoles).has('recuperacion:reconstruir') && !access.isAdmin) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin permisos para reconstruir', 403);
  }
  const resolved = await resolveManifestByCriteria(access, {
    manifestHash: params.manifestHash,
    examId: params.examId,
    folio: params.folio
  });
  return reconstructFromManifestInternal({
    access,
    manifest: resolved.manifest,
    sourceDocenteId: resolved.sourceDocenteId,
    origin: 'recovery_manifest'
  });
}

export async function reconstruirDesdeBundle(params: {
  actorDocenteId: string;
  actorRoles: string[];
  bundleHash?: string;
  loteId?: string;
}) {
  const access = await resolveAccessContext(params.actorDocenteId, params.actorRoles);
  if (!permisosParaRoles(access.actorRoles).has('recuperacion:reconstruir') && !access.isAdmin) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin permisos para reconstruir', 403);
  }
  const resolved = await resolveBundleByCriteria(access, {
    bundleHash: params.bundleHash,
    loteId: params.loteId
  });
  const verification = buildVerificationForBundle(resolved.bundle);
  if (!verification.recoverable) {
    await persistExecutionLog({
      tipo: 'bundle',
      estado: 'fallida',
      docenteSolicitanteId: access.actorDocenteId,
      docenteDestinoId: await resolveTargetDocenteId(access, resolved.sourceDocenteId),
      bundleHash: resolved.bundle.bundleHash,
      loteId: resolved.bundle.loteId,
      signatureValid: verification.signatureValid,
      recoverable: verification.recoverable,
      causes: verification.causes
    });
    return {
      status: 'fallida',
      reconstructedExamIds: [],
      reconstructedQuestionBankIds: [],
      conflicts: [],
      bundleHash: resolved.bundle.bundleHash,
      manifestHashes: []
    } satisfies ReconstructionResult;
  }
  const examIds: string[] = [];
  const questionIds = new Set<string>();
  const conflicts: Array<Record<string, unknown>> = [];
  const manifestHashes: string[] = [];
  for (const manifest of resolved.bundle.manifests) {
    const result = await reconstructFromManifestInternal({
      access,
      manifest,
      sourceDocenteId: resolved.sourceDocenteId,
      origin: 'recovery_bundle',
      bundleHash: resolved.bundle.bundleHash
    });
    manifestHashes.push(...result.manifestHashes);
    result.reconstructedExamIds.forEach((id) => examIds.push(id));
    result.reconstructedQuestionBankIds.forEach((id) => questionIds.add(id));
    conflicts.push(...result.conflicts);
  }
  const status = conflicts.length ? 'conflicto' : 'reconstruida';
  await persistExecutionLog({
    tipo: 'bundle',
    estado: status,
    docenteSolicitanteId: access.actorDocenteId,
    docenteDestinoId: await resolveTargetDocenteId(access, resolved.sourceDocenteId),
    bundleHash: resolved.bundle.bundleHash,
    loteId: resolved.bundle.loteId,
    signatureValid: verification.signatureValid,
    recoverable: verification.recoverable,
    causes: [],
    reconstructedQuestionBankIds: Array.from(questionIds),
    reconstructedExamIds: examIds,
    conflicts
  });
  return {
    status,
    reconstructedExamIds: examIds,
    reconstructedQuestionBankIds: Array.from(questionIds),
    conflicts,
    bundleHash: resolved.bundle.bundleHash,
    manifestHashes
  } satisfies ReconstructionResult;
}
