/**
 * Nucleo de procesamiento de imagen del motor OMR canonico.
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
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
  calidadGeometrica?: number;
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
  opciones: { qrSizePtsHint?: number; qrSizePts: number; anchoCarta: number }
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
  }
  return mejorCandidato?.detalle ?? null;
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
  esquina: 'tl' | 'tr' | 'bl' | 'br',
  modo: 'lineas' | 'cuadrados' | 'auto' = 'auto',
  tamanoPts = 0,
  anchoCarta = 612,
  margenPts = 0
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
    const radio = Math.max(18, tamanoPx * 1.6);
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
        // Un fiducial sólido ocupa de forma uniforme la ventana; un QR solo
        // produce módulos negros alternados y una varianza mucho mayor.
        const score = densidad * 0.82 + uniformidad * 0.18 - distanciaNominal * 0.035;
        if (!mejor || score > mejor.score) mejor = { x, y, score };
      }
    }
    if (mejor && mejor.score >= 0.68) {
      return { x: mejor.x, y: mejor.y };
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
  const distanciaMaxima = Math.max(24, Math.min(width, height) * 0.15);
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
    };
    marcasPagina?: {
      tipo?: 'lineas' | 'cuadrados';
      size?: number;
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

  const region = 0.15;
  const regiones = {
    tl: { x0: 0, y0: 0, x1: width * region, y1: height * region },
    tr: { x0: width * (1 - region), y0: 0, x1: width, y1: height * region },
    bl: { x0: 0, y0: height * (1 - region), x1: width * region, y1: height },
    br: { x0: width * (1 - region), y0: height * (1 - region), x1: width, y1: height }
  };

  const tamanoMarcaPts = opciones?.marcasPagina?.size ?? 0;
  const margenPts = margenMm * mmAPuntos;
  const tl = detectarMarca(gray, width, height, regiones.tl, 'tl', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts);
  const tr = detectarMarca(gray, width, height, regiones.tr, 'tr', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts);
  const bl = detectarMarca(gray, width, height, regiones.bl, 'bl', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts);
  const br = detectarMarca(gray, width, height, regiones.br, 'br', modoMarcasPagina, tamanoMarcaPts, anchoCarta, margenPts);

  if (tl && tr && bl && br) {
    const destino = [tl, tr, bl, br];
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
    const h = calcularHomografia(origen, destino);
    const calidad = puntuarMarcasPagina(destino, width, height);
    if (h && calidad >= 0.45) {
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
          puntosDetectados: 4
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
      return {
        transformar: (punto: Punto) => aplicarHomografia(h, { x: punto.x, y: altoCarta - punto.y }),
        tipo: 'qr' as const,
        referenciaPagina: {
          tipo: 'qr' as const,
          calidad: qr.calidadGeometrica ?? 0.78,
          puntosDetectados: 4
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
    referenciaPagina: { tipo: 'escala' as const, calidad: 0, puntosDetectados: 0 }
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

