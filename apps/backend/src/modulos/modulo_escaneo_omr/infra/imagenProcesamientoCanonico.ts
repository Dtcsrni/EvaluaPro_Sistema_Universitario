/**
 * Nucleo de procesamiento de imagen del motor OMR canonico.
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';

export type Punto = { x: number; y: number };

export type QrDetalle = {
  data: string;
  location: {
    topLeftCorner: Punto;
    topRightCorner: Punto;
    bottomRightCorner: Punto;
    bottomLeftCorner: Punto;
  };
  calidadGeometrica?: number;
  fuenteDeteccionQr?: 'jsqr' | 'zxing' | 'preprocesado' | 'resolucion_fuente' | 'known_geometry_rescue' | 'rotacion_pagina';
};

export type ParametrosBurbuja = {
  radio: number;
  ringInner: number;
  ringOuter: number;
  outerOuter: number;
  paso: number;
};

export type ReferenciaPaginaOmr = {
  tipo: 'qr' | 'marcas_esquina' | 'escala';
  calidad: number;
  puntosDetectados: number;
  /** Giro de la referencia PDF respecto al eje horizontal de la captura. */
  orientacionGrados?: 0 | 90 | 180 | 270;
  /** Inclinacion residual respecto al giro de cuarto de vuelta mas cercano. */
  inclinacionGrados?: number;
  orientacionDeterminada?: boolean;
  confianzaOrientacion?: number;
  margenOrientacion?: number;
  fuenteOrientacion?: 'qr' | 'qr_patron_esperado' | 'fiducial_direccional' | 'indeterminada';
  conflictoOrientacion?: boolean;
};

/** Solo admite identidad QR cuando el payload completo coincide byte a byte. */
export function coincidePayloadQrExacto(texto: string | undefined, esperados: readonly string[]) {
  return Boolean(texto) && esperados.some((esperado) => texto === esperado);
}

export function medirOrientacionReferenciaOmr(origenIzquierdo: Punto, origenDerecho: Punto) {
  const angulo = Math.atan2(origenDerecho.y - origenIzquierdo.y, origenDerecho.x - origenIzquierdo.x) * 180 / Math.PI;
  const giro = ((Math.round(angulo / 90) * 90) % 360 + 360) % 360;
  let inclinacion = angulo - giro;
  while (inclinacion > 180) inclinacion -= 360;
  while (inclinacion < -180) inclinacion += 360;
  if (inclinacion > 45) inclinacion -= 90;
  if (inclinacion < -45) inclinacion += 90;
  return {
    orientacionGrados: giro as 0 | 90 | 180 | 270,
    inclinacionGrados: Math.round(inclinacion * 100) / 100
  };
}

function detectarQrDetalle(data: Uint8ClampedArray, width: number, height: number): QrDetalle | null {
  type QrLocationRaw = {
    topLeftCorner: Punto;
    topRightCorner: Punto;
    bottomRightCorner: Punto;
    bottomLeftCorner: Punto;
  };
  type QrRaw = { data?: string; location?: QrLocationRaw };
  const resultado = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' }) as QrRaw | null;
  if (!resultado?.data || !resultado.location) return null;
  return {
    data: resultado.data,
    location: {
      topLeftCorner: { x: resultado.location.topLeftCorner.x, y: resultado.location.topLeftCorner.y },
      topRightCorner: { x: resultado.location.topRightCorner.x, y: resultado.location.topRightCorner.y },
      bottomRightCorner: { x: resultado.location.bottomRightCorner.x, y: resultado.location.bottomRightCorner.y },
      bottomLeftCorner: { x: resultado.location.bottomLeftCorner.x, y: resultado.location.bottomLeftCorner.y }
    },
    fuenteDeteccionQr: 'jsqr'
  };
}

export function detectarQrDetalleZxing(gray: Uint8ClampedArray, width: number, height: number): QrDetalle | null {
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, width, height)));
    const result = new QRCodeReader().decode(bitmap, new Map([[DecodeHintType.TRY_HARDER, true]]));
    const points = result.getResultPoints();
    if (result.getBarcodeFormat() !== BarcodeFormat.QR_CODE || points.length < 3) return null;

    // ZXing ordena los puntos detectados como inferior-izquierdo,
    // superior-izquierdo y superior-derecho. La cuarta esquina se estima
    // como paralelogramo; la identidad nunca se confía a esta geometría.
    const bottomLeftCorner = { x: points[0]!.getX(), y: points[0]!.getY() };
    const topLeftCorner = { x: points[1]!.getX(), y: points[1]!.getY() };
    const topRightCorner = { x: points[2]!.getX(), y: points[2]!.getY() };
    const bottomRightCorner = {
      x: bottomLeftCorner.x + topRightCorner.x - topLeftCorner.x,
      y: bottomLeftCorner.y + topRightCorner.y - topLeftCorner.y
    };
    return {
      data: result.getText(),
      location: { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner },
      fuenteDeteccionQr: 'zxing'
    };
  } catch {
    return null;
  }
}

export function extraerSubimagenRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  crop: { left: number; top: number; width: number; height: number }
) {
  const w = Math.max(1, Math.min(width - crop.left, crop.width));
  const h = Math.max(1, Math.min(height - crop.top, crop.height));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const srcY = crop.top + y;
    for (let x = 0; x < w; x += 1) {
      const srcX = crop.left + x;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * w + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return { data: out, width: w, height: h };
}

function extraerSubimagenGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  crop: { left: number; top: number; width: number; height: number }
) {
  const w = Math.max(1, Math.min(width - crop.left, crop.width));
  const h = Math.max(1, Math.min(height - crop.top, crop.height));
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y += 1) {
    const srcY = crop.top + y;
    for (let x = 0; x < w; x += 1) {
      const srcX = crop.left + x;
      out[y * w + x] = gray[srcY * width + srcX];
    }
  }
  return { gray: out, width: w, height: h };
}

function clamp01(valor: number) {
  return Math.max(0, Math.min(1, valor));
}

function distancia(a: Punto, b: Punto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function areaCuadrilateroQr(location: QrDetalle['location']) {
  const puntos = [location.topLeftCorner, location.topRightCorner, location.bottomRightCorner, location.bottomLeftCorner];
  let areaDoble = 0;
  for (let indice = 0; indice < puntos.length; indice += 1) {
    const actual = puntos[indice];
    const siguiente = puntos[(indice + 1) % puntos.length];
    areaDoble += actual.x * siguiente.y - siguiente.x * actual.y;
  }
  return Math.abs(areaDoble) / 2;
}

function puntuarQrCandidato(detalle: QrDetalle, width: number, height: number, qrSizePts: number, anchoCarta: number) {
  const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = detalle.location;
  const anchoSuperior = distancia(tl, tr);
  const anchoInferior = distancia(bl, br);
  const altoIzquierdo = distancia(tl, bl);
  const altoDerecho = distancia(tr, br);
  const ancho = (anchoSuperior + anchoInferior) / 2;
  const escalaEsperada = Math.max(24, (qrSizePts / Math.max(1, anchoCarta)) * width);
  const centroX = (tl.x + tr.x + br.x + bl.x) / 4;
  const centroY = (tl.y + tr.y + br.y + bl.y) / 4;
  const area = areaCuadrilateroQr(detalle.location);
  const areaEsperada = Math.max(400, escalaEsperada * escalaEsperada * 0.48);
  const forma = [anchoSuperior, anchoInferior, altoIzquierdo, altoDerecho].every((lado) => Number.isFinite(lado) && lado >= escalaEsperada * 0.38);
  const proporcion = [anchoSuperior / Math.max(1, anchoInferior), altoIzquierdo / Math.max(1, altoDerecho)].every(
    (ratio) => ratio >= 0.45 && ratio <= 2.2
  );
  if (!forma || !proporcion || !Number.isFinite(area) || area < areaEsperada) return null;

  const escalaScore = clamp01(1 - Math.abs(ancho / escalaEsperada - 0.9) / 1.1);
  // La plantilla coloca el QR en la cabecera derecha. Es una preferencia suave
  // para no romper mapas antiguos, pero evita escoger un código espurio del
  // contenido como referencia global cuando hay más de un QR visible.
  const cabeceraScore = clamp01(1 - Math.max(0, 0.45 - centroX / Math.max(1, width)) / 0.45) * 0.55 +
    clamp01(1 - Math.max(0, centroY / Math.max(1, height) - 0.52) / 0.48) * 0.45;
  const areaScore = clamp01(area / (escalaEsperada * escalaEsperada * 2.2));
  const calidadGeometrica = clamp01(escalaScore * 0.42 + cabeceraScore * 0.36 + areaScore * 0.22);
  return {
    puntuacion: calidadGeometrica,
    calidadGeometrica
  };
}

/** ROI de la cabecera QR con margen frente a inclinación y recortes móviles. */
export function calcularRegionQrFocalizada(
  width: number,
  height: number,
  qrSizePts: number,
  anchoCarta: number
) {
  const expectedQr = Math.max(80, Math.round((qrSizePts / Math.max(1, anchoCarta)) * width));
  const lado = Math.min(Math.round(expectedQr * 1.75), Math.floor(Math.min(width, height) * 0.28));
  const centroX = width * 0.8875;
  const centroY = height * 0.107;
  return {
    left: Math.max(0, Math.min(width - lado, Math.round(centroX - lado / 2))),
    top: Math.max(0, Math.min(height - lado, Math.round(centroY - lado / 2))),
    width: lado,
    height: lado
  };
}

function ampliarRgbaNearest(data: Uint8ClampedArray, width: number, height: number, factor = 2) {
  const escala = Math.max(1, Math.round(factor));
  if (escala === 1) return { data, width, height };
  const outWidth = width * escala;
  const outHeight = height * escala;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / escala));
    for (let x = 0; x < outWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / escala));
      const source = (sourceY * width + sourceX) * 4;
      const target = (y * outWidth + x) * 4;
      out[target] = data[source] ?? 255;
      out[target + 1] = data[source + 1] ?? 255;
      out[target + 2] = data[source + 2] ?? 255;
      out[target + 3] = data[source + 3] ?? 255;
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}

function rgbaDesdeGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  umbral?: number,
  invertir = false
) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    let v = gray[i];
    if (typeof umbral === 'number') {
      v = v < umbral ? 0 : 255;
    }
    if (invertir) v = 255 - v;
    out[p] = v;
    out[p + 1] = v;
    out[p + 2] = v;
    out[p + 3] = 255;
  }
  return out;
}

