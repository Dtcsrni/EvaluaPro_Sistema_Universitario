/**
 * responsive-alumno.spec
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { expect, test } from './visual-fixtures';

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

const viewports: ViewportCase[] = [
  { name: 'desktop-lg', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet-sm', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-narrow', width: 320, height: 844 }
];

async function captureEvidence(page: import('@playwright/test').Page, screen: string, viewport: string, fullPage = false) {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await page.screenshot({ path: `${evidenceDir}/gui-alumno-${screen}-${viewport}.png`, fullPage });
}

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, context: string) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const docOverflow = Math.max(doc.scrollWidth - doc.clientWidth, body.scrollWidth - body.clientWidth);
    const root = document.querySelector('#root');
    const rootOverflow = root ? root.scrollWidth - root.clientWidth : 0;
    const elementsBeyondViewport = Array.from(document.querySelectorAll('body *')).flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > window.innerWidth + 1
        ? [`${element.tagName.toLowerCase()}.${String((element as HTMLElement).className || '').replace(/\s+/g, '.')}: right=${rect.right.toFixed(1)}`]
        : [];
    }).slice(0, 8);
    return { overflow: Math.max(docOverflow, rootOverflow), elementsBeyondViewport };
  });
  expect(metrics.overflow, `${context}: overflow horizontal detectado; elementos: ${metrics.elementsBeyondViewport.join(', ')}`).toBeLessThanOrEqual(1);
}

async function assertInteractiveControlsAreNamed(page: import('@playwright/test').Page, context: string) {
  const unnamed = await page.evaluate(() => {
    const selector = 'button,a[href],input,select,textarea,[role="button"],[role="link"],[role="switch"],[role="checkbox"],[role="radio"]';

    function nameFor(element: Element) {
      const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ') ?? '';
      const labels = 'labels' in element
        ? Array.from((element as HTMLInputElement).labels ?? []).map((label) => label.textContent?.trim() ?? '').join(' ')
        : '';
      return [
        element.getAttribute('aria-label'),
        labelledBy,
        labels,
        element.getAttribute('title'),
        element.getAttribute('placeholder'),
        (element as HTMLElement).innerText,
        element.textContent
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }

    return Array.from(document.querySelectorAll(selector))
      .filter((element) => {
        const style = window.getComputedStyle(element as HTMLElement);
        const rect = (element as HTMLElement).getBoundingClientRect();
        const hiddenFromUsers = element.closest('[aria-hidden="true"], [inert]') !== null;
        return !hiddenFromUsers && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && style.pointerEvents !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .filter((element) => nameFor(element).length === 0)
      .map((element) => element.outerHTML.slice(0, 160));
  });
  expect(unnamed, `${context}: controles sin nombre accesible`).toEqual([]);
}

async function contrastAgainstWhite(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => {
    const channels = window.getComputedStyle(element).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const linear = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const [red, green, blue] = channels.map(linear);
    const foreground = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
    return 1.05 / (foreground + 0.05);
  });
}

test.describe('GUI responsive e2e · alumno', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (req.resourceType() === 'fetch' && (req.url().endsWith('/') || req.url().includes('index.html') || req.url().includes('127.0.0.1') || req.url().includes('localhost'))) {
        await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
        return;
      }
      if (req.resourceType() === 'fetch' && req.url().includes('manifest')) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        return;
      }
      route.fallback();
    });

    await page.route('**/api/portal/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/api/portal/resultados')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            resultados: [
              {
                folio: 'F-001',
                tipoExamen: 'Parcial',
                totalReactivos: 20,
                aciertos: 17,
                calificacionExamenFinalTexto: '4.25',
                comparativaRespuestas: [
                  { numeroPregunta: 1, correcta: 'A', detectada: 'A', coincide: true, confianza: 0.96 },
                  { numeroPregunta: 2, correcta: 'C', detectada: 'B', coincide: false, confianza: 0.58 }
                ],
                omrAuditoria: {
                  estadoAnalisis: 'requiere_revision',
                  motivosRevision: ['Respuesta con confianza media']
                }
              }
            ]
          })
        });
        return;
      }

      if (url.includes('/api/portal/perfil')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { perfil: { nombreCompleto: 'Ana Alumna', matricula: '2024-001', grupo: 'A-1' } } })
        });
        return;
      }

      if (url.includes('/api/portal/materias')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { materias: [{ nombre: 'Matemáticas', estado: 'activa' }] } })
        });
        return;
      }

      if (url.includes('/api/portal/agenda')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { agenda: [{ titulo: 'Revisión de resultados', fecha: '2026-05-27' }] } })
        });
        return;
      }

      if (url.includes('/api/portal/avisos')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { avisos: [{ titulo: 'Resultados publicados', severidad: 'info' }] } })
        });
        return;
      }

      if (url.includes('/api/portal/historial')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { historial: [{ folio: 'F-0001', calificacionTexto: '9.1' }] } })
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
  });

  test('resume el error de contexto sin duplicarlo y mantiene visibles las calificaciones', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    let intentosAgenda = 0;
    await page.route('**/api/portal/ingresar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'token-alumno-e2e' })
      });
    });
    await page.route('**/api/portal/agenda', async (route) => {
      intentosAgenda += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ mensaje: 'agenda-backend-secret' })
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: 'Código de acceso' }).fill('CLAVE-FICTICIA');
    await page.getByRole('textbox', { name: /^Matrícula/ }).fill('DUMMY-001');
    await page.getByRole('button', { name: /Consultar/i }).click();
    await expect(page.getByRole('heading', { name: 'Resultados disponibles' })).toBeVisible();
    const alerta = page.getByRole('alert').filter({ hasText: 'Algunos datos académicos no se pudieron cargar.' });
    await expect(alerta).toContainText('Tus calificaciones siguen disponibles');
    await expect(alerta).not.toContainText('No se pudo cargar la agenda.');
    await expect(alerta).not.toContainText('agenda-backend-secret');
    const notificaciones = page.getByRole('region', { name: 'Notificaciones' });
    if (await notificaciones.count()) {
      await notificaciones.evaluate((element) => {
        element.closest('.toast-viewport')?.remove();
      });
    }
    const tarjetaAgenda = page.locator('.portal-alumno-card').filter({ has: page.locator('.portal-card-icon--agenda') });
    await expect(tarjetaAgenda).toContainText('No se pudo cargar la agenda.');
    await expect(page.getByText('Folio F-001', { exact: true })).toBeVisible();

    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await expect(alerta).toBeVisible();
      await captureEvidence(page, `contexto-error-${theme}`, 'mobile-narrow-full', true);
    }
    await assertNoHorizontalOverflow(page, 'Alumno contexto académico con error 320 px');
    await assertInteractiveControlsAreNamed(page, 'Alumno contexto académico con error 320 px');

    expect(intentosAgenda).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Reintentar datos académicos' })).toBeEnabled();
  });

  test('error de resultados ofrece recuperación visible y conserva la sesión en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    let intentosResultados = 0;
    await page.route('**/api/portal/resultados', async (route) => {
      intentosResultados += 1;
      if (intentosResultados <= 3) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ mensaje: 'Resultados temporalmente no disponibles.' })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          resultados: [{ folio: 'F-REINTENTO', tipoExamen: 'Parcial', calificacionExamenFinalTexto: '8.5' }]
        })
      });
    });

    await page.addInitScript(() => localStorage.setItem('tokenAlumno', 'token-alumno-e2e'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Recargar' }).click();

    const alerta = page.getByRole('alert').filter({ hasText: 'Resultados temporalmente no disponibles.' });
    const reintentar = page.getByRole('button', { name: 'Reintentar carga de resultados' });
    await expect(alerta).toBeVisible();
    await expect(page.getByText(/HTTP 503/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Sin resultados/i })).toHaveCount(0);
    await expect(reintentar).toBeVisible();
    const layoutAlerta = await alerta.evaluate((element) => {
      const texto = element.querySelector('p')!.getBoundingClientRect();
      const boton = element.querySelector('button')!.getBoundingClientRect();
      const caja = element.getBoundingClientRect();
      return { altoBoton: boton.height, botonSeparado: boton.top >= texto.bottom, botonDentro: boton.left >= caja.left && boton.right <= caja.right };
    });
    expect(layoutAlerta.altoBoton, 'El control de recuperación debe conservar un área táctil de 44 px').toBeGreaterThanOrEqual(44);
    expect(layoutAlerta.botonSeparado, 'El control de recuperación debe ubicarse debajo del mensaje en móvil').toBe(true);
    expect(layoutAlerta.botonDentro, 'El control de recuperación debe caber dentro de la alerta').toBe(true);
    await assertNoHorizontalOverflow(page, 'Alumno error de resultados 320 px');
    await assertInteractiveControlsAreNamed(page, 'Alumno error de resultados 320 px');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await expect(alerta).toBeVisible();
      await captureEvidence(page, `error-resultados-${theme}`, 'mobile-narrow');
    }

    await reintentar.click();
    await expect(page.getByText('Folio F-REINTENTO', { exact: true })).toBeVisible();
    await expect(alerta).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Sin resultados/i })).toHaveCount(0);
    expect(intentosResultados, 'El portal debe agotar reintentos automáticos y permitir un reintento manual').toBe(4);
  });

  test('error de solicitud de revisión queda en contexto sin toast duplicado y permite reintentar', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    let intentosSolicitud = 0;
    await page.route('**/api/portal/solicitudes-revision', async (route) => {
      intentosSolicitud += 1;
      if (intentosSolicitud === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ mensaje: 'Servicio de revisión temporalmente no disponible.' })
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.addInitScript(() => localStorage.setItem('tokenAlumno', 'token-alumno-e2e'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Recargar/i }).click();
    await expect(page.getByText('Folio F-001', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ver detalle del folio F-001' }).click();

    const seleccion = page.getByRole('checkbox', { name: 'Solicitar revisión de la pregunta 2 del folio F-001' });
    const comentario = page.getByRole('textbox', { name: /Comentario obligatorio/i });
    await seleccion.check();
    await comentario.fill('Solicito revisar esta respuesta con detalle.');
    await page.getByRole('button', { name: 'Solicitar revisión de marcadas del folio F-001' }).click();

    const alerta = page.getByRole('alert').filter({ hasText: 'Servicio de revisión temporalmente no disponible.' });
    await expect(alerta).toBeVisible();
    await expect(seleccion).toBeChecked();
    await expect(comentario).toHaveValue('Solicito revisar esta respuesta con detalle.');
    await expect(page.locator('.toast-title', { hasText: 'Portal con error' })).toHaveCount(0);
    await assertNoHorizontalOverflow(page, 'Alumno solicitud de revisión fallida 320 px');
    await assertInteractiveControlsAreNamed(page, 'Alumno solicitud de revisión fallida 320 px');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await expect(alerta).toBeVisible();
      await captureEvidence(page, `solicitud-revision-error-${theme}`, 'mobile-narrow-full', true);
    }

    await page.getByRole('button', { name: 'Solicitar revisión de marcadas del folio F-001' }).click();
    await expect(page.getByText('Tu solicitud de revisión fue registrada.')).toBeVisible();
    await expect(alerta).toHaveCount(0);
    expect(intentosSolicitud, 'El reintento debe volver a enviar la solicitud').toBe(2);
  });

  test('la invalidación externa explica el nuevo acceso en móvil sin simular una salida voluntaria', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenAlumno', 'token-alumno-e2e'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /Salir/i })).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('app:sesion-invalidada', { detail: { tipo: 'alumno' } }));
    });

    const aviso = page.getByText('Tu sesión ya no está activa. Ingresa de nuevo para continuar.', { exact: true });
    await expect(aviso).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ingresa al portal' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Consultar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Salir/i })).toHaveCount(0);
    await expect(page.locator('.toast-text', { hasText: 'Sesión cerrada' })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tokenAlumno'))).toBeNull();
    await assertNoHorizontalOverflow(page, 'Alumno sesión invalidada 320 px');
    await assertInteractiveControlsAreNamed(page, 'Alumno sesión invalidada 320 px');

    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await expect(aviso).toBeVisible();
      await captureEvidence(page, `sesion-invalidada-${theme}`, 'mobile-narrow');
    }
  });

  for (const viewport of viewports) {
    test(`login estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByText(/Portal Alumno/i)).toBeVisible();
      await expect(page.getByLabel(/^Código de acceso\b/)).toBeVisible();
      await expect(page.getByRole('textbox', { name: /^Matrícula\b/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Consultar/i })).toBeVisible();
      const espacioIconoEtiqueta = await page.getByRole('button', { name: /Consultar/i }).evaluate((button) => {
        const icono = button.querySelector('.boton__icono')?.getBoundingClientRect();
        const etiqueta = button.querySelector('.boton__texto')?.getBoundingClientRect();
        return icono && etiqueta ? etiqueta.left - icono.right : Number.NaN;
      });
      expect(espacioIconoEtiqueta, 'El icono y la etiqueta del botón principal deben conservar separación visible').toBeGreaterThanOrEqual(6);
      if (viewport.name === 'desktop-lg' || viewport.name === 'desktop-1440' || viewport.name === 'mobile' || viewport.name === 'mobile-360' || viewport.name === 'mobile-narrow') {
        await expect(page.getByRole('heading', { name: /Consulta tus resultados/i })).toBeInViewport({ ratio: 1 });
        await expect(page.getByLabel(/^Código de acceso\b/)).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('textbox', { name: /^Matrícula\b/ })).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('button', { name: /Consultar/i })).toBeInViewport({ ratio: 1 });
      }

      await assertNoHorizontalOverflow(page, `Alumno ${viewport.name}`);
      await assertInteractiveControlsAreNamed(page, `Alumno ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'desktop-1440' || viewport.name === 'mobile' || viewport.name === 'mobile-360' || viewport.name === 'mobile-narrow') {
        await captureEvidence(page, 'login', viewport.name);
      }

      await page.evaluate(() => localStorage.setItem('tokenAlumno', 'token-alumno-e2e'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Recargar/i }).click();
      await expect(page.getByRole('heading', { name: /Resultados disponibles/i })).toBeVisible();
      await expect(page.getByText('Folio F-001', { exact: true })).toBeVisible();
      const resultadosPorFolio = page.getByRole('list', { name: 'Resultados por folio' });
      const ordenDeResultados = await resultadosPorFolio.evaluate((lista) => {
        const resumen = document.querySelector('.portal-alumno-shell__summary');
        const contexto = document.querySelector('.portal-alumno-context-grid');
        return {
          resumenAntes: Boolean(resumen && (resumen.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING)),
          listaInmediatamenteDespues: Boolean(resumen && resumen.nextElementSibling === lista),
          listaAntesDeContexto: Boolean(contexto && (lista.compareDocumentPosition(contexto) & Node.DOCUMENT_POSITION_FOLLOWING)),
          tarjetasResumen: resumen?.querySelectorAll('article').length ?? 0
        };
      });
      expect(ordenDeResultados.resumenAntes, 'El resumen de folios debe preceder a las calificaciones').toBe(true);
      expect(ordenDeResultados.listaInmediatamenteDespues, 'La lista principal debe seguir inmediatamente al resumen de folios').toBe(true);
      expect(ordenDeResultados.listaAntesDeContexto, 'Las calificaciones deben preceder al contexto secundario').toBe(true);
      expect(ordenDeResultados.tarjetasResumen, 'El resumen prioritario solo debe mostrar los folios').toBe(1);
      await expect(page.getByRole('region', { name: 'Resumen de folios' })).toBeVisible();
      await expect(page.getByText(/1 folio/i)).toBeVisible();
      await expect(page.getByText('Examen (sobre 5): 4.25 / 5')).toBeVisible();
      await expect(page.getByText('Matemáticas', { exact: true })).toBeVisible();
      await expect(page.locator('.portal-alumno-context-grid').getByText('1 materia', { exact: true })).toBeVisible();
      await expect(page.locator('.portal-alumno-context-grid').getByText('1 aviso reciente', { exact: true })).toBeVisible();
      await expect(page.getByText('Revisión de resultados', { exact: true })).toBeVisible();
      await expect(page.locator('.portal-card-icon--agenda svg')).toHaveAttribute('data-icono', 'agenda');
      await expect(page.locator('.portal-card-icon--historial svg')).toHaveAttribute('data-icono', 'historial');

      await assertNoHorizontalOverflow(page, `Alumno resultados ${viewport.name}`);
      await assertInteractiveControlsAreNamed(page, `Alumno resultados ${viewport.name}`);
      const mobileSummaryLayout = await page.evaluate(() => ({
        metricsColumns: getComputedStyle(document.querySelector('.portal-alumno-shell__summary') as HTMLElement).gridTemplateColumns.trim().split(/\s+/).length,
        contextColumns: getComputedStyle(document.querySelector('.portal-alumno-context-grid') as HTMLElement).gridTemplateColumns.trim().split(/\s+/).length
      }));
      if (viewport.width >= 360 && viewport.width <= 720) {
        expect(mobileSummaryLayout.metricsColumns, 'El resumen de folios debe conservar una sola columna legible').toBe(1);
        expect(mobileSummaryLayout.contextColumns, 'El contexto académico debe organizarse en dos columnas').toBe(2);
        const titlesFit = await page.locator('.portal-alumno-context-grid .portal-card-title').evaluateAll((titles) =>
          titles.every((title) => title.scrollWidth <= title.clientWidth + 1)
        );
        expect(titlesFit, 'Los títulos de las tarjetas de contexto deben caber sin partir palabras').toBe(true);
      } else if (viewport.width < 360) {
        expect(mobileSummaryLayout.metricsColumns, 'Las métricas deben conservar una columna legible en pantallas muy estrechas').toBe(1);
        expect(mobileSummaryLayout.contextColumns, 'El contexto debe conservar una columna legible en pantallas muy estrechas').toBe(1);
      }
      if (viewport.name === 'desktop-lg' || viewport.name === 'desktop-1440' || viewport.name === 'mobile' || viewport.name === 'mobile-360' || viewport.name === 'mobile-narrow') {
        if (viewport.name === 'mobile' || viewport.name === 'mobile-360' || viewport.name === 'mobile-narrow') {
          for (const theme of ['light', 'dark']) {
            await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
            await captureEvidence(page, `resultados-${theme}`, `${viewport.name}-full`, true);
          }
        } else {
          await captureEvidence(page, 'resultados', viewport.name, true);
        }
      }
      if (['desktop-lg', 'tablet-sm', 'mobile', 'mobile-360', 'mobile-narrow'].includes(viewport.name)) {
        const toggleDetalle = page.locator('.portal-resultado-detail-toggle');
        const chevronDetalle = toggleDetalle.locator('.portal-resultado-detail-toggle__icon');
        await expect(chevronDetalle).toHaveAttribute('data-icono', 'chevronAbajo');
        await toggleDetalle.click();
        await expect(page.getByRole('button', { name: 'Ocultar detalle del folio F-001' })).toBeVisible();
        await expect(toggleDetalle).toHaveAttribute('aria-expanded', 'true');
        await expect(chevronDetalle).toHaveAttribute('data-icono', 'chevronArriba');
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await expect(page.getByRole('table', { name: 'Comparación de respuestas del folio F-001' })).toBeVisible();
        const comparisonTitle = page.getByText('Comparación de respuestas · Folio F-001', { exact: true });
        await expect(comparisonTitle).toBeVisible();
        const comparisonTitleFits = await comparisonTitle.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return element.scrollWidth <= element.clientWidth + 1
            && rect.left >= 0
            && rect.right <= document.documentElement.clientWidth + 1;
        });
        expect(comparisonTitleFits, 'El título de la comparación debe quedar completo fuera del área desplazable').toBe(true);
        const comparisonRegion = page.getByRole('region', { name: 'Comparación de respuestas del folio F-001' });
        await expect(comparisonRegion).toBeVisible();
        const mobileLayout = viewport.width <= 720;
        const mobileHint = page.getByText(/En móvil, cada pregunta se presenta como tarjeta/i);
        if (mobileLayout) {
          await expect(mobileHint).toBeVisible();
        } else {
          await expect(mobileHint).toBeHidden();
          for (const header of ['Pregunta', 'Clave correcta', 'Tu respuesta', 'Estado', 'Solicitar revisión']) {
            await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
          }
        }
        const comentarioRevision = page.getByRole('textbox', { name: /Comentario obligatorio/i });
        await expect(comentarioRevision).toBeVisible();
        await expect(comentarioRevision).toHaveAttribute('required', '');
        await expect(page.getByText('Explica qué respuesta consideras que debe revisarse.')).toBeVisible();
        await expect(page.getByRole('checkbox', { name: 'Solicitar revisión de la pregunta 1 del folio F-001' })).toBeVisible();
        if (mobileLayout) {
          const mobileCardsFit = await comparisonRegion.evaluate((region) => {
            const table = region.querySelector('table');
            const cells = Array.from(region.querySelectorAll('tbody td'));
            const expectedLabels = ['Clave correcta', 'Tu respuesta', 'Estado', 'Solicitar revisión'];
            return Boolean(table)
              && table.scrollWidth <= region.clientWidth + 1
              && cells.length === expectedLabels.length * 2
              && cells.every((cell) => {
                const label = getComputedStyle(cell, '::before').content.replace(/^['"]|['"]$/g, '');
                const rect = cell.getBoundingClientRect();
                return expectedLabels.includes(label)
                  && rect.left >= 0
                  && rect.right <= document.documentElement.clientWidth + 1;
              });
          });
          expect(mobileCardsFit, 'Cada pregunta debe mostrar sus cuatro campos en una tarjeta sin desplazamiento horizontal').toBe(true);
        }
        await captureEvidence(page, 'detalle', `${viewport.name}-inicio-full`, true);
        await comparisonRegion.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(comparisonRegion).toBeFocused();
        await expect(comparisonRegion).toHaveCSS('outline-style', 'solid');
        await expect(page.locator('.portal-resultado-card').first()).toHaveCSS('outline-style', 'none');
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
          await assertNoHorizontalOverflow(page, `Alumno detalle ${viewport.name} ${theme}`);
          await captureEvidence(page, `detalle-${theme}`, `${viewport.name}-full`, true);
        }
        await toggleDetalle.click();
        await expect(toggleDetalle).toHaveAttribute('aria-expanded', 'false');
        await expect(chevronDetalle).toHaveAttribute('data-icono', 'chevronAbajo');
        await expect(page.getByRole('table', { name: 'Comparación de respuestas del folio F-001' })).toHaveCount(0);
      }
    });
  }

  test('login conserva acceso visible en tema claro móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('ep.theme.preference', 'light'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: 'Tema: Claro' })).toBeVisible();
    const versionButton = page.getByRole('button', { name: /Versión v.*Abrir información de versión/ });
    const visibleVersion = (await versionButton.innerText()).trim();
    await expect(versionButton).toBeVisible();
    const accessibleVersionName = await versionButton.getAttribute('aria-label');
    expect(accessibleVersionName).toContain(visibleVersion);
    expect(accessibleVersionName).toContain('Abrir información de versión');
    const versionContrast = await contrastAgainstWhite(versionButton);
    expect(versionContrast, `La etiqueta de versión requiere 4.5:1; obtuvo ${versionContrast.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    await expect(page.getByRole('heading', { name: /Consulta tus resultados/i })).toBeInViewport({ ratio: 1 });
    const codigoAcceso = page.getByLabel(/^Código de acceso\b/);
    await expect(codigoAcceso).toBeInViewport({ ratio: 1 });
    await expect(codigoAcceso).toHaveAttribute('type', 'password');
    await expect(codigoAcceso).toHaveAttribute('autocomplete', 'current-password');
    const matricula = page.getByRole('textbox', { name: /^Matrícula\b/ });
    await expect(matricula).toBeInViewport({ ratio: 1 });
    expect((await matricula.boundingBox())!.y).toBeLessThan((await codigoAcceso.boundingBox())!.y);
    const mostrarCodigo = page.getByRole('button', { name: 'Mostrar código de acceso' });
    await expect(mostrarCodigo).toBeInViewport({ ratio: 1 });
    const botonBounds = await mostrarCodigo.boundingBox();
    expect(botonBounds?.width).toBeGreaterThanOrEqual(40);
    expect(botonBounds?.height).toBeGreaterThanOrEqual(40);
    expect(Number.parseFloat(await codigoAcceso.evaluate((input) => getComputedStyle(input).paddingRight))).toBeGreaterThanOrEqual(52);
    await mostrarCodigo.focus();
    await page.keyboard.press('Enter');
    await expect(codigoAcceso).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar código de acceso' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(codigoAcceso).toHaveAttribute('type', 'password');
    await expect(page.getByRole('textbox', { name: /^Matrícula\b/ })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /Consultar/i })).toBeInViewport({ ratio: 1 });
    await assertNoHorizontalOverflow(page, 'Alumno login claro mobile');
    await assertInteractiveControlsAreNamed(page, 'Alumno login claro mobile');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    await captureEvidence(page, 'login-claro', 'mobile');
  });
});
