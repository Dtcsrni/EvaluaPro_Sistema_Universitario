/**
 * Decision OMR v2 para fusionar pasadas con distinto preprocesamiento.
 *
 * La comparacion usa el vector de las cinco opciones de cada reactivo, no
 * scores absolutos entre imagenes. Esto reduce el sesgo por contraste y
 * conserva una abstencion explicita cuando la evidencia no es separable.
 */

export type EvidenciaOpcionOmr = {
  opcion: string;
  score: number;
  fillRatioCore: number;
  fillRatioRing: number;
  contraste?: number;
  shapeCompactness: number;
  markConfidence: number;
  nucleusFillRatio?: number;
  nucleusDarknessDelta?: number;
  radialMassRatio?: number;
  centroidOffsetRatio?: number;
  softCoreContrast?: number;
  softCentroidOffsetRatio?: number;
  centerDarknessDelta?: number;
  estadoMarca: string;
};

export type EvidenciaRespuestaOmr = {
  opcion: string | null;
  confianza: number;
  scoresPorOpcion: EvidenciaOpcionOmr[];
  flags: readonly string[];
};

export type ResultadoConsensoRespuestaOmr = {
  opcion: string | null;
  confianza: number;
  scoresPorOpcion: EvidenciaOpcionOmr[];
  flags: string[];
  modo: 'consenso' | 'rescate' | 'conflicto_resuelto' | 'abstencion' | 'invalida';
};

export type CandidataEstableOmr = {
  opcion: string;
  evidencia: EvidenciaRespuestaOmr;
  repeticiones: number;
  fuerza: number;
};

type FuerzaCandidata = {
  opcion: string | null;
  valida: boolean;
  fuerza: number;
  margen: number;
  separacionRobusta: number;
  forma: number;
  puntoCentral: boolean;
  marcaFotometricaTenue: boolean;
  marcaDominanteAislada: boolean;
};

const INVALIDANTES = new Set(['doble_marca', 'tachada_detectada']);

function limitar01(valor: number) {
  return Math.max(0, Math.min(1, Number.isFinite(valor) ? valor : 0));
}

function mediana(valores: number[]) {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? ((ordenados[mitad - 1] ?? 0) + (ordenados[mitad] ?? 0)) / 2
    : ordenados[mitad] ?? 0;
}

