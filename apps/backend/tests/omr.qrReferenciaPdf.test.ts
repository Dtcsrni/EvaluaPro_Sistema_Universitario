import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { localizarQrsEsperadosEnRaster, prepararQrsEsperados, type GeometriaQrPdf, type QrReferenciaEsperado } from '../src/modulos/modulo_escaneo_omr/infra/qrReferenciaPdf.js';

const PAGE = { width: 1275, height: 1650, pageWidthPoints: 612, pageHeightPoints: 792 };
const GEOMETRY: GeometriaQrPdf = { x: 120, y: 180, size: 150, marginModules: 4, errorCorrectionLevel: 'H' };

function crearRaster(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const grayscale = new Uint8Array(PAGE.width * PAGE.height);
  grayscale.fill(255);
  const totalModules = qr.modules.size + 8;
  const cell = GEOMETRY.size / totalModules;
  for (let y = 0; y < PAGE.height; y += 1) {
    const pointYFromTop = (y + 0.5) * PAGE.pageHeightPoints / PAGE.height;
    const pointYFromBottom = PAGE.pageHeightPoints - pointYFromTop;
    const localRow = Math.floor((GEOMETRY.y + GEOMETRY.size - pointYFromBottom) / cell) - 4;
    if (localRow < 0 || localRow >= qr.modules.size) continue;
    for (let x = 0; x < PAGE.width; x += 1) {
      const pointX = (x + 0.5) * PAGE.pageWidthPoints / PAGE.width;
      const localColumn = Math.floor((pointX - GEOMETRY.x) / cell) - 4;
      if (localColumn >= 0 && localColumn < qr.modules.size && qr.modules.data[localRow * qr.modules.size + localColumn] === 1) {
        grayscale[y * PAGE.width + x] = 0;
      }
    }
  }
  return grayscale;
}

function candidate(key: string, raw: string): QrReferenciaEsperado {
  return { key, raw, geometry: GEOMETRY };
}

describe('cotejo QR de referencia PDF', () => {
  it('precompila candidatos una vez y localiza el payload exacto en el raster', () => {
    const target = 'EXAMEN:LOT00001:P1:TV4:ID:00000001';
    const expected = [
      ...Array.from({ length: 30 }, (_, index) => candidate(`other-${index}`, `EXAMEN:LOT00001:P1:TV4:ID:${String(index + 2).padStart(8, '0')}`)),
      candidate('target', target)
    ];
    const preparedExpected = prepararQrsEsperados(expected);
    const found = localizarQrsEsperadosEnRaster({ ...PAGE, grayscale: crearRaster(target), expected, preparedExpected });

    expect(found.map(({ key }) => key)).toEqual(['target']);
  });

  it('rechaza dimensiones inválidas y geometría con matriz incompatible', () => {
    const raw = 'EXAMEN:LOT00001:P1:TV4:ID:00000001';
    const expected = [candidate('mismatch', raw)];
    expected[0]!.geometry = { ...GEOMETRY, matrixModules: 99 };

    expect(localizarQrsEsperadosEnRaster({ ...PAGE, grayscale: new Uint8Array(1), expected })).toEqual([]);
    expect(localizarQrsEsperadosEnRaster({ ...PAGE, grayscale: crearRaster(raw), expected })).toEqual([]);
  });
});
