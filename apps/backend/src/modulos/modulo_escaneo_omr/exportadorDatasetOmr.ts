import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';

export type FuenteDatasetOmr = {
  id: string;
  path: string;
  sha256: string;
  bytes: number;
  pages: number;
};

export type PaginaDatasetOmr = {
  pageIndex: number;
  sourceFileId: string;
  sourcePage: number;
  examId?: string;
  examPage?: number;
  folio?: string;
  identitySource?: 'qr' | 'manual';
  scanStatus: string;
  resolutionReason?: string;
  responses: Array<{
    numeroPregunta: number;
    opcion: string | null;
    estadoRespuesta?: string;
  }>;
};

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function paginaConfirmada(page: PaginaDatasetOmr) {
  return page.scanStatus === 'needs_review'
    && Boolean(page.examId && page.examPage && page.folio && page.identitySource && page.resolutionReason?.trim())
    && page.responses.length > 0
    && page.responses.every((answer) => answer.estadoRespuesta === 'manual_review'
      && Number.isInteger(answer.numeroPregunta)
      && answer.numeroPregunta > 0
      && (answer.opcion === null || /^[A-E]$/.test(answer.opcion)));
}

function crearVerificadorStream(expectedHash: string, expectedBytes: number) {
  const digest = createHash('sha256');
  let bytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      digest.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      if (digest.digest('hex') !== expectedHash || bytes !== expectedBytes) {
        callback(new Error('OMR_DATASET_SOURCE_HASH_MISMATCH'));
        return;
      }
      callback();
    }
  });
}

export async function generarZipDatasetOmr(args: {
  sources: FuenteDatasetOmr[];
  pages: PaginaDatasetOmr[];
  pageIndexes: number[];
  tempRoot?: string;
}) {
  const selected = new Set(args.pageIndexes);
  const pages = args.pages.filter((page) => selected.has(page.pageIndex));
  if (pages.length !== selected.size || pages.some((page) => !paginaConfirmada(page))) {
    throw new Error('OMR_DATASET_PAGE_NOT_CONFIRMED');
  }
  const sourcesById = new Map(args.sources.map((source) => [source.id, source]));
  if (pages.some((page) => !sourcesById.has(page.sourceFileId))) throw new Error('OMR_DATASET_SOURCE_MISSING');
  const usedSources = args.sources.filter((source) => pages.some((page) => page.sourceFileId === source.id));
  const sourceNumber = new Map(usedSources.map((source, index) => [source.id, index + 1]));
  const manifest = {
    schema: 'evaluapro.omr-dataset',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourcePolicy: 'Original PDF bytes are preserved without recompression. Source pixels may contain identifying information.',
    sources: usedSources.map((source, index) => ({
      file: `sources/source-${String(index + 1).padStart(3, '0')}.pdf`,
      sha256: source.sha256,
      bytes: source.bytes,
      pages: source.pages
    })),
    labels: pages.map((page) => ({
      pageId: `page-${String(page.pageIndex).padStart(4, '0')}`,
      source: `sources/source-${String(sourceNumber.get(page.sourceFileId)).padStart(3, '0')}.pdf`,
      sourcePage: page.sourcePage,
      examPage: page.examPage,
      identityVerified: true,
      identityVerification: page.identitySource,
      responses: [...page.responses]
        .sort((left, right) => left.numeroPregunta - right.numeroPregunta)
        .map(({ numeroPregunta, opcion }) => ({ numeroPregunta, opcion, labelStatus: 'teacher_confirmed' })),
      labelStatus: 'teacher_confirmed'
    }))
  };

  const tempDir = await fs.mkdtemp(path.join(args.tempRoot ?? os.tmpdir(), 'evaluapro-omr-dataset-'));
  const archivePath = path.join(tempDir, 'dataset.zip');
  const archive = archiver('zip', { store: true });
  const writer = createWriteStream(archivePath, { flags: 'wx' });
  const writing = pipeline(archive, writer);

  try {
    for (const [index, source] of usedSources.entries()) {
      if (!/^[a-f0-9]{64}$/i.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes < 0) {
        throw new Error('OMR_DATASET_SOURCE_METADATA_INVALID');
      }
      const stream = createReadStream(source.path).pipe(crearVerificadorStream(source.sha256, source.bytes));
      archive.append(stream, { name: `sources/source-${String(index + 1).padStart(3, '0')}.pdf` });
    }
    archive.append(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'), { name: 'labels.json' });
    await Promise.race([archive.finalize(), writing]);
    await writing;
    const stat = await fs.stat(archivePath);
    const zipHash = createHash('sha256');
    for await (const chunk of createReadStream(archivePath)) zipHash.update(chunk as Buffer);
    return {
      path: archivePath,
      tempDir,
      sha256: zipHash.digest('hex'),
      bytes: stat.size,
      sourceCount: usedSources.length,
      labelCount: pages.length,
      cleanup: () => fs.rm(tempDir, { recursive: true, force: true })
    };
  } catch (error) {
    archive.destroy(error instanceof Error ? error : new Error('OMR_DATASET_ARCHIVE_FAILED'));
    await writing.catch(() => undefined);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export { paginaConfirmada as esPaginaDatasetOmrConfirmada, sha256 as hashDatasetOmr };
