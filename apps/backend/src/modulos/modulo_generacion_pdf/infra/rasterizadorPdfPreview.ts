import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { log } from '../../../infraestructura/logging/logger.js';
import { ejecutarProcesoPdfLimitado } from './procesoPdfLimitado.js';

const PREVIEW_DPI_DEFAULT = 144;
const MAX_PREVIEW_PAGES = 20;
const RASTER_BUDGET_MS = 15_000;
const POPPLER_PROCESS_TIMEOUT_MS = 6_000;
const CHROMIUM_OPERATION_TIMEOUT_MS = 5_000;
const previewsEnCurso = new Map<string, Promise<{
  paginas: PaginaPdfPreviewVisual[];
  paginasTotales: number;
  paginasOmitidas: number;
}>>();

export type OpcionesRasterizadoPdf = {
  dpi?: number;
  desdePagina?: number;
  cantidadPaginas?: number;
};

export type PaginaPdfPreviewVisual = {
  numero: number;
  width: number;
  height: number;
  dataUrl: string;
};

export async function rasterizarPdfParaPreview(buffer: Buffer, opciones: OpcionesRasterizadoPdf = {}): Promise<{
  paginas: PaginaPdfPreviewVisual[];
  paginasTotales: number;
  paginasOmitidas: number;
}> {
  const dpi = Number.isFinite(opciones.dpi) ? Math.max(72, Math.min(600, Math.round(opciones.dpi as number))) : PREVIEW_DPI_DEFAULT;
  const desdePagina = Math.max(1, Math.floor(Number(opciones.desdePagina) || 1));
  const cantidadSolicitada = Number.isFinite(opciones.cantidadPaginas)
    ? Math.max(0, Math.floor(opciones.cantidadPaginas as number))
    : MAX_PREVIEW_PAGES;
  const cacheKey = createHash('sha256')
    .update(buffer)
    .update(`|${dpi}|${desdePagina}|${cantidadSolicitada}`)
    .digest('hex');
  const existente = previewsEnCurso.get(cacheKey);
  if (existente) return existente;

  const trabajo = rasterizarPdfInterno(buffer, dpi, desdePagina, cantidadSolicitada);
  previewsEnCurso.set(cacheKey, trabajo);
  try {
    return await trabajo;
  } finally {
    if (previewsEnCurso.get(cacheKey) === trabajo) previewsEnCurso.delete(cacheKey);
  }
}

async function rasterizarPdfInterno(buffer: Buffer, dpi: number, desdePagina: number, cantidadSolicitada: number) {
  const inicio = Date.now();
  const deadline = inicio + RASTER_BUDGET_MS;
  const etapaPdf = Date.now();
  log('info', 'Rasterizado PDF preview: inicia etapa', { etapa: 'parse_pdf', renderer: 'pdf-lib' });
  const pdf = await PDFDocument.load(buffer);
  const paginasTotales = pdf.getPageCount();
  const paginasARenderizar = Math.min(MAX_PREVIEW_PAGES, cantidadSolicitada, Math.max(0, paginasTotales - desdePagina + 1));
  registrarEtapa('parse_pdf', 'pdf-lib', etapaPdf, 'ok');
  if (paginasARenderizar === 0) return { paginas: [], paginasTotales, paginasOmitidas: paginasTotales };

  try {
    return await rasterizarConPoppler(buffer, paginasTotales, desdePagina, paginasARenderizar, dpi, deadline);
  } catch {
    const inicioSharp = Date.now();
    try {
      asegurarPresupuesto(deadline, 'sharp');
      log('info', 'Rasterizado PDF preview: inicia etapa', { etapa: 'rasterizar', renderer: 'sharp' });
      const visual = await rasterizarConSharp(buffer, paginasTotales, desdePagina, paginasARenderizar, dpi, deadline);
      registrarEtapa('rasterizar', 'sharp', inicioSharp, 'ok');
      return visual;
    } catch (errorSharp) {
      registrarEtapa('rasterizar', 'sharp', inicioSharp, 'fallback', errorSharp);
      asegurarPresupuesto(deadline, 'chromium');
      return rasterizarConChromium(buffer, paginasTotales, desdePagina, paginasARenderizar, dpi, deadline);
    }
  }
}

