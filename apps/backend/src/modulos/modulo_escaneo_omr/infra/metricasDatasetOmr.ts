const OPCIONES_OMR = new Set(['A', 'B', 'C', 'D', 'E']);

type DetalleRespuestaBenchmark = {
  pregunta?: number;
  opcion?: string | null;
  estadoRespuesta?: string | null;
};

export type FilaBenchmarkOmr = {
  file?: string;
  skipped?: boolean;
  folio?: string | null;
  page?: number | null;
  key?: string | null;
  observed?: string | null;
  qrTextoEsperado?: string | null;
  qrTextoDetectado?: string | null;
  qrCoincideEsperado?: boolean | null;
  /** Lectura directa de la fotografía, separada del rescate por geometría conocida. */
  qrTextoDirecto?: string | null;
  qrCoincideDirectoEsperado?: boolean | null;
  qrGeometryRescueUsed?: boolean;
  qrTextoRotado?: string | null;
  qrCoincideRotadoEsperado?: boolean | null;
  qrRotationRescueUsed?: boolean;
  responseDetails?: readonly DetalleRespuestaBenchmark[];
};

/** Separa lectores QR primarios de rescates rotacionales para no inflar cobertura directa. */
export function clasificarLecturaQrBenchmark(
  detalle: { data?: string | null; fuenteDeteccionQr?: string | null } | null | undefined,
  textoEsperado?: string | null
) {
  const texto = detalle?.data ?? null;
  const rescateRotacional = Boolean(texto) && detalle?.fuenteDeteccionQr === 'rotacion_pagina';
  const textoDirecto = texto && !rescateRotacional ? texto : null;
  const textoRotado = rescateRotacional ? texto : null;
  return {
    qrTextoDirecto: textoDirecto,
    qrFuenteDirecta: textoDirecto ? detalle?.fuenteDeteccionQr ?? null : null,
    qrTextoRotado: textoRotado,
    qrFuenteRotacion: textoRotado ? 'rotacion_pagina' : null,
    qrRotationRescueUsed: rescateRotacional,
    qrCoincideDirectoEsperado: textoDirecto && textoEsperado ? textoDirecto === textoEsperado : null,
    qrCoincideRotadoEsperado: textoRotado && textoEsperado ? textoRotado === textoEsperado : null,
    qrDetectionMode: texto
      ? rescateRotacional ? 'page_rotation_rescue' : 'direct_image'
      : 'not_detected'
  };
}

type ObservacionReactivo = {
  etiquetasObservadas: Set<string>;
  claves: Set<string>;
  resultados: Array<{ estado: string; opcion: string | null }>;
};

function esOpcion(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && OPCIONES_OMR.has(value.toUpperCase());
}

