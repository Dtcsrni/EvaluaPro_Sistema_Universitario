import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import {
  classroomGet,
  listarActividadesClassroomConEstado,
  listarTemasClassroomConEstado,
  obtenerTokenAccesoClassroom
} from './servicioClassroomGoogle.js';

const HOSTS_MATERIALES_PERMITIDOS = new Set([
  'classroom.google.com',
  'docs.google.com',
  'drive.google.com',
  'forms.gle',
  'youtube.com',
  'www.youtube.com',
  'youtu.be'
]);

type FechaClassroom = { year?: number; month?: number; day?: number } | null;
type HoraClassroom = { hours?: number; minutes?: number; seconds?: number; nanos?: number } | null;

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined;
}

function fechaClassroom(valor: unknown): FechaClassroom {
  if (!valor || typeof valor !== 'object') return null;
  const fecha = valor as Record<string, unknown>;
  const year = Number(fecha.year);
  const month = Number(fecha.month);
  const day = Number(fecha.day);
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1 || day > 31) return null;
  const fechaCalendario = new Date(Date.UTC(year, month - 1, day));
  if (fechaCalendario.getUTCFullYear() !== year || fechaCalendario.getUTCMonth() !== month - 1 || fechaCalendario.getUTCDate() !== day) return null;
  return { year, month, day };
}

function horaClassroom(valor: unknown): HoraClassroom {
  if (!valor || typeof valor !== 'object') return null;
  const hora = valor as Record<string, unknown>;
  const hours = Number(hora.hours ?? 0);
  const minutes = Number(hora.minutes ?? 0);
  const seconds = Number(hora.seconds ?? 0);
  const nanos = Number(hora.nanos ?? 0);
  if (![hours, minutes, seconds, nanos].every(Number.isInteger) || hours < 0 || hours > 23 ||
      minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59 || nanos < 0 || nanos > 999_999_999) return null;
  return { hours, minutes, seconds, nanos };
}

function fechaEntregaUtc(fecha: FechaClassroom, hora: HoraClassroom): string | null {
  if (!fecha || !hora) return null;
  const base = `${String(fecha.year).padStart(4, '0')}-${String(fecha.month).padStart(2, '0')}-${String(fecha.day).padStart(2, '0')}`;
  const time = `${String(hora.hours).padStart(2, '0')}:${String(hora.minutes).padStart(2, '0')}:${String(hora.seconds).padStart(2, '0')}`;
  const fraccion = hora.nanos ? `.${String(Math.floor(hora.nanos / 1_000_000)).padStart(3, '0')}` : '';
  const valor = `${base}T${time}${fraccion}Z`;
  return Number.isNaN(Date.parse(valor)) ? null : new Date(valor).toISOString();
}

export function enlaceClassroomPermitido(valor: unknown, tipo: 'actividad' | 'material'): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const hostValido = tipo === 'actividad'
      ? url.hostname === 'classroom.google.com'
      : HOSTS_MATERIALES_PERMITIDOS.has(url.hostname);
    return hostValido ? url.href : null;
  } catch {
    return null;
  }
}

function mapearMaterial(valor: unknown) {
  if (!valor || typeof valor !== 'object') return null;
  const material = valor as Record<string, unknown>;
  const driveContainer = material.driveFile as Record<string, unknown> | undefined;
  const drive = driveContainer?.driveFile as Record<string, unknown> | undefined;
  const youtube = material.youtubeVideo as Record<string, unknown> | undefined;
  const web = material.link as Record<string, unknown> | undefined;
  const form = material.form as Record<string, unknown> | undefined;
  const candidates: Array<{ tipo: string; titulo?: string; enlace?: unknown }> = [
    { tipo: 'Google Drive', titulo: texto(drive?.title), enlace: drive?.alternateLink },
    { tipo: 'YouTube', titulo: texto(youtube?.title), enlace: youtube?.alternateLink },
    { tipo: 'Enlace', titulo: texto(web?.title), enlace: web?.url },
    { tipo: 'Formulario', titulo: texto(form?.title), enlace: form?.formUrl }
  ];
  const encontrado = candidates.find((item) => item.titulo || item.enlace !== undefined);
  if (!encontrado) return { tipo: 'Material', nombre: null, enlace: null };
  return {
    tipo: encontrado.tipo,
    nombre: encontrado.titulo || null,
    enlace: enlaceClassroomPermitido(encontrado.enlace, 'material')
  };
}

