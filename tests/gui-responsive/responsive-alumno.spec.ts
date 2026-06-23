/**
 * responsive-alumno.spec
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
  { name: 'tablet-sm', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

async function captureEvidence(page: import('@playwright/test').Page, screen: string, viewport: string) {
  await page.screenshot({ path: `reports/qa/latest/gui-alumno-${screen}-${viewport}.png`, fullPage: false });
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
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .filter((element) => nameFor(element).length === 0)
      .map((element) => element.outerHTML.slice(0, 160));
  });
  expect(unnamed, `${context}: controles sin nombre accesible`).toEqual([]);
}

test.describe('GUI responsive e2e · alumno', () => {
  test.beforeEach(async ({ page }) => {
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
                calificacionExamenFinalTexto: '8.5',
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
          body: JSON.stringify({ ok: true, data: { materias: [{ nombre: 'Matematicas', estado: 'activa' }] } })
        });
        return;
      }

      if (url.includes('/api/portal/agenda')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: { agenda: [{ titulo: 'Revision de resultados', fecha: '2026-05-27' }] } })
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

  for (const viewport of viewports) {
    test(`login estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByText(/Portal Alumno/i)).toBeVisible();
      await expect(page.getByLabel('Codigo de acceso')).toBeVisible();
      await expect(page.getByLabel('Matricula')).toBeVisible();
      await expect(page.getByRole('button', { name: /Consultar/i })).toBeVisible();

      await assertNoHorizontalOverflow(page, `Alumno ${viewport.name}`);
      await assertInteractiveControlsAreNamed(page, `Alumno ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile') {
        await captureEvidence(page, 'login', viewport.name);
      }

      await page.evaluate(() => localStorage.setItem('tokenAlumno', 'token-alumno-e2e'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Recargar/i }).click();
      await expect(page.getByText(/Folio F-001/i)).toBeVisible();
      await expect(page.getByText(/1 folio/i)).toBeVisible();

      await assertNoHorizontalOverflow(page, `Alumno resultados ${viewport.name}`);
      await assertInteractiveControlsAreNamed(page, `Alumno resultados ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile') {
        await captureEvidence(page, 'resultados', viewport.name);
      }
    });
  }
});
