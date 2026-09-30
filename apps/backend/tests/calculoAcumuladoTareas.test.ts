import { describe, expect, it } from 'vitest';
import { calcularAcumuladoTareasPonderadoPorPuntos } from '../src/modulos/modulo_integraciones_classroom/calculoAcumuladoTareas.js';

describe('calcularAcumuladoTareasPonderadoPorPuntos', () => {
  it('pondera por puntos posibles y devuelve escala de 0 a 10', () => {
    expect(
      calcularAcumuladoTareasPonderadoPorPuntos([
        { puntosObtenidos: 8, puntosPosibles: 10, calificada: true },
        { puntosObtenidos: 18, puntosPosibles: 20, calificada: true }
      ])
    ).toBe(8.6667);
  });

  it('excluye actividades no vencidas y actividades sin calificar', () => {
    expect(
      calcularAcumuladoTareasPonderadoPorPuntos([
        { puntosObtenidos: 5, puntosPosibles: 10, calificada: true },
        { puntosObtenidos: 0, puntosPosibles: 20, vencida: false, faltanteExplicito: true },
        { puntosObtenidos: 0, puntosPosibles: 30, calificada: false, vencida: true }
      ])
    ).toBe(5);
  });

  it('incluye como cero solo una actividad vencida confirmada explícitamente como faltante', () => {
    expect(
      calcularAcumuladoTareasPonderadoPorPuntos([
        { puntosObtenidos: 8, puntosPosibles: 10, calificada: true },
        { puntosPosibles: 10, vencida: true, faltanteExplicito: true },
        { puntosPosibles: 10, vencida: true, faltanteExplicito: false }
      ])
    ).toBe(4);
  });

  it('retorna null sin denominador válido y omite datos inválidos', () => {
    expect(
      calcularAcumuladoTareasPonderadoPorPuntos([
        { puntosObtenidos: 3, puntosPosibles: 0, calificada: true },
        { puntosObtenidos: Number.NaN, puntosPosibles: 10, calificada: true },
        { puntosObtenidos: -1, puntosPosibles: 10, calificada: true }
      ])
    ).toBeNull();
  });

  it('limita el resultado al rango acordado de 0 a 10', () => {
    expect(
      calcularAcumuladoTareasPonderadoPorPuntos([{ puntosObtenidos: 12, puntosPosibles: 10, calificada: true }])
    ).toBe(10);
  });
});
