/**
 * gestionPlantillas
 *
 * Responsabilidad: concentrar reglas de CRUD de plantillas sin depender de
 * Express, preservando validaciones multi-tenant y consistencia de dominio.
 */
import { prisma } from '../../../../infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';
import { guardarEnPapelera } from '../../../../modulos/modulo_papelera/servicioPapelera';
import {
  asegurarPlantillaActiva,
  normalizarTemas,
  obtenerPlantillaDocente,
  validarPeriodoDocenteActivo,
  validarTituloPlantillaDisponible
} from '../../shared/controladorGeneracionPdfShared';

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

export async function crearPlantillaUseCase(params: {
  docenteId: unknown;
  body: Record<string, unknown>;
}) {
  const docId = String(params.docenteId);
  const titulo = String(params.body.titulo ?? '').trim();
  const periodoId = params.body.periodoId ? String(params.body.periodoId) : undefined;

  if (periodoId) {
    await validarPeriodoDocenteActivo(docId, periodoId);
  }

  const temas = normalizarTemas(params.body.temas);
  await validarTituloPlantillaDisponible({ docenteId: docId, titulo });

  const bookletConfig = {
    targetPages: Number((params.body.bookletConfig as any)?.targetPages ?? params.body.numeroPaginas ?? 2) || 2,
    densityMode: String((params.body.bookletConfig as any)?.densityMode ?? 'balanced'),
    allowImages: (params.body.bookletConfig as any)?.allowImages !== false,
    imageBudgetPolicy: String((params.body.bookletConfig as any)?.imageBudgetPolicy ?? 'balanced'),
    headerStyle: String((params.body.bookletConfig as any)?.headerStyle ?? 'institutional'),
    fontScale: Number((params.body.bookletConfig as any)?.fontScale ?? 1) || 1,
    lineSpacing: Number((params.body.bookletConfig as any)?.lineSpacing ?? 1.1) || 1.1,
    separateCoverPage: Boolean((params.body.bookletConfig as any)?.separateCoverPage)
  };

  const omrConfig = {
    sheetFamilyCode: String((params.body.omrConfig as any)?.sheetFamilyCode ?? 'S50_5A_ID5_VR6'),
    sheetRevisionId: (params.body.omrConfig as any)?.sheetRevisionId,
    prefillMode: String((params.body.omrConfig as any)?.prefillMode ?? 'none'),
    identityMode: 'qr_plus_bubbled_id',
    allowBlankGenericSheets: (params.body.omrConfig as any)?.allowBlankGenericSheets !== false,
    versionMode: String((params.body.omrConfig as any)?.versionMode ?? 'single'),
    ignoreUnusedTrailingQuestions: (params.body.omrConfig as any)?.ignoreUnusedTrailingQuestions !== false,
    captureMode: 'pdf_and_mobile'
  };

  const configuracionPdf = {
    margenMm: Number((params.body.configuracionPdf as any)?.margenMm ?? 10) || 10,
    layout: String((params.body.configuracionPdf as any)?.layout ?? 'parcial')
  };

  const normalizado = String(titulo ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const raw = await prisma.examenPlantilla.create({
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

  const preguntasIds = Array.isArray(params.body.preguntasIds) ? params.body.preguntasIds.map(String) : [];
  if (preguntasIds.length > 0) {
    await prisma.preguntaPlantilla.createMany({
      data: preguntasIds.map((preguntaId, orden) => ({
        plantillaId: raw.id,
        preguntaId,
        orden
      }))
    });
  }

  const plantilla = formatearPlantillaPrisma(raw, preguntasIds);
  return { plantilla };
}

export async function actualizarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
  body: Record<string, unknown>;
}) {
  const docId = String(params.docenteId);
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
    excluirPlantillaId: params.plantillaId
  });

  const normalizado = String(merged.titulo ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const data: any = {
    tipo: String(merged.tipo),
    titulo: String(merged.titulo),
    tituloNormalizado: normalizado,
    instrucciones: merged.instrucciones ? String(merged.instrucciones) : null,
    numeroPaginas: Number(merged.numeroPaginas) || 1,
    reactivosObjetivo: Number(merged.reactivosObjetivo) || 20,
    defaultVersionCount: Number(merged.defaultVersionCount) || 1,
    answerKeyMode: String(merged.answerKeyMode),
    bookletConfig: JSON.stringify(merged.bookletConfig),
    omrConfig: JSON.stringify(merged.omrConfig),
    configuracionPdf: JSON.stringify(merged.configuracionPdf),
    temas: JSON.stringify(temasMerged)
  };
  if (merged.periodoId) {
    data.periodoId = String(merged.periodoId);
  } else {
    data.periodoId = null;
  }

  const raw = await prisma.examenPlantilla.update({
    where: { id: params.plantillaId },
    data
  });

  if (patch.preguntasIds !== undefined) {
    await prisma.preguntaPlantilla.deleteMany({
      where: { plantillaId: params.plantillaId }
    });
    if (preguntasIds.length > 0) {
      await prisma.preguntaPlantilla.createMany({
        data: preguntasIds.map((preguntaId, orden) => ({
          plantillaId: params.plantillaId,
          preguntaId,
          orden
        }))
      });
    }
  }

  const plantilla = formatearPlantillaPrisma(raw, preguntasIds);
  return { plantilla };
}

export async function archivarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const docId = String(params.docenteId);
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  if (plantilla.archivadoEn) {
    return { ok: true, plantilla };
  }

  const raw = await prisma.examenPlantilla.update({
    where: { id: params.plantillaId },
    data: { archivadoEn: new Date() }
  });

  return { ok: true, plantilla: formatearPlantillaPrisma(raw, plantilla.preguntasIds) };
}

export async function eliminarPlantillaUseCase(params: {
  docenteId: unknown;
  plantillaId: string;
}) {
  const docId = String(params.docenteId);
  const plantilla = await obtenerPlantillaDocente(docId, params.plantillaId);
  asegurarPlantillaActiva(plantilla);

  const examenes = await prisma.examenGenerado.findMany({
    where: { docenteId: docId, plantillaId: params.plantillaId }
  });
  const examenesIds = examenes.map((e) => e.id);

  const [entregasDocs, calificacionesDocs, banderasDocs] = examenesIds.length
    ? await Promise.all([
        prisma.entrega.findMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } }),
        prisma.calificacion.findMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } }),
        prisma.banderaRevision.findMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } })
      ])
    : [[], [], []];

  await guardarEnPapelera({
    docenteId: docId,
    tipo: 'plantilla',
    entidadId: params.plantillaId,
    payload: {
      plantilla,
      examenes,
      entregas: entregasDocs,
      calificaciones: calificacionesDocs,
      banderas: banderasDocs
    }
  });

  // Execute deletion in a transaction to guarantee consistency
  await prisma.$transaction(async (tx) => {
    if (examenesIds.length > 0) {
      await tx.entrega.deleteMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } });
      await tx.calificacion.deleteMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } });
      await tx.banderaRevision.deleteMany({ where: { docenteId: docId, examenGeneradoId: { in: examenesIds } } });
      await tx.examenGenerado.deleteMany({ where: { docenteId: docId, id: { in: examenesIds } } });
    }
    await tx.preguntaPlantilla.deleteMany({ where: { plantillaId: params.plantillaId } });
    await tx.examenPlantilla.delete({ where: { id: params.plantillaId } });
  });

  return {
    ok: true,
    eliminados: {
      plantillas: 1,
      examenes: examenes.length,
      entregas: entregasDocs.length,
      calificaciones: calificacionesDocs.length,
      banderas: banderasDocs.length
    }
  };
}
