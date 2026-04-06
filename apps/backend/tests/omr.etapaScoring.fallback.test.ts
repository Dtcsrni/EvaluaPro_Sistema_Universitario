import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAnalizarOmrCv, mockPreprocesar } = vi.hoisted(() => ({
  mockAnalizarOmrCv: vi.fn(),
  mockPreprocesar: vi.fn()
}));

vi.mock('../src/modulos/modulo_escaneo_omr/servicioOmrCv', () => ({
  analizarOmr: mockAnalizarOmrCv
}));

vi.mock('../src/modulos/modulo_escaneo_omr/infra/omrCvEngine', () => ({
  debeIntentarMotorCv: () => true,
  preprocesarImagenOmrCv: mockPreprocesar,
  describirErrorCv: () => 'cv backend unavailable'
}));

import { ejecutarEtapaScoring } from '../src/modulos/modulo_escaneo_omr/omr/scoring/etapaScoring';

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
      templateVersionDetectada: 3,
      confianzaPromedioPagina: 0.9,
      ratioAmbiguas: 0,
      engineVersion: 'omr-v3-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v1'
    });

    const contexto = await ejecutarEtapaScoring({
      imagenBase64: 'data:image/png;base64,AAAA',
      mapaPagina: { templateVersion: 3, preguntas: [] },
      margenMm: 10
    });

    const resultado = contexto.resultado as { motivosRevision: string[]; engineVersion: string };
    expect(resultado.engineVersion).toBe('omr-v3-cv');
    expect(resultado.motivosRevision.some((motivo) => motivo.startsWith('CV_PREPROCESO_REINTENTO:'))).toBe(true);
  });
});
