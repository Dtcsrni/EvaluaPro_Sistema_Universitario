import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { esPaginaDatasetOmrConfirmada, generarZipDatasetOmr } from '../src/modulos/modulo_escaneo_omr/exportadorDatasetOmr.js';

const respuestaConfirmada = { numeroPregunta: 1, opcion: 'B', tipoMarcaManual: 'valid' as const, selectedOptions: ['B'] as const, estadoRespuesta: 'manual_review' };
const paginaConfirmada = {
  pageIndex: 2,
  sourceFileId: 'source-id',
  sourcePage: 2,
  examId: 'exam-private-id',
  examPage: 1,
  folio: 'FOLIO-PRIVATE-QR',
  identitySource: 'manual' as const,
  scanStatus: 'needs_review',
  resolutionReason: 'Comparada visualmente',
  humanReview: {
    method: 'visual_original_capture' as const,
    reviewerIdHash: 'a'.repeat(64),
    reviewedAt: '2026-10-24T12:00:00.000Z',
    reviewerAttested: true as const,
    independentOfOmr: true as const,
    omrPredictionsHidden: true as const
  },
  responses: [respuestaConfirmada]
};

function extraerEntradasZip(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  while (offset >= 0 && offset + 46 < buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = buffer.toString('utf8', nameStart, nameStart + fileNameLength);
    if (method !== 0) throw new Error(`Método ZIP inesperado: ${method}`);
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, buffer.subarray(dataStart, dataStart + compressedSize));
    offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), offset + 46 + fileNameLength + extraLength + commentLength);
  }
  return entries;
}