function calcularFuerza(evidencia: EvidenciaRespuestaOmr): FuerzaCandidata {
  const scores = evidencia.scoresPorOpcion
    .filter((item) => item && typeof item.opcion === 'string')
    .map((item) => ({ ...item, score: Number.isFinite(item.score) ? item.score : 0 }))
    .sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];
  // Una lectura en blanco no puede convertirse en candidata por el mero
  // desempate del primer elemento A. Solo se infiere opcion cuando existe una
  // señal minima independiente de la etiqueta producida por la pasada.
  const microNucleoAislado = Boolean(
    top &&
    Number(top.nucleusFillRatio) >= 0.55 &&
    Number(top.nucleusDarknessDelta) >= 0.18 &&
    Number(top.fillRatioCore) >= 0.18 &&
    Number(top.shapeCompactness) >= 0.15
  );
  const marcaFotometricaTenueDebilAislada = Boolean(
    top &&
    Number(top.score) >= 0.03 &&
    Number(top.score) - Number(second?.score ?? 0) >= 0.02 &&
    Number(second?.score ?? 0) / Math.max(0.0001, Number(top.score)) <= 0.72 &&
    Number(top.fillRatioCore) >= 0.2 &&
    Number(top.fillRatioCore) - Number(second?.fillRatioCore ?? 0) >= 0.04 &&
    Number(top.contraste) >= 0.08 &&
    Number(top.radialMassRatio) >= 0.18 &&
    Number(top.centroidOffsetRatio) <= 0.6 &&
    Number(top.shapeCompactness) >= 0.18 &&
    Number(top.markConfidence) >= 0.1
  );
  const marcaNucleoTenueAislada = Boolean(
    top &&
    Number(top.fillRatioCore) >= 0.18 &&
    Number(top.fillRatioCore) - Number(second?.fillRatioCore ?? 0) >= 0.08 &&
    Number(second?.score ?? 0) <= 0.08 &&
    Number(top.markConfidence) >= 0.1 &&
    Number(top.shapeCompactness) >= 0.15 &&
    Number(top.centroidOffsetRatio) <= 0.6 &&
    Number(top.softCoreContrast) >= 0.06
  );
  const marcaFotometricaTenue = Boolean(
    top &&
    (
      (
        Number(top.score) >= 0.045 &&
        Number(top.fillRatioCore) >= 0.24 &&
        Number(top.contraste) >= 0.13 &&
        Number(top.radialMassRatio) >= 0.2 &&
        Number(top.centroidOffsetRatio) <= 0.3 &&
        Number(top.shapeCompactness) >= 0.2 &&
        Number(second?.score ?? 0) <= 0.03
      ) ||
      // En fotos reales de baja resolución, el borde y el texto impreso
      // pueden dejar una segunda puntuación moderada aunque la candidata
      // marcada conserve un núcleo, contraste y forma claramente superiores.
      // Esta variante solo se activa con separación relativa y absoluta,
      // diferencia de núcleo y desplazamiento acotado; dos señales
      // comparables no pasan el rescate.
      (
        Number(top.score) >= 0.18 &&
        Number(top.score) - Number(second?.score ?? 0) >= 0.11 &&
        Number(second?.score ?? 0) / Math.max(0.0001, Number(top.score)) <= 0.72 &&
        Number(top.fillRatioCore) >= 0.25 &&
        Number(top.fillRatioCore) - Number(second?.fillRatioCore ?? 0) >= 0.04 &&
        Number(top.contraste) >= 0.11 &&
        Number(top.radialMassRatio) >= 0.3 &&
        Number(top.centroidOffsetRatio) <= 0.38 &&
        Number(top.shapeCompactness) >= 0.18 &&
        Number(top.markConfidence) >= 0.45
      ) ||
      // La misma tinta tenue puede reaparecer en dos hipótesis geométricas
      // independientes aunque el score absoluto quede bajo. El consenso
      // multipase exige repetición y conserva el umbral de separación para no
      // convertir sombreado distribuido en una respuesta.
      (
        Number(top.score) >= 0.045 &&
        Number(top.fillRatioCore) >= 0.24 &&
        Number(top.softCoreContrast) >= 0.16 &&
        Number(top.softCentroidOffsetRatio) <= 0.28 &&
        Number(top.contraste) >= 0.12 &&
        Number(top.radialMassRatio) >= 0.35 &&
        Number(top.centroidOffsetRatio) <= 0.38 &&
        Number(top.shapeCompactness) >= 0.18 &&
        Number(top.markConfidence) >= 0.1 &&
        Number(second?.score ?? 0) <= 0.03
      ) ||
      // Marca moderada repetida entre pasadas: la binarización puede dejar
      // score y compacidad por debajo del rescate fuerte, aunque ambas
      // hipótesis conserven la misma burbuja aislada. El segundo score debe
      // ser prácticamente nulo para no aceptar una doble degradada.
      (
        Number(top.score) >= 0.18 &&
        Number(top.score) - Number(second?.score ?? 0) >= 0.1 &&
        Number(second?.score ?? 0) <= 0.08 &&
        Number(top.fillRatioCore) >= 0.26 &&
        Number(top.softCoreContrast) >= 0.09 &&
        Number(top.contraste) >= 0.055 &&
        Number(top.radialMassRatio) >= 0.18 &&
        Number(top.centroidOffsetRatio) <= 0.38 &&
        Number(top.shapeCompactness) >= 0.15 &&
        Number(top.markConfidence) >= 0.1
      ) ||
      marcaFotometricaTenueDebilAislada ||
      marcaNucleoTenueAislada
    )
  );
  const marcaDominanteAislada = Boolean(
    top &&
    Number(top.score) >= 0.52 &&
    Number(top.score) - Number(second?.score ?? 0) >= 0.28 &&
    Number(second?.score ?? 0) <= 0.17 &&
    Number(top.fillRatioCore) >= 0.32 &&
    Number(second?.fillRatioCore ?? 0) <= 0.25 &&
    Number(top.contraste) >= 0.16 &&
    Number(second?.contraste ?? 0) <= 0.1 &&
    Number(top.softCoreContrast) >= 0.12 &&
    Number(top.radialMassRatio) >= 0.22 &&
    Number(top.centroidOffsetRatio) <= 0.38 &&
    Number(top.shapeCompactness) >= 0.32 &&
    Number(top.markConfidence) >= 0.75
  );
  // Un score relativo no basta para inventar una respuesta cuando la pasada
  // se abstuvo: los bordes/textos pueden dominar el ranking. Solo la
  // evidencia micro-central independiente puede convertir una abstención en
  // candidata; una etiqueta ya emitida por la pasada sí puede rescatarse.
  const opcion = evidencia.opcion ?? (top && (microNucleoAislado || marcaFotometricaTenue) ? top.opcion : null);
  const candidato = scores.find((item) => item.opcion === opcion) ?? top;
  if (!candidato || !opcion) {
    return { opcion: null, valida: false, fuerza: 0, margen: 0, separacionRobusta: 0, forma: 0, puntoCentral: false, marcaFotometricaTenue: false, marcaDominanteAislada: false };
  }

  const valores = scores.map((item) => item.score);
  const centro = mediana(valores);
  const mad = mediana(valores.map((valor) => Math.abs(valor - centro)));
  const escalaRobusta = Math.max(0.02, mad * 1.4826);
  const separacionRobusta = limitar01(((candidato.score - centro) / escalaRobusta - 1) / 5);
  const margen = limitar01((candidato.score - (second?.score ?? 0) - 0.025) / 0.28);
  const forma = limitar01(
    Number(candidato.markConfidence) * 0.36 +
      Number(candidato.fillRatioCore) * 0.3 +
      Number(candidato.shapeCompactness) * 0.2 +
      limitar01(Number(candidato.nucleusFillRatio)) * 0.1 +
      limitar01(Number(candidato.nucleusDarknessDelta)) * 0.1 +
      (1 - limitar01(Number(candidato.fillRatioRing))) * 0.14
  );
  const puntoCentral =
    Number(candidato.fillRatioCore) >= 0.12 &&
    Number(candidato.fillRatioCore) <= 0.18 &&
    Number(candidato.radialMassRatio ?? 0) >= 0.45 &&
    Number(candidato.centroidOffsetRatio) <= 0.5 &&
    Number(candidato.shapeCompactness) >= 0.15 &&
    Number(second?.fillRatioCore ?? 0) <= 0.08;
  const invalida = evidencia.flags.some((flag) => INVALIDANTES.has(flag));
  const fuerza = limitar01(
    limitar01(evidencia.confianza) * 0.34 +
      margen * 0.25 +
      forma * 0.24 +
      separacionRobusta * 0.17
  );
  return {
    opcion,
    // Si la etiqueta declarada por una pasada ya no coincide con su propio
    // maximo, no se permite que un score rezagado sobreviva a la fusion.
    valida: !invalida && candidato.opcion === opcion && candidato.score >= (top?.score ?? 0) * 0.92,
    fuerza,
    margen,
    separacionRobusta,
    forma,
    puntoCentral,
    marcaFotometricaTenue,
    marcaDominanteAislada
  };
}