function rotarRgbaCuartos(data: Uint8ClampedArray, width: number, height: number, giro: 0 | 90 | 180 | 270) {
  if (giro === 0) return { data, width, height };
  const outWidth = giro === 90 || giro === 270 ? height : width;
  const outHeight = giro === 90 || giro === 270 ? width : height;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const destino = giro === 90
        ? { x: height - 1 - y, y: x }
        : giro === 180
          ? { x: width - 1 - x, y: height - 1 - y }
          : { x: y, y: width - 1 - x };
      const origenIndice = (y * width + x) * 4;
      const destinoIndice = (destino.y * outWidth + destino.x) * 4;
      out[destinoIndice] = data[origenIndice] ?? 255;
      out[destinoIndice + 1] = data[origenIndice + 1] ?? 255;
      out[destinoIndice + 2] = data[origenIndice + 2] ?? 255;
      out[destinoIndice + 3] = data[origenIndice + 3] ?? 255;
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}

function desrotarPuntoQr(punto: Punto, giro: 0 | 90 | 180 | 270, width: number, height: number): Punto {
  if (giro === 90) return { x: punto.y, y: height - punto.x };
  if (giro === 180) return { x: width - punto.x, y: height - punto.y };
  if (giro === 270) return { x: width - punto.y, y: punto.x };
  return punto;
}

/** Prueba una binarización focal ampliada y giros, conservando coordenadas originales. */
export function detectarQrEnRecorteRealzado(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  payloadsEsperados?: readonly string[]
): QrDetalle | null {
  const binaria = rgbaDesdeGray(gray, width, height, 220);
  const ampliada = ampliarRgbaNearest(binaria, width, height, 2);
  let mejorCandidato: QrDetalle | null = null;
  for (const giro of [0, 90, 180, 270] as const) {
    const intento = rotarRgbaCuartos(ampliada.data, ampliada.width, ampliada.height, giro);
    const detectado = detectarQrDetalle(intento.data, intento.width, intento.height);
    if (!detectado) continue;
    const mapear = (punto: Punto) => {
      const local = desrotarPuntoQr(punto, giro, ampliada.width, ampliada.height);
      return { x: local.x / 2, y: local.y / 2 };
    };
    const detalle: QrDetalle = {
      ...detectado,
      location: {
        topLeftCorner: mapear(detectado.location.topLeftCorner),
        topRightCorner: mapear(detectado.location.topRightCorner),
        bottomRightCorner: mapear(detectado.location.bottomRightCorner),
        bottomLeftCorner: mapear(detectado.location.bottomLeftCorner)
      }
    };
    if (payloadsEsperados?.length) {
      if (payloadsEsperados.includes(detalle.data)) return detalle;
      continue;
    }
    mejorCandidato ??= detalle;
  }
  return mejorCandidato;
}

function calcularIntegralBinaria(gray: Uint8ClampedArray, width: number, height: number, umbral: number) {
  const w1 = width + 1;
  const integral = new Uint32Array(w1 * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let fila = 0;
    for (let x = 1; x <= width; x += 1) {
      const val = gray[(y - 1) * width + (x - 1)] < umbral ? 1 : 0;
      fila += val;
      integral[y * w1 + x] = integral[(y - 1) * w1 + x] + fila;
    }
  }
  return integral;
}

function sumaVentana(integral: Uint32Array, width: number, x: number, y: number, w: number, h: number) {
  const w1 = width + 1;
  const x2 = x + w;
  const y2 = y + h;
  return integral[y2 * w1 + x2] - integral[y * w1 + x2] - integral[y2 * w1 + x] + integral[y * w1 + x];
}

function localizarQrRegion(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  region: { left: number; top: number; width: number; height: number },
  expectedSize: number
) {
  const sub = extraerSubimagenGray(gray, width, height, region);
  const integral = calcularIntegralBinaria(sub.gray, sub.width, sub.height, 140);
  const tamaños = [
    Math.round(expectedSize * 0.8),
    Math.round(expectedSize * 0.95),
    Math.round(expectedSize * 1.1),
    Math.round(expectedSize * 1.25)
  ].filter((s) => s > 10);
  let best = { score: 0, x: 0, y: 0, size: tamaños[1] ?? expectedSize };
  for (const size of tamaños) {
    const step = Math.max(4, Math.floor(size / 8));
    for (let y = 0; y + size < sub.height; y += step) {
      for (let x = 0; x + size < sub.width; x += step) {
        const negros = sumaVentana(integral, sub.width, x, y, size, size);
        const ratio = negros / (size * size);
        if (ratio > best.score) {
          best = { score: ratio, x, y, size };
        }
      }
    }
  }
  if (best.score < 0.12) return null;
  return {
    left: region.left + best.x,
    top: region.top + best.y,
    width: best.size,
    height: best.size
  };
}

export function detectarQrMejorado(
  data: Uint8ClampedArray,
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  opciones: {
    qrSizePtsHint?: number;
    qrSizePts: number;
    anchoCarta: number;
    payloadsEsperados?: readonly string[];
    habilitarRescateQrBinarizadoRotado?: boolean;
  }
): QrDetalle | null {
  const qrSizePts = opciones.qrSizePtsHint ?? opciones.qrSizePts;
  const intentos: Array<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    scale?: number;
  }> = [];

  intentos.push({ data, width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height), width, height, offsetX: 0, offsetY: 0 });
  // Bajo desenfoque, sombras o compresión JPEG, un único umbral fijo puede
  // borrar módulos del QR o convertir el fondo en ruido. Probamos umbrales
  // conservadores y una inversión, manteniendo el orden barato primero.
  for (const umbral of [120, 145, 170, 195]) {
    intentos.push({ data: rgbaDesdeGray(gray, width, height, umbral), width, height, offsetX: 0, offsetY: 0 });
  }
  intentos.push({ data: rgbaDesdeGray(gray, width, height, 160, true), width, height, offsetX: 0, offsetY: 0 });

  const cropBase = {
    left: Math.floor(width * 0.6),
    top: 0,
    width: Math.floor(width * 0.4),
    height: Math.floor(height * 0.35)
  };
  const cropRaw = extraerSubimagenRgba(data, width, height, cropBase);
  intentos.push({ data: cropRaw.data, width: cropRaw.width, height: cropRaw.height, offsetX: cropBase.left, offsetY: cropBase.top });
  const cropRawUpscaled = ampliarRgbaNearest(cropRaw.data, cropRaw.width, cropRaw.height, 2);
  intentos.push({
    data: cropRawUpscaled.data,
    width: cropRawUpscaled.width,
    height: cropRawUpscaled.height,
    offsetX: cropBase.left,
    offsetY: cropBase.top,
    scale: 2
  });
  const cropGray = extraerSubimagenGray(gray, width, height, cropBase);
  for (const umbral of [120, 145, 170, 195]) {
    const binario = rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, umbral);
    intentos.push({
      data: binario,
      width: cropGray.width,
      height: cropGray.height,
      offsetX: cropBase.left,
      offsetY: cropBase.top
    });
    const binarioUpscaled = ampliarRgbaNearest(binario, cropGray.width, cropGray.height, 2);
    intentos.push({
      data: binarioUpscaled.data,
      width: binarioUpscaled.width,
      height: binarioUpscaled.height,
      offsetX: cropBase.left,
      offsetY: cropBase.top,
      scale: 2
    });
  }
  intentos.push({
    data: rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, 160, true),
    width: cropGray.width,
    height: cropGray.height,
    offsetX: cropBase.left,
    offsetY: cropBase.top
  });

  const expectedQr = Math.max(80, Math.round((qrSizePts / opciones.anchoCarta) * width));
  // Busca primero la reserva física habitual del QR en la cabecera derecha.
  // La ventana mantiene zona de silencio alrededor del símbolo y evita
  // pedirle a jsQR que encuentre un QR pequeño dentro de un recorte de página
  // completo. Los desplazamientos acotados toleran perspectiva/crops leves.
  const regionFocal = calcularRegionQrFocalizada(width, height, qrSizePts, opciones.anchoCarta);
  const ladoFocal = regionFocal.width;
  const desplazamientosFocales = [
    { x: 0, y: 0, ampliar: true },
    { x: -width * 0.025, y: 0, ampliar: false },
    { x: width * 0.025, y: 0, ampliar: false },
    { x: 0, y: -height * 0.015, ampliar: false },
    { x: 0, y: height * 0.015, ampliar: false }
  ];
  const intentosFocalizados = [] as typeof intentos;
  for (const desplazamiento of desplazamientosFocales) {
    const left = Math.max(0, Math.min(width - ladoFocal, Math.round(regionFocal.left + desplazamiento.x)));
    const top = Math.max(0, Math.min(height - ladoFocal, Math.round(regionFocal.top + desplazamiento.y)));
    const crop = extraerSubimagenRgba(data, width, height, {
      left,
      top,
      width: ladoFocal,
      height: ladoFocal
    });
    intentosFocalizados.push({
      data: crop.data,
      width: crop.width,
      height: crop.height,
      offsetX: left,
      offsetY: top
    });
    const cropGray = extraerSubimagenGray(gray, width, height, {
      left,
      top,
      width: ladoFocal,
      height: ladoFocal
    });
    for (const umbral of [210, 220, 225, 240]) {
      intentosFocalizados.push({
        data: rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, umbral),
        width: cropGray.width,
        height: cropGray.height,
        offsetX: left,
        offsetY: top
      });
    }
    if (desplazamiento.ampliar) {
      const ampliado = ampliarRgbaNearest(crop.data, crop.width, crop.height, 2);
      intentosFocalizados.push({
        data: ampliado.data,
        width: ampliado.width,
        height: ampliado.height,
        offsetX: left,
        offsetY: top,
        scale: 2
      });
    }
  }
  intentos.unshift(...intentosFocalizados);
  const region = localizarQrRegion(gray, width, height, cropBase, expectedQr);
  if (region) {
    const regionRaw = extraerSubimagenRgba(data, width, height, region);
    intentos.push({
      data: regionRaw.data,
      width: regionRaw.width,
      height: regionRaw.height,
      offsetX: region.left,
      offsetY: region.top
    });
    const regionRawUpscaled = ampliarRgbaNearest(regionRaw.data, regionRaw.width, regionRaw.height, 2);
    intentos.push({
      data: regionRawUpscaled.data,
      width: regionRawUpscaled.width,
      height: regionRawUpscaled.height,
      offsetX: region.left,
      offsetY: region.top,
      scale: 2
    });
    const regionGray = extraerSubimagenGray(gray, width, height, region);
    intentos.push({
      data: rgbaDesdeGray(regionGray.gray, regionGray.width, regionGray.height, 160),
      width: regionGray.width,
      height: regionGray.height,
      offsetX: region.left,
      offsetY: region.top
    });
  }

  let mejorCandidato: { detalle: QrDetalle; puntuacion: number } | null = null;
  for (const intento of intentos) {
    const res = detectarQrDetalle(intento.data, intento.width, intento.height);
    if (!res) continue;
    const escala = intento.scale ?? 1;
    const map = (p: Punto) => ({ x: p.x / escala + intento.offsetX, y: p.y / escala + intento.offsetY });
    const detalle: QrDetalle = {
      data: res.data,
      location: {
        topLeftCorner: map(res.location.topLeftCorner),
        topRightCorner: map(res.location.topRightCorner),
        bottomRightCorner: map(res.location.bottomRightCorner),
        bottomLeftCorner: map(res.location.bottomLeftCorner)
      }
    };
    const calidad = puntuarQrCandidato(detalle, width, height, qrSizePts, opciones.anchoCarta);
    if (!calidad) continue;
    detalle.calidadGeometrica = calidad.calidadGeometrica;
    if (!mejorCandidato || calidad.puntuacion > mejorCandidato.puntuacion) {
      mejorCandidato = { detalle, puntuacion: calidad.puntuacion };
    }
    // La búsqueda focal es prioritaria; si el candidato ya coincide con la
    // escala y geometría esperadas, no se pagan las pasadas globales restantes.
    if (calidad.puntuacion >= 0.92 && (!opciones.payloadsEsperados?.length || opciones.payloadsEsperados.includes(detalle.data))) {
      return detalle;
    }
  }

  const regionQr = calcularRegionQrFocalizada(width, height, qrSizePts, opciones.anchoCarta);
  const recorteGray = extraerSubimagenGray(gray, width, height, regionQr);

  // Último rescate acotado: binariza la ROI QR, la amplía 2x y prueba los
  // cuatro giros. No escala la página completa y devuelve puntos en el marco
  // original para no alterar la geometría OMR.
  const qrRealzado = opciones.habilitarRescateQrBinarizadoRotado
    ? detectarQrEnRecorteRealzado(
      recorteGray.gray,
      recorteGray.width,
      recorteGray.height,
      opciones.payloadsEsperados
    )
    : null;
  if (qrRealzado) {
    const trasladar = (punto: Punto) => ({ x: punto.x + regionQr.left, y: punto.y + regionQr.top });
    const detalle: QrDetalle = {
      ...qrRealzado,
      location: {
        topLeftCorner: trasladar(qrRealzado.location.topLeftCorner),
        topRightCorner: trasladar(qrRealzado.location.topRightCorner),
        bottomRightCorner: trasladar(qrRealzado.location.bottomRightCorner),
        bottomLeftCorner: trasladar(qrRealzado.location.bottomLeftCorner)
      }
    };
    const calidad = puntuarQrCandidato(detalle, width, height, qrSizePts, opciones.anchoCarta);
    if (calidad) {
      detalle.calidadGeometrica = calidad.calidadGeometrica;
      if (opciones.payloadsEsperados?.includes(detalle.data)) return detalle;
      if (!mejorCandidato || calidad.puntuacion > mejorCandidato.puntuacion) {
        mejorCandidato = { detalle, puntuacion: calidad.puntuacion };
      }
    }
  }

  // Pase secundario ZXing: solo procesa la reserva focal del QR (y un umbral
  // alterno), no vuelve a binarizar toda la página. La geometría estimada se
  // somete al mismo filtro y el llamador valida el payload contra el mapa.
  const recortesAlternos = [
    recorteGray.gray,
    Uint8ClampedArray.from(recorteGray.gray, (valor) => valor < 160 ? 0 : 255)
  ];
  let mejorAlterno: { detalle: QrDetalle; puntuacion: number } | null = null;
  for (const luminancia of recortesAlternos) {
    const qr = detectarQrDetalleZxing(luminancia, recorteGray.width, recorteGray.height);
    if (!qr) continue;
    const trasladar = (punto: Punto) => ({ x: punto.x + regionQr.left, y: punto.y + regionQr.top });
    const detalle: QrDetalle = {
      ...qr,
      location: {
        topLeftCorner: trasladar(qr.location.topLeftCorner),
        topRightCorner: trasladar(qr.location.topRightCorner),
        bottomRightCorner: trasladar(qr.location.bottomRightCorner),
        bottomLeftCorner: trasladar(qr.location.bottomLeftCorner)
      }
    };
    const calidad = puntuarQrCandidato(detalle, width, height, qrSizePts, opciones.anchoCarta);
    if (!calidad) continue;
    detalle.calidadGeometrica = calidad.calidadGeometrica;
    if (opciones.payloadsEsperados?.includes(detalle.data)) return detalle;
    if (!mejorAlterno || calidad.puntuacion > mejorAlterno.puntuacion) mejorAlterno = { detalle, puntuacion: calidad.puntuacion };
  }
  return mejorAlterno?.detalle ?? mejorCandidato?.detalle ?? null;
}

