/**
 * Controlador para listado de examenes generados.
 *
 * Seguridad:
 * - Todas las consultas se filtran por `docenteId` para evitar acceso entre docentes.
 * - `descargarPdf` solo sirve PDFs cuyo path proviene del propio documento del examen.
 */
import type { Response } from 'express';
import { Buffer } from 'node:buffer';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { configuracion } from '../../configuracion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import { promises as fs } from 'fs';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { normalizarEnunciadoBanco } from '../modulo_banco_preguntas/normalizarEnunciadoBanco.js';
import { generarPdfExamen } from './servicioGeneracionPdf.js';
import { guardarPdfExamen } from '../../infraestructura/archivos/almacenLocal.js';
import { normalizarParaNombreArchivo } from '../../compartido/utilidades/texto.js';
import { resolverNumeroPaginasPlantilla } from './domain/resolverNumeroPaginasPlantilla.js';
import { TEMPLATE_VERSION_CANONICA } from './domain/templateCanonico.js';
import { esquemaListarExamenesGenerados, esquemaListarLotesExamenes } from './validacionesExamenes.js';
import {
  asegurarExamenDescargable,
  construirMetadataRetencion,
  ejecutarPurgeExamenesGenerados
} from './servicioRetencionExamenes.js';

type BancoPreguntaLean = {
  _id: unknown;
  id: string;
  versionActual: number;
  versiones: Array<{
    numeroVersion: number;
    enunciado: string;
    imagenUrl?: string;
    opciones: Array<{ texto: string; esCorrecta: boolean }>;
  }>;
};

const REGEX_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function normalizarObjectId(valor: unknown): string {
  if (typeof valor === 'string') {
    const trimmed = valor.trim();
    return REGEX_OBJECT_ID.test(trimmed) ? trimmed : trimmed; // In sqlite we support uuid as well, so don't reject non-mongo IDs
  }
  if (valor && typeof valor === 'object') {
    const conHex = valor as { toHexString?: () => string };
    if (typeof conHex.toHexString === 'function') {
      return String(conHex.toHexString()).trim();
    }
    const conOid = valor as { $oid?: unknown };
    if (typeof conOid.$oid === 'string') {
      return conOid.$oid.trim();
    }
  }
  return String(valor ?? '').trim();
}

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

function formatearExamenGeneradoPrisma(raw: any) {
  if (!raw) return null;
  const mapaVarianteObj = parseJsonSafe<any>(raw.mapaVariante);
  const preguntasIds = Array.isArray(mapaVarianteObj?.ordenPreguntas) ? mapaVarianteObj.ordenPreguntas : [];
  return {
    ...raw,
    _id: raw.id,
    mapaVariante: mapaVarianteObj,
    mapaOmr: parseJsonSafe(raw.mapaOmr),
    paginas: parseJsonSafe(raw.paginas) ?? [],
    bookletArtifact: parseJsonSafe(raw.bookletArtifact) ?? undefined,
    omrSheetArtifact: parseJsonSafe(raw.omrSheetArtifact) ?? undefined,
    studentPacketArtifacts: parseJsonSafe(raw.studentPacketArtifacts) ?? [],
    studentPacketZipArtifact: parseJsonSafe(raw.studentPacketZipArtifact) ?? undefined,
    manifestArtifact: parseJsonSafe(raw.manifestArtifact) ?? undefined,
    answerKeyArtifact: parseJsonSafe(raw.answerKeyArtifact) ?? undefined,
    recoveryManifest: parseJsonSafe(raw.recoveryManifest) ?? undefined,
    reconstructedFrom: parseJsonSafe(raw.reconstructedFrom) ?? undefined,
    questionMap: parseJsonSafe(raw.questionMap) ?? undefined,
    answerKeySet: parseJsonSafe(raw.answerKeySet) ?? undefined,
    versionSet: parseJsonSafe(raw.versionSet) ?? [],
    sheetInstances: parseJsonSafe(raw.sheetInstances) ?? [],
    statisticsSummary: parseJsonSafe(raw.statisticsSummary) ?? undefined,
    preguntasIds
  };
}

