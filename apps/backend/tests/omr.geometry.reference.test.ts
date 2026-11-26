/**
 * omr.geometry.reference
 *
 * Verifica que las marcas de página canónicas (L) se conviertan en vértices
 * físicos y que la geometría canónica conserve una referencia estable.
 */
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { analizarOmr, detectarQrConRotacionPagina } from '../src/modulos/modulo_escaneo_omr/servicioOmrCv.js';
import {
  coincidePayloadQrExacto,
  detectarQrDetalleZxing,
  detectarQrEnRecorteNativo,
  detectarQrMejorado,
  detectarQrPorGeometriaConocida,
  medirOrientacionReferenciaOmr,
  obtenerTransformacion
} from '../src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.js';

const ANCHO_CARTA = 612;
const ALTO_CARTA = 792;
const MM_A_PUNTOS = 72 / 25.4;

function crearHojaConMarcasL() {
  const gray = new Uint8ClampedArray(ANCHO_CARTA * ALTO_CARTA).fill(255);
  const margen = Math.round(10 * MM_A_PUNTOS);
  const brazo = Math.round(5.8 * MM_A_PUNTOS);
  const grosor = 2;
  const poner = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < ANCHO_CARTA && y < ALTO_CARTA) gray[y * ANCHO_CARTA + x] = 0;
  };
  const dibujarL = (x: number, y: number, dx: number, dy: number) => {
    for (let paso = 0; paso <= brazo; paso += 1) {
      for (let ancho = 0; ancho < grosor; ancho += 1) {
        poner(x + dx * paso + (dy === 0 ? 0 : dx * ancho), y + dy * paso + (dx === 0 ? 0 : dy * ancho));
      }
    }
  };

  // Coordenadas de imagen: cada L abre hacia el interior de la página.
  dibujarL(margen, margen, 1, 0);
  dibujarL(margen, margen, 0, 1);
  dibujarL(ANCHO_CARTA - margen, margen, -1, 0);
  dibujarL(ANCHO_CARTA - margen, margen, 0, 1);
  dibujarL(margen, ALTO_CARTA - margen, 1, 0);
  dibujarL(margen, ALTO_CARTA - margen, 0, -1);
  dibujarL(ANCHO_CARTA - margen, ALTO_CARTA - margen, -1, 0);
  dibujarL(ANCHO_CARTA - margen, ALTO_CARTA - margen, 0, -1);
  return gray;
}

function crearHojaConCuadrados() {
  const gray = new Uint8ClampedArray(ANCHO_CARTA * ALTO_CARTA).fill(255);
  const margen = Math.round(10 * MM_A_PUNTOS);
  const lado = Math.round(5.8 * MM_A_PUNTOS);
  const poner = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < ANCHO_CARTA && y < ALTO_CARTA) gray[y * ANCHO_CARTA + x] = 0;
  };
  for (let y = margen; y < margen + lado; y += 1) {
    for (let x = margen; x < margen + lado; x += 1) {
      poner(x, y);
      poner(ANCHO_CARTA - margen - lado + (x - margen), y);
      poner(x, ALTO_CARTA - margen - lado + (y - margen));
      poner(ANCHO_CARTA - margen - lado + (x - margen), ALTO_CARTA - margen - lado + (y - margen));
    }
  }
  return gray;
}

function crearHojaInclinada(grados: number) {
  const width = 1000;
  const height = 1000;
  const gray = new Uint8ClampedArray(width * height).fill(255);
  const scale = 1;
  const cx = width / 2;
  const cy = height / 2;
  const angulo = grados * Math.PI / 180;
  const puntoImagen = (x: number, y: number) => {
    const dx = x - ANCHO_CARTA / 2;
    const dy = y - ALTO_CARTA / 2;
    return {
      x: cx + scale * (dx * Math.cos(angulo) - dy * Math.sin(angulo)),
      y: cy + scale * (dx * Math.sin(angulo) + dy * Math.cos(angulo))
    };
  };
  const poner = (x: number, y: number) => {
    const punto = puntoImagen(x, y);
    const px = Math.round(punto.x);
    const py = Math.round(punto.y);
    if (px >= 0 && py >= 0 && px < width && py < height) gray[py * width + px] = 0;
  };
  const margen = Math.round(10 * MM_A_PUNTOS);
  const brazo = Math.round(5.8 * MM_A_PUNTOS);
  const grosor = 2;
  const dibujarL = (x: number, y: number, dx: number, dy: number) => {
    for (let paso = 0; paso <= brazo; paso += 1) {
      for (let ancho = 0; ancho < grosor; ancho += 1) {
        poner(x + dx * paso + (dy === 0 ? 0 : dx * ancho), y + dy * paso + (dx === 0 ? 0 : dy * ancho));
      }
    }
  };
  dibujarL(margen, margen, 1, 0);
  dibujarL(margen, margen, 0, 1);
  dibujarL(ANCHO_CARTA - margen, margen, -1, 0);
  dibujarL(ANCHO_CARTA - margen, margen, 0, 1);
  dibujarL(margen, ALTO_CARTA - margen, 1, 0);
  dibujarL(margen, ALTO_CARTA - margen, 0, -1);
  dibujarL(ANCHO_CARTA - margen, ALTO_CARTA - margen, -1, 0);
  dibujarL(ANCHO_CARTA - margen, ALTO_CARTA - margen, 0, -1);
  return { gray, width, height, puntoImagen };
}

