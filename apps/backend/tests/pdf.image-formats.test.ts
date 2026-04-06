import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('pdf question image formats', () => {
  it('renderiza imagen de pregunta en data URL webp', async () => {
    const webpBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 40, g: 130, b: 200 }
      }
    })
      .webp({ quality: 90 })
      .toBuffer();
    const imagenUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

    const resultado = await generarPdfExamen({
      titulo: 'Parcial Imagen',
      folio: 'IMG-WEBP-001',
      tipoExamen: 'parcial',
      totalPaginas: 1,
      preguntas: [
        {
          id: 'p1',
          enunciado: '**Pregunta con imagen**',
          imagenUrl,
          opciones: [
            { texto: 'A', esCorrecta: true },
            { texto: 'B', esCorrecta: false },
            { texto: 'C', esCorrecta: false },
            { texto: 'D', esCorrecta: false },
            { texto: 'E', esCorrecta: false }
          ]
        }
      ],
      mapaVariante: {
        ordenPreguntas: ['p1'],
        ordenOpcionesPorPregunta: { p1: [0, 1, 2, 3, 4] }
      }
    });

    expect(resultado.metricasLayout?.imagenesIntentadas).toBe(1);
    expect(resultado.metricasLayout?.imagenesRenderizadas).toBe(1);
    expect(resultado.metricasLayout?.imagenesFallidas).toBe(0);
    expect(resultado.mapaOmr.paginas[0]?.preguntas[0]?.imageRenderStatus).toBe('ok');
  });
});

