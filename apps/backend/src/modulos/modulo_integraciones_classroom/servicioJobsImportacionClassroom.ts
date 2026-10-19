import { createHash, randomUUID } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { log } from '../../infraestructura/logging/logger.js';
import { sincronizarImportacionClassroom, type ActividadClassroomSeleccionada } from './servicioSyncClassroom.js';
import { calcularPlanHashImportacionClassroom } from './planImportacionClassroom.js';

type PayloadImportacion = {
  periodoId: string;
  actividades: ActividadClassroomSeleccionada[];
  limiteSubmissions?: number;
  planHash: string;
};

type EstadoJob = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
type JobRow = Awaited<ReturnType<typeof prisma.classroomImportJob.findUnique>>;

const trabajosEnCurso = new Set<string>();

function jsonCanonico(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jsonCanonico).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${jsonCanonico(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function hashPayload(payload: PayloadImportacion): string {
  return createHash('sha256').update(jsonCanonico(payload)).digest('hex');
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function serializar(row: NonNullable<JobRow>) {
  return {
    jobId: row.id,
    estado: row.estado as EstadoJob,
    progreso: row.progreso,
    total: row.total,
    resultado: parseJson<Record<string, unknown>>(row.resultado),
    error: row.error,
    creadoEn: row.createdAt,
    actualizadoEn: row.updatedAt,
    iniciadoEn: row.startedAt,
    completadoEn: row.completedAt
  };
}

async function cargarJobPropio(docenteId: string, jobId: string) {
  const row = await prisma.classroomImportJob.findFirst({ where: { id: jobId, docenteId } });
  if (!row) throw new ErrorAplicacion('CLASSROOM_JOB_NO_ENCONTRADO', 'No se encontró la importación solicitada.', 404);
  return row;
}

export async function iniciarJobImportacionClassroom(params: {
  docenteId: string;
  clientRequestId: string;
  payload: PayloadImportacion;
}) {
  const requestHash = hashPayload(params.payload);
  const existente = await prisma.classroomImportJob.findUnique({
    where: { docenteId_clientRequestId: { docenteId: params.docenteId, clientRequestId: params.clientRequestId } }
  });
  if (existente) {
    if (existente.requestHash !== requestHash) {
      throw new ErrorAplicacion('CLASSROOM_IDEMPOTENCY_CONFLICT', 'clientRequestId ya se usó con una selección diferente.', 409);
    }
    if (existente.estado === 'queued') lanzarTrabajo(existente.id);
    return { ...serializar(existente), reutilizado: true };
  }

  const id = randomUUID();
  const activeKey = `${params.docenteId}:${params.payload.periodoId}`;
  try {
    const row = await prisma.classroomImportJob.create({
      data: {
        id,
        docenteId: params.docenteId,
        periodoId: params.payload.periodoId,
        clientRequestId: params.clientRequestId,
        requestHash,
        payload: jsonCanonico(params.payload),
        estado: 'queued',
        progreso: 0,
        total: params.payload.actividades.length,
        activeKey
      }
    });
    lanzarTrabajo(id);
    return { ...serializar(row), reutilizado: false };
  } catch (error) {
    const trasColision = await prisma.classroomImportJob.findUnique({
      where: { docenteId_clientRequestId: { docenteId: params.docenteId, clientRequestId: params.clientRequestId } }
    });
    if (trasColision) {
      if (trasColision.requestHash !== requestHash) {
        throw new ErrorAplicacion('CLASSROOM_IDEMPOTENCY_CONFLICT', 'clientRequestId ya se usó con una selección diferente.', 409);
      }
      if (trasColision.estado === 'queued') lanzarTrabajo(trasColision.id);
      return { ...serializar(trasColision), reutilizado: true };
    }
    const jobActivo = await prisma.classroomImportJob.findUnique({ where: { activeKey } });
    if (jobActivo) throw new ErrorAplicacion('CLASSROOM_IMPORT_ACTIVE', 'Ya hay una importación activa para esta materia.', 409);
    throw error;
  }
}

export async function obtenerJobImportacionClassroom(docenteId: string, jobId: string) {
  return serializar(await cargarJobPropio(docenteId, jobId));
}

function lanzarTrabajo(jobId: string) {
  if (trabajosEnCurso.has(jobId)) return;
  trabajosEnCurso.add(jobId);
  void procesarTrabajo(jobId).catch(() => undefined).finally(() => trabajosEnCurso.delete(jobId));
}

async function procesarTrabajo(jobId: string) {
  const claim = await prisma.classroomImportJob.updateMany({
    where: { id: jobId, estado: 'queued' },
    data: { estado: 'running', startedAt: new Date(), error: null }
  });
  if (claim.count !== 1) return;
  const row = await prisma.classroomImportJob.findUnique({ where: { id: jobId } });
  if (!row) return;
  try {
    const payload = JSON.parse(row.payload) as PayloadImportacion;
    const plan = {
      periodoId: payload.periodoId,
      actividades: payload.actividades,
      limiteSubmissions: payload.limiteSubmissions
    };
    const preview = await sincronizarImportacionClassroom({
      docenteId: row.docenteId,
      periodoId: row.periodoId,
      actividades: payload.actividades,
      limiteSubmissions: payload.limiteSubmissions,
      persistir: false
    });
    if (calcularPlanHashImportacionClassroom(plan, preview) !== payload.planHash) {
      throw new ErrorAplicacion('CLASSROOM_PLAN_STALE', 'Los datos de Classroom cambiaron desde la vista previa. Genera una nueva vista previa antes de sincronizar.', 409);
    }
    const resultado = await sincronizarImportacionClassroom({
      docenteId: row.docenteId,
      periodoId: row.periodoId,
      actividades: payload.actividades,
      limiteSubmissions: payload.limiteSubmissions,
      persistir: true,
      importacionId: row.id,
      onActividadCompletada: async (progreso, total) => {
        await prisma.classroomImportJob.updateMany({
          where: { id: row.id, estado: 'running' },
          data: { progreso, total }
        });
      }
    });
    const resumen = {
      tipo: resultado.tipo,
      periodoId: resultado.periodoId,
      importacionId: resultado.importacionId,
      totalActividades: resultado.totalActividades,
      submissionsProcesadas: resultado.submissionsProcesadas,
      matched: resultado.matched,
      unmatched: resultado.unmatched,
      pending: resultado.pending,
      graded: resultado.graded,
      importadas: resultado.importadas,
      actualizadas: resultado.actualizadas,
      omitidas: resultado.omitidas,
      snapshotsClassroomGuardados: resultado.snapshotsClassroomGuardados,
      errores: resultado.errores
    };
    const estado: EstadoJob = resultado.errores.length ? 'partial' : 'succeeded';
    await prisma.classroomImportJob.update({
      where: { id: row.id },
      data: {
        estado,
        progreso: payload.actividades.length,
        total: payload.actividades.length,
        resultado: JSON.stringify(resumen),
        error: null,
        activeKey: null,
        completedAt: new Date()
      }
    });
  } catch (error) {
    const codigoFallo = error instanceof ErrorAplicacion ? error.codigo : 'CLASSROOM_IMPORT_FAILED';
    const mensajeSeguro = error instanceof ErrorAplicacion && error.codigo === 'CLASSROOM_PLAN_STALE'
      ? error.message
      : 'No se pudo completar la importación. Revisa la conexión y consulta el historial antes de reintentar.';
    log('error', 'Falló job de importación Classroom', {
      jobId: row.id,
      docenteId: row.docenteId,
      codigo: codigoFallo
    });
    await prisma.classroomImportJob.update({
      where: { id: row.id },
      data: {
        estado: 'failed',
        error: mensajeSeguro,
        activeKey: null,
        completedAt: new Date()
      }
    });
  }
}

export async function recuperarJobsImportacionClassroom(): Promise<number> {
  await prisma.classroomImportJob.updateMany({
    where: { estado: 'running' },
    data: { estado: 'queued', startedAt: null }
  });
  const pendientes = await prisma.classroomImportJob.findMany({ where: { estado: 'queued' }, select: { id: true } });
  for (const job of pendientes) lanzarTrabajo(job.id);
  return pendientes.length;
}