/** Decodifica una ROI QR nativa y conserva el filtro de geometría de página. */
export function detectarQrEnRecorteNativo(
  data: Uint8ClampedArray,
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  origen: { x: number; y: number },
  pagina: { width: number; height: number; qrSizePts: number; anchoCarta: number }
): QrDetalle | null {
  const intentos = [
    data,
    rgbaDesdeGray(gray, width, height),
    ...[210, 220, 225, 240].map((umbral) => rgbaDesdeGray(gray, width, height, umbral))
  ];
  for (const intento of intentos) {
    const detectado = detectarQrDetalle(intento, width, height);
    if (!detectado) continue;
    const mapa = (punto: Punto) => ({ x: punto.x + origen.x, y: punto.y + origen.y });
    const detalle: QrDetalle = {
      data: detectado.data,
      location: {
        topLeftCorner: mapa(detectado.location.topLeftCorner),
        topRightCorner: mapa(detectado.location.topRightCorner),
        bottomRightCorner: mapa(detectado.location.bottomRightCorner),
        bottomLeftCorner: mapa(detectado.location.bottomLeftCorner)
      }
    };
    const calidad = puntuarQrCandidato(
      detalle,
      pagina.width,
      pagina.height,
      pagina.qrSizePts,
      pagina.anchoCarta
    );
    if (calidad) {
      detalle.calidadGeometrica = calidad.calidadGeometrica;
      return detalle;
    }
  }
  return null;
}

/** Lee una imagen completa en gris a resolución fuente y conserva el filtro geométrico QR. */
export function detectarQrZxingPaginaFuente(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  qrSizePts: number,
  anchoCarta: number,
  opciones: { matrixModules?: number; payloadsEsperados?: readonly string[] } = {}
): QrDetalle | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || gray.length !== width * height) {
    return null;
  }
  const detectado = detectarQrDetalleZxing(gray, width, height);
  if (!detectado) return null;
  if (opciones.payloadsEsperados?.length && !opciones.payloadsEsperados.includes(detectado.data)) return null;
  const tamanoExteriorEsperado = (qrSizePts / Math.max(1, anchoCarta)) * width;
  const centroTl = detectado.location.topLeftCorner;
  const centroTr = detectado.location.topRightCorner;
  const centroBl = detectado.location.bottomLeftCorner;
  const distanciaX = distancia(centroTl, centroTr);
  const distanciaY = distancia(centroTl, centroBl);
  const razonModulo = ((distanciaX + distanciaY) / 2) / Math.max(1, tamanoExteriorEsperado);

  // ZXing devuelve centros de los tres patrones buscadores, no las esquinas
  // exteriores de la matriz que consume la homografía del mapa. Estimar la
  // versión QR permitida más cercana y extrapolar 3.5 módulos desde cada
  // centro para reconstruir las esquinas de la matriz.
  let modulos = Number(opciones.matrixModules);
  if (!Number.isInteger(modulos) || modulos < 21 || modulos > 177 || (modulos - 21) % 4 !== 0) {
    modulos = 21;
    let errorVersion = Number.POSITIVE_INFINITY;
    for (let candidato = 21; candidato <= 177; candidato += 4) {
      const razonEsperada = (candidato - 7) / (candidato + 8);
      const error = Math.abs(razonModulo - razonEsperada);
      if (error < errorVersion) {
        modulos = candidato;
        errorVersion = error;
      }
    }
  }
  const moduloX = distanciaX / (modulos - 7);
  const moduloY = distanciaY / (modulos - 7);
  const ejeX = { x: (centroTr.x - centroTl.x) / Math.max(1, distanciaX), y: (centroTr.y - centroTl.y) / Math.max(1, distanciaX) };
  const ejeY = { x: (centroBl.x - centroTl.x) / Math.max(1, distanciaY), y: (centroBl.y - centroTl.y) / Math.max(1, distanciaY) };
  const offsetX = { x: ejeX.x * moduloX * 3.5, y: ejeX.y * moduloX * 3.5 };
  const offsetY = { x: ejeY.x * moduloY * 3.5, y: ejeY.y * moduloY * 3.5 };
  const matriz: QrDetalle = {
    ...detectado,
    location: {
      topLeftCorner: { x: centroTl.x - offsetX.x - offsetY.x, y: centroTl.y - offsetX.y - offsetY.y },
      topRightCorner: { x: centroTr.x + offsetX.x - offsetY.x, y: centroTr.y + offsetX.y - offsetY.y },
      bottomLeftCorner: { x: centroBl.x - offsetX.x + offsetY.x, y: centroBl.y - offsetX.y + offsetY.y },
      bottomRightCorner: {
        x: centroBl.x + ejeX.x * moduloX * (modulos - 3.5) + offsetY.x,
        y: centroBl.y + ejeX.y * moduloX * (modulos - 3.5) + offsetY.y
      }
    }
  };
  const esquinas = Object.values(matriz.location);
  const lados = [
    distancia(matriz.location.topLeftCorner, matriz.location.topRightCorner),
    distancia(matriz.location.topRightCorner, matriz.location.bottomRightCorner),
    distancia(matriz.location.bottomRightCorner, matriz.location.bottomLeftCorner),
    distancia(matriz.location.bottomLeftCorner, matriz.location.topLeftCorner)
  ];
  const area = areaCuadrilateroQr(matriz.location);
  const centroX = esquinas.reduce((suma, punto) => suma + punto.x, 0) / esquinas.length;
  const centroY = esquinas.reduce((suma, punto) => suma + punto.y, 0) / esquinas.length;
  const ladoMin = Math.min(...lados);
  const ladoMax = Math.max(...lados);
  if (
    lados.some((lado) => !Number.isFinite(lado)) || ladoMin < 24 || ladoMax / Math.max(1, ladoMin) > 2.2 ||
    area < 400 || esquinas.some((punto) =>
      punto.x < -width * 0.02 || punto.x > width * 1.02 || punto.y < -height * 0.02 || punto.y > height * 1.02
    ) ||
    centroX < width * 0.02 || centroX > width * 0.98 || centroY < height * 0.02 || centroY > height * 0.98
  ) return null;
  const calidadGeometrica = clamp01(0.75 + 0.25 * (ladoMin / Math.max(1, ladoMax)));
  return {
    ...matriz,
    calidadGeometrica,
    fuenteDeteccionQr: 'resolucion_fuente'
  };
}

