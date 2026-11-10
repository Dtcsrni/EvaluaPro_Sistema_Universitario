/** Calcula el bono extracurricular aprobado para el global del tercer parcial. */

export type ResultadoBonoExtracurricular = {
  solicitado: number;
  aplicado: number;
  noAplicado: number;
  calificacionGlobalBase: number | null;
  calificacionGlobalResultante: number | null;
  omitidoPorGlobalReprobatorio: boolean;
  omitidoPorGlobalDiez: boolean;
};

const BONO_EXTRACURRICULAR = 0.5;
const MINIMO_APROBATORIO = 6;
const MAXIMO_GLOBAL = 10;

function redondear(nota: number): number {
  return Math.round((nota + Number.EPSILON) * 10000) / 10000;
}

/**
 * El docente solicita 0 o +0.5. El bono solo sube el global aprobado del
 * tercer parcial y se limita al espacio disponible hasta 10.
 */
export function calcularBonoExtracurricular(args: {
  bono: number;
  calificacionGlobalBase: number | null;
}): ResultadoBonoExtracurricular {
  const { bono, calificacionGlobalBase } = args;
  if (bono !== 0 && bono !== BONO_EXTRACURRICULAR) {
    throw new RangeError('El bono extracurricular solo admite 0 o 0.5 puntos.');
  }
  if (calificacionGlobalBase !== null && (!Number.isFinite(calificacionGlobalBase) || calificacionGlobalBase < 0 || calificacionGlobalBase > MAXIMO_GLOBAL)) {
    throw new RangeError('La calificación global base debe estar entre 0 y 10.');
  }

  const omitidoPorGlobalReprobatorio = calificacionGlobalBase !== null && calificacionGlobalBase < MINIMO_APROBATORIO;
  const omitidoPorGlobalDiez = calificacionGlobalBase !== null && calificacionGlobalBase >= MAXIMO_GLOBAL;
  const elegible = bono > 0 && calificacionGlobalBase !== null && !omitidoPorGlobalReprobatorio && !omitidoPorGlobalDiez;
  const aplicado = elegible ? redondear(Math.min(bono, MAXIMO_GLOBAL - calificacionGlobalBase)) : 0;
  const noAplicado = redondear(bono - aplicado);
  const calificacionGlobalResultante = calificacionGlobalBase === null
    ? null
    : redondear(Math.min(MAXIMO_GLOBAL, calificacionGlobalBase + aplicado));

  return {
    solicitado: bono,
    aplicado,
    noAplicado,
    calificacionGlobalBase,
    calificacionGlobalResultante,
    omitidoPorGlobalReprobatorio,
    omitidoPorGlobalDiez
  };
}
