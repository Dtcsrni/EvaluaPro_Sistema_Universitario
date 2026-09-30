import QRCode from 'qrcode';

export type GeometriaQrPdf = {
  x: number;
  y: number;
  size: number;
  marginModules?: number;
  matrixModules?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
};

export type QrReferenciaEsperado = {
  key: string;
  raw: string;
  geometry: GeometriaQrPdf;
};

type QrReferenciaCompilado = {
  expected: QrReferenciaEsperado;
  modules: Uint32Array;
};

export type QrsReferenciaPreparados = Array<{
  geometry: GeometriaQrPdf;
  matrixModules: number;
  candidates: QrReferenciaCompilado[];
}>;

const PAGE_WIDTH_POINTS = 612;
const PAGE_HEIGHT_POINTS = 792;
const MISMATCH_RATIO_MAX = 0.035;
const OFFSETS_PIXELS = [-1, 0, 1] as const;

function claveGeometria(geometry: GeometriaQrPdf, matrixModules: number) {
  return [
    geometry.x,
    geometry.y,
    geometry.size,
    geometry.marginModules ?? 0,
    matrixModules,
    geometry.errorCorrectionLevel ?? 'H'
  ].join(':');
}

function empaquetarModulos(modules: Uint8Array, size: number) {
  const packed = new Uint32Array(Math.ceil((size * size) / 32));
  for (let index = 0; index < size * size; index += 1) {
    if (modules[index] === 1) packed[index >>> 5] |= 1 << (index & 31);
  }
  return packed;
}

function contarBits(valor: number) {
  let bits = valor >>> 0;
  bits -= (bits >>> 1) & 0x55555555;
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
  bits = (bits + (bits >>> 4)) & 0x0f0f0f0f;
  bits += bits >>> 8;
  bits += bits >>> 16;
  return bits & 0x7f;
}

export function prepararQrsEsperados(expected: QrReferenciaEsperado[]): QrsReferenciaPreparados {
  const grupos = new Map<string, QrsReferenciaPreparados[number]>();
  for (const item of expected) {
    const geometry = item.geometry;
    if (![geometry.x, geometry.y, geometry.size].every(Number.isFinite) || geometry.size <= 0) continue;
    try {
      const qr = QRCode.create(item.raw, { errorCorrectionLevel: geometry.errorCorrectionLevel ?? 'H' });
      const size = qr.modules.size;
      if (geometry.matrixModules && geometry.matrixModules !== size) continue;
      const key = claveGeometria(geometry, size);
      let group = grupos.get(key);
      if (!group) {
        group = { geometry, matrixModules: size, candidates: [] };
        grupos.set(key, group);
      }
      group.candidates.push({ expected: item, modules: empaquetarModulos(qr.modules.data, size) });
    } catch {
      continue;
    }
  }
  return [...grupos.values()];
}

/**
 * Identifica QR vectoriales de una referencia PDF generada comparando la matriz
 * impresa con los payloads firmados persistidos. Se limita a la geometría OMR
 * conocida y tolera hasta 3.5 % de módulos distintos por rasterización.
 */
export function localizarQrsEsperadosEnRaster(args: {
  grayscale: Uint8Array;
  width: number;
  height: number;
  pageWidthPoints?: number;
  pageHeightPoints?: number;
  expected: QrReferenciaEsperado[];
  preparedExpected?: QrsReferenciaPreparados;
}): QrReferenciaEsperado[] {
  const { grayscale, width, height } = args;
  const pageWidthPoints = args.pageWidthPoints ?? PAGE_WIDTH_POINTS;
  const pageHeightPoints = args.pageHeightPoints ?? PAGE_HEIGHT_POINTS;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || grayscale.length !== width * height) return [];
  if (!Number.isFinite(pageWidthPoints) || !Number.isFinite(pageHeightPoints) || pageWidthPoints <= 0 || pageHeightPoints <= 0) return [];

  const grupos = args.preparedExpected ?? prepararQrsEsperados(args.expected);
  const encontrados = new Map<string, QrReferenciaEsperado>();
  for (const group of grupos) {
    const { geometry, matrixModules } = group;
    const marginModules = Math.max(0, Math.round(geometry.marginModules ?? 0));
    const totalModules = matrixModules + marginModules * 2;
    const cell = geometry.size / totalModules;
    if (!Number.isFinite(cell) || cell <= 0 || totalModules > 200) continue;
    const allowedMismatches = Math.floor(matrixModules * matrixModules * MISMATCH_RATIO_MAX);
    const pixelsPerPoint = Math.min(width / pageWidthPoints, height / pageHeightPoints);
    const modulePixels = cell * pixelsPerPoint;
    if (modulePixels < 1.25) continue;

    const muestras: Array<Uint32Array | null> = [];
    for (const offsetY of OFFSETS_PIXELS) {
      for (const offsetX of OFFSETS_PIXELS) {
        const sampled = new Uint32Array(Math.ceil((matrixModules * matrixModules) / 32));
        let fueraDePagina = false;
        for (let row = 0; row < matrixModules && !fueraDePagina; row += 1) {
          for (let column = 0; column < matrixModules; column += 1) {
            const pdfX = geometry.x + (marginModules + column + 0.5) * cell;
            const pdfY = geometry.y + geometry.size - (marginModules + row + 0.5) * cell;
            const pixelX = Math.round(pdfX * width / pageWidthPoints) + offsetX;
            const pixelY = Math.round((pageHeightPoints - pdfY) * height / pageHeightPoints) + offsetY;
            if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
              fueraDePagina = true;
              break;
            }
            const printedDark = grayscale[pixelY * width + pixelX]! < 128;
            if (printedDark) {
              const index = row * matrixModules + column;
              sampled[index >>> 5] |= 1 << (index & 31);
            }
          }
        }
        muestras.push(fueraDePagina ? null : sampled);
      }
    }

    for (const candidate of group.candidates) {
      let bestMismatches = allowedMismatches + 1;
      for (const sampled of muestras) {
        if (!sampled) continue;
        let mismatches = 0;
        for (let word = 0; word < candidate.modules.length; word += 1) {
          mismatches += contarBits(candidate.modules[word]! ^ sampled[word]!);
          if (mismatches > Math.min(allowedMismatches, bestMismatches)) break;
        }
        if (mismatches < bestMismatches) bestMismatches = mismatches;
        if (bestMismatches === 0) break;
      }
      if (bestMismatches <= allowedMismatches) encontrados.set(candidate.expected.key, candidate.expected);
    }
  }
  return [...encontrados.values()];
}