/**
 * Intenta leer el QR a partir de la geometría persistida del mapa OMR.
 *
 * Esta ruta no busca un código en toda la fotografía: proyecta primero la
 * reserva física conocida (incluida la quiet zone) mediante la transformación
 * de página obtenida con los fiduciales. Así, la perspectiva y la inclinación
 * dejan de ser responsabilidad de jsQR. El texto devuelto aún debe validarse
 * contra el QR esperado antes de usarlo como identidad de la página.
 */
export function detectarQrPorGeometriaConocida(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  qrGeometry: {
    x: number;
    y: number;
    size: number;
    marginModules?: number;
    matrixModules?: number;
  },
  transformar: (punto: Punto) => Punto,
  opciones: { altoCarta: number; outputSize?: number; payloadsEsperados?: readonly string[] }
): QrDetalle | null {
  const qrX = Number(qrGeometry.x);
  const qrY = Number(qrGeometry.y);
  const qrSize = Number(qrGeometry.size);
  const altoCarta = Number(opciones.altoCarta);
  if (![qrX, qrY, qrSize, altoCarta].every(Number.isFinite) || qrSize <= 0 || altoCarta <= 0) return null;

  const transformarPunto = (x: number, y: number) => {
    const punto = transformar({ x, y });
    return Number.isFinite(punto.x) && Number.isFinite(punto.y) ? punto : null;
  };
  // El mapa persiste x/y de la tarjeta QR en coordenadas PDF (origen abajo a
  // la izquierda). La transformación del OMR devuelve coordenadas de imagen
  // (origen arriba a la izquierda), por lo que solo se cambia el orden de las
  // esquinas al construir el cuadrilátero.
  const full = {
    topLeft: transformarPunto(qrX, qrY + qrSize),
    topRight: transformarPunto(qrX + qrSize, qrY + qrSize),
    bottomRight: transformarPunto(qrX + qrSize, qrY),
    bottomLeft: transformarPunto(qrX, qrY)
  };
  const marginModules = Math.max(0, Number(qrGeometry.marginModules ?? 0));
  const matrixModules = Math.max(0, Number(qrGeometry.matrixModules ?? 0));
  const quietFraction = matrixModules > 0 && marginModules > 0
    ? marginModules / (matrixModules + marginModules * 2)
    : 0;
  const matrixX = qrX + qrSize * quietFraction;
  const matrixY = qrY + qrSize * quietFraction;
  const matrixSize = qrSize * (1 - quietFraction * 2);
  const matrixRaw = {
    topLeftCorner: transformarPunto(matrixX, matrixY + matrixSize),
    topRightCorner: transformarPunto(matrixX + matrixSize, matrixY + matrixSize),
    bottomRightCorner: transformarPunto(matrixX + matrixSize, matrixY),
    bottomLeftCorner: transformarPunto(matrixX, matrixY)
  };
  if (Object.values(full).some((punto) => !punto) || Object.values(matrixRaw).some((punto) => !punto)) return null;
  const matrix = matrixRaw as QrDetalle['location'];

  // 384 px conserva aproximadamente 5-6 px por módulo para los tamaños
  // canónicos y evita una segunda imagen de 512^2 por página móvil.
  const outputSize = Math.max(256, Math.min(768, Math.round(opciones.outputSize ?? 384)));
  const origen = [
    { x: 0, y: 0 },
    { x: outputSize - 1, y: 0 },
    { x: outputSize - 1, y: outputSize - 1 },
    { x: 0, y: outputSize - 1 }
  ];
  const destino = [full.topLeft!, full.topRight!, full.bottomRight!, full.bottomLeft!];
  const homografia = calcularHomografia(origen, destino);
  if (!homografia) return null;

  const rectificada = new Uint8ClampedArray(outputSize * outputSize * 4);
  for (let y = 0; y < outputSize; y += 1) {
    for (let x = 0; x < outputSize; x += 1) {
      const punto = aplicarHomografia(homografia, { x, y });
      const sx = Math.max(0, Math.min(width - 1, punto.x));
      const sy = Math.max(0, Math.min(height - 1, punto.y));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const destinoIndice = (y * outputSize + x) * 4;
      for (let canal = 0; canal < 4; canal += 1) {
        const a = data[(y0 * width + x0) * 4 + canal] ?? (canal === 3 ? 255 : 255);
        const b = data[(y0 * width + x1) * 4 + canal] ?? a;
        const c = data[(y1 * width + x0) * 4 + canal] ?? a;
        const d = data[(y1 * width + x1) * 4 + canal] ?? a;
        rectificada[destinoIndice + canal] = Math.round(
          a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
        );
      }
    }
  }

  const gray = new Uint8ClampedArray(outputSize * outputSize);
  for (let indice = 0, pixel = 0; indice < rectificada.length; indice += 4, pixel += 1) {
    gray[pixel] = Math.round(
      rectificada[indice] * 0.299 + rectificada[indice + 1] * 0.587 + rectificada[indice + 2] * 0.114
    );
  }
  const intentos = [
    rectificada,
    rgbaDesdeGray(gray, outputSize, outputSize),
    ...[120, 160, 200, 210, 220, 225, 240].map((umbral) => rgbaDesdeGray(gray, outputSize, outputSize, umbral)),
    rgbaDesdeGray(gray, outputSize, outputSize, 160, true)
  ];
  const payloadsEsperados = opciones.payloadsEsperados ?? [];
  const coincidePayloadEsperado = (texto: string) =>
    payloadsEsperados.length === 0 || coincidePayloadQrExacto(texto, payloadsEsperados);
  for (const intento of intentos) {
    const detalle = detectarQrDetalle(intento, outputSize, outputSize);
    if (detalle?.data && coincidePayloadEsperado(detalle.data)) {
      const calidad = puntuarQrCandidato(
        { ...detalle, location: matrix },
        width,
        height,
        qrSize,
        612
      );
      return {
        data: detalle.data,
        location: matrix,
        calidadGeometrica: calidad?.calidadGeometrica ?? 0.82
      };
    }
  }
  return null;
}

export function obtenerIntensidad(gray: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
  const idx = yi * width + xi;
  return gray[idx];
}

export function calcularIntegral(gray: Uint8ClampedArray, width: number, height: number) {
  const w1 = width + 1;
  const integral = new Uint32Array(w1 * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let fila = 0;
    for (let x = 1; x <= width; x += 1) {
      fila += gray[(y - 1) * width + (x - 1)];
      integral[y * w1 + x] = integral[(y - 1) * w1 + x] + fila;
    }
  }
  return integral;
}

export function mediaEnVentana(integral: Uint32Array, width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
  const w1 = width + 1;
  const xa = Math.max(0, Math.min(width, Math.floor(x0)));
  const ya = Math.max(0, Math.min(height, Math.floor(y0)));
  const xb = Math.max(0, Math.min(width, Math.ceil(x1)));
  const yb = Math.max(0, Math.min(height, Math.ceil(y1)));
  const area = Math.max(1, (xb - xa) * (yb - ya));
  const sum =
    integral[yb * w1 + xb] -
    integral[ya * w1 + xb] -
    integral[yb * w1 + xa] +
    integral[ya * w1 + xa];
  return sum / area;
}

function puntuarCentroVacioFiducial(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radioHueco: number
) {
  const radioCentro = Math.max(1.25, radioHueco * 0.68);
  const radioAnillo = Math.max(radioCentro + 1, radioHueco * 1.45);
  let sumaCentro = 0;
  let nCentro = 0;
  let anilloNegro = 0;
  for (let indice = 0; indice < 24; indice += 1) {
    const angulo = indice * Math.PI / 12;
    const px = Math.round(x + Math.cos(angulo) * radioAnillo);
    const py = Math.round(y + Math.sin(angulo) * radioAnillo);
    if (obtenerIntensidad(gray, width, height, px, py) < 110) anilloNegro += 1;
  }
  for (let dy = -Math.ceil(radioCentro); dy <= Math.ceil(radioCentro); dy += 1) {
    for (let dx = -Math.ceil(radioCentro); dx <= Math.ceil(radioCentro); dx += 1) {
      if (Math.hypot(dx, dy) > radioCentro) continue;
      sumaCentro += obtenerIntensidad(gray, width, height, x + dx, y + dy);
      nCentro += 1;
    }
  }
  const proporcionAnilloNegro = anilloNegro / 24;
  const mediaCentro = nCentro > 0 ? sumaCentro / nCentro : 0;
  if (mediaCentro <= 165 || proporcionAnilloNegro < 0.75) return 0;
  return Math.max(0, Math.min(1, (mediaCentro - 165) / 90)) * proporcionAnilloNegro;
}

