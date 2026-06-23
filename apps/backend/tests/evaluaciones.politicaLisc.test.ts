/**
 * evaluaciones.politicaLisc.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import {
  calcularExamenCorte,
  calcularPoliticaLisc,
  redondearFinalInstitucional
} from '../src/modulos/modulo_evaluaciones/servicioPoliticasCalificacion';

describe('politica LISC', () => {
  it('calcula examen de corte con 60/40 teorico-practico', () => {
    expect(calcularExamenCorte(8, [10, 8, 6])).toBe(8);
    expect(calcularExamenCorte(10, [])).toBe(6);
  });

  it('calcula bloques y final con pesos 20/20/60 y 50/50', () => {
    const resultado = calcularPoliticaLisc({
      continuaPorCorte: { c1: 8, c2: 9, c3: 10 },
      examenesPorCorte: { parcial1: 7, parcial2: 8, global: 9 },
      pesosGlobales: { continua: 0.5, examenes: 0.5 },
      pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 }
    });

    expect(resultado.bloqueContinuaDecimal).toBe(9.4);
    expect(resultado.bloqueExamenesDecimal).toBe(8.4);
    expect(resultado.finalDecimal).toBe(8.9);
    expect(resultado.finalRedondeada).toBe(9);
  });

  it('redondea solo final con regla institucional (<6 floor, >=6 half-up)', () => {
    expect(redondearFinalInstitucional(0)).toBe(0);
    expect(redondearFinalInstitucional(5.9)).toBe(5);
    expect(redondearFinalInstitucional(6.4)).toBe(6);
    expect(redondearFinalInstitucional(6.5)).toBe(7);
    expect(redondearFinalInstitucional(10)).toBe(10);
  });
});
