import { chromium } from 'playwright';

const [url, outputPath, widthArg, heightArg] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);

if (!url || !outputPath || !Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 240) {
  throw new Error('Uso: capture-installer-web.mjs <url> <salida.png> <ancho> <alto>');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('.app-loading').waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByRole('heading', { name: 'Plataforma Docente', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('main.page').screenshot({ path: outputPath });
} finally {
  await browser.close();
}
