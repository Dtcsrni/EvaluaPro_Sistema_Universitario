import { describe, expect, it } from 'vitest';
import { calcularCalibracionReactivo } from '../src/modulos/modulo_banco_preguntas/servicioCalibracionReactivos.js';

describe('calibración descriptiva de reactivos', () => {
  it('distingue ausencia de evidencia y muestra insuficiente', () => {
    expect(calcularCalibracionReactivo([]).estadoEvidencia).toBe('sin_evidencia');
    expect(calcularCalibracionReactivo([{ correcta: true, puntajeTotal: 8, opcion: 'A' }]).estadoEvidencia).toBe('evidencia_insuficiente');
  });

  it('calcula dificultad, distractores y punto-biserial cuando hay variación', () => {
    const respuestas = Array.from({ length: 30 }, (_, index) => ({
      correcta: index < 18,
      puntajeTotal: index < 18 ? 9 : 5,
      opcion: index < 18 ? 'A' : 'B'
    }));
    const resultado = calcularCalibracionReactivo(respuestas);
    expect(resultado.estadoEvidencia).toBe('calibrado');
    expect(resultado.proporcionCorrecta).toBe(0.6);
    expect(resultado.distractores).toEqual({ A: 18, B: 12 });
    expect(resultado.puntoBiserial).toBeGreaterThan(0);
  });
});