function proporcion(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

/**
 * Recalcula métricas en el grano físico folio/página/reactivo, sin confundir
 * recapturas con nuevas hojas. La concordancia de marca exige que todas las
 * capturas del mismo reactivo coincidan con una única etiqueta observada.
 */
export function resumirIntegridadDatasetOmr(
  filas: readonly FilaBenchmarkOmr[],
  sha256PorArchivo: ReadonlyMap<string, string | null> = new Map()
) {
  const paginas = new Map<string, FilaBenchmarkOmr[]>();
  const reactivos = new Map<string, ObservacionReactivo>();
  let filasSinIdentidad = 0;
  let filasConLongitudInconsistente = 0;
  let filasSinEtiquetasObservadas = 0;
  let filasSinClave = 0;
  let reactivosSinNumeroValido = 0;

  for (const fila of filas) {
    if (fila.skipped) continue;
    const folio = String(fila.folio ?? '').trim().toUpperCase();
    const pagina = Number(fila.page);
    if (!folio || !Number.isInteger(pagina) || pagina < 1) {
      filasSinIdentidad += 1;
      continue;
    }

    const clavePagina = JSON.stringify([folio, pagina]);
    const capturasPagina = paginas.get(clavePagina) ?? [];
    capturasPagina.push(fila);
    paginas.set(clavePagina, capturasPagina);

    const detalles = fila.responseDetails ?? [];
    const observadas = fila.observed ?? '';
    const clave = fila.key ?? '';
    if (!observadas) filasSinEtiquetasObservadas += 1;
    if (!clave) filasSinClave += 1;
    if ((observadas.length > 0 && observadas.length !== detalles.length)
      || (clave.length > 0 && clave.length !== detalles.length)) {
      filasConLongitudInconsistente += 1;
    }

    detalles.forEach((detalle, indice) => {
      const pregunta = Number(detalle.pregunta);
      if (!Number.isInteger(pregunta) || pregunta < 1) {
        reactivosSinNumeroValido += 1;
        return;
      }

      const claveReactivo = JSON.stringify([folio, pagina, pregunta]);
      const observacion = reactivos.get(claveReactivo) ?? {
        etiquetasObservadas: new Set<string>(),
        claves: new Set<string>(),
        resultados: []
      };
      const etiquetaObservada = observadas[indice]?.toUpperCase();
      const respuestaClave = clave[indice]?.toUpperCase();
      if (etiquetaObservada) observacion.etiquetasObservadas.add(etiquetaObservada);
      if (esOpcion(respuestaClave)) observacion.claves.add(respuestaClave);

      const opcionDetectada = detalle.opcion?.toUpperCase() ?? null;
      const estado = detalle.estadoRespuesta ?? (esOpcion(opcionDetectada) ? 'respondida' : 'sin_marca');
      observacion.resultados.push({
        estado,
        opcion: esOpcion(opcionDetectada) ? opcionDetectada : null
      });
      reactivos.set(claveReactivo, observacion);
    });
  }

  const histogramaCapturas = new Map<number, number>();
  const paginasRepetidas = [...paginas.values()].filter((capturas) => capturas.length > 1);
  for (const capturas of paginas.values()) {
    histogramaCapturas.set(capturas.length, (histogramaCapturas.get(capturas.length) ?? 0) + 1);
  }

  const conteoEstadosUnicos: Record<string, number> = {};
  let reactivosUnicosDeterminados = 0;
  let reactivosUnicosConEtiqueta = 0;
  let concordanciasObservadasUnicas = 0;
  let reactivosConDesacuerdoObservado = 0;
  let conflictosEtiquetaObservada = 0;
  let conflictosClave = 0;
  let conflictosCapturasOmr = 0;
  let preguntasConClave = 0;
  let coincidenciasClave = 0;
  let comparacionesClavePendientesRevision = 0;
  let reactivosComparadosEntreCapturas = 0;
  let reactivosConDesacuerdoEntreCapturas = 0;
  let reactivosConEmisionesConflictivasEntreCapturas = 0;
  let reactivosConEmisionYAbstencionEntreCapturas = 0;
  const paginasRepetidasConflictivas = new Set<string>();

  for (const [claveReactivo, reactivo] of reactivos) {
    const [folio, pagina] = JSON.parse(claveReactivo) as [string, number, number];
    const clavePagina = JSON.stringify([folio, pagina]);
    const capturasPagina = paginas.get(clavePagina) ?? [];
    const capturasReactivo = reactivo.resultados.length;
    if (capturasPagina.length > 1 && capturasReactivo > 1) {
      reactivosComparadosEntreCapturas += 1;
      const opcionesEmitidas = new Set(reactivo.resultados
        .filter(({ estado, opcion }) => estado === 'respondida' && esOpcion(opcion))
        .map(({ opcion }) => opcion!));
      const hayAbstencion = reactivo.resultados.some(({ estado, opcion }) =>
        estado !== 'respondida' || !esOpcion(opcion)
      );
      if (opcionesEmitidas.size > 1) reactivosConEmisionesConflictivasEntreCapturas += 1;
      if (opcionesEmitidas.size > 0 && hayAbstencion) reactivosConEmisionYAbstencionEntreCapturas += 1;
      const resultadosDistintos = new Set(reactivo.resultados.map(({ estado, opcion }) => `${estado}:${opcion ?? '-'}`));
      if (resultadosDistintos.size > 1) {
        reactivosConDesacuerdoEntreCapturas += 1;
        paginasRepetidasConflictivas.add(clavePagina);
      }
    }
    const valoresObservados = [...reactivo.etiquetasObservadas];
    const valoresClave = [...reactivo.claves];
    if (valoresObservados.length > 1) conflictosEtiquetaObservada += 1;
    if (valoresClave.length > 1) conflictosClave += 1;

    const resultadosUnicos = new Set(reactivo.resultados.map(({ estado, opcion }) => `${estado}:${opcion ?? '-'}`));
    const tieneConflictoCapturas = resultadosUnicos.size > 1;
    if (tieneConflictoCapturas) conflictosCapturasOmr += 1;
    const resultadoUnico = !tieneConflictoCapturas ? reactivo.resultados[0] : undefined;
    const estadoAgregado = tieneConflictoCapturas
      ? 'capturas_discrepantes'
      : resultadoUnico?.estado ?? 'sin_resultado';
    conteoEstadosUnicos[estadoAgregado] = (conteoEstadosUnicos[estadoAgregado] ?? 0) + 1;
    if (resultadoUnico?.estado === 'respondida' && esOpcion(resultadoUnico.opcion)) {
      reactivosUnicosDeterminados += 1;
    }

    const etiquetaUnica = valoresObservados.length === 1 ? valoresObservados[0] : null;
    if (esOpcion(etiquetaUnica)) {
      reactivosUnicosConEtiqueta += 1;
      const coincideConTodasLasCapturas =
        reactivo.resultados.length > 0
        && reactivo.resultados.every(({ estado, opcion }) => estado === 'respondida' && opcion === etiquetaUnica)
      if (coincideConTodasLasCapturas) {
        concordanciasObservadasUnicas += 1;
      } else {
        reactivosConDesacuerdoObservado += 1;
      }
    }

    const claveUnica = valoresClave.length === 1 ? valoresClave[0] : null;
    if (esOpcion(claveUnica)) {
      preguntasConClave += 1;
      if (resultadoUnico?.estado === 'respondida' && resultadoUnico.opcion === claveUnica) {
        coincidenciasClave += 1;
      }
      if (tieneConflictoCapturas || ['ambigua', 'doble_marca', 'tachada', 'sin_resultado'].includes(estadoAgregado)) {
        comparacionesClavePendientesRevision += 1;
      }
    }
  }
  const paginasRepetidasConDesacuerdoOmr = paginasRepetidasConflictivas.size;

  const huellasValidas = [...sha256PorArchivo.values()]
    .filter((hash): hash is string => typeof hash === 'string' && /^[a-f\d]{64}$/i.test(hash));
  const gruposHuellas = new Map<string, number>();
  for (const hash of huellasValidas) {
    const normalizada = hash.toLowerCase();
    gruposHuellas.set(normalizada, (gruposHuellas.get(normalizada) ?? 0) + 1);
  }

  const paginasConQrEsperado = [...paginas.values()].filter((capturas) =>
    capturas.some((captura) => Boolean(captura.qrTextoEsperado))
  );
  const paginasConQrExacto = paginasConQrEsperado.filter((capturas) =>
    capturas.some((captura) => captura.qrCoincideEsperado === true)
  ).length;
  const paginasConPayloadQrIncorrecto = paginasConQrEsperado.filter((capturas) =>
    capturas.some((captura) => Boolean(captura.qrTextoDetectado) && captura.qrCoincideEsperado !== true)
  ).length;
  const paginasConQrDirectoEsperado = [...paginas.values()].filter((capturas) =>
    capturas.some((captura) => Boolean(captura.qrTextoEsperado))
  );
  const paginasConQrDirectoExacto = paginasConQrDirectoEsperado.filter((capturas) =>
    capturas.some((captura) => captura.qrCoincideDirectoEsperado === true)
  ).length;
  const paginasConPayloadQrDirectoIncorrecto = paginasConQrDirectoEsperado.filter((capturas) =>
    capturas.some((captura) => Boolean(captura.qrTextoDirecto) && captura.qrCoincideDirectoEsperado !== true)
  ).length;
  const paginasConRescateQr = [...paginas.values()].filter((capturas) =>
    capturas.some((captura) => captura.qrGeometryRescueUsed === true)
  );
  const paginasConRescateQrExacto = paginasConRescateQr.filter((capturas) =>
    capturas.some((captura) => captura.qrGeometryRescueUsed === true && captura.qrCoincideEsperado === true)
  ).length;
  const paginasConRescateQrInesperado = paginasConRescateQr.filter((capturas) =>
    capturas.some((captura) => captura.qrGeometryRescueUsed === true && Boolean(captura.qrTextoDetectado) && captura.qrCoincideEsperado !== true)
  ).length;
  const paginasConRescateQrRotado = [...paginas.values()].filter((capturas) =>
    capturas.some((captura) => captura.qrRotationRescueUsed === true)
  );
  const paginasConRescateQrRotadoExacto = paginasConRescateQrRotado.filter((capturas) =>
    capturas.some((captura) => captura.qrRotationRescueUsed === true && captura.qrCoincideRotadoEsperado === true)
  ).length;
  const paginasConRescateQrRotadoInesperado = paginasConRescateQrRotado.filter((capturas) =>
    capturas.some((captura) => captura.qrRotationRescueUsed === true && Boolean(captura.qrTextoEsperado) && Boolean(captura.qrTextoRotado) && captura.qrCoincideRotadoEsperado !== true)
  ).length;

  return {
    imageContent: {
      inputFiles: sha256PorArchivo.size,
      filesHashed: huellasValidas.length,
      uniqueByteContents: gruposHuellas.size,
      exactDuplicateGroups: [...gruposHuellas.values()].filter((cantidad) => cantidad > 1).length,
      exactDuplicateCopies: huellasValidas.length - gruposHuellas.size
    },
    folioPage: {
      analyzedCaptureRows: [...paginas.values()].reduce((total, capturas) => total + capturas.length, 0),
      uniquePages: paginas.size,
      pagesWithRepeatedCaptures: paginasRepetidas.length,
      additionalCapturesOfKnownPages: paginasRepetidas.reduce((total, capturas) => total + capturas.length - 1, 0),
      captureCountHistogram: [...histogramaCapturas.entries()]
        .sort(([a], [b]) => a - b)
        .map(([capturesPerPage, pagesCount]) => ({ capturesPerPage, pagesCount }))
    },
    repeatabilityByPage: {
      repeatedPages: paginasRepetidas.length,
      repeatedPagesWithOmrDisagreement: paginasRepetidasConDesacuerdoOmr,
      uniqueQuestionSlotsComparedAcrossCaptures: reactivosComparadosEntreCapturas,
      questionSlotsWithAnyOutputDisagreement: reactivosConDesacuerdoEntreCapturas,
      questionSlotsWithConflictingEmissions: reactivosConEmisionesConflictivasEntreCapturas,
      questionSlotsWithEmissionAndAbstention: reactivosConEmisionYAbstencionEntreCapturas,
      conflictingEmissionRate: proporcion(reactivosConEmisionesConflictivasEntreCapturas, reactivosComparadosEntreCapturas),
      emissionAbstentionDisagreementRate: proporcion(reactivosConEmisionYAbstencionEntreCapturas, reactivosComparadosEntreCapturas)
    },
    question: {
      uniqueQuestionSlots: reactivos.size,
      detectedUniqueResponses: reactivosUnicosDeterminados,
      markedObservedLabels: reactivosUnicosConEtiqueta,
      agreementWithObservedLabels: concordanciasObservadasUnicas,
      agreementRateAmongMarkedObserved: proporcion(concordanciasObservadasUnicas, reactivosUnicosConEtiqueta),
      questionsWithObservedDisagreement: reactivosConDesacuerdoObservado,
      conflictingObservedLabels: conflictosEtiquetaObservada,
      conflictingAnswerKeys: conflictosClave,
      conflictingOmrResultsAcrossCaptures: conflictosCapturasOmr,
      stateCounts: conteoEstadosUnicos,
      rowsWithInconsistentArrayLengths: filasConLongitudInconsistente,
      rowsWithoutObservedLabels: filasSinEtiquetasObservadas,
      rowsWithoutAnswerKey: filasSinClave,
      rowsWithoutFolioPageIdentity: filasSinIdentidad,
      responsesWithoutValidQuestionNumber: reactivosSinNumeroValido
    },
    studentAnswerKeyComparison: {
      uniqueQuestionsWithKey: preguntasConClave,
      answersMatchingKey: coincidenciasClave,
      answerShare: proporcion(coincidenciasClave, preguntasConClave),
      questionsRequiringReview: comparacionesClavePendientesRevision
    },
    qrByUniquePage: {
      pagesWithExpectedQr: paginasConQrEsperado.length,
      pagesWithExactPayload: paginasConQrExacto,
      pagesWithoutExactPayload: paginasConQrEsperado.length - paginasConQrExacto,
      pagesWithUnexpectedPayload: paginasConPayloadQrIncorrecto
    },
    qrDirectByUniquePage: {
      pagesWithExpectedQr: paginasConQrDirectoEsperado.length,
      pagesWithExactPayload: paginasConQrDirectoExacto,
      pagesWithoutExactPayload: paginasConQrDirectoEsperado.length - paginasConQrDirectoExacto,
      pagesWithUnexpectedPayload: paginasConPayloadQrDirectoIncorrecto
    },
    qrGeometryRescueByUniquePage: {
      pagesRescued: paginasConRescateQr.length,
      pagesWithExactPayload: paginasConRescateQrExacto,
      pagesWithUnexpectedPayload: paginasConRescateQrInesperado
    },
    qrRotationRescueByUniquePage: {
      pagesRescued: paginasConRescateQrRotado.length,
      pagesWithExactPayload: paginasConRescateQrRotadoExacto,
      pagesWithUnexpectedPayload: paginasConRescateQrRotadoInesperado
    }
  };
}
