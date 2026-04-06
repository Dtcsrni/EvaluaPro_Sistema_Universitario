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
    test(`acceso estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // El shell docente mantiene polling en segundo plano; la señal fiable es la UI operativa.
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: /Acceso docente/i })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: /^Ingresar$/ }).first()).toBeVisible();
    });
  }
});