function codigoError(error: unknown): string {
  return error instanceof ErrorAplicacion ? error.codigo : 'CLASSROOM_CONSULTA_ERROR';
}

export async function consultarActividadesClassroomPorTema(
  docenteId: string,
  courseId: string,
  accessToken?: string
) {
  const token = accessToken || await obtenerTokenAccesoClassroom(docenteId);
  const [resultadoCurso, resultadoActividades, resultadoTemas] = await Promise.allSettled([
    classroomGet(token, `courses/${encodeURIComponent(courseId)}`),
    listarActividadesClassroomConEstado(token, courseId),
    listarTemasClassroomConEstado(token, courseId)
  ]);
  const actividades = resultadoActividades.status === 'fulfilled' ? resultadoActividades.value.items : [];
  const temas = resultadoTemas.status === 'fulfilled' ? resultadoTemas.value.items : [];
  const curso = resultadoCurso.status === 'fulfilled' ? resultadoCurso.value : {};
  const nombreCurso = texto(curso.name) || null;
  const nombrePorTema = new Map(temas.map((tema) => [String(tema.topicId || ''), String(tema.name || '')]));
  const errores = [
    ...(resultadoCurso.status === 'rejected' ? [{ recurso: 'curso', codigo: codigoError(resultadoCurso.reason) }] : []),
    ...(resultadoActividades.status === 'rejected'
      ? [{ recurso: 'actividades', codigo: codigoError(resultadoActividades.reason) }]
      : resultadoActividades.value.completa ? [] : [{ recurso: 'actividades', codigo: resultadoActividades.value.errorCode || 'CLASSROOM_PAGINACION_PARCIAL' }]),
    ...(resultadoTemas.status === 'rejected'
      ? [{ recurso: 'temas', codigo: codigoError(resultadoTemas.reason) }]
      : resultadoTemas.value.completa ? [] : [{ recurso: 'temas', codigo: resultadoTemas.value.errorCode || 'CLASSROOM_PAGINACION_PARCIAL' }])
  ];

  return {
    curso: {
      id: texto(curso.id) || courseId,
      name: nombreCurso,
      section: texto(curso.section) || null,
      courseState: texto(curso.courseState) || null,
      updateTime: texto(curso.updateTime) || null,
      alternateLink: enlaceClassroomPermitido(curso.alternateLink, 'actividad')
    },
    actividades: actividades.map((actividad) => {
      const dueDate = fechaClassroom(actividad.dueDate);
      const dueTime = horaClassroom(actividad.dueTime);
      const topicId = texto(actividad.topicId) || null;
      const materialesFuente = Array.isArray(actividad.materials) ? actividad.materials : [];
      const gradeCategory = actividad.gradeCategory && typeof actividad.gradeCategory === 'object'
        ? actividad.gradeCategory as Record<string, unknown>
        : undefined;
      return {
        id: texto(actividad.id) || '',
        courseId,
        courseName: nombreCurso,
        title: texto(actividad.title) || '',
        description: texto(actividad.description) ?? null,
        topicId,
        topicName: topicId ? nombrePorTema.get(topicId) || null : 'Sin tema',
        workType: texto(actividad.workType) || 'UNKNOWN',
        state: texto(actividad.state) || 'UNKNOWN',
        scheduledTime: texto(actividad.scheduledTime) || null,
        dueDate,
        dueTime,
        dueAtUtc: fechaEntregaUtc(dueDate, dueTime),
        creationTime: texto(actividad.creationTime) || null,
        updateTime: texto(actividad.updateTime) || null,
        maxPoints: typeof actividad.maxPoints === 'number' && Number.isFinite(actividad.maxPoints) ? actividad.maxPoints : null,
        gradingPeriodId: texto(actividad.gradingPeriodId) || null,
        gradeCategory: gradeCategory ? {
          id: texto(gradeCategory.id) || null,
          name: texto(gradeCategory.name) || null,
          weight: typeof gradeCategory.weight === 'number' && Number.isFinite(gradeCategory.weight) ? gradeCategory.weight : null
        } : null,
        materials: materialesFuente.map(mapearMaterial).filter((material) => material !== null),
        alternateLink: enlaceClassroomPermitido(actividad.alternateLink, 'actividad')
      };
    }),
    temas: temas.map((tema) => ({ id: texto(tema.topicId) || '', name: texto(tema.name) || '' })).filter((tema) => tema.id && tema.name),
    completa: errores.length === 0,
    errores
  };
}