describe('exportador de datasets OMR', () => {
  it('exporta PDF fuente sin recomprimir y manifiesto con etiquetas confirmadas sin identidad', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-dataset-test-'));
    const source = path.join(root, 'identidad-privada.pdf');
    const bytes = Buffer.from('%PDF-1.7\nNombre Alumna Ejemplo\nQR FOLIO-PRIVATE-QR\n', 'utf8');
    await fs.writeFile(source, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let generated: Awaited<ReturnType<typeof generarZipDatasetOmr>> | undefined;

    try {
      expect(esPaginaDatasetOmrConfirmada(paginaConfirmada)).toBe(true);
      generated = await generarZipDatasetOmr({
        tempRoot: root,
        sources: [{ id: 'source-id', path: source, sha256, bytes: bytes.length, pages: 2 }],
        pages: [paginaConfirmada],
        pageIndexes: [2]
      });
      const archive = await fs.readFile(generated.path);
      const entries = extraerEntradasZip(archive);
      const labels = entries.get('labels.json')?.toString('utf8') ?? '';
      const labelsJson = JSON.parse(labels) as { labels: Array<{ responses: Array<{ humanReview?: unknown; tipoMarcaManual?: string; selectedOptions?: string[] }> }> };

      expect(entries.get('sources/source-001.pdf')).toEqual(bytes);
      expect(labels).toContain('teacher_confirmed');
      expect(labels).toContain('visual_original_capture');
      expect(labels).toContain('2026-10-24T12:00:00.000Z');
      expect(labels).toContain('a'.repeat(64));
      expect(labelsJson.labels[0]?.responses[0]?.humanReview).toMatchObject({
        method: 'visual_original_capture',
        reviewerIdHash: 'a'.repeat(64),
        reviewedAt: '2026-10-24T12:00:00.000Z',
        reviewerAttested: true,
        independentOfOmr: true,
        omrPredictionsHidden: true
      });
      expect(labels).toContain('"opcion": "B"');
      expect(labelsJson.labels[0]?.responses[0]).toMatchObject({ tipoMarcaManual: 'valid', selectedOptions: ['B'] });
      expect(labels).not.toContain('Nombre Alumna Ejemplo');
      expect(labels).not.toContain('FOLIO-PRIVATE-QR');
      expect(labels).not.toContain('exam-private-id');
      expect(labels).not.toContain('identidad-privada.pdf');
      expect(generated.sha256).toBe(createHash('sha256').update(archive).digest('hex'));
      expect(generated).toMatchObject({ sourceCount: 1, labelCount: 1 });
    } finally {
      await generated?.cleanup();
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rechaza páginas sin resolución manual guardada y fuentes cuyo hash cambió', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-dataset-integrity-'));
    const source = path.join(root, 'source.pdf');
    await fs.writeFile(source, Buffer.from('PDF modificado'));
    const unconfirmed = { ...paginaConfirmada, responses: [{ ...respuestaConfirmada, estadoRespuesta: 'respondida' }] };
    const withoutHumanReview = { ...paginaConfirmada, humanReview: undefined };
    const withoutBlindReview = { ...paginaConfirmada, humanReview: { ...paginaConfirmada.humanReview, omrPredictionsHidden: undefined } };
    const withoutReviewerAttestation = { ...paginaConfirmada, humanReview: { ...paginaConfirmada.humanReview, reviewerAttested: undefined } };
    const withoutMarkType = { ...paginaConfirmada, responses: [{ ...respuestaConfirmada, tipoMarcaManual: undefined }] };

    expect(esPaginaDatasetOmrConfirmada(withoutHumanReview)).toBe(false);
    expect(esPaginaDatasetOmrConfirmada(withoutBlindReview)).toBe(false);
    expect(esPaginaDatasetOmrConfirmada(withoutReviewerAttestation)).toBe(false);
    expect(esPaginaDatasetOmrConfirmada(withoutMarkType)).toBe(false);

    await expect(generarZipDatasetOmr({
      tempRoot: root,
      sources: [{ id: 'source-id', path: source, sha256: 'a'.repeat(64), bytes: 14, pages: 1 }],
      pages: [unconfirmed],
      pageIndexes: [2]
    })).rejects.toThrow('OMR_DATASET_PAGE_NOT_CONFIRMED');
    await expect(generarZipDatasetOmr({
      tempRoot: root,
      sources: [{ id: 'source-id', path: source, sha256: 'a'.repeat(64), bytes: 14, pages: 1 }],
      pages: [paginaConfirmada],
      pageIndexes: [2]
    })).rejects.toThrow('OMR_DATASET_SOURCE_HASH_MISMATCH');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('propaga el error de lectura de la fuente y limpia el ZIP parcial', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-dataset-source-error-'));
    const source = path.join(root, 'ausente.pdf');

    try {
      await expect(generarZipDatasetOmr({
        tempRoot: root,
        sources: [{ id: 'source-id', path: source, sha256: '0'.repeat(64), bytes: 0, pages: 1 }],
        pages: [paginaConfirmada],
        pageIndexes: [2]
      })).rejects.toMatchObject({ code: 'ENOENT' });

      expect(await fs.readdir(root)).toEqual([]);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('exporta una etiqueta ciega de página accepted sin sustituir la lectura OMR', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-dataset-blind-'));
    const source = path.join(root, 'source.pdf');
    const bytes = Buffer.from('%PDF-1.7\nsource\n', 'utf8');
    await fs.writeFile(source, bytes);
    const acceptedWithBlindTruth = {
      ...paginaConfirmada,
      scanStatus: 'accepted',
      resolutionReason: undefined,
      humanReview: undefined,
      responses: [{ ...respuestaConfirmada, opcion: 'A', selectedOptions: ['A'] as const, estadoRespuesta: 'respondida' }],
      groundTruthReview: {
        humanReview: {
          method: 'visual_original_capture' as const,
          reviewerIdHash: 'b'.repeat(64),
          reviewedAt: '2026-10-25T12:00:00.000Z',
          reviewerAttested: true,
          independentOfOmr: true as const,
          omrPredictionsHidden: true as const
        },
        responses: [{ ...respuestaConfirmada, opcion: 'B', selectedOptions: ['B'] as const }]
      }
    };
    let generated: Awaited<ReturnType<typeof generarZipDatasetOmr>> | undefined;
    try {
      expect(esPaginaDatasetOmrConfirmada(acceptedWithBlindTruth)).toBe(true);
      generated = await generarZipDatasetOmr({
        tempRoot: root,
        sources: [{ id: 'source-id', path: source, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, pages: 1 }],
        pages: [acceptedWithBlindTruth],
        pageIndexes: [2]
      });
      const entries = extraerEntradasZip(await fs.readFile(generated.path));
      const labels = JSON.parse(entries.get('labels.json')!.toString('utf8')) as { labels: Array<{ responses: Array<{ opcion: string; selectedOptions: string[]; humanReview: { reviewerIdHash: string } }> }> };
      expect(acceptedWithBlindTruth.responses[0]?.opcion).toBe('A');
      expect(labels.labels[0]?.responses[0]).toMatchObject({ opcion: 'B', selectedOptions: ['B'], humanReview: { reviewerIdHash: 'b'.repeat(64) } });
    } finally {
      await generated?.cleanup();
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
