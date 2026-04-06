import { describe, expect, it } from 'vitest';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf';

describe('pdf renderer fallback', () => {
  it('usa pdf-lib-legacy por defecto en production sin navegador configurado', async () => {
    const prevEngine = process.env.EXAMEN_PDF_ENGINE;
    const prevExec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    const prevChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
    const prevNodeEnv = process.env.NODE_ENV;

    process.env.EXAMEN_PDF_ENGINE = 'auto';
    delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
    process.env.NODE_ENV = 'production';

    try {
      const resultado = await generarPdfExamen({
        titulo: 'Prod Preview',
        folio: 'PROD-001',
        preguntas: [
          {
            id: 'p1',
            enunciado: 'Pregunta prod',
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
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 4
      });

      expect(resultado.layoutEngine).toBe('pdf-lib-legacy');
      expect(resultado.pdfBytes.byteLength).toBeGreaterThan(1000);
    } finally {
      if (prevEngine === undefined) delete process.env.EXAMEN_PDF_ENGINE;
      else process.env.EXAMEN_PDF_ENGINE = prevEngine;

      if (prevExec === undefined) delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
      else process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = prevExec;

      if (prevChannel === undefined) delete process.env.PLAYWRIGHT_BROWSER_CHANNEL;
      else process.env.PLAYWRIGHT_BROWSER_CHANNEL = prevChannel;

      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it('usa pdf-lib-legacy cuando playwright no puede iniciar', async () => {
    const prevEngine = process.env.EXAMEN_PDF_ENGINE;
    const prevExec = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

    process.env.EXAMEN_PDF_ENGINE = 'playwright-html-v1';
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'Z:\\ruta\\inexistente\\chromium.exe';

    try {
      const resultado = await generarPdfExamen({
        titulo: 'Fallback Preview',
        folio: 'FALLBACK-001',
        preguntas: [
          {
            id: 'p1',
            enunciado: 'Pregunta fallback',
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
        },
        tipoExamen: 'parcial',
        totalPaginas: 1,
        margenMm: 10,
        templateVersion: 4
      });

      expect(resultado.layoutEngine).toBe('pdf-lib-legacy');
      expect(resultado.pdfBytes.byteLength).toBeGreaterThan(1000);
    } finally {
      if (prevEngine === undefined) delete process.env.EXAMEN_PDF_ENGINE;
      else process.env.EXAMEN_PDF_ENGINE = prevEngine;

      if (prevExec === undefined) delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
      else process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = prevExec;
    }
  });
});
