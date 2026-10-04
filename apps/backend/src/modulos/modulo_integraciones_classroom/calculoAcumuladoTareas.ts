/**
 * Calcula el promedio de actividades de tareas en escala 0-10,
 * ponderando cada calificación por sus puntos posibles.
 */
export type ActividadPuntosAcumulado = {
  puntosObtenidos?: unknown;
  puntosPosibles?: unknown;
  calificada?: boolean;
  vencida?: boolean;
  faltanteExplicito?: boolean;
};

function numeroFinito(valor: unknown): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  return valor;
}

export function calcularAcumuladoTareasPonderadoPorPuntos(
  actividades: readonly ActividadPuntosAcumulado[]
): number | null {
  let puntosObtenidos = 0;
  let puntosPosibles = 0;

  for (const actividad of actividades) {
    const posibles = numeroFinito(actividad.puntosPosibles);
    if (posibles === null || posibles <= 0) continue;

    if (actividad.faltanteExplicito === true && actividad.vencida === true) {
      puntosPosibles += posibles;
      continue;
    }

    if (actividad.calificada !== true) continue;

    const obtenidos = numeroFinito(actividad.puntosObtenidos);
    if (obtenidos === null || obtenidos < 0) continue;

    puntosObtenidos += obtenidos;
    puntosPosibles += posibles;
  }

  if (puntosPosibles === 0) return null;
  return Number(Math.max(0, Math.min(10, (puntosObtenidos / puntosPosibles) * 10)).toFixed(4));
}
