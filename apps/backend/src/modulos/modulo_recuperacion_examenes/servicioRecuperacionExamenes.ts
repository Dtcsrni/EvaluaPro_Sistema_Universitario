/**
 * servicioRecuperacionExamenes
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { configuracion } from '../../configuracion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal';
import { permisosParaRoles } from '../../infraestructura/seguridad/rbac';
import { generarPdfExamen } from '../modulo_generacion_pdf/servicioGeneracionPdf';
import { normalizarTituloPlantilla } from '../modulo_generacion_pdf/modeloExamenPlantilla';
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
  _id: string;
  id?: string;
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
  if (!isAdmin && !permissions.has('recuperacion:leer') && !permissions.has('recuperacion:reconstruir')) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin permisos de recuperacion', 403);
  }
  return {
    actorDocenteId,
    actorRoles,
    isAdmin,
    tenantIds: []
  };
}

async function resolveManifestByCriteria(
  access: AccessContext,
  criteria: ManifestLookupCriteria
): Promise<{ manifest: RecoveryManifest; sourceDocenteId?: string; recordId: string }> {
  if (criteria.manifestHash) {
    const persisted = await prisma.examenRecoveryManifest.findUnique({
      where: { manifestHash: criteria.manifestHash }
    });
    if (persisted) {
      if (!access.isAdmin && persisted.docenteId !== access.actorDocenteId) {
        throw new ErrorAplicacion('NO_ENCONTRADO', 'Recovery manifest no encontrado', 404, criteria);
      }
      return {
        manifest: JSON.parse(persisted.metadata || '{}'),
        sourceDocenteId: persisted.docenteId,
        recordId: persisted.id
      };
    }
  }

  const whereClause = access.isAdmin ? {} : { docenteId: access.actorDocenteId };
  const allManifests = await prisma.examenRecoveryManifest.findMany({
    where: whereClause
  });

  for (const persisted of allManifests) {
    const manifest: RecoveryManifest = JSON.parse(persisted.metadata || '{}');
    let matches = true;
    if (criteria.examId && manifest.examId !== criteria.examId) matches = false;
    if (criteria.folio && String(manifest.folio).trim().toUpperCase() !== String(criteria.folio).trim().toUpperCase()) matches = false;
    
    if (matches) {
      return {
        manifest,
        sourceDocenteId: persisted.docenteId,
        recordId: persisted.id
      };
    }
  }

  throw new ErrorAplicacion('NO_ENCONTRADO', 'Recovery manifest no encontrado', 404, criteria);
}

async function resolveBundleByCriteria(
  access: AccessContext,
  criteria: BundleLookupCriteria
): Promise<{ bundle: RecoveryBundle; sourceDocenteId?: string; recordId: string }> {
  if (criteria.bundleHash) {
    const persisted = await prisma.examenRecoveryBundle.findUnique({
      where: { bundleHash: criteria.bundleHash }
    });
    if (persisted) {
      if (!access.isAdmin && persisted.docenteId !== access.actorDocenteId) {
        throw new ErrorAplicacion('NO_ENCONTRADO', 'Recovery bundle no encontrado', 404, criteria);
      }
      return {
        bundle: JSON.parse(persisted.metadata || '{}'),
        sourceDocenteId: persisted.docenteId,
        recordId: persisted.id
      };
    }
  }

  const whereClause = access.isAdmin ? {} : { docenteId: access.actorDocenteId };
  const allBundles = await prisma.examenRecoveryBundle.findMany({
    where: whereClause
  });

  for (const persisted of allBundles) {
    const bundle: RecoveryBundle = JSON.parse(persisted.metadata || '{}');
    let matches = true;
    if (criteria.loteId && String(bundle.loteId).trim().toUpperCase() !== String(criteria.loteId).trim().toUpperCase()) matches = false;

    if (matches) {
      return {
        bundle,
        sourceDocenteId: persisted.docenteId,
        recordId: persisted.id
      };
    }
  }

  throw new ErrorAplicacion('NO_ENCONTRADO', 'Recovery bundle no encontrado', 404, criteria);
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
        causes.push(`Pregunta ${questionId} referenciada en pagina ${page.numeroPagina} no tiene snapshot en el manifest`);
      }
    }
  }
}

function buildVerificationForManifest(manifest: RecoveryManifest): VerificationSummary {
  const causes: string[] = [];
  const signatureValid = verificarRecoveryManifest(manifest);
  if (!signatureValid) causes.push('Firma invalida del recovery manifest');
  if (!resolveRecoverySecretKnown(manifest.keyId)) causes.push(`Llave de recuperacion desconocida: ${manifest.keyId}`);
  if (!resolveQrSecretKnown(manifest.qrKeyId ?? manifest.keyId)) causes.push(`Llave HMAC OMR desconocida: ${manifest.qrKeyId ?? manifest.keyId}`);
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
  if (!signatureValid) causes.push('Firma invalida del recovery bundle');
  if (!resolveRecoverySecretKnown(bundle.keyId)) causes.push(`Llave de recuperacion desconocida: ${bundle.keyId}`);
  for (const manifest of bundle.manifests || []) {
    const sub = buildVerificationForManifest(manifest);
    if (!sub.recoverable) {
      sub.causes.forEach((cause) => {
        const fullCause = `Folio ${manifest.folio}: ${cause}`;
        if (!causes.includes(fullCause)) causes.push(fullCause);
      });
    }
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
    const exists = await prisma.docente.findUnique({
      where: { id: sourceDocenteId }
    });
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
    const current = await prisma.periodo.findFirst({
      where: { id: params.manifest.periodoId, docenteId: params.docenteId }
    });
    if (current) return current;
  }
  const nombre = `Recuperacion ${params.manifest.loteId ?? params.manifest.folio}`;
  const nombreNormalizado = nombre.toLowerCase().trim();
  const existingRecovery = await prisma.periodo.findFirst({
    where: { docenteId: params.docenteId, nombreNormalizado }
  });
  if (existingRecovery) return existingRecovery;

  const periodo = await prisma.periodo.create({
    data: {
      docenteId: params.docenteId,
      nombre,
      nombreNormalizado,
      fechaInicio: new Date(),
      fechaFin: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      grupos: JSON.stringify([])
    }
  });
  return {
    ...periodo,
    _id: periodo.id,
    grupos: []
  };
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
  const existing = await prisma.alumno.findFirst({
    where: { periodoId: params.periodoId, matricula }
  });
  if (existing) return { ...existing, _id: existing.id };

  const alumno = await prisma.alumno.create({
    data: {
      periodoId: params.periodoId,
      matricula,
      nombreCompleto: `Alumno Recuperado ${params.manifest.folio}`,
      correo: `alumno-recovery-${params.manifest.folio}@evaluapro.local`,
      grupo: 'RECOVERY',
      activo: true
    }
  });

  return { ...alumno, _id: alumno.id };
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

  const allPreguntas = await prisma.bancoPregunta.findMany({
    where: { docenteId: params.docenteId, periodoId: params.periodoId },
    include: {
      versiones: {
        include: { opciones: true }
      }
    }
  });

  for (const question of dedupeQuestionsFromManifest(params.manifest)) {
    const payload = {
      enunciado: question.enunciado,
      opciones: [...question.opcionesBase]
        .sort((a, b) => a.index - b.index)
        .map((option) => ({ texto: option.texto, esCorrecta: option.esCorrecta }))
    };

    const existing = allPreguntas.find((bp) => {
      const source = JSON.parse(bp.recoverySource || '{}');
      return source.sourceQuestionId === question.questionId;
    });

    if (existing) {
      const currentVersion =
        existing.versiones.find((version) => version.numeroVersion === existing.versionActual) ??
        existing.versiones[0];
      const currentPayload = {
        enunciado: String(currentVersion?.enunciado ?? ''),
        opciones: Array.isArray(currentVersion?.opciones)
          ? currentVersion.opciones.map((option) => ({
              texto: String(option?.texto ?? ''),
              esCorrecta: Boolean(option?.esCorrecta)
            }))
          : []
      };
      if (stableStringify(currentPayload) !== stableStringify(payload)) {
        conflicts.push({
          type: 'question_bank_mismatch',
          sourceQuestionId: question.questionId,
          bancoPreguntaId: existing.id
        });
        continue;
      }
      reconstructed.push({
        _id: existing.id,
        id: existing.id,
        enunciado: payload.enunciado,
        opciones: payload.opciones
      });
      continue;
    }

    const created = await prisma.bancoPregunta.create({
      data: {
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        activo: true,
        versionActual: 1,
        recoverySource: JSON.stringify({
          origen: params.origin,
          recoveryBundleHash: params.bundleHash,
          recoveryManifestHash: params.manifest.manifestHash,
          sourceQuestionId: question.questionId,
          reconstructedAt: new Date(),
          reconstructedBy: params.actorDocenteId
        }),
        versiones: {
          create: {
            numeroVersion: 1,
            enunciado: payload.enunciado,
            opciones: {
              create: payload.opciones.map((o) => ({
                texto: o.texto,
                esCorrecta: o.esCorrecta
              }))
            }
          }
        }
      }
    });

    reconstructed.push({
      _id: created.id,
      id: created.id,
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
    const original = await prisma.examenPlantilla.findFirst({
      where: { id: params.manifest.plantillaId, docenteId: params.docenteId }
    });
    if (original) return { ...original, _id: original.id };
  }
  const title = `Recuperado ${params.manifest.folio}`;
  const tituloNormalizado = normalizarTituloPlantilla(title);
  const existing = await prisma.examenPlantilla.findFirst({
    where: { docenteId: params.docenteId, periodoId: params.periodoId, tituloNormalizado }
  });
  if (existing) return { ...existing, _id: existing.id };

  const created = await prisma.examenPlantilla.create({
    data: {
      id: params.manifest.plantillaId || undefined,
      docenteId: params.docenteId,
      periodoId: params.periodoId,
      tipo: 'parcial',
      titulo: title,
      tituloNormalizado,
      numeroPaginas: params.manifest.totalPaginas,
      reactivosObjetivo: params.manifest.totalPreguntas,
      defaultVersionCount: 1,
      answerKeyMode: 'digital',
      temas: JSON.stringify([]),
      bookletConfig: JSON.stringify({
        sheetFamilyCode: `TV${params.manifest.templateVersion}`,
        versionMode: 'single'
      }),
      omrConfig: JSON.stringify({
        sheetFamilyCode: `TV${params.manifest.templateVersion}`,
        versionMode: 'single'
      }),
      configuracionPdf: JSON.stringify({})
    }
  });

  for (let i = 0; i < params.preguntasIds.length; i++) {
    const preguntaId = params.preguntasIds[i];
    await prisma.preguntaPlantilla.create({
      data: {
        plantillaId: created.id,
        preguntaId,
        orden: i
      }
    });
  }

  return { ...created, _id: created.id };
}

async function persistExecutionLog(payload: Record<string, unknown>) {
  await prisma.reconstruccionExamen.create({
    data: {
      tipo: String(payload.tipo),
      estado: String(payload.estado),
      docenteSolicitanteId: String(payload.docenteSolicitanteId),
      docenteDestinoId: String(payload.docenteDestinoId),
      bundleHash: payload.bundleHash ? String(payload.bundleHash) : null,
      manifestHash: payload.manifestHash ? String(payload.manifestHash) : null,
      loteId: payload.loteId ? String(payload.loteId) : null,
      examId: payload.examId ? String(payload.examId) : null,
      folio: payload.folio ? String(payload.folio) : null,
      signatureValid: payload.signatureValid !== undefined ? Boolean(payload.signatureValid) : null,
      recoverable: payload.recoverable !== undefined ? Boolean(payload.recoverable) : null,
      causes: JSON.stringify(payload.causes || []),
      reconstructedQuestionBankIds: JSON.stringify(payload.reconstructedQuestionBankIds || []),
      reconstructedExamIds: JSON.stringify(payload.reconstructedExamIds || []),
      conflicts: JSON.stringify(payload.conflicts || []),
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null
    }
  });
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

  const existing = await prisma.examenGenerado.findFirst({
    where: { folio: params.manifest.folio }
  });
  if (existing) {
    if (String(existing.recoveryManifestHash ?? '') === params.manifest.manifestHash) {
      return {
        status: 'reconstruida',
        reconstructedExamIds: [String(existing.id)],
        reconstructedQuestionBankIds: [],
        conflicts: [],
        bundleHash: params.bundleHash,
        manifestHashes: [params.manifest.manifestHash]
      };
    }
    const conflict = [{ type: 'folio_conflict', folio: params.manifest.folio, examenGeneradoId: String(existing.id) }];
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
    periodoId: String(periodo.id),
    actorDocenteId: params.access.actorDocenteId,
    manifest: params.manifest,
    origin: params.origin,
    bundleHash: params.bundleHash
  });
  const questionBank = await reconstructQuestionBank({
    docenteId: docenteDestinoId,
    periodoId: String(periodo.id),
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
    periodoId: String(periodo.id),
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

  const created = await prisma.examenGenerado.create({
    data: {
      docenteId: docenteDestinoId,
      periodoId: periodo.id,
      plantillaId: plantilla.id,
      alumnoId: alumno.id,
      loteId: params.manifest.loteId,
      folio: params.manifest.folio,
      mapaVariante: JSON.stringify(mapaVariante),
      mapaOmr: pdf.mapaOmr ? JSON.stringify(pdf.mapaOmr) : null,
      paginas: JSON.stringify(pdf.paginas || []),
      rutaPdf,
      recoveryKeyId: params.manifest.keyId,
      recoveryManifestHash: params.manifest.manifestHash,
      recoveryManifest: JSON.stringify(params.manifest),
      recoveryBundleHash: params.bundleHash,
      reconstructedFrom: JSON.stringify({
        origen: params.origin,
        recoveryBundleHash: params.bundleHash,
        recoveryManifestHash: params.manifest.manifestHash,
        reconstructedAt: new Date(),
        reconstructedBy: params.access.actorDocenteId
      }),
      versionSet: JSON.stringify([]),
      sheetInstances: JSON.stringify([])
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
    reconstructedExamIds: [created.id]
  });

  return {
    status: 'reconstruida',
    reconstructedExamIds: [String(created.id)],
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
  const bundles = await prisma.examenRecoveryBundle.findMany({
    where: query,
    orderBy: { createdAt: 'desc' }
  });

  return bundles.map((record) => {
    const bundle = JSON.parse(record.metadata || '{}');
    const verification = buildVerificationForBundle(bundle);
    return {
      bundleHash: bundle.bundleHash,
      loteId: bundle.loteId,
      templateVersion: bundle.templateVersion,
      examCount: bundle.totalExamenes || 0,
      questionBankCount: Array.isArray(bundle.questionBank) ? bundle.questionBank.length : 0,
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
  for (const manifest of resolved.bundle.manifests || []) {
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
