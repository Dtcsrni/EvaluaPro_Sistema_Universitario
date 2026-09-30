import { describe, expect, it } from 'vitest';
import { proyectarRespuestaParaRevisionOmr } from '../src/modulos/modulo_escaneo_omr/omr/decision/respuestaRevision.js';

describe('respuesta OMR para revisión GUI/API', () => {
  it('conserva el estado y devuelve las tres candidatas principales con valores acotados', () => {
    const resultado = proyectarRespuestaParaRevisionOmr({
      numeroPregunta: 12,
      opcion: null,
      confianza: 1.4,
      estadoRespuesta: 'doble_marca',
      flags: ['doble_marca', 'fuente_desconocida', 'bajo_contraste', 'doble_marca'],
      scoresPorOpcion: [
        { opcion: 'A', score: 0.2, fillRatioCore: 0.4, estadoMarca: 'parcial' },
        { opcion: 'B', score: 0.83, fillRatioCore: 0.6, estadoMarca: 'marcada' },
        { opcion: 'C', score: 0.83, fillRatioCore: 1.1, estadoMarca: 'tachada' },
        { opcion: 'D', score: -0.2, fillRatioCore: 0, estadoMarca: 'inventada' },
        { opcion: 'E', score: 0.1, fillRatioCore: 0.1, estadoMarca: 'no_marcada' }
      ]
    });

    expect(resultado).toEqual({
      numeroPregunta: 12,
      opcion: null,
      opcionDetectada: null,
      confianza: 1,
      estadoRespuesta: 'doble_marca',
      flags: ['bajo_contraste', 'doble_marca'],
      candidatas: [
        { opcion: 'B', score: 0.83, fillRatioCore: 0.6, estadoMarca: 'marcada' },
        { opcion: 'C', score: 0.83, fillRatioCore: 1, estadoMarca: 'tachada' },
        { opcion: 'A', score: 0.2, fillRatioCore: 0.4, estadoMarca: 'parcial' }
      ]
    });
  });

  it('rechaza campos mal formados sin romper la respuesta pública', () => {
    expect(proyectarRespuestaParaRevisionOmr({
      numeroPregunta: '2.8', opcion: 'z', confianza: 'NaN', estadoRespuesta: 'desconocida',
      flags: ['secret'], scoresPorOpcion: [{ opcion: 'Z', score: 9 }]
    })).toEqual({
      numeroPregunta: 2,
      opcion: null,
      opcionDetectada: null,
      confianza: 0,
      flags: [],
      candidatas: []
    });
  });
});