function formatearPreguntaPrisma(raw: any) {
  if (!raw) return null;
  return {
    _id: raw.id,
    id: raw.id,
    docenteId: raw.docenteId,
    periodoId: raw.periodoId,
    tema: raw.tema ?? undefined,
    activo: raw.activo,
    versionActual: raw.versionActual,
    recoverySource: raw.recoverySource ? JSON.parse(raw.recoverySource) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    versiones: (raw.versiones || []).map((v: any) => ({
      numeroVersion: v.numeroVersion,
      enunciado: normalizarEnunciadoBanco(v.enunciado),
      imagenUrl: v.imagenUrl ?? undefined,
      opciones: (v.opciones || []).map((o: any) => ({
        texto: o.texto,
        esCorrecta: o.esCorrecta
      }))
    }))
  };
}

function construirNombrePdfExamen(parametros: {
  folio: string;
  loteId?: string;
  materiaNombre?: string;
  temas?: string[];
  plantillaTitulo?: string;
}): string {
  const materia = normalizarParaNombreArchivo(parametros.materiaNombre, { maxLen: 42 });
  const titulo = normalizarParaNombreArchivo(parametros.plantillaTitulo, { maxLen: 42 });
  const folio = normalizarParaNombreArchivo(parametros.folio, { maxLen: 16 });
  const lote = normalizarParaNombreArchivo(parametros.loteId, { maxLen: 16 });

  const temas = Array.isArray(parametros.temas) ? parametros.temas.map((t) => String(t ?? '').trim()).filter(Boolean) : [];
  let tema = '';
  if (temas.length === 1) {
    tema = normalizarParaNombreArchivo(temas[0], { maxLen: 36 });
  } else if (temas.length > 1) {
    const primero = normalizarParaNombreArchivo(temas[0], { maxLen: 26 });
    tema = primero ? `${primero}_mas-${temas.length - 1}` : `mas-${temas.length}`;
  }

  const partes = ['evaluapro', 'examen'];
  if (materia) partes.push(materia);
  if (tema) partes.push(`tema-${tema}`);
  if (titulo) partes.push(`plantilla-${titulo}`);
  if (lote) partes.push(`lote-${lote}`);
  if (folio) partes.push(`folio-${folio}`);

  const nombre = partes.filter(Boolean).join('_');
  return `${nombre}.pdf`;
}

/**
 * Lista examenes generados del docente, con filtros opcionales (periodo, alumno, folio).
 */
