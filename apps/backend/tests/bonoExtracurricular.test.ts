import { describe, expect, it } from 'vitest';
import { calcularBonoExtracurricular } from '../src/modulos/modulo_analiticas/servicioBonoExtracurricular.js';

describe('calcularBonoExtracurricular', () => {
  it('suma medio punto al global aprobatorio', () => {
    expect(calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: 8 })).toMatchObject({
      aplicado: 0.5,
      noAplicado: 0,
      calificacionGlobalResultante: 8.5,
      omitidoPorGlobalReprobatorio: false,
      omitidoPorGlobalDiez: false
    });
  });

  it('limita el bono al máximo 10 para globals de 9.5 o más', () => {
    expect(calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: 9.5 })).toMatchObject({
      aplicado: 0.5, noAplicado: 0, calificacionGlobalResultante: 10
    });
    expect(calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: 9.75 })).toMatchObject({
      aplicado: 0.25, noAplicado: 0.25, calificacionGlobalResultante: 10
    });
    expect(calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: 10 })).toMatchObject({
      aplicado: 0, noAplicado: 0.5, calificacionGlobalResultante: 10, omitidoPorGlobalDiez: true
    });
  });

  it('no aplica el bono si el global es reprobatorio o aún no existe', () => {
    expect(calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: 5.99 })).toMatchObject({
      aplicado: 0, noAplicado: 0.5, calificacionGlobalResultante: 5.99,
      omitidoPorGlobalReprobatorio: true
    });
    expect(calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: null })).toMatchObject({
      aplicado: 0, noAplicado: 0.5, calificacionGlobalResultante: null,
      omitidoPorGlobalReprobatorio: false, omitidoPorGlobalDiez: false
    });
  });

  it('admite retirar el bono con 0 y rechaza importes distintos de 0 o 0.5', () => {
    expect(calcularBonoExtracurricular({ bono: 0, calificacionGlobalBase: 8 }).calificacionGlobalResultante).toBe(8);
    expect(() => calcularBonoExtracurricular({ bono: 0.25, calificacionGlobalBase: 8 })).toThrow(RangeError);
    expect(() => calcularBonoExtracurricular({ bono: 1, calificacionGlobalBase: 8 })).toThrow(RangeError);
    expect(() => calcularBonoExtracurricular({ bono: 0.5, calificacionGlobalBase: 10.1 })).toThrow(RangeError);
  });
});
