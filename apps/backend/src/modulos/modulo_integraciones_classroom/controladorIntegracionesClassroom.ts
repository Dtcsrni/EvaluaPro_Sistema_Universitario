import type { Request, Response } from 'express';
import { URL } from 'node:url';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { IntegracionClassroom } from './modeloIntegracionClassroom';
import { MapeoClassroomEvidencia } from './modeloMapeoClassroomEvidencia';
import {
  completarOauthClassroom,
  construirUrlOauthClassroom,
  desconectarOauthClassroom
} from './servicioClassroomGoogle';
import {
  actualizarMapeoAlumnosCurso,
  guardarMapeoLegadoYCurso,
  listarActividadesPorCurso,
  listarCursosParaDocente,
  listarHistorialSyncClassroom,
  obtenerAlumnosCursoClassroom,
  obtenerEstadoClassroom,
  sincronizarImportacionClassroom
} from './servicioSyncClassroom';

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
  const { url } = construirUrlOauthClassroom(docenteId, { frontendOrigin });
  const integracion = await IntegracionClassroom.findOne({ docenteId }).lean();
  res.json({
    url,
    conectado: Boolean(integracion?.activo),
    correoGoogle: integracion?.correoGoogle ?? null
  });
}

function responderCallbackHtml(res: Response, exito: boolean, mensaje: string, targetOrigin?: string | null) {
  const estado = exito ? 'ok' : 'error';
  const detalleEscapado = mensaje
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const originEscapado =
    String(targetOrigin || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;') || '*';
  res
    .status(exito ? 200 : 400)
    .type('html')
    .send(`<!doctype html><html><body><script>
      try {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage({ source: 'classroom-oauth', status: '${estado}', message: '${detalleEscapado}' }, '${originEscapado}');
        }
      } catch {}
      window.close();
    </script><p>${detalleEscapado}</p></body></html>`);
}

export async function callbackOauthClassroom(req: Request, res: Response) {
  const error = normalizarTexto(req.query.error);
  if (error) {
    responderCallbackHtml(res, false, `Google devolvió error OAuth: ${error}`);
    return;
  }

  try {
    const code = normalizarTexto(req.query.code);
    const state = normalizarTexto(req.query.state);
    const resultado = await completarOauthClassroom({ code, state });
    responderCallbackHtml(
      res,
      true,
      `Cuenta Classroom conectada: ${resultado.correoGoogle || 'sin correo'}`,
      typeof resultado.frontendOrigin === 'string' ? resultado.frontendOrigin : undefined
    );
  } catch (errorCallback) {
    const mensaje =
      errorCallback instanceof ErrorAplicacion ? errorCallback.message : 'No se pudo completar la conexión OAuth';
    responderCallbackHtml(res, false, mensaje);
  }
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
  const actividades = await listarActividadesPorCurso(docenteId, courseId, periodoId || undefined);
  res.json({ actividades });
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
      activo?: boolean;
    }>,
    limiteSubmissions: payload.limiteSubmissions,
    persistir: false
  });
  res.json(preview);
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
      activo?: boolean;
    }>,
    limiteSubmissions: payload.limiteSubmissions,
    persistir: true
  });
  res.json(resultado);
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
