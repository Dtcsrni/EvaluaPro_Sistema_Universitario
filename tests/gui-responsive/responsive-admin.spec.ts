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
      await page.goto('/', { waitUntil: 'networkidle' });

      await expect(page.getByText(/Panel de Negocio EvaluaPro/i)).toBeVisible();
      await expect(page.getByRole('navigation', { name: /Vistas del panel de negocio/i })).toBeVisible();
      await expect(page.getByText(/Cómo operar/i)).toBeVisible();

      await assertNoHorizontalOverflow(page, `Admin negocio ${viewport.name}`);
    });
  }
});
