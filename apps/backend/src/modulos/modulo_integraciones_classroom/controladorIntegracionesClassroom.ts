import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Alumno } from '../modulo_alumnos/modeloAlumno';
import { EvidenciaEvaluacion } from '../modulo_evaluaciones/modeloEvidenciaEvaluacion';
import { IntegracionClassroom } from './modeloIntegracionClassroom';
import { MapeoClassroomEvidencia } from './modeloMapeoClassroomEvidencia';
import {
  classroomGet,
  completarOauthClassroom,
  construirUrlOauthClassroom,
  obtenerTokenAccesoClassroom
} from './servicioClassroomGoogle';

function numeroSeguro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function clamp0a10(valor: number): number {
  return Math.max(0, Math.min(10, valor));
}

function round4(valor: number): number {
  return Number(valor.toFixed(4));
}

function normalizarEmail(valor: unknown): string {
  return String(valor || '').trim().toLowerCase();
}

function normalizarTexto(valor: unknown): string {
  return String(valor || '').trim();
}

function tituloDefaultEvidencia(courseWork: Record<string, unknown>, mapeo: Record<string, unknown>) {
  return (
    normalizarTexto(mapeo.tituloEvidencia) ||
    normalizarTexto(courseWork.title) ||
    `Evidencia Classroom ${normalizarTexto(mapeo.courseWorkId)}`
  );
}

type EstudianteClassroom = {
  userId: string;
  emailAddress?: string;
  fullName?: string;
};

async function obtenerEstudiantesCurso(
  tokenAcceso: string,
  courseId: string
): Promise<Map<string, EstudianteClassroom>> {
  const mapa = new Map<string, EstudianteClassroom>();
  let pageToken: string | undefined;

  do {
    const payload = await classroomGet(tokenAcceso, `courses/${encodeURIComponent(courseId)}/students`, {
      pageSize: 100,
      ...(pageToken ? { pageToken } : {})
    });
    const estudiantes = (Array.isArray(payload.students) ? payload.students : []) as Array<Record<string, unknown>>;
    for (const estudiante of estudiantes) {
      const userId = normalizarTexto(estudiante.userId);
      if (!userId) continue;
      const profile = (estudiante.profile || {}) as Record<string, unknown>;
      const name = (profile.name || {}) as Record<string, unknown>;
      mapa.set(userId, {
        userId,
        emailAddress: normalizarEmail(profile.emailAddress),
        fullName: normalizarTexto(name.fullName)
      });
    }
    pageToken = normalizarTexto(payload.nextPageToken) || undefined;
  } while (pageToken);

  return mapa;
}

async function resolverAlumnoId(params: {
  docenteId: string;
  periodoId: string;
  classroomUserId: string;
  cursoEstudiantes: Map<string, EstudianteClassroom>;
  asignacionesMapeo: Map<string, string>;
}): Promise<string | null> {
  const { docenteId, periodoId, classroomUserId, cursoEstudiantes, asignacionesMapeo } = params;
  const asignado = asignacionesMapeo.get(classroomUserId);
  if (asignado) return asignado;

  const estudiante = cursoEstudiantes.get(classroomUserId);
  const email = normalizarEmail(estudiante?.emailAddress);

  if (email) {
    const alumnoCorreo = await Alumno.findOne({ docenteId, periodoId, correo: email }).select({ _id: 1 }).lean();
    if (alumnoCorreo?._id) return String(alumnoCorreo._id);

    const localPart = email.split('@')[0]?.trim().toUpperCase();
    if (localPart) {
      const alumnoMatricula = await Alumno.findOne({ docenteId, periodoId, matricula: localPart }).select({ _id: 1 }).lean();
      if (alumnoMatricula?._id) return String(alumnoMatricula._id);
    }
  }

  return null;
}

function calcularCalificacionDecimal(params: {
  assignedGrade?: unknown;
  draftGrade?: unknown;
  maxPoints?: unknown;
}) {
  const gradeRaw = Number.isFinite(Number(params.assignedGrade))
    ? Number(params.assignedGrade)
    : Number(params.draftGrade);
  if (!Number.isFinite(gradeRaw)) return null;

  const maxPoints = numeroSeguro(params.maxPoints);
  if (maxPoints > 0) {
    return round4(clamp0a10((gradeRaw / maxPoints) * 10));
  }
  return round4(clamp0a10(gradeRaw));
}

export async function iniciarOauthClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const { url } = construirUrlOauthClassroom(docenteId);
  const integracion = await IntegracionClassroom.findOne({ docenteId }).lean();
  res.json({
    url,
    conectado: Boolean(integracion?.activo),
    correoGoogle: integracion?.correoGoogle ?? null
  });
}

