import { describe, expect, it } from 'vitest';
import { convertirResultadoAPagina } from '../src/modulos/modulo_escaneo_omr/controladorJobsOmr.js';

const metricasConfiables = {
  estadoAnalisis: 'ok',
  calidadPagina: 0.99,
  confianzaPromedioPagina: 0.99,
  ratioAmbiguas: 0,
  motivosRevision: []
};
const qrValido = 'QR:examen:pagina:1';
const identidadCompleta = [1, 2, 3, 4, 5];

describe('clasificación de autocalificación en jobs OMR', () => {
  it('cuenta una respuesta ambigua nula como incorrecta si los controles globales pasan', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        ratioAmbiguas: 0.2,
        qrTexto: qrValido,
        qrFuenteDeteccion: 'rotacion_pagina',
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 2, opcion: null, confianza: 0.55, estadoRespuesta: 'ambigua' },
          { numeroPregunta: 3, opcion: 'B', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 4, opcion: 'C', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 5, opcion: 'D', confianza: 0.99, estadoRespuesta: 'respondida' }
        ]
      }
    }, undefined, false, 5, identidadCompleta, true, qrValido);

    expect(pagina.scanStatus).toBe('accepted');
    expect(pagina.autoGradable).toBe(true);
    expect(pagina.manualReviewRequired).toBe(false);
  });

  it('acepta una página solo cuando todas las respuestas individuales cumplen la política', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        qrTexto: qrValido,
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 2, opcion: null, confianza: 0.99, estadoRespuesta: 'sin_marca' }
        ]
      }
    }, undefined, false, 2, [1, 2], true, qrValido);

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
    }, undefined, true, 1, [1], true, qrValido);

    expect(pagina.scanStatus).toBe('needs_review');
    expect(pagina.autoGradable).toBe(false);
    expect(pagina.exceptions.some(({ code }) => code === 'OMR_TEMPLATE_EXPERIMENTAL')).toBe(true);
  });

  it('deja en revisión una página con pregunta faltante o QR distinto al esperado', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        qrTexto: 'QR:otro-examen:pagina:1',
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' }]
      }
    }, undefined, false, 2, [1, 2], true, qrValido);

    expect(pagina.scanStatus).toBe('needs_review');
    expect(pagina.autoGradable).toBe(false);
  });
});
