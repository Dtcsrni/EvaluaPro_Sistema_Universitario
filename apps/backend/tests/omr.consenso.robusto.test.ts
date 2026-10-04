/**
 * Casos de decision OMR v2 independientes de la clave de respuestas.
 */
import { describe, expect, it } from 'vitest';
import {
  fusionarRespuestaOmrV2,
  rescatarCandidataEstableEntrePasadas,
  rescatarCandidataEtiquetadaDebilEntrePasadas,
  rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas,
  type EvidenciaOpcionOmr,
  type EvidenciaRespuestaOmr
} from '../src/modulos/modulo_escaneo_omr/omr/decision/consensoRespuesta.js';
import {
  debeAceptarNucleoRobustoOmr,
  debeAceptarMarcaFaintOmr,
  debeAceptarCandidataCompactaOmr,
  debeAceptarCandidataFuerteOmr,
  debeAceptarDominanteAisladaConContrasteOmr,
  debeAceptarPuntoCentralAisladoOmr,
  debeAceptarRescateAltaResolucionOmr,
  rescatarMarcaAisladaPorRasgosOmr,
  debeReactivarGeometriaLocalTrasEscalaOmr,
  combinarRespuestasOmrSinPerderDeterminadas,
  debeUsarRescateAltaResolucionOmr,
  debeAbstenerseMarcaParcialOmr,
  debeEvaluarConsensoHomografiaEscalaOmr,
  debeEvaluarRescateAltaResolucionGeometriaLocalOmr,
  rescatarMarcaTenueConsensuadaEntrePasadasOmr,
  debeAceptarConsensoGeometriaAlternaOmr,
  tieneIntentoParcialPendienteOmr,
  debeUsarGeometriaLocalOmr,
  determinarOrientacionCapturaOmr,
  aplicarAbstencionPorOrientacionOmr,
  type RespuestaDetectadaOmr,
  type ResultadoOmr,
  type ScoreOpcionOmr
} from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import { PERFIL_OMR_CANONICO } from '../src/modulos/modulo_generacion_pdf/domain/layoutExamen.js';

function crearOpcion(opcion: string, score: number, marcada = false): EvidenciaOpcionOmr {
  return {
    opcion,
    score,
    fillRatioCore: marcada ? 0.88 : 0.04,
    fillRatioRing: marcada ? 0.08 : 0.03,
    shapeCompactness: marcada ? 0.86 : 0.2,
    markConfidence: marcada ? 0.9 : 0.05,
    estadoMarca: marcada ? 'marcada' : 'no_marcada'
  };
}

function crearEvidencia(
  opcion: string | null,
  scores: Partial<Record<'A' | 'B' | 'C' | 'D' | 'E', number>>,
  flags: string[] = [],
  confianza = 0.8
): EvidenciaRespuestaOmr {
  const letras = ['A', 'B', 'C', 'D', 'E'] as const;
  const max = Math.max(...letras.map((letra) => scores[letra] ?? 0));
  return {
    opcion,
    confianza,
    flags,
    scoresPorOpcion: letras.map((letra) => crearOpcion(letra, scores[letra] ?? 0, letra === opcion || (opcion == null && (scores[letra] ?? 0) === max && max > 0.45)))
  };
}

