import { createHash } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import type { Page, ScreenshotOptions } from '@playwright/test';

type EvidenceRecord = {
  name: string;
  width: number;
  height: number;
  viewport: { width: number; height: number };
  sha256: string;
  bytes: number;
  visibleTextLength: number;
  visibleControls: number;
};

async function auditVisualState(page: Page, name: string, options: ScreenshotOptions, captureImage: (options: ScreenshotOptions) => Promise<Buffer>): Promise<{ record: EvidenceRecord; image: Buffer }> {
  const audit = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const selector = 'button,a[href],input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="switch"],[role="checkbox"],[role="radio"]';
    const controls = [...document.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const unnamed = controls.filter((element) => {
      const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
      const labelledBy = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
      const labels = 'labels' in element
        ? [...((element as HTMLInputElement).labels ?? [])].map((label) => label.textContent ?? '').join(' ')
        : '';
      const text = (element as HTMLElement).innerText ?? element.textContent ?? '';
      return ![
        element.getAttribute('aria-label'), labelledBy, labels,
        element.getAttribute('title'), element.getAttribute('placeholder'), text
      ].some((value) => value?.trim());
    }).map((element) => element.outerHTML.slice(0, 180));
    const boxes = controls.map((element) => {
      const rect = element.getBoundingClientRect();
      return { element, label: element.getAttribute('aria-label') || (element as HTMLElement).innerText || element.tagName, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, area: rect.width * rect.height };
    });
    const overlaps: string[] = [];
    for (let index = 0; index < boxes.length; index++) {
      for (let otherIndex = index + 1; otherIndex < boxes.length; otherIndex++) {
        const first = boxes[index];
        const second = boxes[otherIndex];
        const passwordToggle = (first.element.matches('.auth-pwd-toggle') && second.element.matches('.auth-input-box--key input'))
          || (second.element.matches('.auth-pwd-toggle') && first.element.matches('.auth-input-box--key input'));
        if (passwordToggle) continue;
        const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
        const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
        const area = width * height;
        if (area > 16 && area > Math.min(first.area, second.area) * 0.4) overlaps.push(`${first.label} <> ${second.label}`);
      }
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      overflow: Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth, 0),
      textLength: (body.innerText ?? '').replace(/\s+/g, ' ').trim().length,
      visibleControls: controls.length,
      unnamed: unnamed.slice(0, 8),
      overlaps: overlaps.slice(0, 8)
    };
  });

  expect(audit.width, `${name}: viewport debe tener ancho válido`).toBeGreaterThan(0);
  expect(audit.height, `${name}: viewport debe tener alto válido`).toBeGreaterThan(0);
  expect(audit.overflow, `${name}: overflow horizontal`).toBeLessThanOrEqual(1);
  expect(audit.textLength, `${name}: la captura no debe corresponder a una vista vacía`).toBeGreaterThan(20);
  expect(audit.unnamed, `${name}: controles interactivos sin nombre`).toEqual([]);
  expect(audit.overlaps, `${name}: controles interactivos solapados`).toEqual([]);

  const imageOptions = { ...options, animations: 'disabled' as const };
  const image = await captureImage(imageOptions);
  expect(image.subarray(0, 8).toString('hex'), `${name}: encabezado PNG inválido`).toBe('89504e470d0a1a0a');
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  expect(width, `${name}: PNG sin ancho`).toBeGreaterThan(0);
  expect(height, `${name}: PNG sin alto`).toBeGreaterThan(0);
  expect(width, `${name}: ancho PNG no coincide con el viewport`).toBe(audit.width);
  expect(height, `${name}: la captura corta la altura del viewport`).toBeGreaterThanOrEqual(audit.height);
  expect(image.byteLength, `${name}: PNG vacío o monocromo`).toBeGreaterThan(1_000);

  return {
    image,
    record: {
      name,
      width,
      height,
      viewport: { width: audit.width, height: audit.height },
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: image.byteLength,
      visibleTextLength: audit.textLength,
      visibleControls: audit.visibleControls
    }
  };
}

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use, testInfo) => {
    const records: EvidenceRecord[] = [];
    const originalScreenshot = page.screenshot.bind(page);
    let captureIndex = 0;
    page.screenshot = async (options: ScreenshotOptions = {}) => {
      const name = `${testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${++captureIndex}`;
      const { record, image } = await auditVisualState(page, name, options, originalScreenshot);
      records.push(record);
      await testInfo.attach(`gui-${name}.png`, { body: image, contentType: 'image/png' });
      return image;
    };

    try {
      await use(page);
    } finally {
      if (records.length > 0) {
        await testInfo.attach('gui-visual-evidence-manifest.json', {
          body: Buffer.from(JSON.stringify({
            test: testInfo.title,
            project: testInfo.project.name,
            viewport: testInfo.project.use.viewport ?? null,
            captures: records
          }, null, 2)),
          contentType: 'application/json'
        });
      }
    }
  }
});

export { expect } from '@playwright/test';
