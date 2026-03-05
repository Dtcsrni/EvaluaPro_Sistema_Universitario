import { describe, expect, it } from 'vitest';
import {
  POR_FOLIO_CANONICAL_ANSWER_KEY,
  POR_FOLIO_CANONICAL_QUESTION_COUNT,
  POR_FOLIO_CANONICAL_TEMPLATE_TITLE,
  POR_FOLIO_CANONICAL_TOPIC_NAME,
  buildPorFolioCanonicalSeed
} from '../src/modulos/modulo_banco_preguntas/porFolioCanonicalSeed';

describe('porFolioCanonicalSeed', () => {
  it('construye tema, banco y plantilla consistentes para seed', () => {
    const seed = buildPorFolioCanonicalSeed({
      docenteId: '507f1f77bcf86cd799439011',
      periodoId: '507f1f77bcf86cd799439012'
    });

    expect(seed.temaBanco.nombre).toBe(POR_FOLIO_CANONICAL_TOPIC_NAME);
    expect(seed.bancoPreguntas).toHaveLength(POR_FOLIO_CANONICAL_QUESTION_COUNT);
    expect(seed.examenPlantilla.titulo).toBe(POR_FOLIO_CANONICAL_TEMPLATE_TITLE);
    expect(seed.examenPlantilla.preguntasIds).toHaveLength(POR_FOLIO_CANONICAL_QUESTION_COUNT);
    expect(seed.questionOrder.map((item) => item.numeroPregunta)).toEqual(
      Array.from({ length: POR_FOLIO_CANONICAL_QUESTION_COUNT }, (_, index) => index + 1)
    );
  });

  it('marca exactamente una opcion correcta por pregunta', () => {
    const seed = buildPorFolioCanonicalSeed({
      docenteId: '507f1f77bcf86cd799439011',
      periodoId: '507f1f77bcf86cd799439012'
    });

    for (const pregunta of seed.bancoPreguntas) {
      const correctas = pregunta.versiones[0]?.opciones.filter((opcion) => opcion.esCorrecta) ?? [];
      expect(correctas).toHaveLength(1);
    }

    expect(POR_FOLIO_CANONICAL_ANSWER_KEY[12]).toBe('D');
    expect(POR_FOLIO_CANONICAL_ANSWER_KEY[14]).toBe('E');
    expect(POR_FOLIO_CANONICAL_ANSWER_KEY[16]).toBe('C');
  });
});
