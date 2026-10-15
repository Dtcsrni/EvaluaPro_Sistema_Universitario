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
        body: '<main><h1>PDF de prueba del lote</h1><p>Documento sintético para validar vista y descarga.</p><a href="/descarga.pdf">Descargar PDF QA</a></main>'
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

  await page.goto('http://evaluapro-pdf-qa.test/');
  await expect(page.getByRole('heading', { name: 'PDF de prueba del lote' })).toBeVisible();
  const enlaceDescarga = page.getByRole('link', { name: 'Descargar PDF QA' });
  await expect(enlaceDescarga).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pdf-descarga-disponible.png'), fullPage: true });
  const respuestaPdf = await page.request.get('http://evaluapro-pdf-qa.test/visualizacion.pdf');
  expect(respuestaPdf.status()).toBe(200);
  expect(respuestaPdf.headers()['content-type']).toContain('application/pdf');
  const descargaPromise = page.waitForEvent('download');
  await enlaceDescarga.click();
  const descarga = await descargaPromise;
  const rutaDescarga = testInfo.outputPath('qa-lote-descargado.pdf');
  await descarga.saveAs(rutaDescarga);
  const bytesDescargados = await readFile(rutaDescarga);
  expect(createHash('sha256').update(bytesDescargados).digest('hex')).toBe(sha256);
  expect((await PDFDocument.load(bytesDescargados)).getPageCount()).toBe(1);
});
