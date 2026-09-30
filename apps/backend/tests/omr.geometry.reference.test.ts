/**
 * omr.geometry.reference
 *
 * Verifica que las marcas de página canónicas (L) se conviertan en vértices
 * físicos y que la geometría canónica conserve una referencia estable.
 */
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
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
