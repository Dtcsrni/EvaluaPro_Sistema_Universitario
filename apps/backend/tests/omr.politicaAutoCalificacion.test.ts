import { describe, expect, it } from 'vitest';
import { evaluarAutoCalificableOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr';

describe('politicaAutoCalificacionOmr', () => {
  it('no autocalifica cuando hay hard-stop por ambiguedad extrema', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.95,
      confianzaPromedioPagina: 0.91,
      ratioAmbiguas: 0.98,
      coberturaDeteccion: 0.95
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
  });

  it('autocalifica cuando cumple señal base y estado ok', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.95,
      confianzaPromedioPagina: 0.9,
      ratioAmbiguas: 0.02,
      coberturaDeteccion: 1
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });
});

