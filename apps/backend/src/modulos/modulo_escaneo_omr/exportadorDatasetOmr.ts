import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ZipArchive } from 'archiver';
import type { GroundTruthRowPorFolio, MapaOmrPaginaPorFolio, OpcionOmr } from './porFolioDataset.js';

export type FuenteDatasetOmr = {
  id: string;
  path: string;
  sha256: string;
  bytes: number;
  pages: number;
};

type HumanReviewDatasetOmr = {
  method: 'visual_original_capture';
  reviewerIdHash: string;
  reviewedAt: string;
  reviewerAttested: true;
  independentOfOmr: true;
  omrPredictionsHidden: true;
};

type RespuestaDatasetOmr = {
  numeroPregunta: number;
  opcion: string | null;
  tipoMarcaManual?: 'valid' | 'blank' | 'double' | 'smudge';
  selectedOptions?: Array<'A' | 'B' | 'C' | 'D' | 'E'>;
  estadoRespuesta?: string;
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
  humanReview?: HumanReviewDatasetOmr;
  groundTruthReview?: {
    humanReview: HumanReviewDatasetOmr;
    bonusVisible?: boolean;
    responses: RespuestaDatasetOmr[];
  };
  responses: RespuestaDatasetOmr[];
};

export type CapturaImportPilotoReal = {
  captureId: string;
  folio: string;
  numeroPagina: number;
  captureOrdinal: number;
  imageSourcePath: string;
  imagePath: string;
  imageSha256: string;
  imageBytes: number;
  mapaOmr: MapaOmrPaginaPorFolio;
  questionRange: { from: number; to: number };
  sourcePath: string;
  sourceGroup: string;
  expectedQr: string;
  bonusVisible?: boolean;
  truthRows: GroundTruthRowPorFolio[];
};

