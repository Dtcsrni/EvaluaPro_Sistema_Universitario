import { describe, expect, it } from 'vitest';
import { convertirResultadoAPagina } from '../src/modulos/modulo_escaneo_omr/controladorJobsOmr.js';

const metricasConfiables = {
  estadoAnalisis: 'ok',
  calidadPagina: 0.99,
  confianzaPromedioPagina: 0.99,
  ratioAmbiguas: 0,
  motivosRevision: []
};

describe('clasificación de autocalificación en jobs OMR', () => {
  it('requiere revisión de la página si una respuesta individual es ambigua', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 2, opcion: null, confianza: 0.99, estadoRespuesta: 'ambigua' }
        ]
      }
    }, undefined, false, 2);

    expect(pagina.scanStatus).toBe('needs_review');
    expect(pagina.autoGradable).toBe(false);
    expect(pagina.manualReviewRequired).toBe(true);
    expect(pagina.exceptions.some(({ code }) => code === 'OMR_RESPUESTA_REQUIERE_REVISION')).toBe(true);
  });

  it('acepta una página solo cuando todas las respuestas individuales cumplen la política', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 2, opcion: null, confianza: 0.99, estadoRespuesta: 'sin_marca' }
        ]
      }
    }, undefined, false, 2);

    expect(pagina.scanStatus).toBe('accepted');
    expect(pagina.autoGradable).toBe(true);
    expect(pagina.manualReviewRequired).toBe(false);
  });

  it('mantiene la revisión manual completa para la plantilla experimental', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' }]
      }
    }, undefined, true, 1);

    expect(pagina.scanStatus).toBe('needs_review');
    expect(pagina.autoGradable).toBe(false);
    expect(pagina.exceptions.some(({ code }) => code === 'OMR_TEMPLATE_EXPERIMENTAL')).toBe(true);
  });
});
