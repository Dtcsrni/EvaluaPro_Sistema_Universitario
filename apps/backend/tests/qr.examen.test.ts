import { describe, expect, it } from 'vitest';
import { construirTextoQrExamenPagina, extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen';

describe('qr examen enriquecido', () => {
  it('incluye folio, pagina, template, hashes y ordenes de variante', () => {
    const qr = construirTextoQrExamenPagina({
      folio: 'FOLIO-TV4-001',
      numeroPagina: 2,
      templateVersion: 4,
      examId: 'EXAMEN-SEG-001',
      totalPreguntas: 16,
      preguntaDesde: 9,
      preguntaHasta: 16,
      questionIdsPagina: ['q9', 'q10'],
      mapaVariante: {
        ordenPreguntas: ['q9', 'q10'],
        ordenOpcionesPorPregunta: {
          q9: [2, 0, 1, 3, 4],
          q10: [4, 3, 2, 1, 0]
        }
      },
      preguntas: [
        {
          id: 'q9',
          enunciado: 'Pregunta 9',
          opciones: [
            { texto: 'A', esCorrecta: false },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: true },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        },
        {
          id: 'q10',
          enunciado: 'Pregunta 10',
          opciones: [
            { texto: 'A', esCorrecta: true },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        }
      ]
    });

    const resumen = extraerResumenQrExamen(qr);
    expect(resumen).not.toBeNull();
    expect(resumen?.folio).toBe('FOLIO-TV4-001');
    expect(resumen?.numeroPagina).toBe(2);
    expect(resumen?.templateVersion).toBe(4);
    expect(resumen?.keyId).toBeTruthy();
    expect(resumen?.examId).toBe('EXAMEN-SEG-001');
    expect(resumen?.totalPreguntas).toBe(16);
    expect(resumen?.preguntaDesde).toBe(9);
    expect(resumen?.preguntaHasta).toBe(16);
    expect(resumen?.variantHash).toMatch(/^[A-Z0-9]{12}$/);
    expect(resumen?.answerKeyHash).toMatch(/^[A-Z0-9]{12}$/);
    expect(resumen?.payloadSignature).toMatch(/^H1[A-Z0-9]{24}$/);
    expect(resumen?.payloadSignatureMode).toBe('hmac-v1');
    expect(resumen?.payloadSignatureValid).toBe(true);
    expect(resumen?.questionRefs).toHaveLength(2);
    expect(resumen?.optionOrders).toEqual(['20134', '43210']);
  });
});
