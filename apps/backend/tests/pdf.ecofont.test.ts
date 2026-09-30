import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';

describe('pdf ecofont', () => {
  it('usa Ecofont Vera Sans como única familia en texto normal y enriquecido', async () => {
    const preguntas = [{
      id: 'ecofont-1',
      enunciado: '**Pregunta** de verificación _tipográfica_ con `código`.',
      opciones: [
        { texto: '**Opción A**', esCorrecta: true },
        { texto: 'Opción B', esCorrecta: false },
        { texto: 'Opción C', esCorrecta: false },
        { texto: 'Opción D', esCorrecta: false },
        { texto: 'Opción E', esCorrecta: false }
      ]
    }];
    const resultado = await generarPdfExamen({
        titulo: 'Ecofont QA',
        folio: 'ECOFONT-QA-001',
        preguntas,
        mapaVariante: {
          ordenPreguntas: ['ecofont-1'],
          ordenOpcionesPorPregunta: { 'ecofont-1': [0, 1, 2, 3, 4] }
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 4
      });

    expect(resultado.layoutEngine).toBe('pdf-lib-canonical');
    const pdf = await PDFDocument.load(resultado.pdfBytes);
    const fuentesIncrustadas = pdf.context.enumerateIndirectObjects().filter(([, objeto]) => {
      return objeto instanceof PDFDict && objeto.has(PDFName.of('FontFile2'));
    });
    expect(fuentesIncrustadas.length).toBeGreaterThan(0);
    const fuentesRuns = new Set(
      resultado.mapaOmr.paginas
        .flatMap((pagina) => pagina.preguntas)
        .flatMap((pregunta) => pregunta.textRuns ?? [])
        .map((run) => run.fuente)
    );
    expect(fuentesRuns).toEqual(new Set(['Ecofont Vera Sans']));
  });
});
