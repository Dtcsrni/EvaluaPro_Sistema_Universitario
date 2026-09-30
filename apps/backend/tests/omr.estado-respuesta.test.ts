import { describe, expect, it } from 'vitest';
import {
  clasificarEstadoRespuestaOmr,
  resumirRespuestasOmr
} from '../src/modulos/modulo_escaneo_omr/omr/decision/estadoRespuesta.js';
import {
  debeAceptarMarcaCromaticaAisladaOmr,
  debeAbstenerseMarcaParcialOmr,
  esIntentoMarcaDebilOmr,
  normalizarDobleMarcadaPorEvidenciaOmr,
  seleccionarNucleoTenueDominanteOmr,
  seleccionarPuntoCompactoAisladoOmr,
  type ScoreOpcionOmr
} from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';

const respuestaVacia = { opcion: null, flags: [] as string[] };

describe('estado de respuesta OMR', () => {
  it('distingue una pregunta sin marca de una ambigua', () => {
    expect(clasificarEstadoRespuestaOmr(respuestaVacia)).toBe('sin_marca');
    expect(
      clasificarEstadoRespuestaOmr({ opcion: null, flags: ['parcial_detectada'] })
    ).toBe('ambigua');
  });

  it('prioriza doble marca y tachado como estados invalidantes', () => {
    expect(
      clasificarEstadoRespuestaOmr({ opcion: 'B', flags: ['doble_marca'] })
    ).toBe('doble_marca');
    expect(
      clasificarEstadoRespuestaOmr({ opcion: null, flags: ['tachada_detectada'] })
    ).toBe('tachada');
  });

  it('confirma una hoja vacia solo con ausencia total de evidencia ambigua', () => {
    const resumen = resumirRespuestasOmr(
      Array.from({ length: 10 }, () => respuestaVacia),
      0.82,
      0.9
    );
    expect(resumen).toMatchObject({
      totalReactivos: 10,
      reactivosRespondidos: 0,
      reactivosSinMarca: 10,
      reactivosAmbiguos: 0,
      examenVacio: true,
      examenVacioProbable: false,
      estadoExamen: 'vacio_confirmado'
    });
  });

  it('no clasifica como vacia una hoja con tinta parcial o respuestas', () => {
    const resumen = resumirRespuestasOmr(
      [
        respuestaVacia,
        { opcion: null, flags: ['bajo_contraste'] },
        { opcion: 'C', confianza: 0.9, flags: [] }
      ],
      0.82,
      0.9
    );
    expect(resumen.examenVacio).toBe(false);
    expect(resumen.estadoExamen).toBe('con_respuestas');
    expect(resumen.examenVacioProbable).toBe(false);
    expect(resumen.reactivosAmbiguos).toBe(1);
  });

  it('conserva revision cuando la geometria o calidad no permiten confirmar vacio', () => {
    const resumen = resumirRespuestasOmr(
      Array.from({ length: 5 }, () => respuestaVacia),
      0.4,
      0.9
    );
    expect(resumen.examenVacio).toBe(false);
    expect(resumen.estadoExamen).toBe('requiere_revision');
  });

  it('marca como vacio probable una hoja dominada por señales debiles', () => {
    const resumen = resumirRespuestasOmr(
      [
        ...Array.from({ length: 9 }, () => respuestaVacia),
        { opcion: 'E', confianza: 0.4, flags: ['bajo_contraste', 'parcial_detectada'] }
      ],
      0.8,
      0.5
    );
    expect(resumen.examenVacio).toBe(false);
    expect(resumen.examenVacioProbable).toBe(true);
    expect(resumen.estadoExamen).toBe('vacio_probable');
  });

  it('marca como vacío probable un raster con solo blancos y residuos ambiguos impresos', () => {
    const resumen = resumirRespuestasOmr([
      ...Array.from({ length: 8 }, () => respuestaVacia),
      ...Array.from({ length: 13 }, () => ({ opcion: null, flags: ['parcial_detectada'] })),
      { opcion: null, flags: ['doble_marca'] }
    ], 0.82, 0.86);

    expect(resumen).toMatchObject({
      reactivosRespondidos: 0,
      reactivosSinMarca: 8,
      reactivosAmbiguos: 13,
      reactivosInvalidos: 1,
      examenVacio: false,
      examenVacioProbable: true,
      estadoExamen: 'vacio_probable'
    });
  });

  it('no infiere vacío probable si no hay reactivos inequívocamente en blanco', () => {
    const resumen = resumirRespuestasOmr(
      Array.from({ length: 10 }, () => ({ opcion: null, flags: ['parcial_detectada'] })),
      0.82,
      0.86
    );

    expect(resumen.examenVacioProbable).toBe(false);
  });

  it('abstiene una señal parcial débil aunque domine relativamente a las otras opciones', () => {
    const lecturaParcial = {
      score: 0.134,
      fillRatioCore: 0.375,
      shapeCompactness: 0.405,
      centerDarknessDelta: 0.023,
      contrasteCromaticoLocal: 0.031,
      margenCromatico: 0.004,
      centroidOffsetRatio: 0.126,
      softCoreContrast: 0.133,
      markConfidence: 0.348,
      permitirConfianzaMarcada: true,
      fillCoreMargin: 0.08,
      fillCoreCompetitorScore: 0.08
    };

    expect(debeAbstenerseMarcaParcialOmr(lecturaParcial)).toBe(true);
    expect(debeAbstenerseMarcaParcialOmr({ ...lecturaParcial, score: 0.18 })).toBe(false);
  });

  it('distingue un intento tenue de una burbuja vacia sin publicar letra', () => {
    expect(esIntentoMarcaDebilOmr({
      score: 0,
      contraste: 0.12,
      softCoreContrast: 0.09,
      nucleusFillRatio: 0.12,
      radialMassRatio: 0.25,
      centroidOffsetRatio: 0.3,
      shapeCompactness: 0.1
    })).toBe(true);
    expect(esIntentoMarcaDebilOmr({
      score: 0,
      contraste: 0,
      softCoreContrast: 0,
      nucleusFillRatio: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0,
      shapeCompactness: 1
    })).toBe(false);
  });

  it('conserva como ambigua una microcomponente compacta que destaca frente a sus cuatro opciones', () => {
    const opciones = [
      { centerMean: 252.58, largestComponentPixels: 0, largestComponentFillRatio: 0 },
      { centerMean: 251.47, largestComponentPixels: 0, largestComponentFillRatio: 0 },
      { centerMean: 251.84, largestComponentPixels: 1, largestComponentFillRatio: 0.0027 },
      { centerMean: 253.27, largestComponentPixels: 0, largestComponentFillRatio: 0 }
    ].map((rasgos) => ({
      score: 0,
      contraste: 0,
      softCoreContrast: 0,
      nucleusFillRatio: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 1,
      shapeCompactness: 1,
      ...rasgos
    }));
    const microcomponente = {
      score: 0,
      contraste: 0,
      softCoreContrast: 0,
      nucleusFillRatio: 0,
      radialMassRatio: 0.23,
      centroidOffsetRatio: 0.64,
      shapeCompactness: 0.135,
      centerMean: 242.62,
      fillRatioCore: 0,
      softCentroidOffsetRatio: 0.426,
      largestComponentPixels: 7,
      largestComponentFillRatio: 0.0188,
      largestComponentOffsetRatio: 0.545,
      largestComponentDensity: 0.35,
      largestComponentAspectRatio: 1.25
    };

    expect(esIntentoMarcaDebilOmr(microcomponente, opciones)).toBe(true);
    expect(esIntentoMarcaDebilOmr(microcomponente, opciones, {
      permitirMicrocomponenteRelativo: false
    })).toBe(false);
    expect(esIntentoMarcaDebilOmr({
      ...microcomponente,
      largestComponentPixels: 6
    }, opciones)).toBe(false);
    expect(esIntentoMarcaDebilOmr({
      ...microcomponente,
      largestComponentAspectRatio: 2.3
    }, opciones)).toBe(false);
    expect(esIntentoMarcaDebilOmr({
      ...microcomponente,
      largestComponentOffsetRatio: 0.61
    }, opciones)).toBe(false);
    expect(esIntentoMarcaDebilOmr(microcomponente, opciones.map((opcion) => ({
      ...opcion,
      largestComponentPixels: 9,
      largestComponentFillRatio: 0.01
    })))).toBe(false);
    expect(esIntentoMarcaDebilOmr({
      ...microcomponente,
      centerMean: 247
    }, opciones)).toBe(false);
  });

  it('conserva como intento ambiguo una marca localizada no circular que destaca por tono', () => {
    const candidata = {
      score: 0.01,
      contraste: 0.08,
      softCoreContrast: 0.04,
      nucleusFillRatio: 0.08,
      radialMassRatio: 0.08,
      centroidOffsetRatio: 0.28,
      shapeCompactness: 0.02,
      fillRatioCore: 0.05,
      nucleusDarknessDelta: 0.03,
      softCentroidOffsetRatio: 0.35
    };
    const opcionesVacias = [0.02, 0.03, 0.04, 0.05].map((contraste) => ({
      ...candidata,
      contraste,
      softCoreContrast: contraste / 2,
      nucleusFillRatio: 0,
      fillRatioCore: 0,
      nucleusDarknessDelta: 0,
      score: 0,
      centroidOffsetRatio: 1,
      softCentroidOffsetRatio: 1
    }));
    const opcionesConFondoUniforme = opcionesVacias.map((opcion) => ({
      ...opcion,
      contraste: 0,
      softCoreContrast: 0
    }));

    expect(esIntentoMarcaDebilOmr(candidata, opcionesVacias)).toBe(true);
    expect(esIntentoMarcaDebilOmr({
      ...candidata,
      contraste: 0.026,
      softCoreContrast: 0,
      nucleusFillRatio: 0.2,
      fillRatioCore: 0.13,
      centroidOffsetRatio: 0.15,
      shapeCompactness: 0.06
    }, opcionesConFondoUniforme)).toBe(true);
    expect(esIntentoMarcaDebilOmr({
      ...candidata,
      contraste: 0.026,
      softCoreContrast: 0,
      nucleusFillRatio: 0.2,
      fillRatioCore: 0.13,
      centroidOffsetRatio: 0.9,
      softCentroidOffsetRatio: 0.9,
      shapeCompactness: 0.06
    }, opcionesConFondoUniforme)).toBe(false);
    expect(esIntentoMarcaDebilOmr(candidata, opcionesVacias.map((opcion) => ({
      ...opcion,
      contraste: 0.12,
      softCoreContrast: 0.12
    })))).toBe(false);
  });

  it('acepta una marca cromática localizada solo cuando destaca de fondo y de las otras opciones', () => {
    const candidata = {
      panelHorizontal: true,
      dobleMarcada: false,
      tachada: false,
      existeOpcionActual: false,
      contrasteCromaticoLocal: 0.073,
      margenCromatico: 0.068,
      fillRatioCore: 0.095,
      nucleusFillRatio: 0.3,
      centroidOffsetRatio: 0.54,
      softCentroidOffsetRatio: 0.2
    };

    expect(debeAceptarMarcaCromaticaAisladaOmr(candidata)).toBe(true);
    expect(debeAceptarMarcaCromaticaAisladaOmr({
      ...candidata,
      contrasteCromaticoLocal: 0.016,
      margenCromatico: 0.009
    })).toBe(false);
    expect(debeAceptarMarcaCromaticaAisladaOmr({ ...candidata, margenCromatico: 0.02 })).toBe(false);
    expect(debeAceptarMarcaCromaticaAisladaOmr({ ...candidata, dobleMarcada: true })).toBe(false);
    expect(debeAceptarMarcaCromaticaAisladaOmr({ ...candidata, tachada: true })).toBe(false);
    expect(debeAceptarMarcaCromaticaAisladaOmr({ ...candidata, existeOpcionActual: true })).toBe(false);
    expect(debeAceptarMarcaCromaticaAisladaOmr({
      ...candidata,
      fillRatioCore: 0.02,
      nucleusFillRatio: 0.04
    })).toBe(false);
  });

  it('rescata solo el punto compacto y dominante de una burbuja sin sobrescribir ni resolver dobles', () => {
    const score = (
      opcion: ScoreOpcionOmr['opcion'],
      componente: number,
      overrides: Partial<ScoreOpcionOmr> = {}
    ): ScoreOpcionOmr => ({
      opcion,
      score: 0.01,
      fillRatioCore: 0.06,
      fillRatioRing: 0.1,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0.2,
      centroidOffsetRatio: 0.2,
      centerDarknessDelta: 0,
      centerMean: 220,
      softCoreContrast: 0,
      softCentroidOffsetRatio: 0.2,
      ringMean: 220,
      outerMean: 240,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      strokeLeakPenalty: 0,
      shapeCompactness: 0.2,
      markConfidence: 0.1,
      largestComponentPixels: componente,
      largestComponentFillRatio: componente / 100,
      largestComponentOffsetRatio: 0.2,
      largestComponentDensity: 0.65,
      largestComponentAspectRatio: 1.25,
      estadoMarca: 'parcial',
      ...overrides
    });
    const scores = [
      score('A', 2),
      score('B', 3),
      score('C', 18),
      score('D', 2),
      score('E', 1)
    ];
    const args = {
      panelHorizontal: true,
      existeOpcionActual: false,
      dobleMarcada: false,
      tachada: false,
      scores
    };

    expect(seleccionarPuntoCompactoAisladoOmr(args)?.opcion).toBe('C');
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => ({ ...item, largestComponentDensity: 0.2 }))
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'C'
        ? { ...item, largestComponentAspectRatio: 3 }
        : item)
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({ ...args, existeOpcionActual: true })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({ ...args, dobleMarcada: true })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({ ...args, tachada: true })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({ ...args, panelHorizontal: false })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => ({ ...item, largestComponentFillRatio: 0.02 }))
    })).toBeNull();
  });

  it('resuelve una microcomponente tenue solo si destaca por tono, forma y ubicación frente a las cuatro opciones', () => {
    const score = (
      opcion: ScoreOpcionOmr['opcion'],
      centerMean: number,
      componentePixels = 0,
      componenteFill = 0,
      overrides: Partial<ScoreOpcionOmr> = {}
    ): ScoreOpcionOmr => ({
      opcion,
      score: 0,
      fillRatioCore: 0.02,
      fillRatioRing: 0.3,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0.05,
      centroidOffsetRatio: 0.8,
      centerDarknessDelta: 0,
      centerMean,
      softCoreContrast: 0,
      softCentroidOffsetRatio: 1,
      ringMean: 220,
      outerMean: 240,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      strokeLeakPenalty: 0,
      shapeCompactness: 0.1,
      markConfidence: 0,
      largestComponentPixels: componentePixels,
      largestComponentFillRatio: componenteFill,
      largestComponentOffsetRatio: componentePixels > 0 ? 0.2 : 1,
      largestComponentDensity: componentePixels > 0 ? 0.8 : 0,
      largestComponentAspectRatio: componentePixels > 0 ? 1.5 : Number.MAX_SAFE_INTEGER,
      estadoMarca: 'no_marcada',
      ...overrides
    });
    const scores = [
      score('A', 252),
      score('B', 251),
      score('C', 252),
      score('D', 240, 9, 0.024, {
        fillRatioCore: 0.067,
        largestComponentOffsetRatio: 0.489,
        largestComponentDensity: 0.45,
        largestComponentAspectRatio: 1.25,
        softCentroidOffsetRatio: 0.378
      }),
      score('E', 253)
    ];
    const args = {
      panelHorizontal: true,
      existeOpcionActual: false,
      dobleMarcada: false,
      tachada: false,
      scores
    };

    expect(seleccionarPuntoCompactoAisladoOmr(args)?.opcion).toBe('D');
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'D'
        ? { ...item, largestComponentDensity: 0.25 }
        : item)
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'D'
        ? { ...item, largestComponentPixels: 6, largestComponentFillRatio: 0.016 }
        : item)
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'D'
        ? { ...item, centerMean: 247 }
        : item)
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => ({ ...item, largestComponentPixels: 0, largestComponentFillRatio: 0 }))
    })).toBeNull();
  });

  it('rescata una marca tenue de alto contraste y rechaza la componente alargada de una página vacía', () => {
    const score = (
      opcion: ScoreOpcionOmr['opcion'],
      centerMean: number,
      overrides: Partial<ScoreOpcionOmr> = {}
    ): ScoreOpcionOmr => ({
      opcion,
      score: 0,
      fillRatioCore: 0,
      fillRatioRing: 0.4,
      fillDelta: 0,
      contraste: 0,
      radialMassRatio: 0,
      centroidOffsetRatio: 0.8,
      centerDarknessDelta: 0,
      centerMean,
      softCoreContrast: 0,
      softCentroidOffsetRatio: 0.7,
      ringMean: 170,
      outerMean: 245,
      nucleusFillRatio: 0,
      nucleusDarknessDelta: 0,
      contrasteCromaticoLocal: 0,
      margenCromatico: 0,
      strokeLeakPenalty: 0.3,
      shapeCompactness: 0,
      markConfidence: 0,
      largestComponentPixels: 0,
      largestComponentFillRatio: 0,
      largestComponentOffsetRatio: 1,
      largestComponentDensity: 0,
      largestComponentAspectRatio: Number.MAX_SAFE_INTEGER,
      estadoMarca: 'no_marcada',
      ...overrides
    });
    const scores = [
      score('A', 243.96),
      score('B', 252.98),
      score('C', 248.62, {
        largestComponentPixels: 2,
        largestComponentFillRatio: 0.0054,
        largestComponentOffsetRatio: 0.369,
        largestComponentDensity: 0.167,
        largestComponentAspectRatio: 3
      }),
      score('D', 253.07),
      score('E', 230.49, {
        fillRatioCore: 0.133,
        softCentroidOffsetRatio: 0.163,
        largestComponentPixels: 18,
        largestComponentFillRatio: 0.0483,
        largestComponentOffsetRatio: 0.309,
        largestComponentDensity: 0.257,
        largestComponentAspectRatio: 1.43
      })
    ];
    const args = {
      panelHorizontal: true,
      existeOpcionActual: false,
      dobleMarcada: false,
      tachada: false,
      scores
    };

    expect(seleccionarPuntoCompactoAisladoOmr(args)?.opcion).toBe('E');
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'E'
        ? { ...item, largestComponentAspectRatio: 3.5 }
        : item)
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'E'
        ? { ...item, centerMean: 243 }
        : item)
    })).toBeNull();
    expect(seleccionarPuntoCompactoAisladoOmr({ ...args, dobleMarcada: true })).toBeNull();
  });

  it('rescata una marca tenue con nucleo oscuro centrado y margen suficiente frente a las otras opciones', () => {
    const scores: ScoreOpcionOmr[] = (['A', 'B', 'C', 'D', 'E'] as const).map((opcion) => ({
      opcion,
      score: opcion === 'E' ? 0.043 : 0.1,
      fillRatioCore: opcion === 'E' ? 0.267 : 0.2,
      fillRatioRing: 0.24,
      fillDelta: 0,
      contraste: 0.03,
      radialMassRatio: 0.49,
      centroidOffsetRatio: opcion === 'E' ? 0.153 : 0.4,
      centerDarknessDelta: 0,
      centerMean: 214,
      softCoreContrast: 0.1,
      softCentroidOffsetRatio: 0.26,
      ringMean: 212,
      outerMean: 221,
      nucleusFillRatio: opcion === 'E' ? 0.377 : 0.2,
      nucleusDarknessDelta: opcion === 'E' ? 0.231 : (opcion === 'D' ? 0.173 : 0.12),
      strokeLeakPenalty: 0,
      shapeCompactness: 0.2,
      markConfidence: 0.23,
      largestComponentPixels: opcion === 'E' ? 95 : 30,
      largestComponentFillRatio: opcion === 'E' ? 0.255 : 0.1,
      largestComponentOffsetRatio: opcion === 'E' ? 0.202 : 0.4,
      largestComponentDensity: opcion === 'E' ? 0.348 : 0.2,
      largestComponentAspectRatio: opcion === 'E' ? 1.615 : 2.5,
      estadoMarca: 'parcial'
    }));
    const args = {
      panelHorizontal: true,
      existeOpcionActual: false,
      dobleMarcada: false,
      tachada: false,
      scores
    };

    expect(seleccionarNucleoTenueDominanteOmr(args)?.opcion).toBe('E');
    expect(seleccionarNucleoTenueDominanteOmr({ ...args, existeOpcionActual: true })).toBeNull();
    expect(seleccionarNucleoTenueDominanteOmr({ ...args, dobleMarcada: true })).toBeNull();
    expect(seleccionarNucleoTenueDominanteOmr({ ...args, tachada: true })).toBeNull();
    expect(seleccionarNucleoTenueDominanteOmr({ ...args, panelHorizontal: false })).toBeNull();
    expect(seleccionarNucleoTenueDominanteOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'D'
        ? { ...item, nucleusDarknessDelta: 0.19 }
        : item)
    })).toBeNull();
    expect(seleccionarNucleoTenueDominanteOmr({
      ...args,
      scores: scores.map((item) => item.opcion === 'E'
        ? { ...item, largestComponentAspectRatio: 2.1 }
        : item)
    })).toBeNull();
  });

  it('no conserva doble_marca si los rasgos muestran una sola opción con tinta', () => {
    const scores = (estadoUnico: 'marcada' | 'parcial', opcionUnica: 'A' | 'E') =>
      (['A', 'B', 'C', 'D', 'E'] as const).map((opcion) => {
        const esUnica = opcion === opcionUnica;
        return {
          opcion,
          score: esUnica ? (estadoUnico === 'marcada' ? 0.2 : 0.08) : 0,
          fillRatioCore: esUnica ? (estadoUnico === 'marcada' ? 0.67 : 0.4) : 0,
          fillRatioRing: 0.05,
          fillDelta: 0.1,
          contraste: esUnica ? 0.17 : 0,
          radialMassRatio: 0.5,
          centroidOffsetRatio: esUnica ? 0.05 : 0.95,
          centerDarknessDelta: 0.2,
          centerMean: 90,
          softCoreContrast: esUnica ? 0.1 : 0,
          softCentroidOffsetRatio: 0.2,
          ringMean: 150,
          outerMean: 180,
          nucleusFillRatio: esUnica ? (estadoUnico === 'marcada' ? 0.94 : 0.3) : 0,
          nucleusDarknessDelta: 0.1,
          strokeLeakPenalty: 0,
          shapeCompactness: 0.5,
          markConfidence: esUnica ? (estadoUnico === 'marcada' ? 0.8 : 0.25) : 0,
          estadoMarca: esUnica ? estadoUnico : 'no_marcada'
        };
      });
    const dominante = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 14,
      opcion: null,
      confianza: 0.3,
      scoresPorOpcion: scores('marcada', 'A'),
      flags: ['doble_marca', 'bajo_contraste']
    });
    const tenue = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 15,
      opcion: null,
      confianza: 0.2,
      scoresPorOpcion: scores('parcial', 'E'),
      flags: ['doble_marca', 'bajo_contraste']
    });
    const marcaCasiImperceptible = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 16,
      opcion: null,
      confianza: 0,
      scoresPorOpcion: scores('parcial', 'E').map((score) => score.opcion === 'E'
        ? {
            ...score,
            score: 0,
            contraste: 0,
            softCoreContrast: 0.024,
            fillRatioCore: 0.2,
            nucleusFillRatio: 0.333,
            radialMassRatio: 0.595,
            centroidOffsetRatio: 0.205,
            markConfidence: 0,
            shapeCompactness: 0.002
          }
        : score),
      flags: ['doble_marca', 'bajo_contraste']
    });

    expect(dominante.opcion).toBe('A');
    expect(dominante.estadoRespuesta).toBe('respondida');
    expect(dominante.flags).not.toContain('doble_marca');
    expect(tenue.opcion).toBe('E');
    expect(tenue.estadoRespuesta).toBe('respondida');
    expect(tenue.flags).not.toContain('doble_marca');
    expect(marcaCasiImperceptible.opcion).toBeNull();
    expect(marcaCasiImperceptible.estadoRespuesta).toBe('ambigua');
    expect(marcaCasiImperceptible.flags).not.toContain('doble_marca');
    expect(marcaCasiImperceptible.flags).toContain('parcial_detectada');
  });

  it('recupera una dominante multirasgo entre candidatas y conserva dobles comparables', () => {
    const crearScores = (valores: Partial<ScoreOpcionOmr>[]) =>
      (['A', 'B', 'C', 'D', 'E'] as const).map((opcion) => ({
        opcion,
        score: 0,
        fillRatioCore: 0,
        fillRatioRing: 0,
        fillDelta: 0,
        contraste: 0,
        radialMassRatio: 0,
        centroidOffsetRatio: 0,
        centerDarknessDelta: 0,
        centerMean: 255,
        softCoreContrast: 0,
        softCentroidOffsetRatio: 0,
        ringMean: 255,
        outerMean: 255,
        nucleusFillRatio: 0,
        nucleusDarknessDelta: 0,
        strokeLeakPenalty: 0,
        shapeCompactness: 0,
        markConfidence: 0,
        estadoMarca: 'no_marcada' as const,
        ...valores.find((valor) => valor.opcion === opcion)
      }));
    const marcaC = {
      opcion: 'C' as const,
      score: 0.332,
      fillRatioCore: 0.533,
      fillRatioRing: 0.286,
      contraste: 0.147,
      radialMassRatio: 0.361,
      centroidOffsetRatio: 0.131,
      nucleusFillRatio: 0.812,
      shapeCompactness: 0.351,
      markConfidence: 0.891,
      estadoMarca: 'marcada' as const
    };
    const ruidoB = {
      opcion: 'B' as const,
      score: 0.193,
      fillRatioCore: 0.467,
      fillRatioRing: 0.143,
      contraste: 0.086,
      radialMassRatio: 0.457,
      centroidOffsetRatio: 0.164,
      nucleusFillRatio: 0.493,
      shapeCompactness: 0.239,
      markConfidence: 0.58,
      estadoMarca: 'marcada' as const
    };
    const dominanteEspuria = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 22,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([marcaC, ruidoB]),
      flags: ['doble_marca', 'bajo_contraste']
    });
    const segundaMarcaReal = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 22,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([marcaC, { ...ruidoB, nucleusFillRatio: 0.68, markConfidence: 0.72, shapeCompactness: 0.42 }]),
      flags: ['doble_marca', 'bajo_contraste']
    });
    const candidatasCercanas = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 26,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([
        { ...marcaC, opcion: 'E', score: 0.258, markConfidence: 0.766, fillRatioCore: 0.4, nucleusFillRatio: 0.667 },
        { ...ruidoB, opcion: 'C', score: 0.247, markConfidence: 0.628, nucleusFillRatio: 0.391, shapeCompactness: 0.367 }
      ]),
      flags: ['doble_marca', 'bajo_contraste']
    });
    const tercerNucleoFuerte = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 22,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([
        marcaC,
        ruidoB,
        {
          opcion: 'D',
          score: 0.02,
          nucleusFillRatio: 0.8,
          shapeCompactness: 0.6,
          estadoMarca: 'parcial'
        }
      ]),
      flags: ['doble_marca', 'bajo_contraste']
    });

    expect(dominanteEspuria).toMatchObject({ opcion: 'C', estadoRespuesta: 'respondida' });
    expect(dominanteEspuria.flags).not.toContain('doble_marca');
    expect(segundaMarcaReal).toMatchObject({ opcion: null });
    expect(segundaMarcaReal.flags).toContain('doble_marca');
    expect(candidatasCercanas).toMatchObject({ opcion: null });
    expect(candidatasCercanas.flags).toContain('doble_marca');
    expect(tercerNucleoFuerte).toMatchObject({ opcion: null });
    expect(tercerNucleoFuerte.flags).toContain('doble_marca');

    // Caso real CamScanner, lote DE6B2F6D, folio 65E2471B, pagina 2,
    // pregunta 10: C tiene contraste/oscuridad local; A tiene nucleo aparente
    // pero casi nada de contraste, compatible con transparencia/residuo.
    const dobleConNucleoTrasero = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 10,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([
        {
          opcion: 'C', score: 0.436, fillRatioCore: 0.231, contraste: 0.198,
          centerDarknessDelta: 0.227, markConfidence: 0.778,
          centroidOffsetRatio: 0.195, shapeCompactness: 0.55,
          estadoMarca: 'marcada'
        },
        {
          opcion: 'A', score: 0.014, fillRatioCore: 0.231, contraste: 0,
          centerDarknessDelta: 0.029, nucleusFillRatio: 0.405,
          markConfidence: 0.184, centroidOffsetRatio: 0.2,
          shapeCompactness: 0.098, estadoMarca: 'marcada'
        },
        {
          opcion: 'B', score: 0.067, fillRatioCore: 0.231, contraste: 0.02,
          centerDarknessDelta: 0.076, markConfidence: 0.177,
          centroidOffsetRatio: 0.2, shapeCompactness: 0.076,
          estadoMarca: 'marcada'
        }
      ]),
      flags: ['doble_marca', 'parcial_detectada', 'bajo_contraste']
    });
    const dobleConContrasteCompetidor = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 11,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([
        {
          opcion: 'C', score: 0.436, fillRatioCore: 0.3, contraste: 0.198,
          centerDarknessDelta: 0.227, markConfidence: 0.778,
          centroidOffsetRatio: 0.195, estadoMarca: 'marcada'
        },
        {
          opcion: 'A', score: 0.2, fillRatioCore: 0.25, contraste: 0.16,
          centerDarknessDelta: 0.18, markConfidence: 0.55,
          centroidOffsetRatio: 0.2, estadoMarca: 'marcada'
        }
      ]),
      flags: ['doble_marca']
    });
    const dobleConCompetidorCromatico = normalizarDobleMarcadaPorEvidenciaOmr({
      numeroPregunta: 12,
      opcion: null,
      confianza: 0.5,
      scoresPorOpcion: crearScores([
        {
          opcion: 'C', score: 0.436, fillRatioCore: 0.3, contraste: 0.198,
          centerDarknessDelta: 0.227, markConfidence: 0.778,
          centroidOffsetRatio: 0.195, estadoMarca: 'marcada'
        },
        {
          opcion: 'A', score: 0.08, fillRatioCore: 0.1,
          contrasteCromaticoLocal: 0.05, margenCromatico: 0.04,
          centroidOffsetRatio: 0.2, estadoMarca: 'parcial'
        }
      ]),
      flags: ['doble_marca']
    });

    expect(dobleConNucleoTrasero).toMatchObject({ opcion: 'C', estadoRespuesta: 'respondida' });
    expect(dobleConNucleoTrasero.flags).not.toContain('doble_marca');
    expect(dobleConContrasteCompetidor).toMatchObject({ opcion: null });
    expect(dobleConContrasteCompetidor.flags).toContain('doble_marca');
    expect(dobleConCompetidorCromatico).toMatchObject({ opcion: null });
    expect(dobleConCompetidorCromatico.flags).toContain('doble_marca');
  });
});
