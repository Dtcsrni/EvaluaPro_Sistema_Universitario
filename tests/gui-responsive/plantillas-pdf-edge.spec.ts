import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

  await page.route('http://evaluapro-pdf-qa.test/**', async (route) => {
    const esDescarga = route.request().url().endsWith('/descarga.pdf');
    if (route.request().url().endsWith('/')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PDF de prueba del lote</title><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#102033;background:#eef4f9}main{max-width:1120px;margin:auto;padding:24px}section{padding:16px;background:#fff;border:1px solid #b8cbdc;border-radius:12px}iframe{display:block;width:100%;height:640px;border:1px solid #718096;border-radius:8px;background:#fff}a{display:inline-block;margin-top:16px;padding:10px 14px;color:#fff;background:#075985;border-radius:8px}</style></head><body><main><h1>PDF de prueba del lote</h1><p>Documento sintético para validar vista y descarga.</p><section aria-labelledby="vista-pdf-titulo"><h2 id="vista-pdf-titulo">Vista previa del documento</h2><iframe title="Vista previa del PDF" src="/visualizacion.pdf"></iframe></section><a href="/descarga.pdf">Descargar PDF QA</a></main></body></html>'
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: {
        'Content-Disposition': esDescarga ? 'attachment; filename="qa-lote.pdf"' : 'inline; filename="qa-lote.pdf"',
        'X-EvaluaPro-PDF-SHA256': sha256,
        'X-EvaluaPro-PDF-Pages': '1'
      },
      body: pdfBytes
    });
  });

  const respuestaInlinePromise = page.waitForResponse((response) =>
    response.url().endsWith('/visualizacion.pdf') && response.headers()['content-type']?.includes('application/pdf') === true
  );
  await page.goto('http://evaluapro-pdf-qa.test/');
  await expect(page.getByRole('heading', { name: 'PDF de prueba del lote' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vista previa del documento' })).toBeVisible();
  const respuestaInline = await respuestaInlinePromise;
  const pdfFrame = page.frames().find((frame) => frame.url().endsWith('/visualizacion.pdf'));
  expect(pdfFrame, 'La previsualización debe cargar el PDF en su propio frame').toBeTruthy();
  await pdfFrame!.waitForLoadState('load');
  expect(respuestaInline.status()).toBe(200);
  expect(respuestaInline.headers()['content-disposition']).toContain('inline');
  expect(respuestaInline.headers()['x-evaluapro-pdf-sha256']).toBe(sha256);
  await expect(page.getByTitle('Vista previa del PDF')).toBeVisible();
  await expect(page.getByTitle('Vista previa del PDF')).toHaveAttribute('src', '/visualizacion.pdf');
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
