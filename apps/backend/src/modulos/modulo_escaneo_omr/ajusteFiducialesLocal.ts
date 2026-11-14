export type PuntoFiducialLocal = { x: number; y: number };
export type ParFiducialLocal = { esperado: PuntoFiducialLocal; detectado: PuntoFiducialLocal };

export type AjusteFiducialLocal = {
  transformar: (punto: PuntoFiducialLocal) => PuntoFiducialLocal;
  errorPx: number;
  inliers: number;
    modelo: 'afin' | 'escala_traslacion';
};

function distancia(a: PuntoFiducialLocal, b: PuntoFiducialLocal) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolverSistema3(matriz: number[][], vector: number[]): [number, number, number] | null {
  const a = matriz.map((fila, i) => [...fila, vector[i] ?? 0]);
  for (let columna = 0; columna < 3; columna += 1) {
    let pivote = columna;
    for (let fila = columna + 1; fila < 3; fila += 1) {
      if (Math.abs(a[fila]![columna]!) > Math.abs(a[pivote]![columna]!)) pivote = fila;
    }
    if (Math.abs(a[pivote]![columna]!) < 1e-8) return null;
    [a[columna], a[pivote]] = [a[pivote]!, a[columna]!];
    const divisor = a[columna]![columna]!;
    for (let j = columna; j < 4; j += 1) a[columna]![j] = a[columna]![j]! / divisor;
    for (let fila = 0; fila < 3; fila += 1) {
      if (fila === columna) continue;
      const factor = a[fila]![columna]!;
      for (let j = columna; j < 4; j += 1) a[fila]![j] = a[fila]![j]! - factor * a[columna]![j]!;
    }
  }
  return [a[0]![3]!, a[1]![3]!, a[2]![3]!];
}

function ajustarAfin(pares: readonly ParFiducialLocal[]): AjusteFiducialLocal | null {
  if (pares.length < 3) return null;
  const sxx = pares.reduce((s, p) => s + p.esperado.x ** 2, 0);
  const syy = pares.reduce((s, p) => s + p.esperado.y ** 2, 0);
  const sxy = pares.reduce((s, p) => s + p.esperado.x * p.esperado.y, 0);
  const sx = pares.reduce((s, p) => s + p.esperado.x, 0);
  const sy = pares.reduce((s, p) => s + p.esperado.y, 0);
  const n = pares.length;
  const normal = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const xCoef = resolverSistema3(normal, [
    pares.reduce((s, p) => s + p.esperado.x * p.detectado.x, 0),
    pares.reduce((s, p) => s + p.esperado.y * p.detectado.x, 0),
    pares.reduce((s, p) => s + p.detectado.x, 0)
  ]);
  const yCoef = resolverSistema3(normal, [
    pares.reduce((s, p) => s + p.esperado.x * p.detectado.y, 0),
    pares.reduce((s, p) => s + p.esperado.y * p.detectado.y, 0),
    pares.reduce((s, p) => s + p.detectado.y, 0)
  ]);
  if (!xCoef || !yCoef) return null;
  const transformar = (p: PuntoFiducialLocal): PuntoFiducialLocal => ({
    x: xCoef[0] * p.x + xCoef[1] * p.y + xCoef[2],
    y: yCoef[0] * p.x + yCoef[1] * p.y + yCoef[2]
  });
  return {
    transformar,
    errorPx: Math.sqrt(pares.reduce((s, par) => s + distancia(transformar(par.esperado), par.detectado) ** 2, 0) / n),
    inliers: n,
    modelo: 'afin'
  };
}

function transformarDesdeTriangulo(pares: readonly ParFiducialLocal[]): ((punto: PuntoFiducialLocal) => PuntoFiducialLocal) | null {
  const [a, b, c] = pares;
  if (!a || !b || !c) return null;
  const ux = b.esperado.x - a.esperado.x;
  const uy = b.esperado.y - a.esperado.y;
  const vx = c.esperado.x - a.esperado.x;
  const vy = c.esperado.y - a.esperado.y;
  const det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-3) return null;
  return (p: PuntoFiducialLocal) => {
    const px = p.x - a.esperado.x;
    const py = p.y - a.esperado.y;
    const alpha = (px * vy - py * vx) / det;
    const beta = (ux * py - uy * px) / det;
    return {
      x: a.detectado.x + alpha * (b.detectado.x - a.detectado.x) + beta * (c.detectado.x - a.detectado.x),
      y: a.detectado.y + alpha * (b.detectado.y - a.detectado.y) + beta * (c.detectado.y - a.detectado.y)
    };
  };
}

