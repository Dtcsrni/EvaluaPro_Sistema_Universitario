/**
 * omr.politicaAutoCalificacion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { describe, expect, it } from 'vitest';
import {
  evidenciaOmrNoDiscriminante,
  evaluarAutoCalificableOmr,
  opcionParcialDominanteRecuperable,
  parcialDetectadaConFormaCircularFuerte,
  seleccionarMarcaLocalUnicaFuerteOmr
} from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';

describe('politicaAutoCalificacionOmr', () => {
  it('abstiene cuando el ruido llena varias opciones, pero conserva una señal débil aislada', () => {
    const respuesta = (scoresPorOpcion: Array<{
      opcion: string;
      score: number;
      fillRatioCore: number;
      nucleusFillRatio: number;
      markConfidence: number;
      contrasteCromaticoLocal?: number;
      margenCromatico?: number;
    }>) => ({ opcion: null, confianza: 0.5, estadoRespuesta: 'ambigua' as const, flags: [], scoresPorOpcion });
    const ruidoDistribuido = respuesta(['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
      opcion,
      score: opcion === 'E' ? 0.54 : 0.19,
      fillRatioCore: opcion === 'E' ? 0.75 : 0.4375,
      nucleusFillRatio: opcion === 'E' ? 0.82 : 0.35,
      markConfidence: opcion === 'E' ? 1 : 0.55,
      contrasteCromaticoLocal: -0.02,
      margenCromatico: -0.02
    })));
    const empateDebil = respuesta(['A', 'B', 'C', 'D', 'E'].map((opcion, indice) => ({
      opcion,
      score: [0.138, 0.154, 0.160, 0.187, 0.188][indice]!,
      fillRatioCore: [0.25, 0.188, 0.25, 0.25, 0.375][indice]!,
      nucleusFillRatio: [0, 0, 0.377, 0, 0.362][indice]!,
      markConfidence: [0.277, 0.293, 0.431, 0.366, 0.513][indice]!
    })));
    const marcaDebilUnica = respuesta(['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'D'
      ? { opcion, score: 0.13, fillRatioCore: 0.23, nucleusFillRatio: 0.08, markConfidence: 0.25 }
      : { opcion, score: 0.04, fillRatioCore: 0.12, nucleusFillRatio: 0.01, markConfidence: 0.08 }));
    const marcaAzulDominante = respuesta(['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
      opcion,
      score: opcion === 'B' ? 0.665 : 0.3,
      fillRatioCore: opcion === 'B' ? 1 : 0.65,
      nucleusFillRatio: opcion === 'B' ? 1 : 0.5,
      markConfidence: opcion === 'B' ? 1 : 0.75,
      contrasteCromaticoLocal: opcion === 'B' ? 0.128 : -0.02,
      margenCromatico: opcion === 'B' ? 0.105 : -0.1
    })));

    expect(evidenciaOmrNoDiscriminante(ruidoDistribuido)).toBe(true);
    expect(evidenciaOmrNoDiscriminante(empateDebil)).toBe(true);
    expect(evidenciaOmrNoDiscriminante(marcaDebilUnica)).toBe(false);
    expect(evidenciaOmrNoDiscriminante(marcaAzulDominante)).toBe(false);
  });

  it('recupera una única burbuja sólida tras una deriva geométrica local', () => {
    const senales = ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'C'
      ? { opcion, score: 0.94, fillRatioCore: 1, nucleusFillRatio: 1, contraste: 0.72, shapeCompactness: 0.74 }
      : { opcion, score: 0.02, fillRatioCore: 0.08, nucleusFillRatio: 0.02, contraste: 0.04, shapeCompactness: 0.03 });

    expect(seleccionarMarcaLocalUnicaFuerteOmr(senales)).toBe('C');
  });

  it('rechaza el rescate local si hay doble marca, señal parcial o tinta difusa', () => {
    const makeSenales = (segundaFuerte = false, debil = false) => ['A', 'B', 'C', 'D', 'E'].map((opcion, index) => {
      const fuerte = index === 1 || (segundaFuerte && index === 3);
      return {
        opcion,
        score: fuerte ? 0.93 : debil ? 0.22 : 0.02,
        fillRatioCore: fuerte ? 1 : debil ? 0.38 : 0.08,
        nucleusFillRatio: fuerte ? 1 : debil ? 0.22 : 0.02,
        contraste: fuerte ? 0.7 : debil ? 0.15 : 0.04,
        shapeCompactness: fuerte ? 0.72 : debil ? 0.18 : 0.03
      };
    });

    expect(seleccionarMarcaLocalUnicaFuerteOmr(makeSenales(true))).toBeNull();
    expect(seleccionarMarcaLocalUnicaFuerteOmr(makeSenales(false, true))).toBeNull();
    expect(seleccionarMarcaLocalUnicaFuerteOmr(makeSenales().slice(0, 4))).toBeNull();
  });

  it('recupera una marca parcial dominante solo cuando las alternativas son débiles', () => {
    const scoresPorOpcion = [
      { opcion: 'A', score: 0.131, fillRatioCore: 0.231, nucleusFillRatio: 0.081, centroidOffsetRatio: 0.2, markConfidence: 0.251, shapeCompactness: 0.211, contraste: 0.058, estadoMarca: 'parcial' },
      { opcion: 'B', score: 0.04, fillRatioCore: 0.15, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.08, shapeCompactness: 0.04, contraste: 0.03, estadoMarca: 'no_marcada' },
      { opcion: 'C', score: 0.95, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.1, markConfidence: 1, shapeCompactness: 0.47, contraste: 0.49, estadoMarca: 'marcada' },
      { opcion: 'D', score: 0.03, fillRatioCore: 0.15, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.07, shapeCompactness: 0.04, contraste: 0.03, estadoMarca: 'no_marcada' },
      { opcion: 'E', score: 0.02, fillRatioCore: 0.15, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.05, shapeCompactness: 0.04, contraste: 0.03, estadoMarca: 'no_marcada' }
    ];
    const ambigua = {
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion
    };

    expect(opcionParcialDominanteRecuperable(ambigua)).toBe('C');
    const conResiduoDifuso = {
      ...ambigua,
      scoresPorOpcion: ambigua.scoresPorOpcion.map((score) => score.opcion === 'A'
        ? { ...score, score: 0.08, fillRatioCore: 0.385, nucleusFillRatio: 0.135, markConfidence: 0.258, shapeCompactness: 0.062, contraste: 0.12 }
        : score)
    };
    expect(opcionParcialDominanteRecuperable(conResiduoDifuso)).toBe('C');
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{ ...ambigua, opcion: 'C', confianza: 1, estadoRespuesta: 'respondida' }]
    });
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('cuenta una señal débil recuperable cuando no hay otra opción claramente marcada', () => {
    const respuesta = {
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'D'
        ? { opcion, score: 0.13, fillRatioCore: 0.23, nucleusFillRatio: 0.08, centroidOffsetRatio: 0.2, markConfidence: 0.25, shapeCompactness: 0.21, contraste: 0.058, estadoMarca: 'parcial' }
        : { opcion, score: 0.04, fillRatioCore: 0.12, nucleusFillRatio: 0.01, centroidOffsetRatio: 0.2, markConfidence: 0.08, shapeCompactness: 0.04, contraste: 0.03, estadoMarca: 'no_marcada' })
    };
    expect(opcionParcialDominanteRecuperable(respuesta)).toBe('D');
  });

  it('prefiere la opción claramente marcada a otra con señal parcial más alta', () => {
    const respuesta = {
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'A'
        ? { opcion, score: 0.72, fillRatioCore: 0.43, nucleusFillRatio: 0.2, centroidOffsetRatio: 0.35, markConfidence: 0.4, shapeCompactness: 0.29, contraste: 0.18, estadoMarca: 'parcial' }
        : opcion === 'B'
          ? { opcion, score: 0.66, fillRatioCore: 0.78, nucleusFillRatio: 0.72, centroidOffsetRatio: 0.18, markConfidence: 0.82, shapeCompactness: 0.62, contraste: 0.28, estadoMarca: 'marcada' }
          : { opcion, score: 0.02, fillRatioCore: 0.05, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.04, shapeCompactness: 0.02, contraste: 0.02, estadoMarca: 'no_marcada' })
    };
    expect(opcionParcialDominanteRecuperable(respuesta)).toBe('B');
    expect(opcionParcialDominanteRecuperable({
      ...respuesta,
      estadoRespuesta: 'doble_marca',
      flags: ['parcial_detectada', 'doble_marca']
    })).toBe('B');
  });

  it('considera incorrecta una respuesta ambigua con dos marcas claras sin detener la página', () => {
    const scoresPorOpcion = ['A', 'B', 'C', 'D', 'E'].map((opcion) => {
      if (opcion === 'A' || opcion === 'B') {
        return { opcion, score: 0.74, fillRatioCore: 0.8, nucleusFillRatio: 0.7, centroidOffsetRatio: 0.2, markConfidence: 0.85, shapeCompactness: 0.55, contraste: 0.2, estadoMarca: 'marcada' };
      }
      return { opcion, score: 0.02, fillRatioCore: 0.05, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.04, shapeCompactness: 0.02, contraste: 0.02, estadoMarca: 'no_marcada' };
    });
    const respuesta = {
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion
    };

    expect(opcionParcialDominanteRecuperable(respuesta)).toBeNull();
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [respuesta]
    });
    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
    expect(resultado.motivos).not.toContain('marca_parcial_no_competitiva');
  });

  it('mantiene sin opción una ambigüedad sin señal visible y la permite puntuar como incorrecta', () => {
    const respuesta = {
      opcion: null,
      confianza: 0,
      estadoRespuesta: 'ambigua' as const,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
        opcion,
        score: 0,
        fillRatioCore: 0,
        nucleusFillRatio: 0,
        centroidOffsetRatio: 0.5,
        markConfidence: 0,
        shapeCompactness: 0,
        contraste: 0,
        estadoMarca: 'no_marcada'
      }))
    };

    expect(opcionParcialDominanteRecuperable(respuesta)).toBeNull();
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0.04,
      coberturaDeteccion: 1,
      respuestasDetectadas: [respuesta]
    });
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('no interpreta ruido muy débil como una respuesta', () => {
    const respuesta = {
      opcion: null,
      confianza: 0.5,
      estadoRespuesta: 'ambigua' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'D'
        ? { opcion, score: 0.05, fillRatioCore: 0.12, nucleusFillRatio: 0.01, centroidOffsetRatio: 0.2, markConfidence: 0.08, shapeCompactness: 0.04, contraste: 0.03, estadoMarca: 'parcial' }
        : { opcion, score: 0.02, fillRatioCore: 0.05, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0.04, shapeCompactness: 0.02, contraste: 0.02, estadoMarca: 'no_marcada' })
    };
    expect(opcionParcialDominanteRecuperable(respuesta)).toBeNull();
  });

  it('recupera una señal suficiente aunque sea débil y rechaza una doble marca real', () => {
    const makeScores = (primary: number, secondary: number) => ['A', 'B', 'C', 'D', 'E'].map((opcion, index) => ({
      opcion,
      score: index === 0 ? primary : index === 1 ? secondary : 0.01,
      fillRatioCore: index === 0 ? (primary < 0.75 ? 0.77 : 1) : index === 1 ? (secondary > 0.5 ? 0.8 : 0.23) : 0.15,
      nucleusFillRatio: index === 0 ? (primary < 0.75 ? 0.92 : 1) : index === 1 && secondary > 0.5 ? 0.9 : 0,
      centroidOffsetRatio: 0.1,
      markConfidence: index === 0 ? 1 : index === 1 && secondary > 0.5 ? 0.95 : 0.1,
      shapeCompactness: index === 0 ? 0.64 : index === 1 && secondary > 0.5 ? 0.48 : 0.04,
      contraste: index === 0 ? 0.4 : index === 1 && secondary > 0.5 ? 0.4 : 0.03,
      estadoMarca: 'marcada'
    }));
    const blankCandidate = {
      opcion: 'A', confianza: 1, estadoRespuesta: 'respondida' as const,
      flags: ['parcial_detectada'], scoresPorOpcion: makeScores(0.58, 0.19)
    };
    const doubleMark = {
      opcion: null, confianza: 0.5, estadoRespuesta: 'doble_marca' as const,
      flags: ['parcial_detectada', 'doble_marca'], scoresPorOpcion: makeScores(1, 0.91)
    };

    expect(opcionParcialDominanteRecuperable(blankCandidate)).toBe('A');
    expect(opcionParcialDominanteRecuperable(doubleMark)).toBeNull();
  });

  it('se abstiene cuando el anillo y una segunda señal central pueden venir del panel impreso', () => {
    const metrics = [
      { opcion: 'A', score: 0.54, fillRatioCore: 0.77, fillRatioRing: 0.42, nucleusFillRatio: 0.92, centroidOffsetRatio: 0.26, markConfidence: 1, shapeCompactness: 0.36, contraste: 0.23, estadoMarca: 'marcada' },
      { opcion: 'B', score: 0.22, fillRatioCore: 0.46, fillRatioRing: 0.21, nucleusFillRatio: 0.54, centroidOffsetRatio: 0.22, markConfidence: 0.63, shapeCompactness: 0.05, contraste: 0.12, estadoMarca: 'marcada' },
      ...['C', 'D', 'E'].map((opcion) => ({ opcion, score: 0.02, fillRatioCore: 0, fillRatioRing: 0, nucleusFillRatio: 0, centroidOffsetRatio: 0.2, markConfidence: 0, shapeCompactness: 0, contraste: 0, estadoMarca: 'no_marcada' }))
    ];
    expect(opcionParcialDominanteRecuperable({
      opcion: 'A',
      confianza: 1,
      estadoRespuesta: 'respondida',
      flags: ['parcial_detectada', 'bajo_contraste'],
      scoresPorOpcion: metrics
    })).toBeNull();
  });

  it('mantiene ambiguo un score parcial bajo y acepta el mínimo circular configurado', () => {
    const makeResponse = (score: number) => ({
      opcion: 'E',
      confianza: 1,
      estadoRespuesta: 'respondida' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
        opcion,
        score: opcion === 'E' ? score : 0.04,
        fillRatioCore: opcion === 'E' ? 0.769 : 0.15,
        nucleusFillRatio: opcion === 'E' ? 0.919 : 0,
        centroidOffsetRatio: opcion === 'E' ? 0.312 : 0.2,
        markConfidence: opcion === 'E' ? 1 : 0.1,
        shapeCompactness: opcion === 'E' ? 0.639 : 0.1,
        contraste: opcion === 'E' ? 0.257 : 0.05,
        softCoreContrast: opcion === 'E' ? 0.604 : 0.05,
        estadoMarca: opcion === 'E' ? 'marcada' : 'no_marcada'
      }))
    });

    expect(parcialDetectadaConFormaCircularFuerte(makeResponse(0.579))).toBe(false);
    expect(parcialDetectadaConFormaCircularFuerte(makeResponse(0.6))).toBe(true);
  });

  it('permite puntuar como incorrectas respuestas ambiguas si la página supera los controles globales', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.95,
      confianzaPromedioPagina: 0.91,
      ratioAmbiguas: 0.98,
      coberturaDeteccion: 0.95
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
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
    expect(resultado.motivos).toEqual([]);
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

  it('sigue bloqueando una página cuya confianza global indica que es irreconocible', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.95,
      confianzaPromedioPagina: 0.2,
      ratioAmbiguas: 0.98,
      coberturaDeteccion: 0.95
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
    expect(resultado.motivos).toContain('confianza_pagina_hard_stop');
  });

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
    expect(resultado.motivos).toContain('respuesta_estado_no_calificable');
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
    expect(resultado.motivos).toContain('confianza_reactivo_insuficiente');
  });

  it('bloquea una página si una respuesta emitida conserva la señal parcial detectada', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [
        { opcion: 'E', confianza: 1, estadoRespuesta: 'respondida', flags: ['parcial_detectada'] },
        { opcion: 'A', confianza: 1, estadoRespuesta: 'respondida', flags: [] }
      ]
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
    expect(resultado.motivos).toContain('marca_parcial_no_competitiva');
  });

  it('bloquea una segunda burbuja marcada con señal de relleno y núcleo aunque falte parcial_detectada', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'A',
        confianza: 1,
        estadoRespuesta: 'respondida',
        flags: [],
        scoresPorOpcion: [
          { opcion: 'A', score: 0.8723, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.1418, markConfidence: 1, shapeCompactness: 0.6732, contraste: 0.7704, estadoMarca: 'marcada' },
          { opcion: 'E', score: 0.36246, fillRatioCore: 0.6875, nucleusFillRatio: 1, centroidOffsetRatio: 0.3727, markConfidence: 0.9818, shapeCompactness: 0.2982, contraste: 0.3871, softCoreContrast: 0.531, estadoMarca: 'marcada' }
        ]
      }]
    });

    expect(resultado.hardStop).toBe(true);
    expect(resultado.autoCalificableOmr).toBe(false);
    expect(resultado.motivos).toContain('segunda_marca_con_evidencia');
  });

  it('puntúa como incorrecta una omisión aun cuando la evidencia local sea débil, si la página supera controles globales', () => {
    const page = {
      estadoAnalisis: 'ok' as const,
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1
    };
    const blank = {
      opcion: null,
      confianza: 0,
      estadoRespuesta: 'sin_marca' as const,
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
        opcion,
        score: 0,
        fillRatioCore: opcion === 'E' ? 0.13 : 0,
        nucleusFillRatio: 0,
        markConfidence: 0,
        estadoMarca: 'no_marcada'
      }))
    };

    expect(evaluarAutoCalificableOmr({ ...page, respuestasDetectadas: [blank] }).autoCalificableOmr).toBe(true);

    const señalDébil = evaluarAutoCalificableOmr({
      ...page,
      respuestasDetectadas: [{
        ...blank,
        scoresPorOpcion: blank.scoresPorOpcion.map((score) =>
          score.opcion === 'E' ? { ...score, score: 0.021 } : score
        )
      }]
    });
    expect(señalDébil.autoCalificableOmr).toBe(true);
    expect(señalDébil.motivos).toEqual([]);
  });

  it('tolera un residuo secundario disperso sin núcleo y claramente inferior a la marca principal', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'C',
        confianza: 1,
        estadoRespuesta: 'respondida',
        flags: ['parcial_detectada'],
        scoresPorOpcion: [
          { opcion: 'C', score: 0.98105, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.1253, markConfidence: 1, shapeCompactness: 0.6884, contraste: 0.8321, softCoreContrast: 0.975, estadoMarca: 'marcada' },
          { opcion: 'D', score: 0.15065, fillRatioCore: 0.25, nucleusFillRatio: 0, centroidOffsetRatio: 0.2478, markConfidence: 0.30005, shapeCompactness: 0.05328, contraste: 0.16137, softCoreContrast: 0.22127, estadoMarca: 'parcial' },
          { opcion: 'A', score: 0.034, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 0.547, markConfidence: 0, shapeCompactness: 0.00976, contraste: 0, softCoreContrast: 0, estadoMarca: 'parcial' },
          { opcion: 'E', score: 0.03065, fillRatioCore: 0.1875, nucleusFillRatio: 0, centroidOffsetRatio: 0.2206, markConfidence: 0.07143, shapeCompactness: 0.05492, contraste: 0, softCoreContrast: 0.01931, estadoMarca: 'parcial' },
          { opcion: 'B', score: 0.02817, fillRatioCore: 0.0625, nucleusFillRatio: 0, centroidOffsetRatio: 0.3132, markConfidence: 0.02008, shapeCompactness: 0.03562, contraste: 0, softCoreContrast: 0, estadoMarca: 'no_marcada' }
        ]
      }]
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('permite una marca centrada y completa si las señales parciales restantes son débiles y no compiten', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'C',
        confianza: 1,
        estadoRespuesta: 'respondida',
        flags: ['parcial_detectada'],
        scoresPorOpcion: [
          { opcion: 'C', score: 0.928, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.019, markConfidence: 1, shapeCompactness: 0.871, contraste: 0.681, estadoMarca: 'marcada' },
          { opcion: 'A', score: 0.08, fillRatioCore: 0.091, nucleusFillRatio: 0, centroidOffsetRatio: 0.44, markConfidence: 0.1, shapeCompactness: 0.12, contraste: 0.04, estadoMarca: 'no_marcada' },
          { opcion: 'B', score: 0.09, fillRatioCore: 0.182, nucleusFillRatio: 0.04, centroidOffsetRatio: 0.38, markConfidence: 0.2, shapeCompactness: 0.18, contraste: 0.07, estadoMarca: 'no_marcada' },
          { opcion: 'E', score: 0.161, fillRatioCore: 0.273, nucleusFillRatio: 0.459, centroidOffsetRatio: 0.14, markConfidence: 0.445, shapeCompactness: 0.34, contraste: 0.038, softCoreContrast: 0.069, estadoMarca: 'marcada' },
          { opcion: 'D', score: 0.101, fillRatioCore: 0.091, nucleusFillRatio: 0, centroidOffsetRatio: 0.338, markConfidence: 0.151, shapeCompactness: 0.12, contraste: 0.094, estadoMarca: 'parcial' }
        ]
      }]
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('tolera relleno secundario de hasta 32% solo si las demás señales no compiten', () => {
    const respuesta = {
      opcion: 'E',
      confianza: 1,
      estadoRespuesta: 'respondida' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: [
        { opcion: 'E', score: 1, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.129, markConfidence: 1, shapeCompactness: 0.802, contraste: 0.739, softCoreContrast: 0.889, estadoMarca: 'marcada' },
        { opcion: 'C', score: 0.177, fillRatioCore: 0.308, nucleusFillRatio: 0.216, centroidOffsetRatio: 0.16, markConfidence: 0.429, shapeCompactness: 0.238, contraste: 0, softCoreContrast: 0.097, estadoMarca: 'marcada' },
        { opcion: 'B', score: 0.135, fillRatioCore: 0.308, nucleusFillRatio: 0.568, centroidOffsetRatio: 0.195, markConfidence: 0.427, shapeCompactness: 0.614, contraste: 0.102, softCoreContrast: 0.168, estadoMarca: 'marcada' },
        { opcion: 'D', score: 0.117, fillRatioCore: 0.308, nucleusFillRatio: 0.486, centroidOffsetRatio: 0.199, markConfidence: 0.391, shapeCompactness: 0.636, contraste: 0.022, softCoreContrast: 0.09, estadoMarca: 'marcada' },
        { opcion: 'A', score: 0.03, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 0.7, markConfidence: 0, shapeCompactness: 0.03, contraste: 0, softCoreContrast: 0, estadoMarca: 'no_marcada' }
      ]
    };
    const page = {
      estadoAnalisis: 'ok' as const,
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1
    };

    const dentroDeMargen = evaluarAutoCalificableOmr({ ...page, respuestasDetectadas: [respuesta] });
    const fueraDeMargen = evaluarAutoCalificableOmr({
      ...page,
      respuestasDetectadas: [{
        ...respuesta,
        scoresPorOpcion: respuesta.scoresPorOpcion.map((score) =>
          score.opcion === 'C' ? { ...score, fillRatioCore: 0.321 } : score
        )
      }]
    });
    const nucleoDemasiadoFuerte = evaluarAutoCalificableOmr({
      ...page,
      respuestasDetectadas: [{
        ...respuesta,
        scoresPorOpcion: respuesta.scoresPorOpcion.map((score) =>
          score.opcion === 'B' ? { ...score, nucleusFillRatio: 0.601 } : score
        )
      }]
    });

    expect(dentroDeMargen.autoCalificableOmr).toBe(true);
    expect(fueraDeMargen.autoCalificableOmr).toBe(true);
    expect(fueraDeMargen.motivos).not.toContain('marca_parcial_no_competitiva');
    expect(nucleoDemasiadoFuerte.autoCalificableOmr).toBe(true);
  });

  it('acepta una marca clara aunque otra opción tenga señal parcial sin claridad', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'C',
        confianza: 1,
        estadoRespuesta: 'respondida',
        flags: ['parcial_detectada'],
        scoresPorOpcion: [
          { opcion: 'C', score: 0.88, fillRatioCore: 0.9, nucleusFillRatio: 0.9, centroidOffsetRatio: 0.1, markConfidence: 0.95, shapeCompactness: 0.7, contraste: 0.5, estadoMarca: 'marcada' },
          { opcion: 'B', score: 0.08, fillRatioCore: 0.1, nucleusFillRatio: 0.05, centroidOffsetRatio: 0.5, markConfidence: 0.1, shapeCompactness: 0.2, contraste: 0.04, estadoMarca: 'no_marcada' },
          { opcion: 'D', score: 0.09, fillRatioCore: 0.1, nucleusFillRatio: 0.05, centroidOffsetRatio: 0.5, markConfidence: 0.1, shapeCompactness: 0.2, contraste: 0.04, estadoMarca: 'no_marcada' },
          { opcion: 'E', score: 0.1, fillRatioCore: 0.1, nucleusFillRatio: 0.05, centroidOffsetRatio: 0.5, markConfidence: 0.1, shapeCompactness: 0.2, contraste: 0.04, estadoMarca: 'no_marcada' },
          { opcion: 'A', score: 0.31, fillRatioCore: 0.4, nucleusFillRatio: 0.2, centroidOffsetRatio: 0.2, markConfidence: 0.45, shapeCompactness: 0.3, contraste: 0.18, estadoMarca: 'marcada' }
        ]
      }]
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('rechaza candidatos incompletos o con métricas no finitas al rescatar una parcial', () => {
    const base = {
      estadoAnalisis: 'ok' as const,
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'C',
        confianza: 1,
        estadoRespuesta: 'respondida' as const,
        flags: ['parcial_detectada'],
        scoresPorOpcion: [
          { opcion: 'C', score: 0.928, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.019, markConfidence: 1, shapeCompactness: 0.871, contraste: 0.681, estadoMarca: 'marcada' },
          { opcion: 'E', score: 0.161, fillRatioCore: 0.273, nucleusFillRatio: 0.459, centroidOffsetRatio: 0.14, markConfidence: 0.445, shapeCompactness: 0.34, contraste: 0.038, estadoMarca: 'marcada' }
        ]
      }]
    };

    expect(evaluarAutoCalificableOmr(base).autoCalificableOmr).toBe(false);
    const metricasNoFinitas = ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
      opcion,
      score: opcion === 'C' ? Number.NaN : 0.05,
      fillRatioCore: opcion === 'C' ? 1 : 0.1,
      nucleusFillRatio: opcion === 'C' ? 1 : 0.05,
      centroidOffsetRatio: 0.1,
      markConfidence: opcion === 'C' ? 1 : 0.1,
      shapeCompactness: 0.7,
      contraste: 0.4,
      estadoMarca: opcion === 'C' ? 'marcada' : 'no_marcada'
    }));
    expect(evaluarAutoCalificableOmr({
      ...base,
      respuestasDetectadas: [{ ...base.respuestasDetectadas[0], scoresPorOpcion: metricasNoFinitas }]
    }).autoCalificableOmr).toBe(false);
  });

  it('acepta una marca clara aunque persistan señales débiles de anillo en alternativas', () => {
    const page = {
      estadoAnalisis: 'ok' as const,
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1
    };
    const respuesta = {
      opcion: 'A',
      confianza: 1,
      estadoRespuesta: 'respondida' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: [
        { opcion: 'A', score: 0.9174, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.0972, markConfidence: 1, shapeCompactness: 0.7075, contraste: 0.427, softCoreContrast: 0.4703, estadoMarca: 'marcada' },
        { opcion: 'B', score: 0.2458, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.2766, markConfidence: 0.4299, shapeCompactness: 0.1205, contraste: 0.1372, softCoreContrast: 0.0867, estadoMarca: 'parcial' },
        { opcion: 'E', score: 0.1722, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.2151, markConfidence: 0.3198, shapeCompactness: 0.1072, contraste: 0.1012, softCoreContrast: 0.0879, estadoMarca: 'parcial' },
        { opcion: 'D', score: 0.1635, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.234, markConfidence: 0.2996, shapeCompactness: 0.1138, contraste: 0.0935, softCoreContrast: 0.0774, estadoMarca: 'parcial' },
        { opcion: 'C', score: 0.1418, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.1813, markConfidence: 0.2723, shapeCompactness: 0.0987, contraste: 0.0849, softCoreContrast: 0.0816, estadoMarca: 'parcial' }
      ]
    };
    const respuestaConCompetidorCentral = {
      ...respuesta,
      scoresPorOpcion: respuesta.scoresPorOpcion.map((score) =>
        score.opcion === 'B' ? { ...score, nucleusFillRatio: 0.08, shapeCompactness: 0.16 } : score
      )
    };

    expect(evaluarAutoCalificableOmr({ ...page, respuestasDetectadas: [respuesta] }).autoCalificableOmr).toBe(true);
    const competidor = evaluarAutoCalificableOmr({ ...page, respuestasDetectadas: [respuestaConCompetidorCentral] });
    expect(competidor.autoCalificableOmr).toBe(true);
    expect(competidor.motivos).not.toContain('marca_parcial_no_competitiva');
  });

  it('conserva B en la pregunta 14 cuando A es residuo y C solo tiene señal débil', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'B',
        confianza: 1,
        estadoRespuesta: 'respondida',
        flags: ['parcial_detectada'],
        scoresPorOpcion: [
          { opcion: 'B', score: 0.8983598782276364, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.034944171512788676, markConfidence: 1, shapeCompactness: 0.8736656348428794, contraste: 0.4411673294026235, estadoMarca: 'marcada' },
          { opcion: 'C', score: 0.11102795753782672, fillRatioCore: 0.09090909090909091, nucleusFillRatio: 0, centroidOffsetRatio: 0.341096700753, markConfidence: 0.16812999724686647, shapeCompactness: 0.04505290743295098, contraste: 0.09726221490927366, estadoMarca: 'parcial' },
          { opcion: 'A', score: 0, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 0.48352483280138325, markConfidence: 0, shapeCompactness: 0.035103341920948154, contraste: 0, estadoMarca: 'no_marcada' },
          { opcion: 'D', score: 0, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 1, markConfidence: 0, shapeCompactness: 0, contraste: 0, estadoMarca: 'no_marcada' },
          { opcion: 'E', score: 0, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 1, markConfidence: 0, shapeCompactness: 0, contraste: 0, estadoMarca: 'no_marcada' }
        ]
      }]
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('deja la pregunta 19 sin opción ante ruido menor al piso y la cuenta incorrecta', () => {
    const sinMarca = {
      opcion: null,
      confianza: 0.45707,
      estadoRespuesta: 'ambigua' as const,
      flags: ['parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => opcion === 'C'
        ? { opcion, score: 0.0773, fillRatioCore: 0.09091, nucleusFillRatio: 0.10811, centroidOffsetRatio: 0.04714, markConfidence: 0.16569, shapeCompactness: 0.95286, contraste: 0.00671, estadoMarca: 'no_marcada' }
        : { opcion, score: 0, fillRatioCore: 0, nucleusFillRatio: 0, centroidOffsetRatio: 0, markConfidence: 0, shapeCompactness: 1, contraste: 0, estadoMarca: 'no_marcada' })
    };

    expect(opcionParcialDominanteRecuperable(sinMarca)).toBeNull();
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
        sinMarca
      ]
    });

    expect(resultado.hardStop).toBe(false);
    expect(resultado.autoCalificableOmr).toBe(true);
  });

  it('tolera un contorno secundario desplazado solo con una marca circular dominante', () => {
    const resultado = evaluarAutoCalificableOmr({
      estadoAnalisis: 'ok',
      calidadPagina: 0.99,
      confianzaPromedioPagina: 0.99,
      ratioAmbiguas: 0,
      coberturaDeteccion: 1,
      respuestasDetectadas: [{
        opcion: 'D',
        confianza: 1,
        estadoRespuesta: 'respondida',
        flags: ['parcial_detectada'],
        scoresPorOpcion: [
          { opcion: 'D', score: 0.9801, fillRatioCore: 1, nucleusFillRatio: 1, centroidOffsetRatio: 0.1486, markConfidence: 1, shapeCompactness: 0.684, contraste: 0.669, softCoreContrast: 0.83, estadoMarca: 'marcada' },
          { opcion: 'A', score: 0.2887, fillRatioCore: 0.4615, nucleusFillRatio: 0.7838, centroidOffsetRatio: 0.3801, markConfidence: 0.7463, shapeCompactness: 0.2195, contraste: 0.1393, softCoreContrast: 0.1262, estadoMarca: 'marcada' },
          { opcion: 'B', score: 0.2204, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.2092, markConfidence: 0.4024, shapeCompactness: 0.1089, contraste: 0.1284, softCoreContrast: 0.085, estadoMarca: 'parcial' },
          { opcion: 'E', score: 0.1547, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.2005, markConfidence: 0.2925, shapeCompactness: 0.103, contraste: 0.0912, softCoreContrast: 0.0795, estadoMarca: 'parcial' },
          { opcion: 'C', score: 0.1483, fillRatioCore: 0.1538, nucleusFillRatio: 0, centroidOffsetRatio: 0.1564, markConfidence: 0.2891, shapeCompactness: 0.0925, contraste: 0.0868, softCoreContrast: 0.0781, estadoMarca: 'parcial' }
        ]
      }]
    });

    expect(resultado.autoCalificableOmr).toBe(true);
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

