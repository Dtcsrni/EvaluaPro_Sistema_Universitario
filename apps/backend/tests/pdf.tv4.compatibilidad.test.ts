import { describe, expect, it } from 'vitest';
import { extraerResumenQrExamen } from '../src/modulos/modulo_generacion_pdf/domain/qrExamen';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('pdf tv4 compatibilidad', () => {
  it('genera TV4 manteniendo contrato OMR enriquecido', async () => {
    const resultado = await generarPdfExamen({
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
    });

    expect(resultado.mapaOmr.templateVersion).toBe(4);
    expect(resultado.mapaOmr.paginas[0]?.preguntas[0]?.opciones?.length ?? 0).toBe(5);
    const qrResumen = extraerResumenQrExamen(String(resultado.paginas[0]?.qrTexto ?? ''));
    expect(qrResumen?.templateVersion).toBe(4);
    expect(qrResumen?.variantHash).toBeTruthy();
    expect(qrResumen?.answerKeyHash).toBeTruthy();
  });
});