/** Busca consenso entre triángulos y refina con mínimos cuadrados sobre todos los inliers. */
export function ajustarFiducialesAfinRobusto(
  pares: readonly ParFiducialLocal[],
  toleranciaPx: number
): AjusteFiducialLocal | null {
  if (pares.length < 3 || !Number.isFinite(toleranciaPx) || toleranciaPx <= 0) return null;
  let mejor: { inliers: ParFiducialLocal[]; error: number } | null = null;
  for (let i = 0; i < pares.length - 2; i += 1) {
    for (let j = i + 1; j < pares.length - 1; j += 1) {
      for (let k = j + 1; k < pares.length; k += 1) {
        const transformar = transformarDesdeTriangulo([pares[i]!, pares[j]!, pares[k]!]);
        if (!transformar) continue;
        const inliers = pares.filter((par) => distancia(transformar(par.esperado), par.detectado) <= toleranciaPx);
        if (inliers.length < 3) continue;
        const error = Math.sqrt(inliers.reduce((s, par) => s + distancia(transformar(par.esperado), par.detectado) ** 2, 0) / inliers.length);
        if (!mejor || inliers.length > mejor.inliers.length || (inliers.length === mejor.inliers.length && error < mejor.error)) {
          mejor = { inliers, error };
        }
      }
    }
  }
  if (!mejor) return null;
  const refinado = ajustarAfin(mejor.inliers);
  if (!refinado) return null;
  const inliersFinales = pares.filter((par) => distancia(refinado.transformar(par.esperado), par.detectado) <= toleranciaPx);
  if (inliersFinales.length < 3) return null;
  const final = ajustarAfin(inliersFinales);
  if (!final) return null;
  const errorPx = Math.sqrt(inliersFinales.reduce((s, par) => s + distancia(final.transformar(par.esperado), par.detectado) ** 2, 0) / inliersFinales.length);
  return { ...final, errorPx, inliers: inliersFinales.length };
}

/** Ajuste restringido para dos o más anclas cuando no hay geometría afín observable. */
export function ajustarFiducialesEscalaTraslacion(
  pares: readonly ParFiducialLocal[],
  toleranciaPx: number,
  escalaMinima = 0.85,
  escalaMaxima = 1.15
): AjusteFiducialLocal | null {
  if (pares.length < 2) return null;
  const ajustarEje = (eje: 'x' | 'y') => {
    const mediaX = pares.reduce((s, p) => s + p.esperado[eje], 0) / pares.length;
    const mediaY = pares.reduce((s, p) => s + p.detectado[eje], 0) / pares.length;
    const varianza = pares.reduce((s, p) => s + (p.esperado[eje] - mediaX) ** 2, 0);
    if (varianza < 1e-6) return { escala: 1, offset: mediaY - mediaX };
    const covarianza = pares.reduce((s, p) => s + (p.esperado[eje] - mediaX) * (p.detectado[eje] - mediaY), 0);
    const escala = covarianza / varianza;
    return { escala, offset: mediaY - escala * mediaX };
  };
  const x = ajustarEje('x');
  const y = ajustarEje('y');
  if (![x.escala, y.escala, x.offset, y.offset].every(Number.isFinite) ||
      x.escala < escalaMinima || x.escala > escalaMaxima || y.escala < escalaMinima || y.escala > escalaMaxima) return null;
  const transformar = (p: PuntoFiducialLocal): PuntoFiducialLocal => ({ x: p.x * x.escala + x.offset, y: p.y * y.escala + y.offset });
  const errorPx = Math.sqrt(pares.reduce((s, par) => s + distancia(transformar(par.esperado), par.detectado) ** 2, 0) / pares.length);
  if (!Number.isFinite(errorPx) || errorPx > toleranciaPx) return null;
  return { transformar, errorPx, inliers: pares.length, modelo: 'escala_traslacion' };
}
