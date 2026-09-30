import { describe, expect, it } from 'vitest';
import {
  clasificarLecturaQrBenchmark,
  resumirIntegridadDatasetOmr,
  type FilaBenchmarkOmr
} from '../src/modulos/modulo_escaneo_omr/infra/metricasDatasetOmr.js';

function fila(
  file: string,
  observed: string,
  key: string,
  responseDetails: NonNullable<FilaBenchmarkOmr['responseDetails']>,
  extras: Partial<FilaBenchmarkOmr> = {}
): FilaBenchmarkOmr {
  return {
    file,
    folio: 'FOLIO-01',
    page: 1,
    observed,
    key,
    responseDetails,
    ...extras
  };
}

describe('resumen de calidad del dataset OMR por grano físico', () => {
  it('cuenta las recapturas como capturas, pero cada folio/página/reactivo una sola vez', () => {
    const respuesta = [
      { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' },
      { pregunta: 2, opcion: null, estadoRespuesta: 'sin_marca' }
    ];
    const rows = [
      fila('captura-a.jpg', 'B?', 'AC', respuesta, {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: 'QR-P1',
        qrCoincideEsperado: true
      }),
      fila('captura-b.jpg', 'B?', 'AC', respuesta, { qrTextoEsperado: 'QR-P1' })
    ];
    const huella = 'a'.repeat(64);

    const resumen = resumirIntegridadDatasetOmr(rows, new Map([
      ['captura-a.jpg', huella],
      ['captura-b.jpg', huella]
    ]));

    expect(resumen.imageContent).toMatchObject({
      inputFiles: 2,
      uniqueByteContents: 1,
      exactDuplicateGroups: 1,
      exactDuplicateCopies: 1
    });
    expect(resumen.folioPage).toMatchObject({
      analyzedCaptureRows: 2,
      uniquePages: 1,
      pagesWithRepeatedCaptures: 1,
      additionalCapturesOfKnownPages: 1,
      captureCountHistogram: [{ capturesPerPage: 2, pagesCount: 1 }]
    });
    expect(resumen.question).toMatchObject({
      uniqueQuestionSlots: 2,
      detectedUniqueResponses: 1,
      markedObservedLabels: 1,
      agreementWithObservedLabels: 1,
      agreementRateAmongMarkedObserved: 1,
      conflictingOmrResultsAcrossCaptures: 0,
      stateCounts: { respondida: 1, sin_marca: 1 }
    });
    expect(resumen.studentAnswerKeyComparison).toMatchObject({
      uniqueQuestionsWithKey: 2,
      answersMatchingKey: 0,
      questionsRequiringReview: 0
    });
    expect(resumen.qrByUniquePage).toMatchObject({
      pagesWithExpectedQr: 1,
      pagesWithExactPayload: 1,
      pagesWithoutExactPayload: 0
    });
  });

  it('no convierte capturas discrepantes del mismo reactivo en una respuesta unánime', () => {
    const rows = [
      fila('captura-a.jpg', 'B', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }]),
      fila('captura-b.jpg', 'B', 'A', [{ pregunta: 1, opcion: 'A', estadoRespuesta: 'respondida' }])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.question).toMatchObject({
      uniqueQuestionSlots: 1,
      detectedUniqueResponses: 0,
      markedObservedLabels: 1,
      agreementWithObservedLabels: 0,
      agreementRateAmongMarkedObserved: 0,
      conflictingOmrResultsAcrossCaptures: 1,
      stateCounts: { capturas_discrepantes: 1 }
    });
    expect(resumen.repeatabilityByPage).toMatchObject({
      repeatedPages: 1,
      repeatedPagesWithOmrDisagreement: 1,
      uniqueQuestionSlotsComparedAcrossCaptures: 1,
      questionSlotsWithAnyOutputDisagreement: 1,
      questionSlotsWithConflictingEmissions: 1,
      questionSlotsWithEmissionAndAbstention: 0
    });
    expect(resumen.studentAnswerKeyComparison.questionsRequiringReview).toBe(1);
  });

  it('separa emisiones incompatibles de desacuerdos emision-abstencion', () => {
    const rows = [
      fila('captura-a.jpg', 'A', 'A', [{ pregunta: 1, opcion: 'A', estadoRespuesta: 'respondida' }]),
      fila('captura-b.jpg', 'A', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }]),
      fila('captura-c.jpg', 'A', 'A', [{ pregunta: 1, opcion: null, estadoRespuesta: 'ambigua' }])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.repeatabilityByPage).toMatchObject({
      repeatedPages: 1,
      repeatedPagesWithOmrDisagreement: 1,
      uniqueQuestionSlotsComparedAcrossCaptures: 1,
      questionSlotsWithAnyOutputDisagreement: 1,
      questionSlotsWithConflictingEmissions: 1,
      questionSlotsWithEmissionAndAbstention: 1,
      conflictingEmissionRate: 1,
      emissionAbstentionDisagreementRate: 1
    });
  });

  it('excluye las etiquetas contradictorias del denominador de concordancia', () => {
    const rows = [
      fila('captura-a.jpg', 'B', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }]),
      fila('captura-b.jpg', 'C', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.question).toMatchObject({
      conflictingObservedLabels: 1,
      markedObservedLabels: 0,
      agreementWithObservedLabels: 0,
      agreementRateAmongMarkedObserved: null
    });
  });

  it('expone filas sin identidad y vectores de respuestas inconsistentes', () => {
    const rows = [
      fila('captura-a.jpg', 'B', 'A', [
        { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' },
        { pregunta: 0, opcion: null, estadoRespuesta: 'sin_marca' }
      ]),
      fila('sin-identidad.jpg', 'B', 'A', [
        { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }
      ], { folio: null, page: null })
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.question).toMatchObject({
      uniqueQuestionSlots: 1,
      rowsWithInconsistentArrayLengths: 1,
      rowsWithoutFolioPageIdentity: 1,
      responsesWithoutValidQuestionNumber: 1
    });
  });

  it('distingue referencias ausentes de vectores no vacíos con longitud inconsistente', () => {
    const rows = [
      fila('sin-referencias.jpg', '', '', [
        { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' },
        { pregunta: 2, opcion: null, estadoRespuesta: 'sin_marca' }
      ]),
      fila('vector-incompleto.jpg', 'B', 'A', [
        { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' },
        { pregunta: 2, opcion: null, estadoRespuesta: 'sin_marca' }
      ])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.question).toMatchObject({
      rowsWithInconsistentArrayLengths: 1,
      rowsWithoutObservedLabels: 1,
      rowsWithoutAnswerKey: 1
    });
  });

  it('reporta payload QR inesperado aunque otra recaptura de la página haya sido exacta', () => {
    const respuestas = [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }];
    const rows = [
      fila('captura-a.jpg', 'B', 'A', respuestas, {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: 'QR-P1',
        qrCoincideEsperado: true,
        qrCoincideDirectoEsperado: null
      }),
      fila('captura-b.jpg', 'B', 'A', respuestas, {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: 'QR-P1',
        qrCoincideEsperado: true,
        qrTextoDirecto: 'QR-AJENO',
        qrCoincideDirectoEsperado: false
      }),
      fila('captura-c.jpg', 'B', 'A', respuestas, {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: 'QR-AJENO',
        qrCoincideEsperado: false,
        qrTextoDirecto: 'QR-AJENO',
        qrCoincideDirectoEsperado: false
      })
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.qrByUniquePage).toMatchObject({
      pagesWithExpectedQr: 1,
      pagesWithExactPayload: 1,
      pagesWithoutExactPayload: 0,
      pagesWithUnexpectedPayload: 1
    });
    expect(resumen.qrDirectByUniquePage).toMatchObject({
      pagesWithExpectedQr: 1,
      pagesWithExactPayload: 0,
      pagesWithoutExactPayload: 1,
      pagesWithUnexpectedPayload: 1
    });
  });

  it('no atribuye al lector directo un QR recuperado solo por geometría conocida', () => {
    const resumen = resumirIntegridadDatasetOmr([
      fila('captura.jpg', 'B', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }], {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: 'QR-P1',
        qrCoincideEsperado: true,
        qrTextoDirecto: null,
        qrCoincideDirectoEsperado: null,
        qrGeometryRescueUsed: true
      })
    ]);

    expect(resumen.qrByUniquePage.pagesWithExactPayload).toBe(1);
    expect(resumen.qrDirectByUniquePage).toMatchObject({
      pagesWithExpectedQr: 1,
      pagesWithExactPayload: 0,
      pagesWithoutExactPayload: 1,
      pagesWithUnexpectedPayload: 0
    });
    expect(resumen.qrGeometryRescueByUniquePage).toEqual({
      pagesRescued: 1,
      pagesWithExactPayload: 1,
      pagesWithUnexpectedPayload: 0
    });
  });

  it('separa la lectura QR rotacional de la directa y mide coincidencia exacta', () => {
    const lectura = clasificarLecturaQrBenchmark(
      { data: 'QR-P1', fuenteDeteccionQr: 'rotacion_pagina' },
      'QR-P1'
    );
    const resumen = resumirIntegridadDatasetOmr([
      fila('captura-girada.jpg', 'B', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }], {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: lectura.qrTextoRotado,
        qrCoincideEsperado: true,
        ...lectura
      })
    ]);

    expect(lectura).toMatchObject({
      qrTextoDirecto: null,
      qrFuenteDirecta: null,
      qrTextoRotado: 'QR-P1',
      qrRotationRescueUsed: true,
      qrCoincideDirectoEsperado: null,
      qrCoincideRotadoEsperado: true,
      qrDetectionMode: 'page_rotation_rescue'
    });
    expect(resumen.qrDirectByUniquePage).toMatchObject({ pagesWithExactPayload: 0, pagesWithoutExactPayload: 1 });
    expect(resumen.qrRotationRescueByUniquePage).toEqual({
      pagesRescued: 1,
      pagesWithExactPayload: 1,
      pagesWithUnexpectedPayload: 0
    });
  });

  it('no cuenta una lectura directa como rescate QR geométrico', () => {
    const resumen = resumirIntegridadDatasetOmr([
      fila('captura-directa.jpg', 'B', 'A', [{ pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }], {
        qrTextoEsperado: 'QR-P1',
        qrTextoDetectado: 'QR-P1',
        qrCoincideEsperado: true,
        qrTextoDirecto: 'QR-P1',
        qrCoincideDirectoEsperado: true,
        qrGeometryRescueUsed: false
      })
    ]);

    expect(resumen.qrGeometryRescueByUniquePage).toEqual({
      pagesRescued: 0,
      pagesWithExactPayload: 0,
      pagesWithUnexpectedPayload: 0
    });
  });

  it('informa fallos de hashing sin fingir que el contenido quedó comparado', () => {
    const rows = [
      fila('captura-a.jpg', 'B', 'A', [
        { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }
      ]),
      fila('captura-b.jpg', 'B', 'A', [
        { pregunta: 1, opcion: 'B', estadoRespuesta: 'respondida' }
      ])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows, new Map([
      ['captura-a.jpg', 'a'.repeat(64)],
      ['captura-b.jpg', null]
    ]));

    expect(resumen.imageContent).toMatchObject({
      inputFiles: 2,
      filesHashed: 1,
      uniqueByteContents: 1,
      exactDuplicateGroups: 0,
      exactDuplicateCopies: 0
    });
  });

  it('mantiene una hoja y sus reactivos vacíos fuera del numerador de marcas', () => {
    const rows = [
      fila('captura-vacia.jpg', '??', 'AB', [
        { pregunta: 1, opcion: null, estadoRespuesta: 'sin_marca' },
        { pregunta: 2, opcion: null, estadoRespuesta: 'sin_marca' }
      ])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.question).toMatchObject({
      uniqueQuestionSlots: 2,
      detectedUniqueResponses: 0,
      markedObservedLabels: 0,
      agreementWithObservedLabels: 0,
      agreementRateAmongMarkedObserved: null,
      stateCounts: { sin_marca: 2 }
    });
    expect(resumen.studentAnswerKeyComparison).toMatchObject({
      uniqueQuestionsWithKey: 2,
      answersMatchingKey: 0,
      answerShare: 0
    });
  });

  it('expone la discrepancia detector-etiqueta aunque cada fuente sea internamente consistente', () => {
    const rows = [
      fila('captura.jpg', 'B', 'A', [
        { pregunta: 1, opcion: 'C', estadoRespuesta: 'respondida' }
      ])
    ];

    const resumen = resumirIntegridadDatasetOmr(rows);

    expect(resumen.question).toMatchObject({
      conflictingObservedLabels: 0,
      conflictingOmrResultsAcrossCaptures: 0,
      markedObservedLabels: 1,
      agreementWithObservedLabels: 0,
      questionsWithObservedDisagreement: 1
    });
  });
});