/**
 * Busca una candidata repetida en varias hipótesis de lectura.
 *
 * Una hipótesis aislada no basta: la candidata debe estar etiquetada por su
 * propia pasada, no tener flags invalidantes y conservar rasgos fotométricos
 * aislados. La repetición en dos pasadas reduce los falsos positivos que una
 * transformación local puede producir en un panel horizontal.
 */
export function rescatarCandidataEstableEntrePasadas(
  evidencias: readonly EvidenciaRespuestaOmr[]
): CandidataEstableOmr | null {
  const candidatas = evidencias
    .map((evidencia) => ({ evidencia, fuerza: calcularFuerza(evidencia) }))
    .filter(({ evidencia, fuerza }) =>
      Boolean(
        fuerza.valida &&
        fuerza.opcion &&
        fuerza.marcaFotometricaTenue &&
        fuerza.fuerza >= 0.2 &&
        !evidencia.flags.some((flag) => INVALIDANTES.has(flag))
      )
    );
  if (candidatas.length < 2) return null;

  const grupos = new Map<string, typeof candidatas>();
  for (const candidata of candidatas) {
    const grupo = grupos.get(candidata.fuerza.opcion!) ?? [];
    grupo.push(candidata);
    grupos.set(candidata.fuerza.opcion!, grupo);
  }
  const repetidas = [...grupos.entries()]
    .filter(([, grupo]) => grupo.length >= 2)
    .sort((a, b) => {
      const repeticiones = b[1].length - a[1].length;
      if (repeticiones !== 0) return repeticiones;
      return Math.max(...b[1].map((item) => item.fuerza.fuerza)) -
        Math.max(...a[1].map((item) => item.fuerza.fuerza));
    });
  const [opcion, grupo] = repetidas[0] ?? [];
  if (!opcion || !grupo) return null;
  const mejor = [...grupo].sort((a, b) => b.fuerza.fuerza - a.fuerza.fuerza)[0];
  return {
    opcion,
    evidencia: mejor.evidencia,
    repeticiones: grupo.length,
    fuerza: mejor.fuerza.fuerza
  };
}

