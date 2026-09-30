import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import jsQR from 'jsqr';
import sharp from 'sharp';

type IdentidadQr = { folio: string; pagina: number };
type FilaBenchmark = {
  file?: string;
  qrTextoEsperado?: string | null;
  qrTextoDetectado?: string | null;
  qrDetectionMode?: string | null;
};
type InformeBenchmark = {
  dataset?: { directory?: string; attachedImage?: string };
  rows?: FilaBenchmark[];
};
type ManifiestoPdf = {
  paginas?: Array<{ numero?: number; qrTexto?: string }>;
  mapaOmr?: { paginas?: Array<{ numeroPagina?: number; qr?: { x?: number; y?: number; size?: number } }> };
};
const QR_BOX_PDF = { x: 497, yTop: 57, size: 79 };

const execFile = promisify(execFileCallback);

function identidadDesdeQr(texto: string): IdentidadQr | null {
  const match = texto.match(/^EXAMEN:([A-Z0-9-]+):P([1-9]\d*):/i);
  if (!match) return null;
  return { folio: match[1]!.toUpperCase(), pagina: Number(match[2]) };
}

export function crearMapaQrEsperado(filas: FilaBenchmark[]) {
  const mapa = new Map<string, string>();
  for (const fila of filas) {
    const texto = String(fila.qrTextoEsperado ?? '');
    const identidad = identidadDesdeQr(texto);
    if (!identidad) continue;
    const llave = `${identidad.folio}:${identidad.pagina}`;
    const anterior = mapa.get(llave);
    if (anterior && anterior !== texto) {
      throw new Error(`El benchmark contiene payloads distintos para ${llave}.`);
    }
    mapa.set(llave, texto);
  }
  return mapa;
}

export function crearMapaQrManifiesto(manifiesto: ManifiestoPdf) {
  return crearMapaQrEsperado((manifiesto.paginas ?? []).map((pagina) => ({ qrTextoEsperado: pagina.qrTexto })));
}

export function combinarMapasQrEsperados(...mapas: Map<string, string>[]) {
  const resultado = new Map<string, string>();
  for (const mapa of mapas) {
    for (const [identidad, texto] of mapa) {
      const existente = resultado.get(identidad);
      if (existente && existente !== texto) throw new Error(`Benchmark y manifiesto discrepan para ${identidad}.`);
      resultado.set(identidad, texto);
    }
  }
  return resultado;
}

export function cajaQrDesdeManifiesto(manifiesto: ManifiestoPdf, numeroPagina: number, altoPagina: number) {
  const qr = manifiesto.mapaOmr?.paginas?.find((pagina) => pagina.numeroPagina === numeroPagina)?.qr;
  if (!qr || ![qr.x, qr.y, qr.size, altoPagina].every((value) => Number.isFinite(value))) return undefined;
  const { x, y, size } = qr as { x: number; y: number; size: number };
  if (x < 0 || y < 0 || size <= 0 || y + size > altoPagina) return undefined;
  return { x, yTop: altoPagina - y - size, size };
}

export function identidadDesdeTextoPdf(texto: string): IdentidadQr | null {
  const coincidencias = [...texto.matchAll(/\b([A-Z0-9][A-Z0-9-]{1,63})\s*[·•]\s*P(?:agina|ágina)?\s*(\d+)\b/gi)]
    .map(([, folio, pagina]) => ({ folio: String(folio).toUpperCase(), pagina: Number(pagina) }));
  const unicas = new Map(coincidencias.map((identidad) => [`${identidad.folio}:${identidad.pagina}`, identidad]));
  return unicas.size === 1 ? [...unicas.values()][0]! : null;
}

function digest(texto: string | undefined) {
  return texto ? createHash('sha256').update(texto).digest('hex').slice(0, 16) : null;
}

export function detectarQrRgba(data: Uint8Array, width: number, height: number) {
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const directo = jsQR(pixels, width, height, { inversionAttempts: 'attemptBoth' })?.data;
  if (directo) return directo;

  // El color de fondo y el antialias del PDF pueden dejar el papel entre 220
  // y 240; binarizar solo la ROI QR permite recuperar módulos negros sin
  // elevar el umbral sobre texto o respuestas de toda la página.
  const gray = new Uint8ClampedArray(width * height);
  for (let indice = 0, pixel = 0; indice < gray.length; indice += 1, pixel += 4) {
    gray[indice] = Math.round(pixels[pixel]! * 0.299 + pixels[pixel + 1]! * 0.587 + pixels[pixel + 2]! * 0.114);
  }
  for (const umbral of [200, 220, 230, 240]) {
    const binaria = new Uint8ClampedArray(pixels.length);
    for (let indice = 0, pixel = 0; indice < gray.length; indice += 1, pixel += 4) {
      const valor = gray[indice]! < umbral ? 0 : 255;
      binaria[pixel] = valor;
      binaria[pixel + 1] = valor;
      binaria[pixel + 2] = valor;
      binaria[pixel + 3] = 255;
    }
    const detectado = jsQR(binaria, width, height, { inversionAttempts: 'attemptBoth' })?.data;
    if (detectado) return detectado;
  }
  return undefined;
}