function crearHojaConFiducialDireccional(giroGrados: number) {
  const width = 1200;
  const height = 1200;
  const scale = 1.45;
  const gray = new Uint8ClampedArray(width * height).fill(255);
  const giro = giroGrados * Math.PI / 180;
  const cx = width / 2;
  const cy = height / 2;
  const a = Math.round(10 * MM_A_PUNTOS);
  const side = 7 * MM_A_PUNTOS;
  const radioHueco = 1.2 * MM_A_PUNTOS;
  const map = (x: number, y: number) => {
    const dx = x - ANCHO_CARTA / 2;
    const dy = y - ALTO_CARTA / 2;
    return {
      x: cx + scale * (dx * Math.cos(giro) - dy * Math.sin(giro)),
      y: cy + scale * (dx * Math.sin(giro) + dy * Math.cos(giro))
    };
  };
  const poner = (x: number, y: number, value: number) => {
    const p = map(x, y);
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    if (px >= 0 && py >= 0 && px < width && py < height) gray[py * width + px] = value;
  };
  const esquinas = [
    { x: a + side / 2, y: a + side / 2, orientacion: true },
    { x: ANCHO_CARTA - a - side / 2, y: a + side / 2, orientacion: false },
    { x: a + side / 2, y: ALTO_CARTA - a - side / 2, orientacion: false },
    { x: ANCHO_CARTA - a - side / 2, y: ALTO_CARTA - a - side / 2, orientacion: false }
  ];
  const sidePx = side * scale;
  for (const esquina of esquinas) {
    for (let dy = -sidePx / 2; dy <= sidePx / 2; dy += 1) {
      for (let dx = -sidePx / 2; dx <= sidePx / 2; dx += 1) {
        const xPt = esquina.x + dx / scale;
        const yPt = esquina.y + dy / scale;
        const agujero = esquina.orientacion && Math.hypot(dx, dy) <= radioHueco * scale;
        poner(xPt, yPt, agujero ? 255 : 0);
      }
    }
  }
  const puntoCaptura = (punto: Punto) => map(punto.x, ALTO_CARTA - punto.y);
  return { gray, width, height, puntoCaptura };
}

function crearCapturaConFranjaNegraExterna() {
  const width = 1323;
  const height = 1871;
  const gray = new Uint8ClampedArray(width * height).fill(255);
  const side = 44;
  const markers = [
    { x: 24, y: 128, directional: true },
    { x: 1256, y: 148, directional: false },
    { x: 76, y: 1700, directional: false },
    { x: 1252, y: 1664, directional: false }
  ];
  for (const marker of markers) {
    for (let y = marker.y - side / 2; y < marker.y + side / 2; y += 1) {
      for (let x = marker.x - side / 2; x < marker.x + side / 2; x += 1) {
        if (marker.directional && Math.hypot(x - marker.x, y - marker.y) <= 8) continue;
        if (x >= 0 && y >= 0 && x < width && y < height) gray[Math.floor(y) * width + Math.floor(x)] = 0;
      }
    }
  }
  // Simula el borde del escáner debajo de la hoja: su región negra uniforme
  // no debe reemplazar el cuadrado inferior derecho como ancla geométrica.
  for (let y = 1736; y < 1767; y += 1) {
    for (let x = 1090; x < width; x += 1) gray[y * width + x] = 0;
  }
  return { gray, width, height };
}

