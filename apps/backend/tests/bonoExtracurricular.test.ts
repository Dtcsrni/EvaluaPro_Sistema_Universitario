import { describe, expect, it } from 'vitest';
import { distribuirBonoExtracurricular } from '../src/modulos/modulo_analiticas/servicioBonoExtracurricular.js';

const componentesBase = {
  examenGlobal: 4.75,
  continuaGlobal: 4.9,
  examenParcial2: 4,
  continuaParcial2: 4,
  examenParcial1: 3,
  continuaParcial1: 3
};

describe('distribuirBonoExtracurricular', () => {
  it('respeta prioridad Global, P2, P1 y nunca supera 5 por componente ni 10 por parcial', () => {
    const resultado = distribuirBonoExtracurricular({
      bono: 1,
      componentes: componentesBase,
      calificacionFinalBase: 9,
      preferencia: 'examen'
    });

    expect(resultado.asignacion).toEqual({
      examenGlobal: 0.25,
      continuaGlobal: 0.1,
      examenParcial2: 0.65,
      continuaParcial2: 0,
      examenParcial1: 0,
      continuaParcial1: 0
    });
    expect(resultado.totalesParciales.global).toBe(10);
    expect(resultado.totalesParciales.parcial2).toBe(8.65);
    expect(resultado.totalesParciales.parcial1).toBe(6);
    expect(resultado.aplicado).toBe(1);
    expect(resultado.noAplicado).toBe(0);
  });

  it('prioriza evaluación continua antes que examen dentro de cada parcial', () => {
    const resultado = distribuirBonoExtracurricular({
      bono: 0.5,
      componentes: { ...componentesBase, examenGlobal: 4.5, continuaGlobal: 4.5 },
      calificacionFinalBase: 8,
      preferencia: 'continua'
    });

    expect(resultado.asignacion.continuaGlobal).toBe(0.5);
    expect(resultado.asignacion.examenGlobal).toBe(0);
    expect(resultado.totalesParciales.global).toBe(9.5);
  });

  it('no aplica el bono cuando la calificación final previa ya es 10', () => {
    const resultado = distribuirBonoExtracurricular({
      bono: 1,
      componentes: componentesBase,
      calificacionFinalBase: 10,
      preferencia: 'continua'
    });

    expect(resultado.omitidoPorFinalDiez).toBe(true);
    expect(resultado.aplicado).toBe(0);
    expect(resultado.noAplicado).toBe(1);
    expect(Object.values(resultado.asignacion).every((nota) => nota === 0)).toBe(true);
  });

  it('omite componentes sin calificación y deja como no aplicado lo que no cabe', () => {
    const resultado = distribuirBonoExtracurricular({
      bono: 1,
      componentes: {
        examenGlobal: null,
        continuaGlobal: 5,
        examenParcial2: 5,
        continuaParcial2: null,
        examenParcial1: null,
        continuaParcial1: null
      },
      calificacionFinalBase: null,
      preferencia: 'continua'
    });

    expect(resultado.asignacion).toEqual({
      examenGlobal: 0,
      continuaGlobal: 0,
      examenParcial2: 0.25,
      continuaParcial2: 0,
      examenParcial1: 0,
      continuaParcial1: 0
    });
    expect(resultado.aplicado).toBe(0.25);
    expect(resultado.noAplicado).toBe(0.75);
    expect(resultado.totalesParciales.parcial1).toBeNull();
  });

  it('rechaza cantidades, escalas o preferencias inválidas', () => {
    expect(() => distribuirBonoExtracurricular({ bono: 1.1, componentes: componentesBase, calificacionFinalBase: 9, preferencia: 'examen' })).toThrow(RangeError);
    expect(() => distribuirBonoExtracurricular({ bono: 0.5, componentes: { ...componentesBase, examenGlobal: 5.1 }, calificacionFinalBase: 9, preferencia: 'examen' })).toThrow(RangeError);
  });
});
