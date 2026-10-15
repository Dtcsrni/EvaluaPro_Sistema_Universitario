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

async function auditVisualState(
  page: Page,
  name: string,
  options: ScreenshotOptions,
  captureImage: (options: ScreenshotOptions) => Promise<Buffer>,
  attachImage: (image: Buffer) => Promise<void>
): Promise<{ record: EvidenceRecord; image: Buffer }> {
  const audit = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const selector = 'button,a[href],input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="switch"],[role="checkbox"],[role="radio"]';
    const modal = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
    const controls = [...(modal ?? document).querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const hiddenFromUsers = element.closest('[aria-hidden="true"], [inert]') !== null;
      return !hiddenFromUsers
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && style.pointerEvents !== 'none'
        && rect.width > 0
        && rect.height > 0;
    });
    const unnamed = controls.filter((element) => {
      const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
      const labelledBy = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
      const labels = 'labels' in element
        ? [...((element as HTMLInputElement).labels ?? [])].map((label) => label.textContent ?? '').join(' ')
        : '';
      const text = (element as HTMLElement).innerText?.trim() || element.textContent?.trim() || '';
      return ![
        element.getAttribute('aria-label'), labelledBy, labels,
        element.getAttribute('title'), element.getAttribute('placeholder'), text
      ].some((value) => value?.trim());
    }).map((element) => element.outerHTML.slice(0, 180));
    const brokenImages = [...document.images].filter((image) => {
      const style = getComputedStyle(image);
      const rect = image.getBoundingClientRect();
      const visible = !image.closest('[aria-hidden="true"], [inert]')
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && rect.width > 0
        && rect.height > 0;
      return visible && Boolean(image.currentSrc || image.src) && (!image.complete || image.naturalWidth === 0);
    }).map((image) => image.alt?.trim() || (() => {
      try { return new URL(image.currentSrc || image.src).pathname; }
      catch { return image.currentSrc || image.src; }
    })());
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
        if (area > 16 && area > Math.min(first.area, second.area) * 0.4) {
          overlaps.push(`${first.label} <> ${second.label} (${Math.round(width)}×${Math.round(height)} px)`);
        }
      }
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      overflow: Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth, 0),
      textLength: (body.innerText ?? '').replace(/\s+/g, ' ').trim().length,
      visibleControls: controls.length,
      modal: modal ? {
        hasAccessibleName: Boolean(modal.getAttribute('aria-label') || modal.getAttribute('aria-labelledby')?.trim()),
        focusInside: modal.contains(document.activeElement),
        insideViewport: (() => {
          const rect = modal.getBoundingClientRect();
          return rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
        })()
      } : null,
      unnamed: unnamed.slice(0, 8),
      brokenImages: brokenImages.slice(0, 8),
      overlaps: overlaps.slice(0, 8)
    };
  });

  const imageOptions = { ...options, animations: 'disabled' as const };
  const image = await captureImage(imageOptions);
  await attachImage(image);
  expect(audit.width, `${name}: viewport debe tener ancho válido`).toBeGreaterThan(0);
  expect(audit.height, `${name}: viewport debe tener alto válido`).toBeGreaterThan(0);
  expect(audit.overflow, `${name}: overflow horizontal`).toBeLessThanOrEqual(1);
  expect(audit.textLength, `${name}: la captura no debe corresponder a una vista vacía`).toBeGreaterThan(20);
  expect(audit.unnamed, `${name}: controles interactivos sin nombre`).toEqual([]);
  expect(audit.brokenImages, `${name}: imágenes visibles que no cargaron`).toEqual([]);
  expect(audit.overlaps, `${name}: controles interactivos solapados`).toEqual([]);
  if (audit.modal) {
    expect(audit.modal.hasAccessibleName, `${name}: modal sin nombre accesible`).toBe(true);
    expect(audit.modal.focusInside, `${name}: el foco debe permanecer dentro del modal`).toBe(true);
    expect(audit.modal.insideViewport, `${name}: modal desbordado del viewport`).toBe(true);
  }

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
      const { record, image } = await auditVisualState(
        page,
        name,
        options,
        originalScreenshot,
        (captured) => testInfo.attach(`gui-${name}.png`, { body: captured, contentType: 'image/png' })
      );
      records.push(record);
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
