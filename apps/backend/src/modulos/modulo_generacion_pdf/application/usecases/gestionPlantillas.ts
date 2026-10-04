/**
 * gestionPlantillas
 *
 * Responsabilidad: concentrar reglas de CRUD de plantillas sin depender de
 * Express, preservando validaciones multi-tenant y consistencia de dominio.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../infraestructura/baseDatos/sqlite.js';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion.js';
import { guardarEnPapelera } from '../../../../modulos/modulo_papelera/servicioPapelera.js';
import {
  asegurarPlantillaActiva,
  normalizarTemas,
  obtenerPlantillaDocente,
  validarPeriodoDocenteActivo,
  validarTituloPlantillaDisponible
} from '../../shared/controladorGeneracionPdfShared.js';

function parseJsonSafe<T>(val: unknown): T | null {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }
  return val as T;
}

function formatearPlantillaPrisma(raw: any, preguntasIds: string[] = []) {
  if (!raw) return null;
  return {
    _id: raw.id,
    id: raw.id,
    docenteId: raw.docenteId,
    periodoId: raw.periodoId ?? undefined,
    tipo: raw.tipo,
    titulo: raw.titulo,
    tituloNormalizado: raw.tituloNormalizado,
    instrucciones: raw.instrucciones ?? undefined,
    numeroPaginas: raw.numeroPaginas,
    reactivosObjetivo: raw.reactivosObjetivo,
    defaultVersionCount: raw.defaultVersionCount,
    answerKeyMode: raw.answerKeyMode,
    archivadoEn: raw.archivadoEn ?? undefined,
    bookletConfig: parseJsonSafe<any>(raw.bookletConfig),
    omrConfig: parseJsonSafe<any>(raw.omrConfig),
    configuracionPdf: parseJsonSafe<any>(raw.configuracionPdf),
    temas: parseJsonSafe<string[]>(raw.temas) ?? [],
    preguntasIds,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

type AccionPlantilla = 'crear' | 'actualizar' | 'archivar' | 'eliminar';

function canonicalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonicalizar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([clave, contenido]) => [clave, canonicalizar(contenido)]));
  }
  return valor;
}

function prepararMutacionPlantilla(accion: AccionPlantilla, plantillaId: string | null, payload: unknown, requestId?: unknown) {
  const clientRequestId = String(requestId ?? randomUUID()).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)) {
    throw new ErrorAplicacion('PLANTILLA_REQUEST_ID_INVALIDO', 'clientRequestId debe ser UUID', 400);
  }
  const requestHash = createHash('sha256')
    .update(JSON.stringify(canonicalizar({ accion, plantillaId, payload })))
    .digest('hex');
  return { clientRequestId, requestHash };
}

async function recuperarMutacionPlantilla(
  tx: Prisma.TransactionClient,
  params: { docenteId: string; plantillaId: string | null; accion: AccionPlantilla; clientRequestId: string; requestHash: string }
) {
  const evento = await tx.examenPlantillaAuditoria.findUnique({
    where: { docenteId_clientRequestId: { docenteId: params.docenteId, clientRequestId: params.clientRequestId } }
  });
  if (!evento) return null;
  if (evento.accion !== params.accion || evento.plantillaId !== (params.plantillaId ?? evento.plantillaId) || evento.requestHash !== params.requestHash) {
    throw new ErrorAplicacion('PLANTILLA_REQUEST_ID_REUTILIZADO', 'clientRequestId ya fue utilizado para otra mutación o payload.', 409);
  }
  return { ...(JSON.parse(evento.despues) as Record<string, unknown>), repetida: true, clientRequestId: params.clientRequestId };
}

async function consultarRepeticionPlantilla(params: {
  docenteId: string;
  plantillaId: string | null;
  accion: AccionPlantilla;
  clientRequestId: string;
  requestHash: string;
}) {
  return prisma.$transaction((tx) => recuperarMutacionPlantilla(tx, params));
}

async function registrarMutacionPlantilla(
  tx: Prisma.TransactionClient,
  params: {
    docenteId: string;
    plantillaId: string;
    accion: AccionPlantilla;
    clientRequestId: string;
    requestHash: string;
    antes: unknown;
    despues: unknown;
  }
) {
  await tx.examenPlantillaAuditoria.create({
    data: {
      ...params,
      antes: params.antes === null ? null : JSON.stringify(params.antes),
      despues: JSON.stringify(params.despues)
    }
  });
}

function serializarCursorAuditoria(evento: { id: string; createdAt: Date }) {
  return Buffer.from(JSON.stringify({ id: evento.id, createdAt: evento.createdAt.toISOString() }), 'utf8').toString('base64url');
}

export async function listarPlantillasUseCase(params: {
  docenteId: unknown;
  periodoId?: unknown;
  archivado?: unknown;
  limite?: unknown;
}) {
  const docId = String(params.docenteId);
  const where: any = { docenteId: docId };
  if (params.periodoId) where.periodoId = String(params.periodoId);

  const queryArchivado = String(params.archivado ?? '').trim().toLowerCase();
  const filtrarArchivadas = queryArchivado === '1' || queryArchivado === 'true' || queryArchivado === 'si' || queryArchivado === 's';
  where.archivadoEn = filtrarArchivadas ? { not: null } : null;

  const limite = Number(params.limite ?? 0);
  const rawPlantillas = await prisma.examenPlantilla.findMany({
    where,
    take: limite > 0 ? limite : undefined,
    orderBy: { createdAt: 'desc' }
  });

  const plantillas = [];
  for (const raw of rawPlantillas) {
    const junction = await prisma.preguntaPlantilla.findMany({
      where: { plantillaId: raw.id },
      orderBy: { orden: 'asc' }
    });
    plantillas.push(formatearPlantillaPrisma(raw, junction.map((j) => j.preguntaId)));
  }

  return { plantillas };
}

export async function obtenerPlantillaUseCase(params: { docenteId: unknown; plantillaId: string }) {
  const docenteId = String(params.docenteId);
  const raw = await prisma.examenPlantilla.findFirst({ where: { id: params.plantillaId, docenteId } });
  if (!raw) throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
  const junction = await prisma.preguntaPlantilla.findMany({ where: { plantillaId: raw.id }, orderBy: { orden: 'asc' } });
  return { plantilla: formatearPlantillaPrisma(raw, junction.map((item) => item.preguntaId)) };
}

export async function crearPlantillaUseCase(params: {
  docenteId: unknown;
  body: Record<string, unknown>;
}) {
  const docId = String(params.docenteId);
  const { clientRequestId: requestId, ...payloadMutacion } = params.body;
  const mutacion = prepararMutacionPlantilla('crear', null, payloadMutacion, requestId);
  const contextoMutacion = { docenteId: docId, plantillaId: null, accion: 'crear' as const, ...mutacion };
  const repeticion = await consultarRepeticionPlantilla(contextoMutacion);
  if (repeticion) return repeticion;

  const titulo = String(params.body.titulo ?? '').trim();
  const periodoId = params.body.periodoId ? String(params.body.periodoId) : undefined;

  if (periodoId) {
    await validarPeriodoDocenteActivo(docId, periodoId);
  }

  const temas = normalizarTemas(params.body.temas);
  await validarTituloPlantillaDisponible({ docenteId: docId, titulo, periodoId: periodoId ?? null });

  const bookletConfig = {
    targetPages: Number((params.body.bookletConfig as any)?.targetPages ?? params.body.numeroPaginas ?? 2) || 2,
    densityMode: String((params.body.bookletConfig as any)?.densityMode ?? 'compact'),
    autoFitPages: (params.body.bookletConfig as any)?.autoFitPages === true,
    allowImages: (params.body.bookletConfig as any)?.allowImages !== false,
    imageBudgetPolicy: String((params.body.bookletConfig as any)?.imageBudgetPolicy ?? 'balanced'),
    headerStyle: String((params.body.bookletConfig as any)?.headerStyle ?? 'institutional'),
    logos: {
      izquierdaPath: String((params.body.bookletConfig as any)?.logos?.izquierdaPath ?? '').trim() || undefined,
      derechaPath: String((params.body.bookletConfig as any)?.logos?.derechaPath ?? '').trim() || undefined
    },
    fontScale: Number((params.body.bookletConfig as any)?.fontScale ?? 1) || 1,
    lineSpacing: Number((params.body.bookletConfig as any)?.lineSpacing ?? 1.1) || 1.1,
    separateCoverPage: Boolean((params.body.bookletConfig as any)?.separateCoverPage)
  };

  const omrConfig = {
    examTemplateId: String((params.body.omrConfig as any)?.examTemplateId ?? 'omr-canonical-v4'),
    sheetFamilyCode: String((params.body.omrConfig as any)?.sheetFamilyCode ?? 'S50_5A_ID5_VR6'),
    sheetRevisionId: (params.body.omrConfig as any)?.sheetRevisionId,
    prefillMode: String((params.body.omrConfig as any)?.prefillMode ?? 'none'),
    identityMode: 'qr_plus_bubbled_id',
    allowBlankGenericSheets: (params.body.omrConfig as any)?.allowBlankGenericSheets !== false,
    ignoreUnusedTrailingQuestions: (params.body.omrConfig as any)?.ignoreUnusedTrailingQuestions !== false,
    captureMode: 'pdf_and_mobile'
  };

  const configuracionPdf = {
    margenMm: Number((params.body.configuracionPdf as any)?.margenMm ?? 8) || 8,
    layout: String((params.body.configuracionPdf as any)?.layout ?? 'parcial')
  };

  const normalizado = String(titulo ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const preguntasIds = Array.isArray(params.body.preguntasIds) ? params.body.preguntasIds.map(String) : [];
  try {
    return await prisma.$transaction(async (tx) => {
      const repetidaEnTransaccion = await recuperarMutacionPlantilla(tx, contextoMutacion);
      if (repetidaEnTransaccion) return repetidaEnTransaccion;
      const raw = await tx.examenPlantilla.create({
      data: {
        docenteId: docId,
        periodoId: periodoId || null,
        tipo: String(params.body.tipo ?? 'parcial'),
        titulo,
        tituloNormalizado: normalizado,
        instrucciones: params.body.instrucciones ? String(params.body.instrucciones) : null,
        numeroPaginas: Number(params.body.numeroPaginas ?? 1) || 1,
        reactivosObjetivo: Number(params.body.reactivosObjetivo ?? 20) || 20,
        defaultVersionCount: Number(params.body.defaultVersionCount ?? 1) || 1,
        answerKeyMode: String(params.body.answerKeyMode ?? 'digital'),
        bookletConfig: JSON.stringify(bookletConfig),
        omrConfig: JSON.stringify(omrConfig),
        configuracionPdf: JSON.stringify(configuracionPdf),
        temas: JSON.stringify(temas || [])
      }
      });

      if (preguntasIds.length > 0) {
        await tx.preguntaPlantilla.createMany({
          data: preguntasIds.map((preguntaId, orden) => ({
            plantillaId: raw.id,
            preguntaId,
            orden
          }))
        });
      }

      const resultado = { plantilla: formatearPlantillaPrisma(raw, preguntasIds), clientRequestId: mutacion.clientRequestId, repetida: false };
      await registrarMutacionPlantilla(tx, {
        ...contextoMutacion,
        plantillaId: raw.id,
        antes: null,
        despues: resultado
      });
      return resultado;
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const ganadora = await consultarRepeticionPlantilla(contextoMutacion);
    if (ganadora) return ganadora;
    throw error;
  }
}

export async function actualizarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  body: Record<string, unknown>;
}) {
  const docId = String(params.docenteId);
  const { clientRequestId: requestId, ...payloadMutacion } = params.body;
  const mutacion = prepararMutacionPlantilla('actualizar', params.plantillaId, payloadMutacion, requestId);
  const contextoMutacion = { docenteId: docId, plantillaId: params.plantillaId, accion: 'actualizar' as const, ...mutacion };
  const repeticion = await consultarRepeticionPlantilla(contextoMutacion);
  if (repeticion) return repeticion;

  const actual = await obtenerPlantillaDocente(docId, params.plantillaId);

  const temas = normalizarTemas(params.body.temas);
  const patch: Record<string, unknown> = { ...params.body, ...(temas !== undefined ? { temas } : {}) };
  if (Array.isArray(params.body.temas) && (temas === undefined || temas.length === 0)) {
    patch.temas = [];
  }

  if (patch.periodoId) {
    await validarPeriodoDocenteActivo(docId, patch.periodoId);
  }

  const merged = {
    periodoId: patch.periodoId ?? actual.periodoId,
    tipo: patch.tipo ?? actual.tipo,
    titulo: patch.titulo ?? actual.titulo,
    instrucciones: patch.instrucciones ?? actual.instrucciones,
    numeroPaginas: patch.numeroPaginas ?? actual.numeroPaginas,
    reactivosObjetivo: patch.reactivosObjetivo ?? actual.reactivosObjetivo,
    defaultVersionCount: patch.defaultVersionCount ?? actual.defaultVersionCount,
    answerKeyMode: patch.answerKeyMode ?? actual.answerKeyMode,
    preguntasIds: patch.preguntasIds ?? actual.preguntasIds,
    temas: patch.temas ?? actual.temas,
    bookletConfig: patch.bookletConfig ?? actual.bookletConfig,
    omrConfig: patch.omrConfig ?? actual.omrConfig,
    configuracionPdf: patch.configuracionPdf ?? actual.configuracionPdf
  };

  const preguntasIds = Array.isArray(merged.preguntasIds) ? merged.preguntasIds.map(String) : [];
  const temasMerged = Array.isArray(merged.temas) ? merged.temas : [];
  if (preguntasIds.length === 0 && temasMerged.length === 0) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'La plantilla debe incluir preguntasIds o temas', 400);
  }
  if (temasMerged.length > 0 && !merged.periodoId) {
    throw new ErrorAplicacion('PLANTILLA_INVALIDA', 'periodoId es obligatorio cuando se usan temas', 400);
  }

  await validarTituloPlantillaDisponible({
    docenteId: docId,
    titulo: merged.titulo,
    periodoId: merged.periodoId ?? null,
    excluirPlantillaId: params.plantillaId
  });

  const normalizado = String(merged.titulo ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // Cualquier cambio editorial invalida el ajuste automático persistido; la
  // siguiente previsualización deberá volver a validarlo antes de producción.
  const bookletConfigActualizado = {
    ...((merged.bookletConfig ?? {}) as Record<string, unknown>)
  };
  delete bookletConfigActualizado.resolvedLayout;

  const data: any = {
    tipo: String(merged.tipo),
    titulo: String(merged.titulo),
    tituloNormalizado: normalizado,
    instrucciones: merged.instrucciones ? String(merged.instrucciones) : null,
    numeroPaginas: Number(merged.numeroPaginas) || 1,
    reactivosObjetivo: Number(merged.reactivosObjetivo) || 20,
    defaultVersionCount: Number(merged.defaultVersionCount) || 1,
    answerKeyMode: String(merged.answerKeyMode),
    bookletConfig: JSON.stringify(bookletConfigActualizado),
    omrConfig: JSON.stringify(merged.omrConfig),
    configuracionPdf: JSON.stringify(merged.configuracionPdf),
    temas: JSON.stringify(temasMerged)
  };
  if (merged.periodoId) {
    data.periodoId = String(merged.periodoId);
  } else {
    data.periodoId = null;
  }

  try {
    return await prisma.$transaction(async (tx) => {
    const repetidaEnTransaccion = await recuperarMutacionPlantilla(tx, contextoMutacion);
    if (repetidaEnTransaccion) return repetidaEnTransaccion;
    const raw = await tx.examenPlantilla.update({
      where: { id: params.plantillaId },
      data
    });

    if (patch.preguntasIds !== undefined) {
      await tx.preguntaPlantilla.deleteMany({
        where: { plantillaId: params.plantillaId }
      });
      if (preguntasIds.length > 0) {
        await tx.preguntaPlantilla.createMany({
          data: preguntasIds.map((preguntaId, orden) => ({
            plantillaId: params.plantillaId,
            preguntaId,
            orden
          }))
        });
      }
    }

    const plantilla = formatearPlantillaPrisma(raw, preguntasIds);
    const resultado = { plantilla, clientRequestId: mutacion.clientRequestId, repetida: false };
    await registrarMutacionPlantilla(tx, {
      ...contextoMutacion,
      antes: actual,
      despues: resultado
    });
    return resultado;
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const ganadora = await consultarRepeticionPlantilla(contextoMutacion);
    if (ganadora) return ganadora;
    throw error;
  }
}

export async function archivarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  clientRequestId?: unknown;
}) {
  const docId = String(params.docenteId);
  const mutacion = prepararMutacionPlantilla('archivar', params.plantillaId, {}, params.clientRequestId);
  const contextoMutacion = { docenteId: docId, plantillaId: params.plantillaId, accion: 'archivar' as const, ...mutacion };
  const repeticion = await consultarRepeticionPlantilla(contextoMutacion);
  if (repeticion) return repeticion;
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  try {
    return await prisma.$transaction(async (tx) => {
    const repetidaEnTransaccion = await recuperarMutacionPlantilla(tx, contextoMutacion);
    if (repetidaEnTransaccion) return repetidaEnTransaccion;
    if (plantilla.archivadoEn) {
      const resultado = { ok: true, plantilla, clientRequestId: mutacion.clientRequestId, repetida: false };
      await registrarMutacionPlantilla(tx, { ...contextoMutacion, antes: plantilla, despues: resultado });
      return resultado;
    }
    const raw = await tx.examenPlantilla.update({
      where: { id: params.plantillaId },
      data: { archivadoEn: new Date() }
    });
    const resultado = { ok: true, plantilla: formatearPlantillaPrisma(raw, plantilla.preguntasIds), clientRequestId: mutacion.clientRequestId, repetida: false };
    await registrarMutacionPlantilla(tx, { ...contextoMutacion, antes: plantilla, despues: resultado });
    return resultado;
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const ganadora = await consultarRepeticionPlantilla(contextoMutacion);
    if (ganadora) return ganadora;
    throw error;
  }
}

export async function eliminarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  clientRequestId?: unknown;
}) {
  const docId = String(params.docenteId);
  const mutacion = prepararMutacionPlantilla('eliminar', params.plantillaId, {}, params.clientRequestId);
  const contextoMutacion = { docenteId: docId, plantillaId: params.plantillaId, accion: 'eliminar' as const, ...mutacion };
  const repeticion = await consultarRepeticionPlantilla(contextoMutacion);
  if (repeticion) return repeticion;

  try {
    return await prisma.$transaction(async (tx) => {
    const repetidaEnTransaccion = await recuperarMutacionPlantilla(tx, contextoMutacion);
    if (repetidaEnTransaccion) return repetidaEnTransaccion;

    const rawPlantilla = await tx.examenPlantilla.findFirst({ where: { id: params.plantillaId, docenteId: docId } });
    if (!rawPlantilla) throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
    const preguntas = await tx.preguntaPlantilla.findMany({ where: { plantillaId: rawPlantilla.id }, orderBy: { orden: 'asc' } });
    const plantilla = formatearPlantillaPrisma(rawPlantilla, preguntas.map((pregunta) => pregunta.preguntaId));
    if (!plantilla) throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);
    asegurarPlantillaActiva(plantilla);

    const examenes = await tx.examenGenerado.findMany({
      where: { docenteId: docId, plantillaId: params.plantillaId }
    });
    const examenesIds = examenes.map((e) => e.id);
    const [entregasDocs, calificacionesDocs, banderasDocs] = examenesIds.length
      ? await Promise.all([
          tx.entrega.findMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } }),
          tx.calificacion.findMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } }),
          tx.banderaRevision.findMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } })
        ])
      : [[], [], []];

    const antes = {
      plantilla,
      examenes,
      entregas: entregasDocs,
      calificaciones: calificacionesDocs,
      banderas: banderasDocs
    };
    await guardarEnPapelera({
      docenteId: docId,
      tipo: 'plantilla',
      entidadId: params.plantillaId,
      payload: antes,
      tx
    });

    if (examenesIds.length > 0) {
      await tx.entrega.deleteMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } });
      await tx.calificacion.deleteMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } });
      await tx.banderaRevision.deleteMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } });
      await tx.examenGenerado.deleteMany({ where: { docenteId: docId, id: { in: examenesIds } } });
    }
    await tx.preguntaPlantilla.deleteMany({ where: { plantillaId: params.plantillaId } });
    await tx.examenPlantilla.delete({ where: { id: params.plantillaId, docenteId: docId } });

    const resultado = {
      ok: true,
      eliminados: {
        plantillas: 1,
        examenes: examenes.length,
        entregas: entregasDocs.length,
        calificaciones: calificacionesDocs.length,
        banderas: banderasDocs.length
      },
      clientRequestId: mutacion.clientRequestId,
      repetida: false
    };
    await registrarMutacionPlantilla(tx, { ...contextoMutacion, antes, despues: resultado });
    return resultado;
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const ganadora = await consultarRepeticionPlantilla(contextoMutacion);
    if (ganadora) return ganadora;
    throw error;
  }
}

export async function listarAuditoriaPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  limite: number;
  cursor?: string;
}) {
  const docenteId = String(params.docenteId);
  const plantilla = await prisma.examenPlantillaAuditoria.findFirst({
    where: { docenteId, plantillaId: params.plantillaId },
    select: { id: true }
  });
  const vigente = await prisma.examenPlantilla.findFirst({ where: { id: params.plantillaId, docenteId }, select: { id: true } });
  if (!plantilla && !vigente) throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'Plantilla no encontrada', 404);

  let cursor: { id: string; createdAt: Date } | undefined;
  if (params.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(params.cursor, 'base64url').toString('utf8')) as { id?: unknown; createdAt?: unknown };
      const createdAt = new Date(String(decoded.createdAt ?? ''));
      if (typeof decoded.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(decoded.id) || !Number.isFinite(createdAt.getTime())) throw new Error('invalid cursor');
      cursor = { id: decoded.id, createdAt };
    } catch {
      throw new ErrorAplicacion('PLANTILLA_AUDITORIA_CURSOR_INVALIDO', 'El cursor de auditoría de plantilla no es válido', 400);
    }
  }

  const eventos = await prisma.examenPlantillaAuditoria.findMany({
    where: {
      docenteId,
      plantillaId: params.plantillaId,
      ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {})
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: params.limite + 1
  });
  const tieneSiguiente = eventos.length > params.limite;
  const pagina = tieneSiguiente ? eventos.slice(0, params.limite) : eventos;
  return {
    eventos: pagina.map((evento) => ({
      ...evento,
      antes: evento.antes ? JSON.parse(evento.antes) : null,
      despues: JSON.parse(evento.despues)
    })),
    nextCursor: tieneSiguiente ? serializarCursorAuditoria(pagina[pagina.length - 1]) : null
  };
}
