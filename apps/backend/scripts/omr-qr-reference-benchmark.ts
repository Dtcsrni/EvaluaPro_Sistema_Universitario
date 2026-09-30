import { performance } from 'node:perf_hooks';
import QRCode from 'qrcode';
import { localizarQrsEsperadosEnRaster, prepararQrsEsperados, type QrReferenciaEsperado } from '../src/modulos/modulo_escaneo_omr/infra/qrReferenciaPdf.js';

const page = { width: 1275, height: 1650, pageWidthPoints: 612, pageHeightPoints: 792 };
const geometry = { x: 120, y: 180, size: 150, marginModules: 4, errorCorrectionLevel: 'H' as const };
const candidateCount = Number(process.argv.find((argument) => argument.startsWith('--candidates='))?.split('=')[1] ?? 100);
const pageCount = Number(process.argv.find((argument) => argument.startsWith('--pages='))?.split('=')[1] ?? 8);
const repetitions = Number(process.argv.find((argument) => argument.startsWith('--repetitions='))?.split('=')[1] ?? 5);
if (![candidateCount, pageCount, repetitions].every(Number.isInteger) || candidateCount < 2 || candidateCount > 100 || pageCount < 1 || repetitions < 3) {
  throw new Error('Parámetros no válidos: use 2–100 candidatos, >=1 página y >=3 repeticiones.');
}

const expected = Array.from({ length: candidateCount }, (_, index): QrReferenciaEsperado => ({
  key: `candidate-${index}`,
  raw: `EXAMEN:LOT00001:P1:TV4:ID:${String(index + 1).padStart(8, '0')}`,
  geometry
}));
const target = expected.at(-1)!;
const qr = QRCode.create(target.raw, { errorCorrectionLevel: 'H' });
const gray = new Uint8Array(page.width * page.height);
gray.fill(255);
const totalModules = qr.modules.size + 8;
const cell = geometry.size / totalModules;
for (let y = 0; y < page.height; y += 1) {
  const pointYFromTop = (y + 0.5) * page.pageHeightPoints / page.height;
  const pointYFromBottom = page.pageHeightPoints - pointYFromTop;
  const row = Math.floor((geometry.y + geometry.size - pointYFromBottom) / cell) - 4;
  if (row < 0 || row >= qr.modules.size) continue;
  for (let x = 0; x < page.width; x += 1) {
    const pointX = (x + 0.5) * page.pageWidthPoints / page.width;
    const column = Math.floor((pointX - geometry.x) / cell) - 4;
    if (column >= 0 && column < qr.modules.size && qr.modules.data[row * qr.modules.size + column] === 1) {
      gray[y * page.width + x] = 0;
    }
  }
}

function localizarLineal(expectedItems: QrReferenciaEsperado[]) {
  const matched: QrReferenciaEsperado[] = [];
  const groups = new Map<string, Array<{ item: QrReferenciaEsperado; modules: Uint8Array; size: number }>>();
  for (const item of expectedItems) {
    const modules = QRCode.create(item.raw, { errorCorrectionLevel: item.geometry.errorCorrectionLevel ?? 'H' }).modules;
    const key = `${item.geometry.x}:${item.geometry.y}:${item.geometry.size}:${item.geometry.marginModules ?? 0}:${modules.size}:${item.geometry.errorCorrectionLevel ?? 'H'}`;
    const group = groups.get(key) ?? [];
    group.push({ item, modules: modules.data, size: modules.size });
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const { item, size } = group[0]!;
    const geometry = item.geometry;
    const margin = Math.max(0, Math.round(geometry.marginModules ?? 0));
    const cellSize = geometry.size / (size + margin * 2);
    const allowed = Math.floor(size * size * 0.035);
    const pixelsPerPoint = Math.min(page.width / page.pageWidthPoints, page.height / page.pageHeightPoints);
    if (cellSize * pixelsPerPoint < 1.25) continue;
    for (const candidate of group) {
      let best = allowed + 1;
      for (const offsetY of [-1, 0, 1]) {
        for (const offsetX of [-1, 0, 1]) {
          let mismatches = 0;
          for (let row = 0; row < size && mismatches <= Math.min(allowed, best); row += 1) {
            for (let column = 0; column < size; column += 1) {
              const pdfX = geometry.x + (margin + column + 0.5) * cellSize;
              const pdfY = geometry.y + geometry.size - (margin + row + 0.5) * cellSize;
              const pixelX = Math.round(pdfX * page.width / page.pageWidthPoints) + offsetX;
              const pixelY = Math.round((page.pageHeightPoints - pdfY) * page.height / page.pageHeightPoints) + offsetY;
              if (pixelX < 0 || pixelX >= page.width || pixelY < 0 || pixelY >= page.height) {
                mismatches = allowed + 1;
                break;
              }
              if ((gray[pixelY * page.width + pixelX]! < 128) !== (candidate.modules[row * size + column] === 1)) mismatches += 1;
              if (mismatches > Math.min(allowed, best)) break;
            }
          }
          best = Math.min(best, mismatches);
          if (best === 0) break;
        }
        if (best === 0) break;
      }
      if (best <= allowed) matched.push(candidate.item);
    }
  }
  return matched;
}

function median(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

const legacyMs: number[] = [];
const packedMs: number[] = [];
for (let repetition = 0; repetition < repetitions + 1; repetition += 1) {
  const beforeLegacy = performance.now();
  let legacyKeys: string[] = [];
  for (let index = 0; index < pageCount; index += 1) legacyKeys = localizarLineal(expected).map(({ key }) => key);
  const elapsedLegacy = performance.now() - beforeLegacy;

  const beforePacked = performance.now();
  const preparedExpected = prepararQrsEsperados(expected);
  let packedKeys: string[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    packedKeys = localizarQrsEsperadosEnRaster({ ...page, grayscale: gray, expected, preparedExpected }).map(({ key }) => key);
  }
  const elapsedPacked = performance.now() - beforePacked;
  if (legacyKeys.join('|') !== packedKeys.join('|') || legacyKeys.length !== 1 || legacyKeys[0] !== target.key) {
    throw new Error('Los dos cotejadores no produjeron la misma coincidencia exacta.');
  }
  if (repetition > 0) {
    legacyMs.push(elapsedLegacy);
    packedMs.push(elapsedPacked);
  }
}

const legacyMedianMs = median(legacyMs);
const packedMedianMs = median(packedMs);
console.log(JSON.stringify({
  benchmark: 'synthetic_qr_reference_page_scan',
  engineRelease: 'evaluapro-omr-qr@1.0.0-dev.3',
  candidates: candidateCount,
  pages: pageCount,
  qrModules: qr.modules.size,
  raster: `${page.width}x${page.height}`,
  repetitions,
  legacyMedianMs: Number(legacyMedianMs.toFixed(2)),
  packedMedianMs: Number(packedMedianMs.toFixed(2)),
  speedup: Number((legacyMedianMs / packedMedianMs).toFixed(2)),
  equivalence: true,
  source: 'synthetic_only_not_production_accuracy_evidence'
}, null, 2));
