import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { Alumno } from '../modulo_alumnos/modeloAlumno';
import { EvidenciaEvaluacion } from '../modulo_evaluaciones/modeloEvidenciaEvaluacion';
import { IntegracionClassroom } from './modeloIntegracionClassroom';
import { MapeoClassroomEvidencia } from './modeloMapeoClassroomEvidencia';
import { MapeoClassroomAlumnoCurso } from './modeloMapeoClassroomAlumnoCurso';
import { BitacoraSyncClassroom } from './modeloBitacoraSyncClassroom';
import {
  classroomGet,
  listarActividadesClassroom,
  listarCursosClassroom,
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

function fechaSegura(valor: unknown): Date | null {
  const fecha = new Date(String(valor || ''));
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

function tituloDefaultEvidencia(courseWork: Record<string, unknown>, mapeo: ActividadClassroomSeleccionada) {
  return normalizarTexto(mapeo.tituloEvidencia) || normalizarTexto(courseWork.title) || `Evidencia Classroom ${mapeo.courseWorkId}`;
}

function normalizarActividadSeleccionada(actividad: ActividadClassroomSeleccionada): ActividadClassroomSeleccionada {
  return {
    courseId: normalizarTexto(actividad.courseId),
    courseWorkId: normalizarTexto(actividad.courseWorkId),
    ...(normalizarTexto(actividad.tituloEvidencia) ? { tituloEvidencia: normalizarTexto(actividad.tituloEvidencia) } : {}),
    ...(normalizarTexto(actividad.descripcionEvidencia) ? { descripcionEvidencia: normalizarTexto(actividad.descripcionEvidencia) } : {}),
    ...(Number.isFinite(Number(actividad.ponderacion)) ? { ponderacion: Number(actividad.ponderacion) } : {}),
    ...(Number.isFinite(Number(actividad.corte)) ? { corte: Number(actividad.corte) } : {}),
    ...(typeof actividad.activo === 'boolean' ? { activo: actividad.activo } : {})
  };
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

export type ActividadClassroomSeleccionada = {
  courseId: string;
  courseWorkId: string;
  tituloEvidencia?: string;
  descripcionEvidencia?: string;
  ponderacion?: number;
  corte?: number;
  activo?: boolean;
};

type EstudianteClassroom = {
  userId: string;
  emailAddress?: string;
  fullName?: string;
};

type AlumnoLocal = {
  _id: string;
  nombreCompleto: string;
  matricula?: string;
  correo?: string;
};

type EstrategiaMapeo = 'manual' | 'email' | 'matricula' | 'none';

type ResolucionAlumno = {
  alumnoId: string | null;
  strategy: EstrategiaMapeo;
};

type PreviewSubmission = {
  submissionId: string;
  classroomUserId: string;
  studentName?: string;
  studentEmail?: string;
  alumnoId?: string | null;
  alumnoNombre?: string | null;
  matchStrategy: EstrategiaMapeo;
  estadoCaptura: 'pendiente' | 'calificada';
  graded: boolean;
  pending: boolean;
  wouldCreate: boolean;
  wouldUpdate: boolean;
  calificacionDecimal?: number;
};

type ResultadoActividad = {
  courseId: string;
  courseName?: string;
  courseWorkId: string;
  courseWorkTitle?: string;
  tituloEvidencia?: string;
  submissionsProcesadas: number;
  matched: number;
  unmatched: number;
  pending: number;
  graded: number;
  wouldCreate: number;
  wouldUpdate: number;
  importadas: number;
  actualizadas: number;
  omitidas: number;
  submissions: PreviewSubmission[];
  errors: Array<{ mensaje: string }>;
};

type ResultadoSync = {
  tipo: 'preview' | 'ejecucion';
  periodoId: string;
  totalActividades: number;
  submissionsProcesadas: number;
  matched: number;
  unmatched: number;
  pending: number;
  graded: number;
  wouldCreate: number;
  wouldUpdate: number;
  importadas: number;
  actualizadas: number;
  omitidas: number;
  actividades: ResultadoActividad[];
  errores: Array<{ courseId: string; courseWorkId: string; mensaje: string }>;
};

async function obtenerEstudiantesCurso(
  accessToken: string,
  courseId: string
): Promise<Map<string, EstudianteClassroom>> {
  const mapa = new Map<string, EstudianteClassroom>();
  let pageToken: string | undefined;
  do {
    const payload = await classroomGet(accessToken, `courses/${encodeURIComponent(courseId)}/students`, {
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

async function obtenerAlumnosLocales(periodoId: string, docenteId: string): Promise<AlumnoLocal[]> {
  const alumnos = await Alumno.find({ docenteId, periodoId, activo: { $ne: false } })
    .select({ _id: 1, nombreCompleto: 1, matricula: 1, correo: 1 })
    .sort({ nombreCompleto: 1 })
    .lean();
  return alumnos.map((alumno) => ({
    _id: String(alumno._id),
    nombreCompleto: String(alumno.nombreCompleto || '').trim(),
    matricula: normalizarTexto(alumno.matricula),
    correo: normalizarEmail(alumno.correo)
  }));
}

async function obtenerMapeoManualPorCurso(
  docenteId: string,
  periodoId: string,
  courseId: string
): Promise<Map<string, string>> {
  const filas = await MapeoClassroomAlumnoCurso.find({ docenteId, periodoId, courseId })
    .select({ classroomUserId: 1, alumnoId: 1 })
    .lean();
  return new Map(
    filas
      .map((fila) => [normalizarTexto(fila.classroomUserId), normalizarTexto(fila.alumnoId)] as [string, string])
      .filter((fila) => Boolean(fila[0] && fila[1]))
  );
}

async function resolverAlumnoId(params: {
  docenteId: string;
  periodoId: string;
  classroomUserId: string;
  courseId: string;
  cursoEstudiantes: Map<string, EstudianteClassroom>;
  mapeoManual: Map<string, string>;
  mapeoLegacy?: Map<string, string>;
}): Promise<ResolucionAlumno> {
  const { docenteId, periodoId, classroomUserId, cursoEstudiantes, mapeoManual, mapeoLegacy } = params;
  const asignado = mapeoManual.get(classroomUserId) || mapeoLegacy?.get(classroomUserId);
  if (asignado) return { alumnoId: asignado, strategy: 'manual' };

  const estudiante = cursoEstudiantes.get(classroomUserId);
  const email = normalizarEmail(estudiante?.emailAddress);
  if (email) {
    const alumnoCorreo = await Alumno.findOne({ docenteId, periodoId, correo: email }).select({ _id: 1 }).lean();
    if (alumnoCorreo?._id) {
      return { alumnoId: String(alumnoCorreo._id), strategy: 'email' };
    }

    const localPart = email.split('@')[0]?.trim().toUpperCase();
    if (localPart) {
      const alumnoMatricula = await Alumno.findOne({ docenteId, periodoId, matricula: localPart }).select({ _id: 1 }).lean();
      if (alumnoMatricula?._id) {
        return { alumnoId: String(alumnoMatricula._id), strategy: 'matricula' };
      }
    }
  }

  return { alumnoId: null, strategy: 'none' };
}

async function guardarMetadataActividad(
  docenteId: string,
  periodoId: string,
  actividad: ActividadClassroomSeleccionada,
  opciones?: { asignacionesAlumnos?: Array<{ classroomUserId: string; alumnoId: string }> }
) {
  const actividadNormalizada = normalizarActividadSeleccionada(actividad);
  await MapeoClassroomEvidencia.findOneAndUpdate(
    {
      docenteId,
      periodoId,
      courseId: actividadNormalizada.courseId,
      courseWorkId: actividadNormalizada.courseWorkId
    },
    {
      $set: {
        docenteId,
        periodoId,
        courseId: actividadNormalizada.courseId,
        courseWorkId: actividadNormalizada.courseWorkId,
        tituloEvidencia: actividadNormalizada.tituloEvidencia || undefined,
        descripcionEvidencia: actividadNormalizada.descripcionEvidencia || undefined,
        ponderacion: Number.isFinite(Number(actividadNormalizada.ponderacion)) ? Number(actividadNormalizada.ponderacion) : 1,
        corte: Number.isFinite(Number(actividadNormalizada.corte)) ? Number(actividadNormalizada.corte) : undefined,
        activo: actividadNormalizada.activo === false ? false : true,
        ...(opciones?.asignacionesAlumnos ? { asignacionesAlumnos: opciones.asignacionesAlumnos } : {})
      }
    },
    { upsert: true }
  );
}

function sumarResultados(resultados: ResultadoActividad[]): Omit<ResultadoSync, 'tipo' | 'periodoId' | 'actividades' | 'errores'> {
  return resultados.reduce(
    (acc, item) => ({
      totalActividades: acc.totalActividades + 1,
      submissionsProcesadas: acc.submissionsProcesadas + item.submissionsProcesadas,
      matched: acc.matched + item.matched,
      unmatched: acc.unmatched + item.unmatched,
      pending: acc.pending + item.pending,
      graded: acc.graded + item.graded,
      wouldCreate: acc.wouldCreate + item.wouldCreate,
      wouldUpdate: acc.wouldUpdate + item.wouldUpdate,
      importadas: acc.importadas + item.importadas,
      actualizadas: acc.actualizadas + item.actualizadas,
      omitidas: acc.omitidas + item.omitidas
    }),
    {
      totalActividades: 0,
      submissionsProcesadas: 0,
      matched: 0,
      unmatched: 0,
      pending: 0,
      graded: 0,
      wouldCreate: 0,
      wouldUpdate: 0,
      importadas: 0,
      actualizadas: 0,
      omitidas: 0
    }
  );
}

export async function obtenerEstadoClassroom(docenteId: string) {
  const [integracion, ultimaBitacora] = await Promise.all([
    IntegracionClassroom.findOne({ docenteId }).lean(),
    BitacoraSyncClassroom.findOne({ docenteId }).sort({ ejecutadoEn: -1 }).lean()
  ]);

  return {
    conectado: Boolean(integracion?.activo),
    correoGoogle: integracion?.correoGoogle ?? null,
    googleUserId: integracion?.googleUserId ?? null,
    ultimaSincronizacionEn: integracion?.ultimaSincronizacionEn ?? ultimaBitacora?.ejecutadoEn ?? null,
    ultimoError: integracion?.ultimoError ?? null
  };
}

export async function listarCursosParaDocente(docenteId: string) {
  const accessToken = await obtenerTokenAccesoClassroom(docenteId);
  const courses = await listarCursosClassroom(accessToken);
  return courses.map((course) => ({
    id: normalizarTexto(course.id),
    name: normalizarTexto(course.name),
    section: normalizarTexto(course.section) || undefined,
    descriptionHeading: normalizarTexto(course.descriptionHeading) || undefined,
    updateTime: normalizarTexto(course.updateTime) || undefined,
    courseState: normalizarTexto(course.courseState) || undefined
  }));
}

export async function listarActividadesPorCurso(docenteId: string, courseId: string, periodoId?: string) {
  const accessToken = await obtenerTokenAccesoClassroom(docenteId);
  const [courseWork, mapeos] = await Promise.all([
    listarActividadesClassroom(accessToken, courseId),
    periodoId
      ? MapeoClassroomEvidencia.find({ docenteId, periodoId, courseId }).lean()
      : Promise.resolve([])
  ]);
  const mapeosPorActividad = new Map(
    mapeos.map((mapeo) => [normalizarTexto(mapeo.courseWorkId), mapeo])
  );

  return courseWork.map((actividad) => {
    const id = normalizarTexto(actividad.id);
    const mapeo = mapeosPorActividad.get(id) as Record<string, unknown> | undefined;
    return {
      id,
      title: normalizarTexto(actividad.title),
      description: normalizarTexto(actividad.description) || undefined,
      maxPoints: numeroSeguro(actividad.maxPoints),
      state: normalizarTexto(actividad.state) || undefined,
      updateTime: normalizarTexto(actividad.updateTime) || undefined,
      alternateLink: normalizarTexto(actividad.alternateLink) || undefined,
      mapeo: mapeo
        ? {
            tituloEvidencia: normalizarTexto(mapeo.tituloEvidencia) || undefined,
            descripcionEvidencia: normalizarTexto(mapeo.descripcionEvidencia) || undefined,
            ponderacion: numeroSeguro(mapeo.ponderacion) || 1,
            corte: Number.isFinite(Number(mapeo.corte)) ? Number(mapeo.corte) : undefined,
            activo: mapeo.activo !== false
          }
        : null
    };
  });
}

export async function obtenerAlumnosCursoClassroom(docenteId: string, periodoId: string, courseId: string) {
  const accessToken = await obtenerTokenAccesoClassroom(docenteId);
  const [cursoEstudiantes, alumnosLocales, mapeoManual] = await Promise.all([
    obtenerEstudiantesCurso(accessToken, courseId),
    obtenerAlumnosLocales(periodoId, docenteId),
    obtenerMapeoManualPorCurso(docenteId, periodoId, courseId)
  ]);

  const alumnosLocalesPorId = new Map(alumnosLocales.map((alumno) => [alumno._id, alumno]));
  const alumnosClassroom = await Promise.all(
    [...cursoEstudiantes.values()].map(async (estudiante) => {
      const resolucion = await resolverAlumnoId({
        docenteId,
        periodoId,
        classroomUserId: estudiante.userId,
        courseId,
        cursoEstudiantes,
        mapeoManual
      });
      const alumnoConfirmadoId = mapeoManual.get(estudiante.userId) || null;
      const alumnoConfirmado = alumnoConfirmadoId ? alumnosLocalesPorId.get(alumnoConfirmadoId) ?? null : null;
      const alumnoSugerido = resolucion.alumnoId ? alumnosLocalesPorId.get(resolucion.alumnoId) ?? null : null;
      return {
        classroomUserId: estudiante.userId,
        fullName: estudiante.fullName || undefined,
        emailAddress: estudiante.emailAddress || undefined,
        alumnoIdConfirmado: alumnoConfirmadoId,
        alumnoConfirmado: alumnoConfirmado,
        alumnoIdSugerido: resolucion.strategy === 'manual' ? null : resolucion.alumnoId,
        alumnoSugerido: resolucion.strategy === 'manual' ? null : alumnoSugerido,
        matchStrategy: alumnoConfirmadoId ? 'manual' : resolucion.strategy
      };
    })
  );

  return {
    courseId,
    alumnosLocales,
    alumnosClassroom
  };
}

async function reemplazarMapeoAlumnosCurso(params: {
  docenteId: string;
  periodoId: string;
  courseId: string;
  asignaciones: Array<{ classroomUserId: string; alumnoId?: string | null }>;
}) {
  const filas = params.asignaciones
    .map((fila) => ({
      classroomUserId: normalizarTexto(fila.classroomUserId),
      alumnoId: normalizarTexto(fila.alumnoId)
    }))
    .filter((fila) => Boolean(fila.classroomUserId && fila.alumnoId));

  await MapeoClassroomAlumnoCurso.deleteMany({
    docenteId: params.docenteId,
    periodoId: params.periodoId,
    courseId: params.courseId
  });

  if (filas.length > 0) {
    await MapeoClassroomAlumnoCurso.insertMany(
      filas.map((fila) => ({
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        courseId: params.courseId,
        classroomUserId: fila.classroomUserId,
        alumnoId: fila.alumnoId
      }))
    );
  }
}

export async function actualizarMapeoAlumnosCurso(params: {
  docenteId: string;
  periodoId: string;
  courseId: string;
  asignaciones: Array<{ classroomUserId: string; alumnoId?: string | null }>;
}) {
  await reemplazarMapeoAlumnosCurso(params);
  return obtenerAlumnosCursoClassroom(params.docenteId, params.periodoId, params.courseId);
}

export async function guardarMapeoLegadoYCurso(params: {
  docenteId: string;
  periodoId: string;
  actividad: ActividadClassroomSeleccionada;
  asignacionesAlumnos: Array<{ classroomUserId: string; alumnoId: string }>;
}) {
  await guardarMetadataActividad(params.docenteId, params.periodoId, params.actividad, {
    asignacionesAlumnos: params.asignacionesAlumnos
  });
  await reemplazarMapeoAlumnosCurso({
    docenteId: params.docenteId,
    periodoId: params.periodoId,
    courseId: params.actividad.courseId,
    asignaciones: params.asignacionesAlumnos
  });
}

export async function sincronizarImportacionClassroom(params: {
  docenteId: string;
  periodoId: string;
  actividades: ActividadClassroomSeleccionada[];
  limiteSubmissions?: number;
  persistir: boolean;
}) {
  const actividades = params.actividades.map(normalizarActividadSeleccionada).filter((actividad) => Boolean(actividad.courseId && actividad.courseWorkId));
  if (actividades.length === 0) {
    throw new ErrorAplicacion('CLASSROOM_ACTIVIDADES_INVALIDAS', 'No se recibieron actividades válidas para importar', 400);
  }

  const accessToken = await obtenerTokenAccesoClassroom(params.docenteId);
  const courseCache = new Map<string, Record<string, unknown>>();
  const estudiantesPorCurso = new Map<string, Map<string, EstudianteClassroom>>();
  const mapeoManualPorCurso = new Map<string, Map<string, string>>();
  const limiteSubmissions = Math.max(1, Math.min(500, Number(params.limiteSubmissions ?? 200) || 200));

  const resultados: ResultadoActividad[] = [];
  const errores: Array<{ courseId: string; courseWorkId: string; mensaje: string }> = [];

  for (const actividad of actividades) {
    const resultadoActividad: ResultadoActividad = {
      courseId: actividad.courseId,
      courseWorkId: actividad.courseWorkId,
      tituloEvidencia: actividad.tituloEvidencia,
      submissionsProcesadas: 0,
      matched: 0,
      unmatched: 0,
      pending: 0,
      graded: 0,
      wouldCreate: 0,
      wouldUpdate: 0,
      importadas: 0,
      actualizadas: 0,
      omitidas: 0,
      submissions: [],
      errors: []
    };

    try {
      if (params.persistir) {
        await guardarMetadataActividad(params.docenteId, params.periodoId, actividad);
      }

      let cursoEstudiantes = estudiantesPorCurso.get(actividad.courseId);
      if (!cursoEstudiantes) {
        cursoEstudiantes = await obtenerEstudiantesCurso(accessToken, actividad.courseId);
        estudiantesPorCurso.set(actividad.courseId, cursoEstudiantes);
      }

      let mapeoManual = mapeoManualPorCurso.get(actividad.courseId);
      if (!mapeoManual) {
        mapeoManual = await obtenerMapeoManualPorCurso(params.docenteId, params.periodoId, actividad.courseId);
        mapeoManualPorCurso.set(actividad.courseId, mapeoManual);
      }

      let coursePayload = courseCache.get(actividad.courseId);
      if (!coursePayload) {
        coursePayload = await classroomGet(accessToken, `courses/${encodeURIComponent(actividad.courseId)}`);
        courseCache.set(actividad.courseId, coursePayload);
      }

      const courseWorkPayload = await classroomGet(
        accessToken,
        `courses/${encodeURIComponent(actividad.courseId)}/courseWork/${encodeURIComponent(actividad.courseWorkId)}`
      );

      resultadoActividad.courseName = normalizarTexto(coursePayload.name) || undefined;
      resultadoActividad.courseWorkTitle = normalizarTexto(courseWorkPayload.title) || undefined;

      const mapeoLegacyDoc = await MapeoClassroomEvidencia.findOne({
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        courseId: actividad.courseId,
        courseWorkId: actividad.courseWorkId
      }).lean();
      const mapeoLegacy = new Map<string, string>(
        (Array.isArray(mapeoLegacyDoc?.asignacionesAlumnos) ? mapeoLegacyDoc?.asignacionesAlumnos : [])
          .map((item: { classroomUserId?: unknown; alumnoId?: unknown }) => [
            normalizarTexto(item.classroomUserId),
            normalizarTexto(item.alumnoId)
          ] as [string, string])
          .filter((item: [string, string]) => Boolean(item[0] && item[1]))
      );

      let pageToken: string | undefined;
      do {
        const submissionsPayload = await classroomGet(
          accessToken,
          `courses/${encodeURIComponent(actividad.courseId)}/courseWork/${encodeURIComponent(actividad.courseWorkId)}/studentSubmissions`,
          { pageSize: limiteSubmissions, ...(pageToken ? { pageToken } : {}) }
        );
        const submissions = (Array.isArray(submissionsPayload.studentSubmissions)
          ? submissionsPayload.studentSubmissions
          : []) as Array<Record<string, unknown>>;

        for (const submission of submissions) {
          resultadoActividad.submissionsProcesadas += 1;
          const submissionId = normalizarTexto(submission.id);
          const classroomUserId = normalizarTexto(submission.userId);
          if (!submissionId || !classroomUserId) {
            resultadoActividad.omitidas += 1;
            continue;
          }

          const resolucionAlumno = await resolverAlumnoId({
            docenteId: params.docenteId,
            periodoId: params.periodoId,
            classroomUserId,
            courseId: actividad.courseId,
            cursoEstudiantes,
            mapeoManual,
            mapeoLegacy
          });
          const alumno = resolucionAlumno.alumnoId
            ? await Alumno.findById(resolucionAlumno.alumnoId)
                .select({ _id: 1, nombreCompleto: 1 })
                .lean()
            : null;

          const calificacionCalculada = calcularCalificacionDecimal({
            assignedGrade: submission.assignedGrade,
            draftGrade: submission.draftGrade,
            maxPoints: courseWorkPayload.maxPoints
          });

          const existente = await EvidenciaEvaluacion.findOne({
            docenteId: params.docenteId,
            'classroom.courseId': actividad.courseId,
            'classroom.courseWorkId': actividad.courseWorkId,
            'classroom.submissionId': submissionId
          })
            .select({ _id: 1, estadoCaptura: 1, calificacionDecimal: 1 })
            .lean();

          const estadoCaptura =
            calificacionCalculada !== null || Number.isFinite(Number(existente?.calificacionDecimal)) ? 'calificada' : 'pendiente';
          const calificacionFinal =
            calificacionCalculada !== null ? calificacionCalculada : Number.isFinite(Number(existente?.calificacionDecimal))
              ? Number(existente?.calificacionDecimal)
              : undefined;
          const wouldCreate = !existente?._id;
          const wouldUpdate = Boolean(existente?._id);

          const estudiante = cursoEstudiantes.get(classroomUserId);
          const submissionPreview: PreviewSubmission = {
            submissionId,
            classroomUserId,
            studentName: estudiante?.fullName || undefined,
            studentEmail: estudiante?.emailAddress || undefined,
            alumnoId: resolucionAlumno.alumnoId,
            alumnoNombre: alumno?.nombreCompleto ? String(alumno.nombreCompleto) : null,
            matchStrategy: resolucionAlumno.strategy,
            estadoCaptura,
            graded: estadoCaptura === 'calificada',
            pending: estadoCaptura === 'pendiente',
            wouldCreate,
            wouldUpdate,
            ...(typeof calificacionFinal === 'number' ? { calificacionDecimal: calificacionFinal } : {})
          };
          resultadoActividad.submissions.push(submissionPreview);

          if (!resolucionAlumno.alumnoId) {
            resultadoActividad.unmatched += 1;
            resultadoActividad.omitidas += 1;
            continue;
          }

          resultadoActividad.matched += 1;
          if (estadoCaptura === 'calificada') {
            resultadoActividad.graded += 1;
          } else {
            resultadoActividad.pending += 1;
          }
          if (wouldCreate) {
            resultadoActividad.wouldCreate += 1;
          } else {
            resultadoActividad.wouldUpdate += 1;
          }

          if (!params.persistir) {
            continue;
          }

          const fechaEvidencia =
            fechaSegura(submission.updateTime) ??
            fechaSegura(courseWorkPayload.updateTime) ??
            fechaSegura(courseWorkPayload.creationTime) ??
            new Date();

          const evidenciaPayload: Record<string, unknown> = {
            docenteId: params.docenteId,
            periodoId: params.periodoId,
            alumnoId: resolucionAlumno.alumnoId,
            titulo: tituloDefaultEvidencia(courseWorkPayload, actividad),
            descripcion:
              normalizarTexto(actividad.descripcionEvidencia) || normalizarTexto(courseWorkPayload.description) || undefined,
            ponderacion: Number.isFinite(Number(actividad.ponderacion)) ? Number(actividad.ponderacion) : 1,
            fechaEvidencia,
            corte: Number.isFinite(Number(actividad.corte)) ? Number(actividad.corte) : undefined,
            fuente: 'classroom',
            estadoCaptura,
            classroom: {
              courseId: actividad.courseId,
              courseWorkId: actividad.courseWorkId,
              submissionId,
              classroomUserId,
              pulledAt: new Date(),
              submissionState: normalizarTexto(submission.state) || undefined,
              assignedGrade: Number.isFinite(Number(submission.assignedGrade)) ? Number(submission.assignedGrade) : undefined,
              draftGrade: Number.isFinite(Number(submission.draftGrade)) ? Number(submission.draftGrade) : undefined,
              maxPoints: Number.isFinite(Number(courseWorkPayload.maxPoints)) ? Number(courseWorkPayload.maxPoints) : undefined,
              updateTime: fechaSegura(submission.updateTime) || fechaSegura(courseWorkPayload.updateTime) || undefined,
              courseName: normalizarTexto(coursePayload.name) || undefined,
              courseWorkTitle: normalizarTexto(courseWorkPayload.title) || undefined
            },
            metadata: {
              alternateLink: normalizarTexto(courseWorkPayload.alternateLink) || undefined
            }
          };
          if (typeof calificacionFinal === 'number') {
            evidenciaPayload.calificacionDecimal = calificacionFinal;
          }

          await EvidenciaEvaluacion.updateOne(
            {
              docenteId: params.docenteId,
              'classroom.courseId': actividad.courseId,
              'classroom.courseWorkId': actividad.courseWorkId,
              'classroom.submissionId': submissionId
            },
            {
              $set: evidenciaPayload,
              ...(typeof calificacionFinal === 'number' ? {} : { $unset: { calificacionDecimal: 1 } })
            },
            { upsert: true }
          );

          if (existente?._id) {
            resultadoActividad.actualizadas += 1;
          } else {
            resultadoActividad.importadas += 1;
          }
        }

        pageToken = normalizarTexto(submissionsPayload.nextPageToken) || undefined;
      } while (pageToken);

      if (params.persistir) {
        await MapeoClassroomEvidencia.updateOne(
          {
            docenteId: params.docenteId,
            periodoId: params.periodoId,
            courseId: actividad.courseId,
            courseWorkId: actividad.courseWorkId
          },
          { $set: { ultimaEjecucionPull: new Date() } }
        );
      }
    } catch (errorActividad) {
      const mensaje = errorActividad instanceof ErrorAplicacion ? errorActividad.message : 'Error al sincronizar actividad';
      resultadoActividad.errors.push({ mensaje });
      errores.push({
        courseId: actividad.courseId,
        courseWorkId: actividad.courseWorkId,
        mensaje
      });
    }

    resultados.push(resultadoActividad);
  }

  const resumen = sumarResultados(resultados);
  const payload: ResultadoSync = {
    tipo: params.persistir ? 'ejecucion' : 'preview',
    periodoId: params.periodoId,
    ...resumen,
    actividades: resultados,
    errores
  };

  await BitacoraSyncClassroom.create({
    docenteId: params.docenteId,
    periodoId: params.periodoId,
    tipo: payload.tipo,
    courseIds: [...new Set(actividades.map((actividad) => actividad.courseId))],
    courseWorkIds: actividades.map((actividad) => actividad.courseWorkId),
    resumen: {
      totalActividades: payload.totalActividades,
      submissionsProcesadas: payload.submissionsProcesadas,
      matched: payload.matched,
      unmatched: payload.unmatched,
      pending: payload.pending,
      graded: payload.graded,
      wouldCreate: payload.wouldCreate,
      wouldUpdate: payload.wouldUpdate,
      importadas: payload.importadas,
      actualizadas: payload.actualizadas,
      omitidas: payload.omitidas
    },
    actividades: payload.actividades,
    errores: payload.errores,
    ejecutadoEn: new Date()
  });

  if (params.persistir) {
    await IntegracionClassroom.updateOne(
      { docenteId: params.docenteId },
      {
        $set: {
          ultimaSincronizacionEn: new Date(),
          ultimoError: payload.errores[0]?.mensaje || undefined
        }
      }
    );
  }

  return payload;
}

export async function listarHistorialSyncClassroom(docenteId: string, periodoId: string) {
  const items = await BitacoraSyncClassroom.find({ docenteId, periodoId })
    .sort({ ejecutadoEn: -1 })
    .limit(20)
    .lean();

  return items.map((item) => ({
    _id: String(item._id),
    tipo: item.tipo,
    periodoId: normalizarTexto(item.periodoId),
    courseIds: Array.isArray(item.courseIds)
      ? item.courseIds.map((courseId: unknown) => normalizarTexto(courseId)).filter(Boolean)
      : [],
    courseWorkIds: Array.isArray(item.courseWorkIds)
      ? item.courseWorkIds.map((courseWorkId: unknown) => normalizarTexto(courseWorkId)).filter(Boolean)
      : [],
    resumen: item.resumen ?? {},
    errores: Array.isArray(item.errores) ? item.errores : [],
    ejecutadoEn: item.ejecutadoEn ?? item.createdAt ?? null
  }));
}