function responderCallbackHtml(res: Response, exito: boolean, mensaje: string) {
  const estado = exito ? 'ok' : 'error';
  const detalleEscapado = mensaje
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  res
    .status(exito ? 200 : 400)
    .type('html')
    .send(`<!doctype html><html><body><script>
      try {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage({ source: 'classroom-oauth', status: '${estado}', message: '${detalleEscapado}' }, '*');
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
    responderCallbackHtml(res, true, `Cuenta Classroom conectada: ${resultado.correoGoogle || 'sin correo'}`);
  } catch (errorCallback) {
    const mensaje =
      errorCallback instanceof ErrorAplicacion ? errorCallback.message : 'No se pudo completar la conexión OAuth';
    responderCallbackHtml(res, false, mensaje);
  }
}

export async function mapearClassroomEvidencia(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = normalizarTexto(payload.periodoId);

  const asignaciones = (Array.isArray(payload.asignacionesAlumnos)
    ? payload.asignacionesAlumnos
    : []) as Array<Record<string, unknown>>;

  const mapeo = await MapeoClassroomEvidencia.findOneAndUpdate(
    {
      docenteId,
      periodoId,
      courseId: normalizarTexto(payload.courseId),
      courseWorkId: normalizarTexto(payload.courseWorkId)
    },
    {
      $set: {
        docenteId,
        periodoId,
        courseId: normalizarTexto(payload.courseId),
        courseWorkId: normalizarTexto(payload.courseWorkId),
        tituloEvidencia: normalizarTexto(payload.tituloEvidencia) || undefined,
        descripcionEvidencia: normalizarTexto(payload.descripcionEvidencia) || undefined,
        ponderacion: Number(payload.ponderacion ?? 1),
        corte: Number(payload.corte || 0) || undefined,
        activo: payload.activo === false ? false : true,
        asignacionesAlumnos: asignaciones
          .map((item: Record<string, unknown>) => ({
            classroomUserId: normalizarTexto(item.classroomUserId),
            alumnoId: normalizarTexto(item.alumnoId)
          }))
          .filter((item: { classroomUserId: string; alumnoId: string }) => item.classroomUserId && item.alumnoId),
        metadata: (payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : undefined) as
          | Record<string, unknown>
          | undefined
      }
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  res.status(201).json({ mapeo });
}

export async function listarMapeosClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = normalizarTexto(req.query.periodoId);
  const filtro: Record<string, unknown> = { docenteId };
  if (periodoId) filtro.periodoId = periodoId;
  const mapeos = await MapeoClassroomEvidencia.find(filtro).sort({ updatedAt: -1 }).lean();
  const integracion = await IntegracionClassroom.findOne({ docenteId }).lean();
  res.json({
    conectado: Boolean(integracion?.activo),
    correoGoogle: integracion?.correoGoogle ?? null,
    mapeos
  });
}

export async function ejecutarPullClassroom(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = normalizarTexto(payload.periodoId);
  const courseIdFiltro = normalizarTexto(payload.courseId);
  const courseWorkIdFiltro = normalizarTexto(payload.courseWorkId);
  const dryRun = Boolean(payload.dryRun);
  const limiteSubmissions = Math.max(1, Math.min(500, Number(payload.limiteSubmissions ?? 200) || 200));

  const filtro: Record<string, unknown> = { docenteId, periodoId, activo: true };
  if (courseIdFiltro) filtro.courseId = courseIdFiltro;
  if (courseWorkIdFiltro) filtro.courseWorkId = courseWorkIdFiltro;

  const mapeos = await MapeoClassroomEvidencia.find(filtro).lean();
  if (!Array.isArray(mapeos) || mapeos.length === 0) {
    throw new ErrorAplicacion('CLASSROOM_MAPEO_NO_ENCONTRADO', 'No existen mapeos activos para ese periodo/filtro', 404);
  }

  const accessToken = await obtenerTokenAccesoClassroom(docenteId);
  const estudiantesPorCurso = new Map<string, Map<string, EstudianteClassroom>>();

  let submissionsProcesadas = 0;
  let importadas = 0;
  let actualizadas = 0;
  let omitidas = 0;
  const errores: Array<{ courseId: string; courseWorkId: string; mensaje: string }> = [];

  for (const mapeo of mapeos) {
    const courseId = normalizarTexto(mapeo.courseId);
    const courseWorkId = normalizarTexto(mapeo.courseWorkId);
    if (!courseId || !courseWorkId) continue;

    let cursoEstudiantes = estudiantesPorCurso.get(courseId);
    if (!cursoEstudiantes) {
      cursoEstudiantes = await obtenerEstudiantesCurso(accessToken, courseId);
      estudiantesPorCurso.set(courseId, cursoEstudiantes);
    }

    const courseWorkPayload = await classroomGet(
      accessToken,
      `courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}`
    );
    const maxPoints = courseWorkPayload.maxPoints;

    const asignacionesMapeo = new Map<string, string>(
      (Array.isArray(mapeo.asignacionesAlumnos) ? mapeo.asignacionesAlumnos : [])
        .map((item: unknown) => {
          const fila = item as Record<string, unknown>;
          return [normalizarTexto(fila.classroomUserId), normalizarTexto(fila.alumnoId)];
        })
        .filter((item: [string, string]) => Boolean(item[0] && item[1]))
    );

    let pageToken: string | undefined;
    do {
      let submissionsPayload: Record<string, unknown>;
      try {
        submissionsPayload = await classroomGet(
          accessToken,
          `courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions`,
          { pageSize: limiteSubmissions, ...(pageToken ? { pageToken } : {}) }
        );
      } catch (errorPull) {
        errores.push({
          courseId,
          courseWorkId,
          mensaje: errorPull instanceof ErrorAplicacion ? errorPull.message : 'Error al leer submissions'
        });
        break;
      }

      const submissions = (Array.isArray(submissionsPayload.studentSubmissions)
        ? submissionsPayload.studentSubmissions
        : []) as Array<Record<string, unknown>>;

      for (const submission of submissions) {
        submissionsProcesadas += 1;
        const submissionId = normalizarTexto(submission.id);
        const classroomUserId = normalizarTexto(submission.userId);
        if (!submissionId || !classroomUserId) {
          omitidas += 1;
          continue;
        }

        const calificacionDecimal = calcularCalificacionDecimal({
          assignedGrade: submission.assignedGrade,
          draftGrade: submission.draftGrade,
          maxPoints
        });
        if (calificacionDecimal === null) {
          omitidas += 1;
          continue;
        }

        const alumnoId = await resolverAlumnoId({
          docenteId,
          periodoId,
          classroomUserId,
          cursoEstudiantes,
          asignacionesMapeo
        });
        if (!alumnoId) {
          omitidas += 1;
          continue;
        }

        const fechaEvidencia = new Date(
          normalizarTexto(submission.updateTime) || normalizarTexto(courseWorkPayload.updateTime) || Date.now()
        );
        const evidenciaPayload = {
          docenteId,
          periodoId,
          alumnoId,
          titulo: tituloDefaultEvidencia(courseWorkPayload, mapeo as Record<string, unknown>),
          descripcion: normalizarTexto(mapeo.descripcionEvidencia) || normalizarTexto(courseWorkPayload.description) || undefined,
          calificacionDecimal,
          ponderacion: numeroSeguro(mapeo.ponderacion) > 0 ? numeroSeguro(mapeo.ponderacion) : 1,
          fechaEvidencia: Number.isFinite(fechaEvidencia.getTime()) ? fechaEvidencia : new Date(),
          corte: Number.isFinite(Number(mapeo.corte)) ? Number(mapeo.corte) : undefined,
          fuente: 'classroom',
          classroom: {
            courseId,
            courseWorkId,
            submissionId,
            classroomUserId,
            pulledAt: new Date()
          },
          metadata: {
            maxPoints: numeroSeguro(maxPoints),
            assignedGrade: numeroSeguro(submission.assignedGrade),
            draftGrade: numeroSeguro(submission.draftGrade),
            state: normalizarTexto(submission.state) || undefined
          }
        };

        if (dryRun) {
          importadas += 1;
          continue;
        }

        const existente = await EvidenciaEvaluacion.findOne({
          docenteId,
          'classroom.submissionId': submissionId
        })
          .select({ _id: 1 })
          .lean();

        await EvidenciaEvaluacion.updateOne(
          { docenteId, 'classroom.submissionId': submissionId },
          { $set: evidenciaPayload },
          { upsert: true }
        );

        if (existente?._id) {
          actualizadas += 1;
        } else {
          importadas += 1;
        }
      }

      pageToken = normalizarTexto(submissionsPayload.nextPageToken) || undefined;
    } while (pageToken);

    if (!dryRun) {
      await MapeoClassroomEvidencia.updateOne({ _id: mapeo._id }, { $set: { ultimaEjecucionPull: new Date() } });
    }
  }

  if (!dryRun) {
    await IntegracionClassroom.updateOne(
      { docenteId },
      { $set: { ultimaSincronizacionEn: new Date(), ultimoError: errores.length ? errores[0].mensaje : undefined } }
    );
  }

  res.json({
    dryRun,
    totalMapeos: mapeos.length,
    submissionsProcesadas,
    importadas,
    actualizadas,
    omitidas,
    errores
  });
}