export async function listarExamenesGenerados(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = esquemaListarExamenesGenerados.parse(res.locals.validatedQuery ?? req.query);
  const queryArchivado = filtros.archivado;
  const filtrarArchivadas = queryArchivado === '1' || queryArchivado === 'true' || queryArchivado === 'si' || queryArchivado === 's';
  const where: any = {
    docenteId,
    ...(filtros.periodoId ? { periodoId: filtros.periodoId } : {}),
    ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
    ...(filtros.plantillaId ? { plantillaId: filtros.plantillaId } : {}),
    ...(filtros.folio ? { folio: filtros.folio.toUpperCase() } : {}),
    archivadoEn: filtrarArchivadas ? { not: null } : null
  };
  let cursor: { id: string; generadoEn: Date } | undefined;
  if (filtros.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(filtros.cursor, 'base64url').toString('utf8')) as { id?: unknown; generadoEn?: unknown };
      const generadoEn = new Date(String(decoded.generadoEn ?? ''));
      if (typeof decoded.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.id) || !Number.isFinite(generadoEn.getTime())) {
        throw new Error('invalid cursor');
      }
      cursor = { id: decoded.id, generadoEn };
    } catch {
      throw new ErrorAplicacion('EXAMEN_GENERADO_CURSOR_INVALIDO', 'El cursor de exámenes generados no es válido', 400);
    }
  }
  if (cursor) {
    where.OR = [
      { generadoEn: { lt: cursor.generadoEn } },
      { generadoEn: cursor.generadoEn, id: { lt: cursor.id } }
    ];
  }
  const filas = await prisma.examenGenerado.findMany({
    where,
    take: filtros.limite + 1,
    orderBy: [{ generadoEn: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      periodoId: true,
      plantillaId: true,
      tipoExamen: true,
      alumnoId: true,
      loteId: true,
      origenGeneracion: true,
      folio: true,
      estado: true,
      entregadoEn: true,
      generadoEn: true,
      descargadoEn: true,
      archivadoEn: true,
      paginas: true,
      rutaPdf: true,
      bookletArtifact: true,
      omrSheetArtifact: true,
      studentPacketArtifacts: true,
      studentPacketZipArtifact: true,
      manifestArtifact: true,
      answerKeyArtifact: true,
      retentionStatus: true,
      artifactsPurgedAt: true
    }
  });
  const hayMas = filas.length > filtros.limite;
  const rawExamenes = filas.slice(0, filtros.limite);

  const examenesIds = rawExamenes.map((e) => e.id);
  const entregas = examenesIds.length
    ? await prisma.entrega.findMany({
        where: { docenteId, examenGeneradoId: { in: examenesIds } },
        orderBy: { createdAt: 'desc' }
      })
    : [];

  const entregaPorExamenId = new Map<string, { acordeonEntregado: boolean; bonoAcordeon: number }>();
  for (const entrega of entregas) {
    const examenId = String(entrega.examenGeneradoId ?? '').trim();
    if (!examenId || entregaPorExamenId.has(examenId)) continue;
    const acordeonEntregado = Boolean(entrega.acordeonEntregado);
    const bonoAcordeonRaw = Number(entrega.bonoAcordeon ?? 0);
    entregaPorExamenId.set(examenId, {
      acordeonEntregado,
      bonoAcordeon: acordeonEntregado
        ? Number.isFinite(bonoAcordeonRaw)
          ? Math.max(0, Math.min(0.5, bonoAcordeonRaw))
          : 0.25
        : 0
    });
  }

  const examenesConEntrega = rawExamenes.map((raw) => {
    const entrega = entregaPorExamenId.get(raw.id);
    return {
      _id: raw.id,
      id: raw.id,
      periodoId: raw.periodoId,
      plantillaId: raw.plantillaId,
      tipoExamen: raw.tipoExamen ?? undefined,
      alumnoId: raw.alumnoId,
      loteId: raw.loteId,
      origenGeneracion: raw.origenGeneracion,
      folio: raw.folio,
      estado: raw.estado,
      entregadoEn: raw.entregadoEn,
      generadoEn: raw.generadoEn,
      descargadoEn: raw.descargadoEn,
      archivadoEn: raw.archivadoEn,
      paginas: parseJsonSafe(raw.paginas) ?? [],
      ...construirMetadataRetencion(raw),
      acordeonEntregado: Boolean(entrega?.acordeonEntregado),
      bonoAcordeon: Number(entrega?.bonoAcordeon ?? 0)
    };
  });

  const ultimo = hayMas ? rawExamenes[rawExamenes.length - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({ id: ultimo.id, generadoEn: ultimo.generadoEn.toISOString() }), 'utf8').toString('base64url')
    : null;
  res.json({ examenes: examenesConEntrega, nextCursor });
}

