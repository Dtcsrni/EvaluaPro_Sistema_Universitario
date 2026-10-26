/**
 * controladorIntegracionesClassroom
 *
 * Responsabilidad: Adaptador HTTP del dominio (parseo de entrada, invocacion de servicios y respuesta).
 * Limites: Evitar mover logica de negocio profunda a controlador.
 */
import type { Request, Response } from 'express';
import { URL } from 'node:url';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/index.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { IntegracionClassroom } from './modeloIntegracionClassroom.js';
import { MapeoClassroomEvidencia } from './modeloMapeoClassroomEvidencia.js';
import {
  construirUrlOauthClassroom,
  desconectarOauthClassroom
} from './servicioClassroomGoogle.js';
import {
  actualizarMapeoAlumnosCurso,
  importarAlumnosClassroomAEvaluaPro,
  guardarMapeoLegadoYCurso,
  listarActividadesPorCurso,
  listarCursosParaDocente,
  listarHistorialSyncClassroom,
  obtenerAlumnosCursoClassroom,
  obtenerEstadoClassroom,
  sincronizarImportacionClassroom,
  type ActividadClassroomSeleccionada
} from './servicioSyncClassroom.js';
import { listarHistorialEntregaClassroom, listarSnapshotsClassroomCorte, obtenerCapturaHistorialClassroom } from './servicioHistorialClassroom.js';
import { iniciarJobImportacionClassroom, obtenerJobImportacionClassroom } from './servicioJobsImportacionClassroom.js';
import { calcularPlanHashImportacionClassroom } from './planImportacionClassroom.js';

function normalizarTexto(valor: unknown): string {
  return String(valor || '').trim();
}

function obtenerFrontendOrigin(req: Request): string | undefined {
  const originHeader = normalizarTexto(req.headers.origin);
  if (originHeader) return originHeader;
  const referer = normalizarTexto(req.headers.referer);
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export async function iniciarOauthClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const frontendOrigin = obtenerFrontendOrigin(req);
  const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { correo: true, googleSub: true } });
  if (!docente?.googleSub) {
    throw new ErrorAplicacion(
      'CLASSROOM_LOGIN_GOOGLE_REQUIRED',
      'Inicia sesión en EvaluaPro con la cuenta Google que vincularás a Classroom y vuelve a intentarlo.',
      409
    );
  }
  const { url } = await construirUrlOauthClassroom(docenteId, {
    frontendOrigin,
    loginHint: docente.correo,
    expectedGoogleSub: docente.googleSub
  });
  const integracion = await IntegracionClassroom.findOne({ docenteId }).lean();
  res.json({
    url,
    conectado: Boolean(integracion?.activo),
    correoGoogle: integracion?.correoGoogle ?? null
  });
}

export async function callbackOauthClassroom(req: Request, res: Response) {
  res.status(410).type('text/plain').send(
    'Este callback web ya no está activo. Inicia la vinculación desde la instalación docente de EvaluaPro.'
  );
}

export async function obtenerEstadoClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const estado = await obtenerEstadoClassroom(docenteId);
  res.json({ estado });
}

export async function desconectarOauthClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  await desconectarOauthClassroom(docenteId);
  res.status(204).end();
}

export async function listarCursosClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const cursos = await listarCursosParaDocente(docenteId);
  res.json({ cursos });
}

export async function listarActividadesClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const periodoId = normalizarTexto(req.query.periodoId);
  const consulta = await listarActividadesPorCurso(docenteId, courseId, periodoId || undefined);
  res.json(consulta);
}

export async function obtenerAlumnosCursoClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const periodoId = normalizarTexto(req.query.periodoId);
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }
  const roster = await obtenerAlumnosCursoClassroom(docenteId, periodoId, courseId);
  res.json(roster);
}

export async function actualizarMapeoAlumnosCursoController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const payload = req.body as { periodoId: string; asignaciones: Array<{ classroomUserId: string; alumnoId?: string | null }> };
  const roster = await actualizarMapeoAlumnosCurso({
    docenteId,
    periodoId: normalizarTexto(payload.periodoId),
    courseId,
    asignaciones: Array.isArray(payload.asignaciones) ? payload.asignaciones : []
  });
  res.json(roster);
}

export async function previewImportacionClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as { periodoId: string; actividades: unknown[]; limiteSubmissions?: number };
  const preview = await sincronizarImportacionClassroom({
    docenteId,
    periodoId: normalizarTexto(payload.periodoId),
    actividades: (Array.isArray(payload.actividades) ? payload.actividades : []) as Array<{
      courseId: string;
      courseWorkId: string;
      tituloEvidencia?: string;
      descripcionEvidencia?: string;
      ponderacion?: number;
      corte?: number;
      destinoColumna?: 'Tareas y Ejercicios 2do Parcial' | 'Practica 2do Parcial' | 'Excluir' | null;
      activo?: boolean;
      faltantesConfirmados?: string[];
      reentregasConfirmadas?: string[];
    }>,
    limiteSubmissions: payload.limiteSubmissions,
    persistir: false
  });
  res.json({
    ...preview,
    planHash: calcularPlanHashImportacionClassroom({
      periodoId: normalizarTexto(payload.periodoId),
      actividades: payload.actividades,
      limiteSubmissions: payload.limiteSubmissions
    }, preview)
  });
}

