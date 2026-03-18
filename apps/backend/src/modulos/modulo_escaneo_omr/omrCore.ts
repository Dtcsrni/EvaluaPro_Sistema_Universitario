/**
 * omrCore
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
export type Punto = { x: number; y: number };

export type ParametrosBurbujaCore = {
  radio: number;
  ringInner: number;
  ringOuter: number;
  outerOuter: number;
  paso: number;
};

export type CentroOpcion = { letra: string; punto: Punto };

export type OpcionScore = { letra: string; score: number; x: number; y: number };

export type EvaluarConOffsetResultado = {
  mejorOpcion: string | null;
  mejorScore: number;
  segundoScore: number;
  scores: OpcionScore[];
};

export type EstadoImagenOmr = {
  gray: Uint8ClampedArray;
  integral: Uint32Array;
  width: number;
  height: number;
  escalaX: number;
  paramsBurbuja: ParametrosBurbujaCore;
};

export type MetricasPregunta = {
  mejorOpcion: string | null;
  mejorScore: number;
  segundoScore: number;
  delta: number;
  topZScore: number;
  dobleMarcada: boolean;
  suficiente: boolean;
  confianza: number;
  scoreMean: number;
  scoreStd: number;
  scoreThreshold: number;
  validacionAlternativas: ValidacionAlternativas;
};

export type DiagnosticoAlternativa = {
  letra: string;
  score: number;
  ratioCore: number;
  fillDelta: number;
  contraste: number;
  confianzaHibrida: number;
  sinMarca: boolean;
  razon: string;
};

export type ValidacionAlternativas = {
  opcionSeleccionada: string | null;
  totalAlternativas: number;
  alternativasSinMarca: number;
  alternativasConMarca: number;
  cumpleDescarte: boolean;
  maxScoreAlternativa: number;
  maxRatioCoreAlternativa: number;
  maxFillDeltaAlternativa: number;
  diagnostico: DiagnosticoAlternativa[];
};

export type UmbralesDecisionOmr = {
  scoreMin: number;
  scoreStd: number;
  strongScore: number;
  secondRatio: number;
  deltaMin: number;
  minTopZScore?: number;
  ambiguityRatio?: number;
  minTopScoreForAmbiguity?: number;
  minFillDelta?: number;
  minCenterGap?: number;
  minHybridConfidence?: number;
};

type RasgosBurbuja = {
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

function calcularRangoLocalBusqueda(
  centros: CentroOpcion[],
  params: ParametrosBurbujaCore,
  localSearchRatio: number
) {
  if (centros.length < 2) return Math.max(4, Math.round(params.radio * 0.5));
  const distanciaMin = calcularDistanciaMinimaCentros(centros);
  const porRadio = Math.max(4, Math.round(params.radio * 0.5));
  const porDistancia = Number.isFinite(distanciaMin)
    ? Math.max(4, Math.round(distanciaMin * localSearchRatio))
    : Math.max(4, Math.round(params.ringOuter * 0.7));
  const limiteVecino = Number.isFinite(distanciaMin)
    ? Math.max(4, Math.round(distanciaMin * 0.32))
    : Math.max(4, Math.round(params.ringOuter * 0.7));
  return Math.min(Math.max(porRadio, porDistancia), limiteVecino, Math.max(4, Math.round(params.ringOuter * 0.7)));
}

export function calcularDistanciaMinimaCentros(centros: CentroOpcion[]) {
  if (centros.length < 2) return Number.POSITIVE_INFINITY;
  let distanciaMin = Number.POSITIVE_INFINITY;
  for (let i = 0; i < centros.length; i += 1) {
    for (let j = i + 1; j < centros.length; j += 1) {
      const dx = centros[i].punto.x - centros[j].punto.x;
      const dy = centros[i].punto.y - centros[j].punto.y;
      const distancia = Math.hypot(dx, dy);
      if (distancia > 0.5 && distancia < distanciaMin) distanciaMin = distancia;
    }
  }
  return distanciaMin;
}

export function evaluarConOffset(args: {
  gray: Uint8ClampedArray;
  integral: Uint32Array;
  width: number;
  height: number;
  centros: CentroOpcion[];
  dx: number;
  dy: number;
  params: ParametrosBurbujaCore;
  localSearchRatio: number;
  localSearchRadiusPx?: number;
  localDriftPenalty: number;
  detectarOpcion: (
    gray: Uint8ClampedArray,
    integral: Uint32Array,
    width: number,
    height: number,
    centro: Punto,
    params: ParametrosBurbujaCore
  ) => { score: number };
}): EvaluarConOffsetResultado {
  const {
    gray,
    integral,
    width,
    height,
    centros,
    dx,
    dy,
    params,
    localSearchRatio,
    localSearchRadiusPx,
    localDriftPenalty,
    detectarOpcion
  } = args;
  let mejorOpcion: string | null = null;
  let mejorScore = 0;
  let segundoScore = 0;
  const scores: OpcionScore[] = [];
  const rangoLocalCalculado = calcularRangoLocalBusqueda(centros, params, localSearchRatio);
  const rangoLocal = Math.max(0, Math.round(localSearchRadiusPx ?? rangoLocalCalculado));
  const pasoLocal = Math.max(1, Math.round(rangoLocal / 4));

  for (const opcion of centros) {
    const base = { x: opcion.punto.x + dx, y: opcion.punto.y + dy };
    if (rangoLocal <= 0) {
      const { score } = detectarOpcion(gray, integral, width, height, base, params);
      scores.push({ letra: opcion.letra, score: Math.max(0, score), x: base.x, y: base.y });
      if (score > mejorScore) {
        segundoScore = mejorScore;
        mejorScore = score;
        mejorOpcion = opcion.letra;
      } else if (score > segundoScore) {
        segundoScore = score;
      }
      continue;
    }
    let mejorLocal = -Infinity;
    let mejorLocalAjustado = -Infinity;
    let mejorX = base.x;
    let mejorY = base.y;
    for (let oy = -rangoLocal; oy <= rangoLocal; oy += pasoLocal) {
      for (let ox = -rangoLocal; ox <= rangoLocal; ox += pasoLocal) {
        if (ox * ox + oy * oy > rangoLocal * rangoLocal) continue;
        const punto = { x: base.x + ox, y: base.y + oy };
        const { score } = detectarOpcion(gray, integral, width, height, punto, params);
        const desplazamientoNormalizado = Math.hypot(ox, oy) / Math.max(1, rangoLocal);
        const scoreAjustado = score - desplazamientoNormalizado * localDriftPenalty;
        if (scoreAjustado > mejorLocalAjustado) {
          mejorLocalAjustado = scoreAjustado;
          mejorLocal = score;
          mejorX = punto.x;
          mejorY = punto.y;
        }
      }
    }
    const score = Math.max(0, mejorLocal);
    scores.push({ letra: opcion.letra, score, x: mejorX, y: mejorY });
    if (score > mejorScore) {
      segundoScore = mejorScore;
      mejorScore = score;
      mejorOpcion = opcion.letra;
    } else if (score > segundoScore) {
      segundoScore = score;
    }
  }

  return { mejorOpcion, mejorScore, segundoScore, scores };
}

export function buscarMejorOffsetPregunta(args: {
  estado: EstadoImagenOmr;
  centros: CentroOpcion[];
  alignRange: number;
  maxCenterDriftRatio?: number;
  minSafeRange?: number;
  evaluarAlineacionOffset: (
    gray: Uint8ClampedArray,
    integral: Uint32Array,
    width: number,
    height: number,
    centros: CentroOpcion[],
    dx: number,
    dy: number,
    params: ParametrosBurbujaCore
  ) => number;
}) {
  const { estado, centros, alignRange, maxCenterDriftRatio = 0.3, minSafeRange = 4, evaluarAlineacionOffset } = args;
  const { gray, integral, width, height, paramsBurbuja } = estado;
  const distanciaMinCentros = calcularDistanciaMinimaCentros(centros);
  const rangoBase = Math.max(alignRange, Math.round(paramsBurbuja.ringOuter * 1.2));
  const rangoSeguro = Number.isFinite(distanciaMinCentros)
    ? Math.max(minSafeRange, Math.round(distanciaMinCentros * maxCenterDriftRatio))
    : rangoBase;
  const rango = Math.min(rangoBase, rangoSeguro);
  const paso = Math.max(1, Math.round(paramsBurbuja.radio / 4));

  let mejorDx = 0;
  let mejorDy = 0;
  let mejorAlineacion = -Infinity;
  for (let dy = -rango; dy <= rango; dy += paso) {
    for (let dx = -rango; dx <= rango; dx += paso) {
      const alineacion = evaluarAlineacionOffset(gray, integral, width, height, centros, dx, dy, paramsBurbuja);
      if (alineacion > mejorAlineacion) {
        mejorAlineacion = alineacion;
        mejorDx = dx;
        mejorDy = dy;
      }
    }
  }
  return { mejorDx, mejorDy };
}

export function calcularMetricasPregunta(args: {
  estado: EstadoImagenOmr;
  centros: CentroOpcion[];
  resultado: EvaluarConOffsetResultado;
  mejorDx: number;
  mejorDy: number;
  umbrales: UmbralesDecisionOmr;
  detectarOpcion: (
    gray: Uint8ClampedArray,
    integral: Uint32Array,
    width: number,
    height: number,
    centro: Punto,
    params: ParametrosBurbujaCore
  ) => RasgosBurbuja;
}): MetricasPregunta {
  const { estado, centros, resultado, mejorDx, mejorDy, umbrales, detectarOpcion } = args;
  const { gray, integral, width, height, paramsBurbuja } = estado;
  const mejorScore = resultado.mejorScore;
  const segundoScore = resultado.segundoScore;
  const delta = mejorScore - segundoScore;
  const ratio = segundoScore / Math.max(0.0001, mejorScore);
  const scores = resultado.scores.map((item) => item.score);
  const promedioScore = scores.reduce((acc, val) => acc + val, 0) / Math.max(1, scores.length);
  const varianzaScore =
    scores.reduce((acc, val) => acc + (val - promedioScore) * (val - promedioScore), 0) / Math.max(1, scores.length);
  const desviacionScore = Math.sqrt(Math.max(0, varianzaScore));
  const umbralScore = Math.max(umbrales.scoreMin, promedioScore + umbrales.scoreStd * desviacionScore);
  const topScores = resultado.scores.map((item) => item.score).sort((a, b) => b - a);
  const top1 = topScores[0] ?? 0;
  const top2 = topScores[1] ?? 0;
  const topRatio = top2 / Math.max(0.0001, top1);
  const ascScores = [...topScores].sort((a, b) => a - b);
  const midIdx = Math.floor(ascScores.length / 2);
  const mediana =
    ascScores.length % 2 === 0
      ? ((ascScores[midIdx - 1] ?? 0) + (ascScores[midIdx] ?? 0)) / 2
      : (ascScores[midIdx] ?? 0);
  const desvAbs = ascScores.map((score) => Math.abs(score - mediana)).sort((a, b) => a - b);
  const madIdx = Math.floor(desvAbs.length / 2);
  const mad =
    desvAbs.length % 2 === 0
      ? ((desvAbs[madIdx - 1] ?? 0) + (desvAbs[madIdx] ?? 0)) / 2
      : (desvAbs[madIdx] ?? 0);
  const topZScore = (top1 - mediana) / Math.max(0.015, mad * 1.4826);
  const minTopZScore = umbrales.minTopZScore ?? 1.25;
  const ambiguityRatio = umbrales.ambiguityRatio ?? 0.87;
  const minTopScoreForAmbiguity = umbrales.minTopScoreForAmbiguity ?? Math.max(umbrales.strongScore * 0.9, umbralScore * 0.85);
  const scoresDirectos = centros.map((item) => ({
    letra: item.letra,
    score: detectarOpcion(gray, integral, width, height, { x: item.punto.x + mejorDx, y: item.punto.y + mejorDy }, paramsBurbuja).score
  }));
  const ordenDirectos = [...scoresDirectos].sort((a, b) => b.score - a.score);
  const topDirecto = ordenDirectos[0];
  const secondDirecto = ordenDirectos[1];
  const ratioDirecto = (secondDirecto?.score ?? 0) / Math.max(0.0001, topDirecto?.score ?? 0.0001);
  const consistenciaAnclada = Boolean(topDirecto && resultado.mejorOpcion && topDirecto.letra === resultado.mejorOpcion);
  const scoreMinAnclado = Math.max(umbrales.scoreMin * 0.95, umbralScore * 0.85);
  const anclaConfiable = (topDirecto?.score ?? 0) >= scoreMinAnclado && ratioDirecto <= 0.92;

  const ordenar = [...resultado.scores].sort((a, b) => b.score - a.score);
  const top = ordenar[0];
  const second = ordenar[1];
  const rasgosPorLetra = new Map<string, RasgosBurbuja>();
  for (const item of resultado.scores) {
    rasgosPorLetra.set(
      item.letra,
      detectarOpcion(gray, integral, width, height, { x: item.x, y: item.y }, paramsBurbuja)
    );
  }
  const rasgosTop = top ? rasgosPorLetra.get(top.letra) ?? null : null;
  const rasgosSecond = second ? rasgosPorLetra.get(second.letra) ?? null : null;

  const minFillDelta = umbrales.minFillDelta ?? 0.08;
  const minCenterGap = umbrales.minCenterGap ?? 10;
  const minHybridConfidence = umbrales.minHybridConfidence ?? 0.35;

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const confianzaHibrida = (rasgos: RasgosBurbuja | null) => {
    if (!rasgos) return 0;
    const gapCentro = rasgos.ringMean - rasgos.centerMean;
    const fFill = clamp01((rasgos.fillDelta - minFillDelta) / 0.14);
    const fGap = clamp01((gapCentro - minCenterGap) / 28);
    const fCore = clamp01((rasgos.ratioCore - 0.19) / 0.28);
    const fMid = clamp01((rasgos.ratioMid - 0.16) / 0.24);
    const fRadial = clamp01((rasgos.radialMassRatio - 0.33) / 0.3);
    const fContraste = clamp01((rasgos.contraste - 0.06) / 0.22);
    const pAniso = clamp01((rasgos.anisotropy - 2.4) / 3.6);
    const pRing = clamp01((rasgos.ratioRing - 0.35) / 0.5);
    const pRingOnly = clamp01((rasgos.ringOnlyPenalty - 0.06) / 0.26);
    const pCentroide = clamp01((rasgos.centroidOffsetRatio - 0.2) / 0.45);
    return clamp01(
      fFill * 0.28 +
        fGap * 0.24 +
        fCore * 0.2 +
        fMid * 0.11 +
        fRadial * 0.09 +
        fContraste * 0.08 -
        pAniso * 0.1 -
        pRing * 0.12 -
        pRingOnly * 0.2 -
        pCentroide * 0.15
    );
  };

  const hTop = confianzaHibrida(rasgosTop);
  const hSecond = confianzaHibrida(rasgosSecond);
  const gapCentroTop = rasgosTop ? rasgosTop.ringMean - rasgosTop.centerMean : 0;
  const ringOnlyTop = rasgosTop?.ringOnlyPenalty ?? 0;

  const umbralMarcaScoreAlternativa = Math.max(umbrales.strongScore * 1.08, umbralScore * 1.02, 0.14);
  const umbralMarcaRatioCoreAlternativa = 0.19;
  const umbralMarcaFillDeltaAlternativa = Math.max(0.07, minFillDelta * 0.86);
  const umbralMarcaHibridaAlternativa = Math.max(0.34, minHybridConfidence * 0.82);

  const diagnosticoAlternativas: DiagnosticoAlternativa[] = resultado.scores
    .filter((item) => item.letra !== resultado.mejorOpcion)
    .map((item) => {
      const rasgos = rasgosPorLetra.get(item.letra);
      const ratioCore = rasgos?.ratioCore ?? 0;
      const fillDelta = rasgos?.fillDelta ?? 0;
      const contraste = rasgos?.contraste ?? 0;
      const confHibrida = confianzaHibrida(rasgos ?? null);
      const hayMarca =
        (item.score >= umbralMarcaScoreAlternativa && (ratioCore >= umbralMarcaRatioCoreAlternativa || confHibrida >= umbralMarcaHibridaAlternativa)) ||
        (ratioCore >= umbralMarcaRatioCoreAlternativa && fillDelta >= umbralMarcaFillDeltaAlternativa) ||
        confHibrida >= umbralMarcaHibridaAlternativa;
      const razon = hayMarca
        ? `Marca potencial (score=${item.score.toFixed(3)}, core=${ratioCore.toFixed(3)}, fill=${fillDelta.toFixed(3)})`
        : `Sin marca (score=${item.score.toFixed(3)}, core=${ratioCore.toFixed(3)}, fill=${fillDelta.toFixed(3)})`;
      return {
        letra: item.letra,
        score: item.score,
        ratioCore,
        fillDelta,
        contraste,
        confianzaHibrida: confHibrida,
        sinMarca: !hayMarca,
        razon
      };
    });

  const alternativasConMarca = diagnosticoAlternativas.filter((item) => !item.sinMarca).length;
  const alternativasSinMarca = diagnosticoAlternativas.length - alternativasConMarca;
  const validacionAlternativas: ValidacionAlternativas = {
    opcionSeleccionada: resultado.mejorOpcion,
    totalAlternativas: diagnosticoAlternativas.length,
    alternativasSinMarca,
    alternativasConMarca,
    cumpleDescarte: diagnosticoAlternativas.length > 0 ? alternativasConMarca === 0 : Boolean(resultado.mejorOpcion),
    maxScoreAlternativa: diagnosticoAlternativas.reduce((m, item) => Math.max(m, item.score), 0),
    maxRatioCoreAlternativa: diagnosticoAlternativas.reduce((m, item) => Math.max(m, item.ratioCore), 0),
    maxFillDeltaAlternativa: diagnosticoAlternativas.reduce((m, item) => Math.max(m, item.fillDelta), 0),
    diagnostico: diagnosticoAlternativas
  };

  const secondTieneMarca = second ? !validacionAlternativas.diagnostico.find((item) => item.letra === second.letra)?.sinMarca : false;
  const alternativasFuertes = validacionAlternativas.diagnostico.filter(
    (item) =>
      !item.sinMarca &&
      ((top ? item.score >= Math.max(umbralMarcaScoreAlternativa, top.score * 0.9) : false) ||
        item.confianzaHibrida >= Math.max(umbralMarcaHibridaAlternativa, hTop * 0.82))
  ).length;
  const alternativasVisibles = validacionAlternativas.alternativasConMarca;
  const baselineScore = ascScores.length >= 2 ? ((ascScores[0] ?? 0) + (ascScores[1] ?? ascScores[0] ?? 0)) / 2 : ascScores[0] ?? 0;
  const scoreSobreBaseline = top1 - baselineScore;
  const topGapConAlternativa = top1 - Math.max(validacionAlternativas.maxScoreAlternativa, 0);

  const dobleMarcada =
    (secondTieneMarca &&
      segundoScore >= Math.max(umbrales.strongScore * 1.02, umbralMarcaScoreAlternativa) &&
      ratio >= Math.max(umbrales.secondRatio, 0.84) &&
      delta < Math.max(umbrales.deltaMin * 2.2, 0.075)) ||
    alternativasFuertes >= 2 ||
    (alternativasVisibles >= 2 && topRatio >= 0.82) ||
    (top1 >= minTopScoreForAmbiguity &&
      topRatio >= Math.max(ambiguityRatio, 0.9) &&
      topZScore >= minTopZScore * 0.88 &&
      secondTieneMarca) ||
    (hTop >= minHybridConfidence * 0.95 && hSecond >= minHybridConfidence * 0.92 && topRatio >= 0.9);
  const suficienteBase = mejorScore >= umbralScore && delta >= umbrales.deltaMin && topZScore >= minTopZScore;
  const suficienteRelativa =
    scoreSobreBaseline >= Math.max(umbrales.deltaMin * 2.4, 0.085) &&
    hTop >= minHybridConfidence * 0.82 &&
    topGapConAlternativa >= 0.06 &&
    (!secondTieneMarca || topRatio <= 0.82);
  const suficienteHibrida =
    hTop >= minHybridConfidence &&
    (rasgosTop ? rasgosTop.fillDelta >= minFillDelta : false) &&
    gapCentroTop >= minCenterGap &&
    ringOnlyTop < 0.32;
  const suficienteHibridaFlex =
    hTop >= minHybridConfidence * 0.82 &&
    gapCentroTop >= minCenterGap * 0.78 &&
    ringOnlyTop < 0.38 &&
    topRatio <= 0.72;
  const respaldoDominante = topZScore >= minTopZScore + 0.45 && topRatio <= 0.66 && mejorScore >= umbralScore * 1.03;
  const suficienteDescarte = validacionAlternativas.cumpleDescarte;
  const suficiente =
    (suficienteBase || suficienteRelativa) &&
    (suficienteHibrida || suficienteHibridaFlex || respaldoDominante) &&
    (consistenciaAnclada || anclaConfiable || respaldoDominante || suficienteRelativa) &&
    suficienteDescarte;
  const confianzaBase = Math.min(1, Math.max(0, mejorScore * 1.8));
  const penalizacion = dobleMarcada ? 0.5 : 1;
  const penalizacionAnclada = consistenciaAnclada ? 1 : anclaConfiable ? 0.72 : 0.35;
  const penalizacionDescarte = validacionAlternativas.cumpleDescarte
    ? 1.08
    : validacionAlternativas.alternativasConMarca >= 2
      ? 0.35
      : 0.58;
  const zBoost = clamp01((topZScore - 1) / 4);
  const confianza = suficiente
    ? Math.min(
        1,
        (confianzaBase * 0.45 + hTop * 0.4 + Math.min(0.5, delta * 3) * 0.55 + zBoost * 0.2) *
          penalizacion *
          penalizacionAnclada *
          penalizacionDescarte
      )
    : 0;

  return {
    mejorOpcion: resultado.mejorOpcion,
    mejorScore,
    segundoScore,
    delta,
    topZScore,
    dobleMarcada,
    suficiente,
    confianza,
    scoreMean: promedioScore,
    scoreStd: desviacionScore,
    scoreThreshold: umbralScore,
    validacionAlternativas
  };
}
