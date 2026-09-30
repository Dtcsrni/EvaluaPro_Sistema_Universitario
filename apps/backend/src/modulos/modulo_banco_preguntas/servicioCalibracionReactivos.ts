import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';

export type RespuestaReactivoCalibracion = {
  correcta: boolean;
  puntajeTotal: number;
  opcion: string | null;
};

export type ResultadoCalibracionReactivo = {
  respuestasValidas: number;
  aciertos: number;
  proporcionCorrecta: number | null;
  puntoBiserial: number | null;
  distractores: Record<string, number>;
  estadoEvidencia: 'sin_evidencia' | 'evidencia_insuficiente' | 'calibrado';
};

function media(valores: number[]) {
  return valores.length ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : 0;
}

function desviacionPoblacional(valores: number[], promedio: number) {
  if (valores.length === 0) return 0;
  return Math.sqrt(valores.reduce((suma, valor) => suma + ((valor - promedio) ** 2), 0) / valores.length);
}

/**
 * Calcula métricas descriptivas de una versión exacta del reactivo.
 * No acepta respuestas sin resultado OMR confirmado y no extrapola muestras.
 */
export function calcularCalibracionReactivo(respuestas: RespuestaReactivoCalibracion[]): ResultadoCalibracionReactivo {
  const validas = respuestas.filter((respuesta) => Number.isFinite(respuesta.puntajeTotal) && typeof respuesta.correcta === 'boolean');
  const aciertos = validas.filter((respuesta) => respuesta.correcta).length;
  const n = validas.length;
  const p = n > 0 ? aciertos / n : null;
  const distractores: Record<string, number> = {};
  for (const respuesta of validas) {
    const opcion = String(respuesta.opcion ?? '').trim().toUpperCase();
    if (opcion) distractores[opcion] = (distractores[opcion] ?? 0) + 1;
  }

  let puntoBiserial: number | null = null;
  if (n > 1 && p !== null && p > 0 && p < 1) {
    const puntajes = validas.map((respuesta) => respuesta.puntajeTotal);
    const promedio = media(puntajes);
    const sd = desviacionPoblacional(puntajes, promedio);
    if (sd > 0) {
      const correctas = validas.filter((respuesta) => respuesta.correcta).map((respuesta) => respuesta.puntajeTotal);
      const incorrectas = validas.filter((respuesta) => !respuesta.correcta).map((respuesta) => respuesta.puntajeTotal);
      puntoBiserial = ((media(correctas) - media(incorrectas)) / sd) * Math.sqrt(p * (1 - p));
    }
  }

  return {
    respuestasValidas: n,
    aciertos,
    proporcionCorrecta: p,
    puntoBiserial,
    distractores,
    estadoEvidencia: n === 0 ? 'sin_evidencia' : n < 30 ? 'evidencia_insuficiente' : 'calibrado'
  };
}