function registrarEtapa(etapa: string, renderer: string, inicio: number, resultado: string, error?: unknown) {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
  log(resultado === 'ok' ? 'info' : 'warn', 'Rasterizado PDF preview: etapa finalizada', {
    etapa,
    renderer,
    resultado,
    duracionMs: Math.max(0, Date.now() - inicio),
    ...(errorCode ? { errorCode } : {})
  });
}

function asegurarPresupuesto(deadline: number, etapa: string) {
  if (Date.now() >= deadline) throw Object.assign(new Error(`Presupuesto de rasterizado agotado antes de ${etapa}.`), { code: 'PDF_RASTER_BUDGET_EXCEEDED' });
}

async function rasterizarConPoppler(buffer: Buffer, paginasTotales: number, desdePagina: number, paginasARenderizar: number, dpi: number, deadline: number) {
  const candidatos = [...new Set([process.env.EVALUAPRO_PDF_RASTERIZER, process.env.PDF_RASTERIZER_EXECUTABLE, 'pdftoppm', 'pdftocairo']
    .map((item) => String(item ?? '').trim())
    .filter(Boolean))];
  const dirTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-pdf-preview-'));
  const rutaPdf = path.join(dirTemporal, `${randomUUID()}.pdf`);

  try {
    await fs.writeFile(rutaPdf, buffer);
    let ultimoError: unknown;
    for (const ejecutable of candidatos) {
      asegurarPresupuesto(deadline, 'poppler');
      const inicioEtapa = Date.now();
      try {
        const paginas: PaginaPdfPreviewVisual[] = [];
        const prefijoSalida = path.join(dirTemporal, `pagina-${randomUUID()}`);
        const timeoutMs = Math.max(1, Math.min(POPPLER_PROCESS_TIMEOUT_MS, deadline - Date.now()));
        await ejecutarProcesoPdfLimitado(
          ejecutable,
          ['-png', '-r', String(dpi), '-f', String(desdePagina), '-l', String(desdePagina + paginasARenderizar - 1), rutaPdf, prefijoSalida],
          timeoutMs
        );
        const archivosGenerados = await fs.readdir(dirTemporal);
        const prefijoNombre = path.basename(prefijoSalida);
        const archivosPorNumero = new Map<number, string>();
        for (const archivo of archivosGenerados) {
          const coincidencia = archivo.match(new RegExp(`^${prefijoNombre}-(\\d+)\\.png$`));
          if (coincidencia) archivosPorNumero.set(Number(coincidencia[1]), path.join(dirTemporal, archivo));
        }
        for (let indice = 0; indice < paginasARenderizar; indice += 1) {
          const numeroPagina = desdePagina + indice;
          const rutaPagina = archivosPorNumero.get(numeroPagina);
          if (!rutaPagina) throw new Error(`Poppler no produjo el raster de la página ${numeroPagina}.`);
          const imagen = await fs.readFile(rutaPagina);
          const metadata = await sharp(imagen).metadata();
          paginas.push({
            numero: desdePagina + indice,
            width: Number(metadata.width ?? 0),
            height: Number(metadata.height ?? 0),
            dataUrl: `data:image/png;base64,${imagen.toString('base64')}`
          });
        }
        const resultado = {
          paginas,
          paginasTotales,
          paginasOmitidas: Math.max(0, paginasTotales - paginasARenderizar)
        };
        registrarEtapa('rasterizar', 'poppler', inicioEtapa, 'ok');
        return resultado;
      } catch (error) {
        ultimoError = error;
        registrarEtapa('rasterizar', 'poppler', inicioEtapa, 'fallback', error);
      }
    }
    throw ultimoError ?? new Error('No hay un rasterizador PDF disponible.');
  } finally {
    await fs.rm(dirTemporal, { recursive: true, force: true });
  }
}

