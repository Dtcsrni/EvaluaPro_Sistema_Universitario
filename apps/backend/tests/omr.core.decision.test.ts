import { describe, expect, it } from 'vitest';
import {
  calcularMetricasPregunta,
  type CentroOpcion,
  type EstadoImagenOmr,
  type EvaluarConOffsetResultado,
  type ParametrosBurbujaCore
} from '../src/modulos/modulo_escaneo_omr/omrCore';

type RasgoMock = {
  score: number;
  ratio: number;
  ratioCore: number;
  ratioMid: number;
  ratioRing: number;
  ringOnlyPenalty: number;
  radialMassRatio: number;
  anisotropy: number;
  centroidOffsetRatio: number;
  contraste: number;
  ringContrast: number;
  fillDelta: number;
  centerMean: number;
  ringMean: number;
  outerMean: number;
};

function crearEstado(): EstadoImagenOmr {
  const paramsBurbuja: ParametrosBurbujaCore = {
    radio: 7,
    ringInner: 9,
    ringOuter: 12,
    outerOuter: 15,
    paso: 1
  };
  return {
    gray: new Uint8ClampedArray(64),
    integral: new Uint32Array(81),
    width: 8,
    height: 8,
    escalaX: 1,
    paramsBurbuja
  };
}

function crearCentros(): CentroOpcion[] {
  return [
    { letra: 'A', punto: { x: 1, y: 1 } },
    { letra: 'B', punto: { x: 2, y: 1 } },
    { letra: 'C', punto: { x: 3, y: 1 } },
    { letra: 'D', punto: { x: 4, y: 1 } },
    { letra: 'E', punto: { x: 5, y: 1 } }
  ];
}

function crearResultado(scores: Array<{ letra: string; score: number }>): EvaluarConOffsetResultado {
  const orden = [...scores].sort((a, b) => b.score - a.score);
  return {
    mejorOpcion: orden[0]?.letra ?? null,
    mejorScore: orden[0]?.score ?? 0,
    segundoScore: orden[1]?.score ?? 0,
    scores: scores.map((item, index) => ({ ...item, x: index + 1, y: 1 }))
  };
}

function detectarDesdeMapa(rasgos: Record<string, RasgoMock>) {
  return (
    _gray: Uint8ClampedArray,
    _integral: Uint32Array,
    _width: number,
    _height: number,
    centro: { x: number; y: number }
  ) => {
    const letra = ['A', 'B', 'C', 'D', 'E'][Math.max(0, Math.min(4, Math.round(centro.x) - 1))]!;
    return rasgos[letra];
  };
}

