/**
 * QA controlada de capturas OMR con degradacion fotografica leve.
 *
 * Combina perspectiva, iluminacion no uniforme, compresion JPEG, desenfoque
 * y una reduccion moderada de resolucion. Es evidencia sintetica de robustez
 * del detector; no sustituye fotografias de hojas impresas.
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
type GroundTruth = {
  captureId: string;
  numeroPregunta: number;
  opcionEsperada: Opcion | null;
  markType: 'valid' | 'blank' | 'double' | 'smudge';
};
type PerfilCamara = {
  nombre: string;
  brightness: number;
  contrast: number;
  vignette: number;
  noise: number;
  blur: number;
  quality: number;
  resizeWidth?: number;
};

const perfilesCamara: PerfilCamara[] = [
  { nombre: 'luz-frontal', brightness: 1.04, contrast: 1, vignette: 0, noise: 0.5, blur: 0, quality: 90 },
  { nombre: 'contraluz-leve', brightness: 0.9, contrast: 0.96, vignette: 0.08, noise: 0.8, blur: 0.3, quality: 84 },
  { nombre: 'iluminacion-lateral', brightness: 1, contrast: 1.02, vignette: 0.14, noise: 1.1, blur: 0.35, quality: 80 },
  { nombre: 'compresion-movil', brightness: 1, contrast: 0.98, vignette: 0.08, noise: 1.2, blur: 0.4, quality: 72 },
  { nombre: 'resolucion-reducida', brightness: 0.96, contrast: 0.98, vignette: 0.1, noise: 1.4, blur: 0.4, quality: 76, resizeWidth: 1024 },
  { nombre: 'captura-dificil-leve', brightness: 0.88, contrast: 0.94, vignette: 0.18, noise: 1.7, blur: 0.6, quality: 68, resizeWidth: 960 }
];

function resolverSistema(matriz: number[][], valores: number[]) {
  const n = valores.length;
  const aumentada = matriz.map((fila, indice) => [...fila, valores[indice]]);
  for (let columna = 0; columna < n; columna += 1) {
    let pivote = columna;
    for (let fila = columna + 1; fila < n; fila += 1) {
      if (Math.abs(aumentada[fila]![columna]!) > Math.abs(aumentada[pivote]![columna]!)) pivote = fila;
    }
    if (Math.abs(aumentada[pivote]![columna]!) < 1e-8) return null;
    [aumentada[columna], aumentada[pivote]] = [aumentada[pivote]!, aumentada[columna]!];
    const divisor = aumentada[columna]![columna]!;
    for (let indice = columna; indice <= n; indice += 1) aumentada[columna]![indice]! /= divisor;
    for (let fila = 0; fila < n; fila += 1) {
      if (fila === columna) continue;
      const factor = aumentada[fila]![columna]!;
      for (let indice = columna; indice <= n; indice += 1) {
        aumentada[fila]![indice]! -= factor * aumentada[columna]![indice]!;
      }
    }
  }
  return aumentada.map((fila) => fila[n]!);
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
  if (!solucion) throw new Error('No se pudo calcular la homografia de camara.');
  return [...solucion, 1];
}

function aplicarHomografia(h: number[], punto: Punto) {
  const denominador = h[6]! * punto.x + h[7]! * punto.y + 1;
  return {
    x: (h[0]! * punto.x + h[1]! * punto.y + h[2]!) / denominador,
    y: (h[3]! * punto.x + h[4]! * punto.y + h[5]!) / denominador
  };
}

async function deformarPerspectiva(buffer: Buffer, indice: number) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const variacion = indice % 3;
  const destino: Punto[] = [
    { x: 12 + variacion * 5, y: 10 },
    { x: width - 20 - variacion * 7, y: 4 + (indice % 2) * 12 },
    { x: width - 8, y: height - 16 - variacion * 8 },
    { x: 4 + (indice % 2) * 8, y: height - 5 }
  ];
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
  return sharp(salida, { raw: { width, height, channels: 3 } }).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toBuffer();
}

async function degradarCaptura(buffer: Buffer, perfil: PerfilCamara, indice: number) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const salida = Buffer.alloc(data.length);
  const centroX = (info.width - 1) / 2;
  const centroY = (info.height - 1) / 2;
  const maxDistancia = Math.hypot(centroX, centroY);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const distancia = Math.hypot(x - centroX, y - centroY) / maxDistancia;
      const iluminacion = perfil.brightness * (1 - perfil.vignette * distancia * distancia);
      const ruidoDeterminista = Math.sin((x + 17 * indice) * 0.071 + y * 0.043) * perfil.noise;
      const offset = (y * info.width + x) * 3;
      for (let canal = 0; canal < 3; canal += 1) {
        const contraste = ((data[offset + canal] ?? 255) - 128) * perfil.contrast + 128;
        salida[offset + canal] = Math.max(0, Math.min(255, Math.round(contraste * iluminacion + ruidoDeterminista)));
      }
    }
  }
  let pipeline = sharp(salida, { raw: { width: info.width, height: info.height, channels: 3 } });
  if (perfil.resizeWidth) pipeline = pipeline.resize({ width: perfil.resizeWidth, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 });
  if (perfil.blur > 0) pipeline = pipeline.blur(perfil.blur);
  return pipeline.jpeg({ quality: perfil.quality, chromaSubsampling: '4:2:0' }).toBuffer();
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
  const requestedCaptureId = String(process.env.OMR_CAMERA_CAPTURE_ID || '').trim();
  const requestedProfile = String(process.env.OMR_CAMERA_PROFILE || '').trim();
  const captures = manifest.capturas
    .filter((capture) => capture.numeroPagina === 1)
    .filter((capture) => !requestedCaptureId || capture.captureId === requestedCaptureId)
    .slice(0, 6);
  // Conserva el índice original: la degradación sintética usa ese índice para
  // generar ruido determinista, por lo que filtrar primero no debe cambiar la
  // imagen que se está auditando.
  const perfilesActivos = perfilesCamara
    .map((perfil, indicePerfil) => ({ perfil, indicePerfil }))
    .filter(({ perfil }) => !requestedProfile || perfil.nombre === requestedProfile);
  const truth = (await leerGroundTruth(path.join(datasetRoot, 'ground_truth.jsonl'))).filter((row) =>
    captures.some((capture) => capture.captureId === row.captureId)
  );
  const truthByCapture = new Map<string, GroundTruth[]>();
  for (const row of truth) truthByCapture.set(row.captureId, [...(truthByCapture.get(row.captureId) ?? []), row]);

  let total = 0;
  let correct = 0;
  let invalid = 0;
  let invalidRejected = 0;
  const perCapture: Array<{
    captureId: string;
    perfil: string;
    mismatches: number;
    estadoAnalisis: string;
    detalles: Array<{ numeroPregunta: number; esperado: Opcion | null; detectado: Opcion | null; markType: GroundTruth['markType'] }>;
  }> = [];

  for (let indice = 0; indice < captures.length; indice += 1) {
    const capture = captures[indice]!;
    const indiceCaptura = manifest.capturas.findIndex(
      (item) => item.captureId === capture.captureId && item.numeroPagina === capture.numeroPagina
    );
    const original = await fs.readFile(path.join(datasetRoot, capture.imagePath));
    const warped = await deformarPerspectiva(original, Math.max(0, indiceCaptura));
    const mapa = JSON.parse(await fs.readFile(path.join(datasetRoot, capture.mapaOmrPath), 'utf8')) as { qr: { texto: string } };
    for (const { perfil, indicePerfil } of perfilesActivos) {
      const image = await degradarCaptura(warped, perfil, indicePerfil + Math.max(0, indiceCaptura));
      const resultado = await analizarOmr(
        `data:image/jpeg;base64,${image.toString('base64')}`,
        mapa as never,
        mapa.qr.texto,
        10,
        { folio: capture.folio, numeroPagina: capture.numeroPagina, templateVersionDetectada: 4 },
        `${capture.captureId}-${perfil.nombre}`
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
          captureMismatches += 1;
          detalles.push({ numeroPregunta: row.numeroPregunta, esperado: row.opcionEsperada, detectado: detectada, markType: row.markType });
        }
        if (row.markType === 'double' || row.markType === 'smudge') {
          invalid += 1;
          if (detectada === null) invalidRejected += 1;
        }
      }
      perCapture.push({ captureId: capture.captureId, perfil: perfil.nombre, mismatches: captureMismatches, estadoAnalisis: resultado.estadoAnalisis, detalles });
    }
  }

  const report = {
    ok: captures.length > 0 && total > 0 && correct === total,
    totalCapturas: captures.length,
    perfilesCamara: perfilesActivos.length,
    totalEvaluaciones: total,
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