/** Lista los paquetes de examen consolidados del docente; los lotes parciales se consultan por su ID estable. */
export async function listarLotesExamenesGenerados(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = esquemaListarLotesExamenes.parse(res.locals.validatedQuery ?? req.query);
  const incluirArchivados = ['1', 'true', 'si', 's'].includes(filtros.archivado);
  let cursor: { id: string; updatedAt: Date } | undefined;
  if (filtros.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(filtros.cursor, 'base64url').toString('utf8')) as { id?: unknown; updatedAt?: unknown };
      const updatedAt = new Date(String(decoded.updatedAt ?? ''));
      if (typeof decoded.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(decoded.id) || !Number.isFinite(updatedAt.getTime())) throw new Error('invalid cursor');
      cursor = { id: decoded.id, updatedAt };
    } catch {
      throw new ErrorAplicacion('LOTE_CURSOR_INVALIDO', 'El cursor de lotes no es válido', 400);
    }
  }

  const filas = await prisma.examenLoteArtefactoPdf.findMany({
    where: {
      docenteId,
      ...(filtros.plantillaId ? { plantillaId: filtros.plantillaId } : {}),
      archivadoEn: incluirArchivados ? { not: null } : null,
      ...(cursor ? { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { lt: cursor.id } }] } : {})
    },
    take: filtros.limite + 1,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, loteId: true, plantillaId: true, sha256: true, totalPaginas: true, totalExamenes: true, archivadoEn: true, createdAt: true, updatedAt: true }
  });
  const hayMas = filas.length > filtros.limite;
  const lotes = filas.slice(0, filtros.limite).map((lote) => ({
    loteId: lote.loteId,
    plantillaId: lote.plantillaId,
    sha256: lote.sha256,
    totalPaginas: lote.totalPaginas,
    totalExamenes: lote.totalExamenes,
    archivado: Boolean(lote.archivadoEn),
    archivadoEn: lote.archivadoEn?.toISOString() ?? null,
    pdfUrl: `/examenes/generados/lote/${encodeURIComponent(lote.loteId)}/pdf`,
    progresoUrl: `/examenes/generados/lote/${encodeURIComponent(lote.loteId)}/progreso`,
    createdAt: lote.createdAt.toISOString(),
    updatedAt: lote.updatedAt.toISOString()
  }));
  const ultimo = hayMas ? filas[filtros.limite - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({ id: ultimo.id, updatedAt: ultimo.updatedAt.toISOString() }), 'utf8').toString('base64url')
    : null;
  res.json({ lotes, nextCursor });
}

/**
 * Obtiene un examen por folio (multi-tenant por docente).
 */
export async function obtenerExamenPorFolio(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const folio = String(req.params.folio || '').trim().toUpperCase();
  const raw = await prisma.examenGenerado.findFirst({
    where: { folio, docenteId }
  });
  if (!raw) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  const formatted = formatearExamenGeneradoPrisma(raw);
  res.json({ examen: { ...formatted, ...construirMetadataRetencion(formatted) } });
}

/**
 * Obtiene el detalle consumido por el workflow OMR moderno.
 * La respuesta conserva el examen generado existente y expone solo URLs
 * respaldadas por rutas reales del API.
 */
export async function obtenerExamenGeneradoPorId(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '').trim();
  const raw = await prisma.examenGenerado.findFirst({ where: { id: examenId, docenteId } });
  if (!raw) throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);

  const formatted = formatearExamenGeneradoPrisma(raw) as any;
  const versionSet = Array.isArray(formatted.versionSet)
    ? formatted.versionSet.map((item: any) => ({
        versionCode: String(item?.versionCode ?? item?.codigo ?? 'A'),
        questionCount: Number(item?.questionCount ?? item?.preguntas ?? 0)
      }))
    : [];
  const sheetInstances = Array.isArray(formatted.sheetInstances) ? formatted.sheetInstances : [];
  const rawSummary = formatted.statisticsSummary && typeof formatted.statisticsSummary === 'object' ? formatted.statisticsSummary : {};

  res.json({
    assessment: {
      _id: formatted._id,
      folio: formatted.folio,
      generationSeed: String(formatted.generationSeed ?? ''),
      previewFingerprint: String(formatted.previewFingerprint ?? ''),
      bookletPdfUrl: `/examenes/generados/${encodeURIComponent(formatted._id)}/pdf`,
      omrSheetPdfUrl: `/examenes/generados/${encodeURIComponent(formatted._id)}/pdf`,
      versionSet,
      statisticsSummary: {
        sheetCount: Number(rawSummary.sheetCount ?? sheetInstances.length),
        studentPacketCount: Number(rawSummary.studentPacketCount ?? (Array.isArray(formatted.studentPacketArtifacts) ? formatted.studentPacketArtifacts.length : 0)),
        versionCount: Number(rawSummary.versionCount ?? versionSet.length)
      }
    },
    sheetInstances,
    statisticsSummary: rawSummary,
    versionSet,
    studentPacketArtifacts: Array.isArray(formatted.studentPacketArtifacts) ? formatted.studentPacketArtifacts : []
  });
}