export async function ejecutarImportacionClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as { periodoId: string; actividades: unknown[]; limiteSubmissions?: number };
  const resultado = await sincronizarImportacionClassroom({
    docenteId,
    periodoId: normalizarTexto(payload.periodoId),
    actividades: (Array.isArray(payload.actividades) ? payload.actividades : []) as Array<{
      courseId: string;
      courseWorkId: string;
      tituloEvidencia?: string;
      descripcionEvidencia?: string;
      ponderacion?: number;
      corte?: number;
      destinoColumna?: 'Tareas y Ejercicios 2do Parcial' | 'Practica 2do Parcial' | 'Excluir' | null;
      activo?: boolean;
      faltantesConfirmados?: string[];
      reentregasConfirmadas?: string[];
    }>,
    limiteSubmissions: payload.limiteSubmissions,
    persistir: true
  });
  res.json(resultado);
}

export async function iniciarJobImportacionClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as {
    periodoId: string;
    actividades: Array<Record<string, unknown>>;
    limiteSubmissions?: number;
    clientRequestId: string;
    planHash: string;
  };
  const { clientRequestId, planHash, ...seleccion } = payload;
  const job = await iniciarJobImportacionClassroom({
    docenteId,
    clientRequestId,
    payload: {
      periodoId: normalizarTexto(seleccion.periodoId),
      actividades: seleccion.actividades as ActividadClassroomSeleccionada[],
      limiteSubmissions: seleccion.limiteSubmissions,
      planHash
    }
  });
  res.status(job.estado === 'succeeded' || job.estado === 'partial' || job.estado === 'failed' ? 200 : 202)
    .location(`/api/evaluaciones/v2/classroom/importaciones/jobs/${encodeURIComponent(job.jobId)}`)
    .json(job);
}

export async function obtenerJobImportacionClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const job = await obtenerJobImportacionClassroom(docenteId, normalizarTexto(req.params.jobId));
  res.json(job);
}

export async function listarHistorialSyncClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }
  const historial = await listarHistorialSyncClassroom(docenteId, periodoId);
  res.json({ historial });
}

export async function listarHistorialClassroomAlumnoController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  const alumnoId = normalizarTexto(req.params.alumnoId);
  const corte = Number(req.params.corte);
  const limite = Number(req.query.limite ?? 50);
  const cursor = normalizarTexto(req.query.cursor) || undefined;
  if (!periodoId || ![1, 2, 3].includes(corte) || !Number.isInteger(limite) || limite < 1 || limite > 100) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId, corte (1–3) y limite (1–100) son obligatorios.', 400);
  }
  const historial = await listarSnapshotsClassroomCorte({ docenteId, periodoId, alumnoId, corte, limite, cursor });
  if (!historial) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'El alumno no pertenece al periodo seleccionado.', 404);
  res.json(historial);
}

export async function listarHistorialEntregaClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  const courseId = normalizarTexto(req.query.courseId);
  const courseWorkId = normalizarTexto(req.query.courseWorkId);
  const alumnoId = normalizarTexto(req.params.alumnoId);
  const submissionId = normalizarTexto(req.params.submissionId);
  const limite = Number(req.query.limite ?? 20);
  const cursor = normalizarTexto(req.query.cursor) || undefined;
  if (!periodoId || !courseId || courseId.length > 128 || !courseWorkId || courseWorkId.length > 128 ||
      !submissionId || submissionId.length > 128 || (cursor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursor)) ||
      !Number.isInteger(limite) || limite < 1 || limite > 100) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId, courseId, courseWorkId y limite (1–100) son obligatorios.', 400);
  }
  const historial = await listarHistorialEntregaClassroom({ docenteId, periodoId, alumnoId, courseId, courseWorkId, submissionId, limite, cursor });
  if (!historial) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'El alumno no pertenece al periodo seleccionado.', 404);
  res.json(historial);
}

export async function obtenerCapturaHistorialClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const captura = await obtenerCapturaHistorialClassroom({ docenteId, snapshotId: normalizarTexto(req.params.snapshotId) });
  if (!captura) throw new ErrorAplicacion('CAPTURA_NO_ENCONTRADA', 'La ficha histórica no existe o no está disponible.', 404);
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Content-Length', String(captura.capturaBytes));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('ETag', `"${captura.capturaHash}"`);
  res.send(Buffer.from(captura.capturaWebp));
}

