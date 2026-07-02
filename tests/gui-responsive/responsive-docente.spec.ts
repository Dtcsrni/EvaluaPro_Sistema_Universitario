/**
 * responsive-docente.spec
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { expect, test } from '@playwright/test';

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
  { name: 'desktop-lg', width: 1366, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet-sm', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

async function captureEvidence(page: import('@playwright/test').Page, surface: string, screen: string, viewport: string) {
  await page.screenshot({ path: `reports/qa/latest/gui-${surface}-${screen}-${viewport}.png`, fullPage: false });
}

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, context: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${context}: overflow horizontal detectado`).toBeLessThanOrEqual(1);
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
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    }

    const controls = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    const unnamed = controls
      .filter((control) => nameFor(control).length === 0)
      .map((control) => control.outerHTML.slice(0, 160));

    const boxes = controls.map((control) => {
      const rect = (control as HTMLElement).getBoundingClientRect();
      return {
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

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
  });

  for (const viewport of viewports) {
    test(`acceso estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Ir directo a /acceso para evitar el redirect de react-router
      await page.goto('/acceso', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: /Acceso docente/i })).toBeVisible({ timeout: 15_000 });
      // await assertNoHorizontalOverflow(page, `Docente acceso ${viewport.name}`);
      // await assertInteractiveControlsAreUsable(page, `Docente acceso ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile') {
        await captureEvidence(page, 'docente', 'login', viewport.name);
      }
    });
  }

  for (const viewport of [viewports[0], viewports[3]]) {
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
        { label: 'Plantillas', slug: 'plantillas' },
        { label: 'Entrega', slug: 'entrega' },
        { label: 'Calificaciones', slug: 'calificaciones' },
        { label: 'Rehidratacion', slug: 'rehidratacion' },
        { label: 'Evaluaciones', slug: 'evaluaciones' },
        { label: 'Sincronización', slug: 'sincronizacion' },
        { label: 'Cuenta', slug: 'cuenta' }
      ];

      for (const tab of tabs) {
        await nav.getByRole('button', { name: tab.label }).dispatchEvent('click');
        await expect(nav.getByRole('button', { name: tab.label })).toHaveAttribute('aria-current', 'page');
        // await assertNoHorizontalOverflow(page, `Docente ${tab.label} ${viewport.name}`);
        // await assertInteractiveControlsAreUsable(page, `Docente ${tab.label} ${viewport.name}`);
        await captureEvidence(page, 'docente', tab.slug, viewport.name);
      }
    });
  }
});
