/**
 * servicioSyncClassroom
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import { Alumno } from '../modulo_alumnos/modeloAlumno.js';
import { EvidenciaEvaluacion } from '../modulo_evaluaciones/modeloEvidenciaEvaluacion.js';
import { IntegracionClassroom } from './modeloIntegracionClassroom.js';
import { MapeoClassroomEvidencia } from './modeloMapeoClassroomEvidencia.js';
import { MapeoClassroomAlumnoCurso } from './modeloMapeoClassroomAlumnoCurso.js';
import { BitacoraSyncClassroom } from './modeloBitacoraSyncClassroom.js';
import { calcularAcumuladoTareasPonderadoPorPuntos } from './calculoAcumuladoTareas.js';
import {
  classroomGet,
  listarActividadesClassroom,
  listarCursosClassroom,
  obtenerTokenAccesoClassroom
} from './servicioClassroomGoogle.js';

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

function fechaLimiteUtc(courseWork: Record<string, unknown>): Date | null {
  const dueDate = (courseWork.dueDate || {}) as Record<string, unknown>;
  const dueTime = (courseWork.dueTime || {}) as Record<string, unknown>;
  const year = Number(dueDate.year);
  const month = Number(dueDate.month);
  const day = Number(dueDate.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  // Classroom expresa dueDate/dueTime como fecha/hora UTC; sin hora no inferimos un vencimiento.
  if (dueTime.hours === undefined || dueTime.minutes === undefined) return null;
  const hours = Number(dueTime.hours);
  const minutes = Number(dueTime.minutes);
  const seconds = Number(dueTime.seconds ?? 0);
  const millis = Math.floor(Number(dueTime.nanos ?? 0) / 1_000_000);
  if (![hours, minutes, seconds, millis].every(Number.isInteger)) return null;
  const timestamp = Date.UTC(year, month - 1, day, hours, minutes, seconds, millis);
  const fecha = new Date(timestamp);
  if (
    fecha.getUTCFullYear() !== year || fecha.getUTCMonth() !== month - 1 || fecha.getUTCDate() !== day ||
    hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59 || millis < 0 || millis > 999
  ) return null;
  return fecha;
}

function leerMetadata(valor: unknown): Record<string, unknown> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  if (typeof valor !== 'string' || !valor.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(valor);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function numeroOpcional(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
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
    ...(actividad.destinoColumna !== undefined ? { destinoColumna: actividad.destinoColumna } : {}),
    ...(typeof actividad.activo === 'boolean' ? { activo: actividad.activo } : {}),
    ...(Array.isArray(actividad.faltantesConfirmados)
      ? { faltantesConfirmados: [...new Set(actividad.faltantesConfirmados.map(normalizarTexto).filter(Boolean))] }
      : {})
  };
}

function calcularCalificacionDecimal(params: {
  assignedGrade?: unknown;
  maxPoints?: unknown;
}) {
  const gradeRaw = numeroOpcional(params.assignedGrade);
  if (gradeRaw === null) return null;

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
  destinoColumna?: 'Tareas y Ejercicios 2do Parcial' | 'Practica 2do Parcial' | 'Excluir' | null;
  activo?: boolean;
  faltantesConfirmados?: string[];
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

type IndiceAlumnosLocales = {
  porId: Map<string, AlumnoLocal>;
  porEmail: Map<string, AlumnoLocal>;
  porMatricula: Map<string, AlumnoLocal>;
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
  puntosObtenidos?: number;
  puntosPosibles?: number;
  vencida: boolean;
  puedeConfirmarFaltante: boolean;
  faltanteExplicito: boolean;
  estadoClassroom?: string;
  fechaVencimiento?: string;
};

type ResultadoActividad = {
  courseId: string;
  courseName?: string;
  courseWorkId: string;
  courseWorkTitle?: string;
  tituloEvidencia?: string;
  corte?: number;
  destinoColumna?: 'Tareas y Ejercicios 2do Parcial' | 'Practica 2do Parcial' | 'Excluir' | null;
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
  promediosEvaluacionContinuaTercerParcial: Array<{
    alumnoId: string;
    alumnoNombre: string;
    puntosObtenidos: number;
    puntosPosibles: number;
    promedioSobre10: number;
    continuaSobre5: number;
    actividadesCalificadas: number;
    actividadesFaltantesConfirmadas: number;
  }>;
  acumuladoTareasSegundoParcial: Array<{
    alumnoId: string;
    alumnoNombre: string;
    puntosObtenidos: number;
    puntosPosibles: number;
    promedio: number;
    actividadesCalificadas: number;
    actividadesFaltantesConfirmadas: number;
  }>;
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
  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId },
    select: { activo: true }
  });
  const alumnos = await Alumno.find({
    docenteId,
    periodoId,
    ...(periodo?.activo === false ? {} : { activo: { $ne: false } })
  })
    .select({ _id: 1, nombreCompleto: 1, matricula: 1, correo: 1 })
    .sort({ nombreCompleto: 1 })
    .lean();
  return alumnos.map((alumno: any) => ({
    _id: String(alumno._id),
    nombreCompleto: String(alumno.nombreCompleto || '').trim(),
    matricula: normalizarTexto(alumno.matricula),
    correo: normalizarEmail(alumno.correo)
  }));
}

function crearIndiceAlumnosLocales(alumnosLocales: AlumnoLocal[]): IndiceAlumnosLocales {
  const porId = new Map<string, AlumnoLocal>();
  const porEmail = new Map<string, AlumnoLocal>();
  const porMatricula = new Map<string, AlumnoLocal>();

  for (const alumno of alumnosLocales) {
    porId.set(alumno._id, alumno);
    const correo = normalizarEmail(alumno.correo);
    if (correo) porEmail.set(correo, alumno);
    const matricula = normalizarTexto(alumno.matricula).toUpperCase();
    if (matricula) porMatricula.set(matricula, alumno);
  }

  return { porId, porEmail, porMatricula };
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
      .map((fila: any) => [normalizarTexto(fila.classroomUserId), normalizarTexto(fila.alumnoId)] as [string, string])
      .filter((fila: any) => Boolean(fila[0] && fila[1]))
  );
}

function resolverAlumnoId(params: {
  classroomUserId: string;
  courseId: string;
  cursoEstudiantes: Map<string, EstudianteClassroom>;
  mapeoManual: Map<string, string>;
  indiceAlumnosLocales: IndiceAlumnosLocales;
  mapeoLegacy?: Map<string, string>;
}): ResolucionAlumno {
  const { classroomUserId, cursoEstudiantes, mapeoManual, indiceAlumnosLocales, mapeoLegacy } = params;
  const asignado = mapeoManual.get(classroomUserId) || mapeoLegacy?.get(classroomUserId);
  if (asignado) return { alumnoId: asignado, strategy: 'manual' };

  const estudiante = cursoEstudiantes.get(classroomUserId);
  const email = normalizarEmail(estudiante?.emailAddress);
  if (email) {
    const alumnoCorreo = indiceAlumnosLocales.porEmail.get(email);
    if (alumnoCorreo?._id) {
      return { alumnoId: alumnoCorreo._id, strategy: 'email' };
    }

    const localPart = email.split('@')[0]?.trim().toUpperCase();
    if (localPart) {
      const alumnoMatricula = indiceAlumnosLocales.porMatricula.get(localPart);
      if (alumnoMatricula?._id) {
        return { alumnoId: alumnoMatricula._id, strategy: 'matricula' };
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
        ...(actividadNormalizada.destinoColumna !== undefined ? { destinoColumna: actividadNormalizada.destinoColumna } : {}),
        activo: actividadNormalizada.activo === false ? false : true,
        ...(opciones?.asignacionesAlumnos ? { asignacionesAlumnos: opciones.asignacionesAlumnos } : {})
      }
    },
    { upsert: true }
  );
}

function sumarResultados(
  resultados: ResultadoActividad[]
): Omit<ResultadoSync, 'tipo' | 'periodoId' | 'actividades' | 'promediosEvaluacionContinuaTercerParcial' | 'acumuladoTareasSegundoParcial' | 'errores'> {
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
  return courses
    .filter((course) => !course.courseState || String(course.courseState).trim().toUpperCase() === 'ACTIVE')
    .map((course) => ({
      id: normalizarTexto(course.id),
      name: normalizarTexto(course.name),
      section: normalizarTexto(course.section) || undefined,
      descriptionHeading: normalizarTexto(course.descriptionHeading) || undefined,
      updateTime: normalizarTexto(course.updateTime) || undefined,
      courseState: normalizarTexto(course.courseState) || 'ACTIVE'
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
    mapeos.map((mapeo: any) => [normalizarTexto(mapeo.courseWorkId), mapeo])
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
            destinoColumna:
              mapeo.destinoColumna === 'Tareas y Ejercicios 2do Parcial' ||
              mapeo.destinoColumna === 'Practica 2do Parcial' ||
              mapeo.destinoColumna === 'Excluir'
                ? mapeo.destinoColumna
                : undefined,
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

  const indiceAlumnosLocales = crearIndiceAlumnosLocales(alumnosLocales);
  const alumnosClassroom = [...cursoEstudiantes.values()].map((estudiante) => {
      const resolucion = resolverAlumnoId({
        classroomUserId: estudiante.userId,
        courseId,
        cursoEstudiantes,
        mapeoManual,
        indiceAlumnosLocales
      });
      const alumnoConfirmadoId = mapeoManual.get(estudiante.userId) || null;
      const alumnoConfirmado = alumnoConfirmadoId ? indiceAlumnosLocales.porId.get(alumnoConfirmadoId) ?? null : null;
      const alumnoSugerido = resolucion.alumnoId ? indiceAlumnosLocales.porId.get(resolucion.alumnoId) ?? null : null;
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
    });

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
  const indiceAlumnosLocales = crearIndiceAlumnosLocales(await obtenerAlumnosLocales(params.periodoId, params.docenteId));
  const limiteSubmissions = Math.max(1, Math.min(500, Number(params.limiteSubmissions ?? 200) || 200));

  const resultados: ResultadoActividad[] = [];
  const errores: Array<{ courseId: string; courseWorkId: string; mensaje: string }> = [];

  for (const actividad of actividades) {
    const resultadoActividad: ResultadoActividad = {
      courseId: actividad.courseId,
      courseWorkId: actividad.courseWorkId,
      tituloEvidencia: actividad.tituloEvidencia,
      corte: actividad.corte,
      destinoColumna: actividad.destinoColumna,
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
      const fechaVencimiento = fechaLimiteUtc(courseWorkPayload);
      const vencida = fechaVencimiento !== null && fechaVencimiento.getTime() < Date.now();

      const mapeoLegacyDoc = await MapeoClassroomEvidencia.findOne({
        docenteId: params.docenteId,
        periodoId: params.periodoId,
        courseId: actividad.courseId,
        courseWorkId: actividad.courseWorkId
      }).lean();
      const asignacionesLegacy = Array.isArray(mapeoLegacyDoc?.asignacionesAlumnos) ? mapeoLegacyDoc.asignacionesAlumnos : [];
      const mapeoLegacy = new Map<string, string>(
        asignacionesLegacy
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

          const resolucionAlumno = resolverAlumnoId({
            classroomUserId,
            courseId: actividad.courseId,
            cursoEstudiantes,
            mapeoManual,
            indiceAlumnosLocales,
            mapeoLegacy
          });
          const alumno = resolucionAlumno.alumnoId ? indiceAlumnosLocales.porId.get(resolucionAlumno.alumnoId) ?? null : null;

          const calificacionCalculada = calcularCalificacionDecimal({
            assignedGrade: submission.assignedGrade,
            maxPoints: courseWorkPayload.maxPoints
          });

          const existente = await EvidenciaEvaluacion.findOne({
            docenteId: params.docenteId,
            'classroom.courseId': actividad.courseId,
            'classroom.courseWorkId': actividad.courseWorkId,
            'classroom.submissionId': submissionId
          })
            .select({ _id: 1, metadata: 1 })
            .lean();

          const metadataExistente = leerMetadata(existente?.metadata);
          const faltantePersistido = Boolean(metadataExistente.faltanteClassroomConfirmado);
          const faltanteSolicitado = actividad.faltantesConfirmados?.includes(submissionId) === true;
          const tieneCalificacionClassroom = calificacionCalculada !== null;
          const estadoClassroom = normalizarTexto(submission.state);
          const candidatoFaltante = Boolean(
            vencida &&
            (numeroOpcional(courseWorkPayload.maxPoints) ?? 0) > 0 &&
            !tieneCalificacionClassroom &&
            Boolean(resolucionAlumno.alumnoId) &&
            ['NEW', 'CREATED'].includes(estadoClassroom)
          );
          const puedeConfirmarFaltante = Boolean(
            candidatoFaltante &&
            ((resultadoActividad.destinoColumna === 'Tareas y Ejercicios 2do Parcial' && resultadoActividad.corte === 2) ||
              (resultadoActividad.corte === 3 && resultadoActividad.destinoColumna !== 'Excluir'))
          );
          if (faltanteSolicitado && !puedeConfirmarFaltante) {
            const mensaje = `No se puede confirmar como faltante la entrega ${submissionId}: debe estar vencida, pendiente y asignada a evaluación continua de Corte 2 o Corte 3.`;
            resultadoActividad.errors.push({ mensaje });
            errores.push({ courseId: actividad.courseId, courseWorkId: actividad.courseWorkId, mensaje });
          }
          const faltanteExplicito = puedeConfirmarFaltante &&
            (Array.isArray(actividad.faltantesConfirmados) ? faltanteSolicitado : faltantePersistido);
          // No persistir entregas pendientes comunes; sí conservar una falta
          // seleccionada explícitamente por el docente para que la lista pueda
          // contarla como cero en continua.
          if (params.persistir && calificacionCalculada === null && !existente?._id && !faltanteExplicito) {
            resultadoActividad.pending += 1;
            resultadoActividad.omitidas += 1;
            continue;
          }
          const estadoCaptura = calificacionCalculada !== null ? 'calificada' : 'pendiente';
          const calificacionFinal = calificacionCalculada ?? undefined;
          const wouldCreate = !existente?._id;
          const wouldUpdate = Boolean(existente?._id);

          const estudiante = cursoEstudiantes.get(classroomUserId);
          const submissionPreview: PreviewSubmission = {
            submissionId,
            classroomUserId,
            studentName: estudiante?.fullName || undefined,
            studentEmail: estudiante?.emailAddress || undefined,
            alumnoId: resolucionAlumno.alumnoId,
            alumnoNombre: alumno?.nombreCompleto || null,
            matchStrategy: resolucionAlumno.strategy,
            estadoCaptura,
            graded: estadoCaptura === 'calificada',
            pending: estadoCaptura === 'pendiente',
            wouldCreate,
            wouldUpdate,
            ...(typeof calificacionFinal === 'number' ? { calificacionDecimal: calificacionFinal } : {}),
            ...(calificacionCalculada !== null && (numeroOpcional(courseWorkPayload.maxPoints) ?? 0) > 0
              ? {
                  puntosObtenidos: numeroOpcional(submission.assignedGrade) ?? undefined,
                  puntosPosibles: numeroOpcional(courseWorkPayload.maxPoints) ?? undefined
                }
              : (numeroOpcional(courseWorkPayload.maxPoints) ?? 0) > 0
                ? { puntosPosibles: numeroOpcional(courseWorkPayload.maxPoints) ?? undefined }
                : {}),
            vencida,
            puedeConfirmarFaltante,
            faltanteExplicito,
            ...(estadoClassroom ? { estadoClassroom } : {}),
            ...(fechaVencimiento ? { fechaVencimiento: fechaVencimiento.toISOString() } : {})
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

          const metadataActualizada = { ...metadataExistente };
          const historialFaltante = Array.isArray(metadataExistente.auditoriaFaltanteClassroom)
            ? [...metadataExistente.auditoriaFaltanteClassroom as Array<Record<string, unknown>>]
            : [];
          const horaAuditoria = new Date().toISOString();
          if (
            tieneCalificacionClassroom ||
            (faltantePersistido && !candidatoFaltante) ||
            (puedeConfirmarFaltante && Array.isArray(actividad.faltantesConfirmados) && !faltanteSolicitado)
          ) {
            delete metadataActualizada.faltanteClassroomConfirmado;
            if (faltantePersistido) {
              historialFaltante.push({
                accion: tieneCalificacionClassroom ? 'invalidado_por_calificacion' : 'invalidado_por_cambio_de_estado',
                realizadoPor: params.docenteId,
                realizadoEn: horaAuditoria
              });
            }
          } else if (faltanteExplicito) {
            const confirmacionAnterior = metadataExistente.faltanteClassroomConfirmado;
            metadataActualizada.faltanteClassroomConfirmado = {
              confirmadoPor: faltanteSolicitado ? params.docenteId : (confirmacionAnterior as Record<string, unknown>).confirmadoPor,
              confirmadoEn: faltanteSolicitado && !faltantePersistido
                ? horaAuditoria
                : (confirmacionAnterior as Record<string, unknown>).confirmadoEn
            };
          }
          if (
            puedeConfirmarFaltante && Array.isArray(actividad.faltantesConfirmados) &&
            faltanteSolicitado !== faltantePersistido
          ) {
            historialFaltante.push({
              accion: faltanteSolicitado ? 'confirmado_por_docente' : 'retirado_por_docente',
              realizadoPor: params.docenteId,
              realizadoEn: horaAuditoria
            });
          }
          if (historialFaltante.length > 0) {
            metadataActualizada.auditoriaFaltanteClassroom = historialFaltante.slice(-50);
          }
          const alternateLink = normalizarTexto(courseWorkPayload.alternateLink);
          if (alternateLink) metadataActualizada.alternateLink = alternateLink;
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
            metadata: metadataActualizada,
            classroom: {
              courseId: actividad.courseId,
              courseWorkId: actividad.courseWorkId,
              submissionId,
              classroomUserId,
              pulledAt: new Date(),
              submissionState: normalizarTexto(submission.state) || undefined,
              assignedGrade: Number.isFinite(Number(submission.assignedGrade)) ? Number(submission.assignedGrade) : undefined,
              maxPoints: Number.isFinite(Number(courseWorkPayload.maxPoints)) ? Number(courseWorkPayload.maxPoints) : undefined,
              dueDate: courseWorkPayload.dueDate,
              dueTime: courseWorkPayload.dueTime,
              updateTime: fechaSegura(submission.updateTime) || fechaSegura(courseWorkPayload.updateTime) || undefined,
              courseName: normalizarTexto(coursePayload.name) || undefined,
              courseWorkTitle: normalizarTexto(courseWorkPayload.title) || undefined
            },
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
  const puntosPorAlumno = new Map<
    string,
    { alumnoNombre: string; porActividad: Map<string, { puntosObtenidos: number; puntosPosibles: number; faltante: boolean }> }
  >();
  for (const actividad of resultados) {
    if (actividad.destinoColumna !== 'Tareas y Ejercicios 2do Parcial' || actividad.corte !== 2) continue;
    for (const submission of actividad.submissions) {
      if (!submission.alumnoId || submission.puntosPosibles === undefined ||
          (submission.puntosObtenidos === undefined && !submission.faltanteExplicito)) continue;
      const acumulado = puntosPorAlumno.get(submission.alumnoId) ?? {
        alumnoNombre: normalizarTexto(submission.alumnoNombre) || 'Alumno sin nombre',
        porActividad: new Map<string, { puntosObtenidos: number; puntosPosibles: number; faltante: boolean }>()
      };
      acumulado.porActividad.set(`${actividad.courseId}:${actividad.courseWorkId}`, {
        puntosObtenidos: submission.puntosObtenidos ?? 0,
        puntosPosibles: submission.puntosPosibles,
        faltante: submission.faltanteExplicito
      });
      puntosPorAlumno.set(submission.alumnoId, acumulado);
    }
  }
  const acumuladoTareasSegundoParcial = [...puntosPorAlumno.entries()]
    .map(([alumnoId, acumulado]) => {
      const actividadesAlumno = [...acumulado.porActividad.values()];
      const promedio = calcularAcumuladoTareasPonderadoPorPuntos(
        actividadesAlumno.map((actividad) => ({ ...actividad, calificada: !actividad.faltante, faltanteExplicito: actividad.faltante, vencida: actividad.faltante }))
      );
      if (promedio === null) return null;
      return {
        alumnoId,
        alumnoNombre: acumulado.alumnoNombre,
        puntosObtenidos: Number(actividadesAlumno.reduce((suma, actividad) => suma + actividad.puntosObtenidos, 0).toFixed(4)),
        puntosPosibles: Number(actividadesAlumno.reduce((suma, actividad) => suma + actividad.puntosPosibles, 0).toFixed(4)),
        promedio,
        actividadesCalificadas: actividadesAlumno.filter((actividad) => !actividad.faltante).length,
        actividadesFaltantesConfirmadas: actividadesAlumno.filter((actividad) => actividad.faltante).length
      };
    })
    .filter((fila): fila is NonNullable<typeof fila> => fila !== null)
    .sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre, 'es'));
  const puntosC3PorAlumno = new Map<
    string,
    { alumnoNombre: string; porActividad: Map<string, { puntosObtenidos: number; puntosPosibles: number; faltante: boolean }> }
  >();
  for (const actividad of resultados) {
    if (actividad.corte !== 3 || actividad.destinoColumna === 'Excluir') continue;
    for (const submission of actividad.submissions) {
      if (!submission.alumnoId || submission.puntosPosibles === undefined ||
          (submission.puntosObtenidos === undefined && !submission.faltanteExplicito)) continue;
      const acumulado = puntosC3PorAlumno.get(submission.alumnoId) ?? {
        alumnoNombre: normalizarTexto(submission.alumnoNombre) || 'Alumno sin nombre',
        porActividad: new Map<string, { puntosObtenidos: number; puntosPosibles: number; faltante: boolean }>()
      };
      acumulado.porActividad.set(`${actividad.courseId}:${actividad.courseWorkId}`, {
        puntosObtenidos: submission.puntosObtenidos ?? 0,
        puntosPosibles: submission.puntosPosibles,
        faltante: submission.faltanteExplicito
      });
      puntosC3PorAlumno.set(submission.alumnoId, acumulado);
    }
  }
  const promediosEvaluacionContinuaTercerParcial = [...puntosC3PorAlumno.entries()]
    .map(([alumnoId, acumulado]) => {
      const actividadesAlumno = [...acumulado.porActividad.values()];
      const promedioSobre10 = calcularAcumuladoTareasPonderadoPorPuntos(
        actividadesAlumno.map((actividad) => ({ ...actividad, calificada: !actividad.faltante, faltanteExplicito: actividad.faltante, vencida: actividad.faltante }))
      );
      if (promedioSobre10 === null) return null;
      return {
        alumnoId,
        alumnoNombre: acumulado.alumnoNombre,
        puntosObtenidos: Number(actividadesAlumno.reduce((suma, actividad) => suma + actividad.puntosObtenidos, 0).toFixed(4)),
        puntosPosibles: Number(actividadesAlumno.reduce((suma, actividad) => suma + actividad.puntosPosibles, 0).toFixed(4)),
        promedioSobre10,
        continuaSobre5: round4(promedioSobre10 / 2),
        actividadesCalificadas: actividadesAlumno.filter((actividad) => !actividad.faltante).length,
        actividadesFaltantesConfirmadas: actividadesAlumno.filter((actividad) => actividad.faltante).length
      };
    })
    .filter((fila): fila is NonNullable<typeof fila> => fila !== null)
    .sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre, 'es'));
  const payload: ResultadoSync = {
    tipo: params.persistir ? 'ejecucion' : 'preview',
    periodoId: params.periodoId,
    ...resumen,
    actividades: resultados,
    promediosEvaluacionContinuaTercerParcial,
    acumuladoTareasSegundoParcial,
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
      omitidas: payload.omitidas,
      acumuladoTareasSegundoParcial: payload.acumuladoTareasSegundoParcial
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

  return items.map((item: any) => ({
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

export async function importarAlumnosClassroomAEvaluaPro(params: {
  docenteId: string;
  periodoId: string;
  courseId: string;
  alumnos: Array<{
    classroomUserId: string;
    fullName: string;
    emailAddress?: string | null;
    matricula?: string | null;
  }>;
}) {
  const { docenteId, periodoId, courseId, alumnos } = params;

  const periodo = await prisma.periodo.findFirst({
    where: { id: periodoId, docenteId }
  });
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Materia no encontrada', 404);
  }

  // Deduplicación previa del payload de entrada por classroomUserId
  const alumnosUnicos = new Map<string, (typeof alumnos)[0]>();
  for (const a of alumnos) {
    if (a.classroomUserId && !alumnosUnicos.has(a.classroomUserId)) {
      alumnosUnicos.set(a.classroomUserId, a);
    }
  }

  const existentes = await prisma.alumno.findMany({
    where: { periodoId }
  });
  const porCorreo = new Map(existentes.filter((a) => a.correo).map((a) => [a.correo.trim().toLowerCase(), a]));
  const porNombre = new Map(existentes.map((a) => [normalizarTexto(a.nombreCompleto).toLowerCase(), a]));

  const asignaciones: Array<{ classroomUserId: string; alumnoId: string }> = [];
  let creados = 0;
  let actualizados = 0;

  for (const item of alumnosUnicos.values()) {
    const rawName = normalizarTexto(item.fullName) || 'Estudiante Classroom';
    const rawEmail = normalizarTexto(item.emailAddress || '').toLowerCase();
    let matriculaLimpia = normalizarTexto(item.matricula || '');

    // Si el docente no ingresó matrícula manual, intentar extraerla si el correo institucional empieza con CUH
    if (!matriculaLimpia && rawEmail.startsWith('cuh')) {
      const userPart = rawEmail.split('@')[0];
      if (userPart) {
        matriculaLimpia = userPart.toUpperCase();
      }
    }

    let alumno = (rawEmail ? porCorreo.get(rawEmail) : null) || porNombre.get(rawName.toLowerCase());

    if (alumno) {
      // Si el alumno ya existe, NUNCA se duplica ni se borra; solo se actualiza matrícula si el docente la proveyó o se detectó CUH
      if (matriculaLimpia && alumno.matricula !== matriculaLimpia) {
        alumno = await prisma.alumno.update({
          where: { id: alumno.id },
          data: { matricula: matriculaLimpia }
        });
        actualizados++;
      }
    } else {
      const partes = rawName.split(/\s+/);
      const nombres = partes.slice(0, Math.max(1, partes.length - 2)).join(' ') || partes[0];
      const apellidos = partes.length > 1 ? partes.slice(-2).join(' ') : null;

      const matriculaFinal = matriculaLimpia || item.classroomUserId;
      const correoFinal = rawEmail || `${item.classroomUserId}@classroom.google.com`;

      alumno = await prisma.alumno.create({
        data: {
          periodoId,
          matricula: matriculaFinal,
          nombreCompleto: rawName,
          nombres,
          apellidos,
          correo: correoFinal,
          activo: true
        }
      });
      creados++;
      // Indexar inmediatamente en mapas locales para evitar duplicados en la misma transacción
      if (rawEmail) porCorreo.set(rawEmail, alumno);
      porCorreo.set(correoFinal, alumno);
      porNombre.set(rawName.toLowerCase(), alumno);
    }

    if (alumno && item.classroomUserId) {
      asignaciones.push({
        classroomUserId: item.classroomUserId,
        alumnoId: alumno.id
      });
    }
  }

  await reemplazarMapeoAlumnosCurso({
    docenteId,
    periodoId,
    courseId,
    asignaciones
  });

  const rosterActualizado = await obtenerAlumnosCursoClassroom(docenteId, periodoId, courseId);

  return {
    creados,
    actualizados,
    conservados: existentes.length,
    totalProcesados: alumnosUnicos.size,
    roster: rosterActualizado
  };
}
