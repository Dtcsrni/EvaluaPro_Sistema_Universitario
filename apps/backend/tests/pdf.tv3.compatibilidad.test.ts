import { describe, expect, it } from 'vitest';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('pdf tv3 compatibilidad', () => {
  it('normaliza preguntas de 4 opciones a contrato TV3 de 5 opciones OMR', async () => {
    const resultado = await generarPdfExamen({
      titulo: 'Compat TV3',
      folio: 'TV3-COMPAT-001',
      preguntas: [
        {
          id: 'p1',
          enunciado: 'Pregunta con 4 opciones',
          opciones: [
            { texto: 'A', esCorrecta: true },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false }
          ]
        }
      ],
      mapaVariante: {
        ordenPreguntas: ['p1'],
        ordenOpcionesPorPregunta: { p1: [0, 1, 2, 3] }
      },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 10,
      templateVersion: 3
    });

    expect(resultado.mapaOmr.templateVersion).toBe(3);
    expect(resultado.mapaOmr.blockSpec?.opcionesPorPregunta).toBe(5);
    expect(resultado.mapaOmr.paginas[0]?.preguntas[0]?.opciones?.length ?? 0).toBe(5);
    const qrResumen = extraerResumenQrExamen(String(resultado.paginas[0]?.qrTexto ?? ''));
    expect(qrResumen?.templateVersion).toBe(3);
    expect(qrResumen?.variantHash).toBeTruthy();
    expect(qrResumen?.answerKeyHash).toBeTruthy();
  });

  it('rechaza preguntas con mas de 5 opciones por incompatibilidad TV3', async () => {
    await expect(
      generarPdfExamen({
        titulo: 'Compat TV3',
        folio: 'TV3-COMPAT-002',
        preguntas: [
          {
            id: 'p1',
            enunciado: 'Pregunta con 6 opciones',
            opciones: [
              { texto: 'A', esCorrecta: true },
              { texto: 'B', esCorrecta: false },
              { texto: 'C', esCorrecta: false },
              { texto: 'D', esCorrecta: false },
              { texto: 'E', esCorrecta: false },
              { texto: 'F', esCorrecta: false }
            ]
          }
        ],
        mapaVariante: {
          ordenPreguntas: ['p1'],
          ordenOpcionesPorPregunta: { p1: [0, 1, 2, 3, 4, 5] }
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 3
      })
    ).rejects.toThrow('TV4 soporta maximo 5');
  });
});
