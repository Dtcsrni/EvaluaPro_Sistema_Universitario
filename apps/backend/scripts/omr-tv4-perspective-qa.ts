/**
 * Verificacion de captura OMR con perspectiva proyectiva leve.
 *
 * Genera una deformacion controlada sobre capturas canonicas ya marcadas y
 * comprueba que la homografia de los fiduciales conserve cada centro OMR.
 * No sustituye una fotografia real de una hoja impresa.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analizarOmr } from '../src/modulos/modulo_escaneo_omr/servicioOmr.js';

type Punto = { x: number; y: number };
type Opcion = 'A' | 'B' | 'C' | 'D' | 'E';
type Capture = {
  captureId: string;
  imagePath: string;
  mapaOmrPath: string;
  folio: string;
  numeroPagina: number;
};
type MapaPagina = {
  numeroPagina: number;
  qr: { texto: string };
};
type GroundTruth = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: Opcion | null;
  markType: 'valid' | 'blank' | 'double' | 'smudge';
};

function resolverSistema(matriz: number[][], valores: number[]) {
  const n = valores.length;
  const aumentada = matriz.map((fila, indice) => [...fila, valores[indice]]);
  for (let columna = 0; columna < n; columna += 1) {
    let pivote = columna;
    for (let fila = columna + 1; fila < n; fila += 1) {
      if (Math.abs(aumentada[fila][columna]) > Math.abs(aumentada[pivote][columna])) pivote = fila;
    }
    if (Math.abs(aumentada[pivote][columna]) < 1e-8) return null;
    [aumentada[columna], aumentada[pivote]] = [aumentada[pivote], aumentada[columna]];
    const divisor = aumentada[columna][columna];
    for (let indice = columna; indice <= n; indice += 1) aumentada[columna][indice] /= divisor;
    for (let fila = 0; fila < n; fila += 1) {
      if (fila === columna) continue;
      const factor = aumentada[fila][columna];
      for (let indice = columna; indice <= n; indice += 1) aumentada[fila][indice] -= factor * aumentada[columna][indice];
    }
  }
  return aumentada.map((fila) => fila[n]);
}

function calcularHomografia(origen: Punto[], destino: Punto[]) {
  const matriz: number[][] = [];
  const valores: number[] = [];
  for (let indice = 0; indice < 4; indice += 1) {
    const source = origen[indice]!;
    const target = destino[indice]!;
    matriz.push([source.x, source.y, 1, 0, 0, 0, -target.x * source.x, -target.x * source.y]);
    valores.push(target.x);
    matriz.push([0, 0, 0, source.x, source.y, 1, -target.y * source.x, -target.y * source.y]);
    valores.push(target.y);
  }
  const solucion = resolverSistema(matriz, valores);
  if (!solucion) throw new Error('No se pudo calcular la homografia de perspectiva.');
  return [...solucion, 1];
}

function aplicarHomografia(h: number[], punto: Punto) {
  const denominador = h[6]! * punto.x + h[7]! * punto.y + 1;
  return {
    x: (h[0]! * punto.x + h[1]! * punto.y + h[2]!) / denominador,
    y: (h[3]! * punto.x + h[4]! * punto.y + h[5]!) / denominador
  };
}

async function deformarPerspectiva(buffer: Buffer, destino: Punto[]) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const origen = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 }
  ];
  const inversa = calcularHomografia(destino, origen);
  const salida = Buffer.alloc(width * height * 3, 255);
  const leer = (x: number, y: number, canal: number) => data[(y * width + x) * 3 + canal] ?? 255;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = aplicarHomografia(inversa, { x: x + 0.5, y: y + 0.5 });
      if (source.x < 0 || source.y < 0 || source.x >= width - 1 || source.y >= height - 1) continue;
      const x0 = Math.floor(source.x);
      const y0 = Math.floor(source.y);
      const dx = source.x - x0;
      const dy = source.y - y0;
      const offset = (y * width + x) * 3;
      for (let canal = 0; canal < 3; canal += 1) {
        const superior = leer(x0, y0, canal) * (1 - dx) + leer(x0 + 1, y0, canal) * dx;
        const inferior = leer(x0, y0 + 1, canal) * (1 - dx) + leer(x0 + 1, y0 + 1, canal) * dx;
        salida[offset + canal] = Math.round(superior * (1 - dy) + inferior * dy);
      }
    }
  }

  return sharp(salida, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
}

async function leerGroundTruth(ruta: string) {
  return (await fs.readFile(ruta, 'utf8'))
    .split(/\r?\n/g)
    .filter(Boolean)
    .map((linea) => JSON.parse(linea) as GroundTruth);
}

async function main() {
  const datasetRoot = path.resolve(process.cwd(), '../..', 'omr_samples_tv4');
  const manifest = JSON.parse(await fs.readFile(path.join(datasetRoot, 'manifest.json'), 'utf8')) as { capturas: Capture[] };
  const captures = manifest.capturas.filter((capture) => capture.numeroPagina === 1).slice(0, 6);
  const truth = (await leerGroundTruth(path.join(datasetRoot, 'ground_truth.jsonl'))).filter((row) =>
    captures.some((capture) => capture.captureId === row.captureId)
  );
  const truthByCapture = new Map<string, GroundTruth[]>();
  for (const row of truth) {
    const rows = truthByCapture.get(row.captureId) ?? [];
    rows.push(row);
    truthByCapture.set(row.captureId, rows);
  }

  let total = 0;
  let correct = 0;
  let mismatches = 0;
  let invalid = 0;
  let invalidRejected = 0;
  const perCapture: Array<{
    captureId: string;
    mismatches: number;
    estadoAnalisis: string;
    detalles: Array<{ numeroPregunta: number; esperado: Opcion | null; detectado: Opcion | null; markType: GroundTruth['markType'] }>;
  }> = [];

  for (let indice = 0; indice < captures.length; indice += 1) {
    const capture = captures[indice]!;
    const image = await fs.readFile(path.join(datasetRoot, capture.imagePath));
    const metadata = await sharp(image).metadata();
    const width = Number(metadata.width ?? 1224);
    const height = Number(metadata.height ?? 1584);
    const variacion = indice % 3;
    const destino: Punto[] = [
      { x: 12 + variacion * 5, y: 10 },
      { x: width - 20 - variacion * 7, y: 4 + (indice % 2) * 12 },
      { x: width - 8, y: height - 16 - variacion * 8 },
      { x: 4 + (indice % 2) * 8, y: height - 5 }
    ];
    const warped = await deformarPerspectiva(image, destino);
    const mapa = JSON.parse(await fs.readFile(path.join(datasetRoot, capture.mapaOmrPath), 'utf8')) as MapaPagina;
    const resultado = await analizarOmr(
      `data:image/jpeg;base64,${warped.toString('base64')}`,
      mapa as never,
      mapa.qr.texto,
      10,
      { folio: capture.folio, numeroPagina: capture.numeroPagina, templateVersionDetectada: 4 },
      capture.captureId
    );
    const detectadas = new Map(resultado.respuestasDetectadas.map((respuesta) => [respuesta.numeroPregunta, respuesta.opcion]));
    let captureMismatches = 0;
    const detalles: Array<{ numeroPregunta: number; esperado: Opcion | null; detectado: Opcion | null; markType: GroundTruth['markType'] }> = [];
    for (const row of truthByCapture.get(capture.captureId) ?? []) {
      total += 1;
      const detectada = detectadas.get(row.numeroPregunta) ?? null;
      const coincide = row.markType === 'valid' ? detectada === row.opcionEsperada : detectada === null;
      if (coincide) correct += 1;
      else {
        mismatches += 1;
        captureMismatches += 1;
        detalles.push({ numeroPregunta: row.numeroPregunta, esperado: row.opcionEsperada, detectado: detectada, markType: row.markType });
      }
      if (row.markType === 'double' || row.markType === 'smudge') {
        invalid += 1;
        if (detectada === null) invalidRejected += 1;
      }
    }
    perCapture.push({ captureId: capture.captureId, mismatches: captureMismatches, estadoAnalisis: resultado.estadoAnalisis, detalles });
  }

  const report = {
    ok: captures.length > 0 && mismatches === 0,
    totalCapturas: captures.length,
    totalPreguntas: total,
    exactitud: total > 0 ? Number((correct / total).toFixed(6)) : 0,
    invalidasRechazadas: invalid > 0 ? Number((invalidRejected / invalid).toFixed(6)) : 1,
    perCapture
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
