import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { calcularRegionQrFocalizada, coincidePayloadQrExacto, detectarQrEnRecorteNativo, detectarQrEnRecorteRealzado, detectarQrZxingPaginaFuente } from '../src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCv.js';
import { cajaQrDesdeManifiesto, combinarMapasQrEsperados, crearMapaQrEsperado, crearMapaQrManifiesto, detectarQrRgba, identidadDesdeTextoPdf, resumirReferenciaQr } from '../scripts/omr-qr-preprint-check.js';

const qrP1 = 'EXAMEN:E2FAFF07:P1:TV4:ID:ABCDEF12';
const qrP2 = 'EXAMEN:E2FAFF07:P2:TV4:ID:ABCDEF12';

describe('auditoria QR de referencia preimpresion', () => {
  it('construye el mapa esperado por folio y pagina, deduplicando capturas repetidas', () => {
    const mapa = crearMapaQrEsperado([
      { file: 'captura-a.jpg', qrTextoEsperado: qrP1 },
      { file: 'captura-b.jpg', qrTextoEsperado: qrP1 },
      { file: 'captura-c.jpg', qrTextoEsperado: qrP2 }
    ]);

    expect(mapa.size).toBe(2);
    expect(mapa.get('E2FAFF07:1')).toBe(qrP1);
    expect(mapa.get('E2FAFF07:2')).toBe(qrP2);
  });

  it('rechaza dos payloads distintos declarados para la misma pagina', () => {
    expect(() => crearMapaQrEsperado([
      { qrTextoEsperado: qrP1 },
      { qrTextoEsperado: `${qrP1}:OTRO` }
    ])).toThrow('payloads distintos para E2FAFF07:1');
  });

  it('rechaza que el benchmark y el manifiesto declaren identidades QR distintas', () => {
    expect(() => combinarMapasQrEsperados(
      new Map([['E2FAFF07:1', qrP1]]),
      new Map([['E2FAFF07:1', `${qrP1}:OTRO`]])
    )).toThrow('Benchmark y manifiesto discrepan para E2FAFF07:1');
  });

  it('lee payloads directamente del manifiesto de generación aunque el folio no tenga ocho caracteres', () => {
    const qr = 'EXAMEN:VISUAL-TV4-003:P1:TV4:KI:QR-H1-V1';
    const mapa = crearMapaQrManifiesto({ paginas: [{ numero: 1, qrTexto: qr }] });

    expect(mapa.get('VISUAL-TV4-003:1')).toBe(qr);
    expect(identidadDesdeTextoPdf('VISUAL-TV4-003 · P1')).toEqual({ folio: 'VISUAL-TV4-003', pagina: 1 });
  });

  it('usa la caja QR persistida del mapa OMR al comprobar plantillas nuevas', () => {
    const caja = cajaQrDesdeManifiesto({
      mapaOmr: { paginas: [{ numeroPagina: 1, qr: { x: 491.78, y: 649.67, size: 79.37 } }] }
    }, 1, 792);
    expect(caja?.x).toBeCloseTo(491.78);
    expect(caja?.yTop).toBeCloseTo(62.96);
    expect(caja?.size).toBeCloseTo(79.37);
  });

  it('identifica el folio y la pagina del pie del PDF y rechaza pies ambiguos', () => {
    expect(identidadDesdeTextoPdf('E2FAFF07 · Pagina 1\nCentro Universitario'))
      .toEqual({ folio: 'E2FAFF07', pagina: 1 });
    expect(identidadDesdeTextoPdf('E2FAFF07 · Pagina 1\nE2FAFF07 · Pagina 2'))
      .toBeNull();
  });

  it('decodifica la matriz del QR renderizada con quiet zone', () => {
    const texto = 'EXAMEN:E2FAFF07:P1:TV4:ID:ABCDEF12';
    const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'H' });
    const quietZone = 4;
    const moduloPx = 6;
    const lado = (modules.size + quietZone * 2) * moduloPx;
    const rgba = new Uint8Array(lado * lado * 4);
    rgba.fill(255);
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const fila = Math.floor(y / moduloPx) - quietZone;
        const columna = Math.floor(x / moduloPx) - quietZone;
        if (fila < 0 || columna < 0 || fila >= modules.size || columna >= modules.size) continue;
        if (!modules.data[fila * modules.size + columna]) continue;
        const indice = (y * lado + x) * 4;
        rgba[indice] = 0;
        rgba[indice + 1] = 0;
        rgba[indice + 2] = 0;
      }
    }

    expect(detectarQrRgba(rgba, lado, lado)).toBe(texto);
  });

  it('rescata QR rasterizados sobre el fondo claro tintado del PDF sin umbral global', () => {
    const texto = 'EXAMEN:E2FAFF07:P1:TV4:ID:ABCDEF12';
    const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'H' });
    const quietZone = 4;
    const moduloPx = 6;
    const lado = (modules.size + quietZone * 2) * moduloPx;
    const rgba = new Uint8Array(lado * lado * 4);
    for (let indice = 0; indice < rgba.length; indice += 4) {
      rgba[indice] = rgba[indice + 1] = rgba[indice + 2] = 235;
      rgba[indice + 3] = 255;
    }
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const fila = Math.floor(y / moduloPx) - quietZone;
        const columna = Math.floor(x / moduloPx) - quietZone;
        if (fila < 0 || columna < 0 || fila >= modules.size || columna >= modules.size) continue;
        if (!modules.data[fila * modules.size + columna]) continue;
        const indice = (y * lado + x) * 4;
        rgba[indice] = rgba[indice + 1] = rgba[indice + 2] = 0;
      }
    }

    expect(detectarQrRgba(rgba, lado, lado)).toBe(texto);
  });

  it('ubica y decodifica el QR de alta densidad en la ventana superior ajustada a foto móvil', () => {
    const texto = 'EXAMEN:5AFC1D79:P1:TV4:ID:FC2E25C9-103B-4B78-A67F-B502699E:KI:QR-H1-V1:TQ:25:VH:46039969129A:AK:4CF20B8622BA:K:BCEABACBCAA:SG:H19B30438E9183939DF4860638';
    const qr = QRCode.create(texto, { errorCorrectionLevel: 'H' });
    const pageWidth = 1600;
    const pageHeight = 2154;
    const qrSizePts = 79.37;
    const roi = calcularRegionQrFocalizada(pageWidth, pageHeight, qrSizePts, 612);
    expect(roi).toEqual({ left: 1236, top: 48, width: 364, height: 364 });

    const rgba = new Uint8ClampedArray(roi.width * roi.height * 4);
    const gray = new Uint8ClampedArray(roi.width * roi.height);
    const qrLeft = Math.round((497.45 * pageWidth) / 612) - roi.left;
    const qrTop = Math.round((57.3 * pageHeight) / 792) - roi.top;
    const qrBoxSize = Math.round((qrSizePts * pageWidth) / 612);
    const moduleSize = qrBoxSize / (qr.modules.size + 8);
    for (let y = 0; y < roi.height; y += 1) {
      for (let x = 0; x < roi.width; x += 1) {
        const paperNoise = ((x * 17 + y * 31 + x * y * 7) % 19) - 9;
        const moduleX = Math.floor((x - qrLeft) / moduleSize) - 4;
        const moduleY = Math.floor((y - qrTop) / moduleSize) - 4;
        const dentroMatriz = moduleX >= 0 && moduleY >= 0 && moduleX < qr.modules.size && moduleY < qr.modules.size;
        const tinta = dentroMatriz && qr.modules.data[moduleY * qr.modules.size + moduleX];
        const nivel = tinta ? 35 + Math.abs(paperNoise) : 232 + paperNoise;
        const indice = y * roi.width + x;
        const pixel = indice * 4;
        gray[indice] = nivel;
        rgba[pixel] = Math.min(255, nivel + 4);
        rgba[pixel + 1] = nivel;
        rgba[pixel + 2] = Math.max(0, nivel - 3);
        rgba[pixel + 3] = 255;
      }
    }

    const detectado = detectarQrEnRecorteNativo(
      rgba,
      gray,
      roi.width,
      roi.height,
      { x: roi.left, y: roi.top },
      { width: pageWidth, height: pageHeight, qrSizePts, anchoCarta: 612 }
    );
    expect(detectado?.data).toBe(texto);
  });

  it('recupera QR esperado con ZXing a resolución fuente y conserva la comprobación exacta de identidad', () => {
    const texto = 'EXAMEN:5AFC1D79:P1:TV4:ID:ABCDEF12';
    const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'H' });
    const width = 1600;
    const height = 2154;
    const moduloPx = 5;
    const quietZone = 4;
    const lado = (modules.size + quietZone * 2) * moduloPx;
    const left = Math.round(width * 0.8125);
    const top = Math.round(height * 0.022);
    const gray = new Uint8ClampedArray(width * height);
    gray.fill(242);

    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const fila = Math.floor(y / moduloPx) - quietZone;
        const columna = Math.floor(x / moduloPx) - quietZone;
        if (
          fila >= 0 && columna >= 0 && fila < modules.size && columna < modules.size &&
          modules.data[fila * modules.size + columna]
        ) {
          gray[(top + y) * width + left + x] = 24;
        }
      }
    }

    const detectado = detectarQrZxingPaginaFuente(gray, width, height, 79.37, 612, {
      matrixModules: modules.size,
      payloadsEsperados: [texto]
    });

    expect(detectado?.data).toBe(texto);
    expect(detectado?.fuenteDeteccionQr).toBe('resolucion_fuente');
    expect(detectado?.calidadGeometrica).toBeGreaterThan(0.7);
    expect(coincidePayloadQrExacto(detectado?.data, [texto])).toBe(true);
    expect(coincidePayloadQrExacto(detectado?.data, ['EXAMEN:OTRO:P1:TV4'])).toBe(false);
  });

  it('recupera un QR denso en una ROI móvil con umbral alto y devuelve coordenadas del recorte original', () => {
    const texto = 'EXAMEN:5AFC1D79:P1:TV4:ID:FC2E25C9-103B-4B78-A67F-B502699E:KI:QR-H1-V1:TQ:25:VH:46039969129A:AK:4CF20B8622BA:K:BCEABACBCAA:SG:H19B30438E9183939DF4860638';
    const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'H' });
    const quietZone = 4;
    const moduleSize = 2;
    const side = (modules.size + quietZone * 2) * moduleSize;
    const width = side + 96;
    const height = side + 80;
    const left = 31;
    const top = 29;
    const original = new Uint8ClampedArray(width * height);
    original.fill(235);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const fila = Math.floor((y - top) / moduleSize) - quietZone;
        const columna = Math.floor((x - left) / moduleSize) - quietZone;
        const dentro = fila >= 0 && columna >= 0 && fila < modules.size && columna < modules.size;
        const tinta = dentro && modules.data[fila * modules.size + columna];
        const ruido = ((x * 17 + y * 31 + x * y * 7) % 11) - 5;
        original[y * width + x] = tinta ? 35 + Math.abs(ruido) : 230 + ruido;
      }
    }

    // La captura de prueba conserva la página en retrato y el QR está girado
    // dentro de la reserva, como puede ocurrir al rotar un recorte móvil.
    const rotatedWidth = height;
    const rotatedHeight = width;
    const rotated = new Uint8ClampedArray(rotatedWidth * rotatedHeight);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const destinoX = height - 1 - y;
        const destinoY = x;
        rotated[destinoY * rotatedWidth + destinoX] = original[y * width + x]!;
      }
    }

    const detectado = detectarQrEnRecorteRealzado(rotated, rotatedWidth, rotatedHeight, [texto]);
    expect(detectado?.data).toBe(texto);
    const centroX = [
      detectado!.location.topLeftCorner.x,
      detectado!.location.topRightCorner.x,
      detectado!.location.bottomRightCorner.x,
      detectado!.location.bottomLeftCorner.x
    ].reduce((suma, valor) => suma + valor, 0) / 4;
    const centroY = [
      detectado!.location.topLeftCorner.y,
      detectado!.location.topRightCorner.y,
      detectado!.location.bottomRightCorner.y,
      detectado!.location.bottomLeftCorner.y
    ].reduce((suma, valor) => suma + valor, 0) / 4;
    expect(centroX).toBeCloseTo(height - (top + side / 2), 0);
    expect(centroY).toBeCloseTo(left + side / 2, 0);
    expect(detectarQrEnRecorteRealzado(rotated, rotatedWidth, rotatedHeight, ['EXAMEN:OTROFOLIO:P1:TV4']))
      .toBeNull();
  });

  it('distingue QR ausente, payload detectado distinto y coincidencia exacta en el informe', () => {
    const resumen = resumirReferenciaQr({
      pdf: 'referencia.pdf',
      paginas: [
        { paginaPdf: 1, esperadoDisponible: true, detectado: false, coincide: false },
        { paginaPdf: 2, esperadoDisponible: true, detectado: true, coincide: false },
        { paginaPdf: 3, esperadoDisponible: true, detectado: true, coincide: true }
      ]
    });

    expect(resumen).toMatchObject({
      qrEsperados: 3,
      qrDetectados: 2,
      lecturaCompletaExacta: 1,
      paginasQrNoDetectado: [1],
      paginasPayloadDistinto: [2],
      paginasSinLecturaExacta: [1, 2]
    });
  });
});