function crearCapturaConQrEsperado(
  textoQr: string,
  giroGrados: number,
  incluirQr = true,
  textoQrImpreso = textoQr,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'H'
) {
  const giro = giroGrados * Math.PI / 180;
  const cos = Math.cos(giro);
  const sin = Math.sin(giro);
  const scale = 3;
  const width = Math.ceil(scale * (Math.abs(ANCHO_CARTA * cos) + Math.abs(ALTO_CARTA * sin)));
  const height = Math.ceil(scale * (Math.abs(ANCHO_CARTA * sin) + Math.abs(ALTO_CARTA * cos)));
  const gray = new Uint8ClampedArray(width * height).fill(255);
  const map = (x: number, y: number) => {
    const dx = x - ANCHO_CARTA / 2;
    const dy = y - ALTO_CARTA / 2;
    return {
      x: width / 2 + scale * (dx * cos - dy * sin),
      y: height / 2 + scale * (dx * sin + dy * cos)
    };
  };
  const pintarRectangulo = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y += 0.35) {
      for (let x = x0; x < x1; x += 0.35) {
        const p = map(x, y);
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        if (px >= 0 && py >= 0 && px < width && py < height) gray[py * width + px] = 0;
      }
    }
  };
  const markMargin = 10 * MM_A_PUNTOS;
  const markSide = 5.8 * MM_A_PUNTOS;
  pintarRectangulo(markMargin, markMargin, markMargin + markSide, markMargin + markSide);
  pintarRectangulo(ANCHO_CARTA - markMargin - markSide, markMargin, ANCHO_CARTA - markMargin, markMargin + markSide);
  pintarRectangulo(markMargin, ALTO_CARTA - markMargin - markSide, markMargin + markSide, ALTO_CARTA - markMargin);
  pintarRectangulo(ANCHO_CARTA - markMargin - markSide, ALTO_CARTA - markMargin - markSide, ANCHO_CARTA - markMargin, ALTO_CARTA - markMargin);
  const qrSymbol = (QRCode as unknown as {
    create: (text: string, options: { errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' }) => { modules: { size: number; data: Uint8Array } };
  }).create(textoQrImpreso, { errorCorrectionLevel }).modules;
  const qrSize = 28 * MM_A_PUNTOS;
  const qrMargin = 4;
  const qrLeft = ANCHO_CARTA - 10 * MM_A_PUNTOS - qrSize;
  const qrTop = 20.5 * MM_A_PUNTOS;
  const modulePitch = qrSize / (qrSymbol.size + 2 * qrMargin);
  if (incluirQr) {
    for (let fila = 0; fila < qrSymbol.size; fila += 1) {
      for (let columna = 0; columna < qrSymbol.size; columna += 1) {
        if (qrSymbol.data[fila * qrSymbol.size + columna] === 0) continue;
        const x0 = qrLeft + (qrMargin + columna) * modulePitch;
        const x1 = qrLeft + (qrMargin + columna + 1) * modulePitch;
        const y0 = qrTop + (qrMargin + fila) * modulePitch;
        const y1 = qrTop + (qrMargin + fila + 1) * modulePitch;
        pintarRectangulo(x0, y0, x1, y1);
      }
    }
  }
  return {
    gray,
    width,
    height,
    qrGeometry: {
      x: qrLeft,
      y: ALTO_CARTA - qrTop - qrSize,
      size: qrSize,
      marginModules: qrMargin,
      matrixModules: qrSymbol.size,
      errorCorrectionLevel,
      textoEsperado: textoQr
    }
  };
}

function rgbaDesdeGray(gray: Uint8ClampedArray) {
  const rgba = new Uint8ClampedArray(gray.length * 4);
  for (let indice = 0, pixel = 0; indice < gray.length; indice += 1, pixel += 4) {
    rgba[pixel] = gray[indice];
    rgba[pixel + 1] = gray[indice];
    rgba[pixel + 2] = gray[indice];
    rgba[pixel + 3] = 255;
  }
  return rgba;
}

function crearQrRgbaExacto(textoQr: string) {
  const qrSymbol = (QRCode as unknown as {
    create: (text: string, options: { errorCorrectionLevel: 'H' }) => { modules: { size: number; data: Uint8Array } };
  }).create(textoQr, { errorCorrectionLevel: 'H' }).modules;
  const marginModules = 4;
  const moduleSize = 8;
  const qrSize = (qrSymbol.size + marginModules * 2) * moduleSize;
  const width = 640;
  const height = 640;
  const left = 100;
  const top = 100;
  const gray = new Uint8ClampedArray(width * height).fill(255);
  for (let fila = 0; fila < qrSymbol.size; fila += 1) {
    for (let columna = 0; columna < qrSymbol.size; columna += 1) {
      if (qrSymbol.data[fila * qrSymbol.size + columna] === 0) continue;
      for (let y = (marginModules + fila) * moduleSize; y < (marginModules + fila + 1) * moduleSize; y += 1) {
        for (let x = (marginModules + columna) * moduleSize; x < (marginModules + columna + 1) * moduleSize; x += 1) {
          gray[(top + y) * width + left + x] = 0;
        }
      }
    }
  }
  return {
    gray,
    width,
    height,
    qrGeometry: {
      x: left,
      y: height - top - qrSize,
      size: qrSize,
      marginModules,
      matrixModules: qrSymbol.size
    }
  };
}

async function crearCapturaQrRotada(giro: 90 | 180 | 270) {
  const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(96)}`;
  const width = ANCHO_CARTA * 3;
  const height = ALTO_CARTA * 3;
  const qrSize = Math.round(28 * MM_A_PUNTOS * 3);
  const qr = await QRCode.toBuffer(textoQr, { errorCorrectionLevel: 'H', width: qrSize, margin: 4 });
  const side = Math.round(5.8 * MM_A_PUNTOS * 3);
  const margin = Math.round(10 * MM_A_PUNTOS * 3);
  const marcas = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${margin}" y="${margin}" width="${side}" height="${side}" fill="black"/><rect x="${width - margin - side}" y="${margin}" width="${side}" height="${side}" fill="black"/><rect x="${margin}" y="${height - margin - side}" width="${side}" height="${side}" fill="black"/><rect x="${width - margin - side}" y="${height - margin - side}" width="${side}" height="${side}" fill="black"/></svg>`);
  const page = await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  }).composite([{
    input: qr,
    left: width - Math.round(10 * MM_A_PUNTOS * 3) - qrSize,
    top: Math.round(20.5 * MM_A_PUNTOS * 3)
  }, { input: marcas }]).png().toBuffer();
  const { data, info } = await sharp(page).rotate(giro).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: gray } = await sharp(page).rotate(giro).greyscale().raw().toBuffer({ resolveWithObject: true });
  return {
    textoQr,
    width: info.width,
    height: info.height,
    rgba: new Uint8ClampedArray(data),
    gray: new Uint8ClampedArray(gray),
    qrSizePts: 28 * MM_A_PUNTOS,
    qrGeometry: {
      x: ANCHO_CARTA - 10 * MM_A_PUNTOS - 28 * MM_A_PUNTOS,
      y: ALTO_CARTA - 20.5 * MM_A_PUNTOS - 28 * MM_A_PUNTOS,
      size: 28 * MM_A_PUNTOS
    }
  };
}