function detectarMarca(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  esquina: 'tl' | 'tr' | 'bl' | 'br',
  modo: 'lineas' | 'cuadrados' | 'auto' = 'auto',
  tamanoPts = 0,
  anchoCarta = 612,
  margenPts = 0,
  distanciaMaximaEsquina = Math.max(24, Math.min(width, height) * 0.15),
  radioBusquedaPx?: number,
  fiducialDireccional?: { radio: number }
) {
  // Las líneas canónicas pueden quedar en un solo píxel tras una captura
  // reducida; muestrear cada dos píxeles las hacía desaparecer según la fase
  // de rasterización. Las cuatro regiones siguen siendo pequeñas.
  const paso = modo === 'lineas' ? 1 : 2;
  let conteo = 0;
  let sum = 0;
  let sumSq = 0;
  const candidatos: Array<{ x: number; y: number; d: number }> = [];

  // Muestreo ligero para ubicar el centro de la marca negra sin procesar cada pixel.
  for (let y = region.y0; y < region.y1; y += paso) {
    for (let x = region.x0; x < region.x1; x += paso) {
      const intensidad = obtenerIntensidad(gray, width, height, x, y);
      sum += intensidad;
      sumSq += intensidad * intensidad;
    }
  }

  const total = Math.max(1, Math.floor(((region.y1 - region.y0) / paso) * ((region.x1 - region.x0) / paso)));
  const media = sum / total;
  const varianza = Math.max(0, sumSq / total - media * media);
  const desviacion = Math.sqrt(varianza);
  const umbral = Math.max(35, media - Math.max(15, desviacion * 1.1));

  if (modo === 'cuadrados' && tamanoPts > 0) {
    // En un marcador cuadrado el centroide de toda la tinta cercana puede
    // incluir el borde de la hoja, una regla del encabezado o el QR. Buscar
    // una ventana con alta densidad de negro identifica la firma física del
    // cuadrado y conserva su centro para la homografía.
    const tamanoPx = Math.max(10, tamanoPts * width / anchoCarta);
    const margenPx = Math.max(0, margenPts * width / anchoCarta);
    // La búsqueda no debe alcanzar el QR ni logos cercanos: ambos pueden
    // tener una densidad de tinta alta, pero no son un cuadrado sólido. El
    // margen 1.6x conserva tolerancia para perspectiva leve sin convertir la
    // región de la esquina en una búsqueda global.
    const radio = radioBusquedaPx ?? Math.max(18, tamanoPx * 1.6);
    const radioHuecoFiducial = fiducialDireccional
      ? fiducialDireccional.radio * width / anchoCarta
      : 0;
    const centroNominal = {
      x: esquina === 'tr' || esquina === 'br' ? width - margenPx - tamanoPx / 2 : margenPx + tamanoPx / 2,
      y: esquina === 'bl' || esquina === 'br' ? height - margenPx - tamanoPx / 2 : margenPx + tamanoPx / 2
    };
    let mejor: { x: number; y: number; score: number } | null = null;
    const mitadVentana = Math.max(4, Math.round(tamanoPx * 0.42));
    const pasoBusqueda = Math.max(1, Math.round(tamanoPx / 10));
    for (let y = Math.max(region.y0, centroNominal.y - radio); y <= Math.min(region.y1, centroNominal.y + radio); y += pasoBusqueda) {
      for (let x = Math.max(region.x0, centroNominal.x - radio); x <= Math.min(region.x1, centroNominal.x + radio); x += pasoBusqueda) {
        let oscurosCentro = 0;
        let totalCentro = 0;
        let sumaCentro = 0;
        let sumaCuadradoCentro = 0;
        for (let yy = -mitadVentana; yy <= mitadVentana; yy += 1) {
          for (let xx = -mitadVentana; xx <= mitadVentana; xx += 1) {
            const intensidad = obtenerIntensidad(gray, width, height, x + xx, y + yy);
            totalCentro += 1;
            sumaCentro += intensidad;
            sumaCuadradoCentro += intensidad * intensidad;
            if (intensidad < umbral) oscurosCentro += 1;
          }
        }
        const densidad = oscurosCentro / Math.max(1, totalCentro);
        const mediaCentro = sumaCentro / Math.max(1, totalCentro);
        const varianzaCentro = Math.max(
          0,
          sumaCuadradoCentro / Math.max(1, totalCentro) - mediaCentro * mediaCentro
        );
        const uniformidad = 1 - Math.min(1, Math.sqrt(varianzaCentro) / 96);
        const distanciaNominal = Math.hypot(x - centroNominal.x, y - centroNominal.y) / Math.max(1, radio);
        // El fiducial direccional tiene un centro blanco intencional. Sin una
        // puntuación positiva para ese anillo, el texto cercano puede superar
        // su uniformidad y desviar la homografía hacia un falso marcador.
        const scoreHueco = fiducialDireccional && densidad >= 0.68
          ? puntuarCentroVacioFiducial(gray, width, height, x, y, radioHuecoFiducial)
          : 0;
        const score = densidad * 0.82 + uniformidad * 0.18 + scoreHueco * 0.24 - distanciaNominal * 0.035;
        if (!mejor || score > mejor.score) mejor = { x, y, score };
      }
    }
    if (mejor && mejor.score >= 0.68) {
      // El fiducial con centro vacío debe ubicarse por el centro de su hueco,
      // no por el centroide de la tinta: el umbral binario puede sesgar este
      // último uno o más píxeles y aparentar inclinación en el borde superior.
      if (fiducialDireccional) return { x: mejor.x, y: mejor.y };
      // La búsqueda gruesa conserva costo acotado; el centroide ponderado
      // dentro de la ventana local elimina la cuantización del paso de malla.
      // Es importante para no convertir una página recta en una inclinación
      // aparente al estimar la arista superior entre fiduciales.
      const radioRefinamiento = Math.max(2, Math.round(tamanoPx * 0.38));
      let pesoTotal = 0;
      let sumaX = 0;
      let sumaY = 0;
      for (let dy = -radioRefinamiento; dy <= radioRefinamiento; dy += 1) {
        for (let dx = -radioRefinamiento; dx <= radioRefinamiento; dx += 1) {
          const intensidad = obtenerIntensidad(gray, width, height, mejor.x + dx, mejor.y + dy);
          if (intensidad >= umbral) continue;
          const peso = umbral - intensidad;
          pesoTotal += peso;
          sumaX += dx * peso;
          sumaY += dy * peso;
        }
      }
      return pesoTotal > 0
        ? { x: mejor.x + sumaX / pesoTotal, y: mejor.y + sumaY / pesoTotal }
        : { x: mejor.x, y: mejor.y };
    }
  }

  for (let y = region.y0; y < region.y1; y += paso) {
    for (let x = region.x0; x < region.x1; x += paso) {
      const intensidad = obtenerIntensidad(gray, width, height, x, y);
      if (intensidad < umbral) {
        conteo += 1;
        const d =
          esquina === 'tl'
            ? x + y
            : esquina === 'tr'
              ? (width - x) + y
              : esquina === 'bl'
                ? x + (height - y)
                : (width - x) + (height - y);
        candidatos.push({ x, y, d });
      }
    }
  }

  if (!conteo || conteo < 12) return null;
  candidatos.sort((a, b) => a.d - b.d);
  const distanciaMin = candidatos[0]?.d ?? Infinity;
  // La impresión y la perspectiva pueden alejar el vértice unos píxeles más
  // de la esquina nominal, especialmente en capturas reducidas. La región
  // ya está limitada al 15% de la hoja y la validación posterior exige cuatro
  // marcas con cobertura/simetría de página, por lo que este margen adicional
  // no convierte una mancha aislada en referencia global.
  // Con inclinacion, la esquina fisica puede separarse bastante de la esquina
  // del lienzo (p. ej. el extremo superior de una hoja girada varios grados).
  // La region amplia se mantiene segura mediante la validacion posterior de
  // las cuatro esquinas y la cobertura/simetria de pagina.
  const distanciaMaxima = distanciaMaximaEsquina;
  if (distanciaMin > distanciaMaxima) {
    return null;
  }
  const limite = Math.max(8, Math.floor(candidatos.length * 0.15));
  const cercanos = candidatos.slice(0, Math.min(limite, candidatos.length));
  const percentil = (valores: number[], fraccion: number) => {
    const ordenados = [...valores].sort((a, b) => a - b);
    const indice = Math.max(0, Math.min(ordenados.length - 1, Math.round((ordenados.length - 1) * fraccion)));
    return ordenados[indice] ?? 0;
  };
  const xs = cercanos.map((candidato) => candidato.x);
  const ys = cercanos.map((candidato) => candidato.y);
  const anchoGrupo = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const altoGrupo = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const densidadGrupo = cercanos.length * paso * paso / (anchoGrupo * altoGrupo);
  const esLinea = modo === 'lineas' || (modo === 'auto' && densidadGrupo < 0.48);
  if (!esLinea) {
    // Los cuadrados sólidos se estiman mediante el centro de su núcleo de
    // tinta; las marcas L requieren la estimación de vértice de abajo.
    const xCentro = cercanos.reduce((suma, candidato) => suma + candidato.x, 0) / Math.max(1, cercanos.length);
    const yCentro = cercanos.reduce((suma, candidato) => suma + candidato.y, 0) / Math.max(1, cercanos.length);
    return Number.isFinite(xCentro) && Number.isFinite(yCentro) ? { x: xCentro, y: yCentro } : null;
  }
  // En una marca L el centroide de la tinta cae dentro de los brazos y
  // desplaza la homografía. Estimamos el vértice físico con percentiles
  // extremos del grupo cercano a la esquina.
  const x = esquina === 'tr' || esquina === 'br' ? percentil(xs, 0.9) : percentil(xs, 0.1);
  const y = esquina === 'bl' || esquina === 'br' ? percentil(ys, 0.9) : percentil(ys, 0.1);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function calcularHomografia(origen: Punto[], destino: Punto[]) {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const { x, y } = origen[i];
    const { x: u, y: v } = destino[i];

    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = resolverSistema(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function puntuarMarcasPagina(destino: Punto[], width: number, height: number) {
  if (destino.length !== 4) return 0;
  const [tl, tr, bl, br] = destino;
  if (!tl || !tr || !bl || !br) return 0;
  const anchoSuperior = distancia(tl, tr);
  const anchoInferior = distancia(bl, br);
  const altoIzquierdo = distancia(tl, bl);
  const altoDerecho = distancia(tr, br);
  const anchoMedio = (anchoSuperior + anchoInferior) / 2;
  const altoMedio = (altoIzquierdo + altoDerecho) / 2;
  if (anchoMedio < width * 0.45 || altoMedio < height * 0.45) return 0;
  const simetriaAncho = clamp01(1 - Math.abs(anchoSuperior - anchoInferior) / Math.max(1, anchoMedio));
  const simetriaAlto = clamp01(1 - Math.abs(altoIzquierdo - altoDerecho) / Math.max(1, altoMedio));
  const cobertura = clamp01((anchoMedio / width) * 0.55 + (altoMedio / height) * 0.45);
  return clamp01(simetriaAncho * 0.38 + simetriaAlto * 0.38 + cobertura * 0.24);
}

function resolverSistema(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);

  for (let i = 0; i < n; i += 1) {
    let maxFila = i;
    for (let k = i + 1; k < n; k += 1) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxFila][i])) {
        maxFila = k;
      }
    }

    if (Math.abs(M[maxFila][i]) < 1e-8) return null;
    [M[i], M[maxFila]] = [M[maxFila], M[i]];

    const pivote = M[i][i];
    for (let j = i; j <= n; j += 1) {
      M[i][j] /= pivote;
    }

    for (let k = 0; k < n; k += 1) {
      if (k === i) continue;
      const factor = M[k][i];
      for (let j = i; j <= n; j += 1) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  return M.map((fila) => fila[n]);
}

function aplicarHomografia(h: number[], punto: Punto) {
  const [h11, h12, h13, h21, h22, h23, h31, h32] = h;
  const denom = h31 * punto.x + h32 * punto.y + 1;
  const x = (h11 * punto.x + h12 * punto.y + h13) / denom;
  const y = (h21 * punto.x + h22 * punto.y + h23) / denom;
  return { x, y };
}

