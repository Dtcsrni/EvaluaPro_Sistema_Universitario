/**
 * responsive-docente.spec
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { expect, test } from './visual-fixtures';
import QRCode from 'qrcode';

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

type TabCase = {
  label: string;
  slug: string;
};

const viewports: ViewportCase[] = [
  { name: 'desktop-lg', width: 1920, height: 1080 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet-sm', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

async function captureEvidence(page: import('@playwright/test').Page, surface: string, screen: string, viewport: string) {
  // Evita que el tooltip contextual del último control accionado tape la
  // evidencia visual; la ayuda sigue disponible al pasar el cursor o enfocar.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(80);
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await page.screenshot({ path: `${evidenceDir}/gui-${surface}-${screen}-${viewport}.png`, fullPage: false });
}

const supplementalEvidencePath = (name: string) => `${process.env.E2E_SCREENSHOT_DIR || 'test-results'}/${name}`;

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, context: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${context}: overflow horizontal detectado`).toBeLessThanOrEqual(1);
}

async function assertVisibleHeadersFit(page: import('@playwright/test').Page, context: string) {
  const clipped = await page.evaluate(() => {
    const selectors = 'h1, h2, h3, h4, .banco-status-pill, .guia-materia-badge > span:last-child, .guia-materia-close-btn';
    const candidates = [...document.querySelectorAll<HTMLElement>(selectors)]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        label: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        rect: element.getBoundingClientRect().toJSON()
      }))
      .filter((element) => element.scrollWidth > element.clientWidth + 1
        || element.rect.left < -1
        || element.rect.right > window.innerWidth + 1);
    return {
      viewport: {
        innerWidth: window.innerWidth,
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        visualWidth: window.visualViewport?.width ?? null,
        scrollX: window.scrollX
      },
      clipped: candidates
    };
  });
  expect(clipped.clipped, `${context}: encabezados o estados visibles recortados; viewport=${JSON.stringify(clipped.viewport)}`).toEqual([]);
}

async function assertHeaderBlocksDoNotOverlap(page: import('@playwright/test').Page, context: string) {
  const overlaps = await page.locator('.banco-panel__head').evaluate((head) => {
    const selectors = ['.banco-panel__lead', '.banco-header-kpis'];
    const boxes = selectors.map((selector) => {
      const element = head.querySelector(selector);
      if (!element) return { selector, missing: true, x: 0, y: 0, right: 0, bottom: 0 };
      const rect = element.getBoundingClientRect();
      return { selector, missing: false, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    });
    const [lead, kpis] = boxes;
    const overlaps = !lead.missing && !kpis.missing
      && lead.x < kpis.right && lead.right > kpis.x
      && lead.y < kpis.bottom && lead.bottom > kpis.y;
    const textSelectors = ['.banco-panel__meta-row', '.banco-panel__title', '.banco-panel__text-block > .nota'];
    const textBoxes = textSelectors.map((selector) => {
      const element = head.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true, x: 0, y: 0, right: 0, bottom: 0, scrollWidth: 0, clientWidth: 0, scrollHeight: 0, clientHeight: 0 };
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      };
    });
    const textOverlaps = [];
    for (let index = 0; index < textBoxes.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < textBoxes.length; otherIndex += 1) {
        const first = textBoxes[index];
        const second = textBoxes[otherIndex];
        if (first.missing || second.missing) continue;
        const width = Math.min(first.right, second.right) - Math.max(first.x, second.x);
        const height = Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y);
        if (width > 1 && height > 1) textOverlaps.push(`${first.selector} <> ${second.selector} (${Math.round(width)}×${Math.round(height)} px)`);
      }
    }
    return { boxes, overlaps, textBoxes, textOverlaps };
  });
  expect(overlaps.boxes.every((box) => !box.missing), `${context}: falta un bloque del encabezado`).toBe(true);
  expect(overlaps.overlaps, `${context}: el resumen y el encabezado se superponen`).toBe(false);
  expect(overlaps.textBoxes.every((box) => !box.missing), `${context}: falta texto del encabezado`).toBe(true);
  expect(overlaps.textOverlaps, `${context}: texto del encabezado o resumen académico superpuesto; cajas=${JSON.stringify(overlaps.textBoxes)}`).toEqual([]);
  for (const box of overlaps.textBoxes) {
    expect(box.scrollWidth, `${context}: ${box.selector} desborda horizontalmente`).toBeLessThanOrEqual(box.clientWidth + 1);
    expect(box.scrollHeight, `${context}: ${box.selector} desborda verticalmente`).toBeLessThanOrEqual(box.clientHeight + 1);
  }
}

async function assertHeaderPartsAreNotCardSurfaces(page: import('@playwright/test').Page, context: string) {
  const themes = await page.locator('.banco-panel__head').evaluate((head) => {
    const selectors = ['.banco-panel__lead', '.banco-panel__text-block', '.banco-panel__meta-row', '.banco-panel__title'];
    const root = head.ownerDocument.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    const snapshots = ['light', 'dark'].map((theme) => {
      if (theme === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      const parts = selectors.map((selector) => {
        const element = head.querySelector<HTMLElement>(selector);
        if (!element) return {
          selector,
          missing: true,
          borderWidth: 'unknown',
          borderRadius: 'unknown',
          backgroundImage: 'unknown',
          boxShadow: 'unknown',
          overflow: 'unknown'
        };
        const style = getComputedStyle(element);
        return {
          selector,
          missing: false,
          borderWidth: style.borderWidth,
          borderRadius: style.borderRadius,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          overflow: style.overflow
        };
      });
      return { theme, parts };
    });
    if (previousTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', previousTheme);
    return snapshots;
  });

  for (const { theme, parts } of themes) {
    expect(parts.every((part) => !part.missing), `${context} (${theme}): falta una parte estructural del encabezado`).toBe(true);
    for (const part of parts) {
      const description = `${context} (${theme}): ${part.selector} se interpretó como tarjeta; ${JSON.stringify(part)}`;
      expect(part.borderWidth, description).toBe('0px');
      expect(part.borderRadius, description).toBe('0px');
      expect(part.backgroundImage, description).toBe('none');
      expect(part.boxShadow, description).toBe('none');
      expect(part.overflow, `${context} (${theme}): ${part.selector} recorta contenido; ${JSON.stringify(part)}`).toBe('visible');
    }
  }
}

async function assertVisibleTabLabel(nav: import('@playwright/test').Locator, label: string) {
  const button = nav.getByRole('button', { name: label, exact: true });
  const layout = await button.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(layout.scrollWidth, `la etiqueta de navegación "${label}" se recorta horizontalmente`).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.scrollHeight, `la etiqueta de navegación "${label}" se recorta verticalmente`).toBeLessThanOrEqual(layout.clientHeight + 1);
}

async function assertPlantillasFormatoContrast(page: import('@playwright/test').Page) {
  const result = await page.locator('.plantillas-formato-box').evaluate((panel) => {
    const parse = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const luminance = (color: string) => {
      const channels = parse(color).map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const surface = [luminance('rgb(30, 41, 59)'), luminance('rgb(15, 23, 42)')];
    const elements = [...panel.querySelectorAll('.plantillas-temas__title, .nota, .campo__label-row, .ayuda, .plantillas-auto-status, .plantillas-formato-box__footer, .plantillas-formato-box__badge, .plantillas-formato-box__omr')]
      .filter((element) => (element as HTMLElement).innerText?.trim());
    return {
      backgroundImage: getComputedStyle(panel).backgroundImage,
      lightTheme: !document.documentElement.matches('[data-theme="dark"]'),
      text: elements.map((element) => {
        const color = getComputedStyle(element).color;
        const foreground = luminance(color);
        const minimumContrast = Math.min(...surface.map((background) => (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)));
        return { label: (element as HTMLElement).innerText.trim().slice(0, 60), color, contrast: minimumContrast };
      })
    };
  });
  expect(result.lightTheme, 'la regresión debe comprobarse con tema claro activo').toBe(true);
  expect(result.backgroundImage, 'el panel mantiene la superficie oscura declarada').toContain('rgb(30, 41, 59)');
  expect(result.text.length, 'el panel debe mostrar textos para revisar').toBeGreaterThan(5);
  for (const item of result.text) {
    expect(item.contrast, `contraste insuficiente en "${item.label}" (${item.color})`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertPlantillasStudioContrast(page: import('@playwright/test').Page) {
  const contrast = await page.locator('.plantillas-studio-intro').evaluate((panel) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance('rgb(15, 23, 42)');
    const elements = [
      ...panel.querySelectorAll('h3, p'),
      ...panel.querySelectorAll('.plantillas-studio-steps li > b')
    ].filter((element) => (element as HTMLElement).innerText.trim());
    return elements.map((element) => {
      const color = getComputedStyle(element).color;
      const foreground = luminance(color);
      return {
        label: (element as HTMLElement).innerText.trim().slice(0, 48),
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      };
    });
  });
  expect(contrast.length, 'el bloque de construcción debe contener texto y pasos visibles').toBeGreaterThan(3);
  for (const item of contrast) {
    expect(item.contrast, `contraste insuficiente en el bloque de construcción: "${item.label}"`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertPlantillasSummaryContrast(page: import('@playwright/test').Page) {
  const ratios = await page.locator('.plantillas-header-right').evaluate((header) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance('rgb(255, 255, 255)');
    return [...header.querySelectorAll('.banco-mini-kpi__num, .banco-mini-kpi__lbl')].map((element) => {
      const foreground = luminance(getComputedStyle(element).color);
      return {
        label: (element as HTMLElement).innerText.trim(),
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      };
    });
  });
  expect(ratios.length, 'el resumen de plantillas debe mostrar cifras y etiquetas').toBeGreaterThan(4);
  for (const item of ratios) {
    expect(item.contrast, `contraste insuficiente en resumen "${item.label}"`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertInteractiveControlsAreUsable(page: import('@playwright/test').Page, context: string) {
  const audit = await page.evaluate(() => {
    const selector = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="switch"]',
      '[role="checkbox"]',
      '[role="radio"]'
    ].join(',');

    function textForLabelledBy(element: Element) {
      const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
      return ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
    }

    function nameFor(element: Element) {
      const htmlElement = element as HTMLElement;
      const labelledBy = textForLabelledBy(element);
      const labels = 'labels' in element
        ? Array.from((element as HTMLInputElement).labels ?? []).map((label) => label.textContent?.trim() ?? '').join(' ')
        : '';
      return [
        element.getAttribute('aria-label'),
        labelledBy,
        labels,
        element.getAttribute('title'),
        element.getAttribute('placeholder'),
        htmlElement.innerText,
        element.textContent
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }

    function isVisible(element: Element) {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      const hiddenFromUsers = element.closest('[aria-hidden="true"], [inert]') !== null;
      return !hiddenFromUsers && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && style.pointerEvents !== 'none' && rect.width > 0 && rect.height > 0;
    }

    const controls = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    const unnamed = controls
      .filter((control) => nameFor(control).length === 0)
      .map((control) => control.outerHTML.slice(0, 160));

    const boxes = controls.map((control) => {
      const rect = (control as HTMLElement).getBoundingClientRect();
      return {
        element: control,
        label: nameFor(control) || control.tagName.toLowerCase(),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        area: rect.width * rect.height
      };
    });

    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const passwordRevealOverlay =
          (a.element.matches('.auth-pwd-toggle') && b.element.matches('.auth-input-box--key input') && a.element.parentElement === b.element.parentElement) ||
          (b.element.matches('.auth-pwd-toggle') && a.element.matches('.auth-input-box--key input') && a.element.parentElement === b.element.parentElement);
        if (passwordRevealOverlay) continue;
        const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const overlapArea = width * height;
        if (overlapArea > Math.min(a.area, b.area) * 0.4 && overlapArea > 16) {
          overlaps.push(`${a.label} <> ${b.label}`);
        }
      }
    }

    return { unnamed: unnamed.slice(0, 8), overlaps: overlaps.slice(0, 8) };
  });

  expect(audit.unnamed, `${context}: controles sin nombre accesible`).toEqual([]);
  expect(audit.overlaps, `${context}: controles interactivos solapados`).toEqual([]);
}

test.describe('GUI responsive e2e · docente', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const proto = Object.getPrototypeOf(window.location) as { reload?: () => void };
        if (proto && typeof proto.reload === 'function') {
          proto.reload = () => undefined;
        }
      } catch {
        // no-op: el objetivo es evitar recargas ajenas al flujo responsive.
      }
    });

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

    await page.route('**/api/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/api/autenticacion/ingresar')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'token-e2e' })
        });
        return;
      }

      if (url.includes('/api/autenticacion/perfil')) {
        // En "acceso estable", no hay token, por lo que simulamos que no hay sesión para que se quede en login.
        const hasToken = route.request().headers()['authorization'];
        if (!hasToken) {
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'No autorizado' }) });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docente: {
              id: 'doc-e2e',
              nombreCompleto: 'Docente E2E',
              correo: 'docente@e2e.local',
              permisos: [
                'periodos:leer',
                'alumnos:leer',
                'banco:leer',
                'plantillas:leer',
                'entregas:gestionar',
                'omr:analizar',
                'calificaciones:calificar',
                'sincronizacion:listar',
                'cuenta:leer',
                'evaluaciones:leer',
                'omr:rehidratar_lotes'
              ],
              roles: ['docente']
            }
          })
        });
        return;
      }

      if (url.includes('/api/alumnos')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
        return;
      }

      if (url.includes('/api/periodos')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
        return;
      }

      if (url.includes('/api/examenes/plantillas')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plantillas: [] }) });
        return;
      }

      if (url.includes('/api/banco-preguntas')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preguntas: [] }) });
        return;
      }

      if (url.includes('/api/calificaciones/revision/solicitudes')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ solicitudes: [] }) });
        return;
      }

      if (url.includes('/api/salud/ip-local')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ips: ['192.168.1.50'], preferida: '192.168.1.50' })
        });
        return;
      }

      if (url.includes('/api/salud/qr')) {
        const texto = new URL(url).searchParams.get('texto') ?? '';
        const imagenQr = await QRCode.toBuffer(texto, {
          margin: 1,
          width: 360,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        await route.fulfill({ status: 200, contentType: 'image/png', body: imagenQr });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
  });

  for (const viewport of viewports) {
    test(`acceso estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Ir directo a /acceso para evitar el redirect de react-router
      await page.goto('/acceso', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: /Bienvenido a EvaluaPro|Plataforma Docente|Ingresar|Crear cuenta/i }).first()).toBeVisible({ timeout: 15_000 });
      await assertNoHorizontalOverflow(page, `Docente acceso ${viewport.name}`);
      await assertInteractiveControlsAreUsable(page, `Docente acceso ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile') {
        await captureEvidence(page, 'docente', 'login', viewport.name);
      }
    });
  }

  for (const viewport of viewports) {
    test(`recorre pantallas operativas en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.setItem('tokenDocente', 'token-e2e');
      });
      await page.route('**/api/autenticacion/perfil', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docente: {
              _id: 'docente-e2e',
              nombre: 'Docente E2E',
              correo: 'e2e@evaluapro.local',
              permisos: [
                'periodos:leer', 'periodos:gestionar', 'alumnos:leer', 'alumnos:gestionar',
                'banco:leer', 'plantillas:leer', 'entregas:gestionar', 'omr:analizar',
                'calificaciones:calificar', 'sincronizacion:listar', 'cuenta:leer',
                'evaluaciones:leer', 'omr:rehidratar_lotes'
              ],
              roles: ['docente']
            }
          })
        });
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });

      const tabs: TabCase[] = [
        { label: 'Materias', slug: 'periodos' },
        { label: 'Alumnos', slug: 'alumnos' },
        { label: 'Banco', slug: 'banco' },
        { label: 'Diseño de Exámenes', slug: 'plantillas' },
        { label: 'Entrega', slug: 'entrega' },
        { label: 'Calificaciones', slug: 'calificaciones' },
        { label: 'Rehidratacion', slug: 'rehidratacion' },
        { label: 'Evaluaciones', slug: 'evaluaciones' },
        { label: 'Sincronización', slug: 'sincronizacion' },
        { label: 'Cuenta', slug: 'cuenta' }
      ];

      for (const tab of tabs) {
        await nav.getByRole('button', { name: tab.label }).click();
        const activeTab = nav.getByRole('button', { name: tab.label });
        await expect(activeTab).toHaveAttribute('aria-current', 'page');
        if (tab.slug === 'plantillas') {
          await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
          await expect(page.locator('.plantillas-formato-box')).toBeVisible();
          await expect(page.locator('.plantillas-studio-intro')).toBeVisible();
          await assertPlantillasFormatoContrast(page);
          await assertPlantillasStudioContrast(page);
          await assertPlantillasSummaryContrast(page);
        }
        if (viewport.name === 'mobile') await assertVisibleTabLabel(nav, tab.label);
        if (tab.slug === 'calificaciones') {
          await assertHeaderPartsAreNotCardSurfaces(page, `${viewport.name} / calificaciones`);
          await assertHeaderBlocksDoNotOverlap(page, `${viewport.name} / calificaciones`);
        }
        await page.waitForTimeout(300);
        await assertNoHorizontalOverflow(page, `Docente ${viewport.name} / ${tab.slug}`);
        await assertVisibleHeadersFit(page, `Docente ${viewport.name} / ${tab.slug}`);
        await assertInteractiveControlsAreUsable(page, `Docente ${viewport.name} / ${tab.slug}`);
        if (tab.slug === 'entrega') {
          const qr = page.getByRole('img', { name: 'QR para abrir en movil' });
          await expect(qr).toBeVisible();
          await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
          await expect(page.getByText(/No se pudo detectar la IP local|No se pudo generar el QR/)).toHaveCount(0);
          await page.mouse.move(0, 0);
          await page.locator('.toast').waitFor({ state: 'detached', timeout: 8_000 }).catch(() => undefined);
        }
        await captureEvidence(page, 'docente', tab.slug, viewport.name);
      }
    });
  }

  test('reinscribe visualmente un grupo archivado en una materia activa', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-reinscripcion-e2e'));
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-reinscripcion-e2e', nombre: 'Docente E2E', correo: 'e2e@evaluapro.local',
          permisos: ['periodos:leer', 'alumnos:leer', 'alumnos:gestionar'], roles: ['docente']
        } })
      });
    });
    await page.route('**/api/periodos**', async (route) => {
      const archived = new URL(route.request().url()).searchParams.get('activo') === '0';
      const periodos = archived
        ? [{ _id: 'materia-archivada-e2e', nombre: 'Materia anterior E2E', activo: false, grupos: ['3A'] }]
        : [{ _id: 'materia-nueva-e2e', nombre: 'Materia nueva E2E', activo: true, grupos: [] }];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos }) });
    });
    await page.route('**/api/alumnos**', async (route) => {
      if (route.request().method() === 'POST' && route.request().url().includes('/reinscribir-grupo-archivado')) {
        expect(route.request().postDataJSON()).toEqual({
          periodoOrigenId: 'materia-archivada-e2e', periodoDestinoId: 'materia-nueva-e2e', grupo: '3A'
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, grupo: '3A', totalSeleccionados: 2, reinscritos: 2, yaInscritos: 0 })
        });
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ alumnos: [
            { _id: 'alumno-1-e2e', periodoId: 'materia-archivada-e2e', matricula: 'CUH111111111', nombreCompleto: 'Ana Ejemplo', nombres: 'Ana', apellidos: 'Ejemplo', correo: 'ana@cuh.mx', grupo: '3A', activo: false },
            { _id: 'alumno-2-e2e', periodoId: 'materia-archivada-e2e', matricula: 'CUH222222222', nombreCompleto: 'Luis Ejemplo', nombres: 'Luis', apellidos: 'Ejemplo', correo: 'luis@cuh.mx', grupo: '3A', activo: false }
          ] })
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.getByRole('button', { name: 'Alumnos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reinscribir grupo de una materia archivada' })).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Reinscripción docente desktop');
    await assertInteractiveControlsAreUsable(page, 'Reinscripción docente desktop');

    const evidencia = supplementalEvidencePath('reinscripcion-grupo-archivado-e2e.png');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    await page.screenshot({ path: evidencia, fullPage: true, animations: 'disabled' });
    await page.getByLabel('Grupo archivado').selectOption('["materia-archivada-e2e","3a"]');
    await page.getByLabel('Materia activa de destino').selectOption('materia-nueva-e2e');
    await page.getByRole('button', { name: 'Reinscribir grupo', exact: true }).click();
    const confirmacion = page.getByRole('alertdialog');
    await expect(confirmacion).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: supplementalEvidencePath('reinscripcion-grupo-confirmacion-e2e.png'), fullPage: true, animations: 'disabled' });
    await confirmacion.getByRole('button', { name: 'Reinscribir grupo', exact: true }).click();
    await expect(page.getByRole('main').getByText(/^Grupo reinscrito: 2 alumnos nuevos/)).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Reinscripción confirmada desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Reinscribir grupo de una materia archivada' })).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Reinscripción docente mobile');
    await assertInteractiveControlsAreUsable(page, 'Reinscripción docente mobile');
    await page.mouse.move(0, 0);
    await page.screenshot({ path: supplementalEvidencePath('reinscripcion-grupo-archivado-mobile-e2e.png'), fullPage: true, animations: 'disabled' });
  });
});
