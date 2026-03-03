import { expect, test } from '@playwright/test';

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

const viewports: ViewportCase[] = [
  { name: 'desktop-lg', width: 1366, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet-sm', width: 768, height: 1024 },
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

test.describe('GUI responsive e2e · docente', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/api/autenticacion/perfil')) {
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
                'cuenta:leer'
              ],
              roles: ['admin']
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
    test(`calificaciones estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.setItem('tokenDocente', 'token-e2e');
      });

      await page.goto('/', { waitUntil: 'networkidle' });

      await expect(page.getByRole('navigation', { name: /Secciones del portal docente/i })).toBeVisible();
      await page.getByRole('button', { name: 'Calificaciones' }).click();
      await expect(page.getByRole('heading', { name: /Calificaciones/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Escaneo y revisión OMR/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Selección manual por entregado/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Usar examen para calificación manual/i })).toBeVisible();

      await assertNoHorizontalOverflow(page, `Docente ${viewport.name}`);

      const actionButton = page.getByRole('button', { name: /Usar examen para calificación manual/i });
      const box = await actionButton.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });
  }
});
