/** Proyección de las columnas físicas de evaluación del Segundo Parcial. */
export const COLUMNA_TAREAS_PARCIAL_2 = 'Tareas y Ejercicios 2do Parcial';
export const COLUMNA_PRACTICA_PARCIAL_2 = 'Practica 2do Parcial';
export const COLUMNA_EXAMEN_PARCIAL_2 = 'Exámen 2do Parcial';

export type EvidenciaListaParcial2 = {
  alumnoId?: unknown;
  fuente?: unknown;
  estadoCaptura?: unknown;
  calificacionDecimal?: unknown;
  classroomData?: unknown;
  metadata?: unknown;
  updatedAt?: unknown;
};

export type MapeoListaClassroom = {
  courseId?: unknown;
  courseWorkId?: unknown;
  corte?: unknown;
  destinoColumna?: unknown;
  activo?: unknown;
  metadata?: unknown;
};

export type CalificacionManualLista = {
  alumnoId?: unknown;
  componente?: unknown;
  calificacion?: unknown;
  version?: unknown;
  auditoria?: unknown;
};

export type ColumnasFisicasParcial2 = {
  tareasYEjercicios2doParcial: string;
  tareasPuntosObtenidos: string;
  tareasPuntosPosibles: string;
  practica2doParcial: string;
  evaluacionContinua2doParcial: string;
  examen2doParcial: string;
  examen2doParcialAutomatico: string;
  calificacionSegundoParcial: string;
  practica2doParcialVersion: number | null;
  examen2doParcialVersion: number | null;
};

function objetoJson(valor: unknown): Record<string, unknown> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  if (typeof valor !== 'string' || !valor.trim()) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim())) return null;
  const resultado = typeof valor === 'number' ? valor : Number(String(valor ?? '').trim());
  return Number.isFinite(resultado) ? resultado : null;
}

function round4(valor: number): number {
  return Number(valor.toFixed(4));
}

function valorTexto(valor: number | null): string {
  return valor === null ? '' : String(round4(valor));
}

function fechaTiempo(valor: unknown): number {
  const tiempo = new Date(String(valor ?? '')).getTime();
  return Number.isFinite(tiempo) ? tiempo : 0;
}

function mapearActividad(mapeo: MapeoListaClassroom) {
  const metadata = objetoJson(mapeo.metadata);
  return {
    courseId: String(mapeo.courseId ?? '').trim(),
    courseWorkId: String(mapeo.courseWorkId ?? '').trim(),
    corte: numero(mapeo.corte ?? metadata.corte),
    destinoColumna: String(mapeo.destinoColumna ?? metadata.destinoColumna ?? '').trim(),
    activo: mapeo.activo !== false && metadata.activo !== false
  };
}

function existeConfirmacionFaltante(metadata: Record<string, unknown>): boolean {
  return Boolean(metadata.faltanteClassroomConfirmado);
}

export function calcularColumnasFisicasParcial2(params: {
  alumnoId: string;
  evidencias: readonly EvidenciaListaParcial2[];
  mapeosClassroom: readonly MapeoListaClassroom[];
  calificacionesManuales: readonly CalificacionManualLista[];
  examenAutomatico?: unknown;
}): ColumnasFisicasParcial2 {
  const actividades = new Map(
    params.mapeosClassroom
      .map(mapearActividad)
      .filter((actividad) => actividad.activo && actividad.corte === 2 && actividad.destinoColumna === COLUMNA_TAREAS_PARCIAL_2)
      .map((actividad) => [`${actividad.courseId}:${actividad.courseWorkId}`, actividad])
  );

  const evidenciaPorActividad = new Map<string, EvidenciaListaParcial2>();
  for (const evidencia of params.evidencias) {
    if (String(evidencia.alumnoId ?? '').trim() !== params.alumnoId) continue;
    if (String(evidencia.fuente ?? '').trim().toLowerCase() !== 'classroom') continue;
    const classroom = objetoJson(evidencia.classroomData);
    const clave = `${String(classroom.courseId ?? '').trim()}:${String(classroom.courseWorkId ?? '').trim()}`;
    if (!actividades.has(clave)) continue;
    const previa = evidenciaPorActividad.get(clave);
    if (!previa || fechaTiempo(evidencia.updatedAt) >= fechaTiempo(previa.updatedAt)) evidenciaPorActividad.set(clave, evidencia);
  }

  let puntosObtenidos = 0;
  let puntosPosibles = 0;
  for (const evidencia of evidenciaPorActividad.values()) {
    const classroom = objetoJson(evidencia.classroomData);
    const metadata = objetoJson(evidencia.metadata);
    const posibles = numero(classroom.maxPoints);
    if (posibles === null || posibles <= 0) continue;

    const estado = String(classroom.submissionState ?? '').trim().toUpperCase();
    const faltaConfirmada = existeConfirmacionFaltante(metadata) && ['NEW', 'CREATED'].includes(estado);
    const gradePersistido = numero(evidencia.calificacionDecimal);
    const estadoCaptura = String(evidencia.estadoCaptura ?? '').trim().toLowerCase();
    if (!faltaConfirmada && (estadoCaptura !== 'calificada' || gradePersistido === null)) continue;

    // La nota persistida ya está normalizada a 0–10; revertirla a puntos conserva
    // el criterio de Classroom y evita usar ponderaciones configurables.
    const obtenidos = faltaConfirmada ? 0 : Math.max(0, Math.min(posibles, (gradePersistido as number) * posibles / 10));
    puntosObtenidos += obtenidos;
    puntosPosibles += posibles;
  }

  const promedioTareas = puntosPosibles > 0 ? round4(Math.max(0, Math.min(10, puntosObtenidos / puntosPosibles * 10))) : null;
  const manuales = params.calificacionesManuales.filter((fila) => String(fila.alumnoId ?? '').trim() === params.alumnoId);
  const practica = manuales.find((fila) => fila.componente === COLUMNA_PRACTICA_PARCIAL_2);
  const examen = manuales.find((fila) => fila.componente === COLUMNA_EXAMEN_PARCIAL_2);
  const notaPractica = numero(practica?.calificacion);
  const notaExamen = numero(examen?.calificacion);
  const notaExamenAutomatica = numero(params.examenAutomatico);
  const continua = promedioTareas !== null && notaPractica !== null
    ? round4(((promedioTareas * 0.6) + (notaPractica * 0.4)) / 2)
    : null;
  const segundoParcial = continua !== null && notaExamen !== null
    ? round4(Math.max(0, Math.min(10, continua + notaExamen)))
    : null;

  return {
    tareasYEjercicios2doParcial: valorTexto(promedioTareas),
    tareasPuntosObtenidos: puntosPosibles > 0 ? valorTexto(puntosObtenidos) : '',
    tareasPuntosPosibles: puntosPosibles > 0 ? valorTexto(puntosPosibles) : '',
    practica2doParcial: valorTexto(notaPractica),
    evaluacionContinua2doParcial: valorTexto(continua),
    examen2doParcial: valorTexto(notaExamen),
    examen2doParcialAutomatico: valorTexto(notaExamenAutomatica),
    calificacionSegundoParcial: valorTexto(segundoParcial),
    practica2doParcialVersion: numero(practica?.version),
    examen2doParcialVersion: numero(examen?.version)
  };
}