/**
 * Descarga el PDF asociado a un examen.
 */
export async function descargarPdf(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '');
  const raw = await prisma.examenGenerado.findFirst({
    where: { id: examenId, docenteId }
  });
  if (!raw) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  const formatted = formatearExamenGeneradoPrisma(raw) as any;
  asegurarExamenDescargable(formatted, 'EXAMEN_NO_DESCARGABLE_POR_RETENCION', 'PDF no disponible');
  if (!formatted?.rutaPdf) throw new ErrorAplicacion('PDF_NO_DISPONIBLE', 'PDF no disponible', 404);

  try {
    const buffer = await fs.readFile(formatted.rutaPdf);

    const [plantillaRaw, periodoRaw] = await Promise.all([
      prisma.examenPlantilla.findUnique({ where: { id: String(formatted.plantillaId) } }),
      formatted.periodoId
        ? prisma.periodo.findUnique({ where: { id: String(formatted.periodoId) } })
        : Promise.resolve(null)
    ]);

    const temas = parseJsonSafe<string[]>(plantillaRaw?.temas) ?? [];
    const nombreDescarga = construirNombrePdfExamen({
      folio: String(formatted.folio ?? 'examen'),
      loteId: String(formatted.loteId ?? ''),
      materiaNombre: String(periodoRaw?.nombre ?? ''),
      temas,
      plantillaTitulo: String(plantillaRaw?.titulo ?? '')
    });

    void prisma.examenGenerado.update({
      where: { id: examenId },
      data: { descargadoEn: new Date() }
    }).catch(() => {
      // no-op
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreDescarga}"`);
    res.send(buffer);
  } catch {
    throw new ErrorAplicacion('PDF_INVALIDO', 'No se pudo leer el PDF', 500);
  }
}

/**
 * Regenera el PDF asociado a un examen (y recalcula metadata de paginas / mapa OMR).
 */
