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

  it('cuenta como incorrecta una respuesta ambigua sin opción cuando la página supera los controles globales', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0.2,
      coberturaDeteccion: 1,
      respuestasDetectadas: [
        { opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'B', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'C', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'D', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: null, confianza: 0.1, estadoRespuesta: 'ambigua' }
      ]
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it.each(['sin_marca', 'ambigua', 'doble_marca', 'tachada'] as const)(
    'permite calificar como incorrecta la respuesta %s sin opción cuando identidad y calidad son verificables',
    (estadoRespuesta) => {
      const resultado = evaluarAutoCalificableOmr({
        estadoAnalisis: 'ok',
        calidadPagina: 0.99,
        confianzaPromedioPagina: 0.99,
        ratioAmbiguas: estadoRespuesta === 'ambigua' ? 0.2 : 0,
        coberturaDeteccion: 1,
        respuestasDetectadas: [
          { opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
          { opcion: 'B', confianza: 0.99, estadoRespuesta: 'respondida' },
          { opcion: 'C', confianza: 0.99, estadoRespuesta: 'respondida' },
          { opcion: 'D', confianza: 0.99, estadoRespuesta: 'respondida' },
          { opcion: null, confianza: 0.1, estadoRespuesta }
        ]
      });

      expect(resultado.hardStop).toBe(false);
      expect(resultado.autoCalificableOmr).toBe(true);
    }
  );

  it('no permite contar como incorrecta una marca ambigua si trae una opción seleccionada', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0.2,
      coberturaDeteccion: 1,
      respuestasDetectadas: [
        { opcion: 'A', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'B', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'C', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'D', confianza: 0.99, estadoRespuesta: 'respondida' },
        { opcion: 'A', confianza: 0.1, estadoRespuesta: 'ambigua' }
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

