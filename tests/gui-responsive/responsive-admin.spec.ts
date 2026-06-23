/**
 * responsive-admin.spec
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

const viewports: ViewportCase[] = [
  { name: 'desktop-lg', width: 1366, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 }
];

async function captureEvidence(page: import('@playwright/test').Page, screen: string, viewport: string) {
  await page.screenshot({ path: `reports/qa/latest/gui-admin-${screen}-${viewport}.png`, fullPage: false });
}

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, context: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const docOverflow = Math.max(doc.scrollWidth - doc.clientWidth, body.scrollWidth - body.clientWidth);
    const root = document.querySelector('#root');
    const rootOverflow = root ? root.scrollWidth - root.clientWidth : 0;
    return Math.max(docOverflow, rootOverflow);
  });
  expect(overflow, `${context}: overflow horizontal detectado`).toBeLessThanOrEqual(1);
}

async function assertInteractiveControlsAreNamed(page: import('@playwright/test').Page, context: string) {
  const unnamed = await page.evaluate(() => {
    const selector = 'button,a[href],input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"]';

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
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .filter((element) => nameFor(element).length === 0)
      .map((element) => element.outerHTML.slice(0, 160));
  });
  expect(unnamed, `${context}: controles sin nombre accesible`).toEqual([]);
}

test.describe('GUI responsive e2e · admin negocio', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/api/autenticacion/perfil')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            docente: {
              id: 'admin-e2e',
              nombreCompleto: 'Admin Negocio E2E',
              correo: 'admin@e2e.local',
              permisos: ['comercial:metricas:leer', 'comercial:tenants:leer']
            }
          })
        });
        return;
      }

      if (url.includes('/api/autenticacion/capacidades-integraciones')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ capacidadesIntegraciones: { smtpBackend: true } })
        });
        return;
      }

      if (url.includes('/api/admin-negocio/dashboard/resumen')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            resumen: {
              totalTenants: 12,
              suscripcionesActivas: 8,
              suscripcionesPastDue: 1,
              mrrMxn: 120000,
              cobranzaPendienteMxn: 15000,
              conversionTrial: 0.42,
              churnMensual: 0.03,
              margenBrutoMinimo: 0.6
            }
          })
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
  });

  for (const viewport of viewports) {
    test(`shell estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // El panel de negocio refresca datos de forma periódica; la UI visible es la condición estable.
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByText(/Panel de Negocio EvaluaPro/i)).toBeVisible();
      await expect(page.getByRole('navigation', { name: /Vistas del panel de negocio/i })).toBeVisible();
      await expect(page.getByText(/Cómo operar/i)).toBeVisible();

      await assertNoHorizontalOverflow(page, `Admin negocio ${viewport.name}`);
      await assertInteractiveControlsAreNamed(page, `Admin negocio ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile') {
        await captureEvidence(page, 'dashboard', viewport.name);
      }

      await page.getByRole('button', { name: /^Tenants\b/i }).click();
      await expect(page.getByRole('heading', { name: /Nuevo tenant/i })).toBeVisible();
      await expect(page.getByLabel('Tenant ID')).toBeVisible();

      await assertNoHorizontalOverflow(page, `Admin negocio tenants ${viewport.name}`);
      await assertInteractiveControlsAreNamed(page, `Admin negocio tenants ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile') {
        await captureEvidence(page, 'tenants', viewport.name);
      }
    });
  }
});
