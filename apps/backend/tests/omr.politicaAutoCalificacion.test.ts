/**
 * omr.politicaAutoCalificacion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import { evaluarAutoCalificableOmr } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';

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

  it('bloquea la autocalificación si una respuesta individual sigue ambigua aunque los agregados pasen', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [
        { opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: null, confianza: 0.99, estadoRespuesta: 'ambigua' }
      ]
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
  });

  it('bloquea una opción individual débil aunque el promedio de página sea alto', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [
        { opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'B', confianza: 0.2, estadoRespuesta: 'respondida' }
      ]
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
  });

  it('bloquea la autocalificación si falta estado o confianza individual', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [
        { opcion: 'A', estadoRespuesta: 'respondida' },
        { opcion: 'B', confianza: 0.99 }
      ]
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
  });

});

