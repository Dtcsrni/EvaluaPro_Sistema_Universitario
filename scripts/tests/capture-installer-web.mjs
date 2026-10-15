import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const [url, outputPath, widthArg, heightArg] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);

if (!url || !outputPath || !Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 240) {
  throw new Error('Uso: capture-installer-web.mjs <url> <salida.png> <ancho> <alto>');
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[URL no válida]';
  }
}

function redactDiagnostic(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[correo]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [redactado]')
    .replace(/([?&](?:token|code|state|key|secret|password)=)[^&\s]*/gi, '$1[redactado]')
    .slice(0, 500);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const diagnostics = {
    url: safeUrl(url),
    viewport: { width, height },
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    httpErrors: []
  };

  page.on('console', (message) => {
    if (message.type() === 'error' && diagnostics.consoleErrors.length < 20) {
      diagnostics.consoleErrors.push(redactDiagnostic(message.text()));
    }
  });
  page.on('pageerror', (error) => {
    if (diagnostics.pageErrors.length < 20) diagnostics.pageErrors.push(redactDiagnostic(error.message));
  });
  page.on('requestfailed', (request) => {
    if (diagnostics.failedRequests.length < 20) {
      diagnostics.failedRequests.push({ method: request.method(), url: safeUrl(request.url()) });
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && diagnostics.httpErrors.length < 20) {
      diagnostics.httpErrors.push({ status: response.status(), url: safeUrl(response.url()) });
    }
  });

  let responseStatus = null;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    responseStatus = response?.status() ?? null;
    if (responseStatus !== 200) throw new Error(`La página respondió HTTP ${responseStatus ?? 'sin respuesta'}; se requiere HTTP 200.`);

    await page.locator('.app-loading').waitFor({ state: 'hidden', timeout: 30_000 });
    const main = page.getByRole('main');
    await main.waitFor({ state: 'visible', timeout: 30_000 });
    const heading = page.getByRole('heading', { name: 'Plataforma Docente', exact: true });
    await heading.waitFor({ state: 'visible', timeout: 30_000 });
    if (await main.getByRole('heading', { name: 'Plataforma Docente', exact: true }).count() === 0) {
      throw new Error('El encabezado docente no pertenece al contenido principal.');
    }

    const layout = await page.evaluate(() => {
      const isVisible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      };
      const nameOf = (element) => {
        const labelledBy = element.getAttribute('aria-labelledby')
          ?.split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText?.trim() ?? '')
          .filter(Boolean)
          .join(' ');
        const labels = element.labels ? Array.from(element.labels).map((label) => label.innerText.trim()).filter(Boolean).join(' ') : '';
        return element.getAttribute('aria-label')?.trim()
          || labelledBy
          || labels
          || element.getAttribute('title')?.trim()
          || element.innerText?.trim()
          || element.value?.trim()
          || '';
      };
      const main = document.querySelector('main, [role="main"]');
      if (!main) return { mainFound: false };

      const mainRect = main.getBoundingClientRect();
      const controls = Array.from(main.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]'))
        .filter(isVisible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: nameOf(element),
            disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
            inViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
            actionable: element.tagName === 'BUTTON' || element.tagName === 'A' || element.getAttribute('role') === 'button'
          };
        });
      const primaryAction = controls.find((control) => control.actionable && !control.disabled && control.name && control.inViewport) ?? null;
      return {
        mainFound: true,
        mainTextLength: main.innerText.trim().length,
        mainWithinHorizontalViewport: mainRect.left >= -1 && mainRect.right <= window.innerWidth + 1,
        mainScrollWidth: main.scrollWidth,
        mainClientWidth: main.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        unnamedVisibleControls: controls.filter((control) => !control.name).length,
        visibleControlCount: controls.length,
        primaryActionInViewport: Boolean(primaryAction)
      };
    });

    diagnostics.layout = layout;
    if (!layout.mainFound || layout.mainTextLength === 0) throw new Error('El contenido principal docente está vacío o ausente.');
    if (layout.documentScrollWidth > layout.viewportWidth + 1 || layout.mainScrollWidth > layout.mainClientWidth + 1 || !layout.mainWithinHorizontalViewport) {
      throw new Error(`La vista docente presenta desbordamiento horizontal en ${width}x${height}.`);
    }
    if (layout.unnamedVisibleControls > 0) throw new Error(`Hay ${layout.unnamedVisibleControls} controles visibles sin nombre accesible.`);
    if (!layout.primaryActionInViewport) throw new Error('No hay una acción principal con nombre accesible dentro del viewport.');

    await page.screenshot({ path: outputPath, fullPage: false });
  } catch (error) {
    diagnostics.responseStatus = responseStatus;
    diagnostics.error = redactDiagnostic(error?.message ?? error);
    try {
      diagnostics.page = await page.evaluate(() => ({
        title: document.title,
        readyState: document.readyState,
        loadingVisible: Array.from(document.querySelectorAll('.app-loading')).some((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }),
        mainLandmarkCount: document.querySelectorAll('main, [role="main"]').length,
        mainCandidates: Array.from(document.querySelectorAll('main, [role="main"]')).slice(0, 5).map((element) => ({
          tagName: element.tagName,
          className: typeof element.className === 'string' ? element.className.slice(0, 160) : '',
          role: element.getAttribute('role'),
          appDestination: element.getAttribute('data-app-destino'),
          textLength: element.innerText?.trim().length ?? 0
        })),
        iframeCount: document.querySelectorAll('iframe').length,
        headingCount: document.querySelectorAll('h1,h2,h3,h4,[role="heading"]').length,
        bodyTextLength: document.body?.innerText?.trim().length ?? 0
      }));
    } catch (diagnosticError) {
      diagnostics.pageDiagnosticError = redactDiagnostic(diagnosticError?.message ?? diagnosticError);
    }

    const failurePath = outputPath.replace(/\.png$/i, '.failure.png');
    const diagnosticsPath = outputPath.replace(/\.png$/i, '.failure.json');
    await Promise.allSettled([
      page.screenshot({ path: failurePath, fullPage: false }),
      fs.writeFile(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8')
    ]);
    const summary = {
      responseStatus: diagnostics.responseStatus,
      page: diagnostics.page,
      layout: diagnostics.layout,
      consoleErrors: diagnostics.consoleErrors,
      pageErrors: diagnostics.pageErrors,
      failedRequests: diagnostics.failedRequests,
      httpErrors: diagnostics.httpErrors
    };
    throw new Error(`Falló la validación visual docente: ${diagnostics.error}; estado=${JSON.stringify(summary)}; evidencia diagnóstica: ${failurePath} y ${diagnosticsPath}`);
  }
} finally {
  await browser.close();
}
