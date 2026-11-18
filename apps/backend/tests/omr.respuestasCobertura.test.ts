import { describe, expect, it } from 'vitest';
import { respuestasCubrenReactivosEsperadosOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';

describe('cobertura exacta de reactivos OMR', () => {
  it('acepta una respuesta por cada identificador esperado, sin depender del orden', () => {
    expect(respuestasCubrenReactivosEsperadosOmr(
      [{ numeroPregunta: 3 }, { numeroPregunta: 1 }, { numeroPregunta: 2 }],
      [1, 2, 3]
    )).toBe(true);
  });

  it.each([
    ['pregunta duplicada y otra ausente', [{ numeroPregunta: 1 }, { numeroPregunta: 1 }, { numeroPregunta: 3 }], [1, 2, 3]],
    ['pregunta ausente', [{ numeroPregunta: 1 }, { numeroPregunta: 3 }], [1, 2, 3]],
    ['pregunta extra', [{ numeroPregunta: 1 }, { numeroPregunta: 2 }, { numeroPregunta: 4 }], [1, 2, 3]],
    ['número inválido', [{ numeroPregunta: 1 }, { numeroPregunta: 0 }], [1, 2]],
    ['mapa con identificador duplicado', [{ numeroPregunta: 1 }, { numeroPregunta: 2 }], [1, 1]],
    ['mapa vacío', [], []]
  ])('rechaza %s', (_caso, respuestas, esperados) => {
    expect(respuestasCubrenReactivosEsperadosOmr(respuestas, esperados)).toBe(false);
  });
});