export function resumirReferenciaQr(referencia: {
  pdf: string;
  paginas: Array<{
    paginaPdf: number;
    esperadoDisponible: boolean;
    detectado: boolean;
    coincide: boolean;
  }>;
}) {
  const { paginas } = referencia;
  return {
    pdf: referencia.pdf,
    paginas: paginas.length,
    qrEsperados: paginas.filter((pagina) => pagina.esperadoDisponible).length,
    qrDetectados: paginas.filter((pagina) => pagina.detectado).length,
    lecturaCompletaExacta: paginas.filter((pagina) => pagina.coincide).length,
    paginasQrNoDetectado: paginas.filter((pagina) => pagina.esperadoDisponible && !pagina.detectado)
      .map((pagina) => pagina.paginaPdf),
    paginasPayloadDistinto: paginas.filter((pagina) => pagina.detectado && !pagina.coincide)
      .map((pagina) => pagina.paginaPdf),
    paginasSinLecturaExacta: paginas.filter((pagina) => !pagina.coincide).map((pagina) => pagina.paginaPdf)
  };
}

function parseArgs(args: string[]) {
  const pdfs: string[] = [];
  let reportPath = '';
  let manifestPath = '';
  let dpi = 300;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const value = args[index + 1];
    if (arg === '--pdf' && value) {
      pdfs.push(path.resolve(value));
      index += 1;
    } else if (arg === '--benchmark-report' && value) {
      reportPath = path.resolve(value);
      index += 1;
    } else if (arg === '--expected-manifest' && value) {
      manifestPath = path.resolve(value);
      index += 1;
    } else if (arg === '--dpi' && value) {
      dpi = Number(value);
      index += 1;
    } else {
      throw new Error(`Argumento no reconocido o incompleto: ${arg}`);
    }
  }
  if (!pdfs.length || !reportPath) {
    throw new Error('Uso: --pdf <referencia.pdf> [--pdf <otra.pdf>] --benchmark-report <omr.json> [--expected-manifest <layout.json>] [--dpi 240]');
  }
  if (!Number.isInteger(dpi) || dpi < 120 || dpi > 600) {
    throw new Error('--dpi debe ser un entero entre 120 y 600.');
  }
  return { pdfs, reportPath, manifestPath, dpi };
}

async function auditarPdf(
  pdfPath: string,
  mapaEsperado: Map<string, string>,
  dpi: number,
  tempDir: string,
  manifiesto?: ManifiestoPdf
) {
  const bytes = new Uint8Array(await readFile(pdfPath));
  const documento = await PDFDocument.load(bytes);
  const parser = new PDFParse({ data: bytes });
  const textoPdf = await parser.getText();
  const paginas = textoPdf.pages ?? [];
  if (paginas.length !== documento.getPageCount()) {
    throw new Error(`El extractor de texto no devolvio todas las paginas de ${path.basename(pdfPath)}.`);
  }

  const resultados = [];
  for (let index = 0; index < paginas.length; index += 1) {
    const numeroPagina = index + 1;
    const identidad = identidadDesdeTextoPdf(paginas[index]?.text ?? '');
    const esperado = identidad ? mapaEsperado.get(`${identidad.folio}:${identidad.pagina}`) : undefined;
    const geometriaQr = cajaQrDesdeManifiesto(manifiesto ?? {}, numeroPagina, documento.getPage(numeroPagina - 1)!.getHeight()) ?? QR_BOX_PDF;
    const prefijo = path.join(tempDir, `ref-${resultados.length + 1}`);
    await execFile('pdftoppm', [
      '-png', '-singlefile', '-r', String(dpi), '-f', String(numeroPagina), '-l', String(numeroPagina),
      pdfPath, prefijo
    ], { windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024 });
    // Rasteriza la pagina completa a resolucion de impresion, pero pasa al
    // lector solo la reserva fisica conocida del QR. Esto conserva el flujo de
    // imagen de produccion y evita multiplicar memoria con paginas A4/Letter.
    const metadata = await sharp(`${prefijo}.png`).metadata();
    const escala = dpi / 72;
    const margenQr = 12;
    const left = Math.max(0, Math.round((geometriaQr.x - margenQr) * escala));
    const top = Math.max(0, Math.round((geometriaQr.yTop - margenQr) * escala));
    const lado = Math.round((geometriaQr.size + margenQr * 2) * escala);
    const width = Math.min(metadata.width! - left, lado);
    const height = Math.min(metadata.height! - top, lado);
    if (width <= 0 || height <= 0) throw new Error(`La pagina ${numeroPagina} no contiene la reserva QR esperada.`);
    const rasterQr = await sharp(`${prefijo}.png`).extract({ left, top, width, height }).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const detectado = detectarQrRgba(rasterQr.data, rasterQr.info.width, rasterQr.info.height);
    resultados.push({
      paginaPdf: numeroPagina,
      identidad,
      esperadoDisponible: Boolean(esperado),
      detectado: Boolean(detectado),
      coincide: Boolean(esperado && detectado === esperado),
      esperadoSha256: digest(esperado),
      detectadoSha256: digest(detectado)
    });
  }
  await parser.destroy();
  return { pdf: path.basename(pdfPath), paginas: resultados };
}

