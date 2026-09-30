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
  analizarOmr: mockAnalizarOmrCv
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
    expect(resultado.advertencias).toContain('Rescate por imagen original aplicado en 1 preguntas');
  });
});

type ResultadoOmrPrueba = {
  respuestasDetectadas: Array<{ opcion: string | null; flags: string[] }>;
  advertencias: string[];
};