export async function regenerarPdfExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '').trim();
  const forzar = Boolean((req.body as { forzar?: unknown })?.forzar);

  const rawExamen = await prisma.examenGenerado.findFirst({
    where: { id: examenId, docenteId }
  });
  if (!rawExamen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }
  const examen = formatearExamenGeneradoPrisma(rawExamen) as any;

  const estado = String(examen?.estado ?? '');
  if (estado && estado !== 'generado') {
    throw new ErrorAplicacion(
      'EXAMEN_NO_REGENERABLE',
      'No se puede regenerar un examen ya entregado o calificado',
      409
    );
  }

  const yaDescargado = Boolean(examen?.descargadoEn);
  if (yaDescargado && !forzar) {
    throw new ErrorAplicacion(
      'EXAMEN_REQUIERE_FORZAR',
      'Este examen ya fue descargado. Reintenta con forzar=true si deseas regenerarlo.',
      409
    );
  }

  const plantillaId = String(examen?.plantillaId ?? '').trim();
  const plantillaRaw = await prisma.examenPlantilla.findUnique({ where: { id: plantillaId } });
  if (!plantillaRaw) {
    throw new ErrorAplicacion('PLANTILLA_NO_ENCONTRADA', 'No se encontro la plantilla para regenerar este examen', 404);
  }
  if (String(plantillaRaw.docenteId) !== String(docenteId)) {
    throw new ErrorAplicacion('NO_AUTORIZADO', 'Sin acceso a la plantilla', 403);
  }

  const folio = String(examen?.folio ?? '').trim().toUpperCase();
  if (!folio) {
    throw new ErrorAplicacion('EXAMEN_INVALIDO', 'El examen no tiene folio', 500);
  }

  const mapaVariante = examen?.mapaVariante;
  const preguntasIdsBrutos = Array.isArray(examen?.preguntasIds)
    ? examen.preguntasIds
    : Array.isArray(mapaVariante?.ordenPreguntas)
      ? mapaVariante.ordenPreguntas
      : [];

  const preguntasIds = preguntasIdsBrutos.map((x: any) => normalizarObjectId(x)).filter((id: string) => Boolean(id));
  const preguntasIdsUnicos = Array.from(new Set(preguntasIds)) as string[];

  if (preguntasIdsUnicos.length === 0) {
    throw new ErrorAplicacion('EXAMEN_SIN_PREGUNTAS', 'No se pudo determinar el set de preguntas del examen', 409);
  }

  if (preguntasIdsUnicos.length !== preguntasIdsBrutos.length) {
    throw new ErrorAplicacion(
      'EXAMEN_PREGUNTAS_IDS_INVALIDOS',
      'El examen contiene preguntasIds invalidos para regeneracion. Reconciliar preguntasIds y reintentar.',
      409,
      { totalIds: preguntasIdsBrutos.length, idsValidos: preguntasIdsUnicos.length }
    );
  }

  const rawPreguntas = await prisma.bancoPregunta.findMany({
    where: { docenteId, id: { in: preguntasIdsUnicos } },
    include: { versiones: { include: { opciones: true } } }
  });
  if (!Array.isArray(rawPreguntas) || rawPreguntas.length !== preguntasIdsUnicos.length) {
    throw new ErrorAplicacion(
      'PREGUNTAS_NO_DISPONIBLES',
      `No se pudieron cargar todas las preguntas del examen (esperadas: ${preguntasIdsUnicos.length}, encontradas: ${rawPreguntas.length})`,
      409
    );
  }

  const preguntasDb = rawPreguntas.map(formatearPreguntaPrisma) as BancoPreguntaLean[];
  const porId = new Map<string, BancoPreguntaLean>();
  for (const p of preguntasDb) porId.set(String(p.id), p);

  const preguntasBase = preguntasIdsUnicos.map((id) => {
    const pregunta = porId.get(String(id));
    if (!pregunta) {
      throw new ErrorAplicacion('PREGUNTA_FALTANTE', 'Pregunta faltante al regenerar', 409);
    }
    const version =
      pregunta.versiones.find((item) => item.numeroVersion === pregunta.versionActual) ?? pregunta.versiones[0];
    return {
      id: String(pregunta.id),
      enunciado: version.enunciado,
      imagenUrl: version.imagenUrl ?? undefined,
      opciones: version.opciones
    };
  });

  const [periodo, docenteDb] = await Promise.all([
    examen?.periodoId
      ? prisma.periodo.findUnique({ where: { id: String(examen.periodoId) } })
      : Promise.resolve(null),
    prisma.docente.findUnique({ where: { id: docenteId } })
  ]);
  if (!String(docenteDb?.nombreCompleto ?? '').trim()) {
    throw new ErrorAplicacion(
      'DOCENTE_SIN_NOMBRE',
      'No se puede regenerar el PDF sin el nombre del docente autenticado.',
      409
    );
  }

  const numeroPaginas = resolverNumeroPaginasPlantilla(plantillaRaw as any);
  const templateVersion = TEMPLATE_VERSION_CANONICA;
  const bookletConfig = {
    ...(parseJsonSafe<any>(plantillaRaw.bookletConfig) ?? {}),
    autoFitPages: true,
    fontScale: 1,
    lineSpacing: 1.1
  };

  const generarConPaginas = (paginasObjetivo: number) =>
    generarPdfExamen({
      titulo: String(plantillaRaw.titulo ?? ''),
      folio,
      preguntas: preguntasBase,
      mapaVariante: examen?.mapaVariante as never,
      tipoExamen: String(examen?.tipoExamen ?? plantillaRaw.tipo) as import('../../compartido/tipos/dominio.js').TipoExamen,
      totalPaginas: paginasObjetivo,
      margenMm: parseJsonSafe<any>(plantillaRaw.configuracionPdf)?.margenMm ?? 8,
      templateVersion,
      bookletConfig,
      encabezado: {
        materia: String(periodo?.nombre ?? ''),
        docente: String(docenteDb?.nombreCompleto ?? ''),
        instrucciones: String(plantillaRaw.instrucciones ?? '').trim() || undefined,
        institucion: String(parseJsonSafe<any>(docenteDb?.preferenciasPdf)?.institucion ?? '').trim() || undefined,
        lema: String(parseJsonSafe<any>(docenteDb?.preferenciasPdf)?.lema ?? '').trim() || undefined,
        logos: {
          izquierdaPath:
            String(parseJsonSafe<any>(docenteDb?.preferenciasPdf)?.logos?.izquierdaPath ?? '').trim() ||
            undefined,
          derechaPath:
            String(parseJsonSafe<any>(docenteDb?.preferenciasPdf)?.logos?.derechaPath ?? '').trim() ||
            undefined
        }
      }
    });

  const paginasObjetivo = numeroPaginas;
  let resultadoPdf;
  try {
    resultadoPdf = await generarConPaginas(paginasObjetivo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Layout invalido: densidad insuficiente')) {
      throw new ErrorAplicacion(
        'LAYOUT_DENSIDAD_INSUFICIENTE',
        msg,
        409
      );
    }
    throw err;
  }

  const { pdfBytes, paginas, mapaOmr, preguntasRestantes } = resultadoPdf;
  const temas = parseJsonSafe<string[]>(plantillaRaw.temas) ?? [];

  if ((preguntasRestantes ?? 0) > 0) {
    throw new ErrorAplicacion(
      'PAGINAS_INSUFICIENTES_POR_EXCESO',
      `No caben ${preguntasRestantes} pregunta(s) en ${paginasObjetivo} pagina(s). Aumenta el numero de paginas.`,
      409,
      { preguntasRestantes, numeroPaginas: paginasObjetivo }
    );
  }

  const nombreArchivo = construirNombrePdfExamen({
    folio,
    loteId: String(examen?.loteId ?? ''),
    materiaNombre: String(periodo?.nombre ?? ''),
    temas,
    plantillaTitulo: String(plantillaRaw.titulo ?? '')
  });
  const rutaPdf = await guardarPdfExamen(nombreArchivo, pdfBytes);

  const rawUpdated = await prisma.examenGenerado.update({
    where: { id: examenId },
    data: {
      paginas: JSON.stringify(paginas),
      mapaOmr: JSON.stringify(mapaOmr),
      rutaPdf,
      retentionStatus: 'active',
      artifactsPurgedAt: null,
      artifactsPurgeReason: null
    }
  });

  res.json({ examenGenerado: formatearExamenGeneradoPrisma(rawUpdated) });
}

