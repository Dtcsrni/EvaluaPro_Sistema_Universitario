/**
 * variantes.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de variantes y ordenes aleatorios.
import { describe, expect, it } from 'vitest';
import { generarVariante } from '../src/modulos/modulo_generacion_pdf/servicioVariantes.js';

describe('generarVariante', () => {
  it('crea ordenes con los mismos ids y opciones', () => {
    const preguntas = [
      { id: 'p1', enunciado: 'Q1', opciones: Array.from({ length: 5 }, (_v, i) => ({ texto: `O${i}`, esCorrecta: i === 0 })) },
      { id: 'p2', enunciado: 'Q2', opciones: Array.from({ length: 5 }, (_v, i) => ({ texto: `O${i}`, esCorrecta: i === 1 })) }
    ];

    const variante = generarVariante(preguntas);

    expect(variante.ordenPreguntas.sort()).toEqual(['p1', 'p2']);
    expect(Object.keys(variante.ordenOpcionesPorPregunta).sort()).toEqual(['p1', 'p2']);
    expect(variante.ordenOpcionesPorPregunta.p1.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(variante.ordenOpcionesPorPregunta.p2.sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('conserva la opción correcta al traducirla a la letra visible de cada versión', () => {
    const preguntas = [
      { id: 'p1', enunciado: 'Q1', opciones: Array.from({ length: 5 }, (_v, i) => ({ texto: `O${i}`, esCorrecta: i === 2 })) },
      { id: 'p2', enunciado: 'Q2', opciones: Array.from({ length: 5 }, (_v, i) => ({ texto: `O${i}`, esCorrecta: i === 4 })) }
    ];

    const variante = generarVariante(preguntas);

    for (const pregunta of preguntas) {
      const ordenVisible = variante.ordenOpcionesPorPregunta[pregunta.id];
      expect(ordenVisible).toHaveLength(pregunta.opciones.length);
      expect(new Set(ordenVisible).size).toBe(pregunta.opciones.length);
      const opcionesVisibles = ordenVisible.map((indice) => pregunta.opciones[indice]);
      expect(opcionesVisibles.filter((opcion) => opcion.esCorrecta)).toHaveLength(1);
      expect(opcionesVisibles[opcionesVisibles.findIndex((opcion) => opcion.esCorrecta)]?.esCorrecta).toBe(true);
    }
  });
});

