/**
 * Proyección de “Tareas y Ejercicios 2do Parcial” desde actividades Classroom
 * confirmadas para ese corte. Las notas de borrador nunca son calificación oficial.
 */
export type ActividadMapeadaParcial2 = {
  courseId: string;
  courseWorkId: string;
  titulo?: string;
  /** Por omisión se consideran todas las actividades mapeadas al segundo parcial. */
  incluirEnPromedio?: boolean;
  puntosPosibles?: number | null;
  fechaLimite?: string | null;
};

export type FaltanteConfirmadoParcial2 = {
  alumnoId: string;
  courseId: string;
  courseWorkId: string;
  marcadoEn?: string;
};

export type ActividadCalificacionParcial2 = {
  courseId: string;
  courseWorkId: string;
  titulo: string;
  puntosPosibles: number | null;
  puntosObtenidos: number | null;
  fechaLimite: string | null;
  estado: 'calificada' | 'faltante' | 'pendiente';
  faltanteConfirmado: boolean;
};

export type EvidenciaClassroomParcial2 = {
  alumnoId: unknown;
  classroom?: unknown;
  classroomData?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
  _id?: unknown;
};

export type PromedioTareasParcial2 = {
  tareasEjerciciosParcial2: string;
  puntosObtenidosParcial2: number | null;
  puntosPosiblesParcial2: number | null;
  actividadesCalificadasParcial2: number;
  nombresActividadesParcial2: string[];
  actividadesParcial2: ActividadCalificacionParcial2[];
};

export type ComponentesFisicosParcial2 = {
  evaluacionContinuaParcial2: string;
  calificacionExamenConBonoParcial2: string;
  calificacionSegundoParcialFisica: string;
};

/** Proyecta AQ, AR y AS con blancos explícitos cuando sus insumos faltan. */
export function calcularComponentesFisicosParcial2(params: {
  tareasEjerciciosParcial2: unknown;
  practicaParcial2: unknown;
  examenManualParcial2: unknown;
  bonoGuiaEstudio: boolean;
}): ComponentesFisicosParcial2 {
  const tareas = Number(params.tareasEjerciciosParcial2);
  const practica = Number(params.practicaParcial2);
  const examen = Number(params.examenManualParcial2);
  const tieneTareas = params.tareasEjerciciosParcial2 !== null && params.tareasEjerciciosParcial2 !== undefined && texto(params.tareasEjerciciosParcial2) !== '' && Number.isFinite(tareas);
  const tienePractica = params.practicaParcial2 !== null && params.practicaParcial2 !== undefined && texto(params.practicaParcial2) !== '' && Number.isFinite(practica);
  const tieneExamen = params.examenManualParcial2 !== null && params.examenManualParcial2 !== undefined && texto(params.examenManualParcial2) !== '' && Number.isFinite(examen);
  const continua = tieneTareas && tienePractica ? Number(((tareas * 0.6 + practica * 0.4) / 2).toFixed(2)) : null;
  const examenConBono = tieneExamen ? Number((examen + (params.bonoGuiaEstudio ? 0.25 : 0)).toFixed(2)) : null;
  const segundoParcial = continua !== null && examenConBono !== null ? Number((continua + examenConBono).toFixed(2)) : null;
  return {
    evaluacionContinuaParcial2: continua === null ? '' : String(continua),
    calificacionExamenConBonoParcial2: examenConBono === null ? '' : String(examenConBono),
    calificacionSegundoParcialFisica: segundoParcial === null ? '' : String(segundoParcial)
  };
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim();
}

