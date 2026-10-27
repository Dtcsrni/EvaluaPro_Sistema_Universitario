/**
 * omr.tv4.pilot-real.validator
 *
 * Garantiza que la ausencia de capturas fisicas se registre como
 * not_applicable, sin convertirla en una falsa aprobacion ni en un fallo
 * silencioso del proceso de validacion.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calcularConcordanciaNotasPorExamen,
  contarAbstencionesBono,
  calcularConcordanciaPorCondicion,
  calcularCotaInferiorExactaConcordancia,
  cumpleGateConcordanciaNotas,
  calcularMinimoExamenesSinDiscordancias,
  detectarDuplicadoImagenEntreFolios,
  isResolvedDetection,
  readAnswerKeysByFolio,
  runTv4PilotRealValidation,
  validarHashCapturaEtiquetada,
  validarIdentidadQrCaptura,
  validarGroundTruthHumano
} from '../scripts/omr-tv4-validate-pilot-real.js';
import { OMR_RUNTIME_CONFIG_SHA256 } from '../src/modulos/modulo_escaneo_omr/politicaAutoCalificacionOmr.js';
import { esquemaRegistrarVerdadTerrenoOmr } from '../src/modulos/modulo_escaneo_omr/validacionesOmr.js';

describe('validador piloto real TV4', () => {
  it('reporta concordancia por condición agrupada por examen independiente', () => {
    const result = calcularConcordanciaPorCondicion([
      { folio: 'EX-1', condition: 'mark:valid', discordant: false },
      { folio: 'EX-1', condition: 'mark:valid', discordant: true },
      { folio: 'EX-2', condition: 'mark:valid', discordant: false },
      { folio: 'EX-2', condition: 'bonus:visible', discordant: false }
    ]);
    expect(result).toEqual([
      {
        condition: 'bonus:visible', independentExams: 1, units: 1,
        discordantExams: 0, discordantUnits: 0, consistency: 1, lower95: 0.05
      },
      {
        condition: 'mark:valid', independentExams: 2, units: 3,
        discordantExams: 1, discordantUnits: 1, consistency: 0.5,
        lower95: Number(calcularCotaInferiorExactaConcordancia(2, 1)?.toFixed(6))
      }
    ]);
  });

  it('no considera resuelta una doble marca aunque exista una opción candidata', () => {
    expect(isResolvedDetection({
      opcion: 'A', flags: ['doble_marca'], confianza: 0.99, estadoRespuesta: 'doble_marca'
    })).toBe(false);
  });

  it('considera resuelto un blanco confirmado y deja ambigüedad pendiente', () => {
    expect(isResolvedDetection({
      opcion: null, flags: [], confianza: 0.99, estadoRespuesta: 'sin_marca'
    })).toBe(true);
    expect(isResolvedDetection({
      opcion: null, flags: ['parcial_detectada'], confianza: 0.99, estadoRespuesta: 'ambigua'
    })).toBe(false);
  });

  it('exige revisión visual independiente para cada fila de verdad terreno', () => {
    const row = {
      captureId: 'FOLIO1-P1-C1',
      folio: 'FOLIO1',
      numeroPagina: 1,
      numeroPregunta: 1,
      opcionEsperada: 'C' as const,
      markType: 'valid' as const,
      selectedOptions: ['C' as const],
      bonusVisible: false,
      sourceEvidence: {
        detector: 'manual_visual_review' as const,
        sourcePage: 1,
        pageImageSha256: 'b'.repeat(64)
      }
    };

    expect(validarGroundTruthHumano([row]).valid).toBe(false);
    const reviewed = {
      ...row,
      humanReview: {
        method: 'visual_original_capture',
        reviewerIdHash: 'a'.repeat(64),
        reviewedAt: '2026-10-24T12:00:00.000Z',
        reviewerAttested: true as const,
        independentOfOmr: true as const,
        omrPredictionsHidden: true as const
      }
    };
    expect(validarGroundTruthHumano([reviewed])).toMatchObject({ valid: true, reviewedRows: 1, reviewerCount: 1, invalidRows: [] });
    expect(validarGroundTruthHumano([{ ...reviewed, humanReview: { ...reviewed.humanReview, reviewerAttested: undefined } }]).valid).toBe(false);
    expect(validarGroundTruthHumano([{
      ...reviewed,
      sourceEvidence: {
        detector: 'panel_darkness_v1' as const,
        panelIndex: 0,
        panelBounds: { x: 0, y: 0, width: 1, height: 1 },
        rawScores: { A: 0, B: 0, C: 1, D: 0, E: 0 },
        dominantGap: 1
      }
    }]).valid).toBe(false);
    expect(validarHashCapturaEtiquetada([reviewed], 'b'.repeat(64))).toEqual([]);
    expect(validarHashCapturaEtiquetada([reviewed], 'c'.repeat(64))).toEqual(['FOLIO1-P1-C1:Q1']);
  });

  it('mide concordancia exacta por examen y excluye coberturas incompletas o no automáticas', () => {
    const answerKey = Object.fromEntries(Array.from({ length: 19 }, (_, index) => [index + 1, 'A'])) as Record<number, 'A'>;
    const resultado = calcularConcordanciaNotasPorExamen(answerKey, [
      { fullCoverage: true, autoEligible: true, expectedCorrect: 10, detectedCorrect: 10, expectedBonus: 0, detectedBonus: 0 },
      { fullCoverage: true, autoEligible: true, expectedCorrect: 10, detectedCorrect: 8, expectedBonus: 0, detectedBonus: 0 },
      { fullCoverage: false, autoEligible: true, expectedCorrect: 10, detectedCorrect: 10, expectedBonus: 0, detectedBonus: 0 },
      { fullCoverage: true, autoEligible: false, expectedCorrect: 10, detectedCorrect: 10, expectedBonus: 0, detectedBonus: 0 },
      { fullCoverage: true, autoEligible: true, expectedCorrect: 10, detectedCorrect: 10, expectedBonus: 0, bonusLabelSeen: true }
    ]);

    expect(resultado).toEqual({
      gradeComparisons: 2,
      gradeConsistency: 0.5,
      automaticGradeDiscordances: 1,
      bonusComparisons: 2,
      bonusConsistency: 1,
      bonusDiscordances: 0
    });
    expect(contarAbstencionesBono([
      { fullCoverage: true, autoEligible: true, expectedCorrect: 1, detectedCorrect: 1, expectedBonus: 0, bonusLabelSeen: true },
      { fullCoverage: true, autoEligible: true, expectedCorrect: 1, detectedCorrect: 1, expectedBonus: 0, detectedBonus: 0, bonusLabelSeen: true },
      { fullCoverage: true, autoEligible: true, expectedCorrect: 1, detectedCorrect: 1, expectedBonus: 0 }
    ])).toBe(1);
  });

  it('detecta error de bono incluso si el tope 5 oculta el error en la nota final', () => {
    const resultado = calcularConcordanciaNotasPorExamen({ 1: 'A' }, [{
      fullCoverage: true,
      autoEligible: true,
      expectedCorrect: 1,
      detectedCorrect: 1,
      expectedBonus: 0.25,
      detectedBonus: 0
    }]);
    expect(resultado.gradeConsistency).toBe(1);
    expect(resultado.bonusConsistency).toBe(0);
    expect(resultado.bonusDiscordances).toBe(1);
  });

  it('calcula el límite inferior exacto unilateral con y sin discordancias', () => {
    const minimo = calcularMinimoExamenesSinDiscordancias({ targetConsistency: 0.98, confidenceLevel: 0.95 });
    expect(minimo).toBe(149);
    expect(calcularCotaInferiorExactaConcordancia(0, 0)).toBeNull();
    expect(calcularCotaInferiorExactaConcordancia(148, 0)).toBeLessThan(0.98);
    expect(calcularCotaInferiorExactaConcordancia(minimo, 0)).toBeGreaterThanOrEqual(0.98);
    expect(calcularCotaInferiorExactaConcordancia(minimo, 0)).toBeCloseTo(0.980095, 6);
    expect(calcularCotaInferiorExactaConcordancia(149, 1)).toBeLessThan(0.98);
    expect(calcularCotaInferiorExactaConcordancia(1, 1)).toBe(0);
    expect(calcularCotaInferiorExactaConcordancia(2, 1)).toBeCloseTo(0.0253205655, 9);
    expect(cumpleGateConcordanciaNotas(148, 0, 0.98)).toBe(false);
    expect(cumpleGateConcordanciaNotas(149, 0, 0.98)).toBe(true);
    expect(cumpleGateConcordanciaNotas(149, 1, 0.98)).toBe(false);
    expect(() => calcularCotaInferiorExactaConcordancia(-1, 0)).toThrow('entero no negativo');
    expect(() => calcularCotaInferiorExactaConcordancia(2, 3)).toThrow('discordancias');
    expect(() => calcularMinimoExamenesSinDiscordancias({ targetConsistency: 1 })).toThrow('intervalo abierto');
  });

  it('no permite contar la misma imagen de examen bajo dos folios como muestras independientes', () => {
    const seen = new Map<string, { folio: string; captureId: string }>();
    const imageSha256 = 'd'.repeat(64);
    expect(detectarDuplicadoImagenEntreFolios({ imageSha256, captureId: 'FOLIO1-P1-C1', folio: 'folio1', seen })).toBeNull();
    expect(detectarDuplicadoImagenEntreFolios({ imageSha256, captureId: 'FOLIO1-P1-C2', folio: 'FOLIO1', seen })).toBeNull();
    expect(detectarDuplicadoImagenEntreFolios({ imageSha256, captureId: 'FOLIO2-P1-C1', folio: 'FOLIO2', seen })).toBe('FOLIO1-P1-C1');
  });

  it('exige que el QR del mapa y manifest coincida exactamente con el folio, página y TV4', () => {
    const expectedQr = 'EXAMEN:FOLIO1:P2:TV4';
    expect(validarIdentidadQrCaptura({ expectedQr, mapQr: expectedQr, folio: 'folio1', numeroPagina: 2 })).toBe(true);
    expect(validarIdentidadQrCaptura({ expectedQr, mapQr: 'EXAMEN:FOLIO2:P2:TV4', folio: 'FOLIO1', numeroPagina: 2 })).toBe(false);
    expect(validarIdentidadQrCaptura({ expectedQr: 'EXAMEN:FOLIO2:P2:TV4', mapQr: 'EXAMEN:FOLIO2:P2:TV4', folio: 'FOLIO1', numeroPagina: 2 })).toBe(false);
    expect(validarIdentidadQrCaptura({ expectedQr, mapQr: expectedQr, folio: 'FOLIO1', numeroPagina: 1 })).toBe(false);
  });

  it('el endpoint no acepta etiquetas de verdad terreno sin confirmación explícita de revisión ciega', () => {
    const payload = {
      bonusVisible: false,
      finalResponses: [{ numeroPregunta: 1, opcion: null, tipoMarcaManual: 'blank' as const, selectedOptions: [] }]
    };
    expect(esquemaRegistrarVerdadTerrenoOmr.safeParse(payload).success).toBe(false);
    expect(esquemaRegistrarVerdadTerrenoOmr.safeParse({
      ...payload,
      confirmOriginalVisualReview: true,
      confirmBlindOmrReview: true
    }).success).toBe(true);
  });

  it('lee claves visibles distintas por folio para validar variantes del mismo lote', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-answer-keys-'));
    const keyPath = path.join(root, 'answer-keys.json');
    try {
      await fs.writeFile(keyPath, JSON.stringify({
        FOLIO_A: { 1: 'A', 2: 'B' },
        FOLIO_B: { 1: 'C', 2: 'D' }
      }), 'utf8');
      await expect(readAnswerKeysByFolio(keyPath)).resolves.toEqual({
        FOLIO_A: { 1: 'A', 2: 'B' },
        FOLIO_B: { 1: 'C', 2: 'D' }
      });
      await fs.writeFile(keyPath, JSON.stringify({ FOLIO_A: { 1: 'A', 3: 'B' } }), 'utf8');
      await expect(readAnswerKeysByFolio(keyPath)).rejects.toThrow('preguntas consecutivas desde 1');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('persiste not_applicable cuando el dataset no tiene capturas', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-pilot-'));
    const reportPath = path.join(root, 'reports', 'validation.json');
    const failureReportPath = path.join(root, 'reports', 'failures.json');
    try {
      await fs.writeFile(
        path.join(root, 'manifest.json'),
        JSON.stringify({
          version: '1',
          datasetType: 'tv4_pilot_real',
          templateVersion: 4,
          thresholds: {
            precisionMin: 0.98,
            falsePositiveMax: 0.01,
            invalidDetectionMin: 0.95,
            pagePassMin: 0.95,
            autoGradeTrustMin: 0.95,
            autoCoverageMin: 0.95,
            gradeConsistencyLower95Min: 0.98
          },
          groundTruthRef: 'ground_truth.jsonl',
          answerKeyPath: 'answer_key.json',
          capturas: []
        }),
        'utf8'
      );

      const resultado = await runTv4PilotRealValidation({
        datasetRoot: root,
        reportPath,
        failureReportPath
      });

      expect(resultado.report.status).toBe('not_applicable');
      expect(resultado.report.evidenceHashes.omrRuntimeConfigSha256).toBe(OMR_RUNTIME_CONFIG_SHA256);
      expect(resultado.report.ok).toBe(false);
      expect(resultado.report.metrics.totalCaptures).toBe(0);
      expect(resultado.report.metrics.concordanceByCondition).toEqual([]);
      expect(resultado.report.metrics.gradeConsistencyLower95).toBeNull();
      expect(resultado.report.metrics.bonusConsistencyLower95).toBeNull();
      expect(resultado.report.metrics.gradeConsistencyEvidence.minimumPerfectExamsFor98Percent95).toBe(149);
      expect(resultado.report.checks.pagePassRate).toBe(false);
      expect(resultado.report.checks.gradeConsistencyLower95).toBe(false);
      expect(resultado.report.checks.bonusConsistencyLower95).toBe(false);
      expect(resultado.failures.topCauses).toEqual([{ causa: 'capture_count_zero', total: 1 }]);
      expect(JSON.parse(await fs.readFile(reportPath, 'utf8')).status).toBe('not_applicable');
      expect(JSON.parse(await fs.readFile(failureReportPath, 'utf8')).status).toBe('not_applicable');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rechaza un umbral de cobertura automática inferior a 80 por ciento', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-pilot-coverage-'));
    try {
      await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
        version: '1', datasetType: 'tv4_pilot_real', templateVersion: 4,
        thresholds: { autoCoverageMin: 0.79, gradeConsistencyLower95Min: 0.98 },
        groundTruthRef: 'ground_truth.jsonl', answerKeyPath: 'answer_key.json', capturas: []
      }), 'utf8');
      await expect(runTv4PilotRealValidation({
        datasetRoot: root,
        reportPath: path.join(root, 'reports', 'validation.json'),
        failureReportPath: path.join(root, 'reports', 'failures.json')
      })).rejects.toThrow('thresholds.autoCoverageMin entre 0.8 y 1.0');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('no permite bajar de 98 por ciento el límite inferior de concordancia', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-pilot-grade-threshold-'));
    try {
      await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
        version: '1', datasetType: 'tv4_pilot_real', templateVersion: 4,
        thresholds: { autoCoverageMin: 0.95, gradeConsistencyLower95Min: 0.979 },
        groundTruthRef: 'ground_truth.jsonl', answerKeyPath: 'answer_key.json', capturas: []
      }), 'utf8');
      await expect(runTv4PilotRealValidation({
        datasetRoot: root,
        reportPath: path.join(root, 'reports', 'validation.json'),
        failureReportPath: path.join(root, 'reports', 'failures.json')
      })).rejects.toThrow('entre 0.98 y 1.0');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rechaza etiquetas sin procedencia de revisión ciega aunque exista evidencia del detector', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-pilot-human-'));
    const reportPath = path.join(root, 'reports', 'validation.json');
    const failureReportPath = path.join(root, 'reports', 'failures.json');
    try {
      await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
        version: '1',
        datasetType: 'tv4_pilot_real',
        templateVersion: 4,
        thresholds: {
          precisionMin: 0.98,
          falsePositiveMax: 0.01,
          invalidDetectionMin: 0.95,
          pagePassMin: 0.95,
          autoGradeTrustMin: 0.95,
          autoCoverageMin: 0.95,
          gradeConsistencyLower95Min: 0.98
        },
        groundTruthRef: 'ground_truth.jsonl',
        answerKeyPath: 'answer_key.json',
        capturas: [{
          captureId: 'FOLIO1-P1-C1', folio: 'FOLIO1', numeroPagina: 1, captureOrdinal: 1,
          imagePath: 'images/page.jpg', mapaOmrPath: 'maps/page.json', questionRange: { from: 1, to: 1 },
          sourcePath: 'scan.pdf#page=1', sourceGroup: 'FOLIO1:P1', templateVersion: 4,
          expectedQr: 'EXAMEN:FOLIO1:P1:TV4'
        }]
      }), 'utf8');
      await fs.writeFile(path.join(root, 'answer_key.json'), JSON.stringify({ 1: 'A' }), 'utf8');
      await fs.writeFile(path.join(root, 'ground_truth.jsonl'), JSON.stringify({
        captureId: 'FOLIO1-P1-C1', folio: 'FOLIO1', numeroPagina: 1, numeroPregunta: 1,
        opcionEsperada: 'A', markType: 'valid', selectedOptions: ['A'],
        sourceEvidence: {
          detector: 'panel_darkness_v1', panelIndex: 0,
          panelBounds: { x: 0, y: 0, width: 1, height: 1 },
          rawScores: { A: 1, B: 0, C: 0, D: 0, E: 0 }, dominantGap: 1
        }
      }) + '\n', 'utf8');

      await expect(runTv4PilotRealValidation({
        datasetRoot: root,
        reportPath,
        failureReportPath
      })).rejects.toThrow('requiere revisión humana visual independiente');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