describe('consenso OMR v2', () => {
  it('no autocalifica candidatas parciales sin contraste central suficiente', () => {
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.185, fillRatioCore: 0.25, shapeCompactness: 0.3, centerDarknessDelta: 0.075, contrasteCromaticoLocal: 0.02, margenCromatico: 0.01 })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.523, fillRatioCore: 1, shapeCompactness: 0.834, centerDarknessDelta: 0.111, contrasteCromaticoLocal: 0, margenCromatico: 0 })).toBe(false);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.5, centerDarknessDelta: 0.15, contrasteCromaticoLocal: 0, margenCromatico: 0 })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.5, centerDarknessDelta: 0.274, contrasteCromaticoLocal: 0, margenCromatico: 0 })).toBe(false);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.5, centerDarknessDelta: 0.04, contrasteCromaticoLocal: 0.12, margenCromatico: 0.06 })).toBe(false);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.5, centerDarknessDelta: 0.04, contrasteCromaticoLocal: 0.12, margenCromatico: 0.03 })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.35, centerDarknessDelta: 0.04, contrasteCromaticoLocal: 0, margenCromatico: 0, markConfidence: 0.72, permitirConfianzaMarcada: true })).toBe(false);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.35, centerDarknessDelta: 0.04, contrasteCromaticoLocal: 0, margenCromatico: 0, markConfidence: 0.719, permitirConfianzaMarcada: true })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.349, centerDarknessDelta: 0.04, contrasteCromaticoLocal: 0, margenCromatico: 0, markConfidence: 0.97, permitirConfianzaMarcada: true })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ score: 0.15, fillRatioCore: 0.5, shapeCompactness: 0.5, centerDarknessDelta: 0.04, contrasteCromaticoLocal: 0, margenCromatico: 0, markConfidence: 0.97, permitirConfianzaMarcada: false })).toBe(true);
  });

  it('acepta una candidata parcial con núcleo aislado y abstiene si falta margen', () => {
    const candidata = {
      score: 0.18,
      fillRatioCore: 0.38,
      shapeCompactness: 0.16,
      centerDarknessDelta: 0.04,
      contrasteCromaticoLocal: 0,
      margenCromatico: 0,
      centroidOffsetRatio: 0.2,
      softCoreContrast: 0.08,
      markConfidence: 0.2,
      permitirConfianzaMarcada: true,
      fillCoreCompetitorScore: 0.08,
      fillCoreMargin: 0.1
    };
    expect(debeAbstenerseMarcaParcialOmr(candidata)).toBe(false);
    expect(debeAbstenerseMarcaParcialOmr({ ...candidata, score: 0.179 })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ ...candidata, fillCoreMargin: 0.079 })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ ...candidata, fillCoreCompetitorScore: 0.081 })).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ ...candidata, permitirConfianzaMarcada: false })).toBe(true);
  });

  it('conserva candidatas para revisión cuando falta orientación, sin habilitar autocalificación', () => {
    const resultado = aplicarAbstencionPorOrientacionOmr({
      respuestasDetectadas: [{
        numeroPregunta: 1,
        opcion: 'B',
        confianza: 0.88,
        flags: [],
        scoresPorOpcion: []
      }],
      advertencias: [],
      calidadPagina: 0.8,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.88,
      ratioAmbiguas: 0,
      engineVersion: 'omr-cv',
      geomQuality: 0.8,
      photoQuality: 0.8,
      decisionPolicy: 'conservadora_v2',
      pageOrientationDetermined: false,
      pageOrientationConflict: false
    });

    expect(resultado.respuestasDetectadas[0]?.opcion).toBe('B');
    expect(resultado.respuestasDetectadas[0]?.confianza).toBe(0.88);
    expect(resultado.estadoAnalisis).toBe('requiere_revision');
    expect(resultado.resumenRespuestas?.reactivosRespondidos).toBe(1);
    expect(resultado.advertencias.join(' ')).toMatch(/no es autocalificable/i);
  });

  it('anula candidatas ante conflicto explícito de orientación', () => {
    const resultado = aplicarAbstencionPorOrientacionOmr({
      respuestasDetectadas: [{ numeroPregunta: 1, opcion: 'B', confianza: 0.88, flags: [], scoresPorOpcion: [] }],
      advertencias: [],
      calidadPagina: 0.8,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.88,
      ratioAmbiguas: 0,
      engineVersion: 'omr-cv',
      geomQuality: 0.8,
      photoQuality: 0.8,
      decisionPolicy: 'conservadora_v2',
      pageOrientationDetermined: false,
      pageOrientationConflict: true
    });

    expect(resultado.respuestasDetectadas[0]?.opcion).toBeNull();
    expect(resultado.respuestasDetectadas[0]?.estadoRespuesta).toBe('ambigua');
  });

  it('acepta un rescate alternativo solo con evidencia centrada, separada y confiable', () => {
    const respuesta = {
      numeroPregunta: 7,
      opcion: 'B' as const,
      confianza: 0.91,
      flags: [] as Array<'doble_marca' | 'bajo_contraste' | 'fuera_roi' | 'parcial_detectada' | 'tachada_detectada'>,
      scoresPorOpcion: [
        {
          opcion: 'B' as const,
          score: 0.28,
          fillRatioCore: 0.71,
          fillRatioRing: 0.2,
          fillDelta: 0.2,
          contraste: 0.25,
          radialMassRatio: 0.5,
          centroidOffsetRatio: 0.19,
          centerDarknessDelta: 0.2,
          nucleusFillRatio: 0.99,
          nucleusDarknessDelta: 0.59,
          strokeLeakPenalty: 0,
          shapeCompactness: 0.38,
          markConfidence: 0.92,
          estadoMarca: 'marcada' as const
        },
        {
          opcion: 'A' as const,
          score: 0,
          fillRatioCore: 0,
          fillRatioRing: 0.2,
          fillDelta: 0,
          contraste: 0,
          radialMassRatio: 0,
          centroidOffsetRatio: 0,
          centerDarknessDelta: 0,
          nucleusFillRatio: 0,
          nucleusDarknessDelta: 0,
          strokeLeakPenalty: 0,
          shapeCompactness: 1,
          markConfidence: 0,
          estadoMarca: 'no_marcada' as const
        }
      ]
    };

    expect(debeAceptarRescateAltaResolucionOmr(respuesta)).toBe(true);
    expect(debeAceptarRescateAltaResolucionOmr({ ...respuesta, confianza: 0.42 })).toBe(false);
    expect(debeAceptarRescateAltaResolucionOmr({ ...respuesta, flags: ['doble_marca'] })).toBe(false);
    expect(debeAceptarRescateAltaResolucionOmr({
      ...respuesta,
      scoresPorOpcion: [{ ...respuesta.scoresPorOpcion[0], score: 0.19 }, respuesta.scoresPorOpcion[1]]
    })).toBe(false);
  });

  it('acepta una marca irregular localizada con contraste y margen, pero no un rayón débil', () => {
    const opciones = [
      { opcion: 'C' as const, score: 0.29, fillRatioCore: 0.19, fillRatioRing: 0.08, fillDelta: 0.1, contraste: 0.17, radialMassRatio: 0.13, centroidOffsetRatio: 0.23, centerDarknessDelta: 0, nucleusFillRatio: 0.4, nucleusDarknessDelta: 0.18, strokeLeakPenalty: 0.02, shapeCompactness: 0.46, markConfidence: 0.97, estadoMarca: 'parcial' as const },
      { opcion: 'A' as const, score: 0, fillRatioCore: 0, fillRatioRing: 0, fillDelta: 0, contraste: 0, radialMassRatio: 0, centroidOffsetRatio: 0, centerDarknessDelta: 0, nucleusFillRatio: 0, nucleusDarknessDelta: 0, strokeLeakPenalty: 0, shapeCompactness: 1, markConfidence: 0, estadoMarca: 'no_marcada' as const }
    ];
    const respuesta: RespuestaDetectadaOmr = {
      numeroPregunta: 5,
      opcion: 'C',
      confianza: 0.97,
      flags: ['parcial_detectada'],
      scoresPorOpcion: opciones
    };

    expect(debeAceptarRescateAltaResolucionOmr(respuesta)).toBe(true);
    expect(debeAceptarRescateAltaResolucionOmr({
      ...respuesta,
      scoresPorOpcion: [{ ...opciones[0], centroidOffsetRatio: 0.48 }, opciones[1]]
    })).toBe(false);
    expect(debeAceptarRescateAltaResolucionOmr({
      ...respuesta,
      scoresPorOpcion: [{ ...opciones[0], score: 0.12, shapeCompactness: 0.1 }, opciones[1]]
    })).toBe(false);
    expect(debeAceptarRescateAltaResolucionOmr({ ...respuesta, flags: ['doble_marca'] })).toBe(false);
    expect(debeAceptarRescateAltaResolucionOmr({
      ...respuesta,
      confianza: 0.971,
      scoresPorOpcion: [{ ...opciones[0], markConfidence: 0.538 }, opciones[1]]
    })).toBe(true);
  });

  it('activa rescate focalizado para un intento parcial pendiente, no para un blanco', () => {
    expect(tieneIntentoParcialPendienteOmr({ opcion: null, flags: ['bajo_contraste', 'parcial_detectada'] })).toBe(true);
    expect(tieneIntentoParcialPendienteOmr({ opcion: null, flags: [] })).toBe(false);
    expect(tieneIntentoParcialPendienteOmr({ opcion: 'C', flags: ['parcial_detectada'] })).toBe(false);
  });

  it('activa la segunda hipotesis de geometria si queda cualquier reactivo pendiente', () => {
    expect(debeUsarRescateAltaResolucionOmr('ok', 0.8)).toBe(true);
    expect(debeUsarRescateAltaResolucionOmr('ok', 1)).toBe(false);
    expect(debeUsarRescateAltaResolucionOmr('requiere_revision', 0.8)).toBe(false);
    expect(debeUsarRescateAltaResolucionOmr('ok', Number.NaN)).toBe(false);
  });

  it('limita escala alterna a paginas con homografia fiable y marcas pendientes', () => {
    const pagina = {
      qrTexto: undefined,
      geometryMode: 'homografia' as const,
      geometryReferencePoints: 4,
      geometryReferenceQuality: 0.974,
      respuestasDetectadas: [{
        numeroPregunta: 25,
        opcion: null,
        confianza: 0,
        flags: ['parcial_detectada'] as const,
        scoresPorOpcion: []
      }]
    };
    expect(debeEvaluarConsensoHomografiaEscalaOmr(pagina)).toBe(false);
    expect(debeEvaluarConsensoHomografiaEscalaOmr({ ...pagina, geometryMode: 'escala' })).toBe(true);
    expect(debeEvaluarConsensoHomografiaEscalaOmr({ ...pagina, qrTexto: 'qr-valido', geometryMode: 'escala' })).toBe(false);
    expect(debeEvaluarConsensoHomografiaEscalaOmr({ ...pagina, geometryReferencePoints: 3, geometryMode: 'escala' })).toBe(false);
    expect(debeEvaluarConsensoHomografiaEscalaOmr({ ...pagina, geometryReferenceQuality: 0.89, geometryMode: 'escala' })).toBe(false);
    expect(debeEvaluarConsensoHomografiaEscalaOmr({
      ...pagina,
      geometryMode: 'escala',
      respuestasDetectadas: [{ ...pagina.respuestasDetectadas[0], flags: [] }]
    })).toBe(false);
  });

  it('limita el pase local de alta resolucion a intentos pendientes con geometria confiable y no vacia', () => {
    const pagina = {
      qrTexto: undefined,
      geometryMode: 'escala' as const,
      geometryReferencePoints: 4,
      geometryReferenceQuality: 0.974,
      geometryLocalEnabled: true,
      resumenRespuestas: { examenVacio: false },
      respuestasDetectadas: [{
        numeroPregunta: 24,
        opcion: null,
        confianza: 0,
        flags: ['doble_marca', 'parcial_detectada'] as const,
        scoresPorOpcion: []
      }]
    };
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr(pagina)).toBe(true);
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr({ ...pagina, resumenRespuestas: { examenVacio: true } })).toBe(false);
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr({ ...pagina, geometryLocalEnabled: false })).toBe(false);
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr({ ...pagina, geometryReferencePoints: 3 })).toBe(false);
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr({ ...pagina, geometryReferenceQuality: 0.89 })).toBe(false);
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr({ ...pagina, qrTexto: 'qr-valido' })).toBe(false);
    expect(debeEvaluarRescateAltaResolucionGeometriaLocalOmr({
      ...pagina,
      respuestasDetectadas: [{ ...pagina.respuestasDetectadas[0], flags: [] }]
    })).toBe(false);
  });

  it('acepta el candidato local de alta resolucion solo para reactivos nulos y protege las respuestas existentes', () => {
    const scoreB = {
      opcion: 'B' as const,
      score: 0.293,
      fillRatioCore: 0.19,
      fillRatioRing: 0.31,
      fillDelta: 0.08,
      contraste: 0.351,
      radialMassRatio: 0.237,
      centroidOffsetRatio: 0.229,
      centerDarknessDelta: 0.08,
      nucleusFillRatio: 0.388,
      nucleusDarknessDelta: 0.023,
      strokeLeakPenalty: 0,
      shapeCompactness: 0.43,
      markConfidence: 0.561,
      estadoMarca: 'marcada' as const
    };
    const opcionVacia = (opcion: 'A' | 'C' | 'D' | 'E') => ({
      ...scoreB,
      opcion,
      score: 0,
      fillRatioCore: 0,
      fillRatioRing: 0.31,
      contraste: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0.9,
      shapeCompactness: 0,
      markConfidence: 0,
      estadoMarca: 'no_marcada' as const
    });
    const base: RespuestaDetectadaOmr[] = [
      { numeroPregunta: 1, opcion: 'D', confianza: 0.9, flags: [], scoresPorOpcion: [] },
      { numeroPregunta: 24, opcion: null, confianza: 0, flags: ['doble_marca', 'parcial_detectada'], scoresPorOpcion: [] }
    ];
    const candidataAlta: RespuestaDetectadaOmr[] = [{
      numeroPregunta: 24,
      opcion: 'B',
      confianza: 0.887,
      flags: [],
      scoresPorOpcion: [scoreB, ...(['A', 'C', 'D', 'E'] as const).map(opcionVacia)]
    }];

    expect(debeAceptarRescateAltaResolucionOmr(candidataAlta[0]!)).toBe(true);
    expect(combinarRespuestasOmrSinPerderDeterminadas(base, base, candidataAlta, new Set(), [], true)
      .map((respuesta) => respuesta.opcion)).toEqual(['D', 'B']);
  });

  it('promueve marca tenue solo con núcleo centrado repetido y sin votos competidores', () => {
    const score = (opcion: 'A' | 'B' | 'C' | 'D' | 'E', marcada: boolean): ScoreOpcionOmr => ({
      opcion,
      score: marcada ? 0.04 : 0,
      fillRatioCore: marcada ? 0.2 : 0,
      fillRatioRing: marcada ? 0.2 : 0,
      fillDelta: marcada ? 0.1 : 0,
      contraste: marcada ? 0.1 : 0,
      radialMassRatio: marcada ? 0.25 : 0,
      centroidOffsetRatio: marcada ? 0.25 : 1,
      centerDarknessDelta: marcada ? 0.04 : 0,
      centerMean: marcada ? 210 : 245,
      softCoreContrast: marcada ? 0.1 : 0,
      softCentroidOffsetRatio: marcada ? 0.2 : 1,
      ringMean: marcada ? 220 : 245,
      outerMean: 245,
      nucleusFillRatio: marcada ? 0.25 : 0,
      nucleusDarknessDelta: marcada ? 0.04 : 0,
      strokeLeakPenalty: 0,
      shapeCompactness: marcada ? 0.3 : 0,
      markConfidence: marcada ? 0.2 : 0,
      estadoMarca: marcada ? 'parcial' : 'no_marcada'
    });
    const pasada = (opcion: 'A' | 'B' | 'C' | 'D' | 'E'): RespuestaDetectadaOmr[] => [{
      numeroPregunta: 1,
      opcion: null,
      confianza: 0.2,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: (['A', 'B', 'C', 'D', 'E'] as const).map((letra) => score(letra, letra === opcion))
    }];
    const base = {
      respuestasDetectadas: pasada('E'),
      advertencias: [],
      calidadPagina: 0.95,
      estadoAnalisis: 'requiere_revision',
      motivosRevision: [],
      templateVersionDetectada: 4,
      confianzaPromedioPagina: 0.2,
      ratioAmbiguas: 1,
      engineVersion: 'omr-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v2',
      geometryMode: 'escala',
      geometryReferencePoints: 4,
      geometryReferenceQuality: 0.97,
      geometryLocalEnabled: true,
      resumenRespuestas: { examenVacio: false }
    } as unknown as ResultadoOmr;
    const mapa = {
      preguntas: [{
        numeroPregunta: 1,
        idPregunta: 'q1',
        opciones: (['A', 'B', 'C', 'D', 'E'] as const).map((letra, x) => ({ letra, x, y: 10 }))
      }]
    };

    const rescatada = rescatarMarcaTenueConsensuadaEntrePasadasOmr(base, [pasada('E'), pasada('E')], mapa);
    expect(rescatada.respuestasDetectadas[0]).toMatchObject({ opcion: 'E', confianza: 0.72, estadoRespuesta: 'respondida' });
    expect(rescatada.ratioAmbiguas).toBe(0);

    const unaSolaPasada = rescatarMarcaTenueConsensuadaEntrePasadasOmr(base, [pasada('E')], mapa);
    expect(unaSolaPasada.respuestasDetectadas[0].opcion).toBeNull();
    const discordantes = rescatarMarcaTenueConsensuadaEntrePasadasOmr(base, [pasada('E'), pasada('D')], mapa);
    expect(discordantes.respuestasDetectadas[0].opcion).toBeNull();
    const dobleAislada = pasada('A');
    dobleAislada[0].flags = ['doble_marca'];
    const unaPasadaRuidosa = rescatarMarcaTenueConsensuadaEntrePasadasOmr(base, [dobleAislada, pasada('E'), pasada('E')], mapa);
    expect(unaPasadaRuidosa.respuestasDetectadas[0].opcion).toBe('E');
    const dobleRepetida = rescatarMarcaTenueConsensuadaEntrePasadasOmr(base, [dobleAislada, dobleAislada, pasada('E'), pasada('E')], mapa);
    expect(dobleRepetida.respuestasDetectadas[0].opcion).toBeNull();
    const vacia = rescatarMarcaTenueConsensuadaEntrePasadasOmr({ ...base, resumenRespuestas: { examenVacio: true } }, [pasada('E'), pasada('E')], mapa);
    expect(vacia.respuestasDetectadas[0].opcion).toBeNull();
  });

  it('acepta escala alterna solo con acuerdo fuerte de la candidata homografica', () => {
    const crearScore = (opcion: 'A' | 'B' | 'C' | 'D' | 'E', datos: Partial<RespuestaDetectadaOmr['scoresPorOpcion'][number]> = {}) => ({
      opcion,
      score: 0,
      fillRatioCore: 0,
      fillRatioRing: 0.1,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0,
      centerDarknessDelta: 0,
      centerMean: 180,
      softCoreContrast: 0,
      softCentroidOffsetRatio: 0,
      ringMean: 220,
      outerMean: 240,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      strokeLeakPenalty: 0,
      shapeCompactness: 0,
      markConfidence: 0,
      estadoMarca: 'no_marcada' as const,
      ...datos
    });
    const homografia: RespuestaDetectadaOmr = {
      numeroPregunta: 25,
      opcion: null,
      confianza: 0,
      flags: ['parcial_detectada'],
      scoresPorOpcion: [
        crearScore('B', { score: 0.326, fillRatioCore: 0.524, contraste: 0.098, centroidOffsetRatio: 0.185, nucleusFillRatio: 0.446, shapeCompactness: 0.656, markConfidence: 0.790, estadoMarca: 'marcada' }),
        crearScore('C', { score: 0.244, fillRatioCore: 0.381, contraste: 0.09, centroidOffsetRatio: 0.2, nucleusFillRatio: 0.421, shapeCompactness: 0.394, markConfidence: 0.654, estadoMarca: 'parcial' }),
        ...(['A', 'D', 'E'] as const).map((opcion) => crearScore(opcion))
      ]
    };
    const escala: RespuestaDetectadaOmr = {
      numeroPregunta: 25,
      opcion: 'B',
      confianza: 0.91,
      flags: [],
      scoresPorOpcion: [
        crearScore('B', { score: 0.28, fillRatioCore: 0.71, contraste: 0.25, radialMassRatio: 0.5, centroidOffsetRatio: 0.19, shapeCompactness: 0.38, markConfidence: 0.92, estadoMarca: 'marcada' }),
        ...(['A', 'C', 'D', 'E'] as const).map((opcion) => crearScore(opcion))
      ]
    };
    expect(debeAceptarConsensoGeometriaAlternaOmr(homografia, escala)).toBe(true);
    expect(debeAceptarConsensoGeometriaAlternaOmr(homografia, { ...escala, opcion: 'C' })).toBe(false);
    expect(debeAceptarConsensoGeometriaAlternaOmr(homografia, { ...escala, flags: ['doble_marca'] })).toBe(false);
    expect(debeAceptarConsensoGeometriaAlternaOmr({
      ...homografia,
      scoresPorOpcion: homografia.scoresPorOpcion.map((score) => score.opcion === 'C'
        ? { ...score, score: 0.27, fillRatioCore: 0.46, nucleusFillRatio: 0.48, shapeCompactness: 0.5, markConfidence: 0.72 }
        : score)
    }, escala)).toBe(false);

    const combinado = combinarRespuestasOmrSinPerderDeterminadas(
      [
        { numeroPregunta: 1, opcion: 'D', confianza: 0.9, flags: [], scoresPorOpcion: [] },
        { numeroPregunta: 25, opcion: null, confianza: 0, flags: ['parcial_detectada'], scoresPorOpcion: [] }
      ],
      [],
      [homografia],
      new Set(),
      [escala]
    );
    expect(combinado.map((respuesta) => respuesta.opcion)).toEqual(['D', 'B']);
    expect(combinado[1]?.flags).toContain('bajo_contraste');

    const escalaAbstencion: RespuestaDetectadaOmr = {
      numeroPregunta: 7,
      opcion: null,
      confianza: 0,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: []
    };
    const homografiaMarcaPequena: RespuestaDetectadaOmr = {
      numeroPregunta: 7,
      opcion: 'C',
      confianza: 0.42,
      flags: ['parcial_detectada'],
      scoresPorOpcion: [
        crearScore('C', { score: 0.003, fillRatioCore: 0.2, contraste: 0.06, softCoreContrast: 0.12, radialMassRatio: 0.46, centroidOffsetRatio: 0.22, shapeCompactness: 0.21, nucleusFillRatio: 0.42, estadoMarca: 'parcial' }),
        ...(['A', 'B', 'D', 'E'] as const).map((opcion) => crearScore(opcion))
      ]
    };
    const escalaAlternaAbstencion: RespuestaDetectadaOmr = {
      ...escalaAbstencion,
      numeroPregunta: 7
    };
    expect(debeAceptarConsensoGeometriaAlternaOmr(homografiaMarcaPequena, escalaAlternaAbstencion)).toBe(true);
    expect(debeAceptarConsensoGeometriaAlternaOmr({
      ...homografiaMarcaPequena,
      flags: ['doble_marca']
    }, escalaAlternaAbstencion)).toBe(false);
    expect(debeAceptarConsensoGeometriaAlternaOmr({
      ...homografiaMarcaPequena,
      scoresPorOpcion: homografiaMarcaPequena.scoresPorOpcion.map((score) => score.opcion === 'B'
        ? { ...score, score: 0.04, fillRatioCore: 0.12 }
        : score)
    }, escalaAlternaAbstencion)).toBe(false);

    const rescatadaPorHomografia = combinarRespuestasOmrSinPerderDeterminadas(
      [escalaAbstencion],
      [],
      [homografiaMarcaPequena],
      new Set(),
      [escalaAlternaAbstencion]
    );
    expect(rescatadaPorHomografia[0]?.opcion).toBe('C');
    expect(rescatadaPorHomografia[0]?.confianza).toBe(0.42);
    expect(rescatadaPorHomografia[0]?.flags).toContain('bajo_contraste');
  });

  it('completa con la pasada alternativa sin sustituir respuestas ya determinadas', () => {
    const base = [
      { numeroPregunta: 1, opcion: 'D' as const, confianza: 0.7, scoresPorOpcion: [], flags: [] },
      { numeroPregunta: 2, opcion: null, confianza: 0, scoresPorOpcion: [], flags: ['bajo_contraste'] },
      { numeroPregunta: 3, opcion: null, confianza: 0, scoresPorOpcion: [], flags: ['bajo_contraste'] },
      { numeroPregunta: 4, opcion: null, confianza: 0, scoresPorOpcion: [], flags: ['bajo_contraste'] }
    ];
    const rescate = [
      { numeroPregunta: 1, opcion: 'B' as const, confianza: 0.9, scoresPorOpcion: [], flags: [] },
      { numeroPregunta: 2, opcion: 'E' as const, confianza: 0.8, scoresPorOpcion: [], flags: [] },
      { numeroPregunta: 3, opcion: 'A' as const, confianza: 0.42, scoresPorOpcion: [], flags: ['parcial_detectada'] },
      { numeroPregunta: 4, opcion: 'C' as const, confianza: 0.9, scoresPorOpcion: [], flags: ['doble_marca'] }
    ];

    expect(combinarRespuestasOmrSinPerderDeterminadas(base, rescate).map((respuesta) => respuesta.opcion))
      .toEqual(['D', 'E', null, null]);
  });

  it('protege literalmente toda respuesta determinada durante el consenso geométrico experimental', () => {
    const previa: RespuestaDetectadaOmr = {
      numeroPregunta: 3,
      opcion: 'E',
      confianza: 0.719,
      flags: ['parcial_detectada', 'bajo_contraste'],
      scoresPorOpcion: []
    };
    const escala: RespuestaDetectadaOmr = {
      numeroPregunta: 3,
      opcion: 'B',
      confianza: 0.9,
      flags: [],
      scoresPorOpcion: []
    };
    const combinada = combinarRespuestasOmrSinPerderDeterminadas(
      [previa],
      [escala],
      [escala],
      new Set(),
      [escala],
      true
    );

    expect(combinada[0]).toBe(previa);
  });

  it('refuerza una opcion coincidente aunque cambie el contraste absoluto', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia('C', { A: 0.12, B: 0.1, C: 0.74, D: 0.11, E: 0.09 }, [], 0.82),
      crearEvidencia('C', { A: 0.04, B: 0.03, C: 0.34, D: 0.05, E: 0.03 }, [], 0.62)
    );

    expect(resultado.opcion).toBe('C');
    expect(resultado.modo).toBe('consenso');
    expect(resultado.confianza).toBeGreaterThan(0.5);
    expect(resultado.confianza).toBeLessThanOrEqual(1);
  });

  it('rescata una marca fuerte frente a una pasada en blanco', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia('B', { A: 0.03, B: 0.82, C: 0.02, D: 0.03, E: 0.02 }, [], 0.9),
      crearEvidencia(null, { A: 0.03, B: 0.04, C: 0.03, D: 0.02, E: 0.03 }, [], 0.1)
    );

    expect(resultado.opcion).toBe('B');
    expect(resultado.modo).toBe('rescate');
    expect(resultado.flags).toContain('bajo_contraste');
  });

  it('rescata una marca real débil cuando conserva separación fotométrica aislada', () => {
    const opcionesTenues = (marcada: boolean): EvidenciaOpcionOmr[] => ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
      opcion,
      score: marcada ? 0.06 : 0,
      fillRatioCore: marcada ? 0.29 : 0.04,
      fillRatioRing: marcada ? 0.08 : 0.03,
      radialMassRatio: marcada ? 0.22 : 0,
      centroidOffsetRatio: marcada ? 0.32 : 0,
      contraste: marcada ? 0.13 : 0,
      shapeCompactness: marcada ? 0.43 : 0.2,
      markConfidence: marcada ? 0.12 : 0.02,
      nucleusFillRatio: marcada ? 0.2 : 0,
      nucleusDarknessDelta: marcada ? 0.1 : 0,
      estadoMarca: marcada ? 'marcada' : 'no_marcada'
    }));
    const resultado = fusionarRespuestaOmrV2(
      { opcion: null, confianza: 0.25, flags: [], scoresPorOpcion: opcionesTenues(false).map((item, index) => index === 3 ? { ...item, opcion: 'D', score: 0.06, fillRatioCore: 0.29, radialMassRatio: 0.22, centroidOffsetRatio: 0.32, contraste: 0.13, shapeCompactness: 0.43, markConfidence: 0.12, nucleusFillRatio: 0.2, nucleusDarknessDelta: 0.1, estadoMarca: 'marcada' } : item) },
      crearEvidencia(null, { A: 0, B: 0, C: 0, D: 0, E: 0 }, [], 0.1)
    );

    expect(resultado.opcion).toBe('D');
    expect(resultado.modo).toBe('rescate');
    expect(resultado.flags).toContain('bajo_contraste');
  });

  it('rescata una marca tenue repetida en dos pasadas frente a un falso doble aislado', () => {
    const crearMarcaTenue = (opcion: 'E'): EvidenciaRespuestaOmr => ({
      opcion,
      confianza: 0.35,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
        opcion: letra,
        score: letra === opcion ? 0.052 : 0,
        fillRatioCore: letra === opcion ? 0.267 : 0,
        fillRatioRing: letra === opcion ? 0.31 : 0.35,
        fillDelta: 0,
        contraste: letra === opcion ? 0.166 : 0,
        radialMassRatio: letra === opcion ? 0.482 : 0,
        centroidOffsetRatio: letra === opcion ? 0.244 : 0,
        centerDarknessDelta: 0,
        centerMean: 208,
        softCoreContrast: letra === opcion ? 0.197 : 0,
        softCentroidOffsetRatio: letra === opcion ? 0.037 : 1,
        ringMean: 190,
        outerMean: 250,
        nucleusFillRatio: letra === opcion ? 0.26 : 0,
        nucleusDarknessDelta: 0,
        strokeLeakPenalty: letra === opcion ? 0.07 : 0.35,
        shapeCompactness: letra === opcion ? 0.21 : 1,
        markConfidence: letra === opcion ? 0.13 : 0,
        estadoMarca: letra === opcion ? 'parcial' : 'no_marcada'
      }))
    });

    const falsoDoble = {
      ...crearMarcaTenue('E'),
      opcion: null,
      flags: ['doble_marca'] as string[],
      scoresPorOpcion: crearMarcaTenue('E').scoresPorOpcion.map((item) =>
        item.opcion === 'B' || item.opcion === 'E'
          ? { ...item, score: item.opcion === 'B' ? 0.315 : 0.303, fillRatioCore: 0.33 }
          : item
      )
    };

    const resultado = rescatarCandidataEstableEntrePasadas([
      crearMarcaTenue('E'),
      falsoDoble,
      crearMarcaTenue('E')
    ]);

    expect(resultado?.opcion).toBe('E');
    expect(resultado?.repeticiones).toBe(2);
  });

  it('rescata una marca moderada repetida y conserva la abstención ante competencia real', () => {
    const crearMarcaModerada = (segundaScore = 0.048): EvidenciaRespuestaOmr => ({
      opcion: null,
      confianza: 0.35,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
        opcion: letra,
        score: letra === 'E' ? 0.284 : letra === 'D' ? segundaScore : 0,
        fillRatioCore: letra === 'E' ? 0.27 : letra === 'D' ? 0.08 : 0,
        fillRatioRing: letra === 'E' ? 0.12 : 0.03,
        fillDelta: 0,
        contraste: letra === 'E' ? 0.06 : 0,
        radialMassRatio: letra === 'E' ? 0.28 : 0,
        centroidOffsetRatio: letra === 'E' ? 0.28 : 0,
        centerDarknessDelta: 0,
        centerMean: 190,
        softCoreContrast: letra === 'E' ? 0.1 : 0,
        softCentroidOffsetRatio: letra === 'E' ? 0.2 : 1,
        ringMean: 220,
        outerMean: 245,
        nucleusFillRatio: 0.08,
        nucleusDarknessDelta: 0,
        strokeLeakPenalty: 0.1,
        shapeCompactness: letra === 'E' ? 0.25 : 1,
        markConfidence: letra === 'E' ? 0.2 : 0,
        estadoMarca: letra === 'E' ? 'parcial' : 'no_marcada'
      }))
    });

    const resultado = rescatarCandidataEstableEntrePasadas([
      crearMarcaModerada(),
      crearMarcaModerada()
    ]);

    expect(resultado?.opcion).toBe('E');
    expect(resultado?.repeticiones).toBe(2);
    expect(rescatarCandidataEstableEntrePasadas([
      crearMarcaModerada(0.15),
      crearMarcaModerada(0.15)
    ])).toBeNull();
  });

  it('rescata el mismo nucleo aislado en dos pasadas y mantiene el umbral de margen', () => {
    const crearPasada = (fillCoreMargin: number): EvidenciaRespuestaOmr => ({
      opcion: null,
      confianza: 0.25,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
        opcion,
        score: opcion === 'C' ? 0.09 : opcion === 'D' ? 0.08 : 0,
        fillRatioCore: opcion === 'C' ? 0.28 + fillCoreMargin : opcion === 'D' ? 0.28 : 0,
        fillRatioRing: opcion === 'C' ? 0.1 : 0.03,
        fillDelta: 0,
        contraste: opcion === 'C' ? 0.08 : 0,
        radialMassRatio: opcion === 'C' ? 0.18 : 0,
        centroidOffsetRatio: opcion === 'C' ? 0.2 : 0,
        centerDarknessDelta: 0.04,
        softCoreContrast: opcion === 'C' ? 0.08 : 0,
        shapeCompactness: opcion === 'C' ? 0.16 : 0.2,
        markConfidence: opcion === 'C' ? 0.2 : 0,
        estadoMarca: opcion === 'C' ? 'parcial' : 'no_marcada'
      }))
    });

    const resultado = rescatarCandidataEstableEntrePasadas([
      crearPasada(0.1),
      crearPasada(0.1)
    ]);
    expect(resultado?.opcion).toBe('C');
    expect(rescatarCandidataEstableEntrePasadas([
      crearPasada(0.079),
      crearPasada(0.079)
    ])).toBeNull();
    expect(rescatarCandidataEstableEntrePasadas([
      crearPasada(0.1),
      { ...crearPasada(0.1), flags: ['doble_marca'] }
    ])).toBeNull();
  });

  it('rescata una marca etiquetada tenue repetida aunque una pasada tenga score cero', () => {
    const crearPasada = (fuerte: boolean): EvidenciaRespuestaOmr => ({
      opcion: fuerte ? null : 'D',
      confianza: fuerte ? 0.4 : 0.25,
      flags: ['bajo_contraste', 'parcial_detectada'],
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((opcion) => ({
        opcion,
        score: opcion === 'D' ? (fuerte ? 0.177 : 0) : opcion === 'B' ? 0.09 : 0,
        fillRatioCore: opcion === 'D' ? (fuerte ? 0.19 : 0.2) : 0,
        fillRatioRing: 0.1,
        contraste: opcion === 'D' ? (fuerte ? 0.09 : 0.113) : 0,
        radialMassRatio: opcion === 'D' ? 0.35 : 0,
        centroidOffsetRatio: opcion === 'D' ? 0.2 : 0,
        softCoreContrast: opcion === 'D' ? (fuerte ? 0.08 : 0.08) : 0,
        shapeCompactness: opcion === 'D' ? (fuerte ? 0.46 : 0.148) : 1,
        markConfidence: opcion === 'D' ? (fuerte ? 0.2 : 0) : 0,
        estadoMarca: opcion === 'D' ? 'parcial' : 'no_marcada'
      }))
    });

    const resultado = rescatarCandidataEtiquetadaDebilEntrePasadas([
      crearPasada(false),
      crearPasada(true)
    ]);
    expect(resultado?.opcion).toBe('D');
    expect(resultado?.repeticiones).toBe(2);
    expect(rescatarCandidataEtiquetadaDebilEntrePasadas([
      crearPasada(false),
      { ...crearPasada(true), flags: ['doble_marca'] }
    ])).toBeNull();
  });

  it('rescata dos etiquetas limpias aunque una pasada intermedia marque ruido distinto', () => {
    const crearMarca = (opcion: string, score: number, flags: string[] = [], fuerte = false): EvidenciaRespuestaOmr => ({
      opcion: fuerte ? null : opcion,
      confianza: fuerte ? 0.9 : 0.35,
      flags,
      scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
        opcion: letra,
        score: letra === opcion ? score : letra === 'D' && flags.includes('doble_marca') ? 0.31 : 0,
        fillRatioCore: letra === opcion ? (fuerte ? 0.52 : 0.4) : 0,
        fillRatioRing: 0.1,
        contraste: letra === opcion ? (fuerte ? 0.32 : 0.04) : 0,
        radialMassRatio: letra === opcion ? (fuerte ? 0.38 : 0.51) : 0,
        centroidOffsetRatio: letra === opcion ? 0.24 : 0,
        softCoreContrast: letra === opcion ? (fuerte ? 0.38 : 0.19) : 0,
        shapeCompactness: letra === opcion ? (fuerte ? 0.52 : 0.63) : 1,
        markConfidence: letra === opcion ? (fuerte ? 1 : 0.24) : 0,
        estadoMarca: letra === opcion ? 'parcial' : 'no_marcada'
      }))
    });

    const resultado = rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas([
      crearMarca('E', 0.55, ['bajo_contraste', 'parcial_detectada'], true),
      crearMarca('D', 0.31, ['doble_marca', 'bajo_contraste'], true),
      crearMarca('E', 0.08, ['parcial_detectada'])
    ]);
    expect(resultado?.opcion).toBe('E');
    expect(resultado?.repeticiones).toBe(2);

    const respuestaDesde = (evidencia: EvidenciaRespuestaOmr): RespuestaDetectadaOmr => ({
      numeroPregunta: 1,
      opcion: evidencia.opcion as RespuestaDetectadaOmr['opcion'],
      confianza: evidencia.confianza,
      flags: evidencia.flags as RespuestaDetectadaOmr['flags'],
      scoresPorOpcion: evidencia.scoresPorOpcion as RespuestaDetectadaOmr['scoresPorOpcion'],
      estadoRespuesta: 'ambigua'
    });
    const combinado = combinarRespuestasOmrSinPerderDeterminadas(
      [respuestaDesde(crearMarca('C', 0.11, ['bajo_contraste', 'parcial_detectada']))],
      [respuestaDesde(crearMarca('E', 0.55, ['bajo_contraste', 'parcial_detectada'], true))],
      [respuestaDesde(crearMarca('E', 0.08, ['parcial_detectada']))]
    );
    expect(combinado[0]?.opcion).toBe('E');

    expect(rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas([
      crearMarca('E', 0.55, [], true),
      crearMarca('E', 0.08, ['doble_marca'], false)
    ])).toBeNull();
  });

  it('prioriza una dominante aislada fuerte frente a una hipótesis débil distinta', () => {
    const crearDominante = (fuerte: boolean): EvidenciaRespuestaOmr => {
      const dominante = fuerte ? 'E' : 'B';
      const datos = dominante === 'E'
        ? { score: 0.629, core: 0.381, ring: 0.086, contraste: 0.232, soft: 0.175, radial: 0.296, offset: 0.209, shape: 0.47, confianza: 1 }
        : { score: 0.293, core: 0.267, ring: 0.119, contraste: 0.135, soft: 0.174, radial: 0.347, offset: 0.221, shape: 0.36, confianza: 0.53 };
      return {
        opcion: null,
        confianza: fuerte ? 0 : 0.5,
        flags: ['parcial_detectada'],
        scoresPorOpcion: ['A', 'B', 'C', 'D', 'E'].map((letra) => ({
          opcion: letra,
          score: letra === dominante ? datos.score : 0,
          fillRatioCore: letra === dominante ? datos.core : 0,
          fillRatioRing: letra === dominante ? datos.ring : 0.35,
          fillDelta: 0,
          contraste: letra === dominante ? datos.contraste : 0,
          radialMassRatio: letra === dominante ? datos.radial : 0,
          centroidOffsetRatio: letra === dominante ? datos.offset : 0,
          centerDarknessDelta: 0,
          centerMean: 180,
          softCoreContrast: letra === dominante ? datos.soft : 0,
          softCentroidOffsetRatio: letra === dominante ? 0.3 : 1,
          ringMean: 220,
          outerMean: 240,
          nucleusFillRatio: 0.08,
          nucleusDarknessDelta: 0,
          strokeLeakPenalty: 0,
          shapeCompactness: letra === dominante ? datos.shape : 1,
          markConfidence: letra === dominante ? datos.confianza : 0,
          estadoMarca: letra === dominante ? 'marcada' : 'no_marcada'
        }))
      };
    };

    const resultado = fusionarRespuestaOmrV2(crearDominante(false), crearDominante(true));
    expect(resultado.opcion).toBe('E');
    expect(resultado.modo).toBe('rescate');
  });

  it('rescata una dominante repetida cuando solo una pasada produce un falso doble', () => {
    const crearPasada = (invalida: boolean): EvidenciaRespuestaOmr => {
      const datos = {
        A: { score: invalida ? 0.02 : 0.129, core: invalida ? 0.02 : 0.33, contraste: 0, radial: 0, offset: 0, shape: 1, confianza: 0 },
        B: { score: invalida ? 0.198 : 0.03, core: invalida ? 0.29 : 0.04, contraste: invalida ? 0.07 : 0, radial: invalida ? 0.3 : 0, offset: invalida ? 0.31 : 0, shape: invalida ? 0.31 : 1, confianza: invalida ? 0.3 : 0 },
        C: { score: invalida ? 0.393 : 0.298, core: invalida ? 0.43 : 0.67, contraste: invalida ? 0.17 : 0.117, radial: invalida ? 0.48 : 0.48, offset: invalida ? 0.11 : 0.11, shape: invalida ? 0.67 : 0.19, confianza: invalida ? 0.88 : 0.78 },
        D: { score: 0, core: 0, contraste: 0, radial: 0, offset: 0, shape: 1, confianza: 0 },
        E: { score: 0, core: 0, contraste: 0, radial: 0, offset: 0, shape: 1, confianza: 0 }
      } as const;
      return {
        opcion: invalida ? null : 'C',
        confianza: invalida ? 0.7 : 0.85,
        flags: invalida ? ['doble_marca', 'bajo_contraste'] : ['bajo_contraste'],
        scoresPorOpcion: (Object.keys(datos) as Array<keyof typeof datos>).map((opcion) => ({
          opcion,
          score: datos[opcion].score,
          fillRatioCore: datos[opcion].core,
          fillRatioRing: 0.1,
          contraste: datos[opcion].contraste,
          radialMassRatio: datos[opcion].radial,
          centroidOffsetRatio: datos[opcion].offset,
          shapeCompactness: datos[opcion].shape,
          markConfidence: datos[opcion].confianza,
          estadoMarca: opcion === 'C' ? 'marcada' : 'parcial'
        }))
      };
    };

    const resultado = fusionarRespuestaOmrV2(crearPasada(false), crearPasada(true));
    expect(resultado.opcion).toBe('C');
    expect(resultado.modo).toBe('rescate');
    expect(resultado.flags).not.toContain('doble_marca');
    expect(fusionarRespuestaOmrV2(crearPasada(true), crearPasada(true)).opcion).toBeNull();
  });

  it('no rescata una doble marca confirmada por dos pasadas', () => {
    const doble = crearEvidencia('B', { A: 0.3, B: 0.31, C: 0.04, D: 0.03, E: 0.02 }, ['doble_marca'], 0.4);
    expect(rescatarCandidataEstableEntrePasadas([doble, doble])).toBeNull();
  });

  it('no convierte un ranking aislado sin etiqueta en una respuesta', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia(null, { A: 0.02, B: 0.21, C: 0.03, D: 0.14, E: 0.02 }, [], 0.28),
      crearEvidencia(null, { A: 0.02, B: 0.18, C: 0.02, D: 0.12, E: 0.02 }, [], 0.25)
    );

    expect(resultado.opcion).toBeNull();
  });

  it('se abstiene cuando las dos pasadas discrepan sin separacion suficiente', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia('A', { A: 0.58, B: 0.48, C: 0.08, D: 0.07, E: 0.06 }, [], 0.62),
      crearEvidencia('B', { A: 0.47, B: 0.59, C: 0.08, D: 0.07, E: 0.06 }, [], 0.62)
    );

    expect(resultado.opcion).toBeNull();
    expect(resultado.modo).toBe('abstencion');
    expect(resultado.flags).toContain('bajo_contraste');
  });

  it('mantiene invalida una doble marca aunque la otra pasada proponga una letra', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia('D', { A: 0.04, B: 0.03, C: 0.04, D: 0.72, E: 0.03 }, ['doble_marca'], 0.85),
      crearEvidencia('D', { A: 0.03, B: 0.02, C: 0.03, D: 0.68, E: 0.02 }, [], 0.8)
    );

    expect(resultado.opcion).toBeNull();
    expect(resultado.modo).toBe('invalida');
    expect(resultado.flags).toContain('doble_marca');
  });

  it('rescata una doble aparente de baja confianza cuando la pasada alternativa es separable', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia('D', { A: 0.22, B: 0.2, C: 0.18, D: 0.31, E: 0.17 }, ['doble_marca'], 0.3),
      crearEvidencia('E', { A: 0.02, B: 0.02, C: 0.02, D: 0.08, E: 0.38 }, [], 0.5)
    );

    expect(resultado.opcion).toBe('E');
    expect(resultado.modo).toBe('rescate');
    expect(resultado.flags).toContain('doble_marca');
  });

  it('acota valores numericos y conserva blancos no marcados como abstencion', () => {
    const resultado = fusionarRespuestaOmrV2(
      crearEvidencia(null, { A: 0, B: 0, C: 0, D: 0, E: 0 }, [], Number.NaN),
      crearEvidencia(null, { A: 0, B: 0, C: 0, D: 0, E: 0 }, [], Number.POSITIVE_INFINITY)
    );

    expect(resultado.opcion).toBeNull();
    expect(resultado.modo).toBe('abstencion');
    expect(resultado.confianza).toBeGreaterThanOrEqual(0);
    expect(resultado.confianza).toBeLessThanOrEqual(1);
  });

  it('acepta una dominante compacta y rechaza dos señales comparables', () => {
    const base = {
      scoreDominante: 0.6,
      scoreSegundo: 0.02,
      nucleoDominante: 0.86,
      nucleoSegundo: 0.04,
      contrasteDominante: 0.5,
      compacidadDominante: 0.58,
      compacidadSegunda: 0.1,
      confianzaDominante: 1
    };
    expect(debeAceptarCandidataCompactaOmr(base)).toBe(true);
    expect(debeAceptarCandidataCompactaOmr({ ...base, scoreSegundo: 0.35 })).toBe(false);
    expect(debeAceptarCandidataCompactaOmr({ ...base, nucleoSegundo: 0.62 })).toBe(false);
  });

  it('acepta una candidata fuerte con evidencia multirasgo y rechaza margen insuficiente', () => {
    const candidata = {
      scoreDominante: 0.31,
      scoreSegundo: 0.15,
      fillRatioCore: 0.67,
      contrasteDominante: 0.16,
      masaRadial: 0.41,
      desplazamientoCentro: 0.18,
      compacidadDominante: 0.67,
      confianzaDominante: 0.8
    };
    expect(debeAceptarCandidataFuerteOmr(candidata)).toBe(true);
    expect(debeAceptarCandidataFuerteOmr({ ...candidata, scoreSegundo: 0.22 })).toBe(false);
    expect(debeAceptarCandidataFuerteOmr({ ...candidata, compacidadDominante: 0.3 })).toBe(false);
  });

  it('acepta una dominante aislada aunque el descarte de alternativas sea conservador', () => {
    const candidata = {
      panelHorizontal: true,
      dobleMarcada: false,
      tachada: false,
      scoreDominante: 0.629,
      scoreSegundo: 0.136,
      fillRatioCore: 0.381,
      fillRatioCoreSegundo: 0.19,
      contraste: 0.232,
      contrasteSegundo: 0.041,
      contrasteSuave: 0.175,
      radialMassRatio: 0.296,
      centroidOffsetRatio: 0.209,
      shapeCompactness: 0.47,
      markConfidence: 1
    };
    expect(debeAceptarDominanteAisladaConContrasteOmr(candidata)).toBe(true);
    expect(debeAceptarDominanteAisladaConContrasteOmr({ ...candidata, scoreSegundo: 0.31 })).toBe(false);
    expect(debeAceptarDominanteAisladaConContrasteOmr({ ...candidata, dobleMarcada: true })).toBe(false);
  });

  it('habilita rescate local en escala simple solo con fiduciales persistidos', () => {
    const base = {
      habilitada: true,
      deshabilitada: false,
      referenciaGlobalFuerte: false,
      transformacion: 'escala' as const,
      qrDetectado: false,
      capturaBajaResolucion: false,
      forceSimpleScale: false
    };

    expect(debeUsarGeometriaLocalOmr({ ...base, tieneFiducialesLocales: true })).toBe(true);
    expect(debeUsarGeometriaLocalOmr({ ...base, tieneFiducialesLocales: false })).toBe(false);
    expect(debeUsarGeometriaLocalOmr({ ...base, tieneFiducialesLocales: true, deshabilitada: true })).toBe(false);
  });

  it('reactiva geometria local si el comparador cambia una homografia por escala', () => {
    const base = {
      transformacionSeleccionada: 'escala' as const,
      qrDetectado: false,
      forceSimpleScale: false,
      deshabilitada: false,
      coordenadasEstrictas: false,
      tieneFiducialesLocales: true
    };
    expect(debeReactivarGeometriaLocalTrasEscalaOmr(base)).toBe(true);
    expect(debeReactivarGeometriaLocalTrasEscalaOmr({ ...base, coordenadasEstrictas: true })).toBe(false);
    expect(debeReactivarGeometriaLocalTrasEscalaOmr({ ...base, forceSimpleScale: true })).toBe(false);
  });

  it('corrige una captura apaisada sin EXIF y conserva orientaciones EXIF validas', () => {
    expect(determinarOrientacionCapturaOmr({ width: 3400, height: 2700 })).toEqual({
      modo: 'landscape_without_exif',
      rotacionGrados: 90,
      width: 2700,
      height: 3400
    });
    expect(determinarOrientacionCapturaOmr({ width: 3400, height: 2700, exifOrientation: 6 })).toEqual({
      modo: 'exif',
      rotacionGrados: 0,
      width: 2700,
      height: 3400
    });
    expect(determinarOrientacionCapturaOmr({ width: 3400, height: 2700, exifOrientation: 1 }).modo).toBe('landscape_without_exif');
  });

  it('acepta un punto central aislado pero rechaza tinta desplazada o dos nucleos', () => {
    const puntoValido = {
      panelHorizontal: true,
      dobleMarcada: false,
      tachada: false,
      nucleoDominante: 0.267,
      segundoNucleo: 0,
      masaRadial: 0.764,
      desplazamientoCentro: 0.054,
      compacidad: 0.32
    };
    expect(debeAceptarPuntoCentralAisladoOmr(puntoValido)).toBe(true);
    expect(debeAceptarPuntoCentralAisladoOmr({ ...puntoValido, masaRadial: 0.652, desplazamientoCentro: 0.347, compacidad: 0 })).toBe(false);
    expect(debeAceptarPuntoCentralAisladoOmr({ ...puntoValido, segundoNucleo: 0.2 })).toBe(false);
    expect(debeAceptarPuntoCentralAisladoOmr({
      ...puntoValido,
      nucleoDominante: 0.133,
      masaRadial: 0.462,
      desplazamientoCentro: 0.475,
      compacidad: 0.211
    })).toBe(true);
    expect(debeAceptarPuntoCentralAisladoOmr({
      ...puntoValido,
      nucleoDominante: 0.267,
      compacidad: 0,
      nucleoTinta: 0.9,
      nucleoContraste: 0.4
    })).toBe(true);
    expect(debeAceptarPuntoCentralAisladoOmr({
      ...puntoValido,
      nucleoDominante: 0.267,
      compacidad: 0,
      nucleoTinta: 0.3,
      nucleoContraste: 0
    })).toBe(false);
    expect(debeAceptarPuntoCentralAisladoOmr({
      ...puntoValido,
      nucleoDominante: 0.133,
      segundoNucleo: 0,
      masaRadial: 0.681,
      desplazamientoCentro: 0.213,
      compacidad: 0.272,
      nucleoTinta: 0.13,
      nucleoContraste: 0,
      componentePixels: 10,
      componenteFillRatio: 0.027,
      componenteAspectRatio: 3.5
    })).toBe(false);
    expect(debeAceptarPuntoCentralAisladoOmr({
      ...puntoValido,
      componentePixels: 10,
      componenteFillRatio: 0.027,
      componenteAspectRatio: 1.4
    })).toBe(true);
  });

  it('acepta nucleo robusto degradado solo con margen y sin doble evidencia', () => {
    const marca = {
      panelHorizontal: true,
      capturaBajaResolucion: true,
      dobleMarcada: true,
      segundaNucleoConEvidencia: false,
      tachada: false,
      scoreDominante: 0.31,
      scoreSegundo: 0.11,
      nucleoDominante: 0.53,
      nucleoTinta: 0.59,
      nucleoContraste: 0.26,
      desplazamientoCentro: 0.25,
      confianza: 0.78
    };
    expect(debeAceptarNucleoRobustoOmr(marca)).toBe(true);
    expect(debeAceptarNucleoRobustoOmr({ ...marca, segundaNucleoConEvidencia: true })).toBe(false);
    expect(debeAceptarNucleoRobustoOmr({ ...marca, scoreSegundo: 0.23 })).toBe(false);
    expect(debeAceptarNucleoRobustoOmr({ ...marca, nucleoContraste: 0 })).toBe(false);
  });

  it('acepta una marca tenue solo con contraste continuo y separacion de fila', () => {
    const marca = {
      panelHorizontal: true,
      capturaBajaResolucion: true,
      dobleMarcada: false,
      tachada: false,
      scoreDominante: 0.11,
      scoreSegundo: 0,
      contraste: 0.18,
      nucleoDominante: 0.33,
      masaRadial: 0.41,
      desplazamientoCentro: 0.06,
      compacidad: 0.47,
      confianza: 0.28
    };
    expect(debeAceptarMarcaFaintOmr(marca)).toBe(true);
    expect(debeAceptarMarcaFaintOmr({ ...marca, contraste: 0.12 })).toBe(false);
    expect(debeAceptarMarcaFaintOmr({ ...marca, scoreSegundo: 0.04 })).toBe(false);
    expect(debeAceptarMarcaFaintOmr({ ...marca, desplazamientoCentro: 0.46 })).toBe(false);
    expect(debeAceptarMarcaFaintOmr({
      ...marca,
      capturaBajaResolucion: false,
      scoreDominante: 0.1,
      scoreSegundo: 0,
      contraste: 0.07,
      contrasteSuave: 0.07,
      contrasteNucleoSuave: 0.006,
      nucleoDominante: 0.2,
      compacidad: 0.09
    })).toBe(false);
  });

  it('recupera señal aislada con score nulo y conserva abstención ante otra burbuja marcada', () => {
    const vacias = (opcion: 'A' | 'B' | 'C' | 'D' | 'E') => ({
      opcion,
      score: 0,
      fillRatioCore: 0,
      fillRatioRing: 0.4,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0,
      centerDarknessDelta: 0,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      strokeLeakPenalty: 0.4,
      shapeCompactness: 1,
      markConfidence: 0,
      estadoMarca: 'no_marcada' as const
    });
    const scores = [
      vacias('A'),
      vacias('B'),
      {
        ...vacias('C'),
        fillRatioCore: 0.133,
        contraste: 0.165,
        radialMassRatio: 0.259,
        centroidOffsetRatio: 0.449,
        nucleusFillRatio: 0.304,
        shapeCompactness: 0.331
      },
      vacias('D'),
      vacias('E')
    ];
    const args = { panelHorizontal: true, dobleMarcada: false, tachada: false, scores };

    expect(rescatarMarcaAisladaPorRasgosOmr(args)?.opcion).toBe('C');
    expect(rescatarMarcaAisladaPorRasgosOmr({ ...args, dobleMarcada: true })).toBeNull();
    expect(rescatarMarcaAisladaPorRasgosOmr({ ...args, tachada: true })).toBeNull();
    expect(rescatarMarcaAisladaPorRasgosOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'B'
        ? { ...item, fillRatioCore: 0.286, nucleusFillRatio: 0.463 }
        : item)
    })).toBeNull();
    const marcaConComponenteCompacta = scores.map((item) => item.opcion === 'C'
      ? {
          ...item,
          largestComponentPixels: 66,
          largestComponentFillRatio: 0.177,
          largestComponentOffsetRatio: 0.216,
          largestComponentDensity: 0.6,
          largestComponentAspectRatio: 1.1
        }
      : item);
    expect(rescatarMarcaAisladaPorRasgosOmr({ ...args, scores: marcaConComponenteCompacta })?.opcion).toBe('C');
    const residuoPequenoYAlargado = marcaConComponenteCompacta.map((item) => item.opcion === 'C'
      ? {
          ...item,
          largestComponentPixels: 10,
          largestComponentFillRatio: 0.027,
          largestComponentOffsetRatio: 0.216,
          largestComponentDensity: 0.714,
          largestComponentAspectRatio: 3.5
        }
      : item);
    expect(rescatarMarcaAisladaPorRasgosOmr({ ...args, scores: residuoPequenoYAlargado })).toBeNull();
  });

  it('rescata la marca aislada cuando la alternativa secundaria es dispersa y sin anillo de tinta', () => {
    const vacia = (opcion: 'A' | 'B' | 'C' | 'D' | 'E') => ({
      opcion,
      score: 0,
      fillRatioCore: 0,
      fillRatioRing: 0.07,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0,
      centerDarknessDelta: 0,
      centerMean: 230,
      softCoreContrast: 0,
      softCentroidOffsetRatio: 1,
      ringMean: 230,
      outerMean: 230,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      strokeLeakPenalty: 0,
      shapeCompactness: 1,
      markConfidence: 0,
      estadoMarca: 'no_marcada' as const
    });
    const scores = [
      vacia('A'),
      {
        ...vacia('B'),
        score: 0.177,
        fillRatioCore: 0.286,
        contraste: 0.078,
        radialMassRatio: 0.446,
        centroidOffsetRatio: 0.162,
        centerDarknessDelta: 0.099,
        centerMean: 211.7,
        softCoreContrast: 0.175,
        softCentroidOffsetRatio: 0.313,
        ringMean: 237,
        outerMean: 231.5,
        nucleusFillRatio: 0.405,
        nucleusDarknessDelta: 0.304,
        shapeCompactness: 0.186,
        markConfidence: 0.495,
        estadoMarca: 'marcada' as const
      },
      { ...vacia('C'), fillRatioCore: 0.19, contraste: 0.058, radialMassRatio: 0.456, shapeCompactness: 0.091, estadoMarca: 'parcial' as const },
      { ...vacia('D'), fillRatioCore: 0.238, contraste: 0.08, radialMassRatio: 0.531, shapeCompactness: 0.087, estadoMarca: 'parcial' as const },
      {
        ...vacia('E'),
        score: 0.203,
        fillRatioCore: 0.381,
        contraste: 0.073,
        radialMassRatio: 0.579,
        centroidOffsetRatio: 0.141,
        centerDarknessDelta: 0.076,
        centerMean: 219.3,
        softCoreContrast: 0.228,
        softCentroidOffsetRatio: 0.227,
        ringMean: 238.6,
        outerMean: 237.9,
        nucleusFillRatio: 0.364,
        nucleusDarknessDelta: 0.226,
        shapeCompactness: 0.372,
        markConfidence: 0.532,
        estadoMarca: 'marcada' as const
      }
    ];

    const args = { panelHorizontal: true, dobleMarcada: false, tachada: false, scores };
    expect(rescatarMarcaAisladaPorRasgosOmr(args)?.opcion).toBe('E');
    expect(rescatarMarcaAisladaPorRasgosOmr({ ...args, dobleMarcada: true })).toBeNull();
  });

  it('rescata nucleo de baja señal con margen multirasgo y rechaza competencia secundaria', () => {
    const vacia = (opcion: 'A' | 'B' | 'C' | 'D' | 'E') => ({
      opcion,
      score: 0,
      fillRatioCore: 0,
      fillRatioRing: 0.4,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0,
      centerDarknessDelta: 0,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      strokeLeakPenalty: 0.4,
      shapeCompactness: 1,
      markConfidence: 0,
      estadoMarca: 'no_marcada' as const
    });
    const scores = [
      vacia('A'),
      vacia('B'),
      {
        ...vacia('C'),
        fillRatioCore: 0.133,
        contraste: 0.058,
        radialMassRatio: 0.215,
        centroidOffsetRatio: 0.599,
        nucleusFillRatio: 0.478,
        nucleusDarknessDelta: 0.14,
        shapeCompactness: 0.227
      },
      vacia('D'),
      vacia('E')
    ];
    const args = { panelHorizontal: true, dobleMarcada: false, tachada: false, scores };

    expect(rescatarMarcaAisladaPorRasgosOmr(args)?.opcion).toBe('C');
    expect(rescatarMarcaAisladaPorRasgosOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'B'
        ? { ...item, fillRatioCore: 0.286, nucleusFillRatio: 0.331, nucleusDarknessDelta: 0.244 }
        : item)
    })).toBeNull();
    expect(rescatarMarcaAisladaPorRasgosOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'D'
        ? { ...item, fillRatioCore: 0.133, contraste: 0.055, nucleusFillRatio: 0.44 }
        : item)
    })).toBeNull();
  });

  it('aplica el rescate de rasgos solo al resultado final nulo y no borra letras previas', () => {
    const scores: import('../src/modulos/modulo_escaneo_omr/servicioOmrCv.js').ScoreOpcionOmr[] =
      (['A', 'B', 'C', 'D', 'E'] as const).map((opcion) => ({
        opcion,
        score: 0,
        fillRatioCore: opcion === 'C' ? 0.133 : 0,
        fillRatioRing: 0.4,
        fillDelta: 0,
        contraste: opcion === 'C' ? 0.165 : 0,
        radialMassRatio: opcion === 'C' ? 0.259 : 0,
        centroidOffsetRatio: opcion === 'C' ? 0.449 : 0,
        centerDarknessDelta: 0,
        nucleusFillRatio: opcion === 'C' ? 0.304 : 0,
        nucleusDarknessDelta: 0,
        strokeLeakPenalty: 0.4,
        shapeCompactness: opcion === 'C' ? 0.331 : 1,
        markConfidence: 0,
        estadoMarca: 'no_marcada'
      }));
    const base = [
      { numeroPregunta: 1, opcion: 'D' as const, confianza: 0.7, scoresPorOpcion: scores, flags: [] },
      { numeroPregunta: 2, opcion: null, confianza: 0, scoresPorOpcion: scores, flags: ['parcial_detectada'] as const },
      { numeroPregunta: 3, opcion: null, confianza: 0, scoresPorOpcion: scores, flags: ['doble_marca'] as const }
    ];

    const resultado = combinarRespuestasOmrSinPerderDeterminadas(
      base,
      [],
      [],
      new Set([2, 3])
    );

    expect(resultado.map((respuesta) => respuesta.opcion)).toEqual(['D', 'C', null]);
    expect(resultado[1]?.confianza).toBe(0.42);
    expect(resultado[1]?.estadoRespuesta).toBe('respondida');
    expect(resultado[1]?.flags).toContain('bajo_contraste');
  });

  it('mantiene el perfil movil reforzado dentro de una fila de cinco opciones', () => {
    expect(PERFIL_OMR_CANONICO.burbujaRadio).toBeCloseTo((6.4 * 72 / 25.4) / 2, 6);
    expect(PERFIL_OMR_CANONICO.burbujaPasoX).toBe(26);
    expect(PERFIL_OMR_CANONICO.fiducialSize).toBeCloseTo(2.3 * 72 / 25.4, 6);
    expect(PERFIL_OMR_CANONICO.cajaOmrAncho).toBeGreaterThanOrEqual(145);
  });
});
