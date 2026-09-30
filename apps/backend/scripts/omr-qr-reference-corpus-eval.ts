import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { rasterizarPdfParaPreview } from '../src/modulos/modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';
import { OMR_ENGINE_RELEASE } from '../src/modulos/modulo_escaneo_omr/omr/engineRelease.js';
import { localizarQrsEsperadosEnRaster, prepararQrsEsperados, type GeometriaQrPdf } from '../src/modulos/modulo_escaneo_omr/infra/qrReferenciaPdf.js';

type ExamRow = { id: string; loteId: string; folio: string; paginas: string; mapaOmr: string | null };
type ExpectedPage = { numero: number; raw: string; key: string; geometry: GeometriaQrPdf };

function argumento(nombre: string, fallback: string) {
  return process.argv.find((value) => value.startsWith(`--${nombre}=`))?.slice(nombre.length + 3) ?? fallback;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  try { return JSON.parse(raw ?? '') as T; } catch { return fallback; }
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

function leerExpectativas(rows: ExamRow[]): ExpectedPage[] {
  const expected: ExpectedPage[] = [];
  for (const row of rows) {
    const pages = parseJson<Array<{ numero?: unknown; qrTexto?: unknown }>>(row.paginas, []);
    const maps = parseJson<{ paginas?: Array<{ numeroPagina?: unknown; qr?: GeometriaQrPdf }> }>(row.mapaOmr, {});
    for (const page of pages) {
      const numero = Number(page.numero);
      const raw = String(page.qrTexto ?? '').trim();
      const geometry = maps.paginas?.find((item) => Number(item.numeroPagina) === numero)?.qr;
      if (!Number.isInteger(numero) || numero < 1 || !raw || !geometry || ![geometry.x, geometry.y, geometry.size].every(Number.isFinite)) {
        throw new Error('El mapa canónico tiene página sin QR o geometría OMR válida.');
      }
      expected.push({ numero, raw, key: `${row.id}:p${numero}`, geometry });
    }
  }
  const uniquePayloads = new Set(expected.map((item) => item.raw));
  if (uniquePayloads.size !== expected.length) throw new Error('Los payloads QR esperados no son únicos en el lote.');
  return expected;
}

async function cotejarPdf(pdfPath: string, expected: ExpectedPage[], databaseExamCount: number, dpi: number, blockSize: number) {
  const bytes = await fs.readFile(pdfPath);
  const pdfHash = sha256(bytes);
  const document = await PDFDocument.load(bytes);
  const totalPages = document.getPageCount();
  const expectedPayloads = new Set(expected.map((item) => item.raw));
  const preparedExpected = prepararQrsEsperados(expected);
  const seenPayloads = new Set<string>();
  let pagesWithSingleQr = 0;
  let pagesWithExactExpectedQr = 0;
  let ambiguousPages = 0;
  let pagesWithoutMatch = 0;
  let unexpectedMatches = 0;

  for (let start = 1; start <= totalPages; start += blockSize) {
    const raster = await rasterizarPdfParaPreview(bytes, { dpi, desdePagina: start, cantidadPaginas: blockSize });
    if (raster.paginas.length !== Math.min(blockSize, totalPages - start + 1)) {
      throw new Error(`Raster incompleto en ${path.basename(pdfPath)} desde página ${start}.`);
    }
    for (const rasterPage of raster.paginas) {
      const [, encoded = ''] = rasterPage.dataUrl.split(',', 2);
      if (!encoded) throw new Error(`Página ${rasterPage.numero} sin imagen raster.`);
      const { data, info } = await sharp(Buffer.from(encoded, 'base64')).greyscale().raw().toBuffer({ resolveWithObject: true });
      const page = document.getPage(rasterPage.numero - 1);
      const found = localizarQrsEsperadosEnRaster({
        grayscale: data,
        width: info.width,
        height: info.height,
        pageWidthPoints: page.getWidth(),
        pageHeightPoints: page.getHeight(),
        expected,
        preparedExpected
      });
      if (found.length === 1) {
        pagesWithSingleQr += 1;
        const raw = found[0]!.raw;
        if (expectedPayloads.has(raw)) {
          pagesWithExactExpectedQr += 1;
          seenPayloads.add(raw);
        } else {
          unexpectedMatches += 1;
        }
      } else if (found.length > 1) {
        ambiguousPages += 1;
      } else {
        pagesWithoutMatch += 1;
      }
    }
  }

  return {
    file: path.basename(pdfPath),
    fileSha256: pdfHash,
    pdfPages: totalPages,
    databaseExamCount,
    expectedQrPages: expected.length,
    exactExpectedQrPages: pagesWithExactExpectedQr,
    uniqueExpectedPayloadsFound: seenPayloads.size,
    pagesWithSingleQr: pagesWithSingleQr,
    ambiguousPages,
    pagesWithoutMatch,
    unexpectedMatches,
    fullCoverage: totalPages === expected.length && seenPayloads.size === expectedPayloads.size && unexpectedMatches === 0
  };
}

async function main() {
  const pdfDirectory = path.resolve(argumento('pdf-dir', 'D:/Downloads'));
  const databasePath = path.resolve(argumento('database', 'C:/ProgramData/EvaluaPro/data/evaluapro.db'));
  const dpi = Number(argumento('dpi', '200'));
  const blockSize = Number(argumento('block-size', '8'));
  if (!Number.isInteger(dpi) || dpi < 72 || dpi > 600) throw new Error('DPI fuera del rango permitido de 72 a 600.');
  if (!Number.isInteger(blockSize) || blockSize < 1 || blockSize > 20) throw new Error('Tamaño de bloque fuera del rango permitido de 1 a 20 páginas.');
  const startedAt = performance.now();
  const suffixArgument = process.argv.find((value) => value.startsWith('--suffixes='))?.slice('--suffixes='.length);
  const suffixFilter = suffixArgument ? new Set(suffixArgument.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)) : null;
  const database = new DatabaseSync(databasePath, { readOnly: true, enableForeignKeyConstraints: false });
  const query = database.prepare('SELECT id, loteId, folio, paginas, mapaOmr FROM examenes_generados WHERE upper(loteId) LIKE ?');
  const pdfFiles = (await fs.readdir(pdfDirectory))
    .filter((name) => {
      const match = name.match(/lote-([0-9a-f]{8})/i);
      return name.startsWith('evaluapro_paquete_examenes') && name.toLowerCase().endsWith('.pdf') && Boolean(match) && (!suffixFilter || suffixFilter.has(match![1]!.toUpperCase()));
    })
    .sort();
  const seenFileHashes = new Map<string, string>();
  const results: Array<Record<string, unknown>> = [];

  try {
    for (const fileName of pdfFiles) {
      const match = fileName.match(/lote-([0-9a-f]{8})/i);
      if (!match) continue;
      const suffix = match[1]!.toUpperCase();
      const filePath = path.join(pdfDirectory, fileName);
      const fileHash = sha256(await fs.readFile(filePath));
      const duplicate = seenFileHashes.get(fileHash);
      if (duplicate) {
        results.push({ file: fileName, duplicateOf: duplicate, fileSha256: fileHash });
        continue;
      }
      seenFileHashes.set(fileHash, fileName);
      const rows = query.all(`%${suffix}`) as unknown as ExamRow[];
      const lotIds = new Set(rows.map((row) => row.loteId));
      if (lotIds.size !== 1 || rows.length === 0) {
        results.push({ file: fileName, lotSuffix: suffix, databaseExamCount: rows.length, fullCoverage: false, error: 'lote_canonico_ausente_o_ambiguo' });
        continue;
      }
      try {
        const expected = leerExpectativas(rows);
        const result = await cotejarPdf(filePath, expected, rows.length, dpi, blockSize);
        results.push({ ...result, lotSuffix: suffix });
      } catch (error) {
        results.push({ file: fileName, fileSha256: fileHash, lotSuffix: suffix, databaseExamCount: rows.length, fullCoverage: false, error: error instanceof Error ? error.message : 'error_desconocido' });
      }
    }
  } finally {
    database.close();
  }

  console.log(JSON.stringify({
    evaluator: 'geometric_qr_reference_pdf_corpus',
    engineRelease: `${OMR_ENGINE_RELEASE.id}@${OMR_ENGINE_RELEASE.version}`,
    databaseMode: 'read_only',
    rasterDpi: dpi,
    pageBlockSize: blockSize,
    elapsedMs: Math.round(performance.now() - startedAt),
    uniquePdfCount: results.filter((item) => !('duplicateOf' in item)).length,
    duplicatePdfCount: results.filter((item) => 'duplicateOf' in item).length,
    allUniquePdfsFullCoverage: results.filter((item) => !('duplicateOf' in item)).every((item) => item.fullCoverage === true),
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Error desconocido al evaluar referencias PDF.');
  process.exitCode = 1;
});