function detectarOrientacionPorPatronQr(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  origenPagina: Punto[],
  marcas: Array<Punto | null>,
  qrGeometry: { x: number; y: number; size: number; marginModules?: number; matrixModules?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; textoEsperado?: string | string[] } | undefined,
  altoCarta: number
) {
  const texto = Array.isArray(qrGeometry?.textoEsperado)
    ? qrGeometry.textoEsperado[0]
    : qrGeometry?.textoEsperado;
  const modulesEsperados = qrGeometry?.matrixModules ?? 0;
  const margenModulos = qrGeometry?.marginModules ?? 0;
  if (!texto || modulesEsperados < 21 || margenModulos < 4 || marcas.some((marca) => !marca)) return undefined;
  const nivelCorreccion = qrGeometry?.errorCorrectionLevel ?? 'H';
  if (!['L', 'M', 'Q', 'H'].includes(nivelCorreccion)) return undefined;

  let qrModules: { size: number; data: Uint8Array };
  try {
    qrModules = (QRCode as unknown as {
      create: (text: string, options: { errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' }) => { modules: { size: number; data: Uint8Array } };
    }).create(texto, { errorCorrectionLevel: nivelCorreccion }).modules;
  } catch {
    return undefined;
  }
  if (qrModules.size !== modulesEsperados || qrModules.data.length !== modulesEsperados * modulesEsperados) return undefined;

  const size = qrGeometry!.size;
  const modulePitch = size / (modulesEsperados + 2 * margenModulos);
  const qrTop = qrGeometry!.y > altoCarta / 2
    ? altoCarta - qrGeometry!.y - size
    : qrGeometry!.y;
  const qrLeft = qrGeometry!.x + margenModulos * modulePitch;
  const qrTopMatrix = qrTop + margenModulos * modulePitch;
  const destinos = [
    [marcas[0]!, marcas[1]!, marcas[2]!, marcas[3]!],
    [marcas[1]!, marcas[3]!, marcas[0]!, marcas[2]!],
    [marcas[3]!, marcas[2]!, marcas[1]!, marcas[0]!],
    [marcas[2]!, marcas[0]!, marcas[3]!, marcas[1]!]
  ];
  const scores: Array<{
    orientacionGrados: 0 | 90 | 180 | 270;
    inclinacionGrados: number;
    score: number;
    shiftX: number;
    shiftY: number;
  }> = [];
  const maxShift = Math.max(2, Math.round(Math.min(width, height) * 0.035));
  const shiftStep = Math.max(2, Math.round(maxShift / 12));
  const evaluar = (h: number[], shiftX: number, shiftY: number, completo: boolean) => {
    let sumaNegros = 0;
    let cuentaNegros = 0;
    let sumaBlancos = 0;
    let cuentaBlancos = 0;
    let fuera = 0;
    for (let fila = 0; fila < modulesEsperados; fila += completo ? 1 : 2) {
      for (let columna = 0; columna < modulesEsperados; columna += completo ? 1 : 2) {
        const esNegro = qrModules.data[fila * modulesEsperados + columna] !== 0;
        const centroX = qrLeft + (columna + 0.5) * modulePitch;
        const centroY = qrTopMatrix + (fila + 0.5) * modulePitch;
        const desplazamientos = completo
          ? [[0, 0], [-0.18, 0], [0.18, 0], [0, -0.18], [0, 0.18]] as const
          : [[0, 0]] as const;
        for (const [dx, dy] of desplazamientos) {
          const capturado = aplicarHomografia(h, {
            x: centroX + dx * modulePitch,
            y: centroY + dy * modulePitch
          });
          const px = Math.round(capturado.x + shiftX);
          const py = Math.round(capturado.y + shiftY);
          if (px < 0 || py < 0 || px >= width || py >= height) {
            fuera += 1;
            continue;
          }
          const intensidad = gray[py * width + px] ?? 255;
          if (esNegro) {
            sumaNegros += intensidad;
            cuentaNegros += 1;
          } else {
            sumaBlancos += intensidad;
            cuentaBlancos += 1;
          }
        }
      }
    }
    const total = cuentaNegros + cuentaBlancos + fuera;
    if (!cuentaNegros || !cuentaBlancos || fuera / Math.max(1, total) > 0.01) return -1;
    return (sumaBlancos / cuentaBlancos - sumaNegros / cuentaNegros) / 255;
  };

  for (let giro = 0; giro < destinos.length; giro += 1) {
    const h = calcularHomografia(origenPagina, destinos[giro]!);
    if (!h) continue;
    let coarse = { score: -1, x: 0, y: 0 };
    for (let shiftY = -maxShift; shiftY <= maxShift; shiftY += shiftStep) {
      for (let shiftX = -maxShift; shiftX <= maxShift; shiftX += shiftStep) {
        const score = evaluar(h, shiftX, shiftY, false);
        if (score > coarse.score) coarse = { score, x: shiftX, y: shiftY };
      }
    }
    let best = { ...coarse, score: -1 };
    const centrosRefinamiento = [coarse, { score: -1, x: 0, y: 0 }];
    for (const centro of centrosRefinamiento) {
      for (let shiftY = centro.y - shiftStep; shiftY <= centro.y + shiftStep; shiftY += Math.max(1, Math.floor(shiftStep / 2))) {
        for (let shiftX = centro.x - shiftStep; shiftX <= centro.x + shiftStep; shiftX += Math.max(1, Math.floor(shiftStep / 2))) {
          const score = evaluar(h, shiftX, shiftY, true);
          if (score > best.score) best = { score, x: shiftX, y: shiftY };
        }
      }
    }
    if (best.score < 0) continue;
    const origenQr = { x: qrLeft, y: qrTopMatrix };
    const finQr = { x: qrLeft + modulesEsperados * modulePitch, y: qrTopMatrix };
    const orientacion = medirOrientacionReferenciaOmr(
      aplicarHomografia(h, origenQr),
      aplicarHomografia(h, finQr)
    );
    scores.push({ ...orientacion, score: best.score, shiftX: best.x, shiftY: best.y });
  }

  scores.sort((a, b) => b.score - a.score);
  const mejor = scores[0];
  const segundo = scores[1];
  // El patrón solo desambigua orientación si coincide con contraste y margen
  // claros; nunca se presenta como un QR decodificado o autenticado.
  if (!mejor) return undefined;
  const margin = mejor.score - (segundo?.score ?? 0);
  return { ...mejor, margin, accepted: mejor.score >= 0.2 && margin >= 0.08 };
}

export function obtenerTransformacion(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  advertencias: string[],
  qr?: QrDetalle | null,
  opciones?: {
    margenMm: number;
    qrSizePts: number;
    qrGeometry?: {
      x: number;
      y: number;
      size: number;
      marginModules?: number;
      matrixModules?: number;
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      textoEsperado?: string | string[];
    };
    marcasPagina?: {
      tipo?: 'lineas' | 'cuadrados';
      size?: number;
      orientacion?: { esquina: 'tl'; tipo: 'centro_vacio'; radio: number };
      tl?: Punto;
      tr?: Punto;
      bl?: Punto;
      br?: Punto;
    };
    anchoCarta: number;
    altoCarta: number;
    mmAPuntos: number;
  }
) {
  const margenMm = opciones?.margenMm ?? 10;
  const qrGeometry = opciones?.qrGeometry;
  const qrSizePts = qrGeometry?.size ?? opciones?.qrSizePts ?? 68;
  const anchoCarta = opciones?.anchoCarta ?? 612;
  const altoCarta = opciones?.altoCarta ?? 792;
  const mmAPuntos = opciones?.mmAPuntos ?? (72 / 25.4);
  const modoMarcasPagina = opciones?.marcasPagina?.tipo ?? 'lineas';
  const crearEscala = () => {
    const escalaX = width / anchoCarta;
    const escalaY = height / altoCarta;
    return (punto: Punto) => ({ x: punto.x * escalaX, y: height - punto.y * escalaY });
  };

  // Un QR decodificado o un fiducial direccional permiten ampliar la búsqueda
  // desde el inicio. Si solo tenemos el patrón QR esperado, se conserva primero
  // la búsqueda histórica y se amplía únicamente cuando falten esquinas.
  const fiducialDireccional = opciones?.marcasPagina?.orientacion;
  const tamanoMarcaPts = opciones?.marcasPagina?.size ?? 0;
  const margenPts = margenMm * mmAPuntos;
  const radioBusqueda = fiducialDireccional ? Math.min(width, height) * 0.46 : undefined;
  const buscarMarcasPagina = (region: number, toleranciaEsquina: number) => {
    const regiones = {
      tl: { x0: 0, y0: 0, x1: width * region, y1: height * region },
      tr: { x0: width * (1 - region), y0: 0, x1: width, y1: height * region },
      bl: { x0: 0, y0: height * (1 - region), x1: width * region, y1: height },
      br: { x0: width * (1 - region), y0: height * (1 - region), x1: width, y1: height }
    };
    const distanciaMaximaEsquina = Math.max(24, Math.min(width, height) * toleranciaEsquina);
    return [
      detectarMarca(gray, width, height, regiones.tl, 'tl', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts, distanciaMaximaEsquina, radioBusqueda, fiducialDireccional),
      detectarMarca(gray, width, height, regiones.tr, 'tr', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts, distanciaMaximaEsquina, radioBusqueda, fiducialDireccional),
      detectarMarca(gray, width, height, regiones.bl, 'bl', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts, distanciaMaximaEsquina, radioBusqueda, fiducialDireccional),
      detectarMarca(gray, width, height, regiones.br, 'br', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts, distanciaMaximaEsquina, radioBusqueda, fiducialDireccional)
    ] as const;
  };
  let marcasEncontradas = buscarMarcasPagina(qr?.location || fiducialDireccional ? 0.35 : 0.15, qr?.location || fiducialDireccional ? 0.45 : 0.15);
  if (
    marcasEncontradas.some((marca) => !marca) &&
    qrGeometry?.textoEsperado &&
    !qr?.location &&
    !fiducialDireccional
  ) {
    marcasEncontradas = buscarMarcasPagina(0.35, 0.45);
  }
  const [tl, tr, bl, br] = marcasEncontradas;

  if (tl && tr && bl && br) {
    // El detector de esquinas encuentra posiciones en la imagen, no sabe por
    // si solo que esquina fisica de la plantilla ocupa cada cuadrante. La
    // direccion semantica del borde superior del QR desambigua los cuatro
    // giros cardinales antes de ajustar la homografia global.
    const marcasDetectadas = [tl, tr, bl, br];
    const pitchX = Math.max(1, anchoCarta - 2 * margenPts - tamanoMarcaPts);
    const pitchY = Math.max(1, altoCarta - 2 * margenPts - tamanoMarcaPts);
    const escalaCaptura = Math.max(
      0.1,
      ((Math.hypot(tr!.x - tl!.x, tr!.y - tl!.y) + Math.hypot(br!.x - bl!.x, br!.y - bl!.y)) / 2) / pitchX,
      ((Math.hypot(bl!.x - tl!.x, bl!.y - tl!.y) + Math.hypot(br!.x - tr!.x, br!.y - tr!.y)) / 2) / pitchY
    );
    const radioHueco = fiducialDireccional
      ? Math.max(1.25, fiducialDireccional.radio * escalaCaptura)
      : 0;
    const limiteHueco = fiducialDireccional
      ? Math.ceil(tamanoMarcaPts * escalaCaptura * 0.65)
      : 0;
    let indiceFiducialDireccion = -1;
    let mejorCentroHueco: { x: number; y: number; score: number } | undefined;
    if (fiducialDireccional && modoMarcasPagina === 'cuadrados') {
      marcasDetectadas.forEach((marca, indice) => {
        if (!marca) return;
        for (let cy = -limiteHueco; cy <= limiteHueco; cy += 1) {
          for (let cx = -limiteHueco; cx <= limiteHueco; cx += 1) {
            const x = marca.x + cx;
            const y = marca.y + cy;
            const score = puntuarCentroVacioFiducial(gray, width, height, x, y, radioHueco);
            if (score > (mejorCentroHueco?.score ?? 0)) {
              mejorCentroHueco = { x, y, score };
              indiceFiducialDireccion = indice;
            }
          }
        }
      });
      if (indiceFiducialDireccion >= 0 && mejorCentroHueco) {
        marcasDetectadas[indiceFiducialDireccion] = { x: mejorCentroHueco.x, y: mejorCentroHueco.y };
      }
    }
    const orientacionFiducial = indiceFiducialDireccion < 0
      ? undefined
      : ([0, 90, 270, 180] as const)[indiceFiducialDireccion];
    const medioMarca = modoMarcasPagina === 'cuadrados'
      ? Math.max(0, tamanoMarcaPts / 2)
      : 0;
    const margenReferencia = margenMm * mmAPuntos + medioMarca;
    const origen = [
      { x: margenReferencia, y: margenReferencia },
      { x: anchoCarta - margenReferencia, y: margenReferencia },
      { x: margenReferencia, y: altoCarta - margenReferencia },
      { x: anchoCarta - margenReferencia, y: altoCarta - margenReferencia }
    ];
    const qrPattern = qr?.location ? undefined : detectarOrientacionPorPatronQr(
      gray,
      width,
      height,
      origen,
      marcasDetectadas,
      qrGeometry,
      altoCarta
    );
    const orientacionQr = qr?.location
      ? medirOrientacionReferenciaOmr(qr.location.topLeftCorner, qr.location.topRightCorner)
      : qrPattern?.accepted
        ? { orientacionGrados: qrPattern.orientacionGrados, inclinacionGrados: qrPattern.inclinacionGrados }
        : undefined;
    const bordeSuperiorFiducial = orientacionFiducial === 90
      ? [tr!, br!]
      : orientacionFiducial === 180
        ? [br!, bl!]
        : orientacionFiducial === 270
          ? [bl!, tl!]
          : orientacionFiducial === 0
            ? [tl!, tr!]
            : undefined;
    const orientacionDesdeFiducial = bordeSuperiorFiducial
      ? (() => {
          const opuestoSuperior = orientacionFiducial === 90
            ? [tl!, bl!]
            : orientacionFiducial === 180
              ? [tr!, tl!]
              : orientacionFiducial === 270
                ? [br!, tr!]
                : [bl!, br!];
          const medidas = [
            medirOrientacionReferenciaOmr(bordeSuperiorFiducial[0], bordeSuperiorFiducial[1]),
            medirOrientacionReferenciaOmr(opuestoSuperior[0], opuestoSuperior[1])
          ];
          return {
            orientacionGrados: medidas[0].orientacionGrados,
            inclinacionGrados: (medidas[0].inclinacionGrados + medidas[1].inclinacionGrados) / 2
          };
        })()
      : undefined;
    const orientacion = orientacionQr ?? orientacionDesdeFiducial;
    const conflictoOrientacion = Boolean(
      fiducialDireccional && orientacionQr && orientacionFiducial !== undefined &&
      orientacionFiducial !== orientacionQr.orientacionGrados
    );
    const fiducialRequeridoAusente = Boolean(fiducialDireccional && orientacionFiducial === undefined);
    const orientacionDeterminada = Boolean(orientacion) && !conflictoOrientacion && !fiducialRequeridoAusente;
    const orientacionGeometria = orientacion?.orientacionGrados ?? 0;
    const destino = orientacionGeometria === 90
      ? [tr, br, tl, bl]
      : orientacionGeometria === 180
        ? [br, bl, tr, tl]
        : orientacionGeometria === 270
          ? [bl, tl, br, tr]
          : [tl, tr, bl, br];
    const h = calcularHomografia(origen, destino);
    const calidad = puntuarMarcasPagina(destino, width, height);
    if (h && calidad >= 0.45) {
      // Las marcas repetidas y simetricas fijan la perspectiva, pero sin un
      // elemento direccional no distinguen por si solas 0° de 180°. No
      // publicar una orientacion inventada cuando el QR no se pudo leer.
      // Cuando la hoja completa es visible, las marcas de esquina fijan la
      // transformación en toda la página. Son preferibles a extrapolar una
      // homografía desde el QR, que solo ocupa una pequeña zona del encabezado
      // y puede amplificar ruido varios centímetros más abajo. El umbral 0.45
      // solo habilita la homografía como base; la política de confianza más
      // estricta decide después si se permite lectura directa o ajuste local.
      return {
        transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: altoCarta - punto.y }),
        tipo: 'homografia' as const,
        referenciaPagina: {
          tipo: 'marcas_esquina' as const,
          calidad,
          puntosDetectados: 4,
          ...(orientacionDeterminada && orientacion ? orientacion : {}),
          orientacionDeterminada,
          ...(qrPattern ? { confianzaOrientacion: qrPattern.score, margenOrientacion: qrPattern.margin } : {}),
          fuenteOrientacion: conflictoOrientacion || !orientacionDeterminada
            ? 'indeterminada' as const
            : qr?.location ? 'qr' as const : qrPattern?.accepted ? 'qr_patron_esperado' as const : 'fiducial_direccional' as const,
          conflictoOrientacion
        }
      };
    }
  }

  if (qr?.location) {
    const margen = margenMm * mmAPuntos;
    const qrMarginModules = qrGeometry?.marginModules ?? 0;
    const qrMatrixModules = qrGeometry?.matrixModules ?? 0;
    const hasQrModuleGeometry = qrMarginModules > 0 && qrMatrixModules > 0;
    const quietFraction = hasQrModuleGeometry
      ? qrMarginModules / (qrMatrixModules + qrMarginModules * 2)
      : 0;
    const matrixSizePts = hasQrModuleGeometry
      ? qrSizePts * (qrMatrixModules / (qrMatrixModules + qrMarginModules * 2))
      : qrSizePts;
    const x = (qrGeometry?.x ?? anchoCarta - margen - qrSizePts) + qrSizePts * quietFraction;
    // El mapa canónico persiste y desde el borde superior; la imagen también
    // se normaliza a ese sistema antes de aplicar la homografía.
    const y = qrGeometry
      ? qrGeometry.y > altoCarta / 2
        ? altoCarta - qrGeometry.y - qrSizePts
        : qrGeometry.y
      : margen;
    const origenX = x;
    const origenY = y + qrSizePts * quietFraction;
    const origen = [
      { x: origenX, y: origenY },
      { x: origenX + matrixSizePts, y: origenY },
      { x: origenX, y: origenY + matrixSizePts },
      { x: origenX + matrixSizePts, y: origenY + matrixSizePts }
    ];
    const destino = [
      qr.location.topLeftCorner,
      qr.location.topRightCorner,
      qr.location.bottomLeftCorner,
      qr.location.bottomRightCorner
    ];
    const h = calcularHomografia(origen, destino);
    if (h && (qr.calidadGeometrica ?? 0.78) >= 0.72) {
      const orientacion = medirOrientacionReferenciaOmr(qr.location.topLeftCorner, qr.location.topRightCorner);
      return {
        transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: altoCarta - punto.y }),
        tipo: 'qr' as const,
        referenciaPagina: {
          tipo: 'qr' as const,
          calidad: qr.calidadGeometrica ?? 0.78,
          puntosDetectados: 4,
          ...orientacion,
          orientacionDeterminada: true,
          fuenteOrientacion: 'qr' as const,
          conflictoOrientacion: false
        }
      };
    }
    advertencias.push('QR con calidad geometrica baja; se usa escala simple');
  }

  // Sin marcas completas ni QR confiable, se aproxima con escala simple para
  // conservar el diagnóstico y permitir que la política de calidad lo rechace.
  advertencias.push('No se detectaron referencias geometricas completas; usando escala simple');
  return {
    transformar: crearEscala(),
    tipo: 'escala' as const,
    referenciaPagina: {
      tipo: 'escala' as const,
      calidad: 0,
      puntosDetectados: 0,
      orientacionDeterminada: false,
      fuenteOrientacion: 'indeterminada' as const,
      conflictoOrientacion: false
    }
  };
}