async function rasterizarConSharp(buffer: Buffer, paginasTotales: number, desdePagina: number, paginasARenderizar: number, dpi: number, deadline: number) {
  const paginas: PaginaPdfPreviewVisual[] = [];
  for (let indice = 0; indice < paginasARenderizar; indice += 1) {
    asegurarPresupuesto(deadline, 'sharp');
    const timeoutSeconds = Math.max(0.1, Math.min(5, (deadline - Date.now()) / 1000));
    const renderizada = await sharp(buffer, {
      density: dpi,
      page: desdePagina + indice - 1,
      pages: 1
    })
      .timeout({ seconds: timeoutSeconds })
      .png({ compressionLevel: 6 })
      .toBuffer({ resolveWithObject: true });
    paginas.push({
      numero: desdePagina + indice,
      width: renderizada.info.width,
      height: renderizada.info.height,
      dataUrl: `data:image/png;base64,${renderizada.data.toString('base64')}`
    });
  }
  return {
    paginas,
    paginasTotales,
    paginasOmitidas: Math.max(0, paginasTotales - paginasARenderizar)
  };
}

async function resolverEjecutableChromium() {
  const candidatos = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome'
  ].filter((item): item is string => Boolean(String(item ?? '').trim()));
  for (const candidato of candidatos) {
    try {
      await fs.access(candidato);
      return candidato;
    } catch {
      // Continuar con el siguiente candidato.
    }
  }
  return undefined;
}

async function rasterizarConChromium(buffer: Buffer, paginasTotales: number, desdePagina: number, paginasARenderizar: number, dpi: number, deadline: number) {
  const { chromium } = await import('playwright');
  const dirTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-pdf-preview-'));
  const rutaPdf = path.join(dirTemporal, `${randomUUID()}.pdf`);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const inicioEtapa = Date.now();
  let resultadoEtapa = 'error';
  let errorEtapa: unknown;
  try {
    const ejecutable = await resolverEjecutableChromium();
    asegurarPresupuesto(deadline, 'chromium');
    const timeout = Math.max(1, Math.min(CHROMIUM_OPERATION_TIMEOUT_MS, deadline - Date.now()));
    log('info', 'Rasterizado PDF preview: inicia etapa', { etapa: 'rasterizar', renderer: 'chromium' });
    browser = await chromium.launch(ejecutable ? { executablePath: ejecutable, headless: true, timeout } : { headless: true, timeout });
    await fs.writeFile(rutaPdf, buffer);
    const documento = await PDFDocument.load(buffer);
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(Math.max(1, Math.min(CHROMIUM_OPERATION_TIMEOUT_MS, deadline - Date.now())));
    const paginas: PaginaPdfPreviewVisual[] = [];
    for (let indice = 0; indice < paginasARenderizar; indice += 1) {
      asegurarPresupuesto(deadline, 'chromium');
      page.setDefaultTimeout(Math.max(1, Math.min(CHROMIUM_OPERATION_TIMEOUT_MS, deadline - Date.now())));
      const numeroPagina = desdePagina + indice;
      const pdfPage = documento.getPages()[numeroPagina - 1];
      const width = Math.max(900, Math.round((pdfPage.getWidth() * dpi) / 72));
      const height = Math.max(1200, Math.round((pdfPage.getHeight() * dpi) / 72));
      await page.setViewportSize({ width, height });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:#fff"><embed id="pdf" src="${pathToFileURL(rutaPdf).href}#toolbar=0&navpanes=0&scrollbar=0&page=${numeroPagina}" type="application/pdf" width="${width}" height="${height}"></body></html>`,
        { waitUntil: 'load' }
      );
      const imagen = await page.locator('#pdf').screenshot({ type: 'png' });
      paginas.push({
        numero: desdePagina + indice,
        width,
        height,
        dataUrl: `data:image/png;base64,${imagen.toString('base64')}`
      });
    }
    resultadoEtapa = 'ok';
    return {
      paginas,
      paginasTotales,
      paginasOmitidas: Math.max(0, paginasTotales - paginasARenderizar)
    };
  } catch (error) {
    errorEtapa = error;
    throw error;
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await fs.rm(dirTemporal, { recursive: true, force: true });
      registrarEtapa('rasterizar', 'chromium', inicioEtapa, resultadoEtapa, errorEtapa);
    }
  }
}
