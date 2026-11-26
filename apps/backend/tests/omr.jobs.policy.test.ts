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
  it.each(['ambigua', 'doble_marca', 'tachada'] as const)(
    'requiere revisión humana para una respuesta %s aunque pasen los controles globales',
    (estadoRespuesta) => {
      const pagina = convertirResultadoAPagina('folio', 1, {
        resultado: {
          ...metricasConfiables,
          qrTexto: qrValido,
          respuestasDetectadas: [
            { numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
            { numeroPregunta: 2, opcion: null, confianza: 0.99, estadoRespuesta },
            { numeroPregunta: 3, opcion: 'B', confianza: 0.99, estadoRespuesta: 'respondida' },
            { numeroPregunta: 4, opcion: 'C', confianza: 0.99, estadoRespuesta: 'respondida' },
            { numeroPregunta: 5, opcion: 'D', confianza: 0.99, estadoRespuesta: 'respondida' }
          ]
        }
      }, undefined, false, [1, 2, 3, 4, 5], identidadCompleta, true, qrValido);

      expect(pagina.scanStatus).toBe('needs_review');
      expect(pagina.autoGradable).toBe(false);
      expect(pagina.manualReviewRequired).toBe(true);
    }
  );

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
    }, undefined, false, [1, 2], [1, 2], true, qrValido);

    expect(pagina.scanStatus).toBe('accepted');
    expect(pagina.autoGradable).toBe(true);
    expect(pagina.manualReviewRequired).toBe(false);
  });

  it('conserva las cinco señales de cada respuesta para evaluar parciales en la página', () => {
    const scoresPorOpcion = ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'C'
      ? { opcion, score: 0.95, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.1, markConfidence: 1, shapeCompactness: 0.47, contraste: 0.49, estadoMarca: 'marcada' }
      : opcion === 'A'
        ? { opcion, score: 0.131, fillRatioCore: 0.231, nucleusFillRatio: 0.081, centroidOffsetRatio: 0.2, markConfidence: 0.251, shapeCompactness: 0.211, contraste: 0.058, estadoMarca: 'parcial' }
        : { opcion, score: 0.02, fillRatioCore: 0.05, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.04, shapeCompactness: 0.02, contraste: 0.02, estadoMarca: 'no_marcada' });
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        qrTexto: qrValido,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'C', confianza: 1, estadoRespuesta: 'respondida', flags: ['parcial_detectada'], scoresPorOpcion }]
      }
    }, undefined, false, [1], [1], true, qrValido);

    expect(pagina.autoGradable).toBe(true);
    expect(pagina.autoGradingEvidence?.[0]?.scoresPorOpcion).toHaveLength(5);
    expect(pagina.autoGradingEvidence?.[0]?.flags).toContain('parcial_detectada');
  });

  it('bloquea una respuesta con segunda marca clara aunque el resto de la página sea confiable', () => {
    const scoresPorOpcion = ['A', 'B', 'C', 'D', 'E'].map((opcion) => ['A', 'B'].includes(opcion)
      ? { opcion, score: 0.95, fillRatioCore: 0.9, nucleusFillRatio: 0.9, centroidOffsetRatio: 0.1, markConfidence: 0.95, shapeCompactness: 0.6, contraste: 0.3, estadoMarca: 'marcada' }
      : { opcion, score: 0.02, fillRatioCore: 0.05, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.04, shapeCompactness: 0.02, contraste: 0.02, estadoMarca: 'no_marcada' });
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        qrTexto: qrValido,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 1, estadoRespuesta: 'respondida', flags: [], scoresPorOpcion }]
      }
    }, undefined, false, [1], [1], true, qrValido);

    expect(pagina.autoGradable).toBe(false);
    expect(pagina.autoGradingEvidence?.[0]?.scoresPorOpcion).toHaveLength(5);
  });

  it('mantiene la revisión manual completa para la plantilla experimental', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' }]
      }
    }, undefined, true, [1], [1], true, qrValido);

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
    }, undefined, false, [1, 2], [1, 2], true, qrValido);

    expect(pagina.scanStatus).toBe('needs_review');
    expect(pagina.autoGradable).toBe(false);
  });

  it('no permite autocalificar con una pregunta duplicada aunque coincida el total', () => {
    const pagina = convertirResultadoAPagina('folio', 1, {
      resultado: {
        ...metricasConfiables,
        qrTexto: qrValido,
        respuestasDetectadas: [
          { numeroPregunta: 1, opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
          { numeroPregunta: 1, opcion: 'B', confianza: 0.99, estadoRespuesta: 'respondida' }
        ]
      }
    }, undefined, false, [1, 2], [1, 2], true, qrValido);

    expect(pagina.scanStatus).toBe('needs_review');
    expect(pagina.autoGradable).toBe(false);
  });
});
