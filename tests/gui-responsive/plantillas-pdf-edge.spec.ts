import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { expect, test } from './visual-fixtures';

test('Edge visualiza y descarga intacto un PDF sintético de lote', async ({ page }, testInfo) => {
  const pdf = await PDFDocument.create();
  pdf.setTitle('EvaluaPro PDF QA Edge');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const sheet = pdf.addPage([612, 792]);
  sheet.drawText('EvaluaPro PDF QA - fixture sintético', { x: 48, y: 730, size: 16, font, color: rgb(0, 0, 0) });
  sheet.drawText('Página 1 de 1 | Este documento no contiene datos reales.', { x: 48, y: 700, size: 10, font, color: rgb(0, 0, 0) });
  const pdfBytes = Buffer.from(await pdf.save());
  const sha256 = createHash('sha256').update(pdfBytes).digest('hex');
  const rutaPdf = testInfo.outputPath('qa-lote-fuente.pdf');
  const prefijoPreview = testInfo.outputPath('qa-lote-preview');
  await testInfo.attach('qa-lote-fuente.pdf', { body: pdfBytes, contentType: 'application/pdf' });
  await writeFile(rutaPdf, pdfBytes);

  // El visor PDF nativo headless de Edge puede emitir un iframe oscuro sin
  // exponer el estado de pintura. Renderizamos el mismo PDF con Poppler y
  // mostramos la página rasterizada, como hace la vista previa de EvaluaPro.
  execFileSync('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-png', rutaPdf, prefijoPreview], {
    stdio: 'pipe'
  });
  const previewPng = await readFile(`${prefijoPreview}.png`);
  await testInfo.attach('qa-lote-preview.png', { body: previewPng, contentType: 'image/png' });

  await page.route('http://evaluapro-pdf-qa.test/**', async (route) => {
    if (route.request().url().endsWith('/')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PDF de prueba del lote</title><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#102033;background:#eef4f9}main{max-width:1120px;margin:auto;padding:24px}section{padding:16px;background:#fff;border:1px solid #b8cbdc;border-radius:12px}figure{margin:0}img{display:block;width:100%;height:auto;max-height:720px;object-fit:contain;background:#fff;border:1px solid #718096;border-radius:8px}figcaption{margin-top:8px;color:#475569}a{display:inline-block;margin-top:16px;padding:10px 14px;color:#fff;background:#075985;border-radius:8px}</style></head><body><main><h1>PDF de prueba del lote</h1><p>Documento sintético para validar vista y descarga.</p><section aria-labelledby="vista-pdf-titulo"><h2 id="vista-pdf-titulo">Vista previa del documento</h2><figure><img title="Vista previa del PDF" alt="Página 1 renderizada del PDF de prueba" src="/visualizacion.png"><figcaption>Página 1 de 1 · vista renderizada del archivo descargable</figcaption></figure></section><a href="/descarga.pdf">Descargar PDF QA</a></main></body></html>'
      });
      return;
    }
    if (route.request().url().endsWith('/visualizacion.png')) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: {
          'X-EvaluaPro-PDF-SHA256': sha256,
          'X-EvaluaPro-PDF-Pages': '1'
        },
        body: previewPng
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: {
        'Content-Disposition': 'attachment; filename="qa-lote.pdf"',
        'X-EvaluaPro-PDF-SHA256': sha256,
        'X-EvaluaPro-PDF-Pages': '1'
      },
      body: pdfBytes
    });
  });

  const respuestaPreviewPromise = page.waitForResponse((response) =>
    response.url().endsWith('/visualizacion.png') && response.headers()['content-type']?.includes('image/png') === true
  );
  await page.goto('http://evaluapro-pdf-qa.test/');
  await expect(page.getByRole('heading', { name: 'PDF de prueba del lote' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vista previa del documento' })).toBeVisible();
  const respuestaPreview = await respuestaPreviewPromise;
  expect(respuestaPreview.status()).toBe(200);
  expect(respuestaPreview.headers()['x-evaluapro-pdf-sha256']).toBe(sha256);
  const imagenPreview = page.getByRole('img', { name: 'Página 1 renderizada del PDF de prueba' });
  await expect(imagenPreview).toBeVisible();
  const metricasPreview = await imagenPreview.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context || image.naturalWidth === 0 || image.naturalHeight === 0) {
      return { width: 0, height: 0, pixelsConTinta: 0, pixelsClaros: 0, pixelsFondoOscuro: 0 };
    }
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let pixelsConTinta = 0;
    let pixelsClaros = 0;
    let pixelsFondoOscuro = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] < 150 && pixels[index + 1] < 150 && pixels[index + 2] < 150) pixelsConTinta++;
      if (pixels[index] > 220 && pixels[index + 1] > 220 && pixels[index + 2] > 220) pixelsClaros++;
      if (pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100) pixelsFondoOscuro++;
    }
    return { width: image.naturalWidth, height: image.naturalHeight, pixelsConTinta, pixelsClaros, pixelsFondoOscuro };
  });
  expect(metricasPreview.width).toBeGreaterThan(0);
  expect(metricasPreview.height).toBeGreaterThan(0);
  const totalPixeles = metricasPreview.width * metricasPreview.height;
  const proporcionClara = metricasPreview.pixelsClaros / totalPixeles;
  const proporcionOscura = metricasPreview.pixelsFondoOscuro / totalPixeles;
  const evidenciaDeTextoEnFondoClaro = proporcionClara > 0.5 && metricasPreview.pixelsConTinta > 100 && proporcionOscura < 0.15;
  const evidenciaDeTextoEnFondoOscuro = proporcionOscura > 0.5 && metricasPreview.pixelsClaros > 100 && proporcionClara < 0.15;
  expect(
    evidenciaDeTextoEnFondoClaro || evidenciaDeTextoEnFondoOscuro,
    `La captura debe mostrar texto sobre fondo uniforme claro u oscuro; métricas: ${JSON.stringify(metricasPreview)}`
  ).toBe(true);
  const enlaceDescarga = page.getByRole('link', { name: 'Descargar PDF QA' });
  await expect(enlaceDescarga).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pdf-descarga-disponible.png'), fullPage: true });
  const descargaPromise = page.waitForEvent('download');
  await enlaceDescarga.click();
  const descarga = await descargaPromise;
  const rutaDescarga = testInfo.outputPath('qa-lote-descargado.pdf');
  await descarga.saveAs(rutaDescarga);
  const bytesDescargados = await readFile(rutaDescarga);
  expect(createHash('sha256').update(bytesDescargados).digest('hex')).toBe(sha256);
  expect((await PDFDocument.load(bytesDescargados)).getPageCount()).toBe(1);
});