describe('omrCore decision', () => {
  it('acepta una opcion dominante aunque la señal absoluta sea tenue', () => {
    const estado = crearEstado();
    const centros = crearCentros();
    const resultado = crearResultado([
      { letra: 'C', score: 0.22 },
      { letra: 'B', score: 0.08 },
      { letra: 'D', score: 0.06 },
      { letra: 'A', score: 0.05 },
      { letra: 'E', score: 0.04 }
    ]);
    const detectar = detectarDesdeMapa({
      A: { score: 0.05, ratio: 0.1, ratioCore: 0.05, ratioMid: 0.06, ratioRing: 0.04, ringOnlyPenalty: 0.01, radialMassRatio: 0.28, anisotropy: 1.4, centroidOffsetRatio: 0.12, contraste: 0.05, ringContrast: 0.02, fillDelta: 0.03, centerMean: 220, ringMean: 230, outerMean: 236 },
      B: { score: 0.08, ratio: 0.12, ratioCore: 0.08, ratioMid: 0.08, ratioRing: 0.05, ringOnlyPenalty: 0.02, radialMassRatio: 0.31, anisotropy: 1.5, centroidOffsetRatio: 0.1, contraste: 0.06, ringContrast: 0.02, fillDelta: 0.04, centerMean: 210, ringMean: 225, outerMean: 234 },
      C: { score: 0.22, ratio: 0.26, ratioCore: 0.33, ratioMid: 0.28, ratioRing: 0.05, ringOnlyPenalty: 0.01, radialMassRatio: 0.57, anisotropy: 1.15, centroidOffsetRatio: 0.07, contraste: 0.18, ringContrast: 0.08, fillDelta: 0.16, centerMean: 148, ringMean: 205, outerMean: 232 },
      D: { score: 0.06, ratio: 0.11, ratioCore: 0.07, ratioMid: 0.08, ratioRing: 0.04, ringOnlyPenalty: 0.01, radialMassRatio: 0.29, anisotropy: 1.4, centroidOffsetRatio: 0.12, contraste: 0.06, ringContrast: 0.03, fillDelta: 0.04, centerMean: 208, ringMean: 222, outerMean: 233 },
      E: { score: 0.04, ratio: 0.09, ratioCore: 0.05, ratioMid: 0.05, ratioRing: 0.03, ringOnlyPenalty: 0.01, radialMassRatio: 0.25, anisotropy: 1.3, centroidOffsetRatio: 0.11, contraste: 0.04, ringContrast: 0.02, fillDelta: 0.03, centerMean: 221, ringMean: 229, outerMean: 235 }
    });

    const metricas = calcularMetricasPregunta({
      estado,
      centros,
      resultado,
      mejorDx: 0,
      mejorDy: 0,
      umbrales: {
        scoreMin: 0.05,
        scoreStd: 0.6,
        strongScore: 0.06,
        secondRatio: 0.75,
        deltaMin: 0.012,
        minTopZScore: 0.8,
        ambiguityRatio: 0.99,
        minFillDelta: 0.08,
        minCenterGap: 10,
        minHybridConfidence: 0.35
      },
      detectarOpcion: detectar
    });

    expect(metricas.mejorOpcion).toBe('C');
    expect(metricas.dobleMarcada).toBe(false);
    expect(metricas.validacionAlternativas.alternativasConMarca).toBeLessThanOrEqual(1);
    expect(metricas.confianza).toBeGreaterThanOrEqual(0);
  });

  it('conserva doble marca cuando dos opciones muestran evidencia real similar', () => {
    const estado = crearEstado();
    const centros = crearCentros();
    const resultado = crearResultado([
      { letra: 'A', score: 0.24 },
      { letra: 'B', score: 0.22 },
      { letra: 'C', score: 0.06 },
      { letra: 'D', score: 0.05 },
      { letra: 'E', score: 0.04 }
    ]);
    const detectar = detectarDesdeMapa({
      A: { score: 0.24, ratio: 0.24, ratioCore: 0.31, ratioMid: 0.26, ratioRing: 0.05, ringOnlyPenalty: 0.02, radialMassRatio: 0.49, anisotropy: 1.2, centroidOffsetRatio: 0.08, contraste: 0.16, ringContrast: 0.07, fillDelta: 0.14, centerMean: 150, ringMean: 204, outerMean: 232 },
      B: { score: 0.22, ratio: 0.23, ratioCore: 0.29, ratioMid: 0.24, ratioRing: 0.05, ringOnlyPenalty: 0.02, radialMassRatio: 0.47, anisotropy: 1.25, centroidOffsetRatio: 0.09, contraste: 0.15, ringContrast: 0.07, fillDelta: 0.13, centerMean: 154, ringMean: 205, outerMean: 232 },
      C: { score: 0.06, ratio: 0.11, ratioCore: 0.07, ratioMid: 0.07, ratioRing: 0.04, ringOnlyPenalty: 0.01, radialMassRatio: 0.28, anisotropy: 1.5, centroidOffsetRatio: 0.14, contraste: 0.05, ringContrast: 0.02, fillDelta: 0.04, centerMean: 212, ringMean: 224, outerMean: 234 },
      D: { score: 0.05, ratio: 0.1, ratioCore: 0.06, ratioMid: 0.06, ratioRing: 0.04, ringOnlyPenalty: 0.01, radialMassRatio: 0.27, anisotropy: 1.5, centroidOffsetRatio: 0.15, contraste: 0.04, ringContrast: 0.02, fillDelta: 0.03, centerMean: 216, ringMean: 225, outerMean: 235 },
      E: { score: 0.04, ratio: 0.09, ratioCore: 0.05, ratioMid: 0.05, ratioRing: 0.03, ringOnlyPenalty: 0.01, radialMassRatio: 0.25, anisotropy: 1.4, centroidOffsetRatio: 0.15, contraste: 0.04, ringContrast: 0.02, fillDelta: 0.03, centerMean: 219, ringMean: 227, outerMean: 236 }
    });

    const metricas = calcularMetricasPregunta({
      estado,
      centros,
      resultado,
      mejorDx: 0,
      mejorDy: 0,
      umbrales: {
        scoreMin: 0.05,
        scoreStd: 0.6,
        strongScore: 0.06,
        secondRatio: 0.75,
        deltaMin: 0.012,
        minTopZScore: 0.8,
        ambiguityRatio: 0.99,
        minFillDelta: 0.08,
        minCenterGap: 10,
        minHybridConfidence: 0.35
      },
      detectarOpcion: detectar
    });

    expect(metricas.dobleMarcada).toBe(true);
    expect(metricas.confianza).toBe(0);
  });

  it('no trata como marca real alternativas altas contaminadas por borde o texto', () => {
    const estado = crearEstado();
    const centros = crearCentros();
    const resultado = crearResultado([
      { letra: 'D', score: 0.21 },
      { letra: 'A', score: 0.17 },
      { letra: 'B', score: 0.16 },
      { letra: 'C', score: 0.15 },
      { letra: 'E', score: 0.14 }
    ]);
    const detectar = detectarDesdeMapa({
      A: { score: 0.17, ratio: 0.14, ratioCore: 0.06, ratioMid: 0.09, ratioRing: 0.22, ringOnlyPenalty: 0.14, radialMassRatio: 0.18, anisotropy: 3.1, centroidOffsetRatio: 0.62, contraste: 0.07, ringContrast: 0.06, fillDelta: 0.03, centerMean: 185, ringMean: 203, outerMean: 223 },
      B: { score: 0.16, ratio: 0.13, ratioCore: 0.05, ratioMid: 0.08, ratioRing: 0.2, ringOnlyPenalty: 0.13, radialMassRatio: 0.17, anisotropy: 2.9, centroidOffsetRatio: 0.58, contraste: 0.07, ringContrast: 0.05, fillDelta: 0.03, centerMean: 186, ringMean: 203, outerMean: 223 },
      C: { score: 0.15, ratio: 0.12, ratioCore: 0.05, ratioMid: 0.07, ratioRing: 0.21, ringOnlyPenalty: 0.14, radialMassRatio: 0.16, anisotropy: 3.0, centroidOffsetRatio: 0.6, contraste: 0.07, ringContrast: 0.05, fillDelta: 0.03, centerMean: 187, ringMean: 203, outerMean: 223 },
      D: { score: 0.21, ratio: 0.21, ratioCore: 0.27, ratioMid: 0.23, ratioRing: 0.06, ringOnlyPenalty: 0.02, radialMassRatio: 0.48, anisotropy: 1.2, centroidOffsetRatio: 0.09, contraste: 0.15, ringContrast: 0.07, fillDelta: 0.13, centerMean: 152, ringMean: 205, outerMean: 233 },
      E: { score: 0.14, ratio: 0.11, ratioCore: 0.05, ratioMid: 0.07, ratioRing: 0.19, ringOnlyPenalty: 0.12, radialMassRatio: 0.18, anisotropy: 2.8, centroidOffsetRatio: 0.56, contraste: 0.06, ringContrast: 0.05, fillDelta: 0.03, centerMean: 189, ringMean: 204, outerMean: 223 }
    });

    const metricas = calcularMetricasPregunta({
      estado,
      centros,
      resultado,
      mejorDx: 0,
      mejorDy: 0,
      umbrales: {
        scoreMin: 0.05,
        scoreStd: 0.6,
        strongScore: 0.06,
        secondRatio: 0.75,
        deltaMin: 0.012,
        minTopZScore: 0.8,
        ambiguityRatio: 0.99,
        minFillDelta: 0.08,
        minCenterGap: 10,
        minHybridConfidence: 0.35
      },
      detectarOpcion: detectar
    });

    expect(metricas.mejorOpcion).toBe('D');
    expect(metricas.validacionAlternativas.alternativasConMarca).toBeLessThanOrEqual(1);
    expect(metricas.dobleMarcada).toBe(false);
  });
});