export type ImportPilotoReal = {
  captures: CapturaImportPilotoReal[];
  answerKeyByFolio: Record<string, Record<number, OpcionOmr>>;
};

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function paginaConfirmada(page: PaginaDatasetOmr) {
  const humanReview = page.groundTruthReview?.humanReview ?? page.humanReview;
  const responses = page.groundTruthReview?.responses ?? page.responses;
  return page.scanStatus !== 'rejected'
    && Boolean(page.examId && page.examPage && page.folio && page.identitySource)
    && (Boolean(page.groundTruthReview) || Boolean(page.resolutionReason?.trim()))
    && humanReview?.method === 'visual_original_capture'
    && humanReview.reviewerAttested === true
    && humanReview.independentOfOmr === true
    && humanReview.omrPredictionsHidden === true
    && /^[a-f0-9]{64}$/i.test(humanReview.reviewerIdHash)
    && Number.isFinite(Date.parse(humanReview.reviewedAt))
    && new Date(humanReview.reviewedAt).toISOString() === humanReview.reviewedAt
    && responses.length > 0
    && responses.every((answer) => answer.estadoRespuesta === 'manual_review'
      && ['valid', 'blank', 'double', 'smudge'].includes(answer.tipoMarcaManual ?? '')
      && Number.isInteger(answer.numeroPregunta)
      && answer.numeroPregunta > 0
      && (answer.opcion === null || /^[A-E]$/.test(answer.opcion))
      && (answer.selectedOptions === undefined || (answer.selectedOptions.length <= 5 && answer.selectedOptions.every((option) => /^[A-E]$/.test(option))))
      && (answer.tipoMarcaManual !== 'valid' || (answer.opcion !== null && (answer.selectedOptions ?? [answer.opcion]).length === 1))
      && (answer.tipoMarcaManual !== 'blank' || (answer.opcion === null && (answer.selectedOptions ?? []).length === 0))
      && (answer.tipoMarcaManual !== 'double' || (answer.opcion === null && (answer.selectedOptions ?? []).length >= 2))
      && (answer.tipoMarcaManual !== 'smudge' || (answer.opcion === null && (answer.selectedOptions ?? []).length === 0)));
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
  pilotReal?: ImportPilotoReal;
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
  const pilotCaptureIds = new Set(args.pilotReal?.captures.map((capture) => capture.captureId) ?? []);
  if (args.pilotReal && (
    args.pilotReal.captures.length !== pages.length
    || pilotCaptureIds.size !== args.pilotReal.captures.length
    || args.pilotReal.captures.some((capture) => !selected.has(pages.find((page) => page.examId && page.folio === capture.folio && page.examPage === capture.numeroPagina)?.pageIndex ?? -1))
  )) throw new Error('OMR_DATASET_PILOT_CAPTURE_MISMATCH');
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
    labels: pages.map((page) => {
      const humanReview = page.groundTruthReview?.humanReview ?? page.humanReview;
      const responses = page.groundTruthReview?.responses ?? page.responses;
      return {
        pageId: `page-${String(page.pageIndex).padStart(4, '0')}`,
        source: `sources/source-${String(sourceNumber.get(page.sourceFileId)).padStart(3, '0')}.pdf`,
        sourcePage: page.sourcePage,
        examPage: page.examPage,
        identityVerified: true,
        identityVerification: page.identitySource,
        humanReview,
        ...(page.examPage === 1 && page.groundTruthReview?.bonusVisible !== undefined
          ? { bonusVisible: page.groundTruthReview.bonusVisible }
          : {}),
        responses: [...responses]
          .sort((left, right) => left.numeroPregunta - right.numeroPregunta)
          .map(({ numeroPregunta, opcion, tipoMarcaManual, selectedOptions }) => ({
          numeroPregunta,
          opcion,
          tipoMarcaManual,
          selectedOptions: selectedOptions ?? [],
          labelStatus: 'teacher_confirmed',
          humanReview
        })),
        labelStatus: 'teacher_confirmed'
      };
    })
  };

  const tempDir = await fs.mkdtemp(path.join(args.tempRoot ?? os.tmpdir(), 'evaluapro-omr-dataset-'));
  const archivePath = path.join(tempDir, 'dataset.zip');
  const archive = new ZipArchive({ store: true });
  const writer = createWriteStream(archivePath, { flags: 'wx' });
  const writing = pipeline(archive, writer);
  let rejectSourceError!: (error: Error) => void;
  const sourceFailure = new Promise<never>((_resolve, reject) => {
    rejectSourceError = reject;
  });
  void sourceFailure.catch(() => undefined);

  try {
    for (const [index, source] of usedSources.entries()) {
      if (!/^[a-f0-9]{64}$/i.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes < 0) {
        throw new Error('OMR_DATASET_SOURCE_METADATA_INVALID');
      }
      const sourceStream = createReadStream(source.path);
      const verifiedStream = crearVerificadorStream(source.sha256, source.bytes);
      sourceStream.once('error', rejectSourceError);
      verifiedStream.once('error', rejectSourceError);
      const stream = sourceStream.pipe(verifiedStream);
      archive.append(stream, { name: `sources/source-${String(index + 1).padStart(3, '0')}.pdf` });
    }
    if (args.pilotReal) {
      const answerKeyByFolio: Record<string, Record<number, OpcionOmr>> = {};
      for (const [folio, key] of Object.entries(args.pilotReal.answerKeyByFolio)) {
        if (!folio.trim() || !key || Object.keys(key).length === 0 || Object.values(key).some((option) => !['A', 'B', 'C', 'D', 'E'].includes(option))) {
          throw new Error('OMR_DATASET_PILOT_ANSWER_KEY_INVALID');
        }
        answerKeyByFolio[folio.trim().toUpperCase()] = key;
      }
      const captures = args.pilotReal.captures.map((capture) => {
        if (!/^[a-f0-9]{64}$/i.test(capture.imageSha256) || !Number.isSafeInteger(capture.imageBytes) || capture.imageBytes < 1) {
          throw new Error('OMR_DATASET_PILOT_IMAGE_METADATA_INVALID');
        }
        if (capture.truthRows.length !== capture.mapaOmr.preguntas.length || capture.truthRows.some((row) => row.captureId !== capture.captureId || row.folio.toUpperCase() !== capture.folio.toUpperCase() || row.numeroPagina !== capture.numeroPagina)) {
          throw new Error('OMR_DATASET_PILOT_GROUND_TRUTH_MISMATCH');
        }
        const imageFile = `pilot-real/${capture.imagePath.replace(/\\/g, '/')}`;
        const mapPath = `maps/${capture.captureId}.json`;
        const mapFile = `pilot-real/${mapPath}`;
        const image = createReadStream(capture.imageSourcePath).pipe(crearVerificadorStream(capture.imageSha256, capture.imageBytes));
        archive.append(image, { name: imageFile });
        archive.append(Buffer.from(`${JSON.stringify(capture.mapaOmr, null, 2)}\n`, 'utf8'), { name: mapFile });
        return {
          captureId: capture.captureId,
          folio: capture.folio,
          numeroPagina: capture.numeroPagina,
          captureOrdinal: capture.captureOrdinal,
          imageSourcePath: capture.imagePath.replace(/\\/g, '/'),
          mapaOmrSourcePath: mapPath,
          questionRange: capture.questionRange,
          sourcePath: capture.sourcePath,
          sourceGroup: capture.sourceGroup,
          expectedQr: capture.expectedQr,
          ...(capture.bonusVisible === undefined ? {} : { bonusVisible: capture.bonusVisible }),
          truthRows: capture.truthRows
        };
      });
      const pilotImport = {
        version: '1',
        datasetType: 'tv4_pilot_real_import',
        answerKeyByFolio,
        captures
      };
      archive.append(Buffer.from(`${JSON.stringify(pilotImport, null, 2)}\n`, 'utf8'), { name: 'pilot-real/pilot_import.json' });
    }
    archive.append(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'), { name: 'labels.json' });
    await Promise.race([archive.finalize(), writing, sourceFailure]);
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
    archive.abort();
    archive.destroy();
    await writing.catch(() => undefined);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export { paginaConfirmada as esPaginaDatasetOmrConfirmada, sha256 as hashDatasetOmr };
