import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('pdf tv4 compatibilidad', () => {
  it('rechaza TV4 mientras la generación canónica siga fijada a TV3', async () => {
    await expect(
      generarPdfExamen({
        titulo: 'Compat TV4',
        folio: 'TV4-COMPAT-001',
        preguntas: [
          {
            id: 'p1',
            enunciado: 'Pregunta con 4 opciones',
            opciones: [
              { texto: 'A', esCorrecta: false },
              { texto: 'B', esCorrecta: true },
              { texto: 'C', esCorrecta: false },
              { texto: 'D', esCorrecta: false }
            ]
          }
        ],
        mapaVariante: {
          ordenPreguntas: ['p1'],
          ordenOpcionesPorPregunta: { p1: [1, 0, 2, 3] }
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 4
      })
    ).rejects.toThrow('Solo TV3 está soportado');
  });
});
