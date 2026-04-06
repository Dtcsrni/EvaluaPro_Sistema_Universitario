import { chromium } from 'playwright';

async function launchBrowser() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim();
  if (executablePath) {
    return chromium.launch({ headless: true, executablePath });
  }

  const preferredChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim();
  const channels = [preferredChannel, process.platform === 'win32' ? 'msedge' : undefined, process.platform === 'darwin' ? 'chrome' : undefined].filter(
    (value): value is string => Boolean(value)
  );

  let lastError: unknown;
  for (const channel of channels) {
    try {
      return await chromium.launch({ headless: true, channel });
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (lastError) {
      throw new Error(`No se pudo iniciar Chromium/Edge para generar PDF exacto: ${String((lastError as Error)?.message ?? lastError)} | ${String((error as Error)?.message ?? error)}`);
    }
    throw error;
  }
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      width: '8.5in',
      height: '11in',
      margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
      printBackground: true,
      preferCSSPageSize: true
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
