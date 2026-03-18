import jsQR from 'jsqr';

export type Punto = { x: number; y: number };

export type QrDetalle = {
  data: string;
  location: {
    topLeftCorner: Punto;
    topRightCorner: Punto;
    bottomRightCorner: Punto;
    bottomLeftCorner: Punto;
  };
};

export type ParametrosBurbuja = {
  radio: number;
  ringInner: number;
  ringOuter: number;
  outerOuter: number;
  paso: number;
};

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
    }
  };
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
  opciones: { qrSizePtsHint?: number; qrSizePtsV1: number; qrSizePtsV2: number; anchoCarta: number }
): QrDetalle | null {
  const qrSizePtsHint = opciones.qrSizePtsHint ?? opciones.qrSizePtsV1;
  const intentos: Array<{ data: Uint8ClampedArray; width: number; height: number; offsetX: number; offsetY: number }> = [];

  intentos.push({ data, width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height), width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height, 160), width, height, offsetX: 0, offsetY: 0 });
  intentos.push({ data: rgbaDesdeGray(gray, width, height, 160, true), width, height, offsetX: 0, offsetY: 0 });

  const cropBase = {
    left: Math.floor(width * 0.6),
    top: 0,
    width: Math.floor(width * 0.4),
    height: Math.floor(height * 0.35)
  };
  const cropRaw = extraerSubimagenRgba(data, width, height, cropBase);
  intentos.push({ data: cropRaw.data, width: cropRaw.width, height: cropRaw.height, offsetX: cropBase.left, offsetY: cropBase.top });
  const cropGray = extraerSubimagenGray(gray, width, height, cropBase);
  intentos.push({
    data: rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, 160),
    width: cropGray.width,
    height: cropGray.height,
    offsetX: cropBase.left,
    offsetY: cropBase.top
  });
  intentos.push({
    data: rgbaDesdeGray(cropGray.gray, cropGray.width, cropGray.height, 160, true),
    width: cropGray.width,
    height: cropGray.height,
    offsetX: cropBase.left,
    offsetY: cropBase.top
  });

  const tamañosQrPts = Array.from(new Set([qrSizePtsHint, opciones.qrSizePtsV1, opciones.qrSizePtsV2]));
  for (const qrPts of tamañosQrPts) {
    const expectedQr = Math.max(80, Math.round((qrPts / opciones.anchoCarta) * width));
    const region = localizarQrRegion(gray, width, height, cropBase, expectedQr);
    if (!region) continue;
    const regionRaw = extraerSubimagenRgba(data, width, height, region);
    intentos.push({
      data: regionRaw.data,
      width: regionRaw.width,
      height: regionRaw.height,
      offsetX: region.left,
      offsetY: region.top
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

  for (const intento of intentos) {
    const res = detectarQrDetalle(intento.data, intento.width, intento.height);
    if (!res) continue;
    const map = (p: Punto) => ({ x: p.x + intento.offsetX, y: p.y + intento.offsetY });
    return {
      data: res.data,
      location: {
        topLeftCorner: map(res.location.topLeftCorner),
        topRightCorner: map(res.location.topRightCorner),
        bottomRightCorner: map(res.location.bottomRightCorner),
        bottomLeftCorner: map(res.location.bottomLeftCorner)
      }
    };
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

function detectarMarca(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  esquina: 'tl' | 'tr' | 'bl' | 'br'
) {
  const paso = 2;
  let sumaX = 0;
  let sumaY = 0;
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

  for (let y = region.y0; y < region.y1; y += paso) {
    for (let x = region.x0; x < region.x1; x += paso) {
      const intensidad = obtenerIntensidad(gray, width, height, x, y);
      if (intensidad < umbral) {
        sumaX += x;
        sumaY += y;
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
  const distanciaMaxima = Math.max(18, Math.min(width, height) * 0.12);
  if (distanciaMin > distanciaMaxima) {
    return null;
  }
  const limite = Math.max(8, Math.floor(candidatos.length * 0.15));
  let accX = 0;
  let accY = 0;
  for (let i = 0; i < Math.min(limite, candidatos.length); i += 1) {
    accX += candidatos[i].x;
    accY += candidatos[i].y;
  }
  const x = accX / Math.max(1, Math.min(limite, candidatos.length));
  const y = accY / Math.max(1, Math.min(limite, candidatos.length));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: sumaX / conteo, y: sumaY / conteo };
  }
  return { x, y };
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

export function obtenerTransformacion(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  advertencias: string[],
  qr?: QrDetalle | null,
  opciones?: { margenMm: number; qrSizePts: number; anchoCarta: number; altoCarta: number; mmAPuntos: number }
) {
  const margenMm = opciones?.margenMm ?? 10;
  const qrSizePts = opciones?.qrSizePts ?? 68;
  const anchoCarta = opciones?.anchoCarta ?? 612;
  const altoCarta = opciones?.altoCarta ?? 792;
  const mmAPuntos = opciones?.mmAPuntos ?? (72 / 25.4);
  const crearEscala = () => {
    const escalaX = width / anchoCarta;
    const escalaY = height / altoCarta;
    return (punto: Punto) => ({ x: punto.x * escalaX, y: height - punto.y * escalaY });
  };

  if (qr?.location) {
    const margen = margenMm * mmAPuntos;
    const x = anchoCarta - margen - qrSizePts;
    const y = margen;
    const origen = [
      { x, y },
      { x: x + qrSizePts, y },
      { x, y: y + qrSizePts },
      { x: x + qrSizePts, y: y + qrSizePts }
    ];
    const destino = [
      qr.location.topLeftCorner,
      qr.location.topRightCorner,
      qr.location.bottomLeftCorner,
      qr.location.bottomRightCorner
    ];
    const h = calcularHomografia(origen, destino);
    if (h) {
      return {
        transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: altoCarta - punto.y }),
        tipo: 'qr' as const
      };
    }
  }
  const region = 0.15;
  const regiones = {
    tl: { x0: 0, y0: 0, x1: width * region, y1: height * region },
    tr: { x0: width * (1 - region), y0: 0, x1: width, y1: height * region },
    bl: { x0: 0, y0: height * (1 - region), x1: width * region, y1: height },
    br: { x0: width * (1 - region), y0: height * (1 - region), x1: width, y1: height }
  };

  const tl = detectarMarca(gray, width, height, regiones.tl, 'tl');
  const tr = detectarMarca(gray, width, height, regiones.tr, 'tr');
  const bl = detectarMarca(gray, width, height, regiones.bl, 'bl');
  const br = detectarMarca(gray, width, height, regiones.br, 'br');

  if (!tl || !tr || !bl || !br) {
    // Sin marcas completas, se aproxima con escala simple para no bloquear el flujo.
    advertencias.push('No se detectaron todas las marcas de registro; usando escala simple');
    return { transformar: crearEscala(), tipo: 'escala' as const };
  }
  const margenMax = 0.2;
  const dentro = (p: Punto, esquina: 'tl' | 'tr' | 'bl' | 'br') =>
    (esquina === 'tl' && p.x < width * margenMax && p.y < height * margenMax) ||
    (esquina === 'tr' && p.x > width * (1 - margenMax) && p.y < height * margenMax) ||
    (esquina === 'bl' && p.x < width * margenMax && p.y > height * (1 - margenMax)) ||
    (esquina === 'br' && p.x > width * (1 - margenMax) && p.y > height * (1 - margenMax));

  if (!dentro(tl, 'tl') || !dentro(tr, 'tr') || !dentro(bl, 'bl') || !dentro(br, 'br')) {
    advertencias.push('Marcas de registro fuera de esquina; usando escala simple');
    return { transformar: crearEscala(), tipo: 'escala' as const };
  }

  const margen = margenMm * mmAPuntos;
  const origen = [
    { x: margen, y: margen },
    { x: anchoCarta - margen, y: margen },
    { x: margen, y: altoCarta - margen },
    { x: anchoCarta - margen, y: altoCarta - margen }
  ];
  const destino = [tl, tr, bl, br];
  const h = calcularHomografia(origen, destino);

  if (!h) {
    advertencias.push('No se pudo calcular homografia; usando escala simple');
    return { transformar: crearEscala(), tipo: 'escala' as const };
  }

  return {
    transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: altoCarta - punto.y }),
    tipo: 'homografia' as const
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

  const promedio = suma / Math.max(1, pixeles);
  const promedioRing = sumaRing / Math.max(1, pixelesRing);
  const promedioOuter = sumaOuter / Math.max(1, pixelesOuter);
  const varOuter = Math.max(0, sumaOuterSq / Math.max(1, pixelesOuter) - promedioOuter * promedioOuter);
  const stdOuter = Math.sqrt(varOuter);
  const umbral = Math.max(35, Math.min(220, Math.min(umbralBase, promedioOuter - Math.max(8, stdOuter * 0.6))));

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
  const fillThreshold = Math.min(185, Math.max(60, promedioOuter - 18));
  const intensityFillRatio = clamp01((fillThreshold - promedio + 24) / 96);
  const intensityFillDelta = clamp01((promedioRing - promedio) / 90);
  const intensityCenterContrast = clamp01((promedioOuter - promedio) / 120);
  const intensityRingPenalty = clamp01((promedioOuter - promedioRing) / 110);
  const localBackgroundPenalty = clamp01((promLocal - promedioOuter) / 120);

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
    centerMean: promedio,
    ringMean: promedioRing,
    outerMean: promedioOuter
  };
}

