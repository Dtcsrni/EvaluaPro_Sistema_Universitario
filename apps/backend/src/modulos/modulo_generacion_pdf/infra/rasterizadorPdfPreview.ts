import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

const PREVIEW_DPI = 144;
const MAX_PREVIEW_PAGES = 20;
const execFileAsync = promisify(execFile);

export type PaginaPdfPreviewVisual = {
  numero: number;
  width: number;
  height: number;
  dataUrl: string;
};

export async function rasterizarPdfParaPreview(buffer: Buffer): Promise<{
  paginas: PaginaPdfPreviewVisual[];
  paginasTotales: number;
  paginasOmitidas: number;
}> {
  const paginasTotales = Math.max(1, (await PDFDocument.load(buffer)).getPageCount());
  const paginasARenderizar = Math.min(paginasTotales, MAX_PREVIEW_PAGES);

  try {
    return await rasterizarConPoppler(buffer, paginasTotales, paginasARenderizar);
  } catch {
    try {
      return await rasterizarConSharp(buffer, paginasTotales, paginasARenderizar);
    } catch {
      return rasterizarConChromium(buffer, paginasTotales, paginasARenderizar);
    }
  }
}

async function rasterizarConPoppler(buffer: Buffer, paginasTotales: number, paginasARenderizar: number) {
  const candidatos = [process.env.EVALUAPRO_PDF_RASTERIZER, process.env.PDF_RASTERIZER_EXECUTABLE, 'pdftoppm', 'pdftocairo']
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  const dirTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-pdf-preview-'));
  const rutaPdf = path.join(dirTemporal, `${randomUUID()}.pdf`);

  try {
    await fs.writeFile(rutaPdf, buffer);
    let ultimoError: unknown;
    for (const ejecutable of candidatos) {
      try {
        const paginas: PaginaPdfPreviewVisual[] = [];
        for (let indice = 0; indice < paginasARenderizar; indice += 1) {
          const prefijoSalida = path.join(dirTemporal, `pagina-${indice + 1}`);
          await execFileAsync(
            ejecutable,
            ['-png', '-r', String(PREVIEW_DPI), '-f', String(indice + 1), '-l', String(indice + 1), '-singlefile', rutaPdf, prefijoSalida],
            { windowsHide: true, maxBuffer: 1024 * 1024 }
          );
          const imagen = await fs.readFile(`${prefijoSalida}.png`);
          const metadata = await sharp(imagen).metadata();
          paginas.push({
            numero: indice + 1,
            width: Number(metadata.width ?? 0),
            height: Number(metadata.height ?? 0),
            dataUrl: `data:image/png;base64,${imagen.toString('base64')}`
          });
        }
        return {
          paginas,
          paginasTotales,
          paginasOmitidas: Math.max(0, paginasTotales - paginasARenderizar)
        };
      } catch (error) {
        ultimoError = error;
      }
    }
    throw ultimoError ?? new Error('No hay un rasterizador PDF disponible.');
  } finally {
    await fs.rm(dirTemporal, { recursive: true, force: true });
  }
}

async function rasterizarConSharp(buffer: Buffer, paginasTotales: number, paginasARenderizar: number) {
  const paginas: PaginaPdfPreviewVisual[] = [];
  for (let indice = 0; indice < paginasARenderizar; indice += 1) {
    const renderizada = await sharp(buffer, {
      density: PREVIEW_DPI,
      page: indice,
      pages: 1
    })
      .png({ compressionLevel: 6 })
      .toBuffer({ resolveWithObject: true });
    paginas.push({
      numero: indice + 1,
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

async function rasterizarConChromium(buffer: Buffer, paginasTotales: number, paginasARenderizar: number) {
  const { chromium } = await import('playwright');
  const ejecutable = await resolverEjecutableChromium();
  const dirTemporal = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-pdf-preview-'));
  const rutaPdf = path.join(dirTemporal, `${randomUUID()}.pdf`);
  const browser = await chromium.launch(ejecutable ? { executablePath: ejecutable, headless: true } : { headless: true });
  try {
    await fs.writeFile(rutaPdf, buffer);
    const documento = await PDFDocument.load(buffer);
    const page = await browser.newPage();
    const paginas: PaginaPdfPreviewVisual[] = [];
    for (let indice = 0; indice < paginasARenderizar; indice += 1) {
      const pdfPage = documento.getPages()[indice];
      const width = Math.max(900, Math.round((pdfPage.getWidth() * PREVIEW_DPI) / 72));
      const height = Math.max(1200, Math.round((pdfPage.getHeight() * PREVIEW_DPI) / 72));
      await page.setViewportSize({ width, height });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:#fff"><embed id="pdf" src="${pathToFileURL(rutaPdf).href}#toolbar=0&navpanes=0&scrollbar=0&page=${indice + 1}" type="application/pdf" width="${width}" height="${height}"></body></html>`,
        { waitUntil: 'load' }
      );
      const imagen = await page.locator('#pdf').screenshot({ type: 'png' });
      paginas.push({
        numero: indice + 1,
        width,
        height,
        dataUrl: `data:image/png;base64,${imagen.toString('base64')}`
      });
    }
    return {
      paginas,
      paginasTotales,
      paginasOmitidas: Math.max(0, paginasTotales - paginasARenderizar)
    };
  } finally {
    await browser.close();
    await fs.rm(dirTemporal, { recursive: true, force: true });
  }
}