export async function mapearClassroomEvidencia(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = normalizarTexto(payload.periodoId);
  const actividad = {
    courseId: normalizarTexto(payload.courseId),
    courseWorkId: normalizarTexto(payload.courseWorkId),
    tituloEvidencia: normalizarTexto(payload.tituloEvidencia) || undefined,
    descripcionEvidencia: normalizarTexto(payload.descripcionEvidencia) || undefined,
    ponderacion: Number(payload.ponderacion ?? 1),
    corte: Number(payload.corte || 0) || undefined,
    activo: payload.activo === false ? false : true
  };
  const asignacionesAlumnos = (Array.isArray(payload.asignacionesAlumnos)
    ? payload.asignacionesAlumnos
    : [])
    .map((item) => item as { classroomUserId?: string; alumnoId?: string })
    .map((item) => ({
      classroomUserId: normalizarTexto(item.classroomUserId),
      alumnoId: normalizarTexto(item.alumnoId)
    }))
    .filter((item) => Boolean(item.classroomUserId && item.alumnoId));

  await guardarMapeoLegadoYCurso({
    docenteId,
    periodoId,
    actividad,
    asignacionesAlumnos
  });

  const mapeo = await MapeoClassroomEvidencia.findOne({
    docenteId,
    periodoId,
    courseId: actividad.courseId,
    courseWorkId: actividad.courseWorkId
  }).lean();

  res.status(201).json({ mapeo, deprecado: true });
}

export async function listarMapeosClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  const filtro: Record<string, unknown> = { docenteId };
  if (periodoId) filtro.periodoId = periodoId;
  const [mapeos, estado] = await Promise.all([
    MapeoClassroomEvidencia.find(filtro).sort({ updatedAt: -1 }).lean(),
    obtenerEstadoClassroom(docenteId)
  ]);
  res.json({
    conectado: estado.conectado,
    correoGoogle: estado.correoGoogle,
    mapeos,
    deprecado: true
  });
}

export async function ejecutarPullClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = normalizarTexto(payload.periodoId);
  const courseIdFiltro = normalizarTexto(payload.courseId);
  const courseWorkIdFiltro = normalizarTexto(payload.courseWorkId);
  const limiteSubmissions = Math.max(1, Math.min(500, Number(payload.limiteSubmissions ?? 200) || 200));

  const filtro: Record<string, unknown> = { docenteId, periodoId, activo: true };
  if (courseIdFiltro) filtro.courseId = courseIdFiltro;
  if (courseWorkIdFiltro) filtro.courseWorkId = courseWorkIdFiltro;

  const mapeos = await MapeoClassroomEvidencia.find(filtro).lean();
  if (!Array.isArray(mapeos) || mapeos.length === 0) {
    throw new ErrorAplicacion('CLASSROOM_MAPEO_NO_ENCONTRADO', 'No existen mapeos activos para ese periodo/filtro', 404);
  }

  const resultado = await sincronizarImportacionClassroom({
    docenteId,
    periodoId,
    actividades: mapeos.map((mapeo) => ({
      courseId: normalizarTexto(mapeo.courseId),
      courseWorkId: normalizarTexto(mapeo.courseWorkId),
      tituloEvidencia: normalizarTexto(mapeo.tituloEvidencia) || undefined,
      descripcionEvidencia: normalizarTexto(mapeo.descripcionEvidencia) || undefined,
      ponderacion: Number(mapeo.ponderacion ?? 1),
      corte: Number.isFinite(Number(mapeo.corte)) ? Number(mapeo.corte) : undefined,
      destinoColumna:
        mapeo.destinoColumna === 'Tareas y Ejercicios 2do Parcial' ||
        mapeo.destinoColumna === 'Practica 2do Parcial' ||
        mapeo.destinoColumna === 'Excluir'
          ? mapeo.destinoColumna
          : undefined,
      activo: mapeo.activo !== false
    })),
    limiteSubmissions,
    persistir: true
  });

  res.json({
    dryRun: false,
    totalMapeos: resultado.totalActividades,
    submissionsProcesadas: resultado.submissionsProcesadas,
    importadas: resultado.importadas,
    actualizadas: resultado.actualizadas,
    omitidas: resultado.omitidas,
    errores: resultado.errores,
    deprecado: true
  });
}

export async function importarAlumnosClassroomController(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const courseId = normalizarTexto(req.params.courseId);
  const { periodoId, alumnos } = req.body;
  const resultado = await importarAlumnosClassroomAEvaluaPro({
    docenteId,
    periodoId: normalizarTexto(periodoId),
    courseId,
    alumnos: Array.isArray(alumnos) ? alumnos : []
  });
  res.status(200).json(resultado);
}