/**
 * Recupera una marca muy tenue cuando una pasada conserva la etiqueta y otra
 * la vuelve a encontrar como dominante con score bajo. Requiere rasgos físicos
 * en ambas pasadas y nunca atraviesa una doble marca o tachadura.
 */
export function rescatarCandidataEtiquetadaDebilEntrePasadas(
  evidencias: readonly EvidenciaRespuestaOmr[]
): CandidataEstableOmr | null {
  const candidatas = evidencias
    .map((evidencia) => {
      const scores = evidencia.scoresPorOpcion
        .filter((item) => item && typeof item.opcion === 'string')
        .sort((a, b) => b.score - a.score);
      const top = scores[0];
      const second = scores[1];
      if (!top) return null;
      const opcion = evidencia.opcion ?? top.opcion;
      const evidenciaOpcion = scores.find((item) => item.opcion === opcion) ?? top;
      const comparador = evidenciaOpcion === top ? second : top;
      const senalFuerte =
        opcion === top.opcion &&
        evidenciaOpcion.score >= 0.16 &&
        evidenciaOpcion.fillRatioCore >= 0.18 &&
        Number(evidenciaOpcion.contraste ?? 0) >= 0.08 &&
        Number(evidenciaOpcion.radialMassRatio ?? 0) >= 0.22 &&
        Number(evidenciaOpcion.centroidOffsetRatio ?? 1) <= 0.38 &&
        evidenciaOpcion.shapeCompactness >= 0.18 &&
        evidenciaOpcion.markConfidence >= 0.08 &&
        evidenciaOpcion.score - (comparador?.score ?? 0) >= 0.06;
      const senalDebilRepetida =
        evidenciaOpcion.fillRatioCore >= 0.18 &&
        Number(evidenciaOpcion.contraste ?? 0) >= 0.08 &&
        Number(evidenciaOpcion.softCoreContrast ?? 0) >= 0.06 &&
        Number(evidenciaOpcion.radialMassRatio ?? 0) >= 0.25 &&
        Number(evidenciaOpcion.centroidOffsetRatio ?? 1) <= 0.38 &&
        evidenciaOpcion.shapeCompactness >= 0.12;
      return {
        evidencia,
        opcion,
        senalFuerte,
        senalDebilRepetida,
        fuerza: senalFuerte ? Math.max(0.2, evidenciaOpcion.score * 0.9) : 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter(({ evidencia, opcion, senalFuerte, senalDebilRepetida }) =>
      Boolean(
        opcion &&
        (senalFuerte || senalDebilRepetida) &&
        !evidencia.flags.some((flag) => INVALIDANTES.has(flag))
      )
    );
  if (candidatas.length < 2) return null;

  const grupos = new Map<string, typeof candidatas>();
  for (const candidata of candidatas) {
    const grupo = grupos.get(candidata.opcion) ?? [];
    grupo.push(candidata);
    grupos.set(candidata.opcion, grupo);
  }
  const grupo = [...grupos.values()]
    .filter((items) => items.length >= 2 && items.some((item) => item.senalFuerte) && items.some((item) => item.senalDebilRepetida))
    .sort((a, b) => Math.max(...b.map((item) => item.fuerza)) - Math.max(...a.map((item) => item.fuerza)))[0];
  if (!grupo) return null;
  const mejor = [...grupo].sort((a, b) => b.fuerza - a.fuerza)[0] ?? grupo[0];
  return {
    opcion: mejor.opcion,
    evidencia: mejor.evidencia,
    repeticiones: grupo.length,
    fuerza: Math.max(0.2, mejor.fuerza)
  };
}

/**
 * Recupera una opcion repetida en dos pasadas limpias cuando una tercera
 * hipotesis introdujo ruido o un falso doble. La evidencia invalidante no se
 * ignora ciegamente: si su propia dominante coincide con la opcion candidata,
 * el caso puede ser una doble marca real y permanece en revision.
 */
export function rescatarCandidataEtiquetadaRepetidaConRuidoEntrePasadas(
  evidencias: readonly EvidenciaRespuestaOmr[]
): CandidataEstableOmr | null {
  const entradas = evidencias
    .map((evidencia) => {
      const scores = evidencia.scoresPorOpcion
        .filter((item) => item && typeof item.opcion === 'string')
        .sort((a, b) => b.score - a.score);
      const top = scores[0];
      if (!top) return null;
      const segunda = scores[1];
      const opcion = evidencia.opcion ?? top.opcion;
      const candidata = scores.find((item) => item.opcion === opcion) ?? top;
      const dominanteFuerte =
        opcion === top.opcion &&
        candidata.score >= 0.35 &&
        candidata.score - (segunda?.score ?? 0) >= 0.12 &&
        candidata.fillRatioCore >= 0.3 &&
        Number(candidata.contraste ?? 0) >= 0.12 &&
        Number(candidata.radialMassRatio ?? 0) >= 0.28 &&
        Number(candidata.centroidOffsetRatio ?? 1) <= 0.4 &&
        candidata.shapeCompactness >= 0.25 &&
        candidata.markConfidence >= 0.6;
      const soporteEtiquetado =
        evidencia.opcion === opcion &&
        candidata.score >= 0.04 &&
        candidata.fillRatioCore >= 0.3 &&
        Number(candidata.contraste ?? 0) >= 0.035 &&
        Number(candidata.softCoreContrast ?? 0) >= 0.14 &&
        Number(candidata.radialMassRatio ?? 0) >= 0.3 &&
        Number(candidata.centroidOffsetRatio ?? 1) <= 0.4 &&
        candidata.shapeCompactness >= 0.25;
      return {
        evidencia,
        opcion,
        top,
        candidata,
        invalida: evidencia.flags.some((flag) => INVALIDANTES.has(flag)),
        dominanteFuerte,
        soporteEtiquetado,
        fuerza: dominanteFuerte ? Math.max(0.3, candidata.score * 0.9) : 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const grupos = new Map<string, typeof entradas>();
  for (const entrada of entradas.filter((item) => !item.invalida)) {
    const grupo = grupos.get(entrada.opcion) ?? [];
    grupo.push(entrada);
    grupos.set(entrada.opcion, grupo);
  }
  const grupo = [...grupos.values()]
    .filter((items) =>
      items.length >= 2 &&
      items.some((item) => item.dominanteFuerte) &&
      items.some((item) => item.soporteEtiquetado)
    )
    .sort((a, b) => Math.max(...b.map((item) => item.fuerza)) - Math.max(...a.map((item) => item.fuerza)))[0];
  if (!grupo) return null;
  const opcion = grupo[0]?.opcion;
  if (!opcion) return null;
  const invalidantesCoincidentes = entradas.some(
    (item) => item.invalida && item.top.opcion === opcion
  );
  if (invalidantesCoincidentes) return null;
  const mejor = [...grupo].sort((a, b) => b.fuerza - a.fuerza)[0] ?? grupo[0];
  return {
    opcion,
    evidencia: mejor.evidencia,
    repeticiones: grupo.length,
    fuerza: Math.max(0.3, mejor.fuerza)
  };
}

function elegirEvidencia(a: EvidenciaRespuestaOmr, b: EvidenciaRespuestaOmr) {
  const fuerzaA = calcularFuerza(a);
  const fuerzaB = calcularFuerza(b);
  return fuerzaA.fuerza >= fuerzaB.fuerza ? a : b;
}

function unirFlags(a: EvidenciaRespuestaOmr, b: EvidenciaRespuestaOmr, extra: string[] = []) {
  return Array.from(new Set([...a.flags, ...b.flags, ...extra]));
}

function unirFlagsSinInvalidantes(a: EvidenciaRespuestaOmr, b: EvidenciaRespuestaOmr, extra: string[] = []) {
  return Array.from(new Set([...a.flags, ...b.flags, ...extra].filter((flag) => !INVALIDANTES.has(flag))));
}

function rescatarDobleInconsistenteEntrePasadas(
  principal: EvidenciaRespuestaOmr,
  secundaria: EvidenciaRespuestaOmr
) {
  const entradas = [principal, secundaria].map((evidencia) => {
    const scores = evidencia.scoresPorOpcion
      .filter((item) => item && typeof item.opcion === 'string')
      .sort((a, b) => b.score - a.score);
    return {
      evidencia,
      invalida: evidencia.flags.some((flag) => INVALIDANTES.has(flag)),
      top: scores[0],
      second: scores[1]
    };
  });
  const invalidas = entradas.filter((entrada) => entrada.invalida);
  if (invalidas.length !== 1) return null;
  const limpia = entradas.find((entrada) => !entrada.invalida);
  const invalidante = invalidas[0];
  const top = limpia?.top;
  const topInvalidante = invalidante?.top;
  const secondInvalidante = invalidante?.second;
  if (!limpia || !invalidante || !top || !topInvalidante || !secondInvalidante) return null;
  if (top.opcion !== topInvalidante.opcion) return null;

  // La pasada invalidante debe conservar una dominante física clara. La
  // condición exige una marca repetida, pero no intenta resolver dos núcleos
  // fuertes: esos casos permanecen en revisión.
  const gapInvalidante = topInvalidante.score - secondInvalidante.score;
  const ratioSegundo = secondInvalidante.score / Math.max(0.0001, topInvalidante.score);
  const dominanteRepetida =
    top.score >= 0.26 &&
    topInvalidante.score >= 0.28 &&
    gapInvalidante >= 0.12 &&
    ratioSegundo <= 0.6 &&
    top.fillRatioCore >= 0.5 &&
    topInvalidante.fillRatioCore >= 0.4 &&
    Number(top.contraste ?? 0) >= 0.08 &&
    Number(topInvalidante.contraste ?? 0) >= 0.1 &&
    Number(top.radialMassRatio ?? 0) >= 0.35 &&
    Number(topInvalidante.radialMassRatio ?? 0) >= 0.3 &&
    Number(top.centroidOffsetRatio ?? 1) <= 0.36 &&
    Number(topInvalidante.centroidOffsetRatio ?? 1) <= 0.36 &&
    top.markConfidence >= 0.6 &&
    topInvalidante.markConfidence >= 0.72;
  if (!dominanteRepetida) return null;
  return { evidencia: limpia.evidencia, candidata: top };
}

function resultadoDesde(
  evidencia: EvidenciaRespuestaOmr,
  opcion: string | null,
  confianza: number,
  flags: string[],
  modo: ResultadoConsensoRespuestaOmr['modo']
): ResultadoConsensoRespuestaOmr {
  return {
    opcion,
    confianza: limitar01(confianza),
    scoresPorOpcion: evidencia.scoresPorOpcion,
    flags,
    modo
  };
}

/**
 * Fusiona dos lecturas del mismo reactivo sin consultar la clave de respuestas.
 * Los umbrales son deliberadamente asimetricos: rescatar una marca requiere
 * evidencia fuerte, mientras que un conflicto cercano se abstiene.
 */
export function fusionarRespuestaOmrV2(
  principal: EvidenciaRespuestaOmr,
  secundaria: EvidenciaRespuestaOmr
): ResultadoConsensoRespuestaOmr {
  const fuerzaPrincipal = calcularFuerza(principal);
  const fuerzaSecundaria = calcularFuerza(secundaria);
  const invalidaPrincipal = principal.flags.some((flag) => INVALIDANTES.has(flag));
  const invalidaSecundaria = secundaria.flags.some((flag) => INVALIDANTES.has(flag));
  const ambasInvalidas = invalidaPrincipal || invalidaSecundaria;

  const rescateDominanteAislada = fuerzaPrincipal.marcaDominanteAislada && !fuerzaSecundaria.marcaDominanteAislada
    ? [principal, fuerzaPrincipal] as const
    : fuerzaSecundaria.marcaDominanteAislada && !fuerzaPrincipal.marcaDominanteAislada
      ? [secundaria, fuerzaSecundaria] as const
      : null;
  if (rescateDominanteAislada && !ambasInvalidas) {
    return resultadoDesde(
      rescateDominanteAislada[0],
      rescateDominanteAislada[1].opcion,
      Math.max(0.66, rescateDominanteAislada[0].confianza * 0.9),
      unirFlags(principal, secundaria, ['bajo_contraste']),
      'rescate'
    );
  }

  const dobleInconsistente = rescatarDobleInconsistenteEntrePasadas(principal, secundaria);
  if (dobleInconsistente) {
    return resultadoDesde(
      dobleInconsistente.evidencia,
      dobleInconsistente.candidata.opcion,
      Math.max(0.55, dobleInconsistente.evidencia.confianza * 0.82),
      unirFlagsSinInvalidantes(principal, secundaria, ['bajo_contraste']),
      'rescate'
    );
  }

  // En capturas con bajo contraste una sola pasada puede confundir el borde
  // de la burbuja con una segunda marca. Si la otra pasada obtiene una
  // candidata separada y la pasada invalidante tenia confianza baja, se
  // conserva la lectura alternativa como rescate degradado. Una doble marca
  // fuerte en ambas pasadas, o una pasada invalidante de alta confianza,
  // permanece bloqueante.
  const candidatoSinInvalidez = invalidaPrincipal && !invalidaSecundaria
    ? fuerzaSecundaria
    : !invalidaPrincipal && invalidaSecundaria
      ? fuerzaPrincipal
      : null;
  const evidenciaSinInvalidez = invalidaPrincipal && !invalidaSecundaria
    ? secundaria
    : !invalidaPrincipal && invalidaSecundaria
      ? principal
      : null;
  const evidenciaInvalidante = invalidaPrincipal ? principal : secundaria;
  if (
    candidatoSinInvalidez?.valida &&
    evidenciaSinInvalidez &&
    evidenciaInvalidante.confianza <= 0.65 &&
    candidatoSinInvalidez.fuerza >= 0.46 &&
    candidatoSinInvalidez.forma >= 0.42 &&
    candidatoSinInvalidez.margen >= 0.12 &&
    candidatoSinInvalidez.separacionRobusta >= 0.08
  ) {
    return resultadoDesde(
      evidenciaSinInvalidez,
      candidatoSinInvalidez.opcion,
      Math.max(0.35, evidenciaSinInvalidez.confianza * 0.82),
      unirFlags(principal, secundaria, ['bajo_contraste']),
      'rescate'
    );
  }

  if (ambasInvalidas) {
    const evidencia = elegirEvidencia(principal, secundaria);
    return resultadoDesde(
      evidencia,
      null,
      Math.min(0.5, Math.max(principal.confianza, secundaria.confianza)),
      unirFlags(principal, secundaria),
      'invalida'
    );
  }

  if (fuerzaPrincipal.valida && fuerzaSecundaria.valida && fuerzaPrincipal.opcion === fuerzaSecundaria.opcion) {
    const evidencia = elegirEvidencia(principal, secundaria);
    const acuerdo = Math.min(fuerzaPrincipal.fuerza, fuerzaSecundaria.fuerza);
    const confianza = Math.max(principal.confianza, secundaria.confianza) * 0.55 +
      Math.min(principal.confianza, secundaria.confianza) * 0.25 +
      acuerdo * 0.15 +
      0.05;
    return resultadoDesde(evidencia, fuerzaPrincipal.opcion, confianza, unirFlags(principal, secundaria), 'consenso');
  }

  const candidatoPrincipal = fuerzaPrincipal.valida ? fuerzaPrincipal : null;
  const candidatoSecundario = fuerzaSecundaria.valida ? fuerzaSecundaria : null;
  if (candidatoPrincipal && !candidatoSecundario) {
    if (
      candidatoPrincipal.marcaFotometricaTenue &&
      candidatoPrincipal.fuerza >= 0.26 &&
      candidatoPrincipal.forma >= 0.25 &&
      candidatoPrincipal.margen >= 0.08 &&
      candidatoPrincipal.separacionRobusta >= 0.1 &&
      !invalidaSecundaria
    ) {
      return resultadoDesde(
        principal,
        candidatoPrincipal.opcion,
        Math.max(0.32, principal.confianza * 0.9, candidatoPrincipal.fuerza * 0.9),
        unirFlags(principal, secundaria, ['bajo_contraste']),
        'rescate'
      );
    }
    const fuerte = candidatoPrincipal.fuerza >= 0.58 && candidatoPrincipal.forma >= 0.48 &&
      candidatoPrincipal.margen >= 0.2 && candidatoPrincipal.separacionRobusta >= 0.16;
    if (fuerte && !invalidaSecundaria) {
      return resultadoDesde(principal, candidatoPrincipal.opcion, Math.max(principal.confianza * 0.9, candidatoPrincipal.fuerza * 0.82), unirFlags(principal, secundaria, ['bajo_contraste']), 'rescate');
    }
    if (candidatoPrincipal.puntoCentral && !invalidaSecundaria) {
      return resultadoDesde(
        principal,
        candidatoPrincipal.opcion,
        Math.max(0.35, principal.confianza * 0.82, candidatoPrincipal.fuerza * 0.82),
        unirFlags(principal, secundaria, ['bajo_contraste']),
        'rescate'
      );
    }
  }
  if (candidatoSecundario && !candidatoPrincipal) {
    if (
      candidatoSecundario.marcaFotometricaTenue &&
      candidatoSecundario.fuerza >= 0.26 &&
      candidatoSecundario.forma >= 0.25 &&
      candidatoSecundario.margen >= 0.08 &&
      candidatoSecundario.separacionRobusta >= 0.1 &&
      !invalidaPrincipal
    ) {
      return resultadoDesde(
        secundaria,
        candidatoSecundario.opcion,
        Math.max(0.32, secundaria.confianza * 0.9, candidatoSecundario.fuerza * 0.9),
        unirFlags(principal, secundaria, ['bajo_contraste']),
        'rescate'
      );
    }
    const fuerte = candidatoSecundario.fuerza >= 0.58 && candidatoSecundario.forma >= 0.48 &&
      candidatoSecundario.margen >= 0.2 && candidatoSecundario.separacionRobusta >= 0.16;
    if (fuerte && !invalidaPrincipal) {
      return resultadoDesde(secundaria, candidatoSecundario.opcion, Math.max(secundaria.confianza * 0.9, candidatoSecundario.fuerza * 0.82), unirFlags(principal, secundaria, ['bajo_contraste']), 'rescate');
    }
    if (candidatoSecundario.puntoCentral && !invalidaPrincipal) {
      return resultadoDesde(
        secundaria,
        candidatoSecundario.opcion,
        Math.max(0.35, secundaria.confianza * 0.82, candidatoSecundario.fuerza * 0.82),
        unirFlags(principal, secundaria, ['bajo_contraste']),
        'rescate'
      );
    }
  }

  if (candidatoPrincipal && candidatoSecundario && candidatoPrincipal.opcion !== candidatoSecundario.opcion) {
    const diferencia = candidatoPrincipal.fuerza - candidatoSecundario.fuerza;
    const ganador = diferencia >= 0 ? [principal, candidatoPrincipal] as const : [secundaria, candidatoSecundario] as const;
    if (Math.abs(diferencia) >= 0.16 && ganador[1].fuerza >= 0.64 && ganador[1].margen >= 0.24) {
      return resultadoDesde(ganador[0], ganador[1].opcion, Math.max(0.35, ganador[0].confianza * 0.82), unirFlags(principal, secundaria, ['bajo_contraste']), 'conflicto_resuelto');
    }
  }

  const evidencia = elegirEvidencia(principal, secundaria);
  return resultadoDesde(evidencia, null, Math.min(0.5, Math.max(principal.confianza, secundaria.confianza)), unirFlags(principal, secundaria, ['bajo_contraste']), 'abstencion');
}