/**
 * Archiva un examen generado.
 */
export async function archivarExamenGenerado(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const examenId = String(req.params.id || '').trim();

  const examen = await prisma.examenGenerado.findFirst({
    where: { id: examenId, docenteId }
  });
  if (!examen) {
    throw new ErrorAplicacion('EXAMEN_NO_ENCONTRADO', 'Examen no encontrado', 404);
  }

  if (examen.archivadoEn) {
    return res.json({ ok: true, examen: formatearExamenGeneradoPrisma(examen) });
  }

  const rawUpdated = await prisma.examenGenerado.update({
    where: { id: examenId },
    data: { archivadoEn: new Date() }
  });

  res.json({ ok: true, examen: formatearExamenGeneradoPrisma(rawUpdated) });
}

export async function purgarExamenesGenerados(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const dryRun = Boolean((req.body as { dryRun?: unknown })?.dryRun ?? false);
  const olderThanDays = Number((req.body as { olderThanDays?: unknown })?.olderThanDays ?? configuracion.dataRetentionDefaultDays);
  const scope = String((req.body as { scope?: unknown })?.scope ?? 'ttl').trim().toLowerCase() === 'all' ? 'all' : 'ttl';

  const resumen = await ejecutarPurgeExamenesGenerados({
    docenteId,
    dryRun,
    olderThanDays,
    scope,
    reason: scope === 'all' ? 'manual_initial_cleanup' : 'manual'
  });

  res.json({ ok: true, data: resumen });
}
