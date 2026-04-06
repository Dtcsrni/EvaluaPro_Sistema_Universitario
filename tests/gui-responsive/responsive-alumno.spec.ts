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

test.describe('GUI responsive e2e · alumno', () => {
  for (const viewport of viewports) {
    test(`login estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByText(/Portal Alumno/i)).toBeVisible();
      await expect(page.getByLabel('Codigo de acceso')).toBeVisible();
      await expect(page.getByLabel('Matricula')).toBeVisible();
      await expect(page.getByRole('button', { name: /Consultar/i })).toBeVisible();

      await assertNoHorizontalOverflow(page, `Alumno ${viewport.name}`);
    });
  }
});