export async function registrarCalibracionReactivo(params: {
  docenteId: string;
  reactivoId: string;
  reactivoVersionId: string;
  cohorteKey: string;
  calificacionIds: string[];
}) {
  const { prisma } = await import('../../infraestructura/baseDatos/sqlite.js');
  const reactivo = await prisma.reactivo.findFirst({
    where: { id: params.reactivoId, docenteId: params.docenteId },
    include: { versiones: { include: { opciones: true } } }
  });
  if (!reactivo) throw new ErrorAplicacion('REACTIVO_NO_ENCONTRADO', 'Reactivo no encontrado', 404);
  if (reactivo.estado !== 'published') throw new ErrorAplicacion('REACTIVO_NO_PUBLICADO', 'Solo se puede calibrar un reactivo publicado', 409);
  const version = reactivo.versiones.find((item) => item.id === params.reactivoVersionId);
  if (!version) throw new ErrorAplicacion('REACTIVO_VERSION_NO_ENCONTRADA', 'La versión no pertenece al reactivo', 404);
  if (version.numeroVersion !== reactivo.versionActual) throw new ErrorAplicacion('REACTIVO_VERSION_NO_ACTUAL', 'La calibración debe referir la versión publicada actual', 409);
  const calificaciones = await prisma.calificacion.findMany({
    where: { id: { in: params.calificacionIds }, docenteId: params.docenteId },
    include: { examenGenerado: { select: { versionSet: true, mapaVariante: true } } }
  });
  if (calificaciones.length !== params.calificacionIds.length) {
    throw new ErrorAplicacion('CALIFICACION_NO_ENCONTRADA', 'Una o más calificaciones no existen para este docente', 404);
  }

  const respuestas: RespuestaReactivoCalibracion[] = [];
  const evidenciaValidaIds: string[] = [];
  for (const calificacion of calificaciones) {
    let auditoria: Record<string, unknown>;
    let versionSet: Array<Record<string, unknown>>;
    let mapaVariante: Record<string, unknown>;
    let respuestasDetectadas: Array<Record<string, unknown>>;
    try {
      auditoria = JSON.parse(String(calificacion.omrAuditoria ?? 'null')) as Record<string, unknown>;
      versionSet = JSON.parse(String(calificacion.examenGenerado.versionSet ?? '[]')) as Array<Record<string, unknown>>;
      mapaVariante = JSON.parse(String(calificacion.examenGenerado.mapaVariante ?? '{}')) as Record<string, unknown>;
      respuestasDetectadas = JSON.parse(String(calificacion.respuestasDetectadas ?? '[]')) as Array<Record<string, unknown>>;
    } catch {
      continue;
    }
    const omrAceptado = auditoria.estadoAnalisis === 'ok' && auditoria.autoCalificableOmr === true;
    const revisionConfirmada = auditoria.revisionConfirmada === true;
    if (!omrAceptado && !revisionConfirmada) continue;
    const versionExamen = Array.isArray(versionSet)
      ? versionSet.find((item) => item.reactivoVersionId === version.id && item.reactivoId === reactivo.id)
      : null;
    if (!versionExamen) continue;

    const preguntaId = String(versionExamen.preguntaId ?? '');
    const ordenPorPregunta = mapaVariante.ordenOpcionesPorPregunta as Record<string, unknown> | undefined;
    const ordenOpciones = Array.isArray(ordenPorPregunta?.[preguntaId])
      ? (ordenPorPregunta[preguntaId] as unknown[]).map(Number)
      : [0, 1, 2, 3, 4];
    const indiceCorrecto = version.opciones.findIndex((opcion) => opcion.esCorrecta);
    const posicionCorrecta = ordenOpciones.findIndex((indice) => indice === indiceCorrecto);
    if (posicionCorrecta < 0) continue;
    const opcionCorrectaPresentada = String.fromCharCode(65 + posicionCorrecta);
    const ordenPreguntas = Array.isArray(mapaVariante.ordenPreguntas) ? (mapaVariante.ordenPreguntas as unknown[]).map(String) : [];
    const numeroPregunta = ordenPreguntas.indexOf(preguntaId) + 1;
    if (numeroPregunta < 1) continue;
    const respuesta = respuestasDetectadas.find((item) => Number(item.numeroPregunta) === numeroPregunta);
    const opcion = typeof respuesta?.opcion === 'string' ? respuesta.opcion.toUpperCase() : null;
    if (!opcion || !['A', 'B', 'C', 'D', 'E'].includes(opcion)) continue;
    if (respuesta?.estadoRespuesta && respuesta.estadoRespuesta !== 'respondida') continue;
    const puntajeTexto = Number.parseFloat(calificacion.calificacionExamenFinalTexto);
    const puntajeTotal = calificacion.bloqueExamenesDecimal ?? (Number.isFinite(puntajeTexto) ? puntajeTexto : null);
    if (typeof puntajeTotal !== 'number' || !Number.isFinite(puntajeTotal)) continue;
    respuestas.push({ correcta: opcion === opcionCorrectaPresentada, puntajeTotal, opcion });
    evidenciaValidaIds.push(calificacion.id);
  }
  if (respuestas.length === 0) {
    throw new ErrorAplicacion('OMR_SIN_EVIDENCIA_UTIL', 'Las calificaciones no contienen respuestas OMR aceptadas de esta versión exacta', 422);
  }

  const resultado = calcularCalibracionReactivo(respuestas);
  const calibracion = await prisma.reactivoCalibracion.upsert({
    where: { reactivoVersionId_cohorteKey: { reactivoVersionId: version.id, cohorteKey: params.cohorteKey } },
    create: {
      reactivoId: reactivo.id,
      reactivoVersionId: version.id,
      cohorteKey: params.cohorteKey,
      respuestasValidas: resultado.respuestasValidas,
      aciertos: resultado.aciertos,
      proporcionCorrecta: resultado.proporcionCorrecta,
      puntoBiserial: resultado.puntoBiserial,
      distractoresJson: JSON.stringify(resultado.distractores),
      estadoEvidencia: resultado.estadoEvidencia,
      intervaloJson: JSON.stringify({ n: resultado.respuestasValidas, fuente: 'calificaciones_omr_aceptadas', calificacionIds: evidenciaValidaIds }),
      calculadoEn: new Date()
    },
    update: {
      respuestasValidas: resultado.respuestasValidas,
      aciertos: resultado.aciertos,
      proporcionCorrecta: resultado.proporcionCorrecta,
      puntoBiserial: resultado.puntoBiserial,
      distractoresJson: JSON.stringify(resultado.distractores),
      estadoEvidencia: resultado.estadoEvidencia,
      intervaloJson: JSON.stringify({ n: resultado.respuestasValidas, fuente: 'calificaciones_omr_aceptadas', calificacionIds: evidenciaValidaIds }),
      calculadoEn: new Date()
    }
  });
  return { calibracion, resultado };
}
