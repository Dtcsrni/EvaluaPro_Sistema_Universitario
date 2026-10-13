import { afterAll, describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { crearLectorPieOmr, leerReferenciaPieOmr, type LectorPieOmr } from '../src/modulos/modulo_escaneo_omr/infra/ocrPieOmr.js';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';

describe('E2E PDF generado a identidad OMR por OCR real', () => {
  let lector: LectorPieOmr | undefined;

  afterAll(async () => {
    await lector?.terminate();
  });

  it('genera y rasteriza el examen Carta y Tesseract lee ambas referencias de cada página', async () => {
    const preguntas = Array.from({ length: 24 }, (_, indice) => ({
      id: `ocr-e2e-${indice + 1}`,
      enunciado: `Pregunta ${indice + 1} para verificar el pie OCR del examen generado.`,
      opciones: [
        { texto: 'Opción A', esCorrecta: true },
        { texto: 'Opción B', esCorrecta: false },
        { texto: 'Opción C', esCorrecta: false },
        { texto: 'Opción D', esCorrecta: false },
        { texto: 'Opción E', esCorrecta: false }
      ]
    }));
    const ordenPreguntas = preguntas.map((pregunta) => pregunta.id);
    const examen = await generarPdfExamen({
      titulo: 'E2E OCR OMR',
      folio: 'FEEDFACE',
      preguntas,
      mapaVariante: {
        ordenPreguntas,
        ordenOpcionesPorPregunta: Object.fromEntries(ordenPreguntas.map((id) => [id, [0, 1, 2, 3, 4]]))
      },
      tipoExamen: 'parcial',
      totalPaginas: 1,
      margenMm: 10,
      templateVersion: 4
    });

    const paginasExamen = examen.mapaOmr.paginas.filter((pagina) => pagina.tipoPagina === 'examen');
    expect(paginasExamen.length).toBeGreaterThan(1);
    expect(examen.layoutEngine).toBe('pdf-lib-canonical');

    const parser = new PDFParse({ data: examen.pdfBytes });
    try {
      const lectorOcr = lector ??= await crearLectorPieOmr();
      for (const pagina of paginasExamen) {
        const captura = (await parser.getScreenshot({
          partial: [pagina.numeroPagina],
          desiredWidth: 1836,
          imageBuffer: true,
          imageDataUrl: true
        })).pages[0];
        expect(captura, `debe rasterizar la página ${pagina.numeroPagina}`).toBeDefined();
        const referencia = await leerReferenciaPieOmr(captura!.dataUrl, lectorOcr);
        expect(referencia, `Tesseract debe consensuar ambas regiones en la página ${pagina.numeroPagina}`)
          .toMatchObject({ folio: 'FEEDFACE', numeroPagina: paginasExamen.indexOf(pagina) + 1 });
        expect(referencia!.confianza).toBeGreaterThanOrEqual(75);
      }
    } finally {
      await parser.destroy();
    }
  }, 120_000);
});
