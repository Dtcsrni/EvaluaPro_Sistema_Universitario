import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFromImportManifest } from '../scripts/omr-tv4-build-pilot-real.js';

describe('importación del piloto real TV4', () => {
  it('mantiene las respuestas del alumno como truth y toma las claves explícitas por folio', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-tv4-import-'));
    const inputRoot = path.join(root, 'input');
    const outputRoot = path.join(root, 'output');
    const inputImages = path.join(inputRoot, 'images');
    const inputMaps = path.join(inputRoot, 'maps');
    await Promise.all([
      fs.mkdir(inputImages, { recursive: true }),
      fs.mkdir(inputMaps, { recursive: true }),
      fs.mkdir(path.join(outputRoot, 'images'), { recursive: true }),
      fs.mkdir(path.join(outputRoot, 'maps'), { recursive: true }),
      fs.mkdir(path.join(outputRoot, 'source'), { recursive: true })
    ]);

    try {
      const repoRoot = path.resolve(process.cwd(), '../..');
      const sourceImage = path.join(repoRoot, 'omr_samples_tv4', 'images', 'TV4-SYNTH-001-P1.jpg');
      const sourceMap1 = path.join(repoRoot, 'omr_samples_tv4', 'maps', 'TV4-SYNTH-001-P1.json');
      const sourceMap2 = path.join(repoRoot, 'omr_samples_tv4', 'maps', 'TV4-SYNTH-001-P2.json');
      await Promise.all([
        fs.copyFile(sourceImage, path.join(inputImages, 'capture-a.jpg')),
        fs.copyFile(sourceImage, path.join(inputImages, 'capture-b.jpg')),
        fs.copyFile(sourceMap1, path.join(inputMaps, 'page-1.json')),
        fs.copyFile(sourceMap2, path.join(inputMaps, 'page-2.json'))
      ]);
      const review = {
        method: 'visual_original_capture',
        reviewerIdHash: 'a'.repeat(64),
        reviewedAt: '2026-10-24T12:00:00.000Z',
        reviewerAttested: true,
        independentOfOmr: true,
        omrPredictionsHidden: true
      } as const;
      const sourceEvidence = {
        detector: 'panel_darkness_v1',
        panelIndex: 0,
        panelBounds: { x: 0, y: 0, width: 1, height: 1 },
        rawScores: { A: 0, B: 1, C: 0, D: 0, E: 0 },
        dominantGap: 1
      };
      const sourceManifest = path.join(inputRoot, 'pilot_import.json');
      await fs.writeFile(sourceManifest, JSON.stringify({
        version: '1',
        datasetType: 'tv4_pilot_real_import',
        answerKey: { 1: 'A' },
        answerKeyByFolio: { FOLIO_A: { 1: 'A' }, FOLIO_B: { 1: 'C' } },
        captures: [
          {
            captureId: 'capture-a', folio: 'FOLIO_A', numeroPagina: 1, imageSourcePath: 'images/capture-a.jpg',
            mapaOmrSourcePath: 'maps/page-1.json', questionRange: { from: 1, to: 1 }, expectedQr: 'EXAMEN:FOLIO_A:P1:TV4', bonusVisible: false,
            truthRows: [{ numeroPregunta: 1, opcionEsperada: 'B', markType: 'valid', selectedOptions: ['B'], humanReview: review, sourceEvidence }]
          },
          {
            captureId: 'capture-b', folio: 'FOLIO_B', numeroPagina: 2, imageSourcePath: 'images/capture-b.jpg',
            mapaOmrSourcePath: 'maps/page-2.json', questionRange: { from: 1, to: 1 }, expectedQr: 'EXAMEN:FOLIO_B:P2:TV4',
            truthRows: [{ numeroPregunta: 1, opcionEsperada: 'D', markType: 'valid', selectedOptions: ['D'], humanReview: review, sourceEvidence }]
          }
        ]
      }), 'utf8');

      const result = await buildFromImportManifest(outputRoot, sourceManifest);
      const manifest = JSON.parse(await fs.readFile(path.join(outputRoot, 'manifest.json'), 'utf8')) as { answerKeyByFolioPath?: string };
      const globalKey = JSON.parse(await fs.readFile(path.join(outputRoot, 'answer_key.json'), 'utf8'));
      const folioKeys = JSON.parse(await fs.readFile(path.join(outputRoot, manifest.answerKeyByFolioPath!), 'utf8'));
      const truth = (await fs.readFile(path.join(outputRoot, 'ground_truth.jsonl'), 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));

      expect(result).toMatchObject({ captures: 2, questions: 2, answerKeyQuestions: 1, imported: true });
      expect(globalKey).toEqual({ 1: 'A' });
      expect(folioKeys).toEqual({ FOLIO_A: { 1: 'A' }, FOLIO_B: { 1: 'C' } });
      expect(truth.map((row) => [row.folio, row.opcionEsperada])).toEqual([['FOLIO_A', 'B'], ['FOLIO_B', 'D']]);
      expect(truth.find((row) => row.folio === 'FOLIO_A')).toMatchObject({ bonusVisible: false });
      expect(truth.every((row) => row.humanReview?.independentOfOmr === true && row.humanReview.omrPredictionsHidden === true)).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
