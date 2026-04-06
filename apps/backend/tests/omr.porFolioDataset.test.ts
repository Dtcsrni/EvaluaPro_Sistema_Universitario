import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAnswerKey,
  buildCaptureSources,
  deriveCaptureId,
  parseOrganizationSnapshot
} from '../src/modulos/modulo_escaneo_omr/porFolioDataset';

describe('porFolioDataset', () => {
  it('deriva captureId estable por folio, pagina y recaptura', () => {
    expect(deriveCaptureId(' ab-12 ', 2, 3)).toBe('AB-12-P2-C3');
  });

  it('parsea snapshot y descarta filas invalidas', () => {
    const snapshot = parseOrganizationSnapshot({
      total: 3,
      items: [
        {
          archivoOriginal: 'cam1.jpg',
          qrTexto: 'EXAMEN:FOLIO1:P1:TV4',
          folioId: 'folio1',
          pagina: 1,
          metodo: 'qr',
          destino: 'omr_samples_tv3\\images\\Por Folio\\FOLIO1\\cam1.jpg'
        },
        {
          archivoOriginal: '',
          folioId: 'folio1',
          pagina: 1,
          metodo: 'qr',
          destino: 'omr_samples_tv3\\images\\Por Folio\\FOLIO1\\cam2.jpg'
        },
        {
          archivoOriginal: 'cam3.jpg',
          folioId: 'folio1',
          pagina: 0,
          metodo: 'qr',
          destino: 'omr_samples_tv3\\images\\Por Folio\\FOLIO1\\cam3.jpg'
        }
      ]
    });

    expect(snapshot.total).toBe(3);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      archivoOriginal: 'cam1.jpg',
      folioId: 'FOLIO1',
      pagina: 1
    });
  });

  it('construye capturas independientes para recapturas del mismo folio/pagina', () => {
    const snapshot = parseOrganizationSnapshot({
      total: 3,
      items: [
        {
          archivoOriginal: 'cam2.jpg',
          qrTexto: '',
          folioId: 'folio1',
          pagina: 1,
          metodo: 'qr',
          destino: 'omr_samples_tv3\\images\\Por Folio\\FOLIO1\\cam2.jpg'
        },
        {
          archivoOriginal: 'cam1.jpg',
          qrTexto: 'EXAMEN:FOLIO1:P1:TV4',
          folioId: 'folio1',
          pagina: 1,
          metodo: 'qr',
          destino: 'omr_samples_tv3\\images\\Por Folio\\FOLIO1\\cam1.jpg'
        },
        {
          archivoOriginal: 'cam3.jpg',
          qrTexto: 'EXAMEN:FOLIO1:P2:TV4',
          folioId: 'folio1',
          pagina: 2,
          metodo: 'qr',
          destino: 'omr_samples_tv3\\images\\Por Folio\\FOLIO1\\cam3.jpg'
        }
      ]
    });

    const captures = buildCaptureSources(snapshot, 'V:\\repo');

    expect(captures.map((item) => item.captureId)).toEqual([
      'FOLIO1-P1-C1',
      'FOLIO1-P1-C2',
      'FOLIO1-P2-C1'
    ]);
    expect(captures[0]).toMatchObject({
      sourceGroup: 'FOLIO1:P1',
      expectedQr: 'EXAMEN:FOLIO1:P1:TV4',
      sourcePath: 'omr_samples_tv3/images/Por Folio/FOLIO1/cam1.jpg'
    });
    expect(captures[1]?.expectedQr).toBe('EXAMEN:FOLIO1:P1:TV4');
  });

  it('usa imagen fallback del dataset cuando la fuente historica ya no existe', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'por-folio-fallback-'));
    try {
      const fallbackDatasetRoot = path.join(tempRoot, 'dataset');
      mkdirSync(path.join(fallbackDatasetRoot, 'images'), { recursive: true });
      writeFileSync(path.join(fallbackDatasetRoot, 'images', 'FOLIO1-P1-C1.jpg'), 'fake-image');

      const snapshot = parseOrganizationSnapshot({
        total: 1,
        items: [
          {
            archivoOriginal: 'cam1.jpg',
            qrTexto: 'EXAMEN:FOLIO1:P1:TV4',
            folioId: 'folio1',
            pagina: 1,
            metodo: 'qr',
            destino: '../../omr_samples_tv3/images/Por Folio/FOLIO1/cam1.jpg'
          }
        ]
      });

      const captures = buildCaptureSources(snapshot, tempRoot, { fallbackDatasetRoot });

      expect(captures).toHaveLength(1);
      expect(captures[0]).toMatchObject({
        captureId: 'FOLIO1-P1-C1',
        sourcePath: 'omr_samples_tv3/images/Por Folio/FOLIO1/cam1.jpg'
      });
      expect(captures[0]?.absoluteImagePath).toBe(path.join(fallbackDatasetRoot, 'images', 'FOLIO1-P1-C1.jpg'));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('consolida answer key por mayoria y omite blanks/doubles', () => {
    const answerKey = buildAnswerKey([
      {
        captureId: 'F1-P1-C1',
        folio: 'F1',
        numeroPagina: 1,
        numeroPregunta: 101,
        opcionEsperada: 'C',
        markType: 'valid',
        selectedOptions: ['C'],
        sourceEvidence: {
          detector: 'panel_darkness_v1',
          panelIndex: 0,
          panelBounds: { x: 1, y: 2, width: 3, height: 4 },
          rawScores: { A: 0, B: 0, C: 0.7, D: 0, E: 0 },
          dominantGap: 0.7
        }
      },
      {
        captureId: 'F2-P1-C1',
        folio: 'F2',
        numeroPagina: 1,
        numeroPregunta: 101,
        opcionEsperada: 'C',
        markType: 'valid',
        selectedOptions: ['C'],
        sourceEvidence: {
          detector: 'panel_darkness_v1',
          panelIndex: 0,
          panelBounds: { x: 1, y: 2, width: 3, height: 4 },
          rawScores: { A: 0, B: 0, C: 0.8, D: 0, E: 0 },
          dominantGap: 0.8
        }
      },
      {
        captureId: 'F3-P1-C1',
        folio: 'F3',
        numeroPagina: 1,
        numeroPregunta: 101,
        opcionEsperada: null,
        markType: 'double',
        selectedOptions: ['B', 'C'],
        sourceEvidence: {
          detector: 'panel_darkness_v1',
          panelIndex: 0,
          panelBounds: { x: 1, y: 2, width: 3, height: 4 },
          rawScores: { A: 0, B: 0.4, C: 0.41, D: 0, E: 0 },
          dominantGap: 0.01
        }
      }
    ]);

    expect(answerKey).toEqual({ 101: 'C' });
  });
});