function objeto(valor: unknown): Record<string, unknown> {
  if (typeof valor === 'string') {
    try {
      const parsed: unknown = JSON.parse(valor);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return valor && typeof valor === 'object' ? valor as Record<string, unknown> : {};
}

function fecha(valor: unknown): number {
  const result = new Date(String(valor ?? '')).getTime();
  return Number.isFinite(result) ? result : 0;
}

function serializarNota(valor: number | null): string {
  return valor === null ? '' : String(Number(valor.toFixed(2)));
}

/** Calcula el promedio por puntos; devuelve vacío si no hay evidencia suficiente. */
export function proyectarPromedioTareasParcial2(
  alumnoIds: string[],
  actividades: ActividadMapeadaParcial2[],
  evidencias: EvidenciaClassroomParcial2[],
  faltantesConfirmados: FaltanteConfirmadoParcial2[] = [],
  ahora = new Date()
): Map<string, PromedioTareasParcial2> {
  const actividadesPorId = new Map<string, ActividadMapeadaParcial2>();
  for (const actividad of actividades) {
    const courseId = texto(actividad.courseId);
    const courseWorkId = texto(actividad.courseWorkId);
    if (courseId && courseWorkId && actividad.incluirEnPromedio !== false) {
      actividadesPorId.set(`${courseId}\u0000${courseWorkId}`, actividad);
    }
  }

  const evidenciaMasReciente = new Map<string, { evidencia: EvidenciaClassroomParcial2; classroom: Record<string, unknown> }>();
  for (const evidencia of evidencias) {
    const alumnoId = texto(evidencia.alumnoId);
    const classroom = objeto(evidencia.classroom ?? evidencia.classroomData);
    const claveActividad = `${texto(classroom.courseId)}\u0000${texto(classroom.courseWorkId)}`;
    if (!alumnoId || !actividadesPorId.has(claveActividad)) continue;

    const clave = `${alumnoId}\u0000${claveActividad}`;
    const previa = evidenciaMasReciente.get(clave);
    const fechaActual = fecha(evidencia.updatedAt ?? evidencia.createdAt);
    const fechaPrevia = previa ? fecha(previa.evidencia.updatedAt ?? previa.evidencia.createdAt) : -1;
    const idActual = texto(evidencia._id);
    const idPrevio = texto(previa?.evidencia._id);
    if (!previa || fechaActual > fechaPrevia || (fechaActual === fechaPrevia && idActual.localeCompare(idPrevio) > 0)) {
      evidenciaMasReciente.set(clave, { evidencia, classroom });
    }
  }

  const resultado = new Map<string, PromedioTareasParcial2>();
  const faltantes = new Set(faltantesConfirmados.map((faltante) =>
    `${texto(faltante.alumnoId)}\u0000${texto(faltante.courseId)}\u0000${texto(faltante.courseWorkId)}`
  ));
  for (const alumnoId of alumnoIds) {
    let obtenidos = 0;
    let posibles = 0;
    const calificadas = new Set<string>();
    const nombres = new Set<string>();
    const actividadesAlumno: ActividadCalificacionParcial2[] = [];
    for (const [claveActividad, actividad] of actividadesPorId) {
      const clave = `${alumnoId}\u0000${claveActividad}`;
      const valor = evidenciaMasReciente.get(clave);
      const classroom = valor?.classroom ?? {};
      const grade = classroom.assignedGrade;
      const maxPointsFuente = Number(classroom.maxPoints);
      const maxPointsMapeo = Number(actividad.puntosPosibles);
      const maxPoints = Number.isFinite(maxPointsFuente) && maxPointsFuente > 0
        ? maxPointsFuente
        : maxPointsMapeo;
      const puntosPosibles = Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : null;
      const [courseId = '', courseWorkId = ''] = claveActividad.split('\u0000');
      const calificacionPublicada = typeof grade === 'number' && Number.isFinite(grade) && grade >= 0;
      const fechaLimiteMs = fecha(actividad.fechaLimite);
      const vencida = fechaLimiteMs > 0 && fechaLimiteMs <= ahora.getTime();
      const faltanteConfirmado = faltantes.has(`${alumnoId}\u0000${courseId}\u0000${courseWorkId}`) && vencida && !calificacionPublicada;
      const titulo = texto(actividad.titulo) || texto(classroom.courseWorkTitle);

      if (calificacionPublicada && puntosPosibles !== null) {
        obtenidos += grade;
        posibles += puntosPosibles;
        calificadas.add(claveActividad);
      } else if (faltanteConfirmado && puntosPosibles !== null) {
        posibles += puntosPosibles;
      }
      if ((calificacionPublicada || faltanteConfirmado) && titulo) nombres.add(titulo);

      actividadesAlumno.push({
        courseId,
        courseWorkId,
        titulo,
        puntosPosibles,
        puntosObtenidos: calificacionPublicada ? grade : null,
        fechaLimite: actividad.fechaLimite ?? null,
        estado: calificacionPublicada ? 'calificada' : faltanteConfirmado ? 'faltante' : 'pendiente',
        faltanteConfirmado
      });
    }

    const promedio = posibles > 0 ? Math.min(10, Math.max(0, (obtenidos / posibles) * 10)) : null;
    resultado.set(alumnoId, {
      tareasEjerciciosParcial2: serializarNota(promedio),
      puntosObtenidosParcial2: posibles > 0 ? Number(obtenidos.toFixed(4)) : null,
      puntosPosiblesParcial2: posibles > 0 ? Number(posibles.toFixed(4)) : null,
      actividadesCalificadasParcial2: calificadas.size,
      nombresActividadesParcial2: [...nombres].sort((a, b) => a.localeCompare(b, 'es')),
      actividadesParcial2: actividadesAlumno.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
    });
  }
  return resultado;
}

/** Convierte la fecha/hora UTC opcional de Classroom en un límite UTC inequívoco. */
export function obtenerFechaLimiteClassroom(courseWork: unknown): Date | null {
  const datos = objeto(courseWork);
  const dueDate = objeto(datos.dueDate);
  const year = Number(dueDate.year);
  const month = Number(dueDate.month);
  const day = Number(dueDate.day);
  if (!Number.isInteger(year) || year < 1970 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return null;

  const dueTime = objeto(datos.dueTime);
  const tieneHora = Object.keys(dueTime).length > 0;
  const hour = tieneHora ? Number(dueTime.hours ?? 0) : 23;
  const minute = tieneHora ? Number(dueTime.minutes ?? 0) : 59;
  const second = tieneHora ? Number(dueTime.seconds ?? 0) : 59;
  const nanos = tieneHora ? Number(dueTime.nanos ?? 0) : 999_000_000;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59 || !Number.isInteger(second) || second < 0 || second > 59 || !Number.isInteger(nanos) || nanos < 0 || nanos > 999_999_999) return null;

  const result = new Date(Date.UTC(year, month - 1, day, hour, minute, second, Math.floor(nanos / 1_000_000)));
  return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day
    ? result
    : null;
}
