import { describe, expect, it } from 'vitest';
import { ordenarPreguntasParaCapacidad } from '../src/modulos/modulo_generacion_pdf/shared/controladorGeneracionPdfShared.js';

const preguntas = Array.from({ length: 18 }, (_, indice) => ({
  id: `reactivo-${indice + 1}`,
  tema: `Tema ${indice % 3 + 1}`,
  enunciado: `Enunciado con extensión equivalente ${String.fromCharCode(65 + indice)}`,
  opciones: ['A', 'B', 'C', 'D', 'E'].map((texto) => ({ texto }))
}));

describe('orden determinista de capacidad de reactivos', () => {
  it('reproduce exactamente la selección y orden para la misma semilla', () => {
    expect(ordenarPreguntasParaCapacidad(preguntas, 'exam-id-1'))
      .toEqual(ordenarPreguntasParaCapacidad(preguntas, 'exam-id-1'));
  });

  it('varía el orden por examen sin perder ni duplicar reactivos y distribuye temas', () => {
    const primera = ordenarPreguntasParaCapacidad(preguntas, 'exam-id-1');
    const segunda = ordenarPreguntasParaCapacidad(preguntas, 'exam-id-2');

    expect(primera.map(({ id }) => id)).not.toEqual(segunda.map(({ id }) => id));
    expect(new Set(primera.map(({ id }) => id))).toHaveProperty('size', preguntas.length);
    expect(new Set(segunda.map(({ id }) => id))).toHaveProperty('size', preguntas.length);
    expect(primera.slice(0, 9).map(({ tema }) => tema).sort())
      .toEqual(Array.from({ length: 3 }, (_, tema) => `Tema ${tema + 1}`).flatMap((tema) => Array(3).fill(tema)).sort());
  });
});