function resumirFotos(informe: InformeBenchmark) {
  if (!Array.isArray(informe.rows)) throw new Error('El reporte debe incluir rows[].');
  let esperadas = 0;
  let detectadas = 0;
  let coincidentes = 0;
  let directas = 0;
  let rescatesGeometricos = 0;
  const filas = [];
  for (const fila of informe.rows) {
    const esperado = String(fila.qrTextoEsperado ?? '');
    if (!esperado) continue;
    esperadas += 1;
    const detectado = String(fila.qrTextoDetectado ?? '');
    if (detectado) detectadas += 1;
    if (fila.qrDetectionMode === 'direct_image') directas += 1;
    if (fila.qrDetectionMode === 'known_geometry_rescue') rescatesGeometricos += 1;
    const coincide = detectado === esperado;
    if (coincide) coincidentes += 1;
    filas.push({
      archivo: path.basename(String(fila.file ?? 'sin-nombre')),
      modo: fila.qrDetectionMode ?? 'desconocido',
      detectado: Boolean(detectado),
      coincide
    });
  }
  return { fotosConReferencia: esperadas, detectadas, directas, rescatesGeometricos, coincidentes, filas };
}

async function main() {
  const { pdfs, reportPath, manifestPath, dpi } = parseArgs(process.argv.slice(2));
  const informe = JSON.parse(await readFile(reportPath, 'utf8')) as InformeBenchmark;
  const filasBenchmark = informe.rows ?? [];
  const manifiesto = manifestPath ? JSON.parse(await readFile(manifestPath, 'utf8')) as ManifiestoPdf : undefined;
  const filasManifiesto = manifiesto ? crearMapaQrManifiesto(manifiesto) : new Map<string, string>();
  const mapaEsperado = combinarMapasQrEsperados(crearMapaQrEsperado(filasBenchmark), filasManifiesto);
  if (!mapaEsperado.size) throw new Error('El reporte no contiene payloads QR esperados utilizables.');
  const tempDir = await mkdtemp(path.join(tmpdir(), 'evaluapro-qr-preprint-'));
  try {
    const referencias = [];
    for (const pdf of pdfs) referencias.push(await auditarPdf(pdf, mapaEsperado, dpi, tempDir, manifiesto));
    const fotos = resumirFotos(informe);
    const paginasPdf = referencias.flatMap((referencia) => referencia.paginas);
    const preimpresionAprobada = paginasPdf.length > 0 && paginasPdf.every((pagina) => pagina.coincide);
    const datasetQrCompleto = fotos.fotosConReferencia > 0 && fotos.coincidentes === fotos.fotosConReferencia;
    const resultado = {
      dpi,
      benchmarkTerminado: (informe as InformeBenchmark & { finishedAt?: string }).finishedAt ?? null,
      referencias: referencias.map((referencia) => resumirReferenciaQr(referencia)),
      totalReferencia: {
        paginas: paginasPdf.length,
        qrEsperados: paginasPdf.filter((pagina) => pagina.esperadoDisponible).length,
        qrDetectados: paginasPdf.filter((pagina) => pagina.detectado).length,
        lecturaCompletaExacta: paginasPdf.filter((pagina) => pagina.coincide).length
      },
      fotos,
      aprobadoPreimpresion: preimpresionAprobada,
      datasetQrCompleto,
      aprobado: preimpresionAprobada && datasetQrCompleto
    };
    console.log(JSON.stringify(resultado, null, 2));
    if (!resultado.aprobado) process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Fallo desconocido en auditoria QR.');
    process.exitCode = 1;
  });
}