export function detectarOpcion(
  gray: Uint8ClampedArray,
  integral: Uint32Array,
  width: number,
  height: number,
  centro: Punto,
  params: ParametrosBurbuja
) {
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const { radio, ringInner, ringOuter, outerOuter, paso } = params;
  const coreRadio = Math.max(2, radio * 0.58);
  const coreSq = coreRadio * coreRadio;
  // El muestreo general usa un paso proporcional al radio para ser barato,
  // pero un punto de lápiz puede ocupar solo 1--3 px y quedar entre muestras.
  // La micro-ROI central se recorre a paso unitario y se usa como evidencia
  // complementaria; no reemplaza la forma/anillo de la burbuja.
  const nucleoRadio = Math.max(1.25, Math.min(coreRadio * 0.55, radio * 0.24));
  const nucleoSq = nucleoRadio * nucleoRadio;
  const promLocal = mediaEnVentana(
    integral,
    width,
    height,
    centro.x - ringOuter,
    centro.y - ringOuter,
    centro.x + ringOuter,
    centro.y + ringOuter
  );
  const umbralBase = Math.max(40, Math.min(220, promLocal - 12));
  let pixeles = 0;
  let oscuros = 0;
  let pixelesCore = 0;
  let oscurosCore = 0;
  let pixelesMid = 0;
  let oscurosMid = 0;
  let pixelesRing = 0;
  let oscurosRing = 0;
  let suma = 0;
  let sumaCore = 0;
  let pixelesNucleo = 0;
  let sumaNucleo = 0;
  let sumaRing = 0;
  let pixelesOuter = 0;
  let sumaOuter = 0;
  let sumaOuterSq = 0;
  let masaTotal = 0;
  let masaRadial = 0;
  let masaX = 0;
  let masaY = 0;
  let masaXX = 0;
  let masaYY = 0;
  let masaXY = 0;
  let centroidOffsetRatio = 0;

  // Cuenta pixeles oscuros dentro de un radio fijo para estimar marca.
  for (let y = -outerOuter; y <= outerOuter; y += paso) {
    for (let x = -outerOuter; x <= outerOuter; x += paso) {
      const dist = x * x + y * y;
      if (dist > outerOuter * outerOuter) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      if (dist <= radio * radio) {
        pixeles += 1;
        suma += intensidad;
        if (dist <= coreSq) {
          pixelesCore += 1;
          sumaCore += intensidad;
        } else {
          pixelesMid += 1;
        }
      } else if (dist >= ringInner * ringInner) {
        if (dist <= ringOuter * ringOuter) {
          pixelesRing += 1;
          sumaRing += intensidad;
        } else {
          pixelesOuter += 1;
          sumaOuter += intensidad;
          sumaOuterSq += intensidad * intensidad;
        }
      }
    }
  }

  for (let y = -Math.ceil(nucleoRadio); y <= Math.ceil(nucleoRadio); y += 1) {
    for (let x = -Math.ceil(nucleoRadio); x <= Math.ceil(nucleoRadio); x += 1) {
      if (x * x + y * y > nucleoSq) continue;
      pixelesNucleo += 1;
      sumaNucleo += obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
    }
  }
  const promedio = suma / Math.max(1, pixeles);
  const promedioCore = sumaCore / Math.max(1, pixelesCore);
  const promedioNucleo = sumaNucleo / Math.max(1, pixelesNucleo);
  const promedioRing = sumaRing / Math.max(1, pixelesRing);
  const promedioOuter = sumaOuter / Math.max(1, pixelesOuter);
  const varOuter = Math.max(0, sumaOuterSq / Math.max(1, pixelesOuter) - promedioOuter * promedioOuter);
  const stdOuter = Math.sqrt(varOuter);
  const umbral = Math.max(35, Math.min(220, Math.min(umbralBase, promedioOuter - Math.max(8, stdOuter * 0.6))));

  let oscurosNucleo = 0;
  for (let y = -Math.ceil(nucleoRadio); y <= Math.ceil(nucleoRadio); y += 1) {
    for (let x = -Math.ceil(nucleoRadio); x <= Math.ceil(nucleoRadio); x += 1) {
      if (x * x + y * y > nucleoSq) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      if (intensidad < umbral) oscurosNucleo += 1;
    }
  }

  for (let y = -outerOuter; y <= outerOuter; y += paso) {
    for (let x = -outerOuter; x <= outerOuter; x += paso) {
      const dist = x * x + y * y;
      if (dist > outerOuter * outerOuter) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      if (dist <= radio * radio) {
        if (intensidad < umbral) {
          const oscuridad = Math.max(0, (umbral - intensidad) / Math.max(1, umbral));
          oscuros += 1;
          if (dist <= coreSq) oscurosCore += 1;
          else oscurosMid += 1;
          masaTotal += oscuridad;
          const radial = 1 - Math.sqrt(dist) / Math.max(1, radio);
          masaRadial += oscuridad * Math.max(0, radial);
          masaX += oscuridad * x;
          masaY += oscuridad * y;
          masaXX += oscuridad * x * x;
          masaYY += oscuridad * y * y;
          masaXY += oscuridad * x * y;
        }
      } else if (dist >= ringInner * ringInner && dist <= ringOuter * ringOuter) {
        if (intensidad < umbral) oscurosRing += 1;
      }
    }
  }

  const ratio = oscuros / Math.max(1, pixeles);
  const ratioCore = oscurosCore / Math.max(1, pixelesCore);
  const ratioMid = oscurosMid / Math.max(1, pixelesMid);
  const ratioRing = oscurosRing / Math.max(1, pixelesRing);
  const fillDelta = Math.max(0, (promedioRing - promedio) / 255);
  const nucleoFillRatio = oscurosNucleo / Math.max(1, pixelesNucleo);
  const nucleoDarknessDelta = Math.max(0, (promedioRing - promedioNucleo) / 255);
  const ringDelta = Math.max(0, (promedioOuter - promedioRing) / 255);
  const contraste = Math.max(0, (promedioOuter - promedio) / 255);
  const ringOnlyPenalty = Math.max(0, ratioRing - (ratioCore * 0.7 + ratioMid * 0.3));
  const radialMassRatio = masaRadial / Math.max(0.0001, masaTotal);
  let anisotropy = 1;
  if (masaTotal > 0.0001) {
    const mx = masaX / masaTotal;
    const my = masaY / masaTotal;
    centroidOffsetRatio = Math.hypot(mx, my) / Math.max(1, radio);
    const varX = Math.max(0, masaXX / masaTotal - mx * mx);
    const varY = Math.max(0, masaYY / masaTotal - my * my);
    const covXY = masaXY / masaTotal - mx * my;
    const trace = varX + varY;
    const det = Math.max(0, varX * varY - covXY * covXY);
    const disc = Math.sqrt(Math.max(0, trace * trace - 4 * det));
    const lambdaMax = Math.max(0.0001, (trace + disc) / 2);
    const lambdaMin = Math.max(0.0001, (trace - disc) / 2);
    anisotropy = lambdaMax / lambdaMin;
  }
  const radialPenalty = Math.max(0, 0.36 - radialMassRatio);
  const anisoPenalty = Math.max(0, (anisotropy - 2.8) / 4);
  const centroidPenalty = Math.max(0, centroidOffsetRatio - 0.22);
  const shapeCompactness = clamp01(
    (1 / Math.max(1, anisotropy)) * (1 - Math.min(0.6, centroidOffsetRatio))
  );
  const fillThreshold = Math.min(185, Math.max(60, promedioOuter - 18));
  const intensityFillRatio = clamp01((fillThreshold - promedio + 24) / 96);
  const intensityFillDelta = clamp01((promedioRing - promedio) / 90);
  const intensityCenterContrast = clamp01((promedioOuter - promedio) / 120);
  const intensityRingPenalty = clamp01((promedioOuter - promedioRing) / 110);
  const localBackgroundPenalty = clamp01((promLocal - promedioOuter) / 120);

  // Canal continuo para marcas muy tenues. La binarización puede quedar
  // dominada por el borde impreso de la burbuja y producir score=0 aunque el
  // núcleo conserve una diferencia medible frente al anillo exterior. Este
  // canal no reemplaza la forma binaria; solo aporta evidencia para un
  // rescate posterior con separación entre opciones.
  let masaSuave = 0;
  let masaSuaveX = 0;
  let masaSuaveY = 0;
  for (let y = -Math.ceil(coreRadio); y <= Math.ceil(coreRadio); y += 1) {
    for (let x = -Math.ceil(coreRadio); x <= Math.ceil(coreRadio); x += 1) {
      if (x * x + y * y > coreSq) continue;
      const intensidad = obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y);
      const peso = Math.max(0, promedioOuter - intensidad - 3);
      masaSuave += peso;
      masaSuaveX += peso * x;
      masaSuaveY += peso * y;
    }
  }
  const softCoreContrast = clamp01((promedioOuter - promedioCore) / 255);
  const softCentroidOffsetRatio = masaSuave > 0
    ? Math.hypot(masaSuaveX / masaSuave, masaSuaveY / masaSuave) / Math.max(1, coreRadio)
    : 1;

  // Los puntos pequeños pueden ocupar una fracción mínima del núcleo, aunque
  // formen un componente oscuro compacto. Medimos el mayor componente dentro
  // del núcleo (sin el anillo impreso); la decisión final además exige que
  // destaque frente a las otras opciones del reactivo.
  const componentRadius = Math.ceil(coreRadio);
  const componentSide = componentRadius * 2 + 1;
  const componentMask = new Uint8Array(componentSide * componentSide);
  let componentCorePixels = 0;
  for (let y = -componentRadius; y <= componentRadius; y += 1) {
    for (let x = -componentRadius; x <= componentRadius; x += 1) {
      if (x * x + y * y > coreSq) continue;
      componentCorePixels += 1;
      if (obtenerIntensidad(gray, width, height, centro.x + x, centro.y + y) < umbral) {
        componentMask[(y + componentRadius) * componentSide + x + componentRadius] = 1;
      }
    }
  }
  const componentQueue = new Int32Array(componentMask.length);
  let largestComponentPixels = 0;
  let largestComponentOffsetRatio = 1;
  let largestComponentDensity = 0;
  let largestComponentAspectRatio = Number.MAX_SAFE_INTEGER;
  for (let start = 0; start < componentMask.length; start += 1) {
    if (componentMask[start] !== 1) continue;
    componentMask[start] = 2;
    let head = 0;
    let tail = 1;
    componentQueue[0] = start;
    let sumX = 0;
    let sumY = 0;
    let minX = componentSide;
    let maxX = -1;
    let minY = componentSide;
    let maxY = -1;
    while (head < tail) {
      const index = componentQueue[head++]!;
      const x = index % componentSide - componentRadius;
      const y = Math.floor(index / componentSide) - componentRadius;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < -componentRadius || nx > componentRadius || ny < -componentRadius || ny > componentRadius) continue;
          const neighbor = (ny + componentRadius) * componentSide + nx + componentRadius;
          if (componentMask[neighbor] !== 1) continue;
          componentMask[neighbor] = 2;
          componentQueue[tail++] = neighbor;
        }
      }
    }
    if (tail <= largestComponentPixels) continue;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    largestComponentPixels = tail;
    largestComponentOffsetRatio = Math.hypot(sumX / tail, sumY / tail) / Math.max(1, radio);
    largestComponentDensity = tail / Math.max(1, boxWidth * boxHeight);
    largestComponentAspectRatio = Math.max(boxWidth, boxHeight) / Math.max(1, Math.min(boxWidth, boxHeight));
  }
  const largestComponentFillRatio = largestComponentPixels / Math.max(1, componentCorePixels);

  // Puntaje fotométrico robusto: prioriza núcleo/medio rellenos y penaliza burbuja hueca.
  const scoreLegacy =
    fillDelta * 0.42 +
    contraste * 0.16 +
    ratioCore * 0.38 +
    ratioMid * 0.18 +
    ratio * 0.06 +
    ringDelta * 0.06 +
    radialMassRatio * 0.12 -
    ratioRing * 0.16 -
    ringOnlyPenalty * 0.34 -
    radialPenalty * 0.22 -
    anisoPenalty * 0.18 -
    centroidPenalty * 0.24 -
    localBackgroundPenalty * 0.14;
  const scoreIntensity = clamp01(
    intensityFillDelta * 0.54 +
      intensityFillRatio * 0.24 +
      intensityCenterContrast * 0.24 -
      intensityRingPenalty * 0.18 -
      centroidPenalty * 0.2 -
      localBackgroundPenalty * 0.12
  );
  const score = scoreIntensity * 0.58 + clamp01(scoreLegacy) * 0.42;
  return {
    ratio,
    ratioCore,
    ratioMid,
    ratioRing,
    ringOnlyPenalty,
    radialMassRatio,
    anisotropy,
    centroidOffsetRatio,
    contraste,
    score,
    ringContrast: ringDelta,
    fillDelta,
    nucleoFillRatio,
    nucleoDarknessDelta,
    centerMean: promedio,
    softCoreContrast,
    softCentroidOffsetRatio,
    ringMean: promedioRing,
    outerMean: promedioOuter,
    shapeCompactness,
    largestComponentPixels,
    largestComponentFillRatio,
    largestComponentOffsetRatio,
    largestComponentDensity,
    largestComponentAspectRatio
  };
}

