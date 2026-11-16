Warning: truncated output (original token count: 140258)
Total output lines: 8935

/**
 * responsive-docente.spec
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { expect, test } from './visual-fixtures';
import type { Locator } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generarHtmlCalificaciones } from '../../apps/backend/src/modulos/modulo_analiticas/servicioExportacionHtmlCalificaciones.ts';
import type { ListaAcademicaFila } from '../../apps/backend/src/modulos/modulo_analiticas/tiposListaAcademica.ts';
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

async function seleccionarEspacioClassroom(navegacion: Locator) {
  const selectorMovil = navegacion.locator('.calificaciones-workspace-nav__mobile-select');
  if (await selectorMovil.isVisible()) {
    await selectorMovil.selectOption({ label: 'Classroom' });
    return;
  }
  await navegacion.getByRole('button', { name: /Classroom/ }).click();
}

const viewports: ViewportCase[] = [
  { name: 'desktop-lg', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'desktop-header', width: 1366, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet-sm', width: 768, height: 1024 },
  { name: 'mobile-narrow', width: 320, height: 800 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];

async function captureEvidence(
  page: import('@playwright/test').Page,
  surface: string,
  screen: string,
  viewport: string,
  options: { fullPage?: boolean } = {}
) {
  // Evita que el tooltip contextual del último control accionado tape la
  // evidencia visual; la ayuda sigue disponible al pasar el cursor o enfocar.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(80);
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await page.screenshot({ path: `${evidenceDir}/gui-${surface}-${screen}-${viewport}.png`, fullPage: options.fullPage ?? false });
}

const supplementalEvidencePath = (name: string) => `${process.env.E2E_SCREENSHOT_DIR || 'test-results'}/${name}`;

async function assertTextContrast(locator: import('@playwright/test').Locator, description: string) {
  const ratios = await locator.evaluateAll((elements) => elements.map((element) => {
    const parse = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const linear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: string) => {
      const [red, green, blue] = parse(color).map(linear);
      return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
    };
    const style = getComputedStyle(element);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  }));

  expect(ratios.length, `${description}: debe haber etiquetas visibles`).toBeGreaterThan(0);
  for (const ratio of ratios) {
    expect(ratio, `${description}: contraste ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertTextContrastOnBackdrop(
  locator: import('@playwright/test').Locator,
  backdrop: import('@playwright/test').Locator,
  description: string
) {
  const foregrounds = await locator.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
  const background = await backdrop.evaluate((element) => getComputedStyle(element).backgroundColor);
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const [red, green, blue] = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * red!) + (0.7152 * green!) + (0.0722 * blue!);
  };
  const backgroundLuminance = luminance(background);
  expect(foregrounds.length, `${description}: debe haber un enlace visible`).toBeGreaterThan(0);
  for (const foreground of foregrounds) {
    const foregroundLuminance = luminance(foreground);
    const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
    expect(ratio, `${description}: contraste ${ratio.toFixed(2)}:1 (${foreground} sobre ${background})`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertRenderedTextContrast(
  locator: import('@playwright/test').Locator,
  description: string,
  pseudoElement = ''
) {
  await locator.evaluate(async (element) => {
    const chain: Element[] = [];
    for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) chain.push(current);
    const transitions = chain.flatMap((target) => target.getAnimations())
      .filter((animation) => 'transitionProperty' in animation && animation.effect?.getTiming().iterations !== Infinity);
    await Promise.all(transitions.map((animation) => animation.finished.catch(() => undefined)));
  });
  const result = await locator.evaluate((element, pseudo) => {
    const parse = (color: string) => {
      const rgb = color.match(/^rgba?\(([^)]+)\)$/);
      if (rgb) {
        const channels = rgb[1]!.split(/[,/ ]+/).filter(Boolean).map(Number);
        return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
      }
      const srgb = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
      if (srgb) {
        return {
          rgb: [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255],
          alpha: srgb[4] === undefined ? 1 : Number(srgb[4])
        };
      }
      throw new Error(`Formato de color calculado no compatible: ${color}`);
    };
    const composite = (foreground: ReturnType<typeof parse>, background: number[]) =>
      foreground.rgb.map((channel, index) => channel * foreground.alpha + background[index]! * (1 - foreground.alpha));
    const chain: Element[] = [];
    for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) chain.push(current);
    let background = parse(getComputedStyle(document.body).backgroundColor).rgb;
    for (const ancestor of chain.reverse()) {
      background = composite(parse(getComputedStyle(ancestor).backgroundColor), background);
    }
    const foreground = getComputedStyle(element, pseudo).color;
    const luminance = (color: number[]) => color.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
    const foregroundLuminance = luminance(parse(foreground).rgb);
    const backgroundLuminance = luminance(background);
    return {
      foreground,
      background: `rgb(${background.map((channel) => Math.round(channel)).join(', ')})`,
      ratio: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
    };
  }, pseudoElement);
  expect(result.ratio, `${description}: contraste ${result.ratio.toFixed(2)}:1 (${result.foreground} sobre ${result.background})`).toBeGreaterThanOrEqual(4.5);
}

async function assertEvaluacionesSummaryContrast(
  region: import('@playwright/test').Locator,
  context: string
) {
  const pairs: Array<[string, string]> = [
    ['.evaluaciones-resumen__politica dt', 'etiqueta de política'],
    ['.evaluaciones-resumen__politica dd', 'nombre de política'],
    ['.evaluaciones-resumen__grupo h5', 'título del grupo'],
    ['.evaluaciones-resumen__grupo dt', 'etiqueta de corte'],
    ['.evaluaciones-resumen__grupo dd', 'valor de corte'],
    ['.evaluaciones-resumen__bloques span', 'etiqueta de bloque'],
    ['.evaluaciones-resumen__bloques strong', 'valor de bloque'],
    ['.evaluaciones-resumen__final h5', 'título de calificación final'],
    ['.evaluaciones-resumen__final dt', 'etiqueta de calificación'],
    ['.evaluaciones-resumen__final dd', 'valor de calificación'],
    ['.evaluaciones-resumen__estado > span', 'etiqueta del estado']
  ];
  for (const [selector, label] of pairs) {
    await assertRenderedTextContrast(region.locator(selector).first(), `${context}: ${label}`);
  }
}

async function assertDisabledButtonContrast(locator: import('@playwright/test').Locator, description: string) {
  await locator.evaluate(async (element) => {
    const animations = [element, ...element.querySelectorAll('*')].flatMap((target) => target.getAnimations());
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
  const result = await locator.evaluate((element) => {
    const channels = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const luminance = (color: string) => channels(color).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
    const buttonStyle = getComputedStyle(element);
    const label = element.querySelector<HTMLElement>('.boton__texto') ?? element;
    const foreground = getComputedStyle(label).color;
    const background = buttonStyle.backgroundColor;
    const light = luminance(foreground);
    const dark = luminance(background);
    return {
      foreground,
      background,
      backgroundImage: buttonStyle.backgroundImage,
      opacity: buttonStyle.opacity,
      ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)
    };
  });
  expect(result.backgroundImage, `${description}: superficie opaca para el texto`).toBe('none');
  expect(result.opacity, `${description}: texto sin desvanecer`).toBe('1');
  expect(result.ratio, `${description}: contraste ${result.ratio.toFixed(2)}:1 (${result.foreground} sobre ${result.background})`).toBeGreaterThanOrEqual(4.5);
}

async function assertSolidButtonTextContrast(locator: import('@playwright/test').Locator, description: string) {
  await locator.evaluate(async (element) => {
    const animations = [element, ...element.querySelectorAll('*')].flatMap((target) => target.getAnimations());
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
  const result = await locator.evaluate((element) => {
    const channels = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const luminance = (color: string) => channels(color).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
    const buttonStyle = getComputedStyle(element);
    const label = element.querySelector<HTMLElement>('.boton__texto') ?? element;
    const foreground = getComputedStyle(label).color;
    const background = buttonStyle.backgroundColor;
    const light = luminance(foreground);
    const dark = luminance(background);
    return {
      foreground,
      background,
      backgroundImage: buttonStyle.backgroundImage,
      opacity: buttonStyle.opacity,
      ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)
    };
  });
  expect(result.background, `${description}: el fondo debe ser opaco; ${JSON.stringify(result)}`).toMatch(/^rgb\(/);
  expect(result.backgroundImage, `${description}: sin gradiente bajo el texto`).toBe('none');
  expect(result.opacity, `${description}: texto sin desvanecer`).toBe('1');
  expect(result.ratio, `${description}: contraste ${result.ratio.toFixed(2)}:1 (${result.foreground} sobre ${result.background})`).toBeGreaterThanOrEqual(4.5);
}

async function setVisibleTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  const themeButton = page.getByRole('button', { name: /^Tema:/ });
  const selectedLabel = theme === 'light' ? 'Tema: Claro' : 'Tema: Oscuro';
  for (let attempt = 0; attempt < 3 && await themeButton.getAttribute('aria-label') !== selectedLabel; attempt += 1) {
    const currentPreference = await themeButton.getAttribute('aria-label');
    await themeButton.click();
    await expect.poll(() => themeButton.getAttribute('aria-label')).not.toBe(currentPreference);
  }
  await expect(themeButton).toHaveAttribute('aria-label', selectedLabel);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
    .toBe(theme);
}

async function assertPlantillasLightPanelContrast(page: import('@playwright/test').Page, context: string) {
  const pares = await page.locator('#plantillas-panel-generacion .plantillas-temas-box').evaluateAll((boxes) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return (linear[0] * 0.2126) + (linear[1] * 0.7152) + (linear[2] * 0.0722);
    };
    return boxes.flatMap((box) => {
      const background = getComputedStyle(box).backgroundColor;
      return [...box.querySelectorAll<HTMLElement>('.plantillas-temas__title, .nota')].map((element) => {
        const foreground = getComputedStyle(element).color;
        const light = luminance(foreground);
        const dark = luminance(background);
        return { text: element.innerText.trim(), background, foreground, ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) };
      });
    });
  });
  expect(pares.length, `${context}: títulos y ayudas para revisar`).toBeGreaterThan(0);
  for (const par of pares) expect(par.ratio, `${context}: ${par.text}, contraste ${par.ratio.toFixed(2)}:1 (${par.foreground} sobre ${par.background})`).toBeGreaterThanOrEqual(4.5);
}

test('reporte HTML individual funciona offline en navegador con datos ficticios', async ({ page }) => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'evaluapro-reporte-html-'));
  const secreto = 'Secreto-maestro-de-ciclo-2026-seguro';
  const filas = [
    {
      matricula: 'A001', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', grupo: '1A',
      parcial1: '8', parcial2: '', global: '9', calificacionFinalCurso: ''
    },
    {
      matricula: 'B002', nombre: 'Luis', apellidoPaterno: 'García', apellidoMaterno: 'Núñez', grupo: '1A',
      parcial1: '6', parcial2: '7', global: '', calificacionFinalCurso: '7'
    }
  ] as unknown as ListaAcademicaFila[];

  try {
    const { html, credenciales } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra · Grupo 1A', cicloLectivo: '2026–2027', filas, modo: 'individual', secretoCiclo: secreto,
      generadoEn: new Date('2026-10-29T12:00:00.000Z')
    });
    const archivo = path.join(directorio, 'reporte-calificaciones.html');
    await writeFile(archivo, html, 'utf8');

    expect(html).not.toContain(secreto);
    expect(html).not.toContain('Ana Pérez López');
    expect(html).not.toContain('A001');
    expect(html).not.toContain('Luis García Núñez');
    expect(html).not.toContain('B002');
    expect(html).not.toContain('https://');

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(pathToFileURL(archivo).href);
    await expect(page.getByRole('heading', { name: 'Consulta individual' })).toBeVisible();
    await expect(page.getByLabel('Matrícula')).toBeVisible();
    await expect(page.getByLabel('Clave personal')).toBeVisible();
    const campoClave = page.getByLabel('Clave personal');
    const botonVisibilidad = page.getByRole('button', { name: 'Mostrar clave' });
    await expect(campoClave).toHaveAttribute('type', 'password');
    await expect(botonVisibilidad).toHaveAttribute('type', 'button');
    await expect(botonVisibilidad).toHaveAttribute('aria-controls', 'clave');
    await campoClave.fill(credenciales[0].clave);
    await botonVisibilidad.focus();
    await page.keyboard.press('Enter');
    await expect(campoClave).toHaveAttribute('type', 'text');
    await expect(campoClave).toHaveValue(credenciales[0].clave);
    await expect(page.getByRole('button', { name: 'Ocultar clave' })).toBeVisible();
    await expect(page.locator('#estado')).toBeEmpty();
    await captureEvidence(page, 'reporte-html', 'clave-visible', 'mobile-narrow-320', { fullPage: true });
    await page.keyboard.press('Space');
    await expect(campoClave).toHaveAttribute('type', 'password');
    await expect(campoClave).toHaveValue(credenciales[0].clave);
    await expect(page.getByRole('button', { name: 'Mostrar clave' })).toBeVisible();
    await campoClave.fill('A'.repeat(22));
    expect(await page.evaluate(() => window.isSecureContext && Boolean(window.crypto.subtle))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await captureEvidence(page, 'reporte-html', 'consulta-inicial', 'mobile-narrow-320', { fullPage: true });

    await page.getByLabel('Matrícula').fill('A001');
    await page.getByLabel('Clave personal').fill('A'.repeat(22));
    await page.getByRole('button', { name: 'Consultar calificación' }).click();
    await expect(page.getByRole('status')).toContainText('No se encontró un resultado');
    await expect(page.getByText('Ana Pérez López')).toHaveCount(0);

    await page.getByLabel('Clave personal').fill(credenciales[0].clave);
    await page.getByLabel('Clave personal').press('Enter');
    await expect(page.getByRole('status')).toHaveText('Resultado disponible para esta matrícula.');
    await expect(page.getByRole('heading', { name: 'Resultado de Ana Pérez López' })).toBeVisible();
    await expect(page.locator('#resultado .grade-card__field')).toHaveCount(6);
    await expect(page.locator('#resultado')).toContainText('Parcial 1');
    await expect(page.locator('#resultado')).toContainText('8');
    await expect(page.locator('#resultado')).toContainText('Sin registro');
    await expect(page.locator('#resultado')).not.toContainText('Luis García Núñez');
    await expect(page.getByLabel('Clave personal')).toHaveValue('');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(() => page.locator('#resultado').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.locator('#resultado .grade-card__field').first().scrollIntoViewIfNeeded();
    await captureEvidence(page, 'reporte-html', 'consulta-con-resultado', 'mobile-narrow-320', { fullPage: true });
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test('reporte HTML grupal funciona offline y refluye a fichas móviles con datos ficticios', async ({ page }) => {
  const directorio = await mkdtemp(path.join(tmpdir(), 'evaluapro-reporte-grupal-html-'));
  const filas = [
    {
      matricula: 'A001', nombre: 'Ana', apellidoPaterno: 'Pérez', apellidoMaterno: 'López', grupo: '1A',
      parcial1: '8', parcial2: '', global: '9', calificacionFinalCurso: ''
    },
    {
      matricula: 'B002', nombre: 'Luis', apellidoPaterno: 'García', apellidoMaterno: 'Núñez', grupo: '1A',
      parcial1: '6', parcial2: '7', global: '', calificacionFinalCurso: '7'
    }
  ] as unknown as ListaAcademicaFila[];

  try {
    const { html } = generarHtmlCalificaciones({
      nombrePeriodo: 'Álgebra · Grupo 1A', cicloLectivo: '2026–2027', filas, modo: 'grupo',
      generadoEn: new Date('2026-10-29T12:00:00.000Z')
    });
    const archivo = path.join(directorio, 'reporte-grupal-calificaciones.html');
    await writeFile(archivo, html, 'utf8');
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(pathToFileURL(archivo).href);

    await expect(page.getByRole('heading', { name: 'Álgebra · Grupo 1A' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ana Pérez López' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Luis García Núñez' })).toBeVisible();
    await expect(page.locator('.grades-table-view')).toBeHidden();
    await expect(page.locator('.grade-card-view')).toBeVisible();
    await expect(page.locator('.grade-card')).toHaveCount(2);
    const tarjetaAna = page.locator('.grade-card').filter({ has: page.getByRole('heading', { name: 'Ana Pérez López' }) });
    const camposAna = await tarjetaAna.locator('.grade-card__field').evaluateAll((campos) => campos.map((campo) => [
      campo.querySelector('dt')?.textContent?.trim() ?? '',
      campo.querySelector('dd')?.textContent?.trim() ?? ''
    ]));
    expect(camposAna).toContainEqual(['Parcial 1', '8']);
    expect(camposAna).toContainEqual(['Parcial 2', 'Sin registro']);
    await expect(page.getByText(/Este archivo contiene calificaciones del grupo/)).toBeVisible();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.grade-card-view')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (width === 320) await captureEvidence(page, 'reporte-html', 'grupo-movil-320', 'mobile-narrow-320', { fullPage: true });
      if (width === 390) await captureEvidence(page, 'reporte-html', 'grupo-movil-390', 'mobile-390', { fullPage: true });
    }

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('.grades-table-view')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await captureEvidence(page, 'reporte-html', 'grupo-escritorio-1024', 'tablet-1024', { fullPage: true });

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.grades-table-view')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('.grade-card-view')).toBeHidden();
  } finally {
    await rm(directorio, { recursive: true, force: true });
  }
});

test('Navegación de tareas de Sincronización es directa y accesible en móvil con datos ficticios', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-sync-navigation-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-sync-navigation-dummy', nombre: 'Docente de Prueba', correo: 'docente@example.invalid',
        permisos: ['periodos:leer', 'alumnos:leer', 'sincronizacion:listar', 'sincronizacion:exportar', 'sincronizacion:importar'], roles: ['docente']
      } })
    });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: …128258 tokens truncated…ivoBounds = await selectorImportacion.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right };
      });
      expect(estadoArchivoBounds.left, `Banco ${width}px: el estado del archivo debe caber en la tarjeta`).toBeGreaterThanOrEqual(estadoArchivoBounds.parentLeft - 1);
      expect(estadoArchivoBounds.right, `Banco ${width}px: el estado del archivo debe caber en la tarjeta`).toBeLessThanOrEqual(estadoArchivoBounds.parentRight + 1);
      const saveButtonBounds = await page.locator('#banco-captura .banco-form__acciones > .boton').evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const parent = button.parentElement!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right };
      });
      expect(saveButtonBounds.left, `Banco ${width}px: guardar debe caber dentro de acciones`).toBeGreaterThanOrEqual(saveButtonBounds.parentLeft - 1);
      expect(saveButtonBounds.right, `Banco ${width}px: guardar debe caber dentro de acciones`).toBeLessThanOrEqual(saveButtonBounds.parentRight + 1);
      const listedCardBounds = await page.locator('#banco-listado .banco-listado__items > li > .banco-listado__item').evaluate((card) => {
        const rect = card.getBoundingClientRect();
        const list = card.closest('ul')!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, parentLeft: list.left, parentRight: list.right };
      });
      expect(listedCardBounds.left, `Banco ${width}px: la tarjeta de reactivo debe caber en la lista`).toBeGreaterThanOrEqual(listedCardBounds.parentLeft - 1);
      expect(listedCardBounds.right, `Banco ${width}px: la tarjeta de reactivo debe caber en la lista`).toBeLessThanOrEqual(listedCardBounds.parentRight + 1);
      const topicsDisclosure = page.locator('.banco-colapsable--temas');
      if (!(await topicsDisclosure.evaluate((element) => (element as HTMLDetailsElement).open))) {
        await topicsDisclosure.locator('summary').click();
      }
      await expect(topicsDisclosure.getByRole('button', { name: 'Ajustar páginas' })).toBeVisible();
      await page.mouse.move(0, 0);
      const bankListAnimations = await page.locator('.banco-temas__lista > li, .banco-listado__items > li').evaluateAll((elements) => {
        return elements.map((element) => getComputedStyle(element).animationName);
      });
      expect(bankListAnimations.every((animationName) => animationName === 'none'), 'las filas del Banco no deben animarse encima de controles vecinos').toBe(true);
      const overlappingButton = await page.locator('.banco-listado__filtros select').evaluate((target) => {
        const box = target.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLButtonElement>('button')].filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
        }).map((button) => ({ text: button.innerText, rect: button.getBoundingClientRect().toJSON() }));
      });
      expect(overlappingButton, `Banco ${width}px: acciones de tema y filtros no deben superponerse`).toEqual([]);

      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          const root = document.documentElement;
          root.dataset.theme = value;
          root.style.colorScheme = value;
        }, theme);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const valoresKpiBanco = page.locator('.banco-form .banco-panel__head .banco-header-kpis .banco-mini-kpi__num');
        await expect(valoresKpiBanco).toHaveCount(5);
        const coloresValoresKpi = await valoresKpiBanco.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
        expect(coloresValoresKpi, `Banco ${width}px / ${theme}: los valores deben usar la tinta primaria del tema`).toEqual(
          Array(5).fill(theme === 'dark' ? 'rgb(248, 251, 255)' : 'rgb(16, 32, 51)')
        );
        const superficieEditor = page.locator('#banco-captura .rich-editor').first();
        const ayudaEditor = superficieEditor.locator('.rich-editor__hint');
        const surfaceText = superficieEditor.locator('.rich-editor__surface');
        await assertRenderedTextContrast(ayudaEditor, `Ayuda del editor Banco ${width}px / ${theme}`);
        await assertRenderedTextContrast(surfaceText, `Placeholder del editor Banco ${width}px / ${theme}`, '::before');
        await expect(ayudaEditor).toHaveCSS('font-size', '12px');
        const filtroTema = page.locator('.banco-listado__filtros .banco-campo-tema select');
        const presentacionFiltro = await filtroTema.evaluate((element) => {
          const select = element as HTMLSelectElement;
          const estilo = getComputedStyle(select);
          const canvas = document.createElement('canvas');
          const contexto = canvas.getContext('2d')!;
          contexto.font = `${estilo.fontSize} ${estilo.fontFamily}`;
          const texto = select.selectedOptions[0]?.textContent?.trim() ?? '';
          return {
            color: estilo.color,
            texto,
            anchoTexto: contexto.measureText(texto).width,
            anchoUtil: select.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
          };
        });
        expect(presentacionFiltro.texto).toBe('Todos los temas');
        expect(presentacionFiltro.anchoTexto, `el filtro debe mostrar su opción completa a ${width}px`).toBeLessThanOrEqual(presentacionFiltro.anchoUtil);
        expect(presentacionFiltro.color).toBe(theme === 'dark' ? 'rgb(245, 249, 255)' : 'rgb(16, 32, 51)');
        for (const [task, targetId] of taskDestinations) {
          const section = page.locator(`#${targetId}`);
          await section.scrollIntoViewIfNeeded();
          await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          await page.screenshot({
            path: supplementalEvidencePath(`ux-audit-banco-${task.toLowerCase().replaceAll(' ', '-')}-${width}-${theme}-viewport.png`),
            animations: 'disabled'
          });
        }
        await page.locator('#banco-captura .banco-file-upload-card').screenshot({
          path: supplementalEvidencePath(`ux-audit-banco-image-picker-${width}-${theme}.png`),
          animations: 'disabled'
        });
        await page.locator('#banco-importacion .banco-reactivos-import__upload').screenshot({
          path: supplementalEvidencePath(`ux-audit-banco-import-picker-${width}-${theme}.png`),
          animations: 'disabled'
        });
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-banco-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
        await assertNoHorizontalOverflow(page, `Banco ficticio ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Banco ficticio ${width}px / ${theme}`);
      }
    }

    falloConsultaBanco = true;
    await page.setViewportSize({ width: 320, height: 844 });
    const respuestaFallidaBanco = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/banco-preguntas' && response.status() === 503;
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await respuestaFallidaBanco;
    const navConErrorBanco = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navConErrorBanco).toBeVisible({ timeout: 15_000 });
    await navConErrorBanco.locator('#navegacion-docente-movil').selectOption({ label: 'Banco' });
    await expect(page.getByRole('status').filter({ hasText: 'Cargando datos…' })).toHaveCount(0);
    const errorInicialBanco = page.getByRole('alert').filter({ hasText: 'No se pudo actualizar la lista de preguntas.' });
    await expect(errorInicialBanco).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No hay preguntas en esta materia. Redacta la primera arriba.')).toHaveCount(0);
    for (const theme of ['light', 'dark'] as const) {
      await setVisibleTheme(page, theme);
      await assertNoHorizontalOverflow(page, `Banco: error inicial de consulta 320px / ${theme}`);
      await assertPanelTextFitsViewport(page, page.locator('#banco-listado'), `Banco: error de consulta 320px / ${theme}`);
      await page.locator('#banco-listado').screenshot({
        path: supplementalEvidencePath(`ux-audit-banco-query-error-320-${theme}.png`),
        animations: 'disabled'
      });
    }
    falloConsultaBanco = false;
    await page.getByRole('button', { name: 'Reintentar carga de preguntas' }).click();
    await expect(errorInicialBanco).toHaveCount(0);
    await expect(page.getByText(/¿Qué magnitud se conserva en un sistema aislado/i)).toBeVisible();

    const imagePickerTrigger = page.getByRole('button', { name: 'Seleccionar imagen de apoyo' });
    const imageChooserPromise = page.waitForEvent('filechooser');
    await imagePickerTrigger.click();
    const imageChooser = await imageChooserPromise;
    await imageChooser.setFiles({
      name: 'imagen-ficticia.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/cWQAAAAASUVORK5CYII=', 'base64')
    });
    await expect(page.getByRole('img', { name: 'Imagen de la pregunta' })).toBeVisible();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Seleccionar archivo de reactivos' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({ name: 'reactivos-ficticios.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(page.locator('.banco-reactivos-import__file')).toHaveText('Archivo seleccionado: reactivos-ficticios.json · 2 B');
    const validarArchivo = page.getByRole('button', { name: 'Validar archivo' });
    const previewFallido = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/banco-preguntas/importaciones/preview' && response.request().method() === 'POST' && response.status() === 400;
    });
    await validarArchivo.click();
    await previewFallido;
    const errorPreviewBanco = page.getByRole('alert').filter({ hasText: 'Formato no compatible.' });
    await expect(errorPreviewBanco).toBeVisible();
    await expect(errorPreviewBanco.locator('.mensaje__icono svg')).toHaveCount(1);
    await expect(errorPreviewBanco).toContainText('Corrige el archivo con la plantilla o el esquema y valida de nuevo.');
    await expect(page.getByRole('button', { name: 'Confirmar importación' })).toHaveCount(0);
    await expect(page.locator('.banco-reactivos-import__file')).toContainText('reactivos-ficticios.json');
    await expect(page.getByRole('list', { name: 'Pasos de importación' }).locator('[aria-current="step"]'))
      .toContainText('Valida la vista previa');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark'] as const) {
        await setVisibleTheme(page, theme);
        await assertNoHorizontalOverflow(page, `Banco: error de preview ${width}px / ${theme}`);
        await assertPanelTextFitsViewport(page, page.locator('#banco-importacion'), `Banco: error de preview ${width}px / ${theme}`);
        await expect.poll(() => errorPreviewBanco.evaluate((element) => getComputedStyle(element).color))
          .toBe(theme === 'dark' ? 'rgb(254, 202, 202)' : 'rgb(122, 21, 21)');
        await assertRenderedTextContrast(errorPreviewBanco, `Error de formato Banco ${width}px / ${theme}`);
        const distanciaFeedbackPreview = await errorPreviewBanco.evaluate((alerta) => {
          const carga = alerta.closest('.banco-reactivos-import')?.querySelector('.banco-reactivos-import__upload');
          if (!carga) return null;
          return alerta.getBoundingClientRect().top - carga.getBoundingClientRect().bottom;
        });
        expect(distanciaFeedbackPreview, 'El error de validación debe aparecer junto al selector y su acción').not.toBeNull();
        expect(distanciaFeedbackPreview!, `El error de preview debe permanecer cerca del control a ${width}px / ${theme}`).toBeLessThan(80);
        await page.locator('#banco-importacion').screenshot({
          path: supplementalEvidencePath(`ux-audit-banco-preview-error-${width}-${theme}.png`),
          animations: 'disabled'
        });
      }
    }
    falloPreviewBanco = false;
    const previewRecuperado = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/banco-preguntas/importaciones/preview' && response.request().method() === 'POST' && response.status() === 200;
    });
    await validarArchivo.click();
    await previewRecuperado;
    await expect(errorPreviewBanco).toHaveCount(0);
    await expect(page.getByText('Resultado de la validación')).toBeVisible();
    await expect(page.getByText('1 reactivo nuevo')).toBeVisible();
    await expect(page.locator('.banco-reactivos-import__file')).toContainText('reactivos-ficticios.json');

    perfilBanco = 'completo';
    falloConsultaTemasBanco = true;
    await page.setViewportSize({ width: 320, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navTemasConError = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navTemasConError).toBeVisible({ timeout: 15_000 });
    const respuestaErrorTemasBanco = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/banco-preguntas/temas' && response.status() === 503;
    });
    await navTemasConError.locator('#navegacion-docente-movil').selectOption({ label: 'Banco' });
    await respuestaErrorTemasBanco;
    await expect(page.getByText('Cargando temas…', { exact: true })).toHaveCount(0, { timeout: 10_000 });
    const errorCargaTemasBanco = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los temas:' });
    await expect(errorCargaTemasBanco).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar carga de temas' })).toBeVisible();
    await expect(page.getByText('No hay temas. Crea el primero arriba.')).toHaveCount(0);
    await expect(page.getByText('No se pudo comprobar la lista de temas.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a Temas para reintentar' })).toHaveAttribute('href', '#banco-temas');
    for (const theme of ['light', 'dark'] as const) {
      await setVisibleTheme(page, theme);
      await assertNoHorizontalOverflow(page, `Banco: error de temas 320px / ${theme}`);
      await assertPanelTextFitsViewport(page, page.locator('#banco-temas'), `Banco: error de temas 320px / ${theme}`);
      await assertRenderedTextContrast(errorCargaTemasBanco, `Error de temas Banco 320px / ${theme}`);
      await page.locator('#banco-temas').screenshot({
        path: supplementalEvidencePath(`ux-audit-banco-topics-error-320-${theme}.png`),
        animations: 'disabled'
      });
    }
    falloConsultaTemasBanco = false;
    await page.getByRole('button', { name: 'Reintentar carga de temas' }).focus();
    await page.keyboard.press('Enter');
    await expect(errorCargaTemasBanco).toHaveCount(0);
    await expect(page.locator('#banco-select-tema option[value="tema-mecanica-dummy"]')).toHaveCount(1);
    await expect(page.locator('#banco-temas .banco-temas__item').filter({ hasText: 'Mecánica' })).toHaveCount(1);

    perfilBanco = 'sin-gestion';
    await page.setViewportSize({ width: 320, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navDocente = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navDocente).toBeVisible({ timeout: 15_000 });
    await navDocente.locator('#navegacion-docente-movil').selectOption({ label: 'Banco' });
    const avisoPermiso = page.getByRole('status').filter({
      hasText: 'Tu perfil no tiene permiso de gestión para crear o editar preguntas o temas.'
    });
    await expect(avisoPermiso).toBeVisible();
    await expect(page.getByRole('button', { name: /Validar y guardar borrador/i })).toBeDisabled();
    await expect(page.getByLabel('Nombre del tema nuevo')).toBeDisabled();
    const retirarReactivo = page.getByRole('button', { name: /^Retirar reactivo:/i });
    const ayudaRetirar = page.getByText(/Retirar reactivos requiere permiso de publicación/i);
    await expect(retirarReactivo).toBeDisabled();
    await expect(ayudaRetirar).toBeVisible();
    await expect(ayudaRetirar).toHaveAttribute('role', 'status');
    await expect(retirarReactivo).toHaveAttribute('aria-describedby', await ayudaRetirar.getAttribute('id') ?? '');
    for (const theme of ['light', 'dark'] as const) {
      await setVisibleTheme(page, theme);
      await assertNoHorizontalOverflow(page, `Banco sin permiso de gestión 320px / ${theme}`);
      await assertVisibleHeadersFit(page, `Banco sin permiso de gestión 320px / ${theme}`);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-banco-permiso-gestion-320-${theme}.png`),
        fullPage: true,
        animations: 'disabled'
      });
    }

    perfilBanco = 'sin-archivo';
    incluirPreguntaHeredada = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(navDocente).toBeVisible({ timeout: 15_000 });
    await navDocente.locator('#navegacion-docente-movil').selectOption({ label: 'Banco' });
    const eliminarPregunta = page.getByRole('button', { name: /^Eliminar pregunta:/i });
    const ayudaEliminar = page.getByText(/Eliminar preguntas heredadas requiere permiso de archivo/i);
    await expect(eliminarPregunta).toBeDisabled();
    await expect(ayudaEliminar).toBeVisible();
    await expect(ayudaEliminar).toHaveAttribute('role', 'status');
    await expect(eliminarPregunta).toHaveAttribute('aria-describedby', await ayudaEliminar.getAttribute('id') ?? '');
    await expect(page.getByRole('button', { name: /^Retirar reactivo:/i })).toBeEnabled();
    for (const theme of ['light', 'dark'] as const) {
      await setVisibleTheme(page, theme);
      await assertNoHorizontalOverflow(page, `Banco sin permiso de archivo 320px / ${theme}`);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-banco-permiso-archivo-320-${theme}.png`),
        fullPage: true,
        animations: 'disabled'
      });
    }

  });

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
    await expect(page.getByRole('button', { name: /Abrir perfil docente de Docente E2E/ })).toBeVisible();
    const tabAlumnos = nav.getByRole('button', { name: 'Alumnos', exact: true });
    await tabAlumnos.click();
    await expect(tabAlumnos).toHaveAttribute('aria-current', 'page');
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

