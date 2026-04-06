import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analizarOmrMock = vi.fn();

vi.mock('../src/modulos/modulo_escaneo_omr/servicioOmr', () => ({
  analizarOmr: (...args: unknown[]) => analizarOmrMock(...args)
}));

describe('omr tv3 por folio validation', () => {
  let tempDir: string;
  let cwdOriginal: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'omr-por-folio-'));
    cwdOriginal = process.cwd();
    process.chdir(tempDir);
    analizarOmrMock.mockReset();
  });

  afterEach(async () => {
    process.chdir(cwdOriginal);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function writeDataset() {
    const datasetRoot = path.join(tempDir, 'dataset');
    await fs.mkdir(path.join(datasetRoot, 'images'), { recursive: true });
    await fs.mkdir(path.join(datasetRoot, 'maps'), { recursive: true });

    await fs.writeFile(path.join(datasetRoot, 'images', 'CAP-1.jpg'), 'img', 'utf8');
    await fs.writeFile(
      path.join(datasetRoot, 'maps', 'CAP-1.json'),
      JSON.stringify({
        numeroPagina: 1,
        templateVersion: 3,
        preguntas: []
      }),
      'utf8'
    );
    await fs.writeFile(
      path.join(datasetRoot, 'manifest.json'),
      JSON.stringify({
        version: '1',
        datasetType: 'tv3_real_por_folio',
        thresholds: {
          precisionMin: 1,
          falsePositiveMax: 0,
          invalidDetectionMin: 1,
          pagePassMin: 1,
          autoGradeTrustMin: 1,
          autoCoverageMin: 1
        },
        groundTruthRef: 'ground_truth.jsonl',
        capturas: [
          {
            captureId: 'CAP-1',
            folio: 'FOLIO1',
            numeroPagina: 1,
            captureOrdinal: 1,
            imagePath: 'images/CAP-1.jpg',
            mapaOmrPath: 'maps/CAP-1.json',
            questionRange: { from: 101, to: 102 },
            sourcePath: 'omr_samples_tv3/images/Por Folio/FOLIO1/CAP-1.jpg',
            sourceGroup: 'FOLIO1:P1',
            templateVersion: 3,
            expectedQr: 'EXAMEN:FOLIO1:P1:TV3'
          }
        ]
      }),
      'utf8'
    );

    return datasetRoot;
  }

  it('agrega metricas correctas cuando la deteccion coincide con el truth', async () => {
    const datasetRoot = await writeDataset();
    await fs.writeFile(
      path.join(datasetRoot, 'ground_truth.jsonl'),
      [
        JSON.stringify({
          captureId: 'CAP-1',
          folio: 'FOLIO1',
          numeroPagina: 1,
          numeroPregunta: 101,
          opcionEsperada: 'A',
          markType: 'valid',
          selectedOptions: ['A'],
          sourceEvidence: {
            detector: 'panel_darkness_v1',
            panelIndex: 0,
            panelBounds: { x: 1, y: 2, width: 3, height: 4 },
            rawScores: { A: 0.7, B: 0, C: 0, D: 0, E: 0 },
            dominantGap: 0.7
          }
        }),
        JSON.stringify({
          captureId: 'CAP-1',
          folio: 'FOLIO1',
          numeroPagina: 1,
          numeroPregunta: 102,
          opcionEsperada: null,
          markType: 'blank',
          selectedOptions: [],
          sourceEvidence: {
            detector: 'panel_darkness_v1',
            panelIndex: 1,
            panelBounds: { x: 1, y: 2, width: 3, height: 4 },
            rawScores: { A: 0, B: 0, C: 0, D: 0, E: 0 },
            dominantGap: 0
          }
        })
      ].join('\n') + '\n',
      'utf8'
    );

    analizarOmrMock.mockResolvedValue({
      respuestasDetectadas: [
        { numeroPregunta: 101, opcion: 'A', confianza: 0.9, scoresPorOpcion: [], flags: [] },
        { numeroPregunta: 102, opcion: null, confianza: 0, scoresPorOpcion: [], flags: [] }
      ],
      advertencias: [],
      calidadPagina: 0.9,
      estadoAnalisis: 'ok',
      motivosRevision: [],
      templateVersionDetectada: 3,
      confianzaPromedioPagina: 0.9,
      ratioAmbiguas: 0,
      engineVersion: 'omr-v3-cv',
      geomQuality: 0.9,
      photoQuality: 0.9,
      decisionPolicy: 'conservadora_v1'
    });

    const { runTv3PorFolioValidation } = await import('../scripts/omr-tv3-validate-por-folio');
    const result = await runTv3PorFolioValidation({
      datasetRoot,
      reportPath: path.join(tempDir, 'report.json'),
      failureReportPath: path.join(tempDir, 'failures.json')
    });

    expect(result.report.ok).toBe(true);
    expect(result.report.metrics).toMatchObject({
      precision: 1,
      falsePositiveRate: 0,
      invalidDetectionRate: 1,
      pagePassRate: 1,
      autoCoverageRate: 1,
      totalCaptures: 1,
      totalPreguntasEvaluadas: 2
    });
  });

  it('falla explicitamente cuando falta truth para una captura del manifest', async () => {
    const datasetRoot = await writeDataset();
    await fs.writeFile(path.join(datasetRoot, 'ground_truth.jsonl'), '', 'utf8');

    const { runTv3PorFolioValidation } = await import('../scripts/omr-tv3-validate-por-folio');

    await expect(
      runTv3PorFolioValidation({
        datasetRoot,
        reportPath: path.join(tempDir, 'report.json'),
        failureReportPath: path.join(tempDir, 'failures.json')
      })
    ).rejects.toThrow('No hay truth para CAP-1');
  });
});
