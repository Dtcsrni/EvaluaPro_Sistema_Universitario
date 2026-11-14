/**
 * omr.etapaScoring.fallback.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAnalizarOmrCv, mockPreprocesar } = vi.hoisted(() => ({
  mockAnalizarOmrCv: vi.fn(),
  mockPreprocesar: vi.fn()
}));

vi.mock('../src/modulos/modulo_escaneo_omr/servicioOmrCv', () => ({
  analizarOmr: mockAnalizarOmrCv,
  aplicarAbstencionPorOrientacionOmr: (resultado: unknown) => resultado
}));

vi.mock('../src/modulos/modulo_escaneo_omr/infra/omrCvEngine', () => ({
  debeIntentarMotorCv: () => true,
  preprocesarImagenOmrCv: mockPreprocesar,
  describirErrorCv: () => 'cv backend unavailable'
}));

import { ejecutarEtapaScoring } from '../src/modulos/modulo_escaneo_omr/omr/scoring/etapaScoring.js';

describe('etapaScoring reintento tras fallo de preproceso CV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra motivo de reintento cuando falla el backend CV', async () => {
    mockPreprocesar.mockRejectedValue(new Error('cv backend unavailable'));
    mockAnalizarOmrCv.mockResolvedValue({
      respuestasDetectadas: [],
      advertencias: [],
      calidadPagina: 0.8,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.9,
      ratioAmbiguas: 0,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v1'
    });

    const contexto = await ejecutarEtapaScoring({
      imagenBase64: 'data:image/png;base64,AAAA',
      mapaPagina: { templateVersion: 4, preguntas: [] },
      margenMm: 10
    });

    const resultado = contexto.resultado as { motivosRevision: string[]; engineVersion: string };
    expect(resultado.engineVersion).toBe('omr-cv');
    expect(resultado.motivosRevision.some((motivo) => motivo.startsWith('CV_PREPROCESO_REINTENTO:'))).toBe(true);
  });

  it('pasa al motor CV el QR leído previamente por el pipeline para evitar una segunda búsqueda', async () => {
    mockPreprocesar.mockResolvedValue('imagen-preprocesada');
    mockAnalizarOmrCv.mockResolvedValue({
      respuestasDetectadas: [],
      advertencias: [],
      calidadPagina: 0.9,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 1,
      ratioAmbiguas: 0,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v1'
    });

    await ejecutarEtapaScoring({
      imagenBase64: 'imagen-original',
      mapaPagina: { templateVersion: 4, preguntas: [] },
      qrEsperado: 'EXAMEN:LOTE:FOLIO',
      qrTexto: 'EXAMEN:LOTE:FOLIO',
      margenMm: 10
    });

    expect(mockAnalizarOmrCv).toHaveBeenCalledOnce();
    expect(mockAnalizarOmrCv.mock.calls[0]?.[5]).toMatchObject({
      qrTextoPrevalidado: 'EXAMEN:LOTE:FOLIO'
    });
  });

  it('promueve la B claramente marcada sobre una señal residual y actualiza el resumen de ambigüedad', async () => {
    mockPreprocesar.mockResolvedValue('imagen-preprocesada');
    const scoresPorOpcion = ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'B'
      ? { opcion, score: 0.8983598782276364, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.0349, markConfidence: 1, shapeCompactness: 0.8737, contraste: 0.4412, estadoMarca: 'marcada' }
      : opcion === 'A'
        ? { opcion, score: 0.018, fillRatioCore: 0.04, nucleusFillRatio: 0, centroidOffsetRatio: 0.48, markConfidence: 0.06, shapeCompactness: 0.035, contraste: 0.02, estadoMarca: 'parcial' }
        : { opcion, score: 0, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 1, markConfidence: 0, shapeCompactness: 0, contraste: 0, estadoMarca: 'no_marcada' });
    mockAnalizarOmrCv.mockResolvedValue({
      respuestasDetectadas: [{
        numeroPregunta: 14,
        opcion: null,
        confianza: 0.5,
        estadoRespuesta: 'ambigua',
        flags: ['parcial_detectada'],
        scoresPorOpcion
      }],
      advertencias: [],
      calidadPagina: 0.99,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.5,
      ratioAmbiguas: 1,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      pageOrientationDetermined: true,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v1'
    });

    const contexto = await ejecutarEtapaScoring({
      imagenBase64: 'imagen-original',
      mapaPagina: { templateVersion: 4, preguntas: [] },
      margenMm: 10
    });

    const respuesta = (contexto.resultado as {
      respuestasDetectadas: Array<{ opcion: string | null; estadoRespuesta: string }>;
      ratioAmbiguas: number;
      confianzaPromedioPagina: number;
      resumenRespuestas: { reactivosRespondidos: number; reactivosAmbiguos: number };
    });
    expect(respuesta.respuestasDetectadas[0]).toMatchObject({ opcion: 'B', estadoRespuesta: 'respondida' });
    expect(respuesta.ratioAmbiguas).toBe(0);
    expect(respuesta.confianzaPromedioPagina).toBe(1);
    expect(respuesta.resumenRespuestas).toMatchObject({ reactivosRespondidos: 1, reactivosAmbiguos: 0 });
  });

  it('rescata una marca tenue desde la imagen original sin sustituir una doble marca', async () => {
    mockPreprocesar.mockResolvedValue('imagen-preprocesada');
    mockAnalizarOmrCv.mockImplementation(async (imagen: string) => ({
      respuestasDetectadas: [
        {
          numeroPregunta: 1,
          opcion: imagen === 'imagen-preprocesada' ? null : 'B',
          confianza: imagen === 'imagen-preprocesada' ? 0 : 0.92,
          scoresPorOpcion: [],
          flags: imagen === 'imagen-preprocesada' ? ['bajo_contraste'] : []
        },
        {
          numeroPregunta: 2,
          opcion: null,
          confianza: 0,
          scoresPorOpcion: [],
          flags: ['doble_marca']
        },
        {
          numeroPregunta: 3,
          opcion: null,
          confianza: 0.4,
          estadoRespuesta: 'doble_marca',
          scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'B'
            ? { opcion, score: 0.72, fillRatioCore: 0.78, nucleusFillRatio: 0.72, centroidOffsetRatio: 0.18, markConfidence: 0.82, shapeCompactness: 0.62, contraste: 0.28, estadoMarca: 'marcada' }
            : opcion === 'A'
              ? { opcion, score: 0.22, fillRatioCore: 0.24, nucleusFillRatio: 0.08, centroidOffsetRatio: 0.3, markConfidence: 0.25, shapeCompactness: 0.18, contraste: 0.06, estadoMarca: 'parcial' }
              : { opcion, score: 0.02, fillRatioCore: 0.05, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.04, shapeCompactness: 0.02, contraste: 0.02, estadoMarca: 'no_marcada' }),
          flags: ['doble_marca', 'parcial_detectada']
        }
      ],
      advertencias: [],
      calidadPagina: 0.8,
      estadoAnalisis: 'requiere_revision',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.46,
      ratioAmbiguas: 0.5,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v1'
    }));

    const contexto = await ejecutarEtapaScoring({
      imagenBase64: 'imagen-original',
      mapaPagina: { templateVersion: 4, preguntas: [] },
      margenMm: 10
    });

    const resultado = contexto.resultado as ResultadoOmrPrueba;
    expect(mockAnalizarOmrCv).toHaveBeenCalledTimes(2);
    expect(resultado.respuestasDetectadas[0]?.opcion).toBe('B');
    expect(resultado.respuestasDetectadas[1]?.opcion).toBeNull();
    expect(resultado.respuestasDetectadas[1]?.flags).toContain('doble_marca');
    expect(resultado.respuestasDetectadas[2]?.opcion).toBe('B');
    expect(resultado.respuestasDetectadas[2]?.flags).not.toContain('doble_marca');
    expect(resultado.advertencias).toContain('Rescate por imagen original aplicado en 1 preguntas');
  });
});

type ResultadoOmrPrueba = {
  respuestasDetectadas: Array<{ opcion: string | null; flags: string[] }>;
  advertencias: string[];
};