describe('referencia global de página OMR', () => {
  it('decodifica QR en escala de grises con el lector alterno ZXing', () => {
    const esperado = 'EXAMEN:ZXING-ALTERNATE:P2:TV4:TEST';
    const captura = crearQrRgbaExacto(esperado);

    const qr = detectarQrDetalleZxing(captura.gray, captura.width, captura.height);

    expect(qr?.data).toBe(esperado);
    expect(qr?.fuenteDeteccionQr).toBe('zxing');
    expect(qr?.location.topLeftCorner.x).toBeGreaterThan(0);
  });

  it('solo valida identidad cuando coincide el payload QR completo', () => {
    const esperado = 'EXAMEN:FOLIO1:P1:TV4:SG:H123';

    expect(coincidePayloadQrExacto(esperado, [esperado])).toBe(true);
    expect(coincidePayloadQrExacto(`${esperado}|extra`, [esperado])).toBe(false);
    expect(coincidePayloadQrExacto(`FOLIO:${esperado}`, [esperado])).toBe(false);
    expect(coincidePayloadQrExacto(` ${esperado}`, [esperado])).toBe(false);
  });

  it('distingue giro cardinal e inclinacion residual de una referencia', () => {
    const rad = (grados: number) => grados * Math.PI / 180;
    const origen = { x: 100, y: 200 };
    const extremo = (grados: number) => ({
      x: origen.x + 500 * Math.cos(rad(grados)),
      y: origen.y + 500 * Math.sin(rad(grados))
    });

    expect(medirOrientacionReferenciaOmr(origen, extremo(0))).toEqual({ orientacionGrados: 0, inclinacionGrados: 0 });
    expect(medirOrientacionReferenciaOmr(origen, extremo(4.5))).toEqual({ orientacionGrados: 0, inclinacionGrados: 4.5 });
    expect(medirOrientacionReferenciaOmr(origen, extremo(94))).toEqual({ orientacionGrados: 90, inclinacionGrados: 4 });
    expect(medirOrientacionReferenciaOmr(origen, extremo(182))).toEqual({ orientacionGrados: 180, inclinacionGrados: 2 });
    expect(medirOrientacionReferenciaOmr(origen, extremo(267))).toEqual({ orientacionGrados: 270, inclinacionGrados: -3 });
  });

  it('estima el vértice de las cuatro marcas L canónicas', () => {
    const gray = crearHojaConMarcasL();
    const resultado = obtenerTransformacion(gray, ANCHO_CARTA, ALTO_CARTA, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'lineas', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.tipo).toBe('marcas_esquina');
    expect(resultado.referenciaPagina.puntosDetectados).toBe(4);
    expect(resultado.referenciaPagina.calidad).toBeGreaterThanOrEqual(0.72);
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(false);
    expect(resultado.referenciaPagina.orientacionGrados).toBeUndefined();
    expect(resultado.referenciaPagina.inclinacionGrados).toBeUndefined();
  });

  it('localiza los cuadrados sólidos de la plantilla canónica', () => {
    const gray = crearHojaConCuadrados();
    const resultado = obtenerTransformacion(gray, ANCHO_CARTA, ALTO_CARTA, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.tipo).toBe('marcas_esquina');
    expect(resultado.referenciaPagina.puntosDetectados).toBe(4);
    expect(resultado.referenciaPagina.calidad).toBeGreaterThanOrEqual(0.72);
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(false);
    const puntoCentral = resultado.transformar({ x: 300, y: 400 });
    expect(puntoCentral.x).toBeCloseTo(300, 0);
    expect(puntoCentral.y).toBeCloseTo(ALTO_CARTA - 400, 0);
  });

  it('no usa el borde negro del escáner como fiducial inferior', () => {
    const captura = crearCapturaConFranjaNegraExterna();
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: {
        tipo: 'cuadrados',
        size: 19.84,
        quietZone: 2.27,
        orientacion: { esquina: 'tl', tipo: 'centro_vacio', radio: 3.4 }
      }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.puntosDetectados).toBe(4);
    const burbujaInferior = resultado.transformar({ x: 563.8, y: 147.2 });
    expect(Math.abs(burbujaInferior.x - 1220)).toBeLessThan(15);
    expect(Math.abs(burbujaInferior.y - 1435)).toBeLessThan(15);
  });

  it('acepta la orientación del QR cuando el fiducial direccional está oculto', () => {
    const gray = crearHojaConCuadrados();
    const qr = {
      data: 'EXAMEN:QR-ORIENTATION-RECOVERY:P3:TV4',
      location: {
        topLeftCorner: { x: 500, y: 40 },
        topRightCorner: { x: 570, y: 40 },
        bottomLeftCorner: { x: 500, y: 110 },
        bottomRightCorner: { x: 570, y: 110 }
      },
      calidadGeometrica: 0.95
    };

    const resultado = obtenerTransformacion(gray, ANCHO_CARTA, ALTO_CARTA, [], qr, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: {
        tipo: 'cuadrados',
        size: 5.8 * MM_A_PUNTOS,
        orientacion: { esquina: 'tl', tipo: 'centro_vacio', radio: 1.2 * MM_A_PUNTOS }
      }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('qr');
    expect(resultado.referenciaPagina.orientacionGrados).toBe(0);
    expect(resultado.referenciaPagina.conflictoOrientacion).toBe(false);
  });

  it('usa el QR como referencia global si el pliegue oculta un fiducial de esquina', () => {
    const captura = crearHojaInclinada(0);
    const margen = Math.round(10 * MM_A_PUNTOS);
    const fidSize = Math.round(5.8 * MM_A_PUNTOS);
    const centroFidTr = captura.puntoImagen(ANCHO_CARTA - margen - fidSize / 2, margen + fidSize / 2);
    for (let y = Math.floor(centroFidTr.y - 15); y <= centroFidTr.y + 15; y += 1) {
      for (let x = Math.floor(centroFidTr.x - 15); x <= centroFidTr.x + 15; x += 1) {
        if (x >= 0 && y >= 0 && x < captura.width && y < captura.height) captura.gray[y * captura.width + x] = 255;
      }
    }
    const qrX = ANCHO_CARTA - margen - 72;
    const qrY = margen;
    const qr = {
      data: 'synthetic-folded-page',
      location: {
        topLeftCorner: captura.puntoImagen(qrX, qrY),
        topRightCorner: captura.puntoImagen(qrX + 72, qrY),
        bottomLeftCorner: captura.puntoImagen(qrX, qrY + 72),
        bottomRightCorner: captura.puntoImagen(qrX + 72, qrY + 72)
      },
      calidadGeometrica: 0.95
    };
    const advertencias: string[] = [];
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, advertencias, qr, {
      margenMm: 10,
      qrSizePts: 72,
      qrGeometry: { x: qrX, y: qrY, size: 72 },
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'lineas', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.tipo).toBe('qr');
    expect(resultado.referenciaPagina.puntosDetectados).toBe(4);
    expect(advertencias.some((item) => /fiduciales de página parciales \(3\/4\).*geometría QR/i.test(item))).toBe(true);
    const esperado = captura.puntoImagen(300, ALTO_CARTA - 400);
    const detectado = resultado.transformar({ x: 300, y: 400 });
    expect(Math.abs(detectado.x - esperado.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(detectado.y - esperado.y)).toBeLessThanOrEqual(3);
  });

  it.each([
    { giro: 0, orientacion: 0, inclinacion: 0 },
    { giro: 97, orientacion: 90, inclinacion: 7 },
    { giro: 183, orientacion: 180, inclinacion: 3 },
    { giro: 267, orientacion: 270, inclinacion: -3 }
  ])('detecta giro $orientacion° e inclinacion en una captura de $giro°', ({ giro, orientacion, inclinacion }) => {
    const gradosCaptura = giro;
    const captura = crearHojaInclinada(gradosCaptura);
    const qrTopLeft = captura.puntoImagen(ANCHO_CARTA - Math.round(10 * MM_A_PUNTOS) - 72, Math.round(10 * MM_A_PUNTOS));
    const qrTopRight = captura.puntoImagen(ANCHO_CARTA - Math.round(10 * MM_A_PUNTOS), Math.round(10 * MM_A_PUNTOS));
    const qrBottomLeft = captura.puntoImagen(ANCHO_CARTA - Math.round(10 * MM_A_PUNTOS) - 72, Math.round(10 * MM_A_PUNTOS) + 72);
    const qrBottomRight = captura.puntoImagen(ANCHO_CARTA - Math.round(10 * MM_A_PUNTOS), Math.round(10 * MM_A_PUNTOS) + 72);
    const qr = {
      data: 'synthetic-qr',
      location: {
        topLeftCorner: qrTopLeft,
        topRightCorner: qrTopRight,
        bottomLeftCorner: qrBottomLeft,
        bottomRightCorner: qrBottomRight
      },
      calidadGeometrica: 0.95
    };
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], qr, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'lineas', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.tipo).toBe('homografia');
    expect(resultado.referenciaPagina.orientacionGrados).toBe(orientacion);
    expect(resultado.referenciaPagina.inclinacionGrados).toBeCloseTo(inclinacion, 0);
    const esperado = captura.puntoImagen(300, ALTO_CARTA - 400);
    const detectado = resultado.transformar({ x: 300, y: 400 });
    expect(Math.abs(detectado.x - esperado.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(detectado.y - esperado.y)).toBeLessThanOrEqual(3);
  });

  it('reconstruye para orientación el QR con el nivel de corrección persistido en el mapa', () => {
    const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(140)}`;
    const captura = crearCapturaConQrEsperado(textoQr, 0, true, textoQr, 'Q');
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: captura.qrGeometry.size,
      qrGeometry: captura.qrGeometry,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(captura.qrGeometry.matrixModules).not.toBe(QRCode.create(textoQr, { errorCorrectionLevel: 'H' }).modules.size);
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('qr_patron_esperado');
    expect(resultado.referenciaPagina.orientacionGrados).toBe(0);
  });

  it.each([
    { giro: 0, orientacion: 0, inclinacion: 0 },
    { giro: 90, orientacion: 90, inclinacion: 0 },
    { giro: 180, orientacion: 180, inclinacion: 0 },
    { giro: 270, orientacion: 270, inclinacion: 0 },
    { giro: 97, orientacion: 90, inclinacion: 7 }
  ])('resuelve orientacion $orientacion° e inclinacion $inclinacion° desde fiducial sin QR ($giro°)', ({ giro, orientacion, inclinacion }) => {
    const captura = crearHojaConFiducialDireccional(giro);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: {
        tipo: 'cuadrados',
        size: 7 * MM_A_PUNTOS,
        orientacion: { esquina: 'tl', tipo: 'centro_vacio', radio: 1.2 * MM_A_PUNTOS }
      }
    });
    expect(resultado.referenciaPagina.orientacionGrados).toBe(orientacion);
    expect(resultado.referenciaPagina.inclinacionGrados).toBeCloseTo(inclinacion, 0);
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
    const punto = { x: 300, y: 400 };
    const esperado = captura.puntoCaptura(punto);
    const detectado = resultado.transformar(punto);
    expect(Math.abs(detectado.x - esperado.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(detectado.y - esperado.y)).toBeLessThanOrEqual(3);
  });

  it('marca conflicto y niega orientacion cuando QR y fiducial se contradicen', () => {
    const captura = crearHojaConFiducialDireccional(90);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], {
      data: 'qr-orientacion-0',
      location: {
        topLeftCorner: { x: 100, y: 100 },
        topRightCorner: { x: 220, y: 100 },
        bottomRightCorner: { x: 220, y: 220 },
        bottomLeftCorner: { x: 100, y: 220 }
      },
      calidadGeometrica: 0.95
    }, {
      margenMm: 10,
      qrSizePts: 72,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: {
        tipo: 'cuadrados',
        size: 7 * MM_A_PUNTOS,
        orientacion: { esquina: 'tl', tipo: 'centro_vacio', radio: 1.2 * MM_A_PUNTOS }
      }
    });

    expect(resultado.referenciaPagina.conflictoOrientacion).toBe(true);
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(false);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('indeterminada');
  });

  it.each([
    { giro: 0, orientacion: 0 },
    { giro: 180, orientacion: 180 },
  ])('usa el patrón QR esperado para orientar una página sin fiducial direccional ($giro°)', ({ giro, orientacion }) => {
    const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(140)}`;
    const captura = crearCapturaConQrEsperado(textoQr, giro);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: captura.qrGeometry.size,
      qrGeometry: captura.qrGeometry,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('qr_patron_esperado');
    expect(resultado.referenciaPagina.orientacionGrados).toBe(orientacion);
    expect(resultado.referenciaPagina.confianzaOrientacion).toBeGreaterThan(0.2);
    expect(resultado.referenciaPagina.margenOrientacion).toBeGreaterThan(0.08);
  });

  it.each([0, 90, 180, 270] as const)(
    'usa la orientación fuente del QR recuperado a %i° sin usarlo para rectificar la página',
    (orientacion) => {
      const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(140)}`;
      const captura = crearCapturaConQrEsperado(textoQr, orientacion, false);
      const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
        margenMm: 10,
        qrSizePts: captura.qrGeometry.size,
        qrGeometry: captura.qrGeometry,
        qrOrientacionFuenteGrados: orientacion,
        anchoCarta: ANCHO_CARTA,
        altoCarta: ALTO_CARTA,
        mmAPuntos: MM_A_PUNTOS,
        marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
      });

      expect(resultado.tipo).toBe('homografia');
      expect(resultado.referenciaPagina.tipo).toBe('marcas_esquina');
      expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
      expect(resultado.referenciaPagina.fuenteOrientacion).toBe('qr');
      expect(resultado.referenciaPagina.orientacionGrados).toBe(orientacion);
    }
  );

  it('rechaza el rescate de orientación si contradice el fiducial direccional', () => {
    const captura = crearHojaConFiducialDireccional(90);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: 72,
      qrOrientacionFuenteGrados: 0,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: {
        tipo: 'cuadrados',
        size: 7 * MM_A_PUNTOS,
        orientacion: { esquina: 'tl', tipo: 'centro_vacio', radio: 1.2 * MM_A_PUNTOS }
      }
    });

    expect(resultado.referenciaPagina.conflictoOrientacion).toBe(true);
    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(false);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('indeterminada');
  });

  it.each([90, 180, 270] as const)(
    'extrae la orientación fuente de un QR exacto recuperado al girar %i°',
    async (orientacion) => {
      const captura = await crearCapturaQrRotada(orientacion);
      const qr = await detectarQrConRotacionPagina(
        captura.rgba,
        captura.width,
        captura.height,
        captura.qrSizePts,
        [captura.textoQr]
      );

      expect(qr?.data).toBe(captura.textoQr);
      expect(qr?.orientacionFuenteGrados).toBe(orientacion);
      const transformacion = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
        margenMm: 10,
        qrSizePts: captura.qrSizePts,
        qrOrientacionFuenteGrados: qr?.orientacionFuenteGrados,
        anchoCarta: ANCHO_CARTA,
        altoCarta: ALTO_CARTA,
        mmAPuntos: MM_A_PUNTOS,
        marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
      });

      expect(transformacion.tipo).toBe('homografia');
      expect(transformacion.referenciaPagina.tipo).toBe('marcas_esquina');
      expect(transformacion.referenciaPagina.orientacionDeterminada).toBe(true);
      expect(transformacion.referenciaPagina.orientacionGrados).toBe(orientacion);
    }
  );

  it.each([90, 270])('recupera orientación por patrón QR si la homografía necesita ajuste local ($giro°)', (giro) => {
    const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(140)}`;
    const captura = crearCapturaConQrEsperado(textoQr, giro);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: captura.qrGeometry.size,
      qrGeometry: captura.qrGeometry,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('qr_patron_esperado');
    expect(resultado.referenciaPagina.orientacionGrados).toBe(giro);
    expect(resultado.referenciaPagina.confianzaOrientacion).toBeGreaterThan(0.2);
    expect(resultado.referenciaPagina.margenOrientacion).toBeGreaterThan(0.08);
  });

  it('no infiere orientación QR cuando solo hay fiduciales y la reserva está vacía', () => {
    const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(140)}`;
    const captura = crearCapturaConQrEsperado(textoQr, 0, false);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: captura.qrGeometry.size,
      qrGeometry: captura.qrGeometry,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(false);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('indeterminada');
    expect(resultado.referenciaPagina.confianzaOrientacion).toBeLessThan(0.2);
    expect(resultado.referenciaPagina.margenOrientacion).toBeLessThan(0.08);
  });

  it('usa el patrón de un QR solo como referencia geométrica, aunque varíe el payload', () => {
    const textoQr = `EXAMEN:TEST-PAGE:P1:TV4:${'A'.repeat(140)}`;
    const textoQrImpreso = `EXAMEN:FAKE-PAGE:P1:TV4:${'A'.repeat(140)}`;
    const captura = crearCapturaConQrEsperado(textoQr, 0, true, textoQrImpreso);
    const resultado = obtenerTransformacion(captura.gray, captura.width, captura.height, [], null, {
      margenMm: 10,
      qrSizePts: captura.qrGeometry.size,
      qrGeometry: captura.qrGeometry,
      anchoCarta: ANCHO_CARTA,
      altoCarta: ALTO_CARTA,
      mmAPuntos: MM_A_PUNTOS,
      marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS }
    });

    expect(resultado.referenciaPagina.orientacionDeterminada).toBe(true);
    expect(resultado.referenciaPagina.fuenteOrientacion).toBe('qr_patron_esperado');
    expect(resultado.referenciaPagina.orientacionGrados).toBe(0);
  });

  it.each([256, 384, 512, 640, 768])(
    'rectifica y decodifica un QR conocido con fiduciales a %i px aunque no haya detección global',
    (outputSize) => {
      const textoQr = 'EXAMEN:TEST-RECTIFIED:P1:TV4:OK';
      const captura = crearQrRgbaExacto(textoQr);
      const qr = detectarQrPorGeometriaConocida(
        rgbaDesdeGray(captura.gray),
        captura.width,
        captura.height,
        captura.qrGeometry,
        (punto) => ({ x: punto.x, y: captura.height - punto.y }),
        { altoCarta: captura.height, outputSize, payloadsEsperados: [textoQr] }
      );

      expect(qr?.data).toBe(textoQr);
      expect(qr?.calidadGeometrica).toBeGreaterThan(0.7);
    }
  );

  it('no acepta un QR legible en la geometría conocida si no coincide con el payload esperado', () => {
    const captura = crearQrRgbaExacto('EXAMEN:OTRO-FOLIO:P1:TV4:OK');
    const qr = detectarQrPorGeometriaConocida(
      rgbaDesdeGray(captura.gray),
      captura.width,
      captura.height,
      captura.qrGeometry,
      (punto) => ({ x: punto.x, y: captura.height - punto.y }),
      { altoCarta: captura.height, outputSize: 384, payloadsEsperados: ['EXAMEN:FOLIO-ESPERADO:P1:TV4:OK'] }
    );

    expect(qr).toBeNull();
  });

  it('recupera un QR parcialmente cubierto solo si una matriz esperada gana con margen claro', () => {
    const esperado = 'EXAMEN:TEST-RECTIFIED:P1:TV4:OK';
    const alternativo = 'EXAMEN:TEST-RECTIFIED:P1:TV4:NO';
    const captura = crearQrRgbaExacto(esperado);
    const moduleSize = 8;
    const matrixTop = 100 + 4 * moduleSize;
    const matrixLeft = 100 + 4 * moduleSize;

    // Simula un sello opaco que tapa diez módulos completos de información.
    for (let y = matrixTop + 11 * moduleSize; y < matrixTop + 21 * moduleSize; y += 1) {
      for (let x = matrixLeft; x < matrixLeft + captura.qrGeometry.matrixModules! * moduleSize; x += 1) {
        captura.gray[y * captura.width + x] = 255;
      }
    }

    const qr = detectarQrPorGeometriaConocida(
      rgbaDesdeGray(captura.gray),
      captura.width,
      captura.height,
      { ...captura.qrGeometry, errorCorrectionLevel: 'H' },
      (punto) => ({ x: punto.x, y: captura.height - punto.y }),
      { altoCarta: captura.height, outputSize: 512, payloadsEsperados: [esperado, alternativo] }
    );

    expect(qr?.data).toBe(esperado);
    expect(qr?.fuenteDeteccionQr).toBe('known_geometry_rescue');
    expect(qr?.calidadCoincidenciaMatriz).toBeGreaterThanOrEqual(0.82);
    expect(qr?.margenCoincidenciaMatriz).toBeGreaterThanOrEqual(0.12);
  });

  it('recupera QR geométrico desde la captura fuente cuando el pipeline normaliza la imagen', async () => {
    const esperado = 'EXAMEN:TEST-SOURCE-RECOVERY:P1:TV4:OK';
    const captura = crearCapturaConQrEsperado(esperado, 0);
    const qr = captura.qrGeometry;
    const qrSymbol = QRCode.create(esperado, { errorCorrectionLevel: 'H' }).modules;
    const scale = 3;
    const modulePitch = qr.size / (qrSymbol.size + qr.marginModules! * 2) * scale;
    const matrixLeft = Math.round((qr.x + qr.marginModules! * qr.size / (qrSymbol.size + qr.marginModules! * 2)) * scale);
    const matrixTop = Math.round((ALTO_CARTA - qr.y - qr.size + qr.marginModules! * qr.size / (qrSymbol.size + qr.marginModules! * 2)) * scale);

    // Cubrir un patrón localizador con una etiqueta obliga al lector a usar la
    // geometría y el payload esperado, sin dañar significativamente la matriz.
    for (let y = matrixTop; y < matrixTop + Math.ceil(modulePitch * 9); y += 1) {
      for (let x = matrixLeft; x < matrixLeft + Math.ceil(modulePitch * 9); x += 1) {
        captura.gray[y * captura.width + x] = 255;
      }
    }
    const rgba = rgbaDesdeGray(captura.gray);
    const image = await sharp(Buffer.from(rgba), {
      raw: { width: captura.width, height: captura.height, channels: 4 }
    }).png().toBuffer();
    const result = await analizarOmr(
      `data:image/png;base64,${image.toString('base64')}`,
      {
        numeroPagina: 1,
        templateVersion: 4,
        qr,
        marcasPagina: { tipo: 'cuadrados', size: 5.8 * MM_A_PUNTOS },
        preguntas: []
      },
      [esperado],
      10
    );

    expect(result.qrTexto).toBe(esperado);
  // Bajo carga compartida y cobertura V8, Sharp + ZXing puede tardar más de
  // un minuto. El runner aísla esta suite; este límite conserva margen sin
  // convertir una demora de instrumentación en un falso fallo.
  }, 120_000);

  it('prioriza un recorte focalizado del QR en la cabecera de una página completa', () => {
    const textoQr = 'EXAMEN:QR-FOCAL-P1:TV4:K:ABCDE';
    const simbolo = (QRCode as unknown as {
      create: (text: string, options: { errorCorrectionLevel: 'H' }) => { modules: { size: number; data: Uint8Array } };
    }).create(textoQr, { errorCorrectionLevel: 'H' }).modules;
    const escala = 3;
    const width = ANCHO_CARTA * escala;
    const height = ALTO_CARTA * escala;
    const gray = new Uint8ClampedArray(width * height).fill(255);
    const qrSize = 28 * MM_A_PUNTOS;
    const qrLeft = ANCHO_CARTA - 10 * MM_A_PUNTOS - qrSize;
    const qrTop = 20.5 * MM_A_PUNTOS;
    const marginModules = 4;
    const modulePitch = (qrSize * escala) / (simbolo.size + marginModules * 2);
    for (let fila = 0; fila < simbolo.size; fila += 1) {
      for (let columna = 0; columna < simbolo.size; columna += 1) {
        if (simbolo.data[fila * simbolo.size + columna] !== 1) continue;
        const x0 = Math.round((qrLeft * escala) + (marginModules + columna) * modulePitch);
        const x1 = Math.round((qrLeft * escala) + (marginModules + columna + 1) * modulePitch);
        const y0 = Math.round((qrTop * escala) + (marginModules + fila) * modulePitch);
        const y1 = Math.round((qrTop * escala) + (marginModules + fila + 1) * modulePitch);
        for (let y = y0; y < y1; y += 1) gray.fill(0, y * width + x0, y * width + x1);
      }
    }

    const qr = detectarQrMejorado(rgbaDesdeGray(gray), gray, width, height, {
      qrSizePts: qrSize,
      anchoCarta: ANCHO_CARTA
    });
    expect(qr?.data).toBe(textoQr);
  });

  it('decodifica una ROI QR nativa con fondo claro tintado y verifica su geometría de página', () => {
    const textoQr = `EXAMEN:C5051CA1:P2:TV4:ID:${'A'.repeat(120)}`;
    const modules = (QRCode as unknown as {
      create: (text: string, options: { errorCorrectionLevel: 'Q' }) => { modules: { size: number; data: Uint8Array } };
    }).create(textoQr, { errorCorrectionLevel: 'Q' }).modules;
    const quietZone = 4;
    const modulePx = 6;
    const lado = (modules.size + quietZone * 2) * modulePx;
    const rgba = new Uint8ClampedArray(lado * lado * 4);
    const grayCrop = new Uint8ClampedArray(lado * lado).fill(245);
    for (let indice = 0, pixel = 0; indice < grayCrop.length; indice += 1, pixel += 4) {
      rgba[pixel] = rgba[pixel + 1] = rgba[pixel + 2] = grayCrop[indice]!;
      rgba[pixel + 3] = 255;
    }
    for (let fila = 0; fila < modules.size; fila += 1) {
      for (let columna = 0; columna < modules.size; columna += 1) {
        if (modules.data[fila * modules.size + columna] !== 1) continue;
        const x0 = (columna + quietZone) * modulePx;
        const y0 = (fila + quietZone) * modulePx;
        for (let y = y0; y < y0 + modulePx; y += 1) {
          for (let x = x0; x < x0 + modulePx; x += 1) {
            const pixel = y * lado + x;
            grayCrop[pixel] = 0;
            const rgbaPixel = pixel * 4;
            rgba[rgbaPixel] = rgba[rgbaPixel + 1] = rgba[rgbaPixel + 2] = 0;
          }
        }
      }
    }
    const page = { width: 2728, height: 3608 };
    const origen = { x: Math.round(page.width * 0.875 - lado / 2), y: Math.round(page.height * 0.1 - lado / 2) };

    const qr = detectarQrEnRecorteNativo(
      rgba,
      grayCrop,
      lado,
      lado,
      origen,
      { ...page, qrSizePts: 28 * MM_A_PUNTOS, anchoCarta: ANCHO_CARTA }
    );
    expect(qr?.data).toBe(textoQr);
    expect(qr?.calidadGeometrica).toBeGreaterThan(0.7);
  });
});
