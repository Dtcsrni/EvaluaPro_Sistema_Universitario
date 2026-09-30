/**
 * Distribución del bono extracurricular dentro de componentes con escala 0–5.
 * Mantiene una sola cantidad solicitada y respeta el tope de 10 por parcial.
 */

export type PreferenciaComponenteBono = 'examen' | 'continua';

export type ComponentesBonoExtracurricular = {
  examenGlobal: number | null;
  continuaGlobal: number | null;
  examenParcial2: number | null;
  continuaParcial2: number | null;
  examenParcial1: number | null;
  continuaParcial1: number | null;
};

export type AsignacionBonoExtracurricular = Record<keyof ComponentesBonoExtracurricular, number>;

export type DistribucionBonoExtracurricular = {
  solicitado: number;
  aplicado: number;
  noAplicado: number;
  omitidoPorFinalDiez: boolean;
  asignacion: AsignacionBonoExtracurricular;
  componentesResultantes: ComponentesBonoExtracurricular;
  totalesParciales: { global: number | null; parcial2: number | null; parcial1: number | null };
};

const ORDEN_PARCIALES = [
  ['examenGlobal', 'continuaGlobal'],
  ['examenParcial2', 'continuaParcial2'],
  ['examenParcial1', 'continuaParcial1']
] as const;
const MAXIMOS_COMPONENTE: Record<keyof ComponentesBonoExtracurricular, number> = {
  examenGlobal: 5,
  continuaGlobal: 5,
  examenParcial2: 5.25,
  continuaParcial2: 5,
  examenParcial1: 5,
  continuaParcial1: 5
};

function validarNota(nombre: keyof ComponentesBonoExtracurricular, nota: number | null): void {
  if (nota === null) return;
  const maximo = MAXIMOS_COMPONENTE[nombre];
  if (!Number.isFinite(nota) || nota < 0 || nota > maximo) {
    throw new RangeError(`${nombre} debe ser una calificación finita entre 0 y ${maximo}.`);
  }
}

function redondear(nota: number): number {
  return Math.round((nota + Number.EPSILON) * 10000) / 10000;
}

/**
 * Coloca el bono en el primer componente prioritario con espacio disponible.
 * Si el bono excede ese espacio, el remanente pasa al siguiente componente
 * prioritario; calificaciones nulas se omiten y nunca se convierten en cero.
 */
export function distribuirBonoExtracurricular(args: {
  bono: number;
  componentes: ComponentesBonoExtracurricular;
  calificacionFinalBase: number | null;
  preferencia: PreferenciaComponenteBono;
}): DistribucionBonoExtracurricular {
  const { bono, componentes, calificacionFinalBase, preferencia } = args;
  if (!Number.isFinite(bono) || bono < 0 || bono > 1) {
    throw new RangeError('El bono extracurricular debe estar entre 0 y 1 punto.');
  }
  if (preferencia !== 'examen' && preferencia !== 'continua') {
    throw new TypeError('La preferencia debe ser examen o continua.');
  }
  if (calificacionFinalBase !== null && (!Number.isFinite(calificacionFinalBase) || calificacionFinalBase < 0 || calificacionFinalBase > 10)) {
    throw new RangeError('La calificación final base debe estar entre 0 y 10.');
  }
  for (const nombre of Object.keys(componentes) as Array<keyof ComponentesBonoExtracurricular>) {
    validarNota(nombre, componentes[nombre]);
  }

  const asignacion: AsignacionBonoExtracurricular = {
    examenGlobal: 0,
    continuaGlobal: 0,
    examenParcial2: 0,
    continuaParcial2: 0,
    examenParcial1: 0,
    continuaParcial1: 0
  };
  const componentesResultantes = { ...componentes };
  let restante = bono;

  if (restante > 0 && !(calificacionFinalBase !== null && calificacionFinalBase >= 10)) {
    const ordenDentroDelParcial: readonly ('examen' | 'continua')[] = preferencia === 'continua'
      ? ['continua', 'examen']
      : ['examen', 'continua'];
    for (const grupo of ORDEN_PARCIALES) {
      for (const tipo of ordenDentroDelParcial) {
        const clave = grupo.find((componente) => componente.toLowerCase().includes(tipo));
        if (!clave) continue;
        const nota = componentes[clave];
        if (nota === null) continue;
        const aplicado = Math.min(restante, Math.max(0, MAXIMOS_COMPONENTE[clave] - nota));
        asignacion[clave] = redondear(aplicado);
        componentesResultantes[clave] = redondear(nota + aplicado);
        restante = redondear(restante - aplicado);
        if (restante <= 0) break;
      }
      if (restante <= 0) break;
    }
  }

  const total = (examen: number | null, continua: number | null) =>
    examen === null || continua === null ? null : redondear(Math.min(10, examen + continua));
  const aplicado = redondear(bono - restante);

  return {
    solicitado: bono,
    aplicado,
    noAplicado: restante,
    omitidoPorFinalDiez: calificacionFinalBase !== null && calificacionFinalBase >= 10,
    asignacion,
    componentesResultantes,
    totalesParciales: {
      global: total(componentesResultantes.examenGlobal, componentesResultantes.continuaGlobal),
      parcial2: total(componentesResultantes.examenParcial2, componentesResultantes.continuaParcial2),
      parcial1: total(componentesResultantes.examenParcial1, componentesResultantes.continuaParcial1)
    }
  };
}
