import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { expect, test } from '@playwright/test';

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
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<a href="/descarga.pdf">Descargar PDF QA</a>' });
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

  const respuestaPdf = await page.goto('http://evaluapro-pdf-qa.test/visualizacion.pdf');
  expect(respuestaPdf?.status()).toBe(200);
  expect(respuestaPdf?.headers()['content-type']).toContain('application/pdf');
  const capturaViewer = await page.screenshot();
  expect(capturaViewer.byteLength).toBeGreaterThan(1_000);
  await testInfo.attach('edge-pdf-viewer.png', { body: capturaViewer, contentType: 'image/png' });

  await page.goto('http://evaluapro-pdf-qa.test/');
  const descargaPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Descargar PDF QA' }).click();
  const descarga = await descargaPromise;
  const rutaDescarga = testInfo.outputPath('qa-lote-descargado.pdf');
  await descarga.saveAs(rutaDescarga);
  const bytesDescargados = await readFile(rutaDescarga);
  expect(createHash('sha256').update(bytesDescargados).digest('hex')).toBe(sha256);
  expect((await PDFDocument.load(bytesDescargados)).getPageCount()).toBe(1);
});
