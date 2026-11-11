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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/alumnos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
  });
  await page.route('**/api/sincronizaciones?limite=12', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sincronizaciones: [{
        _id: 'sync-event-dummy-001', tipo: 'push', estado: 'exitoso',
        createdAt: '2026-10-30T16:30:00.000Z', resumen: 'Paquete enviado desde equipo de prueba'
      }] })
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const sectionNav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(sectionNav).toBeVisible({ timeout: 15_000 });
  await sectionNav.locator('#navegacion-docente-movil').selectOption({ label: 'Sincronización' });
  const historyPanel = page.locator('.sincronizacion-resumen-grid');
  const syncGuide = historyPanel.locator('.sincronizacion-side-card .helper-panel');
  await expect(historyPanel.getByText('Paquete enviado desde equipo de prueba')).toBeVisible();
  await expect(syncGuide).toBeVisible();
  expect(await syncGuide.evaluate((guide) => guide.parentElement?.classList.contains('item-glass'))).toBe(false);
  await expect(historyPanel.getByText('Mostrando 1 de 1 eventos recientes consultados')).toBeVisible();
  const autoRefresh = historyPanel.getByLabel('Auto-actualizar (45s)');
  await expect(autoRefresh).toBeVisible();
  const autoRefreshLayout = await autoRefresh.evaluate((input) => {
    const label = input.closest('label')!;
    const bounds = input.getBoundingClientRect();
    return { labelDisplay: getComputedStyle(label).display, width: bounds.width, height: bounds.height };
  });
  expect(autoRefreshLayout.labelDisplay).toBe('flex');
  expect(autoRefreshLayout.width).toBeGreaterThanOrEqual(18);
  expect(autoRefreshLayout.width).toBeLessThanOrEqual(24);
  expect(autoRefreshLayout.height).toBeGreaterThanOrEqual(18);
  expect(autoRefreshLayout.height).toBeLessThanOrEqual(24);
  for (const [width, theme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [1024, 'dark']] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((selectedTheme) => {
      const root = document.documentElement;
      root.dataset.theme = selectedTheme;
      root.style.colorScheme = selectedTheme;
    }, theme);
    await historyPanel.scrollIntoViewIfNeeded();
    await assertPanelTextFitsViewport(page, historyPanel, `Historial de sincronización ${width}px / ${theme}`);
    await assertNoHorizontalOverflow(page, `Historial de sincronización ${width}px / ${theme}`);
    await historyPanel.screenshot({ path: path.join(evidenceDir, `sync-historial-${width}-${theme}.png`), animations: 'disabled' });
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole('heading', { name: 'Sincronización y respaldos' })).toBeVisible();
  const sectionHeader = page.locator('.sincronizacion-panel__head');
  const sectionTitle = sectionHeader.getByRole('heading', { name: 'Sincronización y respaldos' });
  await expect(sectionTitle.locator('svg')).toHaveCount(0);
  const sectionEmblem = sectionHeader.locator('.sincronizacion-panel__icon-orb [data-icono="sincronizacion"]');
  await expect(sectionEmblem).toBeVisible();
  await expect(sectionEmblem).toHaveAttribute('aria-hidden', 'true');
  for (const theme of ['dark', 'light']) {
    await page.evaluate((selectedTheme) => { document.documentElement.dataset.theme = selectedTheme; }, theme);
    await sectionHeader.screenshot({ path: path.join(evidenceDir, `sync-section-header-${theme}-320.png`), animations: 'disabled' });
  }
  const taskNav = page.getByRole('navigation', { name: 'Tareas de sincronización' });
  await expect(taskNav).toBeVisible();
  await expect(taskNav.getByRole('link', { name: 'Trabajo coordinado entre equipos' })).toHaveCount(0);
  const navigationOrder = await page.evaluate(() => ({
    linksBeforeGuide: document.querySelector('.sincronizacion-task-nav')!.getBoundingClientRect().top < document.querySelector('.sincronizacion-shell .guia-materia-card')!.getBoundingClientRect().top,
    linkTextDecoration: getComputedStyle(document.querySelector('.sincronizacion-task-nav a')!).textDecorationLine
  }));
  expect(navigationOrder.linksBeforeGuide).toBe(true);
  expect(navigationOrder.linkTextDecoration).toBe('none');
  await taskNav.scrollIntoViewIfNeeded();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((selectedTheme) => { document.documentElement.dataset.theme = selectedTheme; }, theme);
    await page.screenshot({ path: path.join(evidenceDir, `sync-nav-${theme}-320.png`), animations: 'disabled' });
  }

  const tasks = [
    { name: 'Publicar en Portal Alumno', target: '#sync-publicacion-heading', file: 'sync-publicacion-320.png', icon: '[data-icono="publicar"]' },
    { name: 'Exportar o importar paquete', target: '#sync-paquetes-heading', file: 'sync-paquetes-320.png', icon: 'svg.lucide-package-open' },
    { name: 'Respaldo completo', target: '#sync-respaldo-heading', file: 'sync-respaldo-320.png', icon: 'svg.lucide-database-backup' },
    { name: 'Sincronización entre equipos', target: '#sync-equipos-heading', file: 'sync-equipos-320.png', icon: '[data-icono="sincronizacion"]' }
  ];
  for (const task of tasks) {
    const link = taskNav.getByRole('link', { name: task.name });
    await link.click();
    const destination = page.locator(task.target);
    await expect(destination).toBeFocused();
    await expect(destination).toBeInViewport();
    const taskIcon = destination.locator(task.icon);
    await expect(taskIcon).toBeVisible();
    await expect(taskIcon).toHaveAttribute('aria-hidden', 'true');
    if (task.target === '#sync-publicacion-heading') {
      const publicacion = page.locator('.shell-main--publicar');
      await expect(publicacion.getByRole('status').filter({ hasText: 'No hay materias activas para publicar' })).toBeVisible();
      await expect(publicacion.getByLabel('Materia para publicar')).toBeDisabled();
      await expect(publicacion.getByRole('button', { name: 'Publicar resultados' })).toBeDisabled();
      await expect(publicacion.getByRole('button', { name: 'Generar código de acceso' })).toBeDisabled();
    }
    if (task.target === '#sync-respaldo-heading') {
      const respaldo = page.locator('.paquete-sincronizacion-panel').filter({ has: page.locator('#sync-respaldo-heading') });
      await expect(respaldo.getByRole('status')).toContainText('No puedes exportar ni importar respaldos completos todavía');
      await expect(respaldo.getByRole('status')).toContainText('Pide al administrador local');
      await expect(respaldo.getByRole('button', { name: 'Exportar respaldo completo' })).toHaveCount(0);
      await assertPanelTextFitsViewport(page, respaldo, 'Respaldo completo sin método configurado a 320 px');
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await assertRenderedTextContrast(respaldo.getByRole('status'), `Aviso de configuración de respaldo ${theme} / 320 px`);
        await page.screenshot({ path: path.join(evidenceDir, `sync-respaldo-320-${theme}.png`), animations: 'disabled' });
      }
    }
    if (task.target === '#sync-paquetes-heading') {
      const paquetes = page.locator('.paquete-sincronizacion-panel').filter({ has: page.locator('#sync-paquetes-heading') });
      await expect(paquetes.getByRole('heading', { name: 'Paquetes entre equipos' })).toBeVisible();
      await expect(paquetes.getByRole('button', { name: 'Exportar paquete' })).toBeVisible();
      await expect(paquetes.getByLabel('Importar paquete')).toHaveCount(1);
      await expect(paquetes).toContainText('Conflictos: prevalece el registro con la fecha de modificación más reciente');
      await expect(paquetes.getByLabel('Cambios desde (opcional)')).toHaveAttribute('aria-describedby', 'sync-paquete-desde-ayuda');
      await assertPanelTextFitsViewport(page, paquetes, 'Paquetes entre equipos a 320 px');
    }
    await assertNoHorizontalOverflow(page, `Navegación Sync móvil hacia ${task.name}`);
    if (task.target !== '#sync-respaldo-heading') {
      await page.screenshot({ path: path.join(evidenceDir, task.file), animations: 'disabled' });
    }
  }
  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate((selectedTheme) => {
      const root = document.documentElement;
      root.dataset.theme = selectedTheme;
      root.style.colorScheme = selectedTheme;
    }, theme);
    for (const task of tasks) {
      const destination = page.locator(task.target);
      await destination.scrollIntoViewIfNeeded();
      await destination.focus();
      await expect(destination).toBeFocused();
      const focusStyle = await destination.evaluate((heading) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--ui-accent-primary)';
        document.body.append(probe);
        const expectedColor = getComputedStyle(probe).color;
        probe.remove();
        const computed = getComputedStyle(heading);
        return {
          color: computed.outlineColor,
          expectedColor,
          style: computed.outlineStyle,
          width: computed.outlineWidth,
          offset: computed.outlineOffset
        };
      });
      expect(focusStyle.style, `${task.name} / ${theme}: foco visible`).toBe('solid');
      expect(focusStyle.width, `${task.name} / ${theme}: trazo consistente`).toBe('3px');
      expect(focusStyle.offset, `${task.name} / ${theme}: separación consistente`).toBe('4px');
      expect(focusStyle.color, `${task.name} / ${theme}: acento primario`).toBe(focusStyle.expectedColor);
      await page.screenshot({
        path: path.join(evidenceDir, `sync-focus-${task.target.slice(1)}-${theme}-320.png`),
        animations: 'disabled'
      });
    }
  }
  for (const [width, theme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [1440, 'dark']] as const) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 800 });
    await page.evaluate((selectedTheme) => { document.documentElement.dataset.theme = selectedTheme; }, theme);
    await taskNav.getByRole('link', { name: 'Publicar en Portal Alumno' }).click();
    await expect(page.locator('#sync-publicacion-heading')).toBeFocused();
    const publicacion = page.locator('.shell-main--publicar');
    await expect(publicacion.getByRole('status').filter({ hasText: 'No hay materias activas para publicar' })).toBeVisible();
    await assertNoHorizontalOverflow(page, `Publicación sin materias ${width}px / ${theme}`);
    await page.screenshot({
      path: path.join(evidenceDir, `sync-publicacion-${width}-${theme}.png`),
      animations: 'disabled'
    });
  }

  for (const [width, theme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [1024, 'dark']] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((selectedTheme) => {
      const root = document.documentElement;
      root.dataset.theme = selectedTheme;
      root.style.colorScheme = selectedTheme;
    }, theme);
    await taskNav.getByRole('link', { name: 'Sincronización entre equipos' }).click();
    const panel = page.locator('.shell-main--sync-equipos');
    await expect(page.locator('#sync-equipos-heading')).toBeFocused();
    await expect(panel.getByRole('group', { name: 'Parámetros de sincronización entre equipos' })).toBeVisible();
    const includePdfs = panel.getByLabel('Incluir PDFs en el envío (aumenta el tamaño)');
    await expect(includePdfs).toBeVisible();
    const checkboxLayout = await includePdfs.evaluate((input) => {
      const label = input.closest('label')!;
      const bounds = input.getBoundingClientRect();
      return { labelDisplay: getComputedStyle(label).display, width: bounds.width, height: bounds.height };
    });
    expect(checkboxLayout.labelDisplay).toBe('flex');
    expect(checkboxLayout.width).toBeGreaterThanOrEqual(18);
    expect(checkboxLayout.width).toBeLessThanOrEqual(24);
    expect(checkboxLayout.height).toBeGreaterThanOrEqual(18);
    expect(checkboxLayout.height).toBeLessThanOrEqual(24);
    await expect(panel.getByLabel('Cambios desde (opcional)')).toBeVisible();
    await expect(panel.getByLabel('Máximo de paquetes por recibir')).toHaveValue('20');
    const primaryContrast = await panel.getByRole('button', { name: 'Enviar cambios (push)' }).evaluate((button) => {
      const parseRgb = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (rgb: number[]) => rgb.map((component) => component / 255).map((component) => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4).reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);
      const style = getComputedStyle(button);
      const textColor = getComputedStyle(button.querySelector('.boton__texto') ?? button).color;
      const foreground = luminance(parseRgb(textColor));
      const background = luminance(parseRgb(style.backgroundColor));
      return {
        ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        textColor,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity,
        disabled: (button as HTMLButtonElement).disabled
      };
    });
    expect(primaryContrast.backgroundImage, `Sincronización ${width}px / ${theme}: CTA sin gradiente`).toBe('none');
    expect(primaryContrast.backgroundColor).toMatch(/^rgb\(/);
    expect(primaryContrast.opacity).toBe('1');
    expect(primaryContrast.disabled).toBe(false);
    expect(primaryContrast.ratio, `Sincronización ${width}px / ${theme}: ${JSON.stringify(primaryContrast)}`).toBeGreaterThanOrEqual(4.5);
    await assertPanelTextFitsViewport(page, panel, `Sincronización entre equipos ${width}px / ${theme}`);
    await assertNoHorizontalOverflow(page, `Sincronización entre equipos ${width}px / ${theme}`);
    const panelLayout = await panel.evaluate((element) => {
      const estilo = getComputedStyle(element);
      const limiteDerecho = element.getBoundingClientRect().right - parseFloat(estilo.paddingRight) - parseFloat(estilo.borderRightWidth);
      const hijos = Array.from(element.children).map((child) => ({
        tagName: child.tagName.toLowerCase(),
        className: (child as HTMLElement).className,
        right: child.getBoundingClientRect().right
      }));
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        hijosFueraDelAnchoUtil: hijos.filter((child) => child.right > limiteDerecho + 1)
      };
    });
    expect(panelLayout.scrollWidth, `Contenido de Sincronización ${width}px / ${theme} dentro de su tarjeta`).toBeLessThanOrEqual(panelLayout.clientWidth + 1);
    expect(panelLayout.hijosFueraDelAnchoUtil, `Sincronización ${width}px / ${theme}: controles y textos dentro del área útil`).toEqual([]);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(evidenceDir, `sync-equipos-${width}-${theme}.png`),
      animations: 'disabled'
    });
  }
});

test('audita la publicación activa y el código de acceso con respuestas sintéticas', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-publicacion-activa-dummy'));
  const solicitudesApi: Array<{ method: string; path: string }> = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) solicitudesApi.push({ method: request.method(), path: url.pathname });
  });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-publicacion-dummy', nombre: 'Docente de Prueba', correo: 'docente@example.invalid',
        permisos: ['periodos:leer', 'alumnos:leer', 'sincronizacion:listar', 'calificaciones:publicar'], roles: ['docente']
      } })
    });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ periodos: [{ _id: 'periodo-publicacion-dummy', nombre: 'Comunicación técnica', fechaInicio: '2026-08-20' }] })
    });
  });
  await page.route('**/api/alumnos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
  });
  await page.route('**/api/sincronizaciones?limite=12', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sincronizaciones: [] }) });
  });
  await page.route('**/api/sincronizaciones/codigo-acceso?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ codigosAcceso: [{
        id: 'codigo-publicacion-dummy', periodoId: 'periodo-publicacion-dummy', expiraEn: '2026-11-06T12:00:00.000Z', usado: false, estado: 'vigente'
      }] })
    });
  });
  await page.route('**/api/sincronizaciones/codigo-acceso', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ codigoAccesoId: 'codigo-publicacion-dummy', codigo: 'DEMO-123456', expiraEn: '2026-11-06T12:00:00.000Z' })
    });
  });
  await page.route('**/api/sincronizaciones/publicar', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicado: true }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const sectionNav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(sectionNav).toBeVisible({ timeout: 15_000 });
  await sectionNav.locator('#navegacion-docente-movil').selectOption({ label: 'Sincronización' });
  const taskNav = page.getByRole('navigation', { name: 'Tareas de sincronización' });
  await taskNav.getByRole('link', { name: 'Publicar en Portal Alumno' }).click();
  const panel = page.locator('.shell-main--publicar');
  await expect(page.locator('#sync-publicacion-heading')).toBeFocused();
  await panel.getByLabel('Materia para publicar').selectOption('periodo-publicacion-dummy');
  await panel.getByRole('button', { name: 'Generar código de acceso' }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'Código de acceso generado' })).toContainText(/Código de acceso generado para Comunicación técnica.*resultados publicados\./);
  const codigoGenerado = panel.getByRole('region', { name: 'Código de acceso generado' });
  await expect(codigoGenerado).toContainText('DEMO-123456');
  await expect(codigoGenerado.getByText('Listo para compartir')).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Códigos de acceso' })).toBeVisible();
  const listaCodigos = panel.locator('.sincronizacion-codigos-acceso-lista');
  await expect(listaCodigos.getByText('Vigente')).toBeVisible();
  await expect(listaCodigos).toContainText('Vencimiento:');
  await expect(listaCodigos).not.toContainText('DEMO-123456');
  await expect(listaCodigos.getByRole('button', { name: 'Expirar en esta instalación' })).toBeVisible();
  const initialInset = await panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    const headingRect = element.querySelector('#sync-publicacion-heading')!.getBoundingClientRect();
    const selectorRect = element.querySelector('select')!.getBoundingClientRect();
    return { heading: headingRect.left - panelRect.left, selector: selectorRect.left - panelRect.left };
  });
  expect(initialInset.heading).toBeGreaterThanOrEqual(12);
  expect(initialInset.selector).toBeGreaterThanOrEqual(12);
  expect(solicitudesApi.filter(({ method, path }) => method === 'POST' && path === '/api/sincronizaciones/codigo-acceso')).toHaveLength(1);
  expect(solicitudesApi.filter(({ method, path }) => method === 'POST' && path === '/api/sincronizaciones/publicar')).toHaveLength(1);
  expect(solicitudesApi.filter(({ method, path }) => method === 'GET' && path === '/api/sincronizaciones/codigo-acceso')).toHaveLength(1);

  for (const [width, theme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [390, 'dark'], [1024, 'light'], [1024, 'dark']] as const) {
    await page.setViewportSize({ width, height: width === 1024 ? 900 : 800 });
    await page.evaluate((selectedTheme) => {
      const root = document.documentElement;
      root.dataset.theme = selectedTheme;
      root.style.colorScheme = selectedTheme;
    }, theme);
    await panel.scrollIntoViewIfNeeded();
    await assertPanelTextFitsViewport(page, panel, `Publicación activa ${width}px / ${theme}`);
    await assertNoHorizontalOverflow(page, `Publicación activa ${width}px / ${theme}`);
    await assertRenderedTextContrast(codigoGenerado, `Código de acceso generado ${width}px / ${theme}`);
    await assertRenderedTextContrast(listaCodigos, `Lista de códigos de acceso ${width}px / ${theme}`);
    await panel.screenshot({
      path: path.join(evidenceDir, `sync-publicacion-activa-${width}-${theme}.png`),
      animations: 'disabled'
    });
  }
});

test('el primer control de teclado salta la navegación docente al contenido principal', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-skip-link-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-skip-link-dummy', nombre: 'Docente de Prueba', correo: 'docente@example.invalid',
        permisos: ['periodos:leer', 'alumnos:leer'], roles: ['docente']
      } })
    });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/alumnos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const skipLink = page.getByRole('link', { name: 'Saltar al contenido principal' });
  const contenidoPrincipal = page.locator('#contenido-principal');
  const nav = page.getByRole('navigation', { name: 'Secciones del portal docente' });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('main')).toHaveCount(1);
  const contrastRatio = (foreground: string, background: string) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const linear = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return (linear[0]! * 0.2126) + (linear[1]! * 0.7152) + (linear[2]! * 0.0722);
    };
    const light = luminance(foreground);
    const dark = luminance(background);
    return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
  };
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(nav).toBeVisible({ timeout: 15_000 });
    }
    await expect(skipLink).toHaveCSS('pointer-events', 'none');
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveCSS('pointer-events', 'auto');
    await page.evaluate((selectedTheme) => {
      document.documentElement.dataset.theme = selectedTheme;
      document.documentElement.style.colorScheme = selectedTheme;
    }, theme);
    const bounds = await skipLink.boundingBox();
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect(bounds?.y).toBeLessThan(800);
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect(bounds && bounds.x + bounds.width + 6).toBeLessThanOrEqual(320);
    const skipLinkContrast = await skipLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor, outline: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    expect(contrastRatio(skipLinkContrast.foreground, skipLinkContrast.background)).toBeGreaterThanOrEqual(4.5);
    expect(skipLinkContrast.outlineStyle).toBe('solid');
    expect(skipLinkContrast.outlineWidth).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(skipLinkContrast.outline, skipLinkContrast.background)).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: path.join(evidenceDir, `ux-docente-saltar-contenido-320-${theme}.png`), animations: 'disabled' });
    await page.keyboard.press('Enter');
    await expect(contenidoPrincipal).toBeFocused();
    const focusIndicator = await contenidoPrincipal.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outline: style.outlineColor, outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth), background: getComputedStyle(document.body).backgroundColor };
    });
    expect(focusIndicator.outlineStyle).toBe('solid');
    expect(focusIndicator.outlineWidth).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(focusIndicator.outline, focusIndicator.background)).toBeGreaterThanOrEqual(3);
    expect(await contenidoPrincipal.evaluate((element) => element.compareDocumentPosition(document.querySelector('[aria-label="Secciones del portal docente"]')!) & Node.DOCUMENT_POSITION_PRECEDING)).toBeTruthy();
    await expect(contenidoPrincipal).toBeVisible();
    await contenidoPrincipal.evaluate((element) => (element as HTMLElement).blur());
  }
});

test('audita Trabajo coordinado disponible con lease ficticio sin ejecutar operaciones', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-sync-lease-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        id: 'docente-sync-lease-dummy', _id: 'docente-sync-lease-dummy', nombre: 'Docente de prueba', correo: 'lease@example.invalid',
        tieneContrasena: true, permisos: ['periodos:leer', 'sincronizacion:listar'], roles: ['docente']
      } })
    });
  });
  await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ capacidadesIntegraciones: { snapshotGoogleDisponible: false } }) });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/alumnos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
  });
  await page.route('**/api/sincronizaciones?limite=12', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sincronizaciones: [] }) });
  });
  let leaseMode: 'disponible' | 'solo_lectura' | 'escritura' = 'disponible';
  let leaseAcquireAttempts = 0;
  const leaseState = () => ({
    configurado: true,
    directorio: 'OneDrive/EvaluaPro/snapshots-dummy',
    origen: 'docente',
    proveedor: 'carpeta-sincronizada' as const,
    ttlMs: 60_000,
    modo: leaseMode,
    ...(leaseMode === 'solo_lectura' ? { lease: {
      leaseId: 'lease-otro-equipo-dummy', equipoId: 'equipo-remoto-dummy',
      adquiridoEn: '2026-10-31T16:00:00.000Z', ultimoHeartbeatEn: '2026-10-31T16:01:00.000Z',
      expiraEn: '2030-01-01T16:02:00.000Z', propio: false
    } } : {})
  });
  await page.route('**/api/sincronizaciones/local/lease', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leaseState()) });
  });
  await page.route('**/api/sincronizaciones/local/lease/adquirir', async (route) => {
    leaseAcquireAttempts += 1;
    if (leaseMode === 'escritura') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lease: {
            leaseId: 'lease-propio-dummy', equipoId: 'equipo-docente-dummy',
            adquiridoEn: '2026-10-31T16:00:00.000Z', ultimoHeartbeatEn: '2026-10-31T16:01:00.000Z',
            expiraEn: '2030-01-01T16:02:00.000Z', propio: true
          },
          ttlMs: 60_000
        })
      });
      return;
    }
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ codigo: 'LEASE_OCUPADO', mensaje: 'El control sigue disponible para la prueba.' }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const sectionNav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(sectionNav).toBeVisible({ timeout: 15_000 });
  await sectionNav.locator('#navegacion-docente-movil').selectOption({ label: 'Sincronización' });
  const taskNav = page.getByRole('navigation', { name: 'Tareas de sincronización' });
  const coordinatedLink = taskNav.getByRole('link', { name: 'Trabajo coordinado entre equipos' });
  await expect(coordinatedLink).toBeVisible();
  const panel = page.locator('[data-testid="sincronizacion-coordinada"]');
  const coordinatedIcon = panel.locator('h2 svg.lucide-users-round');
  await expect(coordinatedIcon).toBeVisible();
  await expect(coordinatedIcon).toHaveAttribute('aria-hidden', 'true');
  await expect(panel.getByText('No hay otro equipo trabajando. Adquiere el control para editar y sincronizar.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Tomar control de edición' })).toBeEnabled();
  const protection = panel.getByLabel('Protección de publicación');
  await expect(protection.locator('option:checked')).toHaveText('Contraseña de cuenta');

  for (const [width, theme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [1024, 'dark']] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((selectedTheme) => {
      const root = document.documentElement;
      root.dataset.theme = selectedTheme;
      root.style.colorScheme = selectedTheme;
    }, theme);
    await coordinatedLink.click();
    await expect(page.locator('#sync-coordinado-heading')).toBeFocused();
    await expect(page.locator('#sync-coordinado-heading')).toBeInViewport();
    const takeControl = panel.getByRole('button', { name: 'Tomar control de edición' });
    const controlContrast = await takeControl.evaluate((button) => {
      const parseRgb = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (rgb: number[]) => rgb.map((component) => component / 255).map((component) => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4).reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);
      const style = getComputedStyle(button);
      const foreground = luminance(parseRgb(getComputedStyle(button.querySelector('.boton__texto') ?? button).color));
      const background = luminance(parseRgb(style.backgroundColor));
      return {
        ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity,
        disabled: (button as HTMLButtonElement).disabled
      };
    });
    expect(controlContrast.backgroundImage).toBe('none');
    expect(controlContrast.backgroundColor).toMatch(/^rgb\(/);
    expect(controlContrast.opacity).toBe('1');
    expect(controlContrast.disabled).toBe(false);
    expect(controlContrast.ratio, `El CTA de coordinación debe alcanzar 4.5:1 a ${width}px / ${theme}`).toBeGreaterThanOrEqual(4.5);
    const selectedLabel = await protection.evaluate((element) => {
      const select = element as HTMLSelectElement;
      const style = getComputedStyle(select);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      context.font = `${style.fontSize} ${style.fontFamily}`;
      const text = select.selectedOptions[0]?.textContent?.trim() ?? '';
      return {
        text,
        textWidth: context.measureText(text).width,
        availableWidth: select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 28
      };
    });
    expect(selectedLabel.textWidth, `La opción seleccionada debe leerse completa a ${width}px / ${theme}`).toBeLessThanOrEqual(selectedLabel.availableWidth);
    await assertPanelTextFitsViewport(page, panel, `Trabajo coordinado disponible ${width}px / ${theme}`);
    await assertNoHorizontalOverflow(page, `Trabajo coordinado disponible ${width}px / ${theme}`);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidenceDir, `sync-coordinado-${width}-${theme}.png`), animations: 'disabled' });
  }

  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; });
  leaseMode = 'solo_lectura';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: /Secciones del portal docente/i }).locator('#navegacion-docente-movil').selectOption({ label: 'Sincronización' });
  await expect(page.getByRole('navigation', { name: 'Tareas de sincronización' }).getByRole('link', { name: 'Trabajo coordinado entre equipos' })).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; });
  await page.getByRole('navigation', { name: 'Tareas de sincronización' }).getByRole('link', { name: 'Trabajo coordinado entre equipos' }).click();
  const readOnlyPanel = page.locator('[data-testid="sincronizacion-coordinada"]');
  await expect(readOnlyPanel.getByText(/Otro equipo tiene el control hasta aproximadamente/)).toBeVisible();
  await expect(readOnlyPanel.getByRole('button', { name: 'Tomar control de edición' })).toHaveCount(0);
  await expect(readOnlyPanel.getByLabel('Protección de publicación')).toHaveCount(0);
  await expect(readOnlyPanel.getByLabel('Contraseña actual')).toHaveCount(0);
  const updateAvailability = readOnlyPanel.getByRole('button', { name: 'Actualizar disponibilidad' });
  await expect(updateAvailability).toBeEnabled();
  await assertPanelTextFitsViewport(page, readOnlyPanel, 'Trabajo coordinado solo lectura 320px / dark');
  await assertNoHorizontalOverflow(page, 'Trabajo coordinado solo lectura 320px / dark');
  await readOnlyPanel.screenshot({ path: path.join(evidenceDir, 'sync-coordinado-solo-lectura-320-dark.png'), animations: 'disabled' });

  leaseMode = 'disponible';
  const attemptsBeforeRefresh = leaseAcquireAttempts;
  await updateAvailability.click();
  await expect(readOnlyPanel.getByRole('button', { name: 'Tomar control de edición' })).toBeEnabled();
  await expect(readOnlyPanel.getByLabel('Protección de publicación')).toBeVisible();
  await expect(readOnlyPanel.getByText('Estado del control actualizado.')).toBeVisible();
  expect(leaseAcquireAttempts).toBe(attemptsBeforeRefresh);
  await readOnlyPanel.screenshot({ path: path.join(evidenceDir, 'sync-coordinado-disponible-actualizado-320-dark.png'), animations: 'disabled' });

  leaseMode = 'escritura';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: /Secciones del portal docente/i }).locator('#navegacion-docente-movil').selectOption({ label: 'Sincronización' });
  await expect(page.getByRole('navigation', { name: 'Tareas de sincronización' }).getByRole('link', { name: 'Trabajo coordinado entre equipos' })).toBeVisible();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.colorScheme = 'dark'; });
  await page.getByRole('navigation', { name: 'Tareas de sincronización' }).getByRole('link', { name: 'Trabajo coordinado entre equipos' }).click();
  const writingPanel = page.locator('[data-testid="sincronizacion-coordinada"]');
  await expect(writingPanel.getByText(/Control activo en este equipo; se renueva automáticamente/)).toBeVisible();
  await expect(writingPanel.getByRole('button', { name: 'Publicar y liberar' })).toBeEnabled();
  await expect(writingPanel.getByRole('button', { name: 'Traer última instantánea' })).toBeEnabled();
  await expect(writingPanel.getByRole('button', { name: 'Liberar sin publicar' })).toBeEnabled();
  await assertPanelTextFitsViewport(page, writingPanel, 'Trabajo coordinado control propio 320px / dark');
  await assertNoHorizontalOverflow(page, 'Trabajo coordinado control propio 320px / dark');
  await writingPanel.screenshot({ path: path.join(evidenceDir, 'sync-coordinado-control-propio-320-dark.png'), animations: 'disabled' });
});

test('audita el formulario de Respaldo completo con contraseña ficticia a 320/390/1024 px', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-sync-backup-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-sync-backup-dummy', nombre: 'Docente de Prueba', correo: 'docente@example.invalid',
        tieneContrasena: true,
        permisos: ['periodos:leer', 'alumnos:leer', 'sincronizacion:listar', 'sincronizacion:exportar', 'sincronizacion:importar'], roles: ['docente']
      } })
    });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/alumnos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
  });
  await page.route('**/api/sincronizaciones?limite=12', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sincronizaciones: [] }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const sectionNav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(sectionNav).toBeVisible({ timeout: 15_000 });
  await sectionNav.locator('#navegacion-docente-movil').selectOption({ label: 'Sincronización' });
  const taskNav = page.getByRole('navigation', { name: 'Tareas de sincronización' });
  const backupLink = taskNav.getByRole('link', { name: 'Respaldo completo' });
  await backupLink.click();

  const backupPanel = page.locator('.paquete-sincronizacion-panel').filter({ has: page.locator('#sync-respaldo-heading') });
  await expect(page.locator('#sync-respaldo-heading')).toBeFocused();
  await expect(backupPanel.getByLabel('Protección del archivo')).toHaveValue('contrasena');
  await expect(backupPanel.getByLabel('Protección del archivo').locator('option:checked')).toHaveText('Contraseña de cuenta');
  await expect(backupPanel.getByLabel('Contraseña actual')).toHaveValue('');
  await expect(backupPanel.getByRole('button', { name: 'Exportar respaldo completo' })).toBeVisible();
  await expect(backupPanel.getByRole('button', { name: 'Exportar respaldo completo' })).toBeEnabled();
  const importLabel = backupPanel.locator('.acciones > label.boton--secundario');
  const importInput = importLabel.locator('input[type="file"]');
  await expect(importInput).toHaveAttribute('accept', '.ep-snapshot,application/octet-stream');
  await expect(importInput).toHaveAccessibleName('Importar respaldo completo (.ep-snapshot)');

  for (const [width, height, theme] of [[320, 800, 'light'], [320, 800, 'dark'], [390, 844, 'light'], [1024, 768, 'dark']] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate((selectedTheme) => {
      const root = document.documentElement;
      root.dataset.theme = selectedTheme;
      root.style.colorScheme = selectedTheme;
    }, theme);
    await importInput.focus();
    const focusIndicator = await importLabel.evaluate((label) => {
      const style = getComputedStyle(label);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, outlineOffset: style.outlineOffset };
    });
    expect(focusIndicator.outlineStyle).toBe('solid');
    expect(focusIndicator.outlineWidth).toBe('3px');
    expect(focusIndicator.outlineOffset).toBe('4px');
    const focusColor = await page.locator('html').evaluate((root) => {
      const probe = document.createElement('span');
      probe.style.outlineColor = 'var(--ui-accent-primary)';
      root.appendChild(probe);
      const color = getComputedStyle(probe).outlineColor;
      probe.remove();
      return color;
    });
    expect(focusIndicator.outlineColor).toBe(focusColor);
    if (width === 320 && theme === 'light') {
      await page.screenshot({ path: path.join(evidenceDir, 'sync-respaldo-file-focus-320-light.png'), animations: 'disabled' });
    }
    await importInput.evaluate((input: HTMLInputElement) => input.blur());
    await page.locator('#sync-respaldo-heading').scrollIntoViewIfNeeded();
    await assertPanelTextFitsViewport(page, backupPanel, `Formulario Respaldo completo ${width}px / ${theme}`);
    const protectionLabelFits = await backupPanel.getByLabel('Protección del archivo').evaluate((select: HTMLSelectElement) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const style = getComputedStyle(select);
      context.font = `${style.fontSize} ${style.fontFamily}`;
      const selectedText = select.selectedOptions[0]?.textContent?.trim() ?? '';
      const arrowAllowance = 28;
      const availableWidth = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - arrowAllowance;
      return { selectedText, textWidth: context.measureText(selectedText).width, availableWidth };
    });
    expect(protectionLabelFits.selectedText).toBe('Contraseña de cuenta');
    expect(protectionLabelFits.textWidth, `El método seleccionado debe leerse completo a ${width}px / ${theme}`).toBeLessThanOrEqual(protectionLabelFits.availableWidth);
    const exportContrast = await backupPanel.getByRole('button', { name: 'Exportar respaldo completo' }).evaluate((button) => {
      const parseRgb = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (rgb: number[]) => rgb.map((component) => component / 255).map((component) => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4).reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);
      const style = getComputedStyle(button);
      const textColor = getComputedStyle(button.querySelector('.boton__texto') ?? button).color;
      const foreground = luminance(parseRgb(textColor));
      const background = luminance(parseRgb(style.backgroundColor));
      return {
        ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        textColor,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity,
        disabled: (button as HTMLButtonElement).disabled,
        rootClass: document.documentElement.className,
        bodyClass: document.body.className
      };
    });
    expect(exportContrast.backgroundImage, `El CTA no debe conservar el gradiente no verificable: ${JSON.stringify(exportContrast)}`).toBe('none');
    expect(exportContrast.backgroundColor).toMatch(/^rgb\(/);
    expect(exportContrast.opacity).toBe('1');
    expect(exportContrast.disabled).toBe(false);
    expect(exportContrast.ratio, `El botón principal debe alcanzar 4.5:1 a ${width}px / ${theme}: ${JSON.stringify(exportContrast)}`).toBeGreaterThanOrEqual(4.5);
    await assertNoHorizontalOverflow(page, `Formulario Respaldo completo ${width}px / ${theme}`);
    await page.screenshot({
      path: path.join(evidenceDir, `sync-respaldo-form-${width}-${theme}.png`),
      animations: 'disabled'
    });
  }
});

test('Temarios muestra el contexto real del periodo en móvil con datos sintéticos', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('tokenDocente', 'token-temarios-dummy');
    localStorage.removeItem('ep.guia.temarios.oculta');
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-temarios-dummy', nombre: 'Docente de prueba', correo: 'temarios@example.invalid',
        permisos: ['periodos:leer', 'cuenta:leer'], roles: ['docente']
      } })
    });
  });
  await page.route('**/api/periodos**', async (route) => {
    const archivadas = new URL(route.request().url()).searchParams.get('activo') === '0';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ periodos: archivadas ? [] : [{ _id: 'periodo-temarios-dummy', nombre: 'Ciencias 2026-A', grupos: ['2A'], activo: true }] })
    });
  });
  await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/asistencias/sesiones**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sesiones: [] }) });
  });
  await page.route('**/api/temarios**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/nodos')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temario: { _id: 'temario-dummy', nombre: 'Programa de prueba', porcentajeAvance: 33 },
          nodos: [
            { _id: 'nodo-temario-dummy-1', numero: '1', nivel: 1, titulo: 'Fundamentos de evaluación formativa', estado: 'en_progreso' },
            { _id: 'nodo-temario-dummy-2', numero: '1.1', nivel: 2, titulo: 'Criterios de retroalimentación y seguimiento individual', estado: 'cubierto', cubiertaEn: '2026-10-29T12:00:00.000Z' },
            { _id: 'nodo-temario-dummy-3', numero: '1.2', nivel: 2, titulo: 'Instrumentos de evaluación', estado: 'pendiente' }
          ]
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ temarios: [{ _id: 'temario-dummy', nombre: 'Programa de prueba', totalNodos: 3, porcentajeAvance: 33 }] })
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  const mobilePicker = nav.locator('#navegacion-docente-movil');
  await mobilePicker.selectOption({ label: 'Temarios' });
  const panel = page.locator('.temarios-panel');
  const periodStatus = panel.locator('.temarios-status-pill');
  await expect(periodStatus).toHaveText('Elige una materia');
  const periodPicker = panel.getByRole('combobox', { name: 'Periodo o materia' });
  await expect(periodPicker).toBeVisible();
  await expect(panel.locator('.empty-state-steps')).toBeHidden();
  const title = panel.locator('.temarios-panel__title');
  const assertTitleUsesSolidThemeInk = async (expectedTextFill: string) => {
    const appearance = await title.evaluate((element) => {
      const style = getComputedStyle(element);
      return { textFill: style.webkitTextFillColor, backgroundImage: style.backgroundImage };
    });
    expect(appearance.backgroundImage, 'El título no debe depender de un degradado para ser legible').toBe('none');
    expect(appearance.textFill, 'El título debe usar la tinta sólida de alto contraste del tema').toBe(expectedTextFill);
  };
  const guideToggle = panel.locator('#toggle-guia-temarios');
  await expect(guideToggle).toHaveAccessibleName(/Ver guía rápida de temarios/);
  await expect(guideToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.locator('#guia-temarios-panel')).toBeHidden();
  await guideToggle.focus();
  await page.keyboard.press('Enter');
  await expect(guideToggle).toBeFocused();
  await expect(guideToggle).toHaveAccessibleName(/Ocultar guía rápida de temarios/);
  await expect(guideToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('region', { name: 'Ayuda: Estructura y seguimiento de temarios' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(guideToggle).toBeFocused();
  await expect(guideToggle).toHaveAccessibleName(/Ver guía rápida de temarios/);
  await expect(guideToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.locator('#guia-temarios-panel')).toBeHidden();
  const selectorPrecedesGuide = await panel.evaluate((element) => {
    const selector = element.querySelector('.temarios-filtros-bar')!.getBoundingClientRect();
    const metrics = element.querySelector('.temarios-header-kpis')!.getBoundingClientRect();
    const guide = element.querySelector('.guia-plegable-control')!.getBoundingClientRect();
    return { beforeMetrics: selector.top < metrics.top, beforeGuide: selector.top < guide.top };
  });
  expect(selectorPrecedesGuide.beforeMetrics, 'El selector principal debe aparecer antes de las métricas en móvil').toBe(true);
  expect(selectorPrecedesGuide.beforeGuide, 'El selector principal debe aparecer antes de la guía extensa').toBe(true);
  const statusFitsPanel = () => panel.evaluate((element) => {
    const badge = element.querySelector('.temarios-status-pill')!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return badge.left >= bounds.left && badge.right <= bounds.right;
  });
  expect(await statusFitsPanel(), 'El estado inicial debe quedar dentro del panel').toBe(true);
  const quickPickerFits = await panel.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>('.asistencias-quick-periodos-grid');
    const card = grid?.querySelector<HTMLElement>('.asistencia-materia-pick-card');
    if (!grid || !card) return false;
    const panelBounds = element.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    return cardBounds.left >= panelBounds.left && cardBounds.right <= panelBounds.right && grid.scrollWidth <= grid.clientWidth + 1;
  });
  expect(quickPickerFits, 'La selección rápida de materia no debe recortarse en móvil').toBe(true);
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'test-results';
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await assertTitleUsesSolidThemeInk('rgb(15, 23, 42)');
  await page.screenshot({ path: `${evidenceDir}/temarios-320-light.png`, fullPage: true, animations: 'disabled' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await assertTitleUsesSolidThemeInk('rgb(245, 249, 255)');
  await page.screenshot({ path: `${evidenceDir}/temarios-320-dark.png`, fullPage: true, animations: 'disabled' });

  await periodPicker.selectOption('periodo-temarios-dummy');
  await expect(periodStatus).toHaveText('Periodo actualizado');
  await expect(panel.getByRole('button', { name: /Abrir temario Programa de prueba/i })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/temarios-320-lista-dummy-dark.png`, fullPage: true, animations: 'disabled' });

  await panel.getByRole('button', { name: /Abrir temario Programa de prueba/i }).click();
  const treeTab = panel.getByRole('tab', { name: /Programa de prueba \(33%\)/i });
  await expect(treeTab).toHaveAttribute('aria-selected', 'true');
  const coveredNode = panel.getByRole('button', { name: /1\.1 Criterios de retroalimentación y seguimiento individual/i });
  await expect(coveredNode).toBeVisible();
  const coveredTitleDecoration = await coveredNode.locator('.temarios-node-text').evaluate((element) => getComputedStyle(element).textDecorationLine);
  expect(coveredTitleDecoration, 'El estado cubierto se informa con texto; el tachado no debe dificultar la lectura del contenido').not.toContain('line-through');
  const nodeTitleWidth = await panel.locator('.temarios-node-item').first().locator('.temarios-node-text').evaluate((element) => element.getBoundingClientRect().width);
  expect(nodeTitleWidth, 'El título de cada nodo debe conservar un ancho legible a 320 px').toBeGreaterThan(80);
  await page.screenshot({ path: `${evidenceDir}/temarios-320-arbol-dummy-dark.png`, fullPage: true, animations: 'disabled' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: `${evidenceDir}/temarios-320-arbol-dummy-light.png`, fullPage: true, animations: 'disabled' });

  await panel.getByRole('tab', { name: /Cargar temario/i }).click();
  const pdfForm = panel.getByRole('form', { name: 'Carga de temario desde PDF' });
  const selectorPdf = pdfForm.getByRole('button', { name: 'Seleccionar archivo PDF' });
  await expect(selectorPdf).toBeVisible();
  await expect(pdfForm.getByRole('status', { name: 'Archivo PDF' })).toHaveText('Ningún archivo seleccionado.');
  const uploadBox = pdfForm.locator('.temarios-upload-box');
  for (const [theme, expectedBorder] of [['light', 'rgb(154, 91, 0)'], ['dark', 'rgb(255, 209, 102)']] as const) {
    await setVisibleTheme(page, theme);
    await expect.poll(() => uploadBox.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(expectedBorder);
    const uploadColors = await uploadBox.evaluate((element) => {
      const style = getComputedStyle(element);
      return { border: style.borderTopColor, background: style.backgroundColor };
    });
    expect(uploadColors.border, `Temarios: el límite de carga debe usar el token de aviso en tema ${theme}`).toBe(expectedBorder);
    expect(uploadColors.background, `Temarios: el fondo de carga debe usar el lienzo opaco en tema ${theme}`).not.toBe('rgba(0, 0, 0, 0)');
    await uploadBox.hover();
    await expect.poll(() => uploadBox.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(expectedBorder);
    await uploadBox.evaluate((element) => element.classList.add('drag-active'));
    await expect.poll(() => uploadBox.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(expectedBorder);
    await uploadBox.evaluate((element) => element.classList.remove('drag-active'));
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const selectorPdfLayout = await selectorPdf.evaluate((button) => {
      const field = button.closest<HTMLElement>('.temarios-file-field');
      if (!field) return { found: false, left: -Infinity, right: Infinity, contentLeft: Infinity, contentRight: -Infinity, height: 0 };
      const buttonBounds = button.getBoundingClientRect();
      const fieldBounds = field.getBoundingClientRect();
      const style = getComputedStyle(field);
      return {
        found: true,
        left: buttonBounds.left,
        right: buttonBounds.right,
        height: buttonBounds.height,
        contentLeft: fieldBounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        contentRight: fieldBounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight)
      };
    });
    expect(selectorPdfLayout.found, `Temarios ${width}px: el selector debe conservar el campo`).toBe(true);
    expect(selectorPdfLayout.height, `Temarios ${width}px: objetivo táctil de 44 CSS px`).toBeGreaterThanOrEqual(44);
    expect(selectorPdfLayout.left, `Temarios ${width}px: botón dentro del campo`).toBeGreaterThanOrEqual(selectorPdfLayout.contentLeft - 1);
    expect(selectorPdfLayout.right, `Temarios ${width}px: botón sin recorte`).toBeLessThanOrEqual(selectorPdfLayout.contentRight + 1);
  }
  await setVisibleTheme(page, 'light');
  await page.setViewportSize({ width: 320, height: 844 });
  const inputPdf = pdfForm.locator('#temarios-archivo-pdf');
  await expect(inputPdf).toHaveAttribute('aria-hidden', 'true');
  await expect(inputPdf).toHaveAttribute('tabindex', '-1');
  await expect(pdfForm.getByLabel('Nombre del temario')).toBeVisible();
  const manualForm = panel.getByRole('form', { name: 'Carga manual de temario' });
  const nameFieldWidths = await Promise.all([
    pdfForm.getByLabel('Nombre del temario').evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    manualForm.getByLabel('Nombre del temario').evaluate((element) => Math.round(element.getBoundingClientRect().width))
  ]);
  expect(nameFieldWidths[0], 'El nombre del temario PDF debe conservar ancho útil a 320 px').toBeGreaterThanOrEqual(100);
  expect(nameFieldWidths[1], 'El nombre del temario manual debe conservar ancho útil a 320 px').toBeGreaterThanOrEqual(100);
  await page.screenshot({ path: `${evidenceDir}/temarios-320-pdf-dummy-light.png`, fullPage: true, animations: 'disabled' });
  await selectorPdf.focus();
  await expect(selectorPdf).toBeFocused();
  const selectorFocusVisible = await selectorPdf.evaluate((button) => {
    const style = getComputedStyle(button);
    return (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== 'none';
  });
  expect(selectorFocusVisible, 'El botón del selector PDF muestra foco de teclado').toBe(true);
  const fileChooserPromise = page.waitForEvent('filechooser');
  await selectorPdf.press('Enter');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'Programa-academico-demo.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fixture sintético para auditoría visual')
  });
  const selectedPdfStatus = pdfForm.getByRole('status', { name: /Archivo seleccionado: Programa-academico-demo\.pdf/i });
  await expect(selectedPdfStatus).toContainText('(menos de 1 KB).');
  await expect(pdfForm.locator('.temarios-file-pill .nota')).toHaveText('(menos de 1 KB)');
  await expect(pdfForm.getByRole('button', { name: 'Cambiar archivo PDF' })).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.screenshot({ path: `${evidenceDir}/temarios-320-pdf-seleccionado-dummy-dark.png`, fullPage: true, animations: 'disabled' });

  const layout = await panel.evaluate((element) => ({
    overflow: Math.max(0, element.scrollWidth - element.clientWidth),
    overflowingChildren: [...element.querySelectorAll<HTMLElement>('*')]
      .map((child) => ({
        className: typeof child.className === 'string' ? child.className : child.tagName,
        text: (child.innerText || '').replace(/\s+/g, ' ').slice(0, 50),
        right: Math.round(child.getBoundingClientRect().right),
        panelRight: Math.round(element.getBoundingClientRect().right),
        width: Math.round(child.getBoundingClientRect().width),
        scrollWidth: child.scrollWidth,
        clientWidth: child.clientWidth
      }))
      .filter((child) => child.right > Math.round(element.getBoundingClientRect().right) + 1 || child.scrollWidth > child.clientWidth + 1)
      .slice(0, 10),
    statusInside: (() => {
      const badge = element.querySelector('.temarios-status-pill')!.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return badge.left >= bounds.left && badge.right <= bounds.right;
    })()
  }));
  expect(layout.overflow, `Temarios no debe desbordar a 320 px; causas: ${JSON.stringify(layout.overflowingChildren)}`).toBeLessThanOrEqual(1);
  expect(layout.statusInside, 'El estado del periodo debe quedar dentro del panel').toBe(true);

  await page.setViewportSize({ width: 1024, height: 768 });
  const desktopHeaderLayout = await panel.evaluate((element) => {
    const lead = element.querySelector('.temarios-panel__lead')!.getBoundingClientRect();
    const metrics = element.querySelector('.temarios-header-kpis')!.getBoundingClientRect();
    const selector = element.querySelector('.temarios-filtros-bar')!.getBoundingClientRect();
    return {
      leadAndMetricsShareRow: Math.abs(lead.top - metrics.top) < 40,
      selectorFollowsHeader: selector.top >= Math.max(lead.bottom, metrics.bottom)
    };
  });
  expect(desktopHeaderLayout.leadAndMetricsShareRow, 'En escritorio, las métricas deben conservar el encabezado en línea').toBe(true);
  expect(desktopHeaderLayout.selectorFollowsHeader, 'En escritorio, el selector debe quedar debajo del encabezado').toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.getByRole('button', { name: 'Temarios', exact: true }).click();
  await expect(page.locator('#toggle-guia-temarios')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Ayuda: Estructura y seguimiento de temarios' })).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await panel.evaluate((element) => {
    const icon = element.querySelector('.temarios-panel__icon-orb')!;
    const movingElements = [...element.querySelectorAll<HTMLElement>(
      '.anim-icon-pulse, .anim-fade-in, .anim-slide-up, .anim-badge-in, .anim-card-hover, .anim-kpi-hover, .scale-hover, .pulse-glow, .state-badge-pulse'
    )];
    return {
      preferenceActive: matchMedia('(prefers-reduced-motion: reduce)').matches,
      iconAnimation: getComputedStyle(icon).animationName,
      remainingAnimations: movingElements.filter((item) => getComputedStyle(item).animationName !== 'none').length,
      remainingTransitions: movingElements.filter((item) => getComputedStyle(item).transitionDuration.split(',').some((duration) => Number.parseFloat(duration) > 0)).length
    };
  });
  expect(reducedMotion.preferenceActive).toBe(true);
  expect(reducedMotion.iconAnimation, 'El pulso decorativo del encabezado se detiene con movimiento reducido').toBe('none');
  expect(reducedMotion.remainingAnimations, 'Temarios no conserva animaciones cuando se solicita movimiento reducido').toBe(0);
  expect(reducedMotion.remainingTransitions, 'Temarios no conserva transiciones cuando se solicita movimiento reducido').toBe(0);
});

test('presenta el error recuperable de Google Desktop en Login con fixture ficticia', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('tokenDocente'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ capacidadesIntegraciones: {
      oauthGoogleBackend: false, oauthGoogleDesktopBackend: true, passwordLoginAllowed: true
    } }) });
  });
  await page.route('**/api/autenticacion/google-desktop/iniciar', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ flowId: 'google-desktop-dummy', url: 'https://accounts.google.com/dummy' }) });
  });
  await page.route('**/api/autenticacion/google-desktop/resultado', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ estado: 'error', codigo: 'GOOGLE_DESKTOP_OAUTH_FAILED' }) });
  });
  await page.route('**/api/autenticacion/google-desktop/cancelar', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.context().route('https://accounts.google.com/gsi/client', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* SDK externo omitido en fixture E2E */' });
  });
  await page.context().route('https://accounts.google.com/dummy', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Proveedor OAuth ficticio</title>' });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/acceso', { waitUntil: 'domcontentloaded' });

  const mockupOmr = page.locator('.auth-omr-mockup-card');
  await expect(mockupOmr).toContainText('Lectura óptica de respuestas');
  await expect(mockupOmr).toContainText('Procesa las hojas y revisa los resultados.');
  await expect(mockupOmr).toContainText('Leída');
  await expect(mockupOmr).not.toContainText(/100%|precisa|<\s*1\s*seg/i);

  const iniciarGoogle = page.getByRole('button', { name: 'Acceder con Google' });
  await expect(iniciarGoogle).toBeVisible({ timeout: 15_000 });
  const popup = page.waitForEvent('popup');
  await iniciarGoogle.click();
  const popupPage = await popup;
  await expect(popupPage).toHaveURL(/accounts\.google\.com/);

  const alerta = page.getByRole('alert').filter({ hasText: 'Google no pudo confirmar tu identidad.' });
  await expect(alerta).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('group', { name: 'Error inesperado' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reintentar con Google' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Correo (obligatorio)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Contraseña (obligatoria)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restablecer contraseña' })).toBeVisible();
  const recordarSesion = page.getByRole('checkbox', { name: 'Mantener sesión iniciada en este equipo' });
  const ayudaSesionRecordada = page.getByText('Si lo compartes, desactívala.', { exact: true });
  await expect(recordarSesion).toBeChecked();
  await expect(recordarSesion).toHaveAccessibleDescription('Si lo compartes, desactívala.');
  await expect(ayudaSesionRecordada).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar con correo y contraseña' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Recuperar contraseña con Google' })).toHaveCount(0);

  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'test-results';
  await mkdir(evidenceDir, { recursive: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await assertNoHorizontalOverflow(page, `Login con error recuperable de Google a ${width}px`);
    const accesoPorContrasena = page.getByRole('form', { name: 'Acceso docente' }).getByRole('button', { name: 'Ingresar', exact: true });
    const rectAcceso = await accesoPorContrasena.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: window.innerHeight };
    });
    const accesoVisibleEnViewport = rectAcceso.top >= 0 && rectAcceso.bottom <= rectAcceso.height;
    for (const theme of ['light', 'dark']) {
      await page.evaluate((nextTheme) => document.documentElement.setAttribute('data-theme', nextTheme), theme);
      await page.screenshot({ path: `${evidenceDir}/login-google-desktop-error-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
    }
    expect(accesoVisibleEnViewport, `Login con error recuperable de Google a ${width}px: acción principal visible sin desplazamiento; límites=${JSON.stringify(rectAcceso)}`).toBe(true);
  }

  await page.setViewportSize({ width: 320, height: 844 });
  await page.locator('.auth-tabs-segmented .auth-segmented-btn').nth(1).click();
  const formularioRegistro = page.getByRole('form', { name: 'Registro docente' });
  await expect(formularioRegistro).toBeVisible();
  const campoContrasena = formularioRegistro.locator('#auth-password');
  const niveles = [
    { valor: 'abcde', nivel: '1', texto: 'Muy corta' },
    { valor: 'abcdefg', nivel: '2', texto: 'Mínimo 8 caracteres' },
    { valor: 'abcdefg1', nivel: '3', texto: 'Buena seguridad' },
    { valor: 'Abcdefgh1!', nivel: '4', texto: 'Excelente y segura' }
  ];
  for (const theme of ['light', 'dark']) {
    await page.evaluate((nextTheme) => document.documentElement.setAttribute('data-theme', nextTheme), theme);
    for (const estado of niveles) {
      await campoContrasena.fill(estado.valor);
      const medidor = formularioRegistro.locator(`.auth-pwd-meter[data-nivel="${estado.nivel}"]`);
      await expect(medidor.getByRole('status')).toHaveText(estado.texto);
      const barrasActivas = medidor.locator('.auth-pwd-bar--active');
      await expect(barrasActivas).toHaveCount(Number(estado.nivel));
      const { colorActivo, colorInactivo } = await medidor.evaluate((element) => {
        const barras = element.querySelector('.auth-pwd-meter-bars');
        const muestraVacia = document.createElement('span');
        muestraVacia.className = 'auth-pwd-bar';
        barras?.append(muestraVacia);
        const colorInactivo = getComputedStyle(muestraVacia).backgroundColor;
        muestraVacia.remove();
        const colorActivo = getComputedStyle(element.querySelector('.auth-pwd-bar--active')!).backgroundColor;
        return { colorActivo, colorInactivo };
      });
      expect(colorActivo, `el nivel ${estado.nivel} debe distinguirse del segmento vacío en ${theme}`).not.toBe(colorInactivo);
      await assertRenderedTextContrast(medidor.getByRole('status'), `Medidor de contraseña ${estado.nivel} / ${theme}`);
      if (estado.nivel === '4') {
        await assertNoHorizontalOverflow(page, `Medidor de contraseña a 320 px / ${theme}`);
        await page.screenshot({ path: `${evidenceDir}/login-password-meter-320-${theme}.png`, fullPage: true, animations: 'disabled' });
      }
    }
  }
});

test('audita conexión Classroom con fixture ficticia en móvil y ambos temas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  let puedeAdministrarClassroom = true;
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-classroom-ux-dummy'));
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docente: {
      _id: 'docente-classroom-dummy', nombre: 'Docente de prueba', correo: 'classroom@example.invalid',
      permisos: ['periodos:leer', ...(puedeAdministrarClassroom ? ['classroom:conectar'] : []), 'classroom:pull', 'calificaciones:calificar', 'cuenta:leer'],
      roles: ['docente']
    } }) });
  });
  await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ capacidadesIntegraciones: { classroomBackend: true } }) });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/evaluaciones/v2/classroom/estado', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ estado: {
      conectado: false, correoLogin: 'classroom@example.invalid', identidadCoincidente: false
    } }) });
  });
  await page.route('**/api/evaluaciones/v2/classroom/oauth/iniciar', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=dummy' }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Classroom' });
  const panel = page.locator('section.cuenta-panel').filter({ has: page.getByRole('heading', { name: 'Google Classroom' }) });
  await expect(panel.getByText('Cuenta Classroom no conectada')).toBeVisible();
  await expect(panel.getByText(/Autoriza con la misma cuenta que usas en EvaluaPro/)).toBeVisible();
  await expect(panel.getByText('Cuenta de inicio en EvaluaPro')).toBeVisible();
  const correoLogin = panel.locator('.classroom-login-identity > strong');
  await expect(correoLogin).toHaveText('classroom@example.invalid');
  await expect(correoLogin).toHaveCSS('overflow-wrap', 'normal');
  await expect(correoLogin).toHaveCSS('word-break', 'normal');

  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'test-results';
  const capture = async (name: string) => page.screenshot({ path: `${evidenceDir}/classroom-${name}.png`, fullPage: true, animations: 'disabled' });
  const assertFits = async (width: number) => {
    const bounds = await panel.evaluate((element) => {
      const panelRect = element.getBoundingClientRect();
      const action = element.querySelector('.classroom-conexion__acciones')!.getBoundingClientRect();
      return { panelRight: panelRect.right, actionRight: action.right, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(bounds.documentOverflow, `Classroom no debe desbordar a ${width} px`).toBeLessThanOrEqual(1);
    expect(bounds.actionRight, `Las acciones deben quedar dentro del panel a ${width} px`).toBeLessThanOrEqual(bounds.panelRight + 1);
  };

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await assertFits(320);
  await assertTextContrast(page.locator('.banco-section-pill:visible'), 'Etiquetas de Classroom en tema claro');
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Conectar Google Classroom' }), 'CTA Classroom claro');
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Revisar en Calificaciones' }), 'CTA Calificaciones claro');
  await panel.getByRole('button', { name: 'Conectar Google Classroom' }).hover();
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Conectar Google Classroom' }), 'Hover de conexión Classroom claro');
  await page.mouse.move(0, 0);
  await capture('320-light-disconnected');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Conectar Google Classroom' }), 'CTA Classroom oscuro');
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Revisar en Calificaciones' }), 'CTA Calificaciones oscuro');
  await panel.getByRole('button', { name: 'Conectar Google Classroom' }).hover();
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Conectar Google Classroom' }), 'Hover de conexión Classroom oscuro');
  await page.mouse.move(0, 0);
  await capture('320-dark-disconnected');

  await panel.getByRole('button', { name: 'Conectar Google Classroom' }).click();
  const oauthLink = panel.getByRole('link', { name: /Continuar con Google.*pestaña nueva/i });
  await expect(oauthLink).toHaveAttribute('href', /^https:\/\/accounts\.google\.com\//);
  await expect(panel.getByRole('status')).toContainText(/vence en 10 minutos/i);
  const renovarEnlace = panel.getByRole('button', { name: 'Solicitar otro enlace' });
  await expect(renovarEnlace).toBeVisible();
  await expect(renovarEnlace).toHaveClass(/classroom-sync__renew-action/);
  await expect(renovarEnlace).toHaveClass(/secundario/);
  await expect(panel.getByRole('button', { name: 'Conectar Google Classroom' })).toHaveCount(0);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await assertSolidButtonTextContrast(renovarEnlace, 'Renovar enlace OAuth Classroom claro');
  await renovarEnlace.hover();
  await assertSolidButtonTextContrast(renovarEnlace, 'Hover al renovar enlace OAuth Classroom claro');
  await page.mouse.move(0, 0);
  await assertSolidButtonTextContrast(oauthLink, 'Enlace OAuth Classroom claro');
  await oauthLink.hover();
  await assertSolidButtonTextContrast(oauthLink, 'Hover del enlace OAuth Classroom claro');
  await page.mouse.move(0, 0);
  await assertTextContrast(page.locator('.banco-section-pill:visible'), 'Etiquetas de Classroom al conectar en tema claro');
  await capture('320-light-oauth-ready');

  await page.setViewportSize({ width: 390, height: 844 });
  await assertFits(390);
  await expect(panel.getByText('Datos sincronizados')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Revisar en Calificaciones' })).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await assertSolidButtonTextContrast(renovarEnlace, 'Renovar enlace OAuth Classroom oscuro');
  await renovarEnlace.hover();
  await assertSolidButtonTextContrast(renovarEnlace, 'Hover al renovar enlace OAuth Classroom oscuro');
  await page.mouse.move(0, 0);
  await assertSolidButtonTextContrast(oauthLink, 'Enlace OAuth Classroom oscuro');
  await oauthLink.hover();
  await assertSolidButtonTextContrast(oauthLink, 'Hover del enlace OAuth Classroom oscuro');
  await panel.getByRole('button', { name: 'Revisar en Calificaciones' }).hover();
  await assertSolidButtonTextContrast(panel.getByRole('button', { name: 'Revisar en Calificaciones' }), 'Hover CTA Calificaciones oscuro');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(120);
  await capture('390-dark-oauth-ready');

  puedeAdministrarClassroom = false;
  await page.setViewportSize({ width: 320, height: 800 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const navSinPermiso = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(navSinPermiso).toBeVisible({ timeout: 15_000 });
  await navSinPermiso.locator('#navegacion-docente-movil').selectOption({ label: 'Classroom' });
  const panelSinPermiso = page.locator('section.cuenta-panel').filter({ has: page.getByRole('heading', { name: 'Google Classroom' }) });
  await expect(panelSinPermiso.getByText(/no tiene permiso para vincular Google Classroom/i)).toBeVisible();
  await expect(panelSinPermiso.getByRole('button', { name: 'Conectar Google Classroom' })).toHaveCount(0);
  await expect(panelSinPermiso.getByText(/Autoriza con la misma cuenta que usas en EvaluaPro/i)).toHaveCount(0);
  const correoSinPermiso = panelSinPermiso.locator('.classroom-login-identity > strong');
  const dimensionesCorreo = await correoSinPermiso.evaluate((element) => ({
    texto: element.textContent,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    cajaDerecha: element.getBoundingClientRect().right,
    identidadDerecha: element.parentElement!.getBoundingClientRect().right
  }));
  expect(dimensionesCorreo.texto).toBe('classroom@example.invalid');
  expect(dimensionesCorreo.scrollWidth).toBeLessThanOrEqual(dimensionesCorreo.clientWidth);
  expect(dimensionesCorreo.cajaDerecha).toBeLessThanOrEqual(dimensionesCorreo.identidadDerecha + 1);
  await assertNoHorizontalOverflow(page, 'Classroom sin permiso de conexión a 320 px');
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((nextTheme) => document.documentElement.setAttribute('data-theme', nextTheme), theme);
    await capture(`320-${theme}-permission-denied`);
  }
});

test('audita estados de Rehidratación con paquete sintético a 320 y 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  let modoInventario: 'cargado' | 'vacio' | 'error' = 'cargado';
  let primeraConsultaInventario = true;
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-rehidratacion-ux-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docente: {
      _id: 'docente-rehidratacion-dummy', nombre: 'Docente de prueba', correo: 'rehidratacion@example.invalid',
      permisos: ['periodos:leer', 'cuenta:leer', 'omr:rehidratar_lotes'], roles: ['docente']
    } }) });
  });
  await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/analiticas/eventos-uso', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/recuperacion/bundles', async (route) => {
    if (primeraConsultaInventario) {
      primeraConsultaInventario = false;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    if (modoInventario === 'error') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Servicio temporalmente no disponible.' }) });
      return;
    }
    const items = modoInventario === 'vacio' ? [] : [{
      bundleHash: 'sha256-demo-lote-01', loteId: 'LOTE-DEMO-01', templateVersion: 4,
      examCount: 25, questionBankCount: 10, signatureValid: true, recoverable: true, causes: []
    }, {
      bundleHash: 'sha256-demo-lote-02', loteId: 'LOTE-DEMO-02', templateVersion: 3,
      examCount: 18, questionBankCount: 8, signatureValid: false, recoverable: false, causes: ['La firma digital no coincide.']
    }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) });
  });
  await page.route('**/api/recuperacion/verificar', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      bundleHash: 'sha256-demo-lote-01', signatureValid: true, templateVersion: 4,
      examCount: 25, questionBankCount: 10, recoverable: true, causes: []
    }) });
  });
  await page.route('**/api/recuperacion/bundle/reconstruir', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'reconstruida', reconstructedExamIds: ['examen-demo-01'],
      reconstructedQuestionBankIds: ['reactivo-demo-01'], conflicts: [],
      bundleHash: 'sha256-demo-lote-01', manifestHashes: ['manifest-demo-01']
    }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Rehidratación' });
  const panel = page.locator('.rehidratacion-panel');
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'test-results';
  const capture = async (name: string) => page.screenshot({ path: `${evidenceDir}/rehidratacion-${name}.png`, fullPage: true, animations: 'disabled' });
  await expect(panel.getByRole('status')).toContainText('Cargando inventario de paquetes de recuperación');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await capture('320-light-loading');
  const ayudaVisual = page.locator('details.rehidratacion-ayuda');
  await expect(ayudaVisual).not.toHaveAttribute('open');
  await expect(ayudaVisual.locator('summary')).toContainText('Disponible');
  const resumenAyudaVisual = ayudaVisual.locator('summary');
  await resumenAyudaVisual.focus();
  await page.keyboard.press('Enter');
  await expect(ayudaVisual).toHaveAttribute('open', '');
  await expect(ayudaVisual.getByRole('button', { name: 'Abrir herramienta en una pestaña nueva' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(ayudaVisual).not.toHaveAttribute('open');
  await expect(panel.getByText('Paquete activo: sha256-demo-lote-01', { exact: true })).toBeVisible();
  await expect(panel.getByText('25 exámenes', { exact: true })).toBeVisible();
  await expect(panel.getByText('Sin operación ejecutada')).toBeVisible();
  await expect(panel.getByRole('button', { name: /Lote LOTE-DEMO-02/i })).toContainText('Firma no válida');
  const assertNoOverflow = async (width: number) => {
    const { overflow, offenders, metrics } = await page.evaluate(() => {
      const documentOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const panelElement = document.querySelector<HTMLElement>('.rehidratacion-panel');
      const localOverflow = panelElement ? panelElement.scrollWidth - panelElement.clientWidth : 0;
      const metrics = [...document.querySelectorAll<HTMLElement>('.rehidratacion-kpi-grid')].map((element) => ({
        width: element.clientWidth, scrollWidth: element.scrollWidth, grid: getComputedStyle(element).gridTemplateColumns,
        parent: element.parentElement?.className
      }));
      const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 6)
        .map((element) => ({ selector: element.className.toString(), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }));
      return { overflow: Math.max(documentOverflow, localOverflow), offenders, metrics };
    });
    expect(overflow, `Rehidratación no debe desbordar a ${width} px. Elementos: ${JSON.stringify(offenders)} KPIs: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(1);
  };
  const assertCompactKpis = async (width: number) => {
    const groups = panel.locator('.rehidratacion-kpi-grid');
    await expect(groups).toHaveCount(2);
    for (const group of await groups.all()) {
      const columns = await group.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
      expect(columns, `Resumen de Rehidratación debe ocupar dos columnas a ${width} px`).toBe(2);
    }
  };

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await assertNoOverflow(320);
  await assertCompactKpis(320);
  const contrastesEstados = await panel.locator('.rehidratacion-lotes__bundle .badge').evaluateAll((badges) => {
    const luminancia = (rgb: string) => {
      const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const lineales = channels.map((channel) => {
        const valor = channel / 255;
        return valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (lineales[0] ?? 0) + 0.7152 * (lineales[1] ?? 0) + 0.0722 * (lineales[2] ?? 0);
    };
    return badges.map((badge) => {
      const style = getComputedStyle(badge);
      const colores = [luminancia(style.color), luminancia(style.backgroundColor)].sort((a, b) => b - a);
      return { texto: badge.textContent?.trim(), ratio: ((colores[0] ?? 0) + 0.05) / ((colores[1] ?? 0) + 0.05), color: style.color, background: style.backgroundColor };
    });
  });
  expect(contrastesEstados.length).toBeGreaterThanOrEqual(6);
  expect(contrastesEstados.every((estado) => estado.ratio >= 4.5), JSON.stringify(contrastesEstados)).toBe(true);
  expect(contrastesEstados[0]?.color).not.toBe(contrastesEstados[3]?.color);
  await capture('320-light-loaded');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await capture('320-dark-loaded');

  await panel.getByRole('button', { name: 'Verificar paquete' }).click();
  await expect(panel.getByText('Verificado; sin reconstrucción')).toBeVisible();
  await expect(panel.getByText('La firma y la estructura del paquete son consistentes para su reconstrucción.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow(390);
  await assertCompactKpis(390);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(120);
  await capture('390-dark-verified');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const columnasPaquetes = await panel.locator('.rehidratacion-lotes__grid').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
  );
  expect(columnasPaquetes, 'Los paquetes deben permitir comparación paralela en escritorio').toBe(2);
  await assertNoOverflow(1440);
  await capture('1440-dark-verified');

  await panel.getByRole('button', { name: 'Reconstruir lote' }).click();
  await expect(panel.getByText('Resultado de reconstrucción')).toBeVisible();
  await expect(panel.getByText('La reconstrucción quedó guardada sin conflictos estructurales.')).toBeVisible();
  await expect(panel.getByText('Estado de operación').locator('..')).toContainText('Reconstrucción completada');
  await capture('1440-dark-reconstructed');

  await page.setViewportSize({ width: 320, height: 800 });
  modoInventario = 'vacio';
  await panel.getByRole('button', { name: 'Actualizar inventario' }).click();
  await expect(panel.getByText(/No se encontraron paquetes de recuperación/i)).toBeVisible();
  await expect(panel.getByText('Paquetes detectados').locator('..')).toContainText('0');
  await capture('320-dark-empty');

  modoInventario = 'error';
  await panel.getByRole('button', { name: 'Actualizar inventario' }).click();
  await expect(panel.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByText('Paquetes detectados').locator('..')).toContainText('No se pudo cargar');
  await expect(panel.getByText('Estado de operación').locator('..')).toContainText('No disponible');
  await expect(panel.getByRole('button', { name: 'Reintentar carga' })).toBeVisible();
  await capture('320-dark-error');

  modoInventario = 'cargado';
  await panel.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(panel.getByText('Paquete activo: sha256-demo-lote-01', { exact: true })).toBeVisible();
  await capture('320-dark-recovered');
});

test('audita Entrega con datos sintéticos y reinicia la búsqueda al cambiar materia', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-entrega-ux-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docente: {
      _id: 'docente-entrega-dummy', nombre: 'Docente de prueba', correo: 'entrega@example.invalid',
      permisos: ['periodos:leer', 'alumnos:leer', 'examenes:leer', 'entregas:gestionar', 'cuenta:leer'], roles: ['docente']
    } }) });
  });
  await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/periodos?activo=1', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [
      { _id: 'periodo-entrega-1', nombre: 'Química 2026-A', activo: true },
      { _id: 'periodo-entrega-2', nombre: 'Física 2026-A', activo: true }
    ] }) });
  });
  await page.route('**/api/periodos?activo=0', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/alumnos', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [{
      _id: 'alumno-entrega-dummy', periodoId: 'periodo-entrega-1', matricula: 'DUMMY-017', nombreCompleto: 'Alumna de Prueba', grupo: '2A'
    }] }) });
  });
  await page.route('**/api/examenes/generados**', async (route) => {
    const periodoId = new URL(route.request().url()).searchParams.get('periodoId');
    const examenes = periodoId === 'periodo-entrega-2'
      ? [{ _id: 'examen-entrega-2', folio: 'FOL-FIS-202', periodoId, estado: 'generado' }]
      : [
          { _id: 'examen-entrega-1', folio: 'FOL-QUI-001', alumnoId: 'alumno-entrega-dummy', periodoId, plantillaId: 'plantilla-entrega-dummy', estado: 'entregado' },
          { _id: 'examen-entrega-3', folio: 'FOL-QUI-002', periodoId, estado: 'generado' }
        ];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ examenes, nextCursor: 'cursor-dummy' }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Entrega' });
  const recordatorio = page.locator('.banner-recordatorio-asistencia');
  await expect(recordatorio.getByRole('status')).toHaveText('Pase de lista pendiente hoy.');
  const cerrarRecordatorio = recordatorio.getByRole('button', { name: 'Cerrar recordatorio' });
  await expect(cerrarRecordatorio.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  const geometriaRecordatorio = await recordatorio.evaluate((element) => {
    const status = element.querySelector<HTMLElement>('[role="status"]')!.getBoundingClientRect();
    const accion = element.querySelector<HTMLElement>('.asistencias-btn-primario')!.getBoundingClientRect();
    const cerrar = element.querySelector<HTMLElement>('.banner-recordatorio-asistencia__close')!.getBoundingClientRect();
    return {
      alto: element.getBoundingClientRect().height,
      control44px: accion.width >= 43.5 && accion.height >= 43.5 && cerrar.width >= 43.5 && cerrar.height >= 43.5,
      separados: accion.left >= status.right - 1 && accion.right <= cerrar.left,
        sinOverflow: element.scrollWidth <= element.clientWidth,
        rects: { status: { x: status.x, y: status.y, width: status.width, height: status.height }, accion: { x: accion.x, y: accion.y, width: accion.width, height: accion.height }, cerrar: { x: cerrar.x, y: cerrar.y, width: cerrar.width, height: cerrar.height } },
        grid: getComputedStyle(element).gridTemplateAreas,
        marginAction: getComputedStyle(element.querySelector<HTMLElement>('.asistencias-btn-primario')!).margin,
        padding: getComputedStyle(element).padding
    };
  });
  expect(geometriaRecordatorio.alto, `El recordatorio compacto debe caber en una fila: ${JSON.stringify(geometriaRecordatorio)}`).toBeLessThanOrEqual(88);
  expect(geometriaRecordatorio.control44px, 'Las acciones del recordatorio deben conservar objetivos táctiles de 44 px').toBe(true);
  expect(geometriaRecordatorio.separados, 'El texto, la acción y el cierre deben quedar en una fila sin solaparse').toBe(true);
  expect(geometriaRecordatorio.sinOverflow, 'El recordatorio no debe desbordarse dentro de su propio contenedor').toBe(true);
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'test-results';
  for (const theme of ['light', 'dark']) {
    await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
    await recordatorio.screenshot({ path: `${evidenceDir}/ux-recordatorio-entrega-320-${theme}.png`, animations: 'disabled' });
  }
  const panel = page.locator('.entregas-panel');
  await expect(panel.getByText('FOL-QUI-001')).toBeVisible();
  const selectorMateria = page.getByLabel('Materia activa', { exact: true });
  await expect(selectorMateria).toHaveAccessibleDescription('Define los folios y alumnos que se consultan y vinculan en esta vista.');
  const selectorMateriaTop = await selectorMateria.evaluate((element) => element.getBoundingClientRect().top);
  const registroEntregaTop = await page.locator('.entregas-panel--registro').evaluate((element) => element.getBoundingClientRect().top);
  expect(selectorMateriaTop, 'La materia que condiciona la recepción debe conocerse antes del formulario de registro').toBeLessThan(registroEntregaTop);
  const selectorMultiples = panel.getByLabel('Seleccionar varias imágenes', { exact: true });
  const selectorCarpeta = panel.getByLabel('Seleccionar carpeta completa de imágenes', { exact: true });
  await expect(selectorMultiples).toHaveAttribute('type', 'file');
  await expect(selectorMultiples).toHaveAccessibleDescription('Elige varias hojas para procesarlas juntas.');
  await expect(selectorCarpeta).toHaveAttribute('type', 'file');
  await expect(selectorCarpeta).toHaveAccessibleDescription('Elige una carpeta que contenga las hojas del lote.');
  const selectoresDeCaptura = await panel.locator('.entregas-dropzone').evaluateAll((cards) => cards.map((card) => {
    const bounds = card.getBoundingClientRect();
    const textNodes = [...card.querySelectorAll<HTMLElement>('.entregas-dropzone__label, .entregas-dropzone__hint')];
    return textNodes.flatMap((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return Array.from(range.getClientRects()).filter((rect) =>
        rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1
      ).map((rect) => ({ text: node.textContent?.trim(), left: rect.left, right: rect.right, cardLeft: bounds.left, cardRight: bounds.right }));
    });
  }).flat());
  expect(selectoresDeCaptura, 'El nombre y la ayuda de cada selector deben caber dentro de su tarjeta a 320 px').toEqual([]);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await selectorMultiples.focus();
  const tarjetaMultiples = selectorMultiples.locator('..');
  await expect(tarjetaMultiples).toHaveCSS('outline-style', 'solid');
  await expect(tarjetaMultiples).toHaveCSS('outline-color', 'rgb(15, 139, 141)');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await selectorCarpeta.focus();
  await expect(selectorCarpeta.locator('..')).toHaveCSS('outline-color', 'rgb(14, 165, 233)');
  const guiaEntrega = page.locator('#toggle-guia-entrega');
  await expect(guiaEntrega).toHaveAccessibleName('Ver guía rápida de recepción de exámenes');
  await expect(guiaEntrega).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Ayuda: Registro y recepción de exámenes' })).toBeHidden();
  await guiaEntrega.focus();
  await page.keyboard.press('Enter');
  await expect(guiaEntrega).toBeFocused();
  await expect(guiaEntrega).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Ayuda: Registro y recepción de exámenes' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(guiaEntrega).toBeFocused();
  await expect(guiaEntrega).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.getByRole('status').filter({ hasText: 'Conteos calculados' })).toContainText(/2 resultados visibles, de 2 exámenes cargados.*la materia puede tener más registros/i);
  await expect(page.locator('.entregas-panel:not(.entregas-panel--registro) .banco-section-title .item-actions .banco-counter-tag'), 'La bitácora no debe repetir los conteos ya visibles en la cabecera').toHaveCount(0);
  await expect(page.locator('.entrega-header-kpis .banco-mini-kpi--preguntas .banco-mini-kpi__num')).toHaveText('2');
  await expect(page.locator('.entrega-header-kpis .banco-mini-kpi--temaactual .banco-mini-kpi__num')).toHaveText('1');
  await expect(page.locator('.entrega-header-kpis .banco-mini-kpi--sintema .banco-mini-kpi__num')).toHaveText('1');
  await expect(panel.getByText('Entregados (1)', { exact: true })).toBeVisible();
  await expect(panel.getByText('Pendientes (1)', { exact: true })).toBeVisible();
  const conexionMovil = panel.locator('.entregas-qr-companion');
  const resumenConexionMovil = conexionMovil.locator('summary');
  await expect(resumenConexionMovil).toContainText('Conexión móvil (opcional)');
  await expect(conexionMovil).not.toHaveAttribute('open', '');
  await resumenConexionMovil.focus();
  await expect(resumenConexionMovil).toHaveCSS('outline-style', 'solid');
  await expect(page.locator('.entregas-panel--registro')).toHaveCSS('outline-style', 'none');
  await page.keyboard.press('Enter');
  await expect.poll(() => conexionMovil.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);
  await expect(conexionMovil.getByRole('heading', { name: 'Escaneo desde el teléfono' })).toBeVisible();
  await expect(resumenConexionMovil).toHaveCSS('outline-style', 'solid');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: `${evidenceDir}/entrega-320-light-mobile-connection-open.png`, fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Space');
  await expect.poll(() => conexionMovil.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(false);
  await page.screenshot({ path: `${evidenceDir}/entrega-320-light-loaded.png`, fullPage: true, animations: 'disabled' });

  const buscar = panel.getByRole('searchbox', { name: 'Buscar folio, matrícula o alumno' });
  await buscar.fill('FOL-QUI-001');
  await expect(panel.getByRole('status').filter({ hasText: 'Conteos calculados' })).toContainText('1 resultado visible, de 2 exámenes cargados');
  await selectorMateria.selectOption('periodo-entrega-2');
  await expect(buscar).toHaveValue('');
  await expect(panel.getByText('FOL-FIS-202')).toBeVisible();
  await expect(panel.getByText('FOL-QUI-001')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${evidenceDir}/entrega-390-dark-periodo-cambiado.png`, fullPage: true, animations: 'disabled' });

  const carpetaSinImagenes = await mkdtemp(path.join(tmpdir(), 'evaluapro-entrega-sin-imagenes-'));
  try {
    await writeFile(path.join(carpetaSinImagenes, 'instrucciones.pdf'), Buffer.from('archivo ficticio incompatible'));
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await selectorCarpeta.setInputFiles(carpetaSinImagenes);
        const errorCarpeta = panel.getByRole('status').filter({ hasText: 'No se reconocieron imágenes de examen.' });
        await expect(errorCarpeta).toBeVisible();
        await expect(errorCarpeta).toContainText('Elige otra carpeta o selecciona imágenes manualmente.');
        await expect(panel.getByRole('status').filter({ hasText: 'Procesando imágenes y leyendo códigos QR' })).toHaveCount(0);
        await expect(panel.getByText('FOL-FIS-202')).toBeVisible();
        await assertNoHorizontalOverflow(page, `Entrega: recuperación de carpeta ${width}px / ${theme}`);
        await assertPanelTextFitsViewport(page, page.locator('.entregas-panel--registro'), `Entrega: error de carpeta ${width}px / ${theme}`);
        await page.screenshot({
          path: `${evidenceDir}/entrega-carpeta-sin-imagenes-${width}-${theme}.png`,
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
  } finally {
    await rm(carpetaSinImagenes, { recursive: true, force: true });
  }
});

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, context: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${context}: overflow horizontal detectado`).toBeLessThanOrEqual(1);
}

async function assertSectionEmblem(page: import('@playwright/test').Page, context: string) {
  const emblems = page.locator('.icono-seccion-orb:visible');
  await expect(emblems, `${context}: debe mostrarse un solo emblema principal`).toHaveCount(1);
  const geometry = await emblems.evaluate((orb) => {
    const icon = orb.querySelector<SVGElement>('svg.icono');
    const style = getComputedStyle(orb);
    const iconStyle = icon ? getComputedStyle(icon) : null;
    return {
      width: style.width,
      height: style.height,
      radius: style.borderTopLeftRadius,
      hasBackground: style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none',
      iconWidth: iconStyle?.width ?? null,
      iconHeight: iconStyle?.height ?? null,
      hiddenFromAssistiveTech: orb.getAttribute('aria-hidden')
    };
  });
  expect(geometry, context).toEqual({
    width: '52px',
    height: '52px',
    radius: '50%',
    hasBackground: true,
    iconWidth: '24px',
    iconHeight: '24px',
    hiddenFromAssistiveTech: 'true'
  });
}

test('normaliza los emblemas principales en secciones docentes y ambos temas con datos ficticios', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('tokenDocente', 'token-iconografia-dummy');
  });
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-iconografia-dummy',
        nombre: 'Docente de Prueba',
        correo: 'docente@example.invalid',
        permisos: ['periodos:leer', 'periodos:gestionar', 'alumnos:leer', 'alumnos:gestionar', 'banco:leer', 'plantillas:leer', 'entregas:gestionar', 'omr:analizar', 'calificaciones:calificar', 'sincronizacion:listar', 'cuenta:leer', 'evaluaciones:leer'],
        roles: ['docente']
      } })
    });
  });
  await page.route('**/api/periodos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
  });
  await page.route('**/api/alumnos**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const sections: TabCase[] = [
    { label: 'Materias', slug: 'periodos' },
    { label: 'Alumnos', slug: 'alumnos' },
    { label: 'Asistencias', slug: 'asistencias' },
    { label: 'Temarios', slug: 'temarios' },
    { label: 'Banco', slug: 'banco' },
    { label: 'Diseño de Exámenes', slug: 'plantillas' },
    { label: 'Entrega', slug: 'entrega' },
    { label: 'Evaluaciones', slug: 'evaluaciones' },
    { label: 'Sincronización', slug: 'sincronizacion' },
    { label: 'Cuenta', slug: 'cuenta' }
  ];
  const mobilePicker = nav.locator('#navegacion-docente-movil');
  for (const section of sections) {
    await mobilePicker.selectOption({ label: section.label });
    await expect(nav.locator('button.tab[aria-current="page"]')).toHaveText(section.label);
    await assertSectionEmblem(page, `Emblema de ${section.label} en modo oscuro`);
    if (section.slug === 'periodos') {
      for (const [index, label] of ['Registra tu materia y fechas', 'Inscribe a tus alumnos', 'Califica exámenes con OMR'].entries()) {
        await assertRenderedTextContrast(
          page.locator('.empty-step > span:not(.empty-step__num)').nth(index),
          `Paso vacío de Materias «${label}» / tema oscuro`
        );
      }
      await assertRenderedTextContrast(page.locator('.empty-step__arrow').first(), 'Flecha entre pasos de Materias / tema oscuro');
      const iconShapes = await page.locator('.materias-panel__icon-orb svg, .materia-mini-kpi--active svg').evaluateAll((icons) =>
        icons.map((icon) => Array.from(icon.querySelectorAll('path,circle,line,rect,polyline,polygon'))
          .map((shape) => `${shape.tagName}:${shape.getAttribute('d') ?? shape.getAttribute('points') ?? ''}`)
          .join('|'))
      );
      expect(iconShapes, 'El emblema de Materias y el KPI no repiten el mismo glifo').toHaveLength(2);
      expect(iconShapes[0]).not.toBe(iconShapes[1]);
    }
    if (['periodos', 'entrega', 'plantillas', 'cuenta'].includes(section.slug)) {
      await page.screenshot({ path: `${evidenceDir}/icono-${section.slug}-dark-320.png`, fullPage: true, animations: 'disabled' });
    }
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await assertSectionEmblem(page, `Emblema de ${section.label} en modo claro`);
    if (section.slug === 'periodos') {
      for (const [index, label] of ['Registra tu materia y fechas', 'Inscribe a tus alumnos', 'Califica exámenes con OMR'].entries()) {
        await assertRenderedTextContrast(
          page.locator('.empty-step > span:not(.empty-step__num)').nth(index),
          `Paso vacío de Materias «${label}» / tema claro`
        );
      }
      await assertRenderedTextContrast(page.locator('.empty-step__arrow').first(), 'Flecha entre pasos de Materias / tema claro');
    }
    if (['periodos', 'entrega', 'plantillas', 'cuenta'].includes(section.slug)) {
      await page.screenshot({ path: `${evidenceDir}/icono-${section.slug}-light-320.png`, fullPage: true, animations: 'disabled' });
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  }
});

test('recorre todas las secciones permitidas con teclado en móvil y escritorio', async ({ page }) => {
  const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'test-results';
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-navegacion-dummy'));
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  const permisos = [
    'periodos:leer', 'periodos:gestionar', 'alumnos:leer', 'alumnos:gestionar',
    'banco:leer', 'plantillas:leer', 'entregas:gestionar', 'omr:analizar',
    'calificaciones:calificar', 'evaluaciones:leer', 'rehidratacion:usar',
    'classroom:conectar', 'sincronizacion:listar', 'cuenta:leer'
  ];
  await page.route('**/api/autenticacion/perfil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docente: {
        _id: 'docente-navegacion-dummy',
        nombre: 'Docente de Prueba',
        correo: 'docente@example.invalid',
        permisos,
        roles: ['docente']
      } })
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: 'Secciones del portal docente' });
  await expect(nav).toBeVisible({ timeout: 15_000 });
  const sections = [
    { id: 'periodos', label: 'Materias' },
    { id: 'alumnos', label: 'Alumnos' },
    { id: 'asistencias', label: 'Asistencias' },
    { id: 'temarios', label: 'Temarios' },
    { id: 'banco', label: 'Banco' },
    { id: 'plantillas', label: 'Diseño de Exámenes' },
    { id: 'entrega', label: 'Entrega' },
    { id: 'calificaciones', label: 'Calificaciones' },
    { id: 'evaluaciones', label: 'Evaluaciones' },
    { id: 'rehidratacion', label: 'Rehidratación' },
    { id: 'classroom', label: 'Classroom' },
    { id: 'publicar', label: 'Sincronización' },
    { id: 'cuenta', label: 'Cuenta' }
  ];
  const mobilePicker = nav.getByRole('combobox', { name: 'Ir a sección' });
  await expect(mobilePicker.locator('option')).toHaveCount(sections.length);
  await expect(mobilePicker.locator('option').nth(9)).toHaveText('Rehidratación');
  await assertNoHorizontalOverflow(page, 'Navegación docente móvil 320 px');
  await setVisibleTheme(page, 'light');
  await page.screenshot({ path: `${evidenceDir}/nav-movil-01-materias-320-light.png`, fullPage: true, animations: 'disabled' });

  for (const [index, section] of sections.entries()) {
    await mobilePicker.press(index === 0 ? 'Home' : 'ArrowDown');
    await expect(mobilePicker, `Selector móvil: ${section.label}`).toHaveValue(section.id);
    const activeTab = nav.locator('button.tab[aria-current="page"]');
    await expect(activeTab, `Vista móvil sincronizada: ${section.label}`).toHaveText(section.label);
    if (index === 7 || index === 12) {
      const theme = index === 7 ? 'dark' : 'light';
      await setVisibleTheme(page, theme);
      await assertNoHorizontalOverflow(page, `Navegación docente móvil ${section.label} 320 px / ${theme}`);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${evidenceDir}/nav-movil-${String(index + 1).padStart(2, '0')}-${section.id}-320-${theme}.png`,
        fullPage: true,
        animations: 'disabled'
      });
    }
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(mobilePicker).toBeHidden();
  const desktopTabs = nav.locator('button.tab');
  await expect(desktopTabs).toHaveCount(sections.length);
  await desktopTabs.first().focus();
  await page.keyboard.press('Home');
  await expect(nav.locator('button.tab[aria-current="page"]')).toHaveText('Materias');
  await expect(desktopTabs.first()).toBeFocused();
  for (const [index, section] of sections.entries()) {
    if (index > 0) await page.keyboard.press('ArrowRight');
    const activeTab = nav.locator('button.tab[aria-current="page"]');
    await expect(activeTab, `Vista escritorio sincronizada: ${section.label}`).toHaveText(section.label);
    await expect(desktopTabs.nth(index), `Foco teclado en ${section.label}`).toBeFocused();
    if (index === 12) {
      for (const theme of ['light', 'dark'] as const) {
        await setVisibleTheme(page, theme);
        await assertNoHorizontalOverflow(page, `Navegación docente escritorio 1024 px / ${theme}`);
        const headerLayout = await page.locator('.cuenta-seguridad, .cuenta-pdf, .cuenta-actualizaciones').evaluateAll((cards) => cards.map((card) => {
          const bounds = card.getBoundingClientRect();
          const title = card.querySelector<HTMLElement>('.banco-section-title__wrap')?.getBoundingClientRect();
          const meta = card.querySelector<HTMLElement>('.banco-section-side-meta')?.getBoundingClientRect();
          const badges = [...card.querySelectorAll<HTMLElement>('.banco-section-side-meta .banco-counter-tag')].map((badge) => {
            const rect = badge.getBoundingClientRect();
            return { right: rect.right, bottom: rect.bottom };
          });
          const titleMetaOverlap = Boolean(title && meta && title.right > meta.left + 1 && title.bottom > meta.top + 1 && title.top < meta.bottom - 1);
          return {
            panelRight: bounds.right,
            metaRight: meta?.right ?? bounds.right,
            titleMetaOverlap,
            badgesOutsidePanel: badges.some((badge) => badge.right > bounds.right + 1 || badge.bottom > bounds.bottom + 1)
          };
        }));
        expect(headerLayout, `Etiquetas de Cuenta dentro de los paneles en tema ${theme}`).toHaveLength(3);
        expect(headerLayout, `Encabezados de Cuenta sin recorte ni solapamiento en tema ${theme}`).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ titleMetaOverlap: false, badgesOutsidePanel: false })
          ])
        );
        for (const layout of headerLayout) {
          expect(layout.metaRight, `Meta dentro del panel en tema ${theme}`).toBeLessThanOrEqual(layout.panelRight + 1);
          expect(layout.titleMetaOverlap, `Título separado de sus estados en tema ${theme}`).toBe(false);
          expect(layout.badgesOutsidePanel, `Estados dentro del panel en tema ${theme}`).toBe(false);
        }
      }
      const hiddenLogoInputs = await page.locator('.cuenta-file-picker > input[type="file"]').evaluateAll((inputs) => inputs.map((input) => {
        const rect = input.getBoundingClientRect();
        return { width: rect.width, height: rect.height, label: input.getAttribute('aria-labelledby') };
      }));
      expect(hiddenLogoInputs, 'Los dos selectores de logotipo conservan su etiqueta').toHaveLength(2);
      for (const input of hiddenLogoInputs) {
        expect(input.width, 'El selector de archivo oculto no cubre campos vecinos').toBeLessThanOrEqual(1);
        expect(input.height, 'El selector de archivo oculto no cubre campos vecinos').toBeLessThanOrEqual(1);
      }
      await page.screenshot({
        path: `${evidenceDir}/nav-escritorio-13-cuenta-1024-dark.png`,
        fullPage: true,
        animations: 'disabled'
      });
    }
  }
  await desktopTabs.last().focus();
  await page.keyboard.press('Home');
  await expect(desktopTabs.first()).toBeFocused();
  await expect(nav.locator('button.tab[aria-current="page"]')).toHaveText('Materias');
  await desktopTabs.first().focus();
  await page.keyboard.press('End');
  await expect(desktopTabs.last()).toBeFocused();
  await expect(nav.locator('button.tab[aria-current="page"]')).toHaveText('Cuenta');
});

async function assertPanelTextFitsViewport(page: import('@playwright/test').Page, panel: import('@playwright/test').Locator, context: string) {
  const clipped = await panel.evaluate((root) => {
    const viewportRight = document.documentElement.clientWidth;
    const panelRight = root.getBoundingClientRect().right;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const failures: Array<{ text: string; right: number; viewportRight: number }> = [];
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.trim();
      const parent = node.parentElement;
      if (text && parent) {
        const style = getComputedStyle(parent);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width > 0 && rect.height > 0 && rect.right > viewportRight + 1) {
              failures.push({ text: text.slice(0, 80), right: rect.right, viewportRight });
              break;
            }
          }
        }
      }
      node = walker.nextNode();
    }
    return { panelRight, viewportRight, failures };
  });
  expect(clipped.panelRight, `${context}: el panel excede el viewport`).toBeLessThanOrEqual(clipped.viewportRight + 1);
  expect(clipped.failures, `${context}: texto fuera del viewport; ${JSON.stringify(clipped.failures.slice(0, 8))}`).toEqual([]);
}

async function assertHeaderControlsFit(page: import('@playwright/test').Page, context: string) {
  const clipped = await page.locator('.shell-docente__header').evaluate((header) => {
    const bounds = header.getBoundingClientRect();
    const actions = header.querySelector<HTMLElement>('.shell-docente__acciones');
    const layout = [header, header.querySelector<HTMLElement>('.shell-docente__intro'), actions, ...(actions ? [...actions.querySelectorAll<HTMLElement>('button, .shell-docente__controles')] : [])]
      .filter((element): element is HTMLElement => element !== null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { selector: element.className, display: style.display, flexWrap: style.flexWrap, gridTemplateColumns: style.gridTemplateColumns, left: rect.left, right: rect.right, width: rect.width };
      });
    const clippedButtons = [...header.querySelectorAll<HTMLElement>('.shell-docente__acciones button')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0
          && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
      })
      .map((element) => ({
        label: element.innerText.trim() || element.getAttribute('aria-label') || element.title,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        headerLeft: bounds.left,
        headerRight: bounds.right
      }));
    return { layout, clippedButtons };
  });
  expect(clipped.clippedButtons, `${context}: controles de sesión cortados por los límites del encabezado; layout=${JSON.stringify(clipped.layout)}`).toEqual([]);
}

async function assertVisibleHeadersFit(page: import('@playwright/test').Page, context: string) {
  const clipped = await page.evaluate(() => {
    const selectors = 'h1, h2, h3, h4, .banco-status-pill, .guia-materia-badge > span:last-child, .guia-materia-close-btn';
    const candidates = [...document.querySelectorAll<HTMLElement>(selectors)]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({
        label: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        rect: element.getBoundingClientRect().toJSON()
      }))
      .filter((element) => element.scrollWidth > element.clientWidth + 1
        || element.rect.left < -1
        || element.rect.right > window.innerWidth + 1);
    return {
      viewport: {
        innerWidth: window.innerWidth,
        documentWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        visualWidth: window.visualViewport?.width ?? null,
        scrollX: window.scrollX
      },
      clipped: candidates
    };
  });
  expect(clipped.clipped, `${context}: encabezados o estados visibles recortados; viewport=${JSON.stringify(clipped.viewport)}`).toEqual([]);
}

async function inspectCalificacionesHeader(page: import('@playwright/test').Page) {
  return page.locator('.calif-panel__head').evaluate((head) => {
    const meta = head.querySelector<HTMLElement>('.banco-panel__meta-row');
    const metaRect = meta?.getBoundingClientRect();
    const items = [...(meta?.children ?? [])].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: (element.textContent ?? '').trim(),
        left: rect.left,
        right: rect.right,
        scrollWidth: (element as HTMLElement).scrollWidth,
        clientWidth: (element as HTMLElement).clientWidth
      };
    });
    return {
      viewportWidth: window.innerWidth,
      metaClientWidth: meta?.clientWidth ?? 0,
      metaScrollWidth: meta?.scrollWidth ?? 0,
      metaRight: metaRect?.right ?? 0,
      iconCount: head.querySelectorAll('svg[data-icono="calificar"]').length,
      navigationIconCount: head.ownerDocument.querySelectorAll('.tab.activa[data-icono-tab="calificar"] svg[data-icono="calificar"]').length,
      iconSizes: [...head.ownerDocument.querySelectorAll<SVGElement>('.calificaciones-experience svg.icono')]
        .map((icon) => Number(icon.getAttribute('width'))),
      icons: [...head.querySelectorAll<SVGElement>('svg[data-icono="calificar"]')].map((icon) => {
        const shape = icon.querySelector('path, circle, rect, line, polyline, polygon');
        const rect = icon.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          strokeWidth: shape ? getComputedStyle(shape).strokeWidth : 'none'
        };
      }),
      iconStrokeWidths: [...head.ownerDocument.querySelectorAll<SVGElement>('.calificaciones-experience svg.icono')]
        .flatMap((icon) => [...icon.querySelectorAll<SVGElement>('path, circle, ellipse, line, polyline, polygon, rect')])
        .filter((shape) => getComputedStyle(shape).stroke !== 'none')
        .map((shape) => getComputedStyle(shape).strokeWidth),
      items
    };
  });
}

async function assertHeaderBlocksDoNotOverlap(page: import('@playwright/test').Page, context: string) {
  const overlaps = await page.locator('.banco-panel__head').evaluate((head) => {
    const selectors = ['.banco-panel__lead', '.banco-header-kpis'];
    const boxes = selectors.map((selector) => {
      const element = head.querySelector(selector);
      if (!element) return { selector, missing: true, x: 0, y: 0, right: 0, bottom: 0 };
      const rect = element.getBoundingClientRect();
      return { selector, missing: false, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    });
    const [lead, kpis] = boxes;
    const overlaps = !lead.missing && !kpis.missing
      && lead.x < kpis.right && lead.right > kpis.x
      && lead.y < kpis.bottom && lead.bottom > kpis.y;
    const textSelectors = ['.banco-panel__meta-row', '.banco-panel__title', '.banco-panel__text-block > .nota'];
    const textBoxes = textSelectors.map((selector) => {
      const element = head.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true, x: 0, y: 0, right: 0, bottom: 0, scrollWidth: 0, clientWidth: 0, scrollHeight: 0, clientHeight: 0 };
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      };
    });
    const textOverlaps = [];
    for (let index = 0; index < textBoxes.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < textBoxes.length; otherIndex += 1) {
        const first = textBoxes[index];
        const second = textBoxes[otherIndex];
        if (first.missing || second.missing) continue;
        const width = Math.min(first.right, second.right) - Math.max(first.x, second.x);
        const height = Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y);
        if (width > 1 && height > 1) textOverlaps.push(`${first.selector} <> ${second.selector} (${Math.round(width)}×${Math.round(height)} px)`);
      }
    }
    return { boxes, overlaps, textBoxes, textOverlaps };
  });
  expect(overlaps.boxes.every((box) => !box.missing), `${context}: falta un bloque del encabezado`).toBe(true);
  expect(overlaps.overlaps, `${context}: el resumen y el encabezado se superponen`).toBe(false);
  expect(overlaps.textBoxes.every((box) => !box.missing), `${context}: falta texto del encabezado`).toBe(true);
  expect(overlaps.textOverlaps, `${context}: texto del encabezado o resumen académico superpuesto; cajas=${JSON.stringify(overlaps.textBoxes)}`).toEqual([]);
  for (const box of overlaps.textBoxes) {
    expect(box.scrollWidth, `${context}: ${box.selector} desborda horizontalmente`).toBeLessThanOrEqual(box.clientWidth + 1);
    expect(box.scrollHeight, `${context}: ${box.selector} desborda verticalmente`).toBeLessThanOrEqual(box.clientHeight + 1);
  }
}

async function assertEntregaKpisUseBalancedMobileGrid(page: import('@playwright/test').Page, context: string) {
  const boxes = await page.locator('.entrega-header-kpis > .banco-mini-kpi').evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })
  );
  expect(boxes, `${context}: deben mostrarse los cuatro indicadores de entrega`).toHaveLength(4);
  expect(Math.abs(boxes[0].y - boxes[1].y), `${context}: la primera fila debe contener dos KPI`).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes[2].y - boxes[3].y), `${context}: la segunda fila debe contener dos KPI`).toBeLessThanOrEqual(1);
  expect(boxes[2].y, `${context}: la segunda fila debe quedar debajo de la primera`).toBeGreaterThan(boxes[0].y);
  expect(Math.abs(boxes[0].x - boxes[2].x), `${context}: la primera columna debe quedar alineada`).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes[1].x - boxes[3].x), `${context}: la segunda columna debe quedar alineada`).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes[0].width - boxes[1].width), `${context}: las columnas deben tener el mismo ancho`).toBeLessThanOrEqual(1);
}

async function assertKpiLightContrast(page: import('@playwright/test').Page, selector: string, count: number, context: string) {
  const ratios = await page.locator(selector).evaluate((group) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance('rgb(238, 244, 250)');
    return [...group.querySelectorAll('.banco-mini-kpi__num, .banco-mini-kpi__icon')].map((element) => {
      const foreground = luminance(getComputedStyle(element).color);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
  });
  expect(ratios, `${context}: deben verificarse los ${count} valores y sus iconos`).toHaveLength(count * 2);
  for (const ratio of ratios) {
    expect(ratio, `${context}: contraste inferior a 4.5:1`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertCalificacionesKpiContrast(page: import('@playwright/test').Page, context: string) {
  const ratios = await page.locator('.calificaciones-experience .banco-mini-kpi').evaluateAll((cards) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance('rgb(226, 232, 240)');
    return cards.flatMap((card) => [...card.querySelectorAll('.banco-mini-kpi__num, .banco-mini-kpi__icon')].map((element) => {
      const color = getComputedStyle(element).color;
      const foreground = luminance(color);
      return {
        label: (element as HTMLElement).innerText.trim() || 'ícono KPI',
        color,
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      };
    }));
  });
  expect(ratios.length, `${context}: se deben auditar cifras e iconos de los cinco KPI`).toBeGreaterThanOrEqual(10);
  for (const item of ratios) {
    expect(item.contrast, `${context}: contraste insuficiente en ${item.label} (${item.color})`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertHeaderPartsAreNotCardSurfaces(page: import('@playwright/test').Page, context: string) {
  const themes = await page.locator('.banco-panel__head').evaluate((head) => {
    const selectors = ['.banco-panel__lead', '.banco-panel__text-block', '.banco-panel__meta-row', '.banco-panel__title'];
    const root = head.ownerDocument.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    const snapshots = ['light', 'dark'].map((theme) => {
      if (theme === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      const parts = selectors.map((selector) => {
        const element = head.querySelector<HTMLElement>(selector);
        if (!element) return {
          selector,
          missing: true,
          borderWidth: 'unknown',
          borderRadius: 'unknown',
          backgroundImage: 'unknown',
          boxShadow: 'unknown',
          overflow: 'unknown'
        };
        const style = getComputedStyle(element);
        return {
          selector,
          missing: false,
          borderWidth: style.borderWidth,
          borderRadius: style.borderRadius,
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          overflow: style.overflow
        };
      });
      return { theme, parts };
    });
    if (previousTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', previousTheme);
    return snapshots;
  });

  for (const { theme, parts } of themes) {
    expect(parts.every((part) => !part.missing), `${context} (${theme}): falta una parte estructural del encabezado`).toBe(true);
    for (const part of parts) {
      const description = `${context} (${theme}): ${part.selector} se interpretó como tarjeta; ${JSON.stringify(part)}`;
      expect(part.borderWidth, description).toBe('0px');
      expect(part.borderRadius, description).toBe('0px');
      expect(part.backgroundImage, description).toBe('none');
      expect(part.boxShadow, description).toBe('none');
      expect(part.overflow, `${context} (${theme}): ${part.selector} recorta contenido; ${JSON.stringify(part)}`).toBe('visible');
    }
  }
}

async function assertPlantillasFormatoContrast(page: import('@playwright/test').Page) {
  const result = await page.locator('.plantillas-formato-box').evaluate((panel) => {
    const parse = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const luminance = (color: string) => {
      const channels = parse(color).map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const surface = [luminance('rgb(30, 41, 59)'), luminance('rgb(15, 23, 42)')];
    const elements = [...panel.querySelectorAll('.plantillas-temas__title, .plantillas-formato-box__eyebrow, .nota, .campo__label-row, .campo__label-row b, .ayuda, .plantillas-auto-status, .plantillas-formato-box__footer, .plantillas-formato-box__badge, .plantillas-formato-box__omr')]
      .filter((element) => (element as HTMLElement).innerText?.trim());
    return {
      backgroundImage: getComputedStyle(panel).backgroundImage,
      lightTheme: !document.documentElement.matches('[data-theme="dark"]'),
      text: elements.map((element) => {
        const color = getComputedStyle(element).color;
        const foreground = luminance(color);
        const minimumContrast = Math.min(...surface.map((background) => (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)));
        return { label: (element as HTMLElement).innerText.trim().slice(0, 60), color, contrast: minimumContrast };
      })
    };
  });
  expect(result.lightTheme, 'la regresión debe comprobarse con tema claro activo').toBe(true);
  expect(result.backgroundImage, 'el panel mantiene la superficie oscura declarada').toContain('rgb(30, 41, 59)');
  expect(result.text.length, 'el panel debe mostrar textos para revisar').toBeGreaterThan(5);
  for (const item of result.text) {
    expect(item.contrast, `contraste insuficiente en "${item.label}" (${item.color})`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertPlantillasCatalogBadgeContrast(page: import('@playwright/test').Page) {
  const items = await page.locator('.plantillas-item .badge-meta, .plantillas-item .badge-densidad, .plantillas-item .badge-tema-chip').evaluateAll((badges) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    return badges.map((badge) => {
      const style = getComputedStyle(badge);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return {
        label: (badge as HTMLElement).innerText.trim().slice(0, 48),
        color: style.color,
        background: style.backgroundColor,
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      };
    });
  });
  expect(items.length, 'el catálogo debe mostrar metadatos y etiquetas sintéticos').toBeGreaterThanOrEqual(5);
  for (const item of items) {
    expect(item.contrast, `contraste insuficiente en etiqueta "${item.label}" (${item.color} sobre ${item.background})`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertPlantillasFormatBadgesFit(page: import('@playwright/test').Page, context: string) {
  const badges = await page.locator('.plantillas-formato-box').evaluate((panel) => {
    const panelBounds = panel.getBoundingClientRect();
    return [...panel.querySelectorAll<HTMLElement>('.plantillas-formato-box__badge, .plantillas-formato-box__omr')].map((badge) => {
      const bounds = badge.getBoundingClientRect();
      return {
        text: badge.innerText.trim(),
        left: bounds.left,
        right: bounds.right,
        panelLeft: panelBounds.left,
        panelRight: panelBounds.right,
        clientWidth: badge.clientWidth,
        scrollWidth: badge.scrollWidth
      };
    });
  });
  expect(badges.length, `${context}: deben mostrarse etiquetas de formato`).toBeGreaterThan(0);
  for (const badge of badges) {
    expect(badge.left, `${context}: etiqueta desplazada fuera del panel: ${badge.text}`).toBeGreaterThanOrEqual(badge.panelLeft - 1);
    expect(badge.right, `${context}: etiqueta fuera del panel: ${badge.text}`).toBeLessThanOrEqual(badge.panelRight + 1);
    expect(badge.scrollWidth, `${context}: etiqueta truncada: ${badge.text}`).toBeLessThanOrEqual(badge.clientWidth + 1);
  }
}

async function assertPlantillasStudioContrast(page: import('@playwright/test').Page) {
  const contrast = await page.locator('.plantillas-studio-intro').evaluate((panel) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance('rgb(15, 23, 42)');
    const elements = [
      ...panel.querySelectorAll('h3, p'),
      ...panel.querySelectorAll('.plantillas-studio-steps li > b')
    ].filter((element) => (element as HTMLElement).innerText.trim());
    return elements.map((element) => {
      const color = getComputedStyle(element).color;
      const foreground = luminance(color);
      return {
        label: (element as HTMLElement).innerText.trim().slice(0, 48),
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      };
    });
  });
  expect(contrast.length, 'el bloque de construcción debe contener texto y pasos visibles').toBeGreaterThan(3);
  for (const item of contrast) {
    expect(item.contrast, `contraste insuficiente en el bloque de construcción: "${item.label}"`).toBeGreaterThanOrEqual(4.5);
  }
}

async function assertPlantillasSummaryContrast(page: import('@playwright/test').Page) {
  const ratios = await page.locator('.plantillas-header-right').evaluate((header) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.slice(0, 3).map((value) => Number(value) / 255) ?? [];
      const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance('rgb(255, 255, 255)');
    return [...header.querySelectorAll('.banco-mini-kpi__num, .banco-mini-kpi__lbl')].map((element) => {
      const foreground = luminance(getComputedStyle(element).color);
      return {
        label: (element as HTMLElement).innerText.trim(),
        contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      };
    });
  });
  expect(ratios.length, 'el resumen de plantillas debe mostrar cifras y etiquetas').toBeGreaterThan(4);
  for (const item of ratios) {
    expect(item.contrast, `contraste insuficiente en resumen "${item.label}"`).toBeGreaterThanOrEqual(4.5);
  }
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
      const hiddenFromUsers = element.closest('[aria-hidden="true"], [inert]') !== null;
      return !hiddenFromUsers && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && style.pointerEvents !== 'none' && rect.width > 0 && rect.height > 0;
    }

    const controls = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    const unnamed = controls
      .filter((control) => nameFor(control).length === 0)
      .map((control) => control.outerHTML.slice(0, 160));

    const boxes = controls.map((control) => {
      const rect = (control as HTMLElement).getBoundingClientRect();
      return {
        element: control,
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
        const passwordRevealOverlay =
          (a.element.matches('.auth-pwd-toggle') && b.element.matches('.auth-input-box--key input') && a.element.parentElement === b.element.parentElement) ||
          (b.element.matches('.auth-pwd-toggle') && a.element.matches('.auth-input-box--key input') && a.element.parentElement === b.element.parentElement) ||
          (a.element.matches('.cuenta-seguridad__password-toggle') && b.element.matches('.cuenta-seguridad__password-control input') && a.element.parentElement === b.element.parentElement) ||
          (b.element.matches('.cuenta-seguridad__password-toggle') && a.element.matches('.cuenta-seguridad__password-control input') && a.element.parentElement === b.element.parentElement);
        if (passwordRevealOverlay) continue;
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

      if (url.includes('/api/salud/ip-local')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ips: ['192.168.1.50'], preferida: '192.168.1.50' })
        });
        return;
      }

      if (url.includes('/api/salud/qr')) {
        const texto = new URL(url).searchParams.get('texto') ?? '';
        const imagenQr = await QRCode.toBuffer(texto, {
          margin: 1,
          width: 360,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        await route.fulfill({ status: 200, contentType: 'image/png', body: imagenQr });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
  });

  test('audita Cuenta con perfil ficticio a 320/360/390/640 px y navegación de escritorio', async ({ page }) => {
    const solicitudesConfigurarCarpeta: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/sincronizaciones/local/configuracion/carpeta')) {
        solicitudesConfigurarCarpeta.push(request.method());
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem('tokenDocente', 'token-cuenta-dummy');
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/analiticas/eventos-uso')) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return fetchOriginal(input, init);
      };
    });
    let contraseñaLocalDefinida = false;
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          docente: {
            id: 'docente-cuenta-dummy',
            nombreCompleto: 'Docente de Prueba',
            correo: 'docente-demo@evaluapro.local',
            permisos: ['cuenta:leer', 'sincronizacion:listar'],
            roles: ['docente'],
            tieneGoogle: false,
            tieneContrasena: contraseñaLocalDefinida
          }
        })
      });
    });

    for (const width of [320, 360, 390, 640]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });
      await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Cuenta' });
      await expect(page.getByRole('heading', { name: 'Cuenta', exact: true })).toBeVisible();
      const navegacionCuenta = page.getByRole('navigation', { name: 'Secciones de Cuenta' });
      await expect(navegacionCuenta.getByRole('link', { name: 'Accesos del escritorio' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Accesos del escritorio', exact: true })).toBeVisible();
      await expect(page.getByText('docente-demo@evaluapro.local')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Seguridad de acceso' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Falta un método para confirmar el cambio: contraseña local o Google vinculado. Pide a quien administra EvaluaPro que revise tu acceso.' })).toBeVisible();
      await expect(page.getByRole('form', { name: 'Cambiar contraseña' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'PDF institucional' })).toBeVisible();
      await expect(page.locator('.cuenta-sincronizacion .estado-chip')).not.toHaveText('Consultando');

      const kpiColumns = await page.locator('.cuenta-panel .banco-header-kpis').evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
      );
      if (width <= 340) {
        expect(kpiColumns, `Columnas del resumen a ${width}px`).toBe(2);
      } else if (width <= 390) {
        expect(kpiColumns, `Columnas del resumen a ${width}px`).toBe(2);
      }
      const ultimoKpi = await page.locator('.cuenta-panel .banco-mini-kpi').last().evaluate((element) =>
        getComputedStyle(element).gridColumn
      );
      if (width <= 340) {
        expect(ultimoKpi, `El último indicador ocupa el ancho del resumen a ${width}px`).toBe('1 / -1');
      } else if (width <= 720) {
        expect(ultimoKpi, `El último indicador ocupa el ancho en ${width}px`).toBe('1 / -1');
      }
      if (width <= 340) {
        const textoIndicadoresCabe = await page.locator('.cuenta-panel .banco-mini-kpi').evaluateAll((elementos) =>
          elementos.every((elemento) => {
            const tarjeta = elemento.getBoundingClientRect();
            return [...elemento.querySelectorAll<HTMLElement>('.banco-mini-kpi__num, .banco-mini-kpi__lbl')]
              .every((texto) => {
                const caja = texto.getBoundingClientRect();
                const rango = document.createRange();
                rango.selectNodeContents(texto);
                const lineas = rango.getClientRects().length;
                const lineasMaximas = (texto.textContent?.trim().match(/\s+/g)?.length ?? 0) + 1;
                return caja.left >= tarjeta.left && caja.right <= tarjeta.right
                  && texto.scrollWidth <= texto.clientWidth + 1
                  && lineas <= lineasMaximas;
              });
          })
        );
        expect(textoIndicadoresCabe, `Valores y etiquetas del resumen caben en sus tarjetas a ${width}px`).toBe(true);
        const altoResumen = await page.locator('.cuenta-panel .banco-header-kpis').evaluate((elemento) =>
          elemento.getBoundingClientRect().height
        );
        expect(altoResumen, `El resumen compacto queda en tres filas como máximo a ${width}px`).toBeLessThanOrEqual(270);
      }
      if (width === 320) {
        const retencion = await page.getByLabel('Tiempo de conservación de los PDF de parciales archivados').evaluate((element) => {
          const select = element as HTMLSelectElement;
          const style = getComputedStyle(select);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          context.font = style.font;
          const texto = select.selectedOptions[0]?.textContent?.trim() ?? '';
          return {
            texto,
            textoWidth: context.measureText(texto).width,
            usableWidth: select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          };
        });
        expect(retencion.texto).toBe('Conservar siempre');
        expect(retencion.textoWidth, 'La opción de retención debe verse completa a 320 px').toBeLessThanOrEqual(retencion.usableWidth);

        const carpetaSincronizada = await page.getByLabel('Carpeta local sincronizada por OneDrive').evaluate((element) => {
          const input = element as HTMLInputElement;
          const style = getComputedStyle(input);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          context.font = style.font;
          return {
            placeholder: input.placeholder,
            textWidth: context.measureText(input.placeholder).width,
            usableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          };
        });
        expect(carpetaSincronizada.placeholder).toBe('Ruta local de OneDrive');
        expect(carpetaSincronizada.textWidth, 'El placeholder de carpeta debe verse completo a 320 px').toBeLessThanOrEqual(carpetaSincronizada.usableWidth);
      }

      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        if (width === 320) await page.waitForTimeout(300);
        if (theme === 'light') {
          await assertTextContrast(page.locator('.cuenta-panel .banco-section-pill:visible'), `Etiquetas de Cuenta ${width}px`);
        }
        await assertNoHorizontalOverflow(page, `Cuenta ficticia ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Cuenta ficticia ${width}px / ${theme}`);
        if (width === 320) {
          const alternarGuiaCuenta = page.getByRole('button', { name: 'Ver guía rápida de cuenta y seguridad' });
          await alternarGuiaCuenta.hover();
          await expect(page.getByRole('tooltip'), 'El texto visible del botón evita un tooltip redundante que tape la tarjeta siguiente').toHaveCount(0);
          await page.mouse.move(0, 0);
        }
        if (width === 320) {
          const campoCarpeta = page.getByLabel('Carpeta local sincronizada por OneDrive');
          await campoCarpeta.fill('');
          await page.getByRole('button', { name: 'Guardar carpeta' }).click();
          const errorCarpeta = page.getByRole('alert').filter({ hasText: 'Escribe o elige una carpeta local sincronizada por OneDrive.' });
          await expect(errorCarpeta).toBeVisible();
          await expect(campoCarpeta).toHaveAttribute('aria-invalid', 'true');
          await expect(campoCarpeta).toHaveAttribute('aria-describedby', /sincronizacion-carpeta-error/);
          expect(solicitudesConfigurarCarpeta, 'Una ruta vacía no debe enviar cambios de configuración').toEqual([]);
          await page.locator('.cuenta-sincronizacion').screenshot({
            path: supplementalEvidencePath(`ux-audit-cuenta-ruta-vacia-320-${theme}.png`),
            animations: 'disabled'
          });
          await campoCarpeta.fill('C:\\OneDrive\\EvaluaPro');
          await expect(errorCarpeta).toHaveCount(0);
          await expect(campoCarpeta).not.toHaveAttribute('aria-invalid', 'true');
          await expect(page.locator('.cuenta-sincronizacion .estado-chip')).toHaveRole('status');
          await expect(page.locator('.cuenta-sincronizacion .estado-chip')).toHaveText('Ruta sin guardar');
          const guardarCarpeta = page.getByRole('button', { name: 'Guardar carpeta' });
          await assertSolidButtonTextContrast(guardarCarpeta, `Guardar carpeta con contraste WCAG ${theme}`);
          await guardarCarpeta.hover();
          await assertSolidButtonTextContrast(guardarCarpeta, `Hover de Guardar carpeta con contraste WCAG ${theme}`);
          await page.mouse.move(0, 0);
          await page.locator('.cuenta-sincronizacion').screenshot({
            path: supplementalEvidencePath(`ux-audit-cuenta-ruta-sin-guardar-320-${theme}.png`),
            animations: 'disabled'
          });

          const ultimoAcceso = page.getByRole('navigation', { name: 'Secciones de Cuenta' }).locator('a').last();
          const selectorFoto = page.locator('.cuenta-foto-perfil__cargar input[type="file"]');
          const botonFoto = page.locator('.cuenta-foto-perfil__cargar');
          await ultimoAcceso.focus();
          await page.keyboard.press('Tab');
          await expect(selectorFoto, 'Tab debe llevar desde los accesos directos hasta la foto de perfil').toBeFocused();
          await expect(botonFoto).toHaveCSS('outline-style', 'solid');
          await expect(botonFoto).toHaveCSS('outline-width', '3px');
          await page.locator('.cuenta-foto-perfil').screenshot({
            path: supplementalEvidencePath(`ux-audit-cuenta-perfil-foco-320-${theme}.png`),
            animations: 'disabled'
          });
          await page.keyboard.press('Tab');
          await expect(selectorFoto, 'La selección de foto no debe atrapar el foco').not.toBeFocused();
        }
        const textosNavegacionFueraDelControl = await page
          .getByRole('navigation', { name: 'Secciones de Cuenta' })
          .locator('a')
          .evaluateAll((enlaces) => enlaces.flatMap((enlace) => {
            const caja = enlace.getBoundingClientRect();
            const rango = document.createRange();
            rango.selectNodeContents(enlace);
            const textoFuera = Array.from(rango.getClientRects()).some((linea) =>
              linea.left < caja.left || linea.right > caja.right || linea.top < caja.top || linea.bottom > caja.bottom
            );
            return textoFuera ? [enlace.textContent?.trim() ?? 'sin texto'] : [];
          }));
        expect(textosNavegacionFueraDelControl, `Texto de accesos directos dentro de sus controles a ${width}px / ${theme}`).toEqual([]);
        if (width <= 720) {
          await expect(
            page.getByRole('navigation', { name: 'Secciones de Cuenta' }).locator('a').last()
          ).toHaveCSS('grid-column', '1 / -1');
        }
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-cuenta-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
        if (width === 320) {
          await page.locator('.cuenta-panel .banco-header-kpis').screenshot({
            path: supplementalEvidencePath(`ux-audit-cuenta-resumen-320-${theme}.png`),
            animations: 'disabled'
          });
          for (const [panel, nombre] of [
            ['.cuenta-foto-perfil', 'perfil'],
            ['.cuenta-seguridad', 'seguridad'],
            ['.cuenta-pdf', 'pdf-institucional']
          ]) {
            await page.locator(panel).screenshot({
              path: supplementalEvidencePath(`ux-audit-cuenta-${nombre}-320-${theme}-panel.png`),
              animations: 'disabled'
            });
          }
        }
      }
    }

    await page.setViewportSize({ width: 320, height: 844 });
    const guiaCuenta = page.getByRole('button', { name: 'Ver guía rápida de cuenta y seguridad' });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await guiaCuenta.click();
      const panelGuia = page.getByRole('region', { name: 'Ayuda: Cuenta docente' });
      await expect(panelGuia).toBeVisible();
      await expect(panelGuia.getByRole('heading', { name: 'Cuenta y foto de perfil' })).toBeVisible();
      await expect(panelGuia.getByRole('heading', { name: 'PDF institucional' })).toBeVisible();
      await expect(panelGuia.getByRole('heading', { name: 'Sincronización y seguridad' })).toBeVisible();
      await expect(panelGuia).not.toContainText(/licenciamiento|Plan Pro Multisede|Firma RSA|vigencia offline|soporte multisede/i);
      await assertNoHorizontalOverflow(page, `Guía Cuenta ficticia 320px / ${theme}`);
      await assertPanelTextFitsViewport(page, panelGuia, `Guía Cuenta ficticia 320px / ${theme}`);
      await panelGuia.screenshot({
        path: supplementalEvidencePath(`ux-audit-cuenta-guia-320-${theme}.png`),
        animations: 'disabled'
      });
      await page.getByRole('button', { name: 'Ocultar guía rápida' }).click();
      await expect(panelGuia).toHaveCount(0);
    }

    await page.setViewportSize({ width: 1024, height: 844 });
    const navEscritorio = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navEscritorio.getByRole('button', { name: 'Cuenta', exact: true })).toHaveAttribute('aria-current', 'page');
    const columnasAccesosEscritorio = await page.locator('.cuenta-seccion-nav__links').evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(columnasAccesosEscritorio, 'Cuenta usa cuatro columnas para accesos directos en escritorio').toBe(4);
    await assertNoHorizontalOverflow(page, 'Cuenta ficticia en escritorio 1024px');
    await page.locator('.cuenta-seccion-nav').screenshot({
      path: supplementalEvidencePath('ux-audit-cuenta-navegacion-1024-light.png'),
      animations: 'disabled'
    });
    const textosNavegacionEscritorioFueraDelControl = await page
      .getByRole('navigation', { name: 'Secciones de Cuenta' })
      .locator('a')
      .evaluateAll((enlaces) => enlaces.flatMap((enlace) => {
        const caja = enlace.getBoundingClientRect();
        const rango = document.createRange();
        rango.selectNodeContents(enlace);
        const textoFuera = Array.from(rango.getClientRects()).some((linea) =>
          linea.left < caja.left || linea.right > caja.right || linea.top < caja.top || linea.bottom > caja.bottom
        );
        return textoFuera ? [enlace.textContent?.trim() ?? 'sin texto'] : [];
      }));
    expect(textosNavegacionEscritorioFueraDelControl).toEqual([]);

    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const navegacionCuenta = page.getByRole('navigation', { name: 'Secciones de Cuenta' });
    const enlaceActualizaciones = navegacionCuenta.getByRole('link', { name: 'Actualizaciones' });
    await expect(enlaceActualizaciones).toBeVisible();
    await enlaceActualizaciones.focus();
    await page.keyboard.press('Enter');
    const encabezadoActualizaciones = page.getByRole('heading', { name: 'Buscar actualizaciones de EvaluaPro' });
    await expect(encabezadoActualizaciones).toBeFocused();
    const cajaEncabezadoActualizaciones = await encabezadoActualizaciones.boundingBox();
    expect(cajaEncabezadoActualizaciones?.y).toBeGreaterThanOrEqual(0);
    expect(cajaEncabezadoActualizaciones?.y).toBeLessThan(844);
    const etiquetaSeccionActualizaciones = page.locator('.cuenta-panel .banco-section-pill').filter({ hasText: 'Mantenimiento y actualizaciones' });
    await expect(etiquetaSeccionActualizaciones).toBeVisible();
    const cajaEtiquetaActualizaciones = await etiquetaSeccionActualizaciones.boundingBox();
    expect(cajaEtiquetaActualizaciones?.y, 'La etiqueta completa del destino debe quedar dentro del viewport').toBeGreaterThanOrEqual(0);
    expect((cajaEtiquetaActualizaciones?.y ?? 0) + (cajaEtiquetaActualizaciones?.height ?? 0), 'La etiqueta completa del destino debe quedar dentro del viewport').toBeLessThanOrEqual(844);
    await page.screenshot({
      path: supplementalEvidencePath('ux-audit-cuenta-navegacion-destino-actualizaciones-320-light.png'),
      animations: 'disabled'
    });
    await page.evaluate(() => window.scrollTo(0, 0));

    const logoInput = page.getByLabel('Imagen institucional izquierda');
    await logoInput.setInputFiles({
      name: 'logotipo-dummy.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/TMcAAAAASUVORK5CYII=', 'base64')
    });
    await expect(page.getByText('Archivo: logotipo-dummy.png', { exact: true })).toBeVisible();
    await page.locator('.cuenta-pdf').screenshot({
      path: supplementalEvidencePath('ux-audit-cuenta-pdf-logo-seleccionado-320-light.png'),
      animations: 'disabled'
    });

    const solicitudesCambioContrasena: Array<Record<string, unknown>> = [];
    await page.route('**/api/autenticacion/definir-contrasena', async (route) => {
      solicitudesCambioContrasena.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    contraseñaLocalDefinida = true;
    await page.setViewportSize({ width: 640, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Cuenta' });
    await expect(page.getByLabel('Contraseña actual (obligatoria)')).toBeVisible();
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.locator('.cuenta-seguridad').screenshot({
      path: supplementalEvidencePath('ux-audit-cuenta-reauth-required-640-light.png'),
      animations: 'disabled'
    });
    const contrasenaNueva = page.getByRole('textbox', { name: /^Nueva contraseña/ });
    const confirmarContrasena = page.getByRole('textbox', { name: /^Confirmar contraseña/ });
    const guardarContrasena = page.getByRole('button', { name: 'Guardar contraseña' });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('textbox', { name: /^Contraseña actual/ }).fill('CuentaDummyActual2026');
    await contrasenaNueva.fill('corta');
    const errorLongitudContrasena = page.getByText('La contraseña nueva es demasiado corta. Agrega caracteres hasta cumplir el mínimo.', { exact: true });
    await expect(contrasenaNueva).toHaveAttribute('aria-invalid', 'true');
    await expect(errorLongitudContrasena).toBeVisible();
    await expect(contrasenaNueva).toHaveAccessibleDescription(/demasiado corta/);
    await expect(guardarContrasena).toBeDisabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const botonMostrarNueva = page.getByRole('button', { name: 'Mostrar nueva contraseña' });
    await expect(botonMostrarNueva).toHaveAttribute('aria-pressed', 'false');
    await expect(botonMostrarNueva.locator('[data-icono="ojo"]')).toBeVisible();
    await page.locator('.cuenta-seguridad').screenshot({
      path: supplementalEvidencePath('ux-cuenta-password-too-short-320-light.png'),
      animations: 'disabled'
    });
    await botonMostrarNueva.click();
    await expect(contrasenaNueva).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar nueva contraseña' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Ocultar nueva contraseña' }).locator('[data-icono="ojoCerrado"]')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(contrasenaNueva).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Mostrar nueva contraseña' })).toHaveAttribute('aria-pressed', 'false');
    await contrasenaNueva.fill('CuentaDemoSegura2026');
    await expect(contrasenaNueva).not.toHaveAttribute('aria-invalid', 'true');
    await expect(errorLongitudContrasena).toBeHidden();
    await confirmarContrasena.fill('CuentaDemoSegura2026');
    await confirmarContrasena.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Mostrar confirmación de contraseña' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(guardarContrasena).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => solicitudesCambioContrasena.length).toBe(1);
    expect(solicitudesCambioContrasena[0]).toEqual({
      contrasenaActual: 'CuentaDummyActual2026',
      contrasenaNueva: 'CuentaDemoSegura2026'
    });

  });

  test('audita Materias activas y archivadas con catálogo ficticio', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tokenDocente', 'token-materias-dummy');
      localStorage.setItem('ep.theme.preference', 'light');
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/analiticas/eventos-uso')) {
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return fetchOriginal(input, init);
      };
    });
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-materias-dummy',
          nombreCompleto: 'Docente de Prueba',
          correo: 'docente-demo@evaluapro.local',
          permisos: ['periodos:leer', 'periodos:gestionar', 'periodos:archivar', 'alumnos:leer', 'asistencias:leer'],
          roles: ['docente']
        } })
      });
    });
    const cambiosMateriasDummy: Array<{ method: string; url: string; body: unknown }> = [];
    await page.route('**/api/periodos**', async (route) => {
      if (route.request().method() !== 'GET') {
        cambiosMateriasDummy.push({
          method: route.request().method(),
          url: new URL(route.request().url()).pathname,
          body: route.request().postDataJSON()
        });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
        return;
      }
      const archivadas = new URL(route.request().url()).searchParams.get('activo') === '0';
      const periodo = archivadas ? {
        _id: 'periodo-archivado-dummy',
        nombre: 'Historia del Arte — 1B',
        fechaInicio: '2026-01-12',
        fechaFin: '2026-06-20',
        activo: false,
        createdAt: '2025-12-18T12:00:00.000Z',
        archivadoEn: '2026-06-21T12:00:00.000Z',
        resumenArchivado: { alumnos: 18, bancoPreguntas: 42, plantillas: 2, calificaciones: 18 }
      } : {
        _id: 'periodo-activo-dummy',
        nombre: 'Álgebra Lineal — 2A',
        fechaInicio: '2026-08-10',
        fechaFin: '2026-12-18',
        grupos: ['2A', '2B'],
        activo: true,
        createdAt: '2026-08-01T12:00:00.000Z'
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [periodo] }) });
    });
    await page.route('**/api/asistencias/sesiones**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sesiones: [] }) });
    });

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });
      await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Materias' });
      await expect(page.getByText('Álgebra Lineal — 2A', { exact: true })).toBeVisible();
      await expect(page.locator('.materia-progress-caption')).toHaveText('Tiempo del periodo');
      const progressIndicator = page.getByRole('progressbar', { name: 'Tiempo transcurrido del periodo de Álgebra Lineal — 2A' });
      await expect(progressIndicator).toHaveAttribute('aria-valuetext', /\d+% del periodo transcurrido/);
      await expect(page.locator('.materia-progress-ring')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('.materias-lista__item .materia-meta-value').nth(0)).toHaveText('10 ago 2026');
      await expect(page.locator('.materias-lista__item .materia-meta-value').nth(1)).toHaveText('18 dic 2026');
      await expect(page.locator('.materia-mini-kpi--active .materia-mini-kpi__lbl')).toHaveText('Materia');
      await expect(page.locator('.materia-mini-kpi--groups .materia-mini-kpi__lbl')).toHaveText('Grupos');
      if (width <= 390) {
        const banner = page.locator('.banner-recordatorio-asistencia');
        const status = banner.getByRole('status');
        await expect(banner).toBeVisible();
        await expect(status).toHaveText('Pase de lista pendiente hoy.');
        await expect(status.locator('button, summary')).toHaveCount(0);
        const alturaCompacta = await banner.evaluate((element) => element.getBoundingClientRect().height);
        const action = banner.getByRole('button', { name: 'Pasar lista' });
        const close = banner.getByRole('button', { name: 'Cerrar recordatorio' });
        const targetGeometry = await banner.evaluate((element) => {
          const bounds = (selector: string) => element.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
          const actionBounds = bounds('.asistencias-btn-primario');
          const closeBounds = bounds('.banner-recordatorio-asistencia__close');
          const textBounds = bounds('.banner-recordatorio-asistencia__text');
          return {
            fits: Boolean(actionBounds && closeBounds && textBounds
            && actionBounds.width >= 43.5 && actionBounds.height >= 43.5
            && closeBounds.width >= 43.5 && closeBounds.height >= 43.5
            && actionBounds.left >= textBounds.right - 1
            && actionBounds.right <= closeBounds.left),
            compact: element.getBoundingClientRect().height <= 88,
            noOverflow: element.scrollWidth <= element.clientWidth,
            action: actionBounds && { x: actionBounds.x, y: actionBounds.y, width: actionBounds.width, height: actionBounds.height },
            close: closeBounds && { x: closeBounds.x, y: closeBounds.y, width: closeBounds.width, height: closeBounds.height },
            text: textBounds && { x: textBounds.x, y: textBounds.y, width: textBounds.width, height: textBounds.height },
          };
        });
        expect(targetGeometry.fits, `El aviso debe conservar dos objetivos táctiles y el orden visual a ${width}px: ${JSON.stringify(targetGeometry)}`).toBe(true);
        expect(targetGeometry.compact, `El aviso debe caber en una fila a ${width}px`).toBe(true);
        expect(targetGeometry.noOverflow, `El aviso no debe desbordarse a ${width}px`).toBe(true);
        await action.focus();
        await page.keyboard.press('Tab');
        await expect(close).toBeFocused();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        const animations = await banner.evaluate((element) => [
          getComputedStyle(element.querySelector('.banner-recordatorio-asistencia__icon')!).animationName,
          getComputedStyle(element.querySelector('.asistencias-btn-primario')!).animationName
        ]);
        expect(animations, 'el recordatorio no debe llamar la atención mediante pulsos repetidos').toEqual(['none', 'none']);
        if (width === 320) {
          const mobilePicker = nav.locator('#navegacion-docente-movil');
          await mobilePicker.selectOption({ label: 'Asistencias' });
          await expect(status).toHaveText('Pase de lista pendiente. Aún no has pasado lista hoy.');
          const alturaEnAsistencias = await banner.evaluate((element) => element.getBoundingClientRect().height);
          expect(alturaCompacta, 'Fuera de Asistencias el aviso debe reducirse y mantener el acceso directo').toBeLessThan(alturaEnAsistencias);
          await expect(action).toBeVisible();
          await page.screenshot({
            path: supplementalEvidencePath('ux-recordatorio-asistencias-320-light-viewport.png'),
            animations: 'disabled'
          });
          await mobilePicker.selectOption({ label: 'Materias' });
          await expect(status).toHaveText('Pase de lista pendiente hoy.');
        }
      }
      for (const theme of ['light', 'dark']) {
        await setVisibleTheme(page, theme);
        await assertNoHorizontalOverflow(page, `Materias activas ficticias ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Materias activas ficticias ${width}px / ${theme}`);
        const etiquetaCiclo = page.locator('.materias-status-pill');
        await expect(etiquetaCiclo).toHaveText('Ciclo Académico');
        await expect(etiquetaCiclo.locator('.materias-pulse-dot')).toHaveCount(0);
        const estadoMateria = page.locator('.materia-title-group .chip--en_curso');
        await estadoMateria.evaluate(async (element) => {
          const targets: Element[] = [];
          for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) targets.push(current);
          await Promise.all(targets.flatMap((target) => target.getAnimations()).map((animation) => animation.finished.catch(() => undefined)));
        });
        await assertRenderedTextContrast(
          estadoMateria,
          `Estado En curso de Materias ${width}px / ${theme}`
        );
        if (theme === 'light') {
          const metadataStyles = await page.locator('.materias-lista__item').evaluate((item) => ({
            background: getComputedStyle(item).backgroundColor,
            labels: [...item.querySelectorAll<HTMLElement>('.materia-card-meta .materia-meta-lbl')].map((element) => getComputedStyle(element).color),
            values: [...item.querySelectorAll<HTMLElement>('.materia-card-meta .materia-meta-value')].map((element) => getComputedStyle(element).color),
            rosterCount: getComputedStyle(item.querySelector('.materia-card-alumnos__header strong')!).color,
          }));
          expect(metadataStyles.background, `Tarjeta de Materias ${width}px / tema claro: superficie estable`).toBe('rgb(248, 250, 252)');
          expect(metadataStyles.labels, `Metadatos de Materias ${width}px / tema claro: etiquetas`).toEqual(Array(3).fill('rgb(71, 85, 105)'));
          expect(metadataStyles.values, `Metadatos de Materias ${width}px / tema claro: valores`).toEqual(Array(3).fill('rgb(15, 23, 42)'));
          expect(metadataStyles.rosterCount, `Materias ${width}px / tema claro: conteo de alumnos`).toBe('rgb(7, 89, 133)');
          const kpiColors = await page.locator('.materias-header-kpis .materia-mini-kpi').evaluateAll((items) =>
            items.map((item) => ({
              background: getComputedStyle(item).backgroundColor,
              value: getComputedStyle(item.querySelector('.materia-mini-kpi__num')!).color,
              label: getComputedStyle(item.querySelector('.materia-mini-kpi__lbl')!).color,
            }))
          );
          expect(kpiColors.map((item) => item.background), `Materias KPI ${width}px / tema claro: superficies`).toEqual(Array(3).fill('rgb(238, 244, 250)'));
          expect(kpiColors.map((item) => item.value), `Materias KPI ${width}px / tema claro: valores`).toEqual([
            'rgb(7, 89, 133)', 'rgb(6, 95, 70)', 'rgb(146, 64, 14)'
          ]);
          expect(kpiColors.map((item) => item.label), `Materias KPI ${width}px / tema claro: etiquetas`).toEqual(Array(3).fill('rgb(71, 85, 105)'));
          const emptyRoster = page.locator('.materias-lista__item .materia-card-alumnos__empty');
          if (await emptyRoster.isVisible()) {
            await expect(emptyRoster).toHaveCSS('background-color', 'rgb(241, 245, 249)');
            await expect(emptyRoster).toHaveCSS('color', 'rgb(51, 65, 85)');
          }
        }
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-activas-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-header-${width}-${theme}-viewport.png`),
          animations: 'disabled'
        });
        await page.locator('.materias-lista__item').first().screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-tarjeta-${width}-${theme}-element.png`),
          animations: 'disabled'
        });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        if (width <= 360) {
          const metadataGaps = await page.locator('.materias-lista__item .materia-card-meta').evaluate((metadata) => {
            const rows = [...metadata.querySelectorAll<HTMLElement>('.materia-meta-tag')]
              .map((element) => element.getBoundingClientRect())
              .sort((a, b) => a.top - b.top);
            return rows.slice(1).map((row, index) => row.top - rows[index]!.bottom);
          });
          expect(metadataGaps.every((gap) => gap <= 16), `Materias activas ${width}px / ${theme}: separación vertical de metadatos`).toBe(true);
          const metadataHeights = await page.locator('.materias-lista__item .materia-card-meta .materia-meta-tag').evaluateAll((tags) =>
            tags.map((tag) => tag.getBoundingClientRect().height)
          );
          expect(metadataHeights.every((height) => height <= 72), `Materias activas ${width}px / ${theme}: altura de filas ${JSON.stringify(metadataHeights)}`).toBe(true);
        }
      }

      await page.getByRole('button', { name: /Mostrar formulario/i }).click();
      const formAlta = page.locator('#registro-nueva-materia');
      await expect(formAlta).toBeVisible();
      const botonCrearMateria = formAlta.getByRole('button', { name: 'Crear materia' });
      const ayudaCrearMateria = formAlta.getByText('Completa los campos obligatorios y corrige los errores indicados para habilitar la creación.');
      await expect(botonCrearMateria).toBeDisabled();
      await expect(botonCrearMateria).toHaveAccessibleDescription('Completa los campos obligatorios y corrige los errores indicados para habilitar la creación.');
      await expect(botonCrearMateria).toHaveAttribute('aria-describedby', 'materias-crear-ayuda');
      await expect(formAlta.getByLabel('Nombre de la materia')).toHaveAttribute('required', '');
      await expect(formAlta.getByLabel('Fecha de inicio')).toHaveAttribute('required', '');
      await expect(formAlta.getByLabel('Fecha de término')).toHaveAttribute('required', '');
      await expect(formAlta.locator('.campo--fecha > input[type="date"]')).toHaveCount(2);
      await expect(formAlta.locator('.materias-form__row--bottom .auth-input-box__icon')).toHaveCount(0);
      const selectorPortada = formAlta.getByLabel('Portada (opcional)');
      await expect(selectorPortada).toHaveAccessibleName('Portada (opcional)');
      await expect(selectorPortada).toHaveAttribute('aria-describedby', 'portada-nueva-materia-ayuda');
      await expect(formAlta.locator('#portada-nueva-materia-estado')).toHaveText('Ningún archivo seleccionado');
      await expect(page.locator('#nueva-materia-instrucciones')).toHaveText('El nombre y las fechas son obligatorios. Los grupos y la portada son opcionales. La fecha de término debe ser igual o posterior a la de inicio.');
      const selectorPortadaCabe = await formAlta.locator('.materia-portada-editor__selector').evaluate((selector) => {
        const bounds = selector.getBoundingClientRect();
        const estado = selector.querySelector<HTMLElement>('.materia-portada-editor__selector-estado');
        const texto = estado?.getBoundingClientRect();
        const label = selector.closest('label')?.getBoundingClientRect();
        return Boolean(estado && texto && label
          && bounds.height >= 44
          && bounds.left >= label.left
          && bounds.right <= label.right
          && texto.left >= bounds.left
          && texto.right <= bounds.right
          && estado.scrollWidth <= estado.clientWidth
          && estado.scrollHeight <= estado.clientHeight);
      });
      expect(selectorPortadaCabe, `Selector de portada completo a ${width}px`).toBe(true);
      for (const theme of ['light', 'dark']) {
        await setVisibleTheme(page, theme);
        const placeholderNombreMateria = await formAlta.getByLabel('Nombre de la materia').evaluate((element) => {
          const input = element as HTMLInputElement;
          const style = getComputedStyle(input);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          context.font = style.font;
          return {
            value: input.placeholder,
            width: context.measureText(input.placeholder).width,
            usableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            inputWidth: input.getBoundingClientRect().width,
            wrapperWidth: input.closest('.auth-input-box')?.getBoundingClientRect().width,
            fieldWidth: input.closest('.campo')?.getBoundingClientRect().width,
            gridColumns: input.closest('.materias-form__row') ? getComputedStyle(input.closest('.materias-form__row')!).gridTemplateColumns : null
          };
        });
        expect(placeholderNombreMateria.value).toBe('Ej. Álgebra');
        expect(placeholderNombreMateria.width, `Placeholder de nombre de Materias debe caber a ${width}px / ${theme}: ${JSON.stringify(placeholderNombreMateria)}`).toBeLessThanOrEqual(placeholderNombreMateria.usableWidth);
        await assertNoHorizontalOverflow(page, `Alta de Materias ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Alta de Materias ${width}px / ${theme}`);
        await assertDisabledButtonContrast(botonCrearMateria, `CTA de Materias deshabilitado ${width}px / ${theme}`);
        const ayudaYBotonApilados = await formAlta.locator('.materias-form__cta-col').evaluate((container) => {
          const help = container.querySelector<HTMLElement>('.materias-form__cta-help')?.getBoundingClientRect();
          const button = container.querySelector<HTMLElement>('.boton')?.getBoundingClientRect();
          const bounds = container.getBoundingClientRect();
          return Boolean(help && button && help.left >= bounds.left - 1 && help.right <= bounds.right + 1
            && button.left >= bounds.left - 1 && button.right <= bounds.right + 1
            && help.bottom <= button.top + 1);
        });
        expect(ayudaYBotonApilados, `La ayuda debe quedar legible y antes del botón a ${width}px`).toBe(true);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(80);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-form-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await selectorPortada.setInputFiles({
        name: 'portada-sintetica.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=', 'base64')
      });
      await expect(formAlta.locator('#portada-nueva-materia-estado')).toHaveText('portada-sintetica.png');
      const nombrePortadaCabe = await formAlta.locator('#portada-nueva-materia-estado').evaluate((estado) =>
        estado.scrollWidth <= estado.clientWidth && estado.scrollHeight <= estado.clientHeight
      );
      expect(nombrePortadaCabe, `El nombre del archivo debe caber completo a ${width}px`).toBe(true);
      for (const theme of ['light', 'dark']) {
        await setVisibleTheme(page, theme);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(80);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-portada-seleccionada-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await selectorPortada.setInputFiles([]);
      await expect(formAlta.locator('#portada-nueva-materia-estado')).toHaveText('Ningún archivo seleccionado');
      await formAlta.getByLabel('Grupos asignados').focus();
      await page.keyboard.press('Tab');
      await expect(selectorPortada).toBeFocused();
      const focoPortada = await formAlta.locator('.materia-portada-editor__selector').evaluate((selector) => ({
        width: getComputedStyle(selector).outlineWidth,
        style: getComputedStyle(selector).outlineStyle
      }));
      expect(focoPortada, 'El selector de portada conserva un indicador visible al recibir foco por teclado').toMatchObject({ width: '3px', style: 'solid' });
      await page.keyboard.press('Tab');
      await expect(formAlta.getByLabel('Fecha de inicio')).toBeFocused();
      const altasAntesDeEnviarConEnter = cambiosMateriasDummy.length;
      const nombreAlta = `Materia sintética por teclado ${width}px`;
      await formAlta.getByLabel('Nombre de la materia').fill(nombreAlta);
      await formAlta.getByLabel('Grupos asignados').fill('2C, 2D');
      const fechaInicioAlta = formAlta.getByLabel('Fecha de inicio');
      const fechaTerminoAlta = formAlta.getByLabel('Fecha de término');
      await fechaInicioAlta.fill('2026-08-01');
      await expect(fechaTerminoAlta).toHaveAttribute('min', '2026-08-01');
      await expect(fechaTerminoAlta).toHaveAccessibleDescription(/fecha de término debe ser igual o posterior a la de inicio/i);
      await fechaTerminoAlta.fill('2026-07-31');
      await expect.poll(() => fechaTerminoAlta.evaluate((element) => (element as HTMLInputElement).validity.rangeUnderflow)).toBe(true);
      await expect(fechaTerminoAlta).toHaveAttribute('aria-invalid', 'true');
      await expect(formAlta.getByText('La fecha de término debe ser igual o posterior a la fecha de inicio.')).toBeVisible();
      await expect(botonCrearMateria).toBeDisabled();
      if (width === 320) {
        for (const theme of ['light', 'dark'] as const) {
          await setVisibleTheme(page, theme);
          await assertNoHorizontalOverflow(page, `Alta de Materias con rango inválido 320px / ${theme}`);
          await page.mouse.move(0, 0);
          await page.waitForTimeout(80);
          await page.screenshot({
            path: supplementalEvidencePath(`ux-audit-materias-rango-fechas-invalido-320-${theme}.png`),
            fullPage: true,
            animations: 'disabled'
          });
        }
      }
      await fechaTerminoAlta.fill('2026-12-18');
      await expect(botonCrearMateria).toBeEnabled();
      await expect(ayudaCrearMateria).toHaveCount(0);
      await expect(botonCrearMateria).not.toHaveAttribute('aria-describedby');
      await formAlta.getByLabel('Nombre de la materia').press('Enter');
      await expect.poll(() => cambiosMateriasDummy.length).toBe(altasAntesDeEnviarConEnter + 1);
      expect(cambiosMateriasDummy[altasAntesDeEnviarConEnter]).toMatchObject({
        method: 'POST',
        url: '/api/periodos',
        body: {
          nombre: nombreAlta,
          fechaInicio: '2026-08-01',
          fechaFin: '2026-12-18',
          grupos: ['2C', '2D']
        }
      });

      const accionesMateria = page.getByRole('button', { name: /Mostrar acciones/i });
      await accionesMateria.click();
      const selectorPortadaEdicion = page.getByLabel('Seleccionar imagen de portada para Álgebra Lineal — 2A');
      const estadoPortadaEdicion = selectorPortadaEdicion.locator('xpath=../span[@role="status"]');
      await expect(selectorPortadaEdicion).toHaveAccessibleDescription(/Ningún archivo seleccionado.*JPG\/JPEG, PNG o WebP/);
      await selectorPortadaEdicion.setInputFiles({
        name: 'portada-algebra-lineal-grupo-2A.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/cWQAAAAASUVORK5CYII=', 'base64')
      });
      await expect(estadoPortadaEdicion).toHaveText('portada-algebra-lineal-grupo-2A.png');
      const medidasEstadoPortada = await estadoPortadaEdicion.evaluate((element) => ({
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth
      }));
      expect(medidasEstadoPortada.clientWidth).toBeGreaterThan(0);
      expect(medidasEstadoPortada.clientHeight).toBeGreaterThan(0);
      expect(medidasEstadoPortada.scrollWidth).toBeLessThanOrEqual(medidasEstadoPortada.clientWidth);
      expect(medidasEstadoPortada.scrollHeight).toBeLessThanOrEqual(medidasEstadoPortada.clientHeight);
      for (const theme of ['light', 'dark']) {
        await setVisibleTheme(page, theme);
        await assertNoHorizontalOverflow(page, `Portada de Materias ${width}px / ${theme}`);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(80);
        await page.locator('.materia-portada-editor').last().screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-portada-edicion-${width}-${theme}.png`),
          animations: 'disabled'
        });
      }
      await selectorPortadaEdicion.setInputFiles([]);
      await expect(estadoPortadaEdicion).toHaveText('Ningún archivo seleccionado');
      const cambiosAntesDeEditar = cambiosMateriasDummy.length;
      const editarMateria = page.getByRole('button', { name: 'Editar' });
      await editarMateria.focus();
      await page.keyboard.press('Enter');
      const formularioEdicionTeclado = page.locator('form.materias-edicion');
      const instruccionesEdicionTeclado = formularioEdicionTeclado.locator('.nota');
      await expect(instruccionesEdicionTeclado).toBeFocused();
      await expect(formularioEdicionTeclado.locator('input[type="date"]')).toHaveCount(2);
      await expect(formularioEdicionTeclado.locator('.materias-fechas-grid .auth-input-box__icon')).toHaveCount(0);
      const fechaTerminoEdicion = formularioEdicionTeclado.getByLabel('Fecha de término');
      await expect(instruccionesEdicionTeclado).toContainText('La fecha de término debe ser igual o posterior a la de inicio.');
      await expect(fechaTerminoEdicion).toHaveAttribute('min', '2026-08-10');
      await expect(fechaTerminoEdicion).toHaveAccessibleDescription(/fecha de término debe ser igual o posterior a la de inicio/i);
      expect(cambiosMateriasDummy).toHaveLength(cambiosAntesDeEditar);
      await page.keyboard.press('Tab');
      const nombreEdicion = page.locator('#nombre-materia-edicion-periodo-activo-dummy');
      await expect(nombreEdicion).toBeFocused();
      await expect(nombreEdicion).toHaveValue('Álgebra Lineal — 2A');
      await expect(nombreEdicion).not.toHaveAttribute('aria-invalid', 'true');
      const gruposEdicion = formularioEdicionTeclado.getByRole('textbox', { name: 'Grupos asignados (opcional)', exact: true });
      await expect(gruposEdicion).toHaveAccessibleDescription('Separa varios grupos con comas; puedes dejarlo vacío.');
      await expect(gruposEdicion).not.toHaveAttribute('required');
      await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
      for (const theme of ['light', 'dark']) {
        await setVisibleTheme(page, theme);
        await assertNoHorizontalOverflow(page, `Edición de Materias ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Edición de Materias ${width}px / ${theme}`);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(80);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-edicion-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await nombreEdicion.press('Enter');
      await expect.poll(() => cambiosMateriasDummy.length).toBe(cambiosAntesDeEditar + 1);
      expect(cambiosMateriasDummy[cambiosAntesDeEditar]).toMatchObject({
        url: '/api/periodos/periodo-activo-dummy',
        body: {
          nombre: 'Álgebra Lineal — 2A',
          fechaInicio: '2026-08-10',
          fechaFin: '2026-12-18',
          grupos: ['2A', '2B']
        }
      });
      const resultadoEdicion = page.getByRole('status').filter({ hasText: 'Cambios guardados en «Álgebra Lineal — 2A».' });
      await expect(resultadoEdicion).toBeVisible();
      await expect(page.locator('.materias-form').getByText('Cambios guardados en «Álgebra Lineal — 2A».')).toHaveCount(0);
      await page.mouse.move(0, 0);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-resultado-edicion-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await expect(page.getByRole('button', { name: /Mostrar acciones/i })).toBeFocused();

      const avisosAnteriores = page.locator('button[aria-label^="Cerrar notificación:"]');
      while (await avisosAnteriores.count()) await avisosAnteriores.first().click();

      const toggleAccionesArchivo = page.getByRole('button', { name: /Mostrar acciones/i });
      await toggleAccionesArchivo.click();
      const botonArchivarMateria = page.getByRole('button', { name: 'Archivar' });
      await botonArchivarMateria.focus();
      const cambiosAntesDeConfirmarArchivo = cambiosMateriasDummy.length;
      await page.keyboard.press('Enter');
      const dialogoArchivo = page.getByRole('alertdialog', { name: 'Archivar materia' });
      await expect(dialogoArchivo).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Cambios guardados en «Álgebra Lineal — 2A».' })).toHaveCount(0);
      await expect(dialogoArchivo).toHaveAttribute('aria-modal', 'true');
      await expect(dialogoArchivo).toContainText('Álgebra Lineal — 2A');
      const cancelarArchivo = page.getByRole('button', { name: 'Cancelar' });
      const confirmarArchivo = page.getByRole('button', { name: 'Sí, archivar' });
      await expect(cancelarArchivo).toBeFocused();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Confirmación de archivo Materias ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-dialogo-archivo-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await page.keyboard.press('Tab');
      await expect(confirmarArchivo).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(cancelarArchivo).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(confirmarArchivo).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialogoArchivo).toHaveCount(0);
      await expect(botonArchivarMateria).toBeFocused();
      expect(cambiosMateriasDummy).toHaveLength(cambiosAntesDeConfirmarArchivo);

      await page.keyboard.press('Enter');
      await expect(page.getByRole('alertdialog', { name: 'Archivar materia' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
      await page.getByRole('button', { name: 'Sí, archivar' }).click();
      await expect.poll(() => cambiosMateriasDummy.length).toBe(cambiosAntesDeConfirmarArchivo + 1);
      expect(cambiosMateriasDummy[cambiosAntesDeConfirmarArchivo]).toMatchObject({
        method: 'POST',
        url: '/api/periodos/periodo-activo-dummy/archivar',
        body: {}
      });

      await page.getByRole('button', { name: 'Archivadas' }).click();
      await expect(page.getByRole('heading', { name: 'Materias archivadas' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Información sobre archivo de materias' })).toContainText('¿Qué conserva el archivo?');
      await expect(page.getByRole('group', { name: 'Editando Materia' })).toHaveCount(0);
      await expect(page.getByText('Historia del Arte — 1B', { exact: true })).toBeVisible();
      await expect(page.getByText('18 dic 2025')).toBeVisible();
      await expect(page.getByText('21 jun 2026')).toBeVisible();
      await expect(page.getByText('42 reactivos')).toBeVisible();
      await expect(page.getByText('18 alumnos')).toBeVisible();
      await expect(page.getByText('2 plantillas')).toBeVisible();
      await expect(page.getByText('18 calificaciones')).toBeVisible();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Materias archivadas ficticias ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Materias archivadas ficticias ${width}px / ${theme}`);
        if (width <= 360) {
          await expect(page.locator('.archivadas-info-card')).toHaveCSS('flex-direction', 'column');
        }
        const clippedArchiveDetails = await page.locator('.materias-lista__item').evaluate((item) => {
          const groups = [
            { selector: '.materia-card-meta', container: item.querySelector<HTMLElement>('.materia-card-meta')?.parentElement },
            { selector: '.archivadas-chips-row', container: item.querySelector<HTMLElement>('.archivadas-chips-row') }
          ];
          return groups.flatMap(({ selector, container }) => {
            if (!container) return [];
            const bounds = container.getBoundingClientRect();
            return [...item.querySelectorAll<HTMLElement>(selector === '.materia-card-meta' ? '.materia-meta-tag, .materia-meta-value' : '.archivada-chip')]
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return element.scrollWidth > element.clientWidth + 1 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
              })
              .map((element) => (element.innerText || element.textContent || '').trim());
          });
        });
        expect(clippedArchiveDetails, `Materias archivadas ${width}px / ${theme}: fechas o conteos recortados`).toEqual([]);
        if (width <= 360) {
          const metadataGaps = await page.locator('.materias-lista__item .materia-card-meta').evaluate((metadata) => {
            const rows = [...metadata.querySelectorAll<HTMLElement>('.materia-meta-tag')]
              .map((element) => element.getBoundingClientRect())
              .sort((a, b) => a.top - b.top);
            return rows.slice(1).map((row, index) => row.top - rows[index]!.bottom);
          });
          expect(metadataGaps.every((gap) => gap <= 16), `Materias archivadas ${width}px / ${theme}: separación vertical de fechas`).toBe(true);
          const metadataHeights = await page.locator('.materias-lista__item .materia-card-meta .materia-meta-tag').evaluateAll((tags) =>
            tags.map((tag) => tag.getBoundingClientRect().height)
          );
          expect(metadataHeights.every((height) => height <= 72), `Materias archivadas ${width}px / ${theme}: altura de filas ${JSON.stringify(metadataHeights)}`).toBe(true);
          const dateWrapping = await page.locator('.materias-lista__item .materia-meta-value').evaluateAll((values) =>
            values.map((value) => getComputedStyle(value).overflowWrap)
          );
          expect(dateWrapping, 'Las fechas deben envolver entre fecha y hora, no dentro de la fecha').not.toContain('anywhere');
        }
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-materias-archivadas-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
  });

  test('abre y cancela edición de Materias con Espacio sin guardar ni perder el foco', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tokenDocente', 'token-materias-teclado-dummy');
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/analiticas/eventos-uso')) return Promise.resolve(new Response(null, { status: 204 }));
        return fetchOriginal(input, init);
      };
    });
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-materias-teclado-dummy',
          nombreCompleto: 'Docente de Prueba',
          correo: 'docente-demo@evaluapro.local',
          permisos: ['periodos:leer', 'periodos:gestionar'],
          roles: ['docente']
        } })
      });
    });
    const writes: string[] = [];
    await page.route('**/api/periodos**', async (route) => {
      if (route.request().method() !== 'GET') {
        writes.push(route.request().method());
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: [{
          _id: 'periodo-materias-teclado-dummy',
          nombre: 'Materia de Prueba',
          fechaInicio: '2026-08-10',
          fechaFin: '2026-12-18',
          grupos: ['2A'],
          activo: true
        }] })
      });
    });
    await page.route('**/api/asistencias/sesiones**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sesiones: [] }) });
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Materias' });
    await expect(page.getByRole('button', { name: /Abrir grupo .*Materia de Prueba/ })).toBeVisible();
    const acciones = page.getByRole('button', { name: /Mostrar acciones/i });
    await acciones.click();

    const editar = page.getByRole('button', { name: 'Editar' });
    await editar.focus();
    await page.keyboard.press('Space');
    const formulario = page.locator('form.materias-edicion');
    await expect(formulario.locator('.nota')).toBeFocused();
    expect(writes, 'Abrir el formulario con Espacio no debe guardar datos').toEqual([]);

    const cancelar = page.getByRole('button', { name: /^Cancelar edición de materia/ });
    await cancelar.focus();
    await page.keyboard.press('Space');
    await expect(formulario).toHaveCount(0);
    await expect(acciones).toBeFocused();
    expect(writes, 'Cancelar con Espacio no debe guardar datos').toEqual([]);
  });

  test('audita tarjetas de Alumnos con expedientes ficticios', async ({ page }) => {
    const periodoId = 'periodo-alumnos-dummy';
    const alumnos = [
      { _id: 'alumno-dummy-001', periodoId, matricula: 'CUH512410168', nombres: 'María Fernanda', apellidos: 'González Hernández', nombreCompleto: 'María Fernanda González Hernández', correo: 'maria.fernanda.gonzalez@example.edu.mx', grupo: '2A', activo: true },
      { _id: 'alumno-dummy-002', periodoId, matricula: 'CUH512410169', nombres: 'José Ángel', apellidos: 'Rodríguez López', nombreCompleto: 'José Ángel Rodríguez López', correo: 'jose.rodriguez@example.edu.mx', grupo: '2B', activo: true },
      { _id: 'alumno-dummy-003', periodoId, matricula: 'CUH512410170', nombres: 'Lucía del Carmen', apellidos: 'Hernández Pérez', nombreCompleto: 'Lucía del Carmen Hernández Pérez', correo: 'lucia.hernandez@example.edu.mx', grupo: '2A', activo: true },
      { _id: 'alumno-dummy-004', periodoId, matricula: 'CUH512410171', nombres: 'Diego Alejandro', apellidos: 'Martínez Ríos', nombreCompleto: 'Diego Alejandro Martínez Ríos', correo: 'diego.martinez@example.edu.mx', grupo: '2C', activo: true }
    ];
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-alumnos-dummy'));
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-alumnos-dummy',
          nombreCompleto: 'Docente de Prueba',
          correo: 'docente-demo@evaluapro.local',
          permisos: ['periodos:leer', 'alumnos:leer', 'alumnos:gestionar'],
          roles: ['docente']
        } })
      });
    });
    await page.route('**/api/periodos**', async (route) => {
      const archivadas = new URL(route.request().url()).searchParams.get('activo') === '0';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: archivadas ? [] : [{
          _id: periodoId,
          nombre: 'Cálculo Diferencial — 2A/2B/2C',
          fechaInicio: '2026-08-10',
          fechaFin: '2026-12-18',
          grupos: ['2A', '2B', '2C'],
          activo: true
        }] })
      });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos }) });
    });
    await page.route('**/api/asistencias/resumen**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resumen: [
          { alumnoId: 'alumno-dummy-001', faltas: 5 },
          { alumnoId: 'alumno-dummy-002', faltas: 4 },
          { alumnoId: 'alumno-dummy-003', faltas: 2 },
          { alumnoId: 'alumno-dummy-004', faltas: 0 }
        ] })
      });
    });

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });
      await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Alumnos' });
      await expect(page.getByRole('heading', { name: 'Alumnos', exact: true })).toBeVisible();
      await expect(page.locator('.alumnos-lista__item')).toHaveCount(4);
      const toggleAlta = page.locator('.alumnos-form__toggle');
      const cuerpoAlta = page.locator('#alumnos-form-body');
      await expect(toggleAlta).toHaveAccessibleName('Mostrar formulario');
      await expect(toggleAlta).toHaveAttribute('aria-expanded', 'false');
      await expect(cuerpoAlta).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Alumnos de la materia' })).toBeVisible();
      const tamanoToggleAlta = await toggleAlta.boundingBox();
      expect(tamanoToggleAlta?.height, 'el control para abrir el alta conserva un objetivo táctil cómodo').toBeGreaterThanOrEqual(44);
      await toggleAlta.focus();
      await page.keyboard.press('Enter');
      await expect(toggleAlta).toHaveAttribute('aria-expanded', 'true');
      await expect(cuerpoAlta).toBeVisible();
      await page.keyboard.press('Space');
      await expect(toggleAlta).toHaveAttribute('aria-expanded', 'false');
      await expect(cuerpoAlta).toBeHidden();
      await expect(page.locator('.alumnos-header-kpis .materia-mini-kpi--active .materia-mini-kpi__num')).toHaveText('4');
      await expect(page.locator('.alumnos-header-kpis .materia-mini-kpi--closing .materia-mini-kpi__num')).toHaveText('2');
      await expect(page.getByText('4+ inasistencias').first()).toBeVisible();
      await expect(page.getByText('María Fernanda González Hernández', { exact: true })).toBeVisible();
      await expect(page.getByText('maria.fernanda.gonzalez@example.edu.mx', { exact: true })).toBeVisible();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await page.locator('.alumnos-lista__item').evaluateAll(async (cards) => {
          const targets = cards.flatMap((card) => [card, ...card.querySelectorAll('*')]);
          await Promise.all(targets.flatMap((target) => target.getAnimations()).map((animation) => animation.finished.catch(() => undefined)));
        });
        const textoDatos = page.locator(
          '.alumnos-lista__item .alumno-meta-lbl, .alumnos-lista__item .alumno-meta-value, .alumnos-lista__item .alumno-meta-tag--grupo .badge.badge-grupo, .alumnos-lista__item .alumno-correo, .alumnos-lista__item .badge-alerta-inasistencias'
        );
        for (const nodo of await textoDatos.all()) {
          const texto = (await nodo.innerText()).trim();
          await assertRenderedTextContrast(nodo, `Dato «${texto}» de Alumnos ${width}px / ${theme}`);
        }
        await assertNoHorizontalOverflow(page, `Alumnos con alta plegada ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-lista-prioritaria-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      if (width === 390) {
        const filtroDosA = page.getByRole('button', { name: /2A\s*\(2\)/i });
        await filtroDosA.focus();
        await expect(filtroDosA).toHaveAttribute('aria-pressed', 'false');
        const focoVisible = await filtroDosA.evaluate((element) => {
          const estilo = getComputedStyle(element);
          return estilo.outlineStyle !== 'none' && Number.parseFloat(estilo.outlineWidth) >= 2;
        });
        expect(focoVisible, 'el filtro de grupo debe mostrar foco de teclado').toBe(true);
        await page.keyboard.press('Space');
        await expect(filtroDosA).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByText('Se muestran 2 de 4 alumnos.')).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(filtroDosA).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByText('Se muestran 4 de 4 alumnos.')).toBeVisible();
      }
      const materiaSeleccionada = page.getByRole('combobox', { name: 'Materia de la lista' });
      const materiaAntesDeLimpiar = await materiaSeleccionada.inputValue();
      await expect(page.getByRole('group', { name: 'Filtrar por grupo:' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Grupo' })).toHaveCount(0);
      const filtrosCompactos = await page.locator('.alumnos-explorador > .alumnos-filtros--glass > .campo').evaluateAll((campos) =>
        campos.map((campo) => {
          const rect = campo.getBoundingClientRect();
          return { left: rect.left, top: rect.top, bottom: rect.bottom };
        })
      );
      expect(filtrosCompactos).toHaveLength(2);
      expect(Math.abs(filtrosCompactos[0]!.left - filtrosCompactos[1]!.left), 'los filtros deben alinearse en columna en móvil').toBeLessThanOrEqual(1);
      expect(filtrosCompactos[1]!.top, 'el buscador debe aparecer debajo del selector de materia en móvil').toBeGreaterThanOrEqual(filtrosCompactos[0]!.bottom);
      await page.getByRole('button', { name: /2A\s*\(2\)/i }).click();
      await page.getByRole('searchbox', { name: 'Buscar alumno' }).fill('sin coincidencias');
      await expect(page.getByText('Se muestran 0 de 4 alumnos.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Sin coincidencias' })).toBeVisible();
      await expect(page.getByText('No hay alumnos para «sin coincidencias» en el grupo «2A».')).toBeVisible();
      const limpiarFiltros = page.getByRole('button', { name: 'Limpiar filtros' });
      await expect(limpiarFiltros).toBeVisible();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Alumnos sin coincidencias ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-sin-coincidencias-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      await limpiarFiltros.click();
      await expect(page.getByRole('searchbox', { name: 'Buscar alumno' })).toHaveValue('');
      await expect(page.getByRole('button', { name: /Todos \(4\)/i })).toHaveAttribute('aria-pressed', 'true');
      await expect(materiaSeleccionada).toHaveValue(materiaAntesDeLimpiar);
      await expect(page.locator('.alumnos-lista__item')).toHaveCount(4);
      const tarjetaMaria = page.locator('.alumnos-lista__item').filter({ hasText: 'CUH512410168' });
      await expect(tarjetaMaria).toHaveCount(1);
      const tamanosTipograficos = await tarjetaMaria.evaluate((element) => ({
        etiquetas: Array.from(element.querySelectorAll<HTMLElement>('.alumno-meta-lbl'))
          .map((item) => Number.parseFloat(getComputedStyle(item).fontSize)),
        valores: Array.from(element.querySelectorAll<HTMLElement>(
          '.alumno-meta-value, .alumno-meta-tag--grupo .badge.badge-grupo, .alumno-correo'
        )).map((item) => Number.parseFloat(getComputedStyle(item).fontSize))
      }));
      expect(tamanosTipograficos.etiquetas.length).toBeGreaterThan(0);
      expect(tamanosTipograficos.valores.length).toBeGreaterThan(0);
      expect(Math.min(...tamanosTipograficos.etiquetas), `Rótulos legibles a ${width}px`).toBeGreaterThanOrEqual(12);
      expect(Math.min(...tamanosTipograficos.valores), `Valores legibles a ${width}px`).toBeGreaterThanOrEqual(13);
      await expect(tarjetaMaria.locator('.alumno-avatar span')).toHaveText('MH');
      const botonEditarMaria = tarjetaMaria.getByRole('button', { name: 'Editar María Fernanda González Hernández' });
      await botonEditarMaria.hover();
      await expect(page.locator('.tooltip-layer')).toHaveCount(0);
      for (const nombre of [
        'Diego Alejandro Martínez Ríos',
        'Lucía del Carmen Hernández Pérez',
        'José Ángel Rodríguez López',
        'María Fernanda González Hernández'
      ]) {
        await expect(page.getByText(nombre, { exact: true })).toBeVisible();
      }
      await page.mouse.move(1, 1);
      if (width === 320) {
        await expect(tarjetaMaria.locator('.alumno-meta-tag--matricula')).toHaveCSS('display', 'grid');
      }
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        if (theme === 'light') {
          await expect(tarjetaMaria.locator('.alumno-meta-value')).toHaveCSS('color', 'rgb(23, 32, 51)');
        }
        await assertNoHorizontalOverflow(page, `Alumnos ficticios ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Alumnos ficticios ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
  });

  test('audita notificaciones globales en móvil y escritorio, ambos temas y teclado', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-toast-dummy'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Escritura bloqueada en la auditoría de toasts.' }) });
      }
    });
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docente: {
        _id: 'docente-toast-dummy', nombre: 'Docente de Prueba', correo: 'docente-toast@example.invalid',
        permisos: ['periodos:leer', 'alumnos:leer', 'alumnos:gestionar', 'evaluaciones:leer', 'calificaciones:calificar'], roles: ['docente']
      } }) });
    });
    await page.route('**/api/periodos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [
        { _id: 'periodo-toast-dummy-2a', nombre: 'Evaluación de datos — 2A', grupos: ['2A'], activo: true }
      ] }) });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [
        { _id: 'alumno-toast-dummy-001', periodoId: 'periodo-toast-dummy-2a', matricula: 'DUMMY-001', nombreCompleto: 'Ana Alumna de Prueba', grupo: '2A', correo: 'ana-toast@example.invalid', activo: true },
        { _id: 'alumno-toast-dummy-002', periodoId: 'periodo-toast-dummy-2a', matricula: 'DUMMY-002', nombreCompleto: 'Benito Pruebas Extensas', grupo: '2A', correo: 'benito-toast@example.invalid', activo: true }
      ] }) });
    });
    await page.route('**/api/asistencias/resumen**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resumen: [
        { alumnoId: 'alumno-toast-dummy-001', faltas: 0 }, { alumnoId: 'alumno-toast-dummy-002', faltas: 1 }
      ] }) });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Alumnos' });
    await page.getByLabel('Materia de la lista').selectOption('periodo-toast-dummy-2a');
    await expect(page.getByText('Ana Alumna de Prueba')).toBeVisible();
    const controlPoblado = page.getByRole('searchbox', { name: 'Buscar alumno' });
    await controlPoblado.focus();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: {
        id: 'ux-toast-e2e-warning', level: 'warn', title: 'Sesión próxima a vencer',
        message: 'Guarda tu trabajo y vuelve a conectarte para continuar.',
        action: { label: 'Continuar', onClick: () => undefined },
        secondaryAction: { label: 'Después', onClick: () => undefined }
      } }));
      window.dispatchEvent(new CustomEvent('app:toast', { detail: {
        id: 'ux-toast-e2e-success', level: 'ok', title: 'Cambios guardados',
        message: 'La configuración se guardó correctamente.', durationMs: 12000
      } }));
    });

    const verificarToastMovil = async () => {
      const geometria = await page.evaluate(() => {
        const toast = document.querySelector<HTMLElement>('.toast-viewport');
        if (!toast) return { existe: false, posicion: '', ubicacion: '', dentroViewport: false, focoCubierto: 1, controlesCubiertos: ['viewport ausente'] };
        const cajaToast = toast.getBoundingClientRect();
        const rectFoco = document.activeElement instanceof HTMLElement && !toast.contains(document.activeElement)
          ? document.activeElement.getBoundingClientRect()
          : null;
        const areaCubierta = (caja: DOMRect) => Math.max(0, Math.min(cajaToast.right, caja.right) - Math.max(cajaToast.left, caja.left))
          * Math.max(0, Math.min(cajaToast.bottom, caja.bottom) - Math.max(cajaToast.top, caja.top));
        const controlesCubiertos = Array.from(document.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [role="button"], [role="link"]'
        )).filter((control) => {
          if (toast.contains(control) || control.closest('[aria-hidden="true"]')) return false;
          if (control.classList.contains('shell-docente__skip-link') && !control.matches(':focus-visible')) return false;
          const estilo = getComputedStyle(control);
          const caja = control.getBoundingClientRect();
          return caja.width > 0 && caja.height > 0 && estilo.display !== 'none' && estilo.visibility !== 'hidden'
            && Number(estilo.opacity) !== 0 && caja.right > 0 && caja.left < window.innerWidth
            && caja.bottom > 0 && caja.top < window.innerHeight && areaCubierta(caja) / (caja.width * caja.height) >= 0.99;
        }).map((control) => control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName);
        return {
          existe: true,
          posicion: getComputedStyle(toast).position,
          ubicacion: toast.dataset.placement || '',
          scrollY: window.scrollY,
          limites: { left: cajaToast.left, top: cajaToast.top, right: cajaToast.right, bottom: cajaToast.bottom, width: cajaToast.width, height: cajaToast.height },
          ventana: { width: window.innerWidth, height: window.innerHeight },
          hostContexto: toast.parentElement instanceof HTMLElement ? {
            padre: toast.parentElement.parentElement?.className || toast.parentElement.parentElement?.tagName,
            siguiente: toast.parentElement.nextElementSibling instanceof HTMLElement
              ? `${toast.parentElement.nextElementSibling.tagName}.${toast.parentElement.nextElementSibling.className}`
              : null,
            hostTop: toast.parentElement.getBoundingClientRect().top
          } : null,
          dentroViewport: cajaToast.left >= 0 && cajaToast.top >= 0
            && cajaToast.right <= window.innerWidth && cajaToast.bottom <= window.innerHeight,
          focoCubierto: rectFoco ? areaCubierta(rectFoco) / Math.max(1, rectFoco.width * rectFoco.height) : 0,
          controlesCubiertos
        };
      });
      expect(geometria.existe, 'la región de notificaciones debe existir').toBe(true);
      expect(geometria.posicion, 'el aviso móvil debe usar posicionamiento fijo o flujo del documento seguro')
        .toBe(geometria.ubicacion === 'flow' ? 'relative' : 'fixed');
      if (geometria.posicion === 'fixed' || geometria.scrollY <= 1) {
        expect(geometria.dentroViewport, `el aviso debe quedar visible cuando está fijado o la página está al inicio: ${JSON.stringify(geometria)}`).toBe(true);
      }
      expect(geometria.focoCubierto, 'el aviso móvil no debe ocultar por completo el foco').toBeLessThan(0.99);
      expect(geometria.controlesCubiertos, 'el aviso móvil no debe ocultar controles visibles').toEqual([]);
    };

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        const viewport = page.getByRole('region', { name: 'Notificaciones' });
        const warning = page.getByRole('group', { name: 'Sesión próxima a vencer' });
        await expect(viewport.locator('.toast')).toHaveCount(1);
        await expect(page.getByRole('group', { name: 'Cambios guardados' })).toHaveCount(0);
        await expect(page.locator('.toast-queue-status')).toHaveText('+1 en espera');
        await expect(warning).toBeVisible();
        await expect(warning.getByRole('button', { name: 'Continuar' })).toBeVisible();
        await expect(warning.getByRole('button', { name: 'Después' })).toBeVisible();
        const tamanosTexto = await warning.evaluate((element) => ({
          titulo: Number.parseFloat(getComputedStyle(element.querySelector('.toast-title')!).fontSize),
          mensaje: Number.parseFloat(getComputedStyle(element.querySelector('.toast-text')!).fontSize)
        }));
        expect(tamanosTexto.titulo, `Título del toast legible a ${width}px / ${theme}`).toBeGreaterThanOrEqual(14);
        expect(tamanosTexto.mensaje, `Mensaje del toast legible a ${width}px / ${theme}`).toBeGreaterThanOrEqual(14);
        await verificarToastMovil();

        await controlPoblado.evaluate((element) => element.blur());
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(50);
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-toast-flow-scroll-top-debug-${width}-${theme}.png`), fullPage: false, animations: 'disabled' });
        await verificarToastMovil();
        await viewport.scrollIntoViewIfNeeded();
        await expect(warning).toBeInViewport();
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-toast-${width}-${theme}.png`),
          fullPage: false,
          animations: 'disabled'
        });
        await controlPoblado.focus();
        await page.waitForTimeout(50);
        await verificarToastMovil();
        await assertNoHorizontalOverflow(page, `Toasts con lista ficticia a ${width}px / ${theme}`);
        await expect(page.getByText('Ana Alumna de Prueba')).toBeVisible();
        await expect(warning).toBeVisible();
        await expect(warning.getByRole('button', { name: 'Continuar' })).toBeVisible();
        const controlsFit = await warning.evaluate((element) => {
          const toast = element.getBoundingClientRect();
          const controls = [...element.querySelectorAll<HTMLElement>('button')].map((button) => button.getBoundingClientRect());
          return toast.left >= 0 && toast.right <= window.innerWidth
            && controls.every((rect) => rect.width >= 44 && rect.height >= 44
              && rect.left >= toast.left && rect.right <= toast.right && rect.top >= toast.top && rect.bottom <= toast.bottom);
        });
        expect(controlsFit, `Acciones del toast de al menos 44×44 px dentro de la tarjeta a ${width}px / ${theme}`).toBe(true);
        await warning.screenshot({
          path: supplementalEvidencePath(`ux-audit-toast-actions-${width}-${theme}.png`),
          animations: 'disabled'
        });
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(50);
      const viewport = page.locator('.toast-viewport');
      await expect(viewport).toBeVisible();
      await expect(page.getByRole('group', { name: 'Cambios guardados' })).toBeVisible();
      const rect = await viewport.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { position: getComputedStyle(element).position, placement: (element as HTMLElement).dataset.placement || '', left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      });
      expect(rect.position).toBe(rect.placement === 'flow' ? 'relative' : 'fixed');
      if (rect.placement !== 'flow' || await page.evaluate(() => window.scrollY <= 1)) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(1440);
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(900);
      }
      const warning = page.getByRole('group', { name: 'Sesión próxima a vencer' });
      await expect(warning.getByRole('button', { name: 'Continuar' })).toBeVisible();
      const legibilidadMensaje = await warning.evaluate((element) => {
        const cajaToast = element.getBoundingClientRect();
        const cuerpo = element.querySelector<HTMLElement>('.toast-body');
        const mensaje = element.querySelector<HTMLElement>('.toast-text');
        if (!cuerpo || !mensaje) return { proporcionAncho: 0, lineas: Number.POSITIVE_INFINITY };
        const rango = document.createRange();
        rango.selectNodeContents(mensaje);
        return {
          proporcionAncho: cuerpo.getBoundingClientRect().width / Math.max(1, cajaToast.width),
          lineas: rango.getClientRects().length
        };
      });
      expect(legibilidadMensaje.proporcionAncho, 'Las acciones no deben reducir el mensaje del toast a una columna estrecha').toBeGreaterThanOrEqual(0.75);
      expect(legibilidadMensaje.lineas, 'El mensaje del toast con acciones debe leerse en tres líneas o menos a 1440 px').toBeLessThanOrEqual(3);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-toast-1440-${theme}.png`),
        fullPage: false,
        animations: 'disabled'
      });
      await controlPoblado.evaluate((element) => element.blur());
      await controlPoblado.focus();
      await page.waitForTimeout(50);
      await expect(controlPoblado).toBeFocused();
      const coberturaControl = await Promise.all([
        viewport.boundingBox(),
        controlPoblado.boundingBox()
      ]);
      const interseccion = await viewport.evaluate((element, box) => {
        const viewportToast = element.getBoundingClientRect();
        if (!box) return 1;
        const area = Math.max(0, Math.min(viewportToast.right, box.x + box.width) - Math.max(viewportToast.left, box.x))
          * Math.max(0, Math.min(viewportToast.bottom, box.y + box.height) - Math.max(viewportToast.top, box.y));
        return area / Math.max(1, box.width * box.height);
      }, coberturaControl[1] ?? null);
      expect(interseccion, 'el toast no debe ocultar el control enfocado de la pantalla poblada').toBeLessThan(1);
      const controlesTotalmenteCubiertos = await page.evaluate(() => {
        const toast = document.querySelector('.toast-viewport');
        if (!(toast instanceof HTMLElement)) return ['viewport de notificaciones ausente'];
        const cajaToast = toast.getBoundingClientRect();
        return Array.from(document.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [role="button"], [role="link"]'
        )).filter((control) => {
          if (toast.contains(control) || control.closest('[aria-hidden="true"]')) return false;
          const estilo = getComputedStyle(control);
          if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) return false;
          const caja = control.getBoundingClientRect();
          if (caja.width <= 0 || caja.height <= 0) return false;
          const interseccion = Math.max(0, Math.min(cajaToast.right, caja.right) - Math.max(cajaToast.left, caja.left))
            * Math.max(0, Math.min(cajaToast.bottom, caja.bottom) - Math.max(cajaToast.top, caja.top));
          return interseccion / (caja.width * caja.height) >= 0.99;
        }).map((control) => control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName);
      });
      expect(controlesTotalmenteCubiertos, 'ningún control visible de la página debe quedar totalmente detrás del toast').toEqual([]);
    }
    const accionContinuar = page.getByRole('group', { name: 'Sesión próxima a vencer' }).getByRole('button', { name: 'Continuar' });
    await accionContinuar.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Sesión próxima a vencer' })).toHaveCount(0);
    const toastGuardado = page.getByRole('group', { name: 'Cambios guardados' });
    await toastGuardado.getByRole('button', { name: 'Cerrar notificación: Cambios guardados' }).click();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('app:toast', { detail: {
      level: 'info',
      title: 'Sesión por vencer',
      message: 'Renueva el acceso para continuar.',
      persistent: true,
      action: { label: 'Renovar sesión', onClick: async () => { throw new Error('C:\\private\\installer\\token=secreto'); } }
    } })));
    await page.getByRole('group', { name: 'Sesión por vencer' }).getByRole('button', { name: 'Renovar sesión' }).click();
    const errorAccionToast = page.getByRole('group', { name: 'No se pudo completar la acción' });
    await expect(errorAccionToast).toBeVisible();
    await expect(errorAccionToast).toContainText('Verifica el resultado antes de volver a intentarlo');
    await expect(errorAccionToast).not.toContainText('token=secreto');
    await assertNoHorizontalOverflow(page, 'Rechazo seguro de una acción de toast a 320px');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await errorAccionToast.screenshot({
        path: supplementalEvidencePath(`ux-audit-toast-action-error-320-${theme}.png`),
        animations: 'disabled'
      });
    }

    await errorAccionToast.getByRole('button', { name: /Cerrar notificación/ }).click();

    await page.locator('#navegacion-docente-movil').selectOption('calificaciones');
    await expect(page.getByRole('heading', { name: 'Calificaciones' })).toBeVisible();
    await page.locator('#calificaciones-espacio-movil').selectOption('operacion');
    await expect(page.getByRole('heading', { name: 'Revisión y captura' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.45)));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('app:toast', { detail: {
      id: 'ux-toast-flow-calificaciones-dummy', level: 'warn', title: 'Sesión próxima a vencer',
      message: 'Guarda tu trabajo y vuelve a conectarte para continuar.', persistent: true,
      action: { label: 'Continuar', onClick: () => undefined },
      secondaryAction: { label: 'Después', onClick: () => undefined }
    } })));
    const avisoFlujoCalificaciones = page.getByRole('group', { name: 'Sesión próxima a vencer' });
    const viewportFlujoCalificaciones = page.getByRole('region', { name: 'Notificaciones' });
    await expect(viewportFlujoCalificaciones).toHaveAttribute('data-placement', 'flow');
    await expect(avisoFlujoCalificaciones).toBeVisible();
    const geometriaFlujoCalificaciones = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('.toast-host');
      const region = document.querySelector<HTMLElement>('.toast-viewport');
      if (!host || !region) return null;
      const rect = region.getBoundingClientRect();
      const controlesCubiertos = [...document.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [role="button"], [role="link"]'
      )].filter((control) => {
        if (region.contains(control) || control.closest('[aria-hidden="true"')) return false;
        const controlRect = control.getBoundingClientRect();
        const estilo = getComputedStyle(control);
        if (controlRect.width <= 0 || controlRect.height <= 0 || estilo.display === 'none' || estilo.visibility === 'hidden') return false;
        const interseccion = Math.max(0, Math.min(rect.right, controlRect.right) - Math.max(rect.left, controlRect.left))
          * Math.max(0, Math.min(rect.bottom, controlRect.bottom) - Math.max(rect.top, controlRect.top));
        return interseccion / Math.max(1, controlRect.width * controlRect.height) >= 0.99;
      });
      return {
        top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height,
        altoViewport: window.innerHeight,
        hostDentroDeCalificaciones: Boolean(host.closest('.calificaciones-experience')),
        controlesCubiertos: controlesCubiertos.map((control) => control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName)
      };
    });
    expect(geometriaFlujoCalificaciones, 'el fallback debe tener un host dentro del contenido docente visible').not.toBeNull();
    expect(geometriaFlujoCalificaciones!.hostDentroDeCalificaciones).toBe(true);
    expect(geometriaFlujoCalificaciones!.top, 'el toast en flujo debe aparecer en el viewport actual').toBeGreaterThanOrEqual(0);
    expect(geometriaFlujoCalificaciones!.bottom, 'el toast en flujo debe caber en el viewport actual').toBeLessThanOrEqual(geometriaFlujoCalificaciones!.altoViewport);
    expect(geometriaFlujoCalificaciones!.controlesCubiertos, 'el host en flujo no debe cubrir controles').toEqual([]);
    await assertNoHorizontalOverflow(page, 'Toast en flujo junto a Revisión y captura a 320px');
    await page.screenshot({
      path: supplementalEvidencePath('ux-audit-toast-calificaciones-flow-320-light.png'),
      fullPage: false,
      animations: 'disabled'
    });
  });

  test('captura Resultados sin materia y con registros sintéticos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-calificaciones-dummy'));
    let analisisOcrDummy = 0;
    const escriturasCalificacion = [] as string[];
    page.on('request', (request) => {
      if (request.url().includes('/api/calificaciones/calificar')) {
        const payload = request.postDataJSON() as { soloPreview?: boolean } | null;
        if (payload?.soloPreview !== true) escriturasCalificacion.push(request.method());
      }
    });
    await page.route('**/api/calificaciones/calificar', async (route) => {
      const payload = route.request().postDataJSON() as { aciertos?: number; soloPreview?: boolean; totalReactivos?: number };
      if (!payload.soloPreview) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ mensaje: 'La prueba bloquea cualquier escritura de calificación.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preview: {
          aciertos: payload.aciertos ?? 0,
          totalReactivos: payload.totalReactivos ?? 2,
          calificacionExamenFinalTexto: '0.00',
          bonoGuiaEstudio: {
            bonoAplicado: '0',
            excluidoPorDocente: false,
            evidencia: {
              estado: 'no_detectado', bonoSugerido: 0.25, confianza: 12, lecturas: [],
              numeroPagina: 1, region: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
              versionDetector: 'fixture-1', motivo: 'La marca no se detectó en el ejemplo.'
            }
          }
        } })
      });
    });
    await page.route('**/api/omr/analizar', async (route) => {
      analisisOcrDummy += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          examenId: 'examen-omr-dummy',
          folio: 'FOLIO-OMR-DUMMY',
          numeroPagina: 1,
          alumnoId: 'alumno-calificaciones-dummy',
          resultado: {
            estadoAnalisis: 'requiere_revision',
            calidadPagina: 0.91,
            confianzaPromedioPagina: 0.72,
            ratioAmbiguas: 0.5,
            templateVersionDetectada: 4,
            motivosRevision: ['Una respuesta ambigua requiere verificación.'],
            advertencias: ['Confirma las respuestas dudosas con la imagen original.'],
            respuestasDetectadas: [
              { numeroPregunta: 1, opcion: 'A', confianza: 0.94, estadoRespuesta: 'respondida', flags: [] },
              { numeroPregunta: 2, opcion: null, confianza: 0.5, estadoRespuesta: 'ambigua', flags: ['doble_marca'] }
            ],
            resumenRespuestas: {
              totalReactivos: 2,
              reactivosRespondidos: 1,
              reactivosSinMarca: 0,
              reactivosAmbiguos: 1,
              reactivosInvalidos: 0,
              examenVacio: false,
              examenVacioProbable: false,
              estadoExamen: 'requiere_revision'
            }
          }
        })
      });
    });
    await page.route('**/api/analiticas/eventos-uso', async (route) => {
      await route.fulfill({ status: 204 });
    });
    let exponerMateria = false;
    await page.route('**/api/periodos**', async (route) => {
      const archived = new URL(route.request().url()).searchParams.get('activo') === '0';
      const periodos = archived || !exponerMateria ? [] : [{
        _id: 'periodo-calificaciones-dummy', nombre: 'Materia de demostración', grupos: ['2A'], activo: true
      }];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos }) });
    });
    await page.route('**/api/analiticas/lista-academica**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas: [{
        alumnoId: 'alumno-calificaciones-dummy', matricula: 'DUMMY-001', apellidoPaterno: 'Ejemplo',
        apellidoMaterno: '', nombre: 'Alex', grupo: '2A', parcial1: '8.5', parcial2: '9.0',
        global: '9.2', final: '8.9', bonoExtracurricular: '0', observaciones: ''
      }] }) });
    });
    await page.route('**/api/alumnos**', async (route) => {
      const alumnos = !exponerMateria ? [] : [{
        _id: 'alumno-calificaciones-dummy', matricula: 'DUMMY-001', apellidoPaterno: 'Ejemplo',
        apellidoMaterno: '', nombre: 'Alex', nombreCompleto: 'Alex Ejemplo', grupo: '2A', periodoId: 'periodo-calificaciones-dummy'
      }];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos }) });
    });
    await page.route('**/api/examenes/generados**', async (route) => {
      const url = new URL(route.request().url());
      if (!exponerMateria) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ examenes: [], nextCursor: null }) });
        return;
      }
      if (url.pathname.endsWith('/folio/FOLIO-OMR-DUMMY')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ examen: {
          _id: 'examen-omr-dummy', alumnoId: 'alumno-calificaciones-dummy', periodoId: 'periodo-calificaciones-dummy',
          folio: 'FOLIO-OMR-DUMMY', answerKeySet: { A: [
            { numeroPregunta: 1, correcta: 'A' }, { numeroPregunta: 2, correcta: 'B' }
          ] }
        } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ examenes: [{
        _id: 'examen-omr-dummy', alumnoId: 'alumno-calificaciones-dummy', periodoId: 'periodo-calificaciones-dummy',
        folio: 'FOLIO-OMR-DUMMY', estado: 'entregado', tipoExamen: 'parcial', plantillaTitulo: 'Evaluación de demostración'
      }], nextCursor: null }) });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espacios = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await expect(espacios.getByLabel('Espacio de calificaciones')).toBeHidden();
    await expect(espacios.locator('.calificaciones-workspace-nav__desktop')).toBeVisible();
    const columnasNavegacion390 = await espacios.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(columnasNavegacion390, 'Los accesos internos deben reducir el desplazamiento vertical a 390 px').toBe(2);
    const ultimoAccesoCompleto = await espacios.locator('button').last().evaluate((button) =>
      getComputedStyle(button).gridColumnStart === '1' && getComputedStyle(button).gridColumnEnd === '-1'
    );
    expect(ultimoAccesoCompleto, 'El quinto acceso debe conservar ancho suficiente en la cuadrícula compacta').toBe(true);
    const resultados = espacios.getByRole('button', { name: /Resultados/ });
    await resultados.focus();
    await page.keyboard.press('Tab');
    await expect(espacios.getByRole('button', { name: /Extraordinarios/ })).toBeFocused();
    await resultados.focus();
    await expect(resultados).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Selecciona una materia para consultar sus calificaciones.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filtrar alumnos' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Selecciona una materia para activar los filtros.')).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await assertNoHorizontalOverflow(page, `Calificaciones sin materia 390px / ${theme}`);
      await assertVisibleHeadersFit(page, `Calificaciones sin materia 390px / ${theme}`);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-calificaciones-sin-materia-390-${theme}.png`),
        fullPage: true,
        animations: 'disabled'
      });
    }

    exponerMateria = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navRecargado = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await navRecargado.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    await expect(page.getByRole('heading', { name: 'Resultados por alumno' })).toBeVisible();
    await page.locator('.calificaciones-consulta').getByLabel('Materia').selectOption('periodo-calificaciones-dummy');
    await expect(page.locator('.calificaciones-consulta').getByLabel('Materia')).toHaveAccessibleDescription('Materia seleccionada: Materia de demostración');
    await expect(page.locator('.calificaciones-consulta').getByText('Materia seleccionada: Materia de demostración')).toBeVisible();
    await expect(page.getByText('Ejemplo Alex')).toBeVisible();
    await expect(page.getByText('1 alumno en la materia')).toHaveCount(0);
    await expect(page.locator('.calificaciones-consulta__summary')).toHaveCount(0);
    await expect(page.locator('.calificaciones-consulta__result-meta [role="status"]')).toHaveText('Todos los alumnos · 1 visible');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--preguntas .banco-mini-kpi__num')).toHaveText('1');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--paginas .banco-mini-kpi__num')).toHaveText('1');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--sintema .banco-mini-kpi__num')).toHaveText('0');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--reactivos .banco-mini-kpi__num')).toHaveText('0');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--paginas .banco-mini-kpi__lbl')).toHaveText('Con calificación');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--sintema .banco-mini-kpi__lbl')).toHaveText('Sin calificación');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--reactivos .banco-mini-kpi__lbl')).toHaveText('Páginas OMR procesadas');
    await expect(page.locator('.calificaciones-experience .calificaciones-kpi--aclaraciones .banco-mini-kpi__icon svg')).toHaveAttribute('data-icono', 'aclaraciones');
    await expect(page.locator('.calificaciones-experience .banco-mini-kpi--paginas .banco-mini-kpi__icon svg')).toHaveAttribute('data-icono', 'ok');
    const filtros = page.getByRole('group', { name: 'Filtrar alumnos' });
    await expect(filtros).toHaveAttribute('aria-disabled', 'false');
    await expect(filtros.getByRole('button', { name: 'Con calificación' })).toBeVisible();
    await expect(filtros.getByRole('button', { name: 'Sin calificación' })).toBeVisible();
    await expect(page.locator('.calificaciones-consulta__table tbody .calificaciones-consulta__status')).toHaveText('Con calificación');
    const kpiContainer = await page.locator('.calificaciones-experience .banco-header-kpis').boundingBox();
    const paginasProcesadas = await page.locator('.calificaciones-experience .banco-mini-kpi--reactivos').boundingBox();
    expect(kpiContainer && paginasProcesadas && paginasProcesadas.width >= kpiContainer.width - 1,
      'El KPI Páginas procesadas debe ocupar la fila completa en móvil').toBe(true);
    expect(paginasProcesadas?.height).toBeLessThan(80);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await assertRenderedTextContrast(
        page.locator('.calificaciones-experience .calificaciones-kpi--aclaraciones .banco-mini-kpi__icon svg'),
        `Icono de aclaraciones ${theme}`
      );
      const estadoFila = page.locator('.calificaciones-consulta__table tbody .calificaciones-consulta__status');
      await estadoFila.evaluate(async (element) => {
        const targets: Element[] = [];
        for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) targets.push(current);
        await Promise.all(targets.flatMap((target) => target.getAnimations()).map((animation) => animation.finished.catch(() => undefined)));
      });
      await assertRenderedTextContrast(estadoFila, `Estado «Con calificación» ${theme}`);
      await assertNoHorizontalOverflow(page, `Calificaciones con materia 390px / ${theme}`);
      await assertVisibleHeadersFit(page, `Calificaciones con materia 390px / ${theme}`);
      const etiquetasNavegacion = await page.locator('.calificaciones-workspace-nav button > span:not(.calificaciones-workspace-nav__index)').evaluateAll((contenedores) =>
        contenedores.flatMap((contenedor) => [...contenedor.querySelectorAll('strong, small')].map((etiqueta) => ({
          texto: etiqueta.textContent?.trim() ?? '',
          anchoContenido: etiqueta.scrollWidth,
          anchoVisible: etiqueta.clientWidth
        })))
      );
      expect(etiquetasNavegacion.length).toBeGreaterThan(0);
      for (const etiqueta of etiquetasNavegacion) {
        expect(etiqueta.anchoContenido, `La etiqueta «${etiqueta.texto}» no se recorta a 390px / ${theme}`).toBeLessThanOrEqual(etiqueta.anchoVisible);
      }
      const columnasTarjeta = await page.locator('.calificaciones-consulta__table tbody tr').evaluate((row) =>
        getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/).length
      );
      expect(columnasTarjeta, 'La tarjeta conserva dos columnas cuando caben etiquetas y valores').toBe(2);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-calificaciones-fixture-390-${theme}.png`),
        fullPage: true,
        animations: 'disabled'
      });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(espacios.getByLabel('Espacio de calificaciones')).toBeVisible();
    await expect(espacios.locator('.calificaciones-workspace-nav__desktop')).toBeHidden();
    await assertNoHorizontalOverflow(page, 'Selector interno a 360px');
    await page.setViewportSize({ width: 320, height: 800 });
    const selectorEspacioMovil = espacios.getByLabel('Espacio de calificaciones');
    const etiquetaEspacioMovil = espacios.locator('.calificaciones-workspace-nav__mobile-label');
    await expect(selectorEspacioMovil).toBeVisible();
    await expect(espacios.locator('.calificaciones-workspace-nav__desktop')).toBeHidden();
    await expect(selectorEspacioMovil.locator('option')).toHaveCount(5);
    await expect(selectorEspacioMovil.locator('option:checked')).toHaveText('Resultados');
    const alturaNavegacionMovil = await espacios.evaluate((element) => element.getBoundingClientRect().height);
    expect(alturaNavegacionMovil, 'La navegación estrecha debe conservar acceso a cinco vistas en un bloque compacto').toBeLessThan(112);
    await assertRenderedTextContrast(etiquetaEspacioMovil, 'Etiqueta del selector móvil de Calificaciones');
    await assertRenderedTextContrast(selectorEspacioMovil, 'Texto del selector móvil de Calificaciones');
    await selectorEspacioMovil.focus();
    const medirFocoSelectorMovil = () => selectorEspacioMovil.evaluate((element) => {
      const style = getComputedStyle(element);
      const parse = (color: string) => {
        const srgb = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
        if (srgb) return { channels: [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255], alpha: Number(srgb[4] ?? 1) };
        const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
        const alpha = Number(color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)/)?.[1] ?? 1);
        return { channels, alpha };
      };
      const composite = (foreground: ReturnType<typeof parse>, background: number[]) => foreground.channels.map((channel, index) => channel * foreground.alpha + background[index]! * (1 - foreground.alpha));
      const ancestors: Element[] = [];
      for (let current = element.parentElement; current && current !== document.body; current = current.parentElement) ancestors.push(current);
      let background = parse(getComputedStyle(document.body).backgroundColor).channels;
      for (const ancestor of ancestors.reverse()) background = composite(parse(getComputedStyle(ancestor).backgroundColor), background);
      const luminance = (channels: number[]) => channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
      const outlineLuminance = luminance(parse(style.outlineColor).channels);
      const backgroundLuminance = luminance(background);
      return {
        height: element.getBoundingClientRect().height,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        outlineContrast: (Math.max(outlineLuminance, backgroundLuminance) + 0.05) / (Math.min(outlineLuminance, backgroundLuminance) + 0.05)
      };
    });
    const focoSelectorMovil = await medirFocoSelectorMovil();
    expect(focoSelectorMovil.height, 'El selector móvil conserva el tamaño táctil mínimo').toBeGreaterThanOrEqual(44);
    expect(focoSelectorMovil.outlineWidth).toBe('3px');
    expect(focoSelectorMovil.outlineStyle).toBe('solid');
    expect(focoSelectorMovil.outlineContrast, 'El foco visible del selector cumple 3:1 contra la superficie adyacente').toBeGreaterThanOrEqual(3);
    await page.keyboard.press('ArrowDown');
    await expect(selectorEspacioMovil).toHaveValue('extraordinarios');
    await expect(page.getByRole('heading', { name: 'Extraordinarios' })).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await expect(selectorEspacioMovil).toHaveValue('resultados');
    await expect(page.getByRole('heading', { name: 'Resultados por alumno' })).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await assertRenderedTextContrast(etiquetaEspacioMovil, `Etiqueta del selector móvil / ${theme}`);
      await assertRenderedTextContrast(selectorEspacioMovil, `Texto del selector móvil / ${theme}`);
      const focoTema = await medirFocoSelectorMovil();
      expect(focoTema.outlineContrast, `El foco del selector cumple 3:1 en tema ${theme}`).toBeGreaterThanOrEqual(3);
      const estadoFila = page.locator('.calificaciones-consulta__table tbody .calificaciones-consulta__status');
      await estadoFila.evaluate(async (element) => {
        const targets: Element[] = [];
        for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) targets.push(current);
        await Promise.all(targets.flatMap((target) => target.getAnimations()).map((animation) => animation.finished.catch(() => undefined)));
      });
      await assertRenderedTextContrast(estadoFila, `Estado «Con calificación» 320px / ${theme}`);
      await assertNoHorizontalOverflow(page, `Calificaciones con fixture dummy a 320px / ${theme}`);
      await assertVisibleHeadersFit(page, `Calificaciones con fixture dummy a 320px / ${theme}`);
      const columnasTarjeta = await page.locator('.calificaciones-consulta__table tbody tr').evaluate((row) =>
        getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/).length
      );
      expect(columnasTarjeta, 'La tarjeta apila cada etiqueta y calificación a 320px').toBe(1);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-calificaciones-fixture-320-${theme}.png`),
        fullPage: true,
        animations: 'disabled'
      });
    }

    const filtrosResultados = page.getByRole('group', { name: 'Filtrar alumnos' });
    const buscarResultado = page.getByRole('searchbox', { name: 'Buscar alumno' });
    await filtrosResultados.getByRole('button', { name: 'Sin calificación' }).click();
    await buscarResultado.fill('sin-coincidencias');
    const estadoSinResultados = page.locator('.calificaciones-consulta__no-results').getByRole('status');
    await expect(estadoSinResultados).toHaveText('No hay alumnos que coincidan con «sin-coincidencias» con los filtros actuales.');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await page.waitForTimeout(300);
        await assertNoHorizontalOverflow(page, `Búsqueda sin coincidencias ${width}px / ${theme}`);
        await expect(estadoSinResultados).toBeVisible();
        await expect(page.locator('.calificaciones-experience .banco-header-kpis .banco-mini-kpi__num')).toHaveCount(5);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-busqueda-vacia-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
    await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
    await expect(buscarResultado).toHaveValue('');
    await expect(filtrosResultados.getByRole('button', { name: 'Sin calificación' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Ejemplo Alex')).toHaveCount(0);
    await filtrosResultados.getByRole('button', { name: 'Todos' }).click();
    await expect(page.getByText('Ejemplo Alex')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const botonDetalle = page.getByRole('button', { name: 'Ver detalle de Ejemplo Alex' });
    await botonDetalle.focus();
    await page.keyboard.press('Enter');
    const panelDetalle = page.locator('.calificaciones-consulta__detail');
    await expect(panelDetalle).toBeFocused();
    await expect(panelDetalle.getByRole('heading', { name: 'Ejemplo Alex' })).toBeVisible();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await assertNoHorizontalOverflow(page, `Detalle de calificaciones ${width}px`);
      const navGeometria = await panelDetalle.locator('.calificaciones-consulta__detail-nav').evaluate((nav) => {
        const navRect = nav.getBoundingClientRect();
        const buttons = [...nav.querySelectorAll('button')];
        return buttons.map((button) => {
          const buttonRect = button.getBoundingClientRect();
          const label = button.querySelector('span');
          const labelRect = label?.getBoundingClientRect();
          return {
            text: label?.textContent?.trim() ?? '',
            button: { left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom },
            nav: { left: navRect.left, right: navRect.right, top: navRect.top, bottom: navRect.bottom },
            label: labelRect ? { left: labelRect.left, right: labelRect.right, top: labelRect.top, bottom: labelRect.bottom, scrollWidth: label.scrollWidth, clientWidth: label.clientWidth } : null
          };
        });
      });
      expect(navGeometria, `Las cinco secciones del detalle deben estar visibles a ${width}px`).toHaveLength(5);
      for (const [index, item] of navGeometria.entries()) {
        expect(item.button.left, `La pestaña ${item.text} debe quedar dentro de la navegación a ${width}px`).toBeGreaterThanOrEqual(item.nav.left);
        expect(item.button.right, `La pestaña ${item.text} debe quedar dentro de la navegación a ${width}px`).toBeLessThanOrEqual(item.nav.right);
        expect(item.label?.left, `El texto de ${item.text} debe quedar dentro de su botón a ${width}px`).toBeGreaterThanOrEqual(item.button.left);
        expect(item.label?.right, `El texto de ${item.text} debe quedar dentro de su botón a ${width}px`).toBeLessThanOrEqual(item.button.right);
        for (const previous of navGeometria.slice(0, index)) {
          const seSolapa = item.button.left < previous.button.right && item.button.right > previous.button.left
            && item.button.top < previous.button.bottom && item.button.bottom > previous.button.top;
          expect(seSolapa, `Las pestañas ${previous.text} y ${item.text} no deben solaparse a ${width}px`).toBe(false);
        }
      }
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Detalle de calificaciones ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-detalle-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
      const columnasDetalle = await panelDetalle.locator('.calificaciones-consulta__physical-grades .calificaciones-consulta__detail-grid').evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
      );
      expect(columnasDetalle, `Columnas físicas de calificaciones a ${width}px`).toBe(1);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    const libroCompleto = panelDetalle.getByRole('button', { name: 'Libro completo' });
    await libroCompleto.focus();
    await page.keyboard.press('Enter');
    await expect(libroCompleto).toHaveAttribute('aria-pressed', 'true');
    const libro = panelDetalle.getByRole('region', { name: 'Lista Excel · columnas AJ a BB' });
    await expect(libro).toBeVisible();
    await expect(libro.getByText(/Sin dato.*no equivale a cero/)).toBeVisible();
    const bonoLibro = libro.locator('dl div').filter({ hasText: 'BB · Bono extracurricular otorgado' });
    await expect(bonoLibro.locator('dd')).toHaveText('0 0–0.5');
    const columnasSinDato = libro.locator('.calificaciones-consulta__book-missing');
    const disclosureSinDato = columnasSinDato.locator('summary');
    const primerDatoVacio = columnasSinDato.locator('dd').first();
    await expect(disclosureSinDato).toHaveText('Columnas sin dato (18)');
    await expect(columnasSinDato).not.toHaveAttribute('open', '');
    await expect(primerDatoVacio).not.toBeVisible();
    await page.screenshot({
      path: supplementalEvidencePath('ux-audit-calificaciones-libro-completo-390-light.png'),
      fullPage: true,
      animations: 'disabled'
    });
    await disclosureSinDato.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => columnasSinDato.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);
    await expect(primerDatoVacio).toContainText('Sin dato');
    await expect(primerDatoVacio).toBeVisible();
    await page.screenshot({
      path: supplementalEvidencePath('ux-audit-calificaciones-columnas-sin-dato-390-light.png'),
      fullPage: true,
      animations: 'disabled'
    });
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();
    await expect(botonDetalle).toBeFocused();

    await botonDetalle.click();
    const detalleManual = page.locator('.calificaciones-consulta__detail');
    await expect(detalleManual.getByRole('heading', { name: 'Ejemplo Alex' })).toBeVisible();
    await detalleManual.getByRole('navigation', { name: 'Secciones del detalle académico' }).getByRole('button', { name: 'Resumen' }).click();
    await detalleManual.getByRole('button', { name: 'Abrir revisión manual' }).click();
    const panelManual = page.locator('#calificacion-detalle-manual');
    await expect(panelManual.getByLabel('Alumno')).toHaveValue('alumno-calificaciones-dummy');
    await panelManual.getByLabel('Examen entregado o calificado').selectOption('examen-omr-dummy');
    await panelManual.getByRole('button', { name: 'Usar examen para calificación manual' }).click();
    const tarjetaCalificacion = page.locator('.calif-grade-card');
    await expect(tarjetaCalificacion.getByRole('heading', { name: /Calificar examen/ })).toBeVisible();
    await expect(tarjetaCalificacion.getByText('Registra los aciertos de la revisión física y revisa la nota antes de guardar.')).toBeVisible();
    await expect(tarjetaCalificacion.getByText('La nota usa los aciertos que registres sobre el total de reactivos.')).toBeVisible();
    await expect(tarjetaCalificacion.getByText('La calificación se calcula automáticamente a partir de resultados OMR confirmados.')).toHaveCount(0);
    const campoAciertos = tarjetaCalificacion.getByRole('spinbutton', { name: 'Aciertos obtenidos' });
    const accionCalificacionManual = tarjetaCalificacion.getByRole('button', { name: /Analizar marca y previsualizar|Guardar calificación/ });
    await expect(campoAciertos).toHaveValue('');
    await expect(campoAciertos).toHaveAttribute('min', '0');
    await expect(campoAciertos).toHaveAttribute('max', '2');
    await expect(tarjetaCalificacion.getByText('Reactivos del examen: 2')).toBeVisible();
    await expect(tarjetaCalificacion.getByText('Aciertos: pendiente/2')).toBeVisible();
    await expect(tarjetaCalificacion.getByText('Calificación final: pendiente / 5.00')).toBeVisible();
    await expect(accionCalificacionManual).toBeDisabled();
    await expect(accionCalificacionManual).toHaveAccessibleDescription(/Cuenta los reactivos correctos/);
    await assertDisabledButtonContrast(accionCalificacionManual, 'Vista previa bloqueada hasta capturar aciertos');
    await campoAciertos.fill('3');
    await expect(tarjetaCalificacion.getByRole('alert')).toHaveText('Captura un número entero entre 0 y 2.');
    await expect(accionCalificacionManual).toBeDisabled();
    await campoAciertos.fill('1');
    await expect(tarjetaCalificacion.getByText('Aciertos: 1/2')).toBeVisible();
    await expect(tarjetaCalificacion.getByText('Calificación final: 2.50 / 5.00')).toBeVisible();
    await expect(accionCalificacionManual).toBeEnabled();
    await campoAciertos.fill('0');
    const confirmarSinRespuestas = tarjetaCalificacion.getByRole('checkbox', { name: 'Confirmo guardar 0 aciertos' });
    const cajaConfirmacion = await confirmarSinRespuestas.boundingBox();
    expect(cajaConfirmacion?.width).toBeLessThanOrEqual(24);
    expect(cajaConfirmacion?.height).toBeLessThanOrEqual(24);
    await expect(tarjetaCalificacion.getByText(/Registraste 0 aciertos\. Se guardará 0\.00 \/ 5\.00\./)).toBeVisible();
    await expect(confirmarSinRespuestas).not.toBeChecked();
    await expect(accionCalificacionManual).toBeDisabled();
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await tarjetaCalificacion.screenshot({
      path: supplementalEvidencePath('ux-audit-calificar-manual-cero-confirmacion-320-light.png'),
      animations: 'disabled'
    });
    await confirmarSinRespuestas.focus();
    await page.keyboard.press('Space');
    await expect(accionCalificacionManual).toBeEnabled();
    const bonoSinRespuestas = tarjetaCalificacion.getByRole('checkbox', { name: /marca de guía/i });
    const cajaBono = await bonoSinRespuestas.boundingBox();
    expect(cajaBono?.width).toBeLessThanOrEqual(24);
    expect(cajaBono?.height).toBeLessThanOrEqual(24);
    await expect(bonoSinRespuestas).toBeDisabled();
    await expect(accionCalificacionManual).toBeEnabled();
    await expect(accionCalificacionManual).toHaveAccessibleName('Analizar marca y previsualizar');
    await accionCalificacionManual.click();
    await expect(accionCalificacionManual).toHaveAccessibleName('Guardar calificación');
    await expect(bonoSinRespuestas).toBeEnabled();
    await expect(bonoSinRespuestas).not.toBeChecked();
    await expect(accionCalificacionManual).toBeEnabled();
    expect(escriturasCalificacion, 'la vista previa no debe guardar la calificación').toEqual([]);
    await bonoSinRespuestas.check();
    await expect(tarjetaCalificacion.getByText(/Se guardará 0\.25 \/ 5\.00/)).toBeVisible();
    await bonoSinRespuestas.uncheck();
    await expect(accionCalificacionManual).toBeDisabled();
    await confirmarSinRespuestas.focus();
    await page.keyboard.press('Space');
    await expect(accionCalificacionManual).toBeEnabled();
    await page.keyboard.press('Space');
    await expect(accionCalificacionManual).toBeDisabled();
    await campoAciertos.fill('1');
    await expect(accionCalificacionManual).toBeEnabled();
    const ayudaCalificacion = tarjetaCalificacion.locator('details.colapsable');
    const resumenAyuda = ayudaCalificacion.locator('summary');
    await expect(resumenAyuda).toHaveText('Ayuda para calificar');
    await resumenAyuda.focus();
    await expect(resumenAyuda).toHaveCSS('outline-style', 'solid');
    await expect(resumenAyuda).toHaveCSS('outline-width', '3px');
    await expect(resumenAyuda).toHaveCSS('outline-offset', '3px');
    await page.keyboard.press('Enter');
    await expect(ayudaCalificacion).toHaveAttribute('open', '');
    await expect(resumenAyuda).toBeFocused();
    await expect(ayudaCalificacion.getByText('La calificación final se recalcula automáticamente sobre 5.00 e incluye bonus si está activo.')).toBeVisible();
    await expect(ayudaCalificacion.getByText('En la revisión manual registra el total de aciertos, no las opciones de cada reactivo.')).toBeVisible();
    await expect(ayudaCalificacion.getByText('Si se requiere revisión OMR, confirma las respuestas detectadas antes de guardar.')).toHaveCount(0);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Calificación manual sin resultado OMR ${width}px / ${theme}`);
        await tarjetaCalificacion.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificar-manual-sin-omr-${width}-${theme}.png`),
          animations: 'disabled'
        });
      }
    }

    await page.getByRole('button', { name: /Revisión y captura/i }).click();
    await expect(page.getByRole('heading', { name: 'Escaneo y revisión OMR' })).toBeVisible();
    const guiaCalificaciones = page.getByRole('button', { name: 'Ver guía rápida de calificaciones' });
    await expect(guiaCalificaciones).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('region', { name: 'Ayuda: Captura, revisión y calificación' })).toHaveCount(0);
    await expect(page.getByText('GUÍA RÁPIDA · Captura y revisión de calificaciones')).toBeHidden();
    const toggleGuiaOmr = page.getByRole('button', { name: 'Ver guía rápida de calificaciones' });
    await toggleGuiaOmr.focus();
    await page.keyboard.press('Space');
    const guiaExpandida = page.getByRole('button', { name: 'Ocultar guía rápida' });
    await expect(guiaExpandida).toHaveAttribute('aria-expanded', 'true');
    await expect(guiaExpandida).toBeFocused();
    await expect(page.getByRole('region', { name: 'Ayuda: Captura, revisión y calificación' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Ver guía rápida de calificaciones' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Ver guía rápida de calificaciones' })).toBeFocused();
    await page.getByRole('button', { name: 'Ver guía rápida de calificaciones' }).evaluate((button) => button.blur());
    const panelSolicitudes = page.locator('.calificaciones-revision-panel');
    const busquedaSolicitudes = panelSolicitudes.getByRole('textbox', { name: 'Buscar solicitud' });
    await expect(busquedaSolicitudes).toHaveAttribute('placeholder', 'Folio o palabra clave');
    await expect(busquedaSolicitudes).toHaveAccessibleDescription('Busca por folio, estado, pregunta o comentario.');
    const resumenSolicitudes = panelSolicitudes.locator('.banco-section-side-meta');
    const etiquetasResumen = resumenSolicitudes.locator('.banco-counter-tag');
    const capturaIndividual = page.locator('.calif-captura-card').first();
    const capturaLote = page.locator('.calif-captura-card').nth(1);
    await expect(capturaIndividual.getByLabel('Folio')).toBeVisible();
    await expect(capturaIndividual.getByLabel('Folio')).toHaveAttribute('placeholder', 'Auto QR o manual');
    await expect(capturaIndividual.getByLabel('Página')).toHaveAttribute('aria-describedby', 'calif-pagina-instrucciones');
    await expect(page.getByText(/0 intenta detectar el número con el QR/i)).toBeVisible();
    await expect(page.getByText('Cargar imagen o foto del examen')).toBeVisible();
    await expect(page.getByText('Cargar lote de imágenes escaneadas')).toBeVisible();
    await expect(capturaIndividual.getByText('Carga una imagen para habilitar el análisis.')).toBeVisible();
    const botonAnalizarPagina = capturaIndividual.getByRole('button', { name: 'Analizar página' });
    await expect(botonAnalizarPagina).toBeDisabled();
    await expect(botonAnalizarPagina).toHaveAccessibleDescription('Carga una imagen para habilitar el análisis.');
    await assertDisabledButtonContrast(botonAnalizarPagina, 'Analizar página deshabilitado en captura OMR');
    await expect(capturaLote.getByText('Carga uno o más archivos para habilitar el análisis del lote.')).toBeVisible();
    const botonAnalizarLote = capturaLote.getByRole('button', { name: 'Analizar lote (0)' });
    await expect(botonAnalizarLote).toBeDisabled();
    await expect(botonAnalizarLote).toHaveAccessibleDescription('Carga uno o más archivos para habilitar el análisis del lote.');
    await assertDisabledButtonContrast(botonAnalizarLote, 'Analizar lote deshabilitado en captura OMR');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        const coloresCarga = await capturaIndividual.locator('.calif-dropzone__title, .calif-dropzone__sub').evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).color)
        );
        expect(coloresCarga).toEqual(theme === 'light'
          ? ['rgb(15, 23, 42)', 'rgb(30, 41, 59)']
          : ['rgb(217, 232, 245)', 'rgb(217, 232, 245)']);
        await assertNoHorizontalOverflow(page, `Captura y revisión OMR ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Captura y revisión OMR ${width}px / ${theme}`);
        const etiquetasGeometria = await etiquetasResumen.evaluateAll((etiquetas) => {
          const resumen = etiquetas[0]?.parentElement;
          const resumenRect = resumen?.getBoundingClientRect();
          return etiquetas.map((etiqueta) => {
            const rect = etiqueta.getBoundingClientRect();
            return {
              texto: etiqueta.textContent?.trim() ?? '',
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              resumenLeft: resumenRect?.left ?? 0,
              resumenRight: resumenRect?.right ?? 0,
              whiteSpace: getComputedStyle(etiqueta).whiteSpace
            };
          });
        });
        expect(etiquetasGeometria, `Los tres conteos de solicitudes deben aparecer a ${width}px`).toHaveLength(3);
        for (const [index, etiqueta] of etiquetasGeometria.entries()) {
          expect(etiqueta.whiteSpace, `El conteo «${etiqueta.texto}» debe permanecer unido a ${width}px`).toBe('nowrap');
          expect(etiqueta.left, `El conteo «${etiqueta.texto}» debe quedar dentro del resumen a ${width}px`).toBeGreaterThanOrEqual(etiqueta.resumenLeft);
          expect(etiqueta.right, `El conteo «${etiqueta.texto}» debe quedar dentro del resumen a ${width}px`).toBeLessThanOrEqual(etiqueta.resumenRight);
          for (const previo of etiquetasGeometria.slice(0, index)) {
            const seSolapa = etiqueta.left < previo.right && etiqueta.right > previo.left
              && etiqueta.top < previo.bottom && etiqueta.bottom > previo.top;
            expect(seSolapa, `Los conteos «${previo.texto}» y «${etiqueta.texto}» no deben solaparse`).toBe(false);
          }
        }
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-omr-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
        await panelSolicitudes.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-solicitudes-${width}-${theme}.png`),
          animations: 'disabled'
        });
        await page.locator('.calif-captura-grid').evaluate((element) => element.scrollIntoView({ block: 'start' }));
        await capturaIndividual.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-omr-captura-${width}-${theme}.png`),
          animations: 'disabled'
        });
        await page.locator('.calif-captura-card').nth(1).evaluate((element) => element.scrollIntoView({ block: 'start' }));
        await page.locator('.calif-captura-card').nth(1).screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-omr-lote-${width}-${theme}.png`),
          animations: 'disabled'
        });
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await capturaIndividual.getByLabel(/Cargar imagen o foto del examen/i).setInputFiles({
      name: 'captura-sintetica-baja-calidad-folio-de-demostracion.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/+uoAAAAASUVORK5CYII=',
        'base64'
      )
    });
    await expect(capturaIndividual.getByText(/Ajusta la imagen antes de analizarla/i)).toBeVisible();
    await expect(capturaIndividual.getByText(/La imagen está borrosa\. Usa una imagen más nítida\./i)).toBeVisible();
    await expect(capturaIndividual.getByText('Archivo seleccionado: captura-sintetica-baja-calidad-folio-de-demostracion.png')).toBeVisible();
    await expect(capturaIndividual.getByText('Elegir otra imagen')).toBeVisible();
    await expect(capturaIndividual.getByRole('button', { name: 'Analizar página' })).toBeDisabled();
    await page.setViewportSize({ width: 320, height: 800 });
    await assertNoHorizontalOverflow(page, 'Captura OMR con archivo y calidad no apta 320px / tema claro');
    await capturaIndividual.scrollIntoViewIfNeeded();
    await capturaIndividual.screenshot({
      path: supplementalEvidencePath('ux-audit-calificaciones-omr-captura-calidad-no-apta-320-light.png'),
      animations: 'disabled'
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.getByRole('button', { name: 'Limpiar selección manual' }).click();
    await capturaIndividual.getByLabel('Folio').fill('FOLIO-OMR-DUMMY');
    await capturaIndividual.getByLabel('Página').fill('1');
    const imagenSinteticaBase64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1400;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo crear el lienzo sintético de OMR.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111';
      context.fillRect(80, 70, 840, 1260);
      context.fillStyle = '#fff';
      for (let y = 90; y < 1300; y += 32) {
        for (let x = 100; x < 900; x += 32) {
          context.fillRect(x, y, 15, 15);
        }
      }
      return canvas.toDataURL('image/png').split(',')[1] ?? '';
    });
    await capturaIndividual.getByLabel('Elegir otra imagen').setInputFiles({
      name: 'hoja-omr-dummy-alta-resolucion.png',
      mimeType: 'image/png',
      buffer: Buffer.from(imagenSinteticaBase64, 'base64')
    });
    await expect(capturaIndividual.getByText('La imagen está lista para analizar.')).toBeVisible();
    const botonAnalizarOmr = capturaIndividual.getByRole('button', { name: 'Analizar página' });
    await expect(botonAnalizarOmr).toBeEnabled();
    await botonAnalizarOmr.click();
    const mesaRevision = page.locator('.resultado').filter({
      has: page.getByRole('heading', { name: 'Mesa de revisión manual' })
    });
    await expect(mesaRevision.getByRole('heading', { name: 'Mesa de revisión manual' })).toBeVisible();
    await expect(mesaRevision.getByText('Confirma las respuestas dudosas con la imagen original.')).toBeVisible();
    const botonConfirmarRevision = mesaRevision.getByRole('button', { name: 'Confirmar revisión' });
    await expect(botonConfirmarRevision).toHaveCount(1);
    await expect(botonConfirmarRevision).toBeEnabled();
    expect(
      await botonConfirmarRevision.evaluate((button) => {
        const comparacion = button.closest('.resultado')?.querySelector('.omr-review-grid--visual');
        return Boolean(comparacion && (comparacion.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING));
      }),
      'la confirmación aparece después de comparar las respuestas'
    ).toBe(true);
    await expect(page.getByRole('status').filter({ hasText: 'Análisis completado' })).toBeVisible();
    await expect(page.locator('.toast-viewport .toast-text').filter({ hasText: 'Análisis completado' })).toHaveCount(0);
    await expect(page.locator('.calif-grade-card')).toHaveCount(0);
    expect(analisisOcrDummy, 'el tablero usa solamente el análisis OMR simulado').toBe(1);
    expect(escriturasCalificacion, 'la auditoría visual no confirma ni guarda calificaciones').toEqual([]);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Mesa OMR con respuestas dudosas ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Mesa OMR con respuestas dudosas ${width}px / ${theme}`);
        const visorImagenOmr = mesaRevision.locator('.omr-review-card__image-viewport');
        const altoVisorImagen = await visorImagenOmr.evaluate((element) => element.getBoundingClientRect().height);
        expect(altoVisorImagen, `el visor OMR móvil limita el espacio vacío ${width}px / ${theme}`)
          .toBeLessThanOrEqual(Math.min(844 * 0.5, 400) + 1);
        await expect(visorImagenOmr.locator('img')).toBeVisible();
        await assertSolidButtonTextContrast(
          botonConfirmarRevision,
          `Confirmar revisión OMR ${width}px / ${theme}`
        );
        await mesaRevision.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-omr-respuestas-dudosas-${width}-${theme}.png`),
          animations: 'disabled'
        });
      }
    }
  });

  test('audita nombres por solicitud en el buzón docente de aclaraciones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-revision-dummy'));
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docente: {
        _id: 'docente-revision-dummy', nombre: 'Docente de prueba', correo: 'docente@example.invalid',
        permisos: ['calificaciones:leer', 'calificaciones:calificar', 'periodos:leer', 'alumnos:leer'], roles: ['docente']
      } }) });
    });
    await page.route('**/api/calificaciones/revision/solicitudes', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ solicitudes: [
        { _id: 'solicitud-revision-dummy-01', externoId: 'externo-revision-dummy-01', folio: 'F-DUMMY-01', numeroPregunta: 2, estado: 'pendiente', comentario: 'Revisar la respuesta de esta pregunta.' },
        { _id: 'solicitud-revision-dummy-02', externoId: 'externo-revision-dummy-02', folio: 'F-DUMMY-02', numeroPregunta: 5, estado: 'pendiente', comentario: 'Solicito revisar el criterio aplicado.' }
      ] }) });
    });
    await page.route('**/api/periodos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [] }) });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [] }) });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    await page.getByRole('button', { name: /Revisión y captura/ }).click();
    const panel = page.locator('.calificaciones-revision-panel');
    await expect(panel.getByText('Folio F-DUMMY-01 · Pregunta 2')).toBeVisible();
    await expect(panel.getByText('Folio F-DUMMY-02 · Pregunta 5')).toBeVisible();

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await panel.scrollIntoViewIfNeeded();
        await assertNoHorizontalOverflow(page, `Buzón de aclaraciones ${width}px / ${theme}`);
        await captureEvidence(page, 'calificaciones', 'buzon-aclaraciones', `${width}-${theme}`, { fullPage: true });
      }
    }

    const respuestaUno = panel.getByRole('textbox', { name: 'Respuesta para el alumno, folio F-DUMMY-01, pregunta 2' });
    const respuestaDos = panel.getByRole('textbox', { name: 'Respuesta para el alumno, folio F-DUMMY-02, pregunta 5' });
    const atenderUno = panel.getByRole('button', { name: 'Marcar atendida, folio F-DUMMY-01, pregunta 2' });
    const rechazarUno = panel.getByRole('button', { name: 'Rechazar, folio F-DUMMY-01, pregunta 2' });
    const atenderDos = panel.getByRole('button', { name: 'Marcar atendida, folio F-DUMMY-02, pregunta 5' });
    const rechazarDos = panel.getByRole('button', { name: 'Rechazar, folio F-DUMMY-02, pregunta 5' });
    for (const control of [respuestaUno, respuestaDos, atenderUno, rechazarUno, atenderDos, rechazarDos]) {
      await expect(control).toBeVisible();
    }
    await respuestaUno.fill('Respuesta ficticia para folio uno.');
    await respuestaDos.fill('Respuesta ficticia para folio dos.');
    await respuestaUno.focus();
    await page.keyboard.press('Tab');
    await expect(atenderUno).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rechazarUno).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(respuestaDos).toBeFocused();
    await expect(atenderUno).toHaveText(/Marcar atendida/);
    await expect(rechazarUno).toHaveText(/Rechazar/);
  });

  test('audita Diseño, Generación e Historial de exámenes con datos sintéticos de solo lectura', async ({ page }) => {
    const periodoId = 'periodo-plantillas-ux-dummy';
    const plantillaId = 'plantilla-plantillas-ux-dummy';
    const alumnoId = 'alumno-plantillas-ux-dummy';
    const escriturasBloqueadas: string[] = [];
    const plantilla = {
      _id: plantillaId,
      periodoId,
      titulo: 'Parcial de demostración',
      tipo: 'parcial',
      numeroPaginas: 2,
      reactivosObjetivo: 10,
      preguntasIds: ['reactivo-plantillas-ux-dummy'],
      temas: ['Funciones lineales'],
      createdAt: '2026-10-01T12:00:00.000Z'
    };
    const examen = {
      _id: 'examen-plantillas-ux-dummy',
      folio: 'FOLIO-DEMO-001',
      loteId: 'LOTE-DEMO-001',
      plantillaId,
      alumnoId,
      tipoExamen: 'parcial',
      estado: 'Pendiente de aplicación',
      generadoEn: '2026-10-28T12:00:00.000Z',
      paginas: [{ numero: 1, preguntasDel: 1, preguntasAl: 10 }]
    };
    const pregunta = {
      _id: 'pregunta-plantillas-ux-dummy',
      reactivoId: 'reactivo-plantillas-ux-dummy',
      periodoId,
      tema: 'Funciones lineales',
      activo: true,
      versionActual: 1,
      versiones: [{
        numeroVersion: 1,
        enunciado: '¿Cuál es la pendiente de y = 2x + 3?',
        opciones: [
          { texto: '2', esCorrecta: true },
          { texto: '3', esCorrecta: false },
          { texto: '-2', esCorrecta: false },
          { texto: '0', esCorrecta: false },
          { texto: '5', esCorrecta: false }
        ]
      }]
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('tokenDocente', 'token-plantillas-ux-dummy');
      localStorage.removeItem('ep.guia.generacion.oculta');
      localStorage.removeItem('ep.guia.historial.oculta');
      sessionStorage.removeItem('evaluapro.plantillas.tab-activa');
    });
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const apiPath = url.pathname.slice(url.pathname.indexOf('/api') + 4);
      const responder = (body: unknown) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
      if (request.method() !== 'GET') {
        escriturasBloqueadas.push(`${request.method()} ${apiPath}`);
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Operación bloqueada en la auditoría de solo lectura.' }) });
        return;
      }
      if (apiPath === '/autenticacion/perfil') {
        await responder({ docente: {
          _id: 'docente-plantillas-ux-dummy', nombre: 'Docente de demostración', correo: 'docente@example.invalid',
          permisos: [
            'periodos:leer', 'alumnos:leer', 'banco:leer', 'plantillas:leer', 'plantillas:gestionar',
            'plantillas:previsualizar', 'plantillas:archivar', 'examenes:leer', 'examenes:generar',
            'examenes:descargar', 'examenes:regenerar', 'examenes:archivar', 'omr:analizar'
          ],
          roles: ['docente']
        } });
        return;
      }
      if (apiPath === '/autenticacion/capacidades-integraciones') {
        await responder({});
        return;
      }
      if (apiPath === '/periodos') {
        const archivado = ['0', 'false'].includes(String(url.searchParams.get('activo')).toLowerCase());
        await responder({ periodos: archivado ? [] : [{
          _id: periodoId, nombre: 'Álgebra de demostración · 2A', grupos: ['2A'], activo: true,
          fechaInicio: '2026-08-01', fechaFin: '2026-12-15'
        }] });
        return;
      }
      if (apiPath === '/alumnos') {
        await responder({ alumnos: [{
          _id: alumnoId, periodoId, matricula: 'DEMO-001', nombre: 'Alex', apellidoPaterno: 'Ejemplo',
          apellidoMaterno: 'Ficticio', grupo: '2A', activo: true
        }] });
        return;
      }
      if (apiPath.startsWith('/banco-preguntas/temas')) {
        await responder({ temas: [{ _id: 'tema-plantillas-ux-dummy', periodoId, nombre: 'Funciones lineales' }] });
        return;
      }
      if (apiPath === '/banco-preguntas') {
        await responder({ preguntas: [pregunta] });
        return;
      }
      if (apiPath === '/examenes/plantillas') {
        const archivadas = url.searchParams.get('archivado') === 'true';
        await responder({ plantillas: archivadas ? [] : [plantilla] });
        return;
      }
      if (apiPath === '/examenes/generados') {
        const archivados = url.searchParams.get('archivado') === 'true';
        await responder({ examenes: archivados ? [] : [examen], nextCursor: null });
        return;
      }
      if (apiPath === '/examenes/generados/lotes') {
        await responder({ lotes: [], nextCursor: null });
        return;
      }
      if (apiPath === '/omr/jobs') {
        await responder({ jobs: [
          {
            jobId: 'job-omr-ux-dummy-internal', workflow: 'scan', assessmentId: 'assessment-omr-ux-dummy-internal',
            folio: 'FOLIO-OMR-DEMO-01', sourceType: 'image_batch', status: 'review_pending',
            pagesTotal: 3, pagesProcessed: 2, summary: { accepted: 1, needsReview: 1, rejected: 0 },
            createdAt: '2026-10-28T12:00:00.000Z', updatedAt: '2026-10-28T12:01:00.000Z'
          },
          {
            jobId: 'job-omr-scan-failed-no-code-dummy', workflow: 'scan', assessmentId: 'assessment-omr-scan-failed-no-code-dummy',
            folio: 'FOLIO-OMR-SIN-CODIGO-DEMO', sourceType: 'image_batch', status: 'failed',
            pagesTotal: 1, pagesProcessed: 0, summary: { accepted: 0, needsReview: 0, rejected: 0 },
            createdAt: '2026-10-28T12:10:00.000Z', updatedAt: '2026-10-28T12:11:00.000Z'
          },
          {
            jobId: 'job-omr-ingesta-failed-dummy', workflow: 'pdf_ingesta', assessmentId: 'assessment-omr-ingesta-failed-dummy',
            folio: 'FOLIO-OMR-FALLIDO-DEMO', sourceType: 'pdf', status: 'failed',
            pagesTotal: 1, pagesProcessed: 0, summary: { accepted: 0, needsReview: 1, rejected: 0 },
            createdAt: '2026-10-28T13:00:00.000Z', updatedAt: '2026-10-28T13:01:00.000Z'
          },
          {
            jobId: 'job-omr-ingesta-processing-dummy', workflow: 'pdf_ingesta', assessmentId: 'assessment-omr-ingesta-processing-dummy',
            folio: 'FOLIO-OMR-PROCESANDO-DEMO', sourceType: 'pdf', status: 'processing',
            pagesTotal: 5, pagesProcessed: 2, summary: { accepted: 1, needsReview: 0, rejected: 0 },
            createdAt: '2026-10-28T14:00:00.000Z', updatedAt: '2026-10-28T14:01:00.000Z'
          },
          {
            jobId: 'job-omr-ingesta-completed-dummy', workflow: 'pdf_ingesta', assessmentId: 'assessment-omr-ingesta-completed-dummy',
            folio: 'FOLIO-OMR-COMPLETADO-DEMO', sourceType: 'pdf', status: 'completed',
            pagesTotal: 2, pagesProcessed: 2, summary: { accepted: 1, needsReview: 0, rejected: 1 },
            createdAt: '2026-10-28T15:00:00.000Z', updatedAt: '2026-10-28T15:01:00.000Z'
          }
        ], nextCursor: null });
        return;
      }
      if (apiPath === '/examenes/generados/assessment-omr-ux-dummy-internal') {
        await responder({ assessment: {
          _id: 'assessment-omr-ux-dummy-internal', folio: 'FOLIO-OMR-DEMO-01', generationSeed: 'seed-omr-demo',
          versionSet: [{ versionCode: 'A', questionCount: 1 }],
          statisticsSummary: { sheetCount: 1, studentPacketCount: 1, versionCount: 1 }
        }, sheetInstances: [], studentPacketArtifacts: [] });
        return;
      }
      if (apiPath === '/examenes/generados/assessment-omr-scan-failed-no-code-dummy') {
        await responder({ assessment: {
          _id: 'assessment-omr-scan-failed-no-code-dummy', folio: 'FOLIO-OMR-SIN-CODIGO-DEMO', generationSeed: 'seed-omr-failed-no-code-demo',
          versionSet: [{ versionCode: 'A', questionCount: 1 }],
          statisticsSummary: { sheetCount: 1, studentPacketCount: 1, versionCount: 1 }
        }, sheetInstances: [], studentPacketArtifacts: [] });
        return;
      }
      if (apiPath === '/examenes/generados/assessment-omr-ingesta-failed-dummy') {
        await responder({ assessment: {
          _id: 'assessment-omr-ingesta-failed-dummy', folio: 'FOLIO-OMR-FALLIDO-DEMO', generationSeed: 'seed-omr-failed-demo',
          versionSet: [{ versionCode: 'A', questionCount: 1 }],
          statisticsSummary: { sheetCount: 1, studentPacketCount: 1, versionCount: 1 }
        }, sheetInstances: [], studentPacketArtifacts: [] });
        return;
      }
      if (apiPath === '/examenes/generados/assessment-omr-ingesta-processing-dummy') {
        await responder({ assessment: {
          _id: 'assessment-omr-ingesta-processing-dummy', folio: 'FOLIO-OMR-PROCESANDO-DEMO', generationSeed: 'seed-omr-processing-demo',
          versionSet: [{ versionCode: 'A', questionCount: 1 }],
          statisticsSummary: { sheetCount: 1, studentPacketCount: 1, versionCount: 1 }
        }, sheetInstances: [], studentPacketArtifacts: [] });
        return;
      }
      if (apiPath === '/omr/jobs/job-omr-ux-dummy-internal') {
        await responder({ job: {
          jobId: 'job-omr-ux-dummy-internal', assessmentId: 'assessment-omr-ux-dummy-internal',
          sourceType: 'image_batch', status: 'review_pending', pagesTotal: 3, pagesProcessed: 2,
          summary: { accepted: 1, needsReview: 1, rejected: 0 },
          pages: [{
            sheetSerial: 'HOJA-OMR-DEMO-01', pageIndex: 2, scanStatus: 'needs_review', confidence: 0.44,
            sourceFileName: 'escaneo-demo.png', sourcePage: 2, autoGradable: false,
            responses: [{ numeroPregunta: 1, opcion: null, opcionDetectada: null, confianza: 0.44, estadoRespuesta: 'doble_marca', flags: ['bajo_contraste', 'doble_marca'] }],
            exceptions: [{ code: 'LOW_CONFIDENCE', severity: 'warning', message: 'Revisa la marca capturada.' }]
          }, {
            sheetSerial: 'REVERSO-OMR-DEMO-01', pageIndex: 3, pageType: 'reverso-vacio', scanStatus: 'ignored', confidence: 1,
            autoGradable: false, manualReviewRequired: false, responses: [],
            exceptions: [{ code: 'OMR_REVERSO_VACIO', severity: 'info', message: 'Reverso dúplex vacío omitido: no contiene elementos OMR.' }]
          }]
        } });
        return;
      }
      if (apiPath === '/omr/jobs/job-omr-scan-failed-no-code-dummy') {
        await responder({ job: {
          jobId: 'job-omr-scan-failed-no-code-dummy', assessmentId: 'assessment-omr-scan-failed-no-code-dummy',
          sourceType: 'image_batch', status: 'failed', pagesTotal: 1, pagesProcessed: 0,
          summary: { accepted: 0, needsReview: 0, rejected: 0 }, pages: [], errors: []
        } });
        return;
      }
      if (apiPath === '/omr/ingestas/job-omr-ingesta-failed-dummy') {
        await responder({ job: {
          jobId: 'job-omr-ingesta-failed-dummy', assessmentId: 'assessment-omr-ingesta-failed-dummy',
          sourceType: 'pdf', status: 'failed', pagesTotal: 1, pagesProcessed: 0,
          summary: { accepted: 0, needsReview: 1, rejected: 0 },
          pages: [], packages: [],
          files: [{ id: 'original-omr-dummy', nombre: 'original-ficticio.pdf', bytes: 1024, pages: 1, sha256: 'a'.repeat(64) }],
          errors: [{ code: 'INGESTION_FAILED' }]
        }, candidateExams: [] });
        return;
      }
      if (apiPath === '/omr/ingestas/job-omr-ingesta-processing-dummy') {
        await responder({ job: {
          jobId: 'job-omr-ingesta-processing-dummy', assessmentId: 'assessment-omr-ingesta-processing-dummy',
          sourceType: 'pdf', status: 'processing', pagesTotal: 5, pagesProcessed: 2,
          summary: { accepted: 1, needsReview: 0, rejected: 0 },
          pages: [], packages: [],
          files: [{ id: 'original-omr-processing-dummy', nombre: 'parcial-ficticio.pdf', bytes: 2048, pages: 5, sha256: 'b'.repeat(64) }],
          errors: []
        }, candidateExams: [] });
        return;
      }
      if (apiPath === '/examenes/generados/assessment-omr-ingesta-completed-dummy') {
        await responder({ assessment: {
          _id: 'assessment-omr-ingesta-completed-dummy', folio: 'FOLIO-OMR-COMPLETADO-DEMO', generationSeed: 'seed-omr-completed-demo',
          versionSet: [{ versionCode: 'A', questionCount: 1 }],
          statisticsSummary: { sheetCount: 2, studentPacketCount: 1, versionCount: 1 }
        }, sheetInstances: [], studentPacketArtifacts: [] });
        return;
      }
      if (apiPath === '/omr/ingestas/job-omr-ingesta-completed-dummy') {
        await responder({ job: {
          jobId: 'job-omr-ingesta-completed-dummy', assessmentId: 'assessment-omr-ingesta-completed-dummy',
          sourceType: 'pdf', status: 'completed', pagesTotal: 2, pagesProcessed: 2,
          summary: { accepted: 1, needsReview: 0, rejected: 1 },
          pages: [
            { sheetSerial: 'HOJA-OMR-ACEPTADA-DEMO', pageIndex: 1, pageType: 'examen', sourceFileId: 'original-omr-completed-dummy', sourceFileName: 'parcial-ficticio.pdf', sourcePage: 1, scanStatus: 'accepted', examId: 'assessment-omr-ingesta-completed-dummy', folio: 'FOLIO-OMR-COMPLETADO-DEMO', examPage: 1, confidence: 0.99, autoGradable: true, responses: [], exceptions: [] },
            { sheetSerial: 'HOJA-OMR-RECHAZADA-DEMO', pageIndex: 2, pageType: 'examen', sourceFileId: 'original-omr-completed-dummy', sourceFileName: 'parcial-ficticio.pdf', sourcePage: 2, scanStatus: 'rejected', examId: 'assessment-omr-ingesta-completed-dummy', folio: 'FOLIO-OMR-COMPLETADO-DEMO', examPage: 2, confidence: 0.2, autoGradable: false, responses: [], exceptions: [{ code: 'QR_INVALIDO', severity: 'blocking', message: 'No se pudo validar el código QR de esta hoja.' }] }
          ],
          packages: [], files: [{ id: 'original-omr-completed-dummy', nombre: 'parcial-ficticio.pdf', bytes: 2048, pages: 2, sha256: 'c'.repeat(64) }], errors: []
        }, candidateExams: [] });
        return;
      }
      await responder({});
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Diseño de Exámenes' });
    await expect(page.getByRole('heading', { name: 'Diseño de Exámenes', exact: true })).toBeVisible();
    const tablist = page.getByRole('tablist');
    await expect(tablist).toHaveAccessibleName('Etapas de diseño, generación e historial de exámenes');
    const tabDiseno = page.getByRole('tab', { name: /Diseñar Exámenes/i });
    const tabGeneracion = page.getByRole('tab', { name: /Generar Paquete PDF\/OMR/i });
    const tabHistorial = page.getByRole('tab', { name: /Historial de Lotes/i });
    const capturarPanel = async (panel: string, ancho: number, tema: 'light' | 'dark') => {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
      await page.waitForTimeout(250);
      if (panel === 'diseno' && tema === 'light') {
        await assertPlantillasFormatoContrast(page);
        await assertPlantillasCatalogBadgeContrast(page);
        await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
        await assertPlantillasFormatoContrast(page);
        if (ancho === 320) {
          await page.locator('.plantillas-formato-box').screenshot({
            path: supplementalEvidencePath('ux-plantillas-formato-default-light-320.png'),
            animations: 'disabled'
          });
        }
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      }
      if (panel === 'diseno') {
        await expect(page.getByRole('button', { name: 'Seleccionar imagen izquierda' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Seleccionar imagen derecha' })).toBeVisible();
      }
      if (panel === 'historial') {
        await expect(page.getByRole('button', { name: 'Seleccionar PDF de referencia' })).toBeVisible();
        await expect(page.locator('#omr-referencia-lote-estado')).toHaveText('Sin PDF seleccionado.');
        await expect(page.getByLabel('Lote de examen')).toHaveCount(0);
      }
      if (panel === 'diseno') await assertPlantillasFormatBadgesFit(page, `Diseño ${ancho}px / ${tema}`);
      if (panel === 'generacion' && tema === 'light') await assertPlantillasLightPanelContrast(page, `${panel} ${ancho}px / ${tema}`);
      await assertNoHorizontalOverflow(page, `Diseño de Exámenes ${panel} ${ancho}px / ${tema}`);
      if (panel === 'historial') {
        await assertPanelTextFitsViewport(page, page.locator(`#plantillas-panel-${panel}`), `Diseño de Exámenes ${panel} ${ancho}px / ${tema}`);
        const botonZip = page.locator('#plantillas-panel-historial .plantillas-item__actions > .boton').first();
        await expect(botonZip).toBeEnabled();
        await assertSolidButtonTextContrast(botonZip, `Descargar ZIP OMR ${ancho}px / ${tema}`);
        await botonZip.hover();
        await assertSolidButtonTextContrast(botonZip, `Hover Descargar ZIP OMR ${ancho}px / ${tema}`);
        await page.mouse.move(0, 0);
        if (ancho === 320) {
          const bounds = await page.locator('#plantillas-panel-historial .plantillas-item__actions').first().evaluate((actions) => {
            const container = actions.getBoundingClientRect();
            const card = actions.closest('.plantillas-item')!.getBoundingClientRect();
            const buttons = [...actions.querySelectorAll('button')].map((button) => {
              const rect = button.getBoundingClientRect();
              return { left: rect.left, right: rect.right };
            });
            return { container: { left: container.left, right: container.right }, card: { left: card.left, right: card.right }, buttons };
          });
          expect(bounds.container.left, `Las acciones del paquete deben caber dentro de la tarjeta a 320px (${tema})`).toBeGreaterThanOrEqual(bounds.card.left);
          expect(bounds.container.right, `Las acciones del paquete deben caber dentro de la tarjeta a 320px (${tema})`).toBeLessThanOrEqual(bounds.card.right);
          expect(bounds.buttons.every((button) => button.left >= bounds.container.left && button.right <= bounds.container.right), `Cada CTA del paquete debe caber en su grupo a 320px (${tema})`).toBe(true);
        }
      }
      await page.locator(`#plantillas-panel-${panel}`).screenshot({
        path: supplementalEvidencePath(`ux-audit-plantillas-${panel}-${ancho}-${tema}.png`),
        animations: 'disabled'
      });
    };

    for (const ancho of [390, 320]) {
      await expect(tabDiseno).toHaveAttribute('aria-selected', 'true');
      await capturarPanel('diseno', ancho, 'light');
      await capturarPanel('diseno', ancho, 'dark');
    }

    await tabDiseno.focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabGeneracion).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tabGeneracion).toHaveAttribute('aria-selected', 'true');
    const panelGeneracion = page.getByRole('tabpanel', { name: 'Generar Paquete PDF/OMR' });
    await expect(panelGeneracion.getByRole('heading', { name: 'Generación de exámenes' })).toBeVisible();
    await expect(panelGeneracion.getByRole('button', { name: 'Ver guía rápida de generación de exámenes' })).toBeVisible();
    await panelGeneracion.getByLabel('Plantilla base para el examen').selectOption(plantillaId);
    await expect(panelGeneracion.getByText('Plantilla seleccionada: Álgebra de demostración · 2A · Parcial de demostración')).toBeVisible();
    await panelGeneracion.getByLabel('Grupo destinatario del lote').selectOption('2A');
    await expect(panelGeneracion.getByText('Alumno del grupo: 1 alumno')).toBeVisible();
    await expect(panelGeneracion.getByRole('button', { name: 'Paquete por grupo (1 alumno)' })).toBeVisible();
    await expect(panelGeneracion.getByText(/Total de destinatarios: 1 alumno\./)).toBeVisible();
    await expect(panelGeneracion.getByText('Tipo seleccionado: Ordinario · Parcial')).toBeVisible();
    const botonGenerar = panelGeneracion.getByRole('button', { name: 'Generar lote PDF consolidado (1 alumno)' });
    await expect(botonGenerar).toBeVisible();
    await expect(panelGeneracion.getByRole('group', { name: 'Formato de salida del lote' }).getByRole('button', { name: /PDF · lote consolidado/i })).toHaveAttribute('aria-pressed', 'true');
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      if (ancho === 320) {
        const boundsAccion = await botonGenerar.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          const parent = button.parentElement!.getBoundingClientRect();
          return { left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right, width: rect.width };
        });
        expect(boundsAccion.width).toBeGreaterThan(0);
        expect(boundsAccion.left).toBeGreaterThanOrEqual(boundsAccion.parentLeft - 1);
        expect(boundsAccion.right, 'La acción de generación debe caber dentro de su contenedor a 320 px').toBeLessThanOrEqual(boundsAccion.parentRight + 1);
        for (const nombreGrupo of ['Modalidad de generación', 'Formato de salida del lote']) {
          const grupo = panelGeneracion.getByRole('group', { name: nombreGrupo });
          const geometria = await grupo.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const botones = [...element.querySelectorAll('button')].map((button) => {
              const buttonBounds = button.getBoundingClientRect();
              return { left: buttonBounds.left, right: buttonBounds.right, width: buttonBounds.width };
            });
            const parent = element.parentElement!.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { left: bounds.left, right: bounds.right, width: bounds.width, parentWidth: parent.width, display: style.display, flexDirection: style.flexDirection, botones };
          });
          expect(geometria.botones.length, `${nombreGrupo}: opciones presentes`).toBeGreaterThan(1);
          expect(geometria.botones.every((boton) => boton.width > 0 && boton.left >= geometria.left - 1 && boton.right <= geometria.right + 1), `${nombreGrupo}: cada opción cabe dentro del grupo a 320 px`).toBe(true);
        }
        const anchoModalidad = await panelGeneracion.getByRole('group', { name: 'Modalidad de generación' }).evaluate((element) => element.getBoundingClientRect().width);
        const grupoFormato = panelGeneracion.getByRole('group', { name: 'Formato de salida del lote' });
        const anchoFormato = await grupoFormato.evaluate((element) => element.getBoundingClientRect().width);
        expect(anchoFormato, 'El selector de formato debe aprovechar el ancho de la tarjeta de modalidad en móvil').toBeGreaterThanOrEqual(anchoModalidad - 1);
        const opcionesFormatoLegibles = await grupoFormato.getByRole('button').evaluateAll((botones) => botones.every((boton) => {
          const caja = boton.getBoundingClientRect();
          const rango = document.createRange();
          rango.selectNodeContents(boton);
          return boton.getBoundingClientRect().height >= 44
            && boton.scrollWidth <= boton.clientWidth + 1
            && [...rango.getClientRects()].every((linea) => linea.left >= caja.left + 1 && linea.right <= caja.right - 1);
        }));
        expect(opcionesFormatoLegibles, 'Las etiquetas ZIP/PDF deben caber completas en botones táctiles a 320 px').toBe(true);
      }
      await capturarPanel('generacion', ancho, 'light');
      await capturarPanel('generacion', ancho, 'dark');
    }

    await tabHistorial.click();
    await expect(tabHistorial).toHaveAttribute('aria-selected', 'true');
    const historialOmr = page.getByRole('list', { name: 'Historial de trabajos OMR' });
    await expect(historialOmr.getByText('Folio: FOLIO-OMR-DEMO-01')).toBeVisible();
    await expect(historialOmr.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-OMR-DEMO-01' })).toBeVisible();
    await expect(historialOmr).not.toContainText('job-omr-ux-dummy-internal');
    await expect(historialOmr).not.toContainText('assessment-omr-ux-dummy-internal');
    await expect(page.getByRole('button', { name: 'Ver guía rápida de historial y custodia' })).toBeVisible();
    await expect(page.getByText('FOLIO-DEMO-001')).toBeVisible();
    await expect(page.getByText('Paquete de exámenes', { exact: true })).toBeVisible();
    for (const ancho of [390, 320]) {
      await capturarPanel('historial', ancho, 'light');
      await capturarPanel('historial', ancho, 'dark');
    }
    await page.locator('#omr-referencia-lote').setInputFiles({
      name: 'Referencia del examen global de demostración para el grupo 2A - parcial.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n')
    });
    const estadoReferenciaOmr = page.locator('#omr-referencia-lote-estado');
    await expect(estadoReferenciaOmr).toHaveAttribute('role', 'status');
    await expect(estadoReferenciaOmr).toContainText('Referencia del examen global de demostración para el grupo 2A - parcial.pdf');
    await expect(page.getByRole('button', { name: 'Seleccionar PDF de referencia' })).toHaveAttribute('aria-describedby', 'omr-referencia-lote-estado');
    for (const tema of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
      await assertNoHorizontalOverflow(page, `PDF de referencia seleccionado OMR 320px / ${tema}`);
      await assertPanelTextFitsViewport(page, page.locator('.plantillas-omr__prevalidacion'), `PDF de referencia seleccionado OMR 320px / ${tema}`);
      await page.locator('.plantillas-omr__prevalidacion').screenshot({
        path: supplementalEvidencePath(`ux-audit-plantillas-omr-referencia-seleccionada-320-${tema}.png`),
        animations: 'disabled'
      });
    }
    await page.locator('#omr-referencia-lote').setInputFiles([]);
    await historialOmr.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-OMR-DEMO-01' }).click();
    await expect(page.getByRole('heading', { name: 'Trabajo OMR' })).toBeVisible();
    await page.getByRole('button', { name: 'HOJA-OMR-DEMO-01 · P2 · Requiere revisión' }).click();
    const revisionOmr = page.locator('.plantillas-omr__review');
    await expect(revisionOmr.getByRole('heading', { name: 'Revisión y ajuste: HOJA-OMR-DEMO-01' })).toBeVisible();
    await expect(revisionOmr.getByLabel('Identificador del alumno')).toBeVisible();
    await expect(revisionOmr.getByText('Estado: Requiere revisión')).toBeVisible();
    await expect(revisionOmr.getByText('Marcas candidatas del análisis: No hay marcas candidatas disponibles')).toBeVisible();
    await expect(revisionOmr.getByText('Señales: Bajo contraste · Varias marcas')).toBeVisible();
    await expect(revisionOmr.getByText('LOW_CONFIDENCE')).not.toBeVisible();
    await expect(revisionOmr.getByRole('button', { name: 'Guardar resolución' })).toBeVisible();
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      for (const tema of ['light', 'dark'] as const) {
        await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page, `Revisión OMR reabierta ${ancho}px / ${tema}`);
        await assertVisibleHeadersFit(page, `Revisión OMR reabierta ${ancho}px / ${tema}`);
        await revisionOmr.screenshot({
          path: supplementalEvidencePath(`ux-audit-plantillas-omr-revision-${ancho}-${tema}.png`),
          animations: 'disabled'
        });
      }
    }
    await page.getByRole('button', { name: 'REVERSO-OMR-DEMO-01 · P3 · Omitida' }).click();
    await expect(revisionOmr.getByRole('heading', { name: 'Detalle de página: REVERSO-OMR-DEMO-01' })).toBeVisible();
    await expect(revisionOmr.getByText('No requiere resolución manual: es un reverso vacío sin respuestas OMR.')).toBeVisible();
    await expect(revisionOmr.getByText(/Confianza del análisis/)).toHaveCount(0);
    await expect(revisionOmr.getByRole('button', { name: 'Guardar resolución' })).toHaveCount(0);
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      for (const tema of ['light', 'dark'] as const) {
        await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page, `Página OMR omitida ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, revisionOmr, `Página OMR omitida ${ancho}px / ${tema}`);
        await revisionOmr.screenshot({
          path: supplementalEvidencePath(`ux-audit-plantillas-omr-ignored-${ancho}-${tema}.png`),
          animations: 'disabled'
        });
      }
    }
    await historialOmr.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-OMR-FALLIDO-DEMO' }).click();
    const estadoIngestaFallida = page.locator('.plantillas-omr__job');
    await expect(estadoIngestaFallida.getByText(/No se pudo completar la ingesta OMR\. Los archivos originales se conservan/)).toBeVisible();
    await expect(estadoIngestaFallida.getByRole('button', { name: 'Reprocesar desde originales' })).toBeEnabled();
    await expect(estadoIngestaFallida.getByRole('button', { name: 'Finalizar trabajo' })).toHaveCount(0);
    await expect(estadoIngestaFallida.getByText('INGESTION_FAILED')).not.toBeVisible();
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      for (const tema of ['light', 'dark'] as const) {
        await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page, `Recuperación de ingesta OMR fallida ${ancho}px / ${tema}`);
        await assertVisibleHeadersFit(page, `Recuperación de ingesta OMR fallida ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, estadoIngestaFallida, `Recuperación de ingesta OMR fallida ${ancho}px / ${tema}`);
        const contenedorAcciones = estadoIngestaFallida.locator('.acciones--mt').last();
        const limitesAcciones = await contenedorAcciones.evaluate((element) => {
          const caja = element.getBoundingClientRect();
          const botones = [...element.querySelectorAll('button')].map((button) => {
            const boton = button.getBoundingClientRect();
            return { left: boton.left, right: boton.right, width: boton.width };
          });
          return { left: caja.left, right: caja.right, botones };
        });
        expect(
          limitesAcciones.botones.every((boton) => boton.width > 0 && boton.left >= limitesAcciones.left - 1 && boton.right <= limitesAcciones.right + 1),
          `Las acciones de recuperación deben caber en su grupo a ${ancho}px / ${tema}`
        ).toBe(true);
        await estadoIngestaFallida.screenshot({
          path: supplementalEvidencePath(`ux-audit-plantillas-omr-failed-${ancho}-${tema}.png`),
          animations: 'disabled'
        });
      }
    }
    await historialOmr.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-OMR-SIN-CODIGO-DEMO' }).click();
    const estadoScanFallidoSinCodigo = page.locator('.plantillas-omr__job');
    await expect(estadoScanFallidoSinCodigo.getByRole('alert')).toHaveText(
      'No se pudo completar el procesamiento OMR. El servicio no devolvió un código técnico; si necesitas ayuda, comparte el folio FOLIO-OMR-SIN-CODIGO-DEMO con soporte.'
    );
    await expect(estadoScanFallidoSinCodigo.getByText('Ver código técnico para soporte')).toHaveCount(0);
    const artefactosOmr = page.getByRole('group', { name: 'Archivos del folio FOLIO-OMR-SIN-CODIGO-DEMO' });
    await expect(artefactosOmr).toBeVisible();
    const botonSeleccionarCapturas = page.getByRole('button', { name: 'Seleccionar capturas o PDF' });
    const botonSeleccionarReferencia = page.getByRole('button', { name: 'Seleccionar PDF generado del lote' });
    await expect(botonSeleccionarCapturas).toBeVisible();
    await expect(botonSeleccionarReferencia).toBeVisible();
    await expect(page.locator('#omr-capturas-lote-estado')).toHaveAttribute('role', 'status');
    await expect(page.locator('#omr-capturas-lote-estado')).toHaveText('Sin archivos seleccionados.');
    await expect(page.locator('#omr-referencia-job-lote-estado')).toHaveText('Sin PDF de referencia seleccionado.');
    await page.locator('#omr-capturas-lote').setInputFiles({
      name: 'captura-demostracion-para-revisar-el-recibo-de-calificaciones-del-grupo-2A.png',
      mimeType: 'image/png',
      buffer: Buffer.from('synthetic-image')
    });
    await page.locator('#omr-referencia-job-lote').setInputFiles({
      name: 'referencia-del-parcial-global-para-cotejo-de-codigos-QR-del-grupo-2A.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n')
    });
    await expect(page.locator('#omr-capturas-lote-estado')).toContainText('captura-demostracion-para-revisar-el-recibo-de-calificaciones-del-grupo-2A.png (menos de 1 KB). Total: menos de 1 KB.');
    await expect(page.locator('#omr-referencia-job-lote-estado')).toContainText('referencia-del-parcial-global-para-cotejo-de-codigos-QR-del-grupo-2A.pdf (menos de 1 KB).');
    const selectorCapturasOmr = page.locator('.plantillas-archivo-selector').filter({ has: botonSeleccionarCapturas });
    const selectorReferenciaOmr = page.locator('.plantillas-archivo-selector').filter({ has: botonSeleccionarReferencia });
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      for (const tema of ['light', 'dark'] as const) {
        await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page, `Fallo OMR sin código ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, estadoScanFallidoSinCodigo, `Fallo OMR sin código ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, selectorCapturasOmr, `Selector de capturas OMR ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, selectorReferenciaOmr, `Selector de PDF OMR ${ancho}px / ${tema}`);
        if (ancho === 320) {
          await selectorCapturasOmr.screenshot({
            path: supplementalEvidencePath(`ux-audit-omr-file-picker-captures-320-${tema}.png`),
            animations: 'disabled'
          });
          await selectorReferenciaOmr.screenshot({
            path: supplementalEvidencePath(`ux-audit-omr-file-picker-reference-320-${tema}.png`),
            animations: 'disabled'
          });
        }
        const geometriaOmr = await page.evaluate(() => {
          const acciones = document.querySelector<HTMLElement>('.plantillas-omr__artifact-actions');
          const pestanas = Array.from(document.querySelectorAll<HTMLElement>('.plantillas-tabs-bar .plantillas-tab-btn'));
          const alerta = document.querySelector<HTMLElement>('.plantillas-omr__job > .mensaje');
          const trabajo = document.querySelector<HTMLElement>('.plantillas-omr__job');
          if (!acciones || !alerta || !trabajo || pestanas.length === 0) return null;
          const limites = acciones.getBoundingClientRect();
          return {
            pestanas: pestanas.map((pestana) => {
              const etiqueta = pestana.querySelector<HTMLElement>('.plantillas-tab-btn__label');
              const rango = document.createRange();
              if (etiqueta) rango.selectNodeContents(etiqueta);
              return { ancho: pestana.getBoundingClientRect().width, lineasEtiqueta: rango.getClientRects().length };
            }),
            botones: Array.from(acciones.querySelectorAll<HTMLElement>('.boton')).map((boton) => {
              const caja = boton.getBoundingClientRect();
              const texto = boton.querySelector<HTMLElement>('.boton__texto');
              return {
                dentroDelGrupo: caja.left >= limites.left - 1 && caja.right <= limites.right + 1,
                textoSinRecorte: !texto || texto.scrollWidth <= texto.clientWidth + 1
              };
            }),
            alertaOcupaTarjeta: alerta.getBoundingClientRect().width >= trabajo.getBoundingClientRect().width * 0.8
          };
        });
        expect(geometriaOmr, `La alerta y las acciones OMR deben renderizarse a ${ancho}px / ${tema}`).not.toBeNull();
        expect(geometriaOmr!.pestanas.every((pestana) => pestana.ancho >= 120 && pestana.lineasEtiqueta <= 3),
          `Las pestañas deben conservar ancho y palabras legibles a ${ancho}px / ${tema}`).toBe(true);
        expect(geometriaOmr!.botones.every((boton) => boton.dentroDelGrupo && boton.textoSinRecorte),
          `Los botones de artefactos no deben salirse ni recortar texto a ${ancho}px / ${tema}`).toBe(true);
        expect(geometriaOmr!.alertaOcupaTarjeta,
          `La alerta debe usar el ancho de lectura de la tarjeta a ${ancho}px / ${tema}`).toBe(true);
        await estadoScanFallidoSinCodigo.screenshot({
          path: supplementalEvidencePath(`ux-audit-plantillas-omr-failed-no-code-${ancho}-${tema}.png`),
          animations: 'disabled'
        });
        if (ancho === 320) {
          await page.screenshot({
            path: supplementalEvidencePath(`ux-audit-plantillas-omr-failed-no-code-full-${tema}.png`),
            fullPage: true,
            animations: 'disabled'
          });
        }
      }
    }
    await historialOmr.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-OMR-PROCESANDO-DEMO' }).click();
    const estadoIngestaEnCurso = page.locator('.plantillas-omr__job');
    await expect(estadoIngestaEnCurso.getByText('Estado: En proceso')).toBeVisible();
    await expect(estadoIngestaEnCurso.getByText('Procesando páginas del PDF')).toBeVisible();
    await expect(estadoIngestaEnCurso.getByText('2 de 5 páginas')).toBeVisible();
    await expect(estadoIngestaEnCurso.getByRole('progressbar', { name: 'Avance de ingesta PDF OMR' })).toHaveAttribute('value', '2');
    await expect(estadoIngestaEnCurso.getByRole('progressbar', { name: 'Avance de ingesta PDF OMR' })).toHaveAttribute('max', '5');
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      for (const tema of ['light', 'dark'] as const) {
        await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page, `Progreso de ingesta OMR ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, estadoIngestaEnCurso, `Progreso de ingesta OMR ${ancho}px / ${tema}`);
        await estadoIngestaEnCurso.screenshot({
          path: supplementalEvidencePath(`ux-audit-plantillas-omr-processing-${ancho}-${tema}.png`),
          animations: 'disabled'
        });
      }
    }
    await historialOmr.getByRole('button', { name: 'Reabrir revisión: folio FOLIO-OMR-COMPLETADO-DEMO' }).click();
    const trabajoIngestaCompletada = page.locator('.plantillas-omr__job');
    await expect(trabajoIngestaCompletada.getByRole('button', { name: 'HOJA-OMR-ACEPTADA-DEMO · P1 · Aceptada' })).toBeVisible();
    await trabajoIngestaCompletada.getByRole('button', { name: 'HOJA-OMR-ACEPTADA-DEMO · P1 · Aceptada' }).click();
    const ingestaCompletada = page.locator('.plantillas-omr__review');
    await expect(ingestaCompletada.getByRole('heading', { name: 'Detalle de página: HOJA-OMR-ACEPTADA-DEMO' })).toBeVisible();
    await expect(ingestaCompletada.getByText(/Esta página está aceptada/)).toBeVisible();
    await expect(ingestaCompletada.getByRole('button', { name: 'Guardar resolución' })).toHaveCount(0);
    await expect(ingestaCompletada.getByText('Carga la página 1 ya asociada a este examen para compararla con el escaneo.')).toBeVisible();
    for (const ancho of [390, 320]) {
      await page.setViewportSize({ width: ancho, height: ancho === 320 ? 800 : 844 });
      for (const tema of ['light', 'dark'] as const) {
        await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema);
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page, `Página OMR aceptada ${ancho}px / ${tema}`);
        await assertPanelTextFitsViewport(page, ingestaCompletada, `Página OMR aceptada ${ancho}px / ${tema}`);
        await ingestaCompletada.screenshot({
          path: supplementalEvidencePath(`ux-audit-plantillas-omr-accepted-${ancho}-${tema}.png`),
          animations: 'disabled'
        });
      }
    }
    await trabajoIngestaCompletada.getByRole('button', { name: 'HOJA-OMR-RECHAZADA-DEMO · P2 · Rechazada' }).click();
    await expect(ingestaCompletada.getByRole('heading', { name: 'Detalle de página: HOJA-OMR-RECHAZADA-DEMO' })).toBeVisible();
    await expect(ingestaCompletada.getByText(/Esta página está rechazada/)).toBeVisible();
    await expect(ingestaCompletada.getByRole('button', { name: 'Guardar resolución' })).toHaveCount(0);
    expect(escriturasBloqueadas, 'la auditoría no debe enviar operaciones que escriban datos').toEqual([]);
  });

  test('audita el error recuperable del selector manual de exámenes en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-calificaciones-manual-dummy'));
    let intentosConsultaManual = 0;
    let permitirReintentoManual = false;

    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-calificaciones-manual-dummy',
          nombre: 'Docente de prueba',
          correo: 'calificaciones@example.invalid',
          permisos: ['periodos:leer', 'alumnos:leer', 'calificaciones:leer', 'calificaciones:calificar', 'plantillas:leer', 'omr:analizar'],
          roles: ['docente']
        } })
      });
    });
    await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/periodos**', async (route) => {
      const archivados = new URL(route.request().url()).searchParams.get('activo') === '0';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: archivados ? [] : [{
          _id: 'periodo-calificaciones-manual-dummy', nombre: 'Física de prueba — 3A', grupos: ['3A'], activo: true
        }] })
      });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [{
        _id: 'alumno-calificaciones-manual-dummy', matricula: 'DUMMY-OMR-01', apellidoPaterno: 'Ejemplo',
        apellidoMaterno: '', nombre: 'Alex', nombreCompleto: 'Alex Ejemplo', grupo: '3A', periodoId: 'periodo-calificaciones-manual-dummy'
      }] }) });
    });
    await page.route('**/api/analiticas/lista-academica**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas: [] }) });
    });
    await page.route('**/api/examenes/plantillas**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plantillas: [] }) });
    });
    await page.route('**/api/examenes/generados**', async (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has('alumnoId')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ examenes: [], nextCursor: null }) });
        return;
      }
      intentosConsultaManual += 1;
      if (!permitirReintentoManual) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Fallo sintético de consulta' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ examenes: [{
        _id: 'examen-calificaciones-manual-dummy', folio: 'FOLIO-DUMMY-OMR-01',
        alumnoId: 'alumno-calificaciones-manual-dummy', periodoId: 'periodo-calificaciones-manual-dummy',
        plantillaId: 'plantilla-calificaciones-manual-dummy', tipoExamen: 'parcial',
        plantillaTitulo: 'Evaluación de prueba', estado: 'entregado', entregadoEn: '2026-11-01T12:00:00.000Z'
      }], nextCursor: null }) });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const navDocente = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navDocente).toBeVisible({ timeout: 15_000 });
    await navDocente.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const navCalificaciones = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await navCalificaciones.getByRole('button', { name: /Revisión y captura/ }).click();
    const selectorExamenesRevisados = page.getByLabel('Exámenes revisados/calificados');
    await expect(selectorExamenesRevisados.locator('option:checked')).toHaveText('No hay exámenes');
    const panelManual = page.locator('#calificacion-detalle-manual');
    await panelManual.getByLabel('Alumno').selectOption('alumno-calificaciones-manual-dummy');
    const identidadAlumnoSeleccionado = panelManual.getByText('Alumno seleccionado: DUMMY-OMR-01 - Alex Ejemplo');
    await expect(identidadAlumnoSeleccionado).toBeVisible();
    await expect(panelManual.getByLabel('Alumno')).toHaveAttribute('aria-describedby', 'calificacion-manual-alumno-seleccionado');
    const alerta = await page.getByRole('alert').filter({
      hasText: 'No se pudieron cargar los exámenes de este alumno.'
    });
    await expect(alerta).toContainText('Reintentar carga de exámenes');
    await expect(panelManual.getByText('Lista no disponible')).toBeVisible();
    await expect(panelManual.getByLabel('Buscar folio')).toBeDisabled();
    await expect(panelManual.getByLabel('Examen entregado o calificado')).toBeDisabled();
    await expect(panelManual.getByText('No hay exámenes entregados o calificados para el alumno seleccionado.')).toHaveCount(0);

    const accesosRevision = page.getByRole('navigation', { name: 'Accesos directos de Revisión y captura' });
    const destinosRevision = [
      { etiqueta: 'Escaneo y revisión OMR', id: 'calificaciones-omr-heading' },
      { etiqueta: 'Calificación manual', id: 'calificaciones-manual-selection-heading' },
      { etiqueta: 'Encuadre académico', id: 'calificaciones-encuadre-heading' },
      { etiqueta: 'Solicitudes de revisión', id: 'calificaciones-aclaraciones-heading' }
    ];
    await expect(accesosRevision.getByRole('link')).toHaveCount(destinosRevision.length);

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Error del selector manual ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Error del selector manual ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-manual-error-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });

        for (const destino of destinosRevision) {
          const enlace = accesosRevision.getByRole('link', { name: destino.etiqueta });
          const enlaceBox = await enlace.boundingBox();
          expect(enlaceBox?.height, `${destino.etiqueta}: tamaño táctil`).toBeGreaterThanOrEqual(44);
          await assertRenderedTextContrast(enlace, `${width}px / ${theme}: ${destino.etiqueta}`);
          await enlace.hover();
          await assertRenderedTextContrast(enlace, `${width}px / ${theme}: hover ${destino.etiqueta}`);
          await enlace.focus();
          await page.keyboard.press('Enter');
          const encabezadoDestino = page.locator(`#${destino.id}`);
          await expect(encabezadoDestino).toBeFocused();
          const outline = await encabezadoDestino.evaluate((element) => ({
            style: getComputedStyle(element).outlineStyle,
            width: Number.parseFloat(getComputedStyle(element).outlineWidth)
          }));
          expect(outline.style, `${destino.etiqueta}: indicador de foco`).toBe('solid');
          expect(outline.width, `${destino.etiqueta}: grosor del foco`).toBeGreaterThanOrEqual(3);
          const destinoBox = await encabezadoDestino.boundingBox();
          const altoViewport = await page.evaluate(() => window.innerHeight);
          expect(destinoBox?.y, `${destino.etiqueta}: encabezado separado del borde y contexto visible`).toBeGreaterThanOrEqual(40);
          expect((destinoBox?.y ?? altoViewport) + (destinoBox?.height ?? 0), `${destino.etiqueta}: encabezado completo visible`).toBeLessThanOrEqual(altoViewport);
          await expect(page).toHaveURL(new RegExp(`#${destino.id}$`));
          if (destino.etiqueta === 'Calificación manual') {
            await page.screenshot({
              path: supplementalEvidencePath(`ux-audit-calificaciones-manual-shortcut-${width}-${theme}.png`),
              animations: 'disabled'
            });
          }
        }
      }
    }

    const intentosAntesDelReintento = intentosConsultaManual;
    permitirReintentoManual = true;
    await panelManual.getByRole('button', { name: 'Reintentar carga de exámenes' }).click();
    await expect(panelManual.getByLabel('Examen entregado o calificado')).toContainText('FOLIO-DUMMY-OMR-01');
    await expect(panelManual.getByLabel('Buscar folio')).toBeEnabled();
    await expect(panelManual.getByLabel('Examen entregado o calificado')).toBeEnabled();
    expect(intentosConsultaManual).toBeGreaterThan(intentosAntesDelReintento);
  });

  test('audita visualmente Extraordinarios con datos sintéticos en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-extraordinarios-dummy'));
    const periodoId = 'periodo-extraordinarios-dummy';
    const fila = {
      alumnoId: 'alumno-extraordinarios-dummy', matricula: 'DUMMY-EX-01', apellidoPaterno: 'Ejemplo',
      apellidoMaterno: 'Demostración', nombre: 'Alexandra', grupo: '2A', calificacionFinalCurso: '5.75',
      calificacionFinalCursoActa: '5', extraDisponible: true, solicitaExtra: true, solicitudExtraVersion: 1,
      resultadosExtraordinarios: [{
        claseRegistro: 'externo', folio: 'FOLIO-EX-DUMMY', calificacionSobre5: '4', calificacionSobre10: '8',
        estadoAprobatorio: 'Aprobado', loteId: 'LOTE-EX-DUMMY', origen: 'Examen externo'
      }]
    };
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-extraordinarios-dummy', nombre: 'Docente de prueba', correo: 'extraordinarios@example.invalid',
          permisos: ['periodos:leer', 'calificaciones:leer', 'calificaciones:calificar', 'examenes:generar', 'plantillas:previsualizar'],
          roles: ['docente']
        } })
      });
    });
    await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/periodos**', async (route) => {
      const archivadas = new URL(route.request().url()).searchParams.get('activo') === '0';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: archivadas ? [] : [{ _id: periodoId, nombre: 'Materia de prueba', grupos: ['2A'], activo: true }] })
      });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alumnos: [{ _id: fila.alumnoId, matricula: fila.matricula, nombre: fila.nombre, apellidoPaterno: fila.apellidoPaterno, apellidoMaterno: fila.apellidoMaterno, grupo: fila.grupo, periodoId }] })
      });
    });
    await page.route('**/api/analiticas/lista-academica**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas: [fila] }) });
    });
    await page.route('**/api/examenes/generados**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ examenes: [{
          _id: 'examen-extra-dummy', tipoExamen: 'extraordinario', folio: 'FOLIO-EX-DUMMY',
          loteId: 'LOTE-EX-DUMMY', alumnoId: fila.alumnoId, alumnoNombre: 'Alexandra Ejemplo Demostración',
          estado: 'Pendiente de aplicación', generadoEn: '2026-10-28T12:00:00.000Z'
        }], nextCursor: null })
      });
    });
    await page.route('**/api/examenes/plantillas**', async (route) => {
      const archivadas = new URL(route.request().url()).searchParams.get('archivado') === 'true';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plantillas: archivadas ? [] : [{
          _id: 'plantilla-extra-dummy', periodoId, titulo: 'Examen de recuperación', numeroPaginas: 2
        }] })
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espacios = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await espacios.getByRole('button', { name: /Extraordinarios/ }).click();
    const screen = page.getByRole('region', { name: 'Extraordinarios' });
    await expect(screen.getByRole('heading', { name: 'Extraordinarios', exact: true })).toBeVisible();
    await screen.getByLabel('Materia y periodo').selectOption(periodoId);
    await expect(screen.getByText('Elegibilidad y solicitud')).toBeVisible();
    const contadorSeleccion = screen.getByText('0 alumnos seleccionados');
    await expect(contadorSeleccion).toBeVisible();
    await expect(contadorSeleccion).toHaveAttribute('aria-live', 'polite');
    const etiquetaLote = screen.locator('.calificaciones-extra__batch-select');
    const seleccionarAlumno = screen.getByRole('checkbox', { name: /^Incluir en el lote/ });
    await expect(etiquetaLote).toHaveCSS('min-height', '44px');
    await expect(seleccionarAlumno).toHaveAccessibleName(/^Incluir en el lote Ejemplo Demostración Alexandra · matrícula DUMMY-EX-01 · grupo 2A$/);
    await expect(etiquetaLote.getByText('Incluir en el lote')).toBeVisible();
    await etiquetaLote.getByText('Incluir en el lote').click();
    await expect(screen.getByText('1 alumno seleccionado')).toBeVisible();
    await seleccionarAlumno.uncheck();
    await expect(contadorSeleccion).toBeVisible();
    await expect(screen.getByText('El cálculo usa la final del curso antes del redondeo; «Final para acta» muestra el valor por separado.')).toBeVisible();
    await expect(screen.getByText('Final del curso', { exact: true })).toBeVisible();
    await expect(screen.getByText('Final para acta', { exact: true })).toBeVisible();
    await expect(screen.getByText('Elegible', { exact: true })).toBeVisible();
    await expect(screen.getByText(/Examen de recuperación/)).toBeAttached();
    await expect(screen.getByText(/FOLIO-EX-DUMMY/).first()).toBeVisible();
    await expect(screen.locator('.calificaciones-extra__summary > span')).toHaveText([
      '1 elegible de 1 alumno', '1 alumno con solicitud', '1 resultado histórico'
    ]);
    await expect(page.locator('.banco-counter-tag[role="status"]')).toHaveText('1 alumno');
    const totalPeriodo = page.locator('.banco-mini-kpi').filter({ hasText: 'En el periodo' });
    await expect(totalPeriodo.locator('.banco-mini-kpi__num')).toHaveText('1');

    const defectosCabecera = [] as Array<{ width: number; theme: string; medicion: Awaited<ReturnType<typeof inspectCalificacionesHeader>> }>;
    for (const width of [504, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-calificaciones-header-${width}-${theme}.png`),
          fullPage: false,
          animations: 'disabled'
        });
        const medicion = await inspectCalificacionesHeader(page);
        const itemRecortado = medicion.items.some((item) => item.right > medicion.metaRight + 1
          || item.scrollWidth > item.clientWidth + 1);
        const iconoEstandar = medicion.iconCount === 0
          && medicion.navigationIconCount === 1
          && medicion.iconSizes.every((size) => [14, 16, 20, 24, 28, 32].includes(size))
          && medicion.iconStrokeWidths.every((strokeWidth) => strokeWidth === '2px');
        if (medicion.metaScrollWidth > medicion.metaClientWidth + 1 || itemRecortado || medicion.iconCount !== 0 || !iconoEstandar) {
          defectosCabecera.push({ width, theme, medicion });
        }
        await assertNoHorizontalOverflow(page, `Cabecera Calificaciones ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Cabecera Calificaciones ${width}px / ${theme}`);
      }
    }
    expect(defectosCabecera, `Cabecera responsive: duplicados, trazo/tamaño distintos o recorte ${JSON.stringify(defectosCabecera)}`).toEqual([]);

    const historial = screen.locator('#extra-historial-disclosure');
    const registroExterno = screen.locator('#extra-externo-disclosure');
    await expect(historial).not.toHaveAttribute('open', '');
    await expect(registroExterno).not.toHaveAttribute('open', '');
    await page.setViewportSize({ width: 320, height: 800 });
    const alturaContraida = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await expect(screen.locator('.calificaciones-extra__section-head').first()).toHaveCSS('flex-direction', 'column');
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Extraordinarios contraído ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Extraordinarios contraído ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-extraordinarios-contraido-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }

    await page.setViewportSize({ width: 320, height: 800 });
    await historial.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(historial).toHaveAttribute('open', '');
    await expect(historial.getByText('Alexandra Ejemplo Demostración')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(historial).not.toHaveAttribute('open', '');
    await registroExterno.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(registroExterno).toHaveAttribute('open', '');
    const alturaExpandida = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(alturaExpandida - alturaContraida, 'los disclosures deben reducir el recorrido inicial sin recortar su contenido').toBeGreaterThan(250);

    const selectorAlumnoExterno = screen.getByLabel(/^Alumno solicitante elegible/);
    const selectorPdf = screen.getByLabel(/^PDF local/);
    const campoFolio = screen.getByLabel(/^Folio visible/);
    const campoAciertos = screen.getByLabel(/^Aciertos confirmados/);
    const campoReactivos = screen.getByLabel(/^Reactivos evaluables/);
    const campoCriterios = screen.getByLabel(/^Criterios aplicados/);
    await expect(selectorAlumnoExterno).toHaveAttribute('required', '');
    await expect(selectorPdf).toHaveAttribute('required', '');
    for (const campo of [campoFolio, campoAciertos, campoReactivos, campoCriterios]) await expect(campo).toHaveAttribute('required', '');
    await expect(screen.getByLabel(/^Lote documentado/)).not.toHaveAttribute('required');
    await expect(campoAciertos).toHaveAccessibleDescription('Número entero de 0 hasta el total de reactivos evaluables.');
    await expect(campoReactivos).toHaveAccessibleDescription('Número entero mayor que cero.');
    await expect(campoCriterios).toHaveAccessibleDescription('Describe el criterio de revisión en al menos 12 caracteres.');
    await expect(screen.getByText('Describe el criterio de revisión en al menos 12 caracteres.')).toBeVisible();
    await expect(selectorPdf).toHaveAccessibleDescription('Solo se calcula su SHA-256 localmente; no se leen respuestas del archivo. Sin PDF seleccionado.');
    await selectorPdf.setInputFiles({
      name: 'evidencia-extra-dummy.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7 fixture sintético para auditoría')
    });
    await expect(screen.getByRole('status').filter({ hasText: 'evidencia-extra-dummy.pdf' })).toHaveText('Archivo: evidencia-extra-dummy.pdf · SHA-256 calculado');
    const hashDisclosure = screen.locator('.calificaciones-extra__hash-details').filter({ hasText: 'Ver huella SHA-256 del archivo seleccionado' });
    await expect(hashDisclosure).not.toHaveAttribute('open', '');
    await hashDisclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(hashDisclosure.getByText(/^SHA-256 local:/)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(hashDisclosure).not.toHaveAttribute('open', '');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Extraordinarios ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Extraordinarios ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-extraordinarios-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
  });

  test('audita visualmente el generador de reportes con datos ficticios', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('tokenDocente', 'token-e2e-dummy');
      Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
    });
    await page.route('**/api/periodos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: [{ _id: 'periodo-dummy-2a', nombre: 'Evaluación de datos — 2A', grupos: ['2A'], activo: true }] })
      });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alumnos: [
          { _id: 'alumno-dummy-001', nombreCompleto: 'Ana Alumna de Prueba', matricula: 'DUMMY-001', grupo: '2A', periodoId: 'periodo-dummy-2a' },
          { _id: 'alumno-dummy-002', nombreCompleto: 'Benito Pruebas Extensas', matricula: 'DUMMY-002', grupo: '2A', periodoId: 'periodo-dummy-2a' }
        ] })
      });
    });
    await page.route('**/api/analiticas/calificaciones-html', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          html: '<!doctype html><html lang="es-MX"><title>Reporte sintético</title></html>',
          credenciales: [
            { matricula: 'DUMMY-001', nombre: 'Ana Alumna de Prueba', clave: 'Clave_dummy-001_abc123456789' },
            { matricula: 'DUMMY-002', nombre: 'Benito Pruebas Extensas', clave: 'Clave_dummy-002_xyz987654321' }
          ]
        })
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    await page.getByRole('button', { name: /Reportes y exportación/i }).click();
    await expect(page.getByRole('button', { name: /Reportes y exportación/i })).toContainText('Genera y descarga reportes de calificaciones');
    await expect(page.getByRole('heading', { name: 'Reportes y exportación' })).toBeVisible();
    await expect(page.getByText('Exportación de calificaciones', { exact: true })).toBeVisible();
    await expect(page.getByText(/Resultado oficial|Actas y exportación|Prepara el resultado oficial/i)).toHaveCount(0);

    const reportes = page.locator('.calif-deck-card--reports');
    await expect(reportes.getByLabel('Periodo de calificaciones')).toBeEnabled();
    await reportes.getByLabel('Periodo de calificaciones').selectOption('periodo-dummy-2a');
    const generarHtml = reportes.getByRole('button', { name: /Generar \/ actualizar HTML/i });
    const descargarCsv = reportes.getByRole('button', { name: 'Descargar CSV' });
    const descargarXlsx = reportes.getByRole('button', { name: 'Descargar XLSX' });
    const kickerExportacion = page.locator('.calificaciones-view-heading .calificaciones-kicker').filter({ hasText: 'Exportación de calificaciones' });
    const pasarLista = page.getByRole('button', { name: 'Pasar lista' });
    await expect(generarHtml).toBeEnabled();
    await expect(descargarCsv).toBeEnabled();
    await expect(descargarXlsx).toBeEnabled();
    await expect(pasarLista).toBeVisible();
    await expect(kickerExportacion).toBeVisible();
    await expect(reportes.locator('#calificaciones-html-periodo-seleccionado')).toHaveText(/Reporte para: Evaluación de datos — 2A/);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertRenderedTextContrast(kickerExportacion, `Rótulo Exportación de calificaciones ${width}px / ${theme}`);
        await assertSolidButtonTextContrast(generarHtml, `Generar HTML ${width}px / ${theme}`);
        await assertRenderedTextContrast(descargarCsv.locator('.boton__texto'), `Descargar CSV ${width}px / ${theme}`);
        await assertRenderedTextContrast(descargarXlsx.locator('.boton__texto'), `Descargar XLSX ${width}px / ${theme}`);
        await assertSolidButtonTextContrast(pasarLista, `Pasar lista ${width}px / ${theme}`);
        await descargarCsv.hover();
        await assertRenderedTextContrast(descargarCsv.locator('.boton__texto'), `Hover Descargar CSV ${width}px / ${theme}`);
        await descargarXlsx.hover();
        await assertRenderedTextContrast(descargarXlsx.locator('.boton__texto'), `Hover Descargar XLSX ${width}px / ${theme}`);
        await generarHtml.hover();
        await assertSolidButtonTextContrast(generarHtml, `Hover Generar HTML ${width}px / ${theme}`);
        await pasarLista.hover();
        await assertSolidButtonTextContrast(pasarLista, `Hover Pasar lista ${width}px / ${theme}`);
      }
    }
    await page.mouse.move(0, 0);
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-grupo-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 844 });
    await assertNoHorizontalOverflow(page, 'Generador HTML grupal a 320 px');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-grupo-320.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });

    await reportes.getByLabel('Acceso del HTML').selectOption('individual');
    const secretoCiclo = reportes.getByLabel(/Secreto maestro del ciclo/);
    await expect(secretoCiclo).toBeVisible();
    await expect(secretoCiclo).toHaveAttribute('required', '');
    await expect(reportes.getByText('Secreto maestro del ciclo (obligatorio)', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    await reportes.getByRole('button', { name: /Generar \/ actualizar HTML/i }).click();
    await expect(reportes.getByText('Escribe un secreto de al menos 20 caracteres para generar las claves individuales.')).toBeVisible();
    await expect(secretoCiclo).toHaveAttribute('aria-invalid', 'true');
    await assertNoHorizontalOverflow(page, 'Error del secreto individual a 320 px');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-error-secreto-320.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await secretoCiclo.fill('corto');
    await reportes.getByRole('button', { name: /Generar \/ actualizar HTML/i }).click();
    await expect(reportes.getByText('Escribe un secreto de al menos 20 caracteres para generar las claves individuales.')).toBeVisible();
    await expect(secretoCiclo).toHaveAttribute('aria-invalid', 'true');
    await secretoCiclo.fill('secreto-maestro-dummy-de-prueba-2026');
    await expect(secretoCiclo).not.toHaveAttribute('aria-invalid', 'true');
    const alternarSecreto = reportes.getByRole('button', { name: 'Mostrar secreto maestro' });
    await expect(secretoCiclo).toHaveAttribute('type', 'password');
    await expect(alternarSecreto).toHaveAttribute('aria-pressed', 'false');
    for (const theme of ['light', 'dark'] as const) {
      await setVisibleTheme(page, theme);
      await secretoCiclo.focus();
      await page.keyboard.press('Tab');
      await expect(alternarSecreto).toBeFocused();
      const contrasteToggle = await alternarSecreto.evaluate((button) => {
        const channels = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
        const luminance = (color: string) => {
          const rgb = channels(color).map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return (0.2126 * rgb[0]!) + (0.7152 * rgb[1]!) + (0.0722 * rgb[2]!);
        };
        const contrast = (foreground: string, background: string) => {
          const light = luminance(foreground);
          const dark = luminance(background);
          return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
        };
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          icon: contrast(style.color, style.backgroundColor),
          boundary: contrast(style.borderTopColor, style.backgroundColor),
          focus: contrast(style.outlineColor, style.backgroundColor),
          outlineColor: style.outlineColor,
          backgroundColor: style.backgroundColor,
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle
        };
      });
      expect(contrasteToggle.width, `${theme}: área táctil mínima de 44 px`).toBeGreaterThanOrEqual(44);
      expect(contrasteToggle.height, `${theme}: área táctil mínima de 44 px`).toBeGreaterThanOrEqual(44);
      expect(contrasteToggle.icon, `${theme}: icono del control al menos 3:1`).toBeGreaterThanOrEqual(3);
      expect(contrasteToggle.boundary, `${theme}: límite del control al menos 3:1`).toBeGreaterThanOrEqual(3);
      expect(contrasteToggle.focus, `${theme}: foco visible ${contrasteToggle.outlineColor} sobre ${contrasteToggle.backgroundColor} al menos 3:1`).toBeGreaterThanOrEqual(3);
      expect(contrasteToggle.outlineWidth).toBe('3px');
      expect(contrasteToggle.outlineStyle).toBe('solid');
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await secretoCiclo.fill('secreto-maestro-dummy-de-prueba-2026');
    await alternarSecreto.click();
    await expect(secretoCiclo).toHaveAttribute('type', 'text');
    await expect(secretoCiclo).toHaveValue('secreto-maestro-dummy-de-prueba-2026');
    await expect(alternarSecreto).toHaveAttribute('aria-pressed', 'true');
    await alternarSecreto.press('Space');
    await expect(secretoCiclo).toHaveAttribute('type', 'password');
    await expect(alternarSecreto).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-individual-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 844 });
    await assertNoHorizontalOverflow(page, 'Generador HTML individual a 320 px');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-individual-320.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    const descargaHtml = page.waitForEvent('download');
    await reportes.getByRole('button', { name: /Generar \/ actualizar HTML/i }).click();
    await descargaHtml;
    await expect(secretoCiclo).toHaveAttribute('type', 'password');
    await expect(secretoCiclo).toHaveValue('');
    await expect(alternarSecreto).toHaveAttribute('aria-pressed', 'false');
    await expect(reportes.getByRole('heading', { name: 'Claves individuales para enviar' })).toBeVisible();
    await expect(reportes.getByText(/Reporte HTML descargado\. Para publicarlo en OneDrive, guarda este archivo allí y, si ya existe uno, reemplázalo; espera a que termine la sincronización antes de compartirlo\./)).toBeVisible();
    const claveAna = reportes.getByText('Clave_dummy-001_abc123456789', { exact: true });
    await expect(claveAna).toHaveCSS('user-select', 'all');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as Window & { __textoPortapapelesDummy?: string }).__textoPortapapelesDummy = text;
          }
        }
      });
    });
    const copiarAna = reportes.getByRole('button', { name: 'Copiar clave de Ana Alumna de Prueba, matrícula DUMMY-001' });
    await copiarAna.focus();
    await page.keyboard.press('Enter');
    await expect(reportes.getByRole('status').filter({ hasText: 'Clave de DUMMY-001 copiada. Envíala solo a ese alumno.' })).toBeVisible();
    const textoPortapapelesDummy = await page.evaluate(() => (window as Window & { __textoPortapapelesDummy?: string }).__textoPortapapelesDummy ?? '');
    expect(textoPortapapelesDummy).toBe('Clave_dummy-001_abc123456789');
    const copiarBenito = reportes.getByRole('button', { name: 'Copiar clave de Benito Pruebas Extensas, matrícula DUMMY-002' });
    await copiarBenito.focus();
    await page.keyboard.press('Space');
    await expect(reportes.getByRole('status').filter({ hasText: 'Clave de DUMMY-002 copiada. Envíala solo a ese alumno.' })).toBeVisible();
    textoPortapapelesDummy = await page.evaluate(() => (window as Window & { __textoPortapapelesDummy?: string }).__textoPortapapelesDummy ?? '');
    expect(textoPortapapelesDummy).toBe('Clave_dummy-002_xyz987654321');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('portapapeles no disponible'); } }
    }));
    await copiarAna.focus();
    await page.keyboard.press('Enter');
    await expect(reportes.getByRole('alert').filter({ hasText: 'No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.' })).toBeVisible();
    const fallbackDentroDelViewport = await reportes.getByRole('alert').evaluate((alerta) => {
      const bounds = alerta.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    });
    expect(fallbackDentroDelViewport, 'El fallo de copia debe quedar visible junto a las claves sin exigir otro desplazamiento').toBe(true);
    await expect(reportes.getByText(/El HTML es autónomo: no se actualiza solo/)).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Generador HTML individual móvil');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-claves-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-claves-light-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 844 });
    await assertNoHorizontalOverflow(page, 'Claves individuales a 320 px');
    for (const item of await reportes.locator('.calif-claves-reporte__item').all()) {
      const matricula = (await item.locator('dd').nth(0).locator('code').innerText()).trim();
      await assertRenderedTextContrast(item.locator('dd').nth(0).locator('code'), `Matrícula ${matricula} en la lista de claves / claro`);
      await assertRenderedTextContrast(item.locator('dd').nth(1).locator('code'), `Clave personal de ${matricula} / claro`);
      await assertRenderedTextContrast(item.locator('h5'), `Nombre de ${matricula} en la lista de claves / claro`);
      await assertRenderedTextContrast(item.getByRole('button', { name: 'Copiar clave' }).locator('.boton__texto'), `Acción de copia para ${matricula} / claro`);
    }
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-claves-320-light.png'), fullPage: true, animations: 'disabled' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    for (const item of await reportes.locator('.calif-claves-reporte__item').all()) {
      const matricula = (await item.locator('dd').nth(0).locator('code').innerText()).trim();
      await assertRenderedTextContrast(item.locator('dd').nth(0).locator('code'), `Matrícula ${matricula} en la lista de claves / oscuro`);
      await assertRenderedTextContrast(item.locator('dd').nth(1).locator('code'), `Clave personal de ${matricula} / oscuro`);
      await assertRenderedTextContrast(item.locator('h5'), `Nombre de ${matricula} en la lista de claves / oscuro`);
      await assertRenderedTextContrast(item.getByRole('button', { name: 'Copiar clave' }).locator('.boton__texto'), `Acción de copia para ${matricula} / oscuro`);
    }
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-claves-320-dark.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await assertNoHorizontalOverflow(page, 'Generador HTML individual escritorio');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await assertRenderedTextContrast(kickerExportacion, `Rótulo Exportación de calificaciones escritorio / ${theme}`);
    }
    const camposPrincipales = await Promise.all([
      reportes.locator('.calif-deck-card__field--period').boundingBox(),
      reportes.locator('.calif-deck-card__field--access').boundingBox()
    ]);
    expect(camposPrincipales[0] && camposPrincipales[1], 'los selectores de periodo y acceso deben estar visibles en escritorio').toBeTruthy();
    expect(Math.abs(camposPrincipales[0]!.y - camposPrincipales[1]!.y), 'periodo y acceso deben compartir una fila').toBeLessThanOrEqual(2);
    expect(camposPrincipales[1]!.x, 'el selector de acceso debe ocupar la segunda columna').toBeGreaterThan(camposPrincipales[0]!.x);
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-reportes-claves-desktop.png'), fullPage: true, animations: 'disabled' });
  });

  test('audita Classroom dentro de Calificaciones con datos sintéticos', async ({ page }) => {
    // Incluye varios ciclos de carga, recuperación y capturas responsive; el límite global
    // de 45 s provocaba fallos por timeout en runners lentos aunque la interfaz respondiera.
    test.setTimeout(90_000);
    const periodoId = 'periodo-classroom-dummy-2a';
    const cursoId = 'curso-classroom-dummy-2a';
    let fallarConsultaEvidencias = false;
    let estadoConsultaCursos: 'exitoso' | 'error' | 'vacio' = 'exitoso';
    let estadoConsultaRoster: 'exitoso' | 'error' = 'exitoso';
    let estadoConsultaActividades: 'exitoso' | 'error' = 'exitoso';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-classroom-calificaciones-dummy'));
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ docente: {
        _id: 'docente-classroom-calificaciones-dummy', nombre: 'Docente de prueba', correo: 'classroom@example.invalid',
        permisos: ['periodos:leer', 'alumnos:leer', 'evaluaciones:leer', 'classroom:pull', 'calificaciones:calificar'], roles: ['docente']
      } }) });
    });
    await page.route('**/api/autenticacion/capacidades-integraciones', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/periodos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos: [
        { _id: periodoId, nombre: 'Evaluación de datos', grupos: ['2A'], activo: true }
      ] }) });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos: [
        { _id: 'alumno-classroom-dummy-1', nombreCompleto: 'Ana Alumna de Prueba', matricula: 'DUMMY-001', grupo: '2A', periodoId },
        { _id: 'alumno-classroom-dummy-2', nombreCompleto: 'Benito Alumno de Prueba', matricula: 'DUMMY-002', grupo: '2A', periodoId }
      ] }) });
    });
    await page.route('**/api/evaluaciones/evidencias**', async (route) => {
      if (fallarConsultaEvidencias) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ evidencias: [
        { id: 'evidencia-classroom-dummy', alumnoId: 'alumno-classroom-dummy-1', titulo: 'Práctica inicial', fechaEvidencia: '2026-10-28T12:00:00.000Z', calificacionDecimal: 9, estadoCaptura: 'calificada', fuente: 'classroom', classroom: { courseId: cursoId, courseWorkId: 'actividad-classroom-dummy', submissionId: 'entrega-classroom-dummy', courseWorkTitle: 'Práctica inicial', assignedGrade: 90, maxPoints: 100, submissionState: 'TURNED_IN' }, metadata: { alternateLink: 'https://classroom.google.com/c/curso-classroom-dummy-2a/a/actividad-classroom-dummy/details' } }
      ], nextCursor: null }) });
    });
    await page.route('**/api/evaluaciones/v2/classroom/alumnos/alumno-classroom-dummy-1/cortes/1/historial**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ eventos: [
        { id: 'historial-classroom-dummy-1', corte: 1, promedioSobre10: 7, estado: 'calculado', puntosObtenidos: 70, puntosPosibles: 100, capturaHash: 'hash-dummy-classroom-123456', capturaBytes: 2048, createdAt: '2026-10-28T12:00:00.000Z' }
      ], nextCursor: null }) });
    });
    await page.route('**/api/evaluaciones/v2/classroom/historial-cortes/historial-classroom-dummy-1/captura', async (route) => {
      const fichaSintetica = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
        <rect width="960" height="540" rx="28" fill="#10243b"/><rect x="24" y="24" width="912" height="492" rx="20" fill="#183c5c" stroke="#4ebbd2" stroke-width="2"/>
        <text x="64" y="92" fill="#77d9e5" font-family="sans-serif" font-size="22" font-weight="700">EVALUAPRO · HISTORIAL CLASSROOM · DATOS DE PRUEBA</text>
        <text x="64" y="164" fill="#f4f8fc" font-family="sans-serif" font-size="38" font-weight="700">Promedio del primer parcial</text>
        <text x="64" y="218" fill="#c2d3e3" font-family="sans-serif" font-size="26">Ana Alumna de Prueba · Evaluación de datos</text>
        <text x="64" y="338" fill="#83e4c0" font-family="sans-serif" font-size="72" font-weight="700">7.00 / 10</text>
        <text x="64" y="394" fill="#c2d3e3" font-family="sans-serif" font-size="24">70 de 100 puntos · captura sintética</text>
        <text x="64" y="466" fill="#9cb5cb" font-family="sans-serif" font-size="20">La imagen solo verifica presentación y reflujo; no contiene calificaciones reales.</text>
      </svg>`;
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: fichaSintetica });
    });
    await page.route('**/api/evaluaciones/v2/classroom/cursos', async (route) => {
      if (estadoConsultaCursos === 'error') {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cursos: estadoConsultaCursos === 'vacio' ? [] : [
        { id: cursoId, name: 'Evaluación de datos', section: '2A', courseState: 'ACTIVE' }
      ] }) });
    });
    await page.route(`**/api/evaluaciones/v2/classroom/cursos/${cursoId}/alumnos**`, async (route) => {
      if (estadoConsultaRoster === 'error') {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnosClassroom: [
        { classroomUserId: 'cuenta-classroom-dummy-1', fullName: 'Ana Alumna de Prueba', emailAddress: 'ana@example.invalid', alumnoIdConfirmado: 'alumno-classroom-dummy-1' },
        { classroomUserId: 'cuenta-classroom-dummy-2', fullName: 'Benito Alumno de Prueba', emailAddress: 'benito@example.invalid', alumnoIdConfirmado: null }
      ] }) });
    });
    await page.route(`**/api/evaluaciones/v2/classroom/cursos/${cursoId}/actividades**`, async (route) => {
      if (estadoConsultaActividades === 'error') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Fallo temporal ficticio de Classroom.' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        curso: { id: cursoId, name: 'Evaluación de datos', section: '2A', courseState: 'ACTIVE', updateTime: null, alternateLink: null },
        actividades: [{ id: 'actividad-classroom-dummy', courseId: cursoId, title: 'Práctica inicial', description: 'Resuelve el ejercicio de diagnóstico.', topicId: 'tema-classroom-dummy', topicName: 'Unidad 1', workType: 'ASSIGNMENT', state: 'PUBLISHED', dueDate: { year: 2026, month: 10, day: 30 }, dueTime: { hours: 23, minutes: 59 }, maxPoints: 100, mapeo: { corte: 1 }, materials: [] }],
        temas: [{ id: 'tema-classroom-dummy', name: 'Unidad 1' }], completa: true, errores: []
      }) });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espacios = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await seleccionarEspacioClassroom(espacios);
    const screen = page.getByRole('region', { name: 'Calificaciones asignadas y evidencias' });
    await screen.getByLabel('Materia local destino').selectOption(periodoId);
    await screen.getByLabel('Curso de Classroom').selectOption(cursoId);
    await expect(screen.getByLabel('Curso de Classroom')).toHaveAccessibleDescription('Curso seleccionado: Evaluación de datos · 2A');
    await expect(screen.getByRole('cell', { name: 'Actividad Práctica inicial' })).toBeVisible();
    const buscarEstudianteVinculado = screen.getByRole('searchbox', { name: 'Buscar estudiante vinculado' });
    await expect(buscarEstudianteVinculado).toBeVisible();
    await expect(buscarEstudianteVinculado).toHaveAttribute('placeholder', 'Nombre o matrícula');
    await expect(buscarEstudianteVinculado).toHaveAccessibleDescription('Busca por nombre, correo o matrícula.');
    const buscarEvidencias = screen.getByRole('searchbox', { name: 'Buscar evidencias' });
    await expect(buscarEvidencias).toHaveAttribute('placeholder', 'Alumno o actividad');
    await expect(buscarEvidencias).toHaveAccessibleDescription('También puedes buscar por matrícula, nota o estado.');
    await expect(screen.getByText('Mostrando 2 de 2 estudiantes')).toBeVisible();
    await expect(screen.getByLabel('Alumno de EvaluaPro para Ana Alumna de Prueba')).toHaveAccessibleDescription('Destino actual: Ana Alumna de Prueba · matrícula DUMMY-001');
    await expect(screen.getByText('Destino actual: Ana Alumna de Prueba · matrícula DUMMY-001')).toBeVisible();
    await expect(screen.getByText('Aún sin vincular. Elige el expediente local correspondiente.')).toBeVisible();
    const tablaEvidencias = screen.locator('.classroom-evidencias-table');
    const filaEvidencia = tablaEvidencias.locator('tbody tr').first();
    const enlaceActividad = screen.getByRole('link', { name: 'Abrir en Google Classroom: Práctica inicial' });
    await expect(enlaceActividad).toBeVisible();
    await expect(enlaceActividad).toHaveAttribute('href', /^https:\/\/classroom\.google\.com\//);
    await expect(filaEvidencia.locator('[data-label="Actividad"]')).toHaveText('Práctica inicial');
    await expect(tablaEvidencias).toHaveRole('table');
    await expect(tablaEvidencias.getByRole('columnheader', { name: 'Actividad', includeHidden: true })).toBeAttached();

    const historialPromedio = screen.getByRole('region', { name: 'Historial del promedio Classroom por parcial' });
    await historialPromedio.getByLabel('Alumno').selectOption('alumno-classroom-dummy-1');
    await expect(historialPromedio.getByLabel('Alumno')).toHaveAccessibleDescription('Alumno del historial: Ana Alumna de Prueba · matrícula DUMMY-001');
    await historialPromedio.getByRole('button', { name: 'Consultar historial' }).click();
    await expect(historialPromedio.getByText('Cada registro muestra la calificación guardada en ese momento. Las reentregas pendientes no cambian este historial hasta que las confirmes.')).toBeVisible();
    await expect(historialPromedio.getByText('Mostrando 1 registro del promedio.')).toBeVisible();
    await expect(historialPromedio.getByText('Puntos: 70 de 100')).toBeVisible();
    await expect(historialPromedio.getByText(/snapshot/i)).toHaveCount(0);
    const fichaPromedio = historialPromedio.getByRole('img', { name: /Captura de ficha: 7 de 10, 1° parcial, Ana Alumna de Prueba/ });
    await expect(fichaPromedio).toBeVisible();
    await expect.poll(() => fichaPromedio.evaluate((imagen: HTMLImageElement) => imagen.naturalWidth)).toBe(960);
    await expect.poll(() => fichaPromedio.evaluate((imagen: HTMLImageElement) => imagen.naturalHeight)).toBe(540);
    const detallesTecnicos = historialPromedio.locator('details.classroom-grade-history__technical');
    const resumenTecnico = detallesTecnicos.locator('summary');
    await expect(detallesTecnicos).toHaveJSProperty('open', false);
    await resumenTecnico.focus();
    await page.keyboard.press('Enter');
    await expect(detallesTecnicos).toHaveJSProperty('open', true);
    await expect(historialPromedio.getByText(/Código de verificación SHA-256/)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(detallesTecnicos).toHaveJSProperty('open', false);

    for (const width of [320, 390, 700]) {
      await page.setViewportSize({ width, height: width === 320 ? 800 : 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertTextContrastOnBackdrop(enlaceActividad, screen.locator('.calificaciones-consulta__table-wrap'), `Enlace Classroom ${width}px / ${theme}`);
        await expect(enlaceActividad).toHaveCSS('text-decoration-line', 'underline');
        await enlaceActividad.hover();
        await assertTextContrastOnBackdrop(enlaceActividad, screen.locator('.calificaciones-consulta__table-wrap'), `Hover del enlace Classroom ${width}px / ${theme}`);
        await page.mouse.move(0, 0);
        await assertNoHorizontalOverflow(page, `Classroom en Calificaciones ${width}px / ${theme}`);
        await assertVisibleHeadersFit(page, `Classroom en Calificaciones ${width}px / ${theme}`);
        const geometriaFila = await filaEvidencia.evaluate((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLElement>(':scope > [data-label]'));
          return {
            columnas: getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/).length,
            celdas: cells.map((cell) => {
              const bounds = cell.getBoundingClientRect();
              return {
                x: bounds.x,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width,
                clientWidth: cell.clientWidth,
                scrollWidth: cell.scrollWidth
              };
            })
          };
        });
        expect(geometriaFila.columnas, 'cada evidencia debe usar una sola columna en móvil').toBe(1);
        expect(geometriaFila.celdas, 'la ficha debe identificar sus siete campos').toHaveLength(7);
        for (const [index, cell] of geometriaFila.celdas.entries()) {
          expect(cell.width, 'cada campo debe conservar un ancho útil').toBeGreaterThan(180);
          expect(cell.scrollWidth, 'el contenido no debe desbordar su campo').toBeLessThanOrEqual(cell.clientWidth + 1);
          if (index > 0) {
            expect(geometriaFila.celdas[index - 1].bottom, 'los campos apilados no deben solaparse').toBeLessThanOrEqual(cell.top + 1);
            expect(Math.abs(geometriaFila.celdas[index - 1].x - cell.x), 'los campos apilados deben compartir alineación').toBeLessThanOrEqual(1);
          }
        }
        if (width <= 390) {
          const actividadPorTema = screen.locator('.classroom-sync-topics details.item-row').first();
          const summary = actividadPorTema.locator('summary');
          const divider = await screen.locator('.classroom-sync-mapping').evaluate((element) => getComputedStyle(element).borderTopStyle);
          const geometry = await actividadPorTema.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return { width: bounds.width };
          });
          const summaryGeometry = await summary.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth
          }));
          expect(divider, 'la agrupación simplificada debe conservar un separador visible').toBe('solid');
          expect(geometry.width, 'la actividad por tema debe mantener un ancho útil al reducir tarjetas anidadas').toBeGreaterThan(180);
          expect(summaryGeometry.scrollWidth, 'el resumen de actividad no debe comprimirse ni desbordarse').toBeLessThanOrEqual(summaryGeometry.clientWidth + 1);
        }
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-classroom-calificaciones-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await assertNoHorizontalOverflow(page, 'Classroom en Calificaciones escritorio');
    await expect(tablaEvidencias).toHaveCSS('display', 'table');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-classroom-calificaciones-desktop.png'), fullPage: true, animations: 'disabled' });

    fallarConsultaEvidencias = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navRecuperado = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navRecuperado).toBeVisible({ timeout: 15_000 });
    await navRecuperado.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espaciosRecuperados = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await seleccionarEspacioClassroom(espaciosRecuperados);
    const pantallaErrorEvidencias = page.getByRole('region', { name: 'Calificaciones asignadas y evidencias' });
    await pantallaErrorEvidencias.getByLabel('Materia local destino').selectOption(periodoId);
    await expect(pantallaErrorEvidencias.getByRole('button', { name: 'Reintentar consulta de evidencias' })).toBeVisible({ timeout: 15_000 });
    await expect(pantallaErrorEvidencias.getByRole('alert')).toHaveText(/No se pudo consultar la lista de evidencias de esta materia/);
    await expect(pantallaErrorEvidencias.getByText('No hay calificaciones Classroom sincronizadas para esta materia.')).toHaveCount(0);
    await expect(pantallaErrorEvidencias.getByText(/Mostrando \d+ de \d+ evidencias/)).toHaveCount(0);
    await expect(pantallaErrorEvidencias.locator('.classroom-evidencias-table')).toHaveCount(0);

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Error de evidencias Classroom ${width}px / ${theme}`);
        await expect(pantallaErrorEvidencias.getByRole('button', { name: 'Reintentar consulta de evidencias' })).toBeVisible();
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-classroom-evidencias-error-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }

    fallarConsultaEvidencias = false;
    const reintentarEvidencias = pantallaErrorEvidencias.getByRole('button', { name: 'Reintentar consulta de evidencias' });
    await reintentarEvidencias.focus();
    await expect(reintentarEvidencias).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(pantallaErrorEvidencias.getByRole('cell', { name: 'Actividad Práctica inicial' })).toBeVisible();

    estadoConsultaCursos = 'error';
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navErrorCursos = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navErrorCursos).toBeVisible({ timeout: 15_000 });
    await navErrorCursos.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espaciosErrorCursos = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await seleccionarEspacioClassroom(espaciosErrorCursos);
    const pantallaCursos = page.getByRole('region', { name: 'Calificaciones asignadas y evidencias' });
    await pantallaCursos.getByLabel('Materia local destino').selectOption(periodoId);
    const reintentarCursos = pantallaCursos.getByRole('button', { name: 'Reintentar consulta de cursos' });
    await expect(reintentarCursos).toBeVisible({ timeout: 15_000 });
    await expect(pantallaCursos.getByRole('alert')).toHaveText('No se pudieron consultar los cursos de Google Classroom. Verifica la conexión con EvaluaPro e inténtalo de nuevo.');
    await expect(pantallaCursos.getByText('No hay cursos activos disponibles. Revisa la conexión en Classroom o vuelve a cargar la sección.')).toHaveCount(0);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Error de cursos Classroom ${width}px / ${theme}`);
        await assertPanelTextFitsViewport(page, pantallaCursos.locator('.classroom-sync-shell'), `Error de cursos Classroom ${width}px / ${theme}`);
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-classroom-cursos-error-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }

    estadoConsultaCursos = 'vacio';
    await reintentarCursos.focus();
    await page.keyboard.press('Enter');
    await expect(pantallaCursos.getByText('No hay cursos activos disponibles. Revisa la conexión en Classroom o vuelve a cargar la sección.')).toBeVisible();
    await expect(pantallaCursos.getByRole('button', { name: 'Reintentar consulta de cursos' })).toHaveCount(0);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        await assertNoHorizontalOverflow(page, `Cursos Classroom vacíos ${width}px / ${theme}`);
        await assertPanelTextFitsViewport(page, pantallaCursos.locator('.classroom-sync-shell'), `Cursos Classroom vacíos ${width}px / ${theme}`);
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-classroom-cursos-vacio-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }

    estadoConsultaCursos = 'exitoso';
    estadoConsultaRoster = 'error';
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navErrorRoster = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navErrorRoster).toBeVisible({ timeout: 15_000 });
    await navErrorRoster.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espaciosErrorRoster = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await seleccionarEspacioClassroom(espaciosErrorRoster);
    const pantallaRoster = page.getByRole('region', { name: 'Calificaciones asignadas y evidencias' });
    await pantallaRoster.getByLabel('Materia local destino').selectOption(periodoId);
    await pantallaRoster.getByLabel('Curso de Classroom').selectOption(cursoId);
    const reintentarRoster = pantallaRoster.getByRole('button', { name: 'Reintentar consulta de estudiantes' });
    await expect(reintentarRoster).toBeVisible({ timeout: 15_000 });
    await expect(pantallaRoster.getByRole('alert')).toHaveText('No se pudo consultar la vinculación de estudiantes. Verifica la conexión con EvaluaPro e inténtalo de nuevo.');
    await expect(pantallaRoster.getByText('No hay estudiantes disponibles en el curso seleccionado.')).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await assertNoHorizontalOverflow(page, `Error de estudiantes Classroom 320px / ${theme}`);
      await assertPanelTextFitsViewport(page, pantallaRoster.locator('.classroom-sync-shell'), `Error de estudiantes Classroom 320px / ${theme}`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-classroom-roster-error-320-${theme}.png`), fullPage: true, animations: 'disabled' });
    }
    estadoConsultaRoster = 'exitoso';
    await reintentarRoster.focus();
    await page.keyboard.press('Enter');
    await expect(pantallaRoster.getByText('Mostrando 2 de 2 estudiantes')).toBeVisible();

    estadoConsultaActividades = 'error';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const navErrorActividades = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(navErrorActividades).toBeVisible({ timeout: 15_000 });
    await navErrorActividades.locator('#navegacion-docente-movil').selectOption({ label: 'Calificaciones' });
    const espaciosErrorActividades = page.getByRole('navigation', { name: 'Espacios de calificaciones' });
    await seleccionarEspacioClassroom(espaciosErrorActividades);
    const pantallaActividades = page.getByRole('region', { name: 'Calificaciones asignadas y evidencias' });
    await pantallaActividades.getByLabel('Materia local destino').selectOption(periodoId);
    await pantallaActividades.getByLabel('Curso de Classroom').selectOption(cursoId);
    const reintentarActividades = pantallaActividades.getByRole('button', { name: 'Reintentar consulta de actividades' });
    await expect(reintentarActividades).toBeVisible({ timeout: 15_000 });
    await expect(pantallaActividades.getByRole('alert')).toHaveText('Fallo temporal ficticio de Classroom. Tip: intenta mas tarde.');
    await expect(pantallaActividades.getByText('No hay actividades publicadas para mapear en este curso.')).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
      await assertNoHorizontalOverflow(page, `Error de actividades Classroom 320px / ${theme}`);
      await assertPanelTextFitsViewport(page, pantallaActividades.locator('.classroom-sync-shell'), `Error de actividades Classroom 320px / ${theme}`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-classroom-actividades-error-320-${theme}.png`), fullPage: true, animations: 'disabled' });
    }
    estadoConsultaActividades = 'exitoso';
    await reintentarActividades.focus();
    await page.keyboard.press('Enter');
    await expect(pantallaActividades.locator('.classroom-sync-topics').getByText('Práctica inicial')).toBeVisible();
  });

  test('audita visualmente Alumnos con lista y formulario ficticios', async ({ page }) => {
    const actualizacionesAlumnosFicticias: Array<{ method: string; path: string; payload: unknown }> = [];
    const escriturasBloqueadas: string[] = [];
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-alumnos-dummy'));
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return;
      }
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path === '/api/analiticas/eventos-uso') {
        await route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
        return;
      }
      escriturasBloqueadas.push(`${request.method()} ${path}`);
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Escritura bloqueada fuera de la actualización ficticia de Alumnos.' }) });
    });
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-alumnos-dummy', nombre: 'Docente de Prueba', correo: 'docente-dummy@evaluapro.local',
          permisos: ['periodos:leer', 'alumnos:leer', 'alumnos:gestionar', 'evaluaciones:leer', 'calificaciones:calificar'],
          roles: ['docente']
        } })
      });
    });
    await page.route('**/api/periodos**', async (route) => {
      const archived = new URL(route.request().url()).searchParams.get('activo') === '0';
      const periodos = archived ? [] : [{
        _id: 'periodo-alumnos-dummy-2a', nombre: 'Evaluación de datos — 2A', grupos: ['2A', '2B'], activo: true,
        fechaInicio: '2026-08-24'
      }];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periodos }) });
    });
    let anaMariaDummy = {
      _id: 'alumno-dummy-001', periodoId: 'periodo-alumnos-dummy-2a', matricula: 'CUH512410168',
      nombres: 'Ana María', apellidos: 'Gómez Ruiz', nombreCompleto: 'Ana María Gómez Ruiz',
      correo: 'ana-dummy@evaluapro.local', grupo: '2A', activo: true
    };
    const benitoDummy = {
      _id: 'alumno-dummy-002', periodoId: 'periodo-alumnos-dummy-2a', matricula: 'CUH123456789',
      nombres: 'Benito', apellidos: 'Pruebas Extensas', nombreCompleto: 'Benito Pruebas Extensas',
      correo: 'benito-dummy@evaluapro.local', grupo: '2B', activo: true
    };
    await page.route('**/api/alumnos**', async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && path === '/api/alumnos/alumno-dummy-001/actualizar') {
          const payload = request.postDataJSON() as Record<string, unknown>;
          actualizacionesAlumnosFicticias.push({ method: request.method(), path, payload });
          anaMariaDummy = { ...anaMariaDummy, ...payload } as typeof anaMariaDummy;
          anaMariaDummy.nombreCompleto = `${anaMariaDummy.nombres} ${anaMariaDummy.apellidos}`;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumno: anaMariaDummy }) });
          return;
        }
        escriturasBloqueadas.push(`${request.method()} ${path}`);
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Actualización fuera del fixture permitido.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alumnos: [anaMariaDummy, benitoDummy] })
      });
    });
    await page.route('**/api/asistencias/resumen**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resumen: [
          { alumnoId: 'alumno-dummy-001', faltas: 4 },
          { alumnoId: 'alumno-dummy-002', faltas: 1 }
        ] })
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Alumnos' });
    await expect(page.getByRole('heading', { name: 'Alumnos', exact: true })).toBeVisible();
    const listaMateria = page.getByLabel('Materia de la lista');
    await listaMateria.selectOption('periodo-alumnos-dummy-2a');
    await expect(listaMateria).toHaveAccessibleDescription(
      'Lista actual: Evaluación de datos — 2A. Cambia solo la lista de abajo; no cambia el formulario.'
    );
    await expect(page.locator('#alumnos-lista-materia-ayuda')).toHaveText(
      'Lista actual: Evaluación de datos — 2A. Cambia solo la lista de abajo; no cambia el formulario.'
    );
    await expect(page.getByText('Ana María Gómez Ruiz')).toBeVisible();
    await expect(page.locator('.badge-alerta-inasistencias')).toBeVisible();
    const accesoLista = page.getByRole('link', { name: 'Ver lista de alumnos' });
    const encabezadoLista = page.getByRole('heading', { name: 'Alumnos de la materia' });
    await expect(accesoLista).toBeVisible();
    await expect(encabezadoLista).toHaveAttribute('id', 'alumnos-lista-heading');
    await expect(page.locator('#alumnos-lista-heading')).toHaveCount(1);
    await accesoLista.focus();
    await page.keyboard.press('Enter');
    await expect(encabezadoLista).toBeFocused();
    const encabezadoListaEnViewport = await encabezadoLista.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    expect(encabezadoListaEnViewport, 'El enlace de cabecera lleva foco y vista al inicio de la lista').toBe(true);
    await assertNoHorizontalOverflow(page, 'Alumnos con registros ficticios');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-alumnos-lista-dummy-mobile.png'), fullPage: true, animations: 'disabled' });
    await expect(page.getByRole('group', { name: 'Filtrar por grupo:' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Grupo' })).toHaveCount(0);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const camposFiltroLista = await page.locator('.alumnos-explorador > .alumnos-filtros--glass > .campo').evaluateAll((campos) =>
        campos.map((campo) => {
          const rect = campo.getBoundingClientRect();
          return { left: rect.left, top: rect.top, bottom: rect.bottom };
        })
      );
      expect(camposFiltroLista).toHaveLength(2);
      expect(Math.abs(camposFiltroLista[0]!.left - camposFiltroLista[1]!.left), `Alumnos ${width}px: filtros apilados`).toBeLessThanOrEqual(1);
      expect(camposFiltroLista[1]!.top, `Alumnos ${width}px: búsqueda debajo de materia`).toBeGreaterThanOrEqual(camposFiltroLista[0]!.bottom);
      const placeholderBusqueda = await page.getByRole('searchbox', { name: 'Buscar alumno' }).evaluate((element) => {
        const input = element as HTMLInputElement;
        const style = getComputedStyle(input);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        context.font = style.font;
        return {
          value: input.placeholder,
          textWidth: context.measureText(input.placeholder).width,
          usableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        };
      });
      expect(placeholderBusqueda.value).toBe('Nombre');
      expect(placeholderBusqueda.textWidth, `Alumnos ${width}px: placeholder de búsqueda completo`).toBeLessThanOrEqual(placeholderBusqueda.usableWidth);
      await expect(page.locator('#alumnos-busqueda-ayuda')).toContainText('nombre, matrícula o correo');
      const resumenMateriaLista = await page.locator('#alumnos-lista-materia-ayuda').evaluate((element) => ({
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth
      }));
      expect(resumenMateriaLista.clientWidth, `Alumnos ${width}px: nombre de lista visible`).toBeGreaterThan(0);
      expect(resumenMateriaLista.scrollWidth, `Alumnos ${width}px: nombre de lista sin recorte`).toBeLessThanOrEqual(resumenMateriaLista.clientWidth);
      expect(resumenMateriaLista.scrollHeight, `Alumnos ${width}px: nombre de lista sin recorte vertical`).toBeLessThanOrEqual(resumenMateriaLista.clientHeight);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await assertNoHorizontalOverflow(page, `Lista de Alumnos ${width}px / ${theme}`);
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-lista-filtro-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await assertNoHorizontalOverflow(page, `Lista de Alumnos escritorio ${viewport.width}px / ${theme}`);
        await expect(encabezadoLista).toBeVisible();
        await expect(page.locator('.alumnos-panel__title svg')).toHaveCount(0);
        await expect(page.locator('.alumnos-panel__icon-orb svg')).toHaveCount(1);
        await expect(page.getByRole('group', { name: 'Filtrar por grupo:' })).toBeVisible();
        await expect(page.locator('.alumnos-lista__item')).toHaveCount(2);
        await expect(page.locator('.alumnos-form--panoramico').getByRole('heading', { name: 'Registrar alumno' })).toBeVisible();
        const areasAlumnos = await page.locator('.alumnos-panel__head, .alumnos-form--panoramico, .alumnos-explorador, .alumnos-lista__item').evaluateAll((elements) =>
          elements.map((element) => ({
            selector: element.className,
            width: element.clientWidth,
            scrollWidth: element.scrollWidth
          }))
        );
        expect(areasAlumnos.filter((area) => area.scrollWidth > area.width + 1), `El contenido de Alumnos debe caber en sus secciones a ${viewport.width}px / ${theme}`).toEqual([]);
        const separacionesCampos = await page.locator('.alumnos-form--panoramico .alumnos-form__row > .campo').evaluateAll((campos) =>
          campos.map((campo) => {
            const label = campo.children[0]?.getBoundingClientRect();
            const input = campo.querySelector('.auth-input-box')?.getBoundingClientRect();
            return label && input ? input.top - label.bottom : null;
          })
        );
        expect(separacionesCampos.filter((separacion) => separacion === null || separacion < 0 || separacion > 20), `Las etiquetas deben quedar junto a sus controles en escritorio a ${viewport.width}px / ${theme}`).toEqual([]);
        if (viewport.width === 1024) {
          const anchoCorreoTarjeta = await page.locator('.alumnos-lista__item .alumno-meta-tag--correo').first().evaluate((element) => element.getBoundingClientRect().width);
          expect(anchoCorreoTarjeta, 'El correo de tarjeta conserva una línea de lectura útil cuando el menú lateral reduce el espacio').toBeGreaterThan(240);
        }
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-lista-dummy-${viewport.width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.style.removeProperty('color-scheme');
    });
    await page.setViewportSize({ width: 390, height: 844 });

    const formulario = page.locator('.alumnos-form--panoramico');
    const toggleFormularioAlta = formulario.locator('.alumnos-form__toggle');
    await expect(toggleFormularioAlta).toHaveAccessibleName('Mostrar formulario');
    await expect(toggleFormularioAlta).toHaveAttribute('aria-expanded', 'false');
    await toggleFormularioAlta.click();
    await expect(toggleFormularioAlta).toHaveAccessibleName('Ocultar formulario');
    await expect(toggleFormularioAlta).toHaveAttribute('aria-expanded', 'true');
    await formulario.getByLabel('Matrícula').fill('CUH512410168');
    await formulario.getByLabel('Nombres').fill('Lucía Elena');
    await formulario.getByLabel('Apellidos').fill('Muestra Ficticia');
    await formulario.getByLabel('Grupo (opcional)').fill('2A');
    await formulario.getByLabel('Materia del alumno').selectOption('periodo-alumnos-dummy-2a');
    await expect(formulario.getByLabel('Materia del alumno')).toHaveAttribute('aria-describedby', 'alumnos-form-materia-ayuda');
    await expect(formulario.locator('#alumnos-form-materia-ayuda')).toContainText('No cambia la lista inferior.');
    await expect(listaMateria).toHaveAttribute('aria-describedby', 'alumnos-lista-materia-ayuda');
    await expect(page.locator('#alumnos-lista-materia-ayuda')).toContainText('no cambia el formulario.');
    await expect(formulario.getByText('Válida')).toBeVisible();
    await expect(formulario.getByLabel('Correo (opcional)')).toHaveValue('CUH512410168@cuh.mx');
    await page.screenshot({ path: supplementalEvidencePath('ux-audit-alumnos-formulario-dummy-mobile.png'), fullPage: true, animations: 'disabled' });

    await page.setViewportSize({ width: 320, height: 844 });
    await assertNoHorizontalOverflow(page, 'Formulario y lista de Alumnos a 320 px');
    const introAlumnosWidth = await page.locator('.alumnos-panel__text-block').evaluate((element) => element.getBoundingClientRect().width);
    expect(introAlumnosWidth, 'La introducción de Alumnos debe conservar ancho de lectura útil a 320 px').toBeGreaterThanOrEqual(200);
    const matriculaPlaceholder = await formulario.getByLabel('Matrícula').evaluate((element) => {
      const input = element as HTMLInputElement;
      const style = getComputedStyle(input);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      context.font = style.font;
      return {
        value: input.placeholder,
        textWidth: context.measureText(input.placeholder).width,
        usableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      };
    });
    expect(matriculaPlaceholder.value).toBe('CUH + 9 cifras');
    expect(matriculaPlaceholder.textWidth, 'El placeholder de matrícula debe caber completo a 320 px').toBeLessThanOrEqual(matriculaPlaceholder.usableWidth);
    for (const [label, placeholder] of [['Nombres', 'Ej. Ana María'], ['Apellidos', 'Ej. Gómez Ruiz']] as const) {
      const metricasPlaceholder = await formulario.getByLabel(label).evaluate((element) => {
        const input = element as HTMLInputElement;
        const style = getComputedStyle(input);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        context.font = style.font;
        return {
          value: input.placeholder,
          textWidth: context.measureText(input.placeholder).width,
          usableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        };
      });
      expect(metricasPlaceholder.value).toBe(placeholder);
      expect(metricasPlaceholder.textWidth, `El placeholder de ${label.toLowerCase()} debe caber completo a 320 px`).toBeLessThanOrEqual(metricasPlaceholder.usableWidth);
    }
    const tarjetaAlumno = page.locator('.alumnos-lista__item').first();
    const [etiquetaGrupo, valorGrupo, correoEtiqueta, correoValor] = await Promise.all([
      tarjetaAlumno.locator('.alumno-meta-tag--grupo .alumno-meta-lbl').boundingBox(),
      tarjetaAlumno.locator('.alumno-meta-tag--grupo .badge-grupo').boundingBox(),
      tarjetaAlumno.locator('.alumno-meta-tag--correo .alumno-meta-lbl').boundingBox(),
      tarjetaAlumno.locator('.alumno-meta-tag--correo .alumno-correo').boundingBox()
    ]);
    expect(etiquetaGrupo && valorGrupo && correoEtiqueta && correoValor, 'los datos de la tarjeta deben quedar visibles a 320 px').toBeTruthy();
    expect(Math.abs(etiquetaGrupo!.y - valorGrupo!.y), 'etiqueta y grupo deben compartir fila en móvil estrecho').toBeLessThanOrEqual(2);
    expect(correoValor!.y, 'el correo debe quedar completo debajo de su etiqueta').toBeGreaterThanOrEqual(correoEtiqueta!.y + correoEtiqueta!.height - 1);
    await expect(tarjetaAlumno.locator('.alumno-meta-tag--matricula .alumno-meta-value')).toHaveCSS('white-space', 'nowrap');
    await expect(tarjetaAlumno.locator('.alumno-meta-tag--correo wbr')).toHaveCount(3);
    await expect(formulario.locator('.alumnos-form__materia-contexto')).toHaveText('Materia seleccionada: Evaluación de datos — 2A · inicia 24/08/2026');
    await expect(formulario.locator('.alumnos-form__materia-contexto')).toBeVisible();
    const controlesDentroDelFormulario = await formulario.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll<HTMLElement>('input, select, textarea, button')].every((control) => {
        const controlBounds = control.getBoundingClientRect();
        return controlBounds.left >= bounds.left - 1 && controlBounds.right <= bounds.right + 1;
      });
    });
    expect(controlesDentroDelFormulario, 'Campos y acción de alta deben quedar dentro del formulario a 320 px').toBe(true);
    const correoSugeridoVisible = await formulario.getByLabel('Correo (opcional)').evaluate((element) => {
      const input = element as HTMLInputElement;
      const style = getComputedStyle(input);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      context.font = style.font;
      const textWidth = context.measureText(input.value).width;
      const usableWidth = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return { textWidth, usableWidth, value: input.value };
    });
    expect(correoSugeridoVisible.textWidth, `El correo sugerido debe mostrarse completo a 320 px: ${JSON.stringify(correoSugeridoVisible)}`).toBeLessThanOrEqual(correoSugeridoVisible.usableWidth);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((selectedTheme) => {
        const root = document.documentElement;
        root.dataset.theme = selectedTheme;
        root.style.colorScheme = selectedTheme;
      }, theme);
      await assertNoHorizontalOverflow(page, `Formulario de Alumnos 320 px / ${theme}`);
      await page.screenshot({
        path: supplementalEvidencePath(`ux-audit-alumnos-formulario-dummy-320-${theme}.png`),
        fullPage: true,
        animations: 'disabled'
      });
      await formulario.screenshot({
        path: supplementalEvidencePath(`ux-audit-alumnos-formulario-320-${theme}-panel.png`),
        animations: 'disabled'
      });
    }

    const matricula = formulario.getByLabel('Matrícula');
    const nombres = formulario.getByLabel('Nombres');
    const apellidos = formulario.getByLabel('Apellidos');
    const correo = formulario.getByLabel('Correo (opcional)');
    const grupo = formulario.getByLabel('Grupo (opcional)');
    const materia = formulario.getByLabel('Materia del alumno');
    const crear = formulario.getByRole('button', { name: 'Crear alumno' });
    await matricula.focus();
    await page.keyboard.press('Tab');
    await expect(nombres).toBeFocused();
    const focoNombres = await nombres.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(focoNombres).not.toBe('none');
    for (const control of [apellidos, correo, grupo, materia, crear]) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
    }

    await page.getByRole('button', { name: 'Editar Ana María Gómez Ruiz' }).click();
    await expect(formulario.getByRole('heading', { name: 'Modificar alumno seleccionado' })).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    await expect(matricula).toHaveValue('CUH512410168');
    await expect(nombres).toHaveValue('Ana María');
    for (const ancho of [320, 390]) {
      await page.setViewportSize({ width: ancho, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await page.waitForTimeout(250);
        await page.mouse.move(0, 0);
        await assertNoHorizontalOverflow(page, `Edición de Alumnos ${ancho}px / ${theme}`);
        await expect(formulario.getByText('Correo completo: ana-dummy@evaluapro.local')).toBeVisible();
        await expect(formulario.getByLabel('Correo (opcional)')).toHaveAttribute('aria-describedby', 'alumnos-correo-completo');
        await formulario.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-edicion-dummy-${ancho}-${theme}.png`),
          animations: 'disabled'
        });
      }
    }

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await page.waitForTimeout(250);
        await page.mouse.move(0, 0);
        await assertNoHorizontalOverflow(page, `Edición de Alumnos ${viewport.width}px / ${theme}`);
        await expect(formulario.getByRole('heading', { name: 'Modificar alumno seleccionado' })).toBeVisible();
        await expect(formulario.locator('.alumnos-form__materia-contexto')).toHaveText('Materia seleccionada: Evaluación de datos — 2A · inicia 24/08/2026');
        await expect(formulario.getByText('Correo completo: ana-dummy@evaluapro.local')).toBeVisible();
        await formulario.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-edicion-dummy-${viewport.width}-${theme}.png`),
          animations: 'disabled'
        });
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-edicion-dummy-${viewport.width}-${theme}-pantalla.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }

    await nombres.fill('Ana Elena');
    await nombres.press('Enter');
    await expect(formulario.getByRole('heading', { name: 'Registrar alumno' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar Ana Elena Gómez Ruiz' })).toBeFocused();
    const resultadoEdicionAlumno = page.getByRole('status').filter({ hasText: 'Cambios guardados para «Ana Elena Gómez Ruiz».' });
    await expect(resultadoEdicionAlumno).toBeVisible();
    await expect(formulario.getByText('Cambios guardados para «Ana Elena Gómez Ruiz».')).toHaveCount(0);
    const botonEditarActualizado = page.getByRole('button', { name: 'Editar Ana Elena Gómez Ruiz' });
    await expect(botonEditarActualizado).toHaveText('Editar');
    await expect(botonEditarActualizado).toBeFocused();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await assertNoHorizontalOverflow(page, `Resultado de edición de Alumnos escritorio ${viewport.width}px / ${theme}`);
        await expect(resultadoEdicionAlumno).toBeVisible();
        await expect(page.getByRole('button', { name: 'Editar Ana Elena Gómez Ruiz' })).toBeVisible();
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-resultado-edicion-dummy-${viewport.width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((selectedTheme) => {
          const root = document.documentElement;
          root.dataset.theme = selectedTheme;
          root.style.colorScheme = selectedTheme;
        }, theme);
        await page.waitForTimeout(250);
        await page.mouse.move(0, 0);
        await assertNoHorizontalOverflow(page, `Confirmación de edición de Alumnos ${width}px / ${theme}`);
        const botonEditar = page.getByRole('button', { name: 'Editar Ana Elena Gómez Ruiz' });
        await expect(botonEditar).toHaveAccessibleName('Editar Ana Elena Gómez Ruiz');
        await expect(botonEditar).toHaveText('Editar');
        await expect(botonEditar).toBeVisible();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        const correo = page.locator('.alumnos-lista__item')
          .filter({ hasText: 'Ana Elena Gómez Ruiz' })
          .locator('.alumno-correo');
        await expect(correo).toBeVisible();
        await page.screenshot({
          path: supplementalEvidencePath(`ux-audit-alumnos-resultado-edicion-dummy-${width}-${theme}.png`),
          fullPage: true,
          animations: 'disabled'
        });
      }
    }
    expect(actualizacionesAlumnosFicticias).toHaveLength(1);
    expect(actualizacionesAlumnosFicticias[0]).toMatchObject({
      method: 'POST',
      path: '/api/alumnos/alumno-dummy-001/actualizar',
      payload: {
        periodoId: 'periodo-alumnos-dummy-2a',
        matricula: 'CUH512410168',
        nombres: 'Ana Elena',
        apellidos: 'Gómez Ruiz',
        correo: 'ana-dummy@evaluapro.local',
        grupo: '2A'
      }
    });
    expect(escriturasBloqueadas, 'ninguna otra ruta API debe recibir una escritura').toEqual([]);
  });

  test('audita visualmente Asistencias con resumen, sesión y regla ficticios', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-asistencias-dummy'));
    const periodoId = 'periodo-asistencias-dummy-2a';
    const alumnos = [
      { _id: 'alumno-asistencia-dummy-001', nombreCompleto: 'Ana María Gómez Ruiz', matricula: 'DUMMY-A01', grupo: '2A', periodoId, activo: true },
      { _id: 'alumno-asistencia-dummy-002', nombreCompleto: 'Benito Pruebas Extensas', matricula: 'DUMMY-A02', grupo: '2A', periodoId, activo: true }
    ];
    let permitirResumenExitoso = false;
    let guardadosRegla = 0;
    let reglaGuardadaEnApi: Record<string, unknown> | null = null;
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-asistencias-dummy', nombre: 'Docente de Prueba', correo: 'docente@evaluapro.local',
          permisos: ['periodos:leer', 'alumnos:leer', 'asistencias:leer', 'asistencias:gestionar'], roles: ['docente']
        } })
      });
    });
    await page.route('**/api/periodos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: [{ _id: periodoId, nombre: 'Evaluación de datos — 2A', grupos: ['2A'], activo: true }] })
      });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alumnos }) });
    });
    await page.route('**/api/asistencias/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.endsWith('/reglas') && route.request().method() === 'POST') {
        guardadosRegla += 1;
        const payload = route.request().postDataJSON() as Record<string, unknown>;
        reglaGuardadaEnApi = { _id: 'regla-asistencia-dummy-001', ...payload };
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ regla: reglaGuardadaEnApi }) });
        return;
      }
      if (pathname.endsWith('/resumen')) {
        if (!permitirResumenExitoso) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ mensaje: 'Fallo ficticio para comprobar recuperación.' }) });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ resumen: [
            { alumnoId: alumnos[0]._id, matricula: alumnos[0].matricula, nombreCompleto: alumnos[0].nombreCompleto, grupo: '2A', presentes: 18, faltas: 1, retardos: 1, justificadas: 0, totalSesiones: 20, porcentajeAsistencia: 95, superaLimiteFaltas: false, tieneExcepcion: false, bloqueadoExamen: false },
            { alumnoId: alumnos[1]._id, matricula: alumnos[1].matricula, nombreCompleto: alumnos[1].nombreCompleto, grupo: '2A', presentes: 15, faltas: 4, retardos: 1, justificadas: 0, totalSesiones: 20, porcentajeAsistencia: 80, superaLimiteFaltas: true, tieneExcepcion: false, bloqueadoExamen: true }
          ] })
        });
        return;
      }
      if (pathname.endsWith('/reglas')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ reglas: [reglaGuardadaEnApi ?? { _id: 'regla-asistencia-dummy-001', maxFaltas: 3, accion: 'advertir', excepcionPermitida: true, grupo: '2A', contarRetardos: true, retardosEquivalenFalta: 3 }] })
        });
        return;
      }
      if (pathname.endsWith('/registros')) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ registros: [
            { alumnoId: alumnos[0]._id, estado: 'P' },
            { alumnoId: alumnos[1]._id, estado: 'F', justificacion: 'Inasistencia de prueba' }
          ] })
        });
        return;
      }
      if (pathname.endsWith('/sesiones')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sesiones: [{ _id: 'sesion-asistencia-dummy-001', fecha: '2026-10-27T12:00:00.000Z', grupo: '2A', modo: 'manual', temaNombre: 'Práctica de laboratorio' }] })
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    for (const viewport of [
      { width: 320, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 }
    ]) {
      const width = viewport.width;
      await page.addInitScript(() => localStorage.removeItem('ep.guia.asistencias.oculta'));
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: 'Materias', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Registrar materia' })).toBeVisible();
      const mobilePicker = nav.locator('#navegacion-docente-movil');
      if (await mobilePicker.isVisible()) await mobilePicker.selectOption({ label: 'Asistencias' });
      else {
        const asistenciaNav = nav.getByRole('button', { name: 'Asistencias', exact: true });
        await asistenciaNav.hover();
        await expect(page.getByRole('tooltip')).toContainText('Pase de lista diario');
        await asistenciaNav.click();
        await expect(asistenciaNav).toHaveAttribute('aria-current', 'page');
      }
      await expect(page.getByRole('heading', { name: 'Asistencias', exact: true })).toBeVisible();
      if (width <= 390) {
        const toggleGuia = page.locator('#toggle-guia-asistencias');
        await expect(toggleGuia).toHaveAccessibleName('Ver guía rápida de asistencias');
        await expect(toggleGuia).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('#guia-asistencias-panel')).toBeHidden();
        await toggleGuia.focus();
        await page.keyboard.press('Enter');
        await expect(toggleGuia).toBeFocused();
        await expect(toggleGuia).toHaveAccessibleName('Ocultar guía rápida de asistencias');
        await expect(toggleGuia).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('region', { name: 'Ayuda: Control de asistencias y pase de lista' })).toBeVisible();
        await page.keyboard.press('Space');
        await expect(toggleGuia).toBeFocused();
        await expect(toggleGuia).toHaveAccessibleName('Ver guía rápida de asistencias');
        await expect(toggleGuia).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('#guia-asistencias-panel')).toBeHidden();
      } else {
        await expect(page.locator('#toggle-guia-asistencias')).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('region', { name: 'Ayuda: Control de asistencias y pase de lista' })).toBeVisible();
      }
      await page.getByLabel('Materia o Periodo Académico').selectOption(periodoId);
      if (width === 320) {
        const campoTema = page.getByRole('textbox', { name: 'Tema o contenido temático cubierto' });
        await expect(campoTema).toHaveAttribute('placeholder', 'Ej. Unidad 2');
        const ejemploTema = await campoTema.evaluate((input: HTMLInputElement) => {
          const style = getComputedStyle(input);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) return { fits: false, reason: 'canvas no disponible' };
          context.font = style.font;
          const anchoTexto = context.measureText(input.placeholder).width;
          const anchoUtil = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          return { fits: anchoTexto <= anchoUtil, anchoTexto: Math.ceil(anchoTexto), anchoUtil: Math.floor(anchoUtil) };
        });
        expect(ejemploTema.fits, `El ejemplo del tema debe caber completo a 320 px: ${JSON.stringify(ejemploTema)}`).toBe(true);
        for (const theme of ['light', 'dark']) {
          await setVisibleTheme(page, theme);
          await page.locator('.asistencias-field-col--tema').screenshot({
            path: supplementalEvidencePath(`ux-audit-asistencias-tema-320-${theme}.png`),
            animations: 'disabled'
          });
        }
      }
      if (width === 320) {
        const mensajeError = 'No se pudo cargar el resumen. La información de elegibilidad no está disponible.';
        await expect(page.getByText(mensajeError)).toBeVisible();
        await expect(page.getByRole('region', { name: 'Resumen de asistencia por alumno' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reintentar resumen' })).toBeVisible();
        await page.getByText(mensajeError).scrollIntoViewIfNeeded();
        await page.screenshot({ path: supplementalEvidencePath('ux-audit-asistencias-error-dummy-320-dark.png'), animations: 'disabled' });
        permitirResumenExitoso = true;
        await page.getByRole('button', { name: 'Reintentar resumen' }).click();
      }
      await expect(page.getByRole('button', { name: /27 oct.*2A|27 oct.*Grupo 2A/i })).toBeVisible();
      await expect(page.locator('.asistencia-mini-kpi--promedio')).toContainText('Asistencia promedio');
      await expect(page.locator('.asistencia-mini-kpi--promedio')).not.toContainText('% Promedio');
      await expect(page.locator('.asistencia-mini-kpi--sin-derecho')).toContainText('Examen bloqueado');
      const tablaRegion = page.getByRole('region', { name: 'Resumen de asistencia por alumno' });
      await expect(tablaRegion).toBeVisible();
      await expect(tablaRegion).toHaveAttribute('tabindex', '0');
      await expect(tablaRegion).toHaveAttribute('aria-describedby', 'asistencias-tabla-ayuda');
      await expect(page.getByText(/Con el teclado, enfoca la tabla y pulsa las flechas para desplazar sus columnas; también puedes deslizarla/i)).toBeVisible();
      if (width === 320) {
        const scrollState = await tablaRegion.evaluate((region) => ({
          overflow: region.scrollWidth > region.clientWidth,
          start: region.scrollLeft
        }));
        expect(scrollState.overflow, 'la tabla conserva el desplazamiento horizontal local en móvil').toBe(true);
        await tablaRegion.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => tablaRegion.evaluate((region) => region.scrollLeft)).toBeGreaterThan(scrollState.start);
        await tablaRegion.evaluate((region) => { region.scrollLeft = 0; });
      }
      await expect(page.getByRole('button', { name: /Examen bloqueado \(1\)/i })).toBeVisible();
      const themes = width <= 390 ? ['dark', 'light'] : ['dark'];
      for (const theme of themes) {
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
        const resumenTab = page.getByRole('tab', { name: /Resumen General/i });
        await resumenTab.focus();
        await page.keyboard.press('Enter');
        await expect(resumenTab).toHaveAttribute('aria-selected', 'true');
        if (width === 320) {
          const resumenPanel = page.locator('#asistencias-panel-resumen');
          await expect(resumenPanel.getByRole('heading', { name: /Registrar nueva sesión de clase/i })).toBeVisible();
          const formLayout = await resumenPanel.locator('.asistencias-hero-card').evaluate((card) => {
            const bounds = card.getBoundingClientRect();
            const style = getComputedStyle(card);
            const contentRight = bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
            const controls = [...card.querySelectorAll<HTMLElement>('input, select, textarea, button')].map((control) => ({
              label: control.getAttribute('aria-label') || control.getAttribute('placeholder') || control.innerText.trim(),
              right: Math.round(control.getBoundingClientRect().right),
              contentRight: Math.round(contentRight)
            })).filter((control) => control.right > contentRight + 1);
            return controls;
          });
          expect(formLayout, `Formulario de sesión desborda el área interna a 320px / ${theme}`).toEqual([]);
          const groupLabel = await page.locator('.asistencias-input-box select.asistencias-select').evaluate((select) => {
            const style = getComputedStyle(select);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return { fits: false, reason: 'canvas no disponible' };
            context.font = style.font;
            const textWidth = context.measureText(select.selectedOptions[0]?.textContent?.trim() ?? '').width;
            const availableWidth = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 24;
            return { fits: textWidth <= availableWidth, textWidth: Math.round(textWidth), availableWidth: Math.round(availableWidth) };
          });
          expect(groupLabel.fits, `Opción de grupo recortada a 320px / ${theme}: ${JSON.stringify(groupLabel)}`).toBe(true);
        }
        await assertNoHorizontalOverflow(page, `Asistencias ${width}px / ${theme} con datos ficticios`);
        await assertVisibleHeadersFit(page, `Asistencias ${width}px / ${theme} con datos ficticios`);
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-asistencias-resumen-dummy-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
        if (width === 320) {
          const sessionLayout = await page.locator('.asistencias-panel-card').filter({ has: page.getByRole('heading', { name: /Sesiones Registradas/ }) }).evaluate((panel) => {
            const panelBounds = panel.getBoundingClientRect();
            const panelStyle = getComputedStyle(panel);
            const panelContentRight = panelBounds.right - parseFloat(panelStyle.borderRightWidth) - parseFloat(panelStyle.paddingRight);
            const sessionCard = panel.querySelector<HTMLElement>('.asistencias-sesion-card');
            const sessionFooter = sessionCard?.querySelector<HTMLElement>('.asistencias-sesion-card__footer');
            if (!sessionCard || !sessionFooter) return { found: false, overflow: Infinity };
            const cardBounds = sessionCard.getBoundingClientRect();
            const cardStyle = getComputedStyle(sessionCard);
            const cardContentRight = cardBounds.right - parseFloat(cardStyle.borderRightWidth) - parseFloat(cardStyle.paddingRight);
            return {
              found: true,
              overflow: Math.max(cardBounds.right - panelContentRight, sessionFooter.getBoundingClientRect().right - cardContentRight)
            };
          });
          expect(sessionLayout.found, 'Debe mostrarse la sesión ficticia.').toBe(true);
          expect(sessionLayout.overflow, `Tarjeta o acción de sesión recortada a 320px / ${theme}`).toBeLessThanOrEqual(1);
          await page.locator('.asistencias-sesion-card').scrollIntoViewIfNeeded();
          await page.screenshot({ path: supplementalEvidencePath(`ux-audit-asistencias-sesiones-320-${theme}-viewport.png`), animations: 'disabled' });
        }

        await page.locator('.asistencias-sesion-card').click();
        const resumenDuranteCarga = page.getByRole('tab', { name: /Resumen General/i });
        await resumenDuranteCarga.click();
        await expect(page.getByText('Cargando los registros guardados de la sesión…')).toBeHidden();
        await expect(resumenDuranteCarga).toHaveAttribute('aria-selected', 'true');
        await page.locator('#asistencias-tab-pase_lista').click();
        await expect(page.getByText('Ana María Gómez Ruiz')).toBeVisible();
        await expect(page.getByText('La nueva sesión inicia con todos los alumnos como Presentes')).toHaveCount(0);
        if (width <= 390) {
          await expect(page.locator('#asistencias-tab-pase_lista')).toHaveAttribute('aria-selected', 'true');
          await expect(page.locator('.asistencias-subpanel-header')).toBeVisible();
          const actionLayout = await page.locator('.asistencias-subpanel-header').evaluate((header) => {
            const bar = header.querySelector<HTMLElement>('.asistencias-action-buttons-bar');
            if (!bar) return { found: false, overflow: Infinity, clipped: Infinity, buttons: [] };
            const barBounds = bar.getBoundingClientRect();
            const buttons = [...bar.querySelectorAll<HTMLElement>(':scope > .boton')].map((button) => {
              const bounds = button.getBoundingClientRect();
              return {
                text: button.innerText,
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                width: bounds.width
              };
            });
            return {
              found: buttons.length === 2,
              overflow: bar.scrollWidth - bar.clientWidth,
              clipped: buttons.reduce((maximum, button) => Math.max(maximum, barBounds.left - button.left, button.right - barBounds.right), 0),
              buttons
            };
          });
          expect(actionLayout.found, 'Deben aparecer ambas acciones del pase de lista').toBe(true);
          expect(actionLayout.overflow, `Las acciones no deben desbordar a ${width}px: ${JSON.stringify(actionLayout.buttons)}`).toBeLessThanOrEqual(1);
          expect(actionLayout.clipped, `Las acciones no deben quedar recortadas a ${width}px: ${JSON.stringify(actionLayout.buttons)}`).toBeLessThanOrEqual(1);
        }
        if (width <= 390) {
          const estadoOverflows = await page.locator('.asistencias-estado-controls').evaluateAll((groups) => groups.flatMap((group) => {
            const bounds = group.getBoundingClientRect();
            const buttons = [...group.querySelectorAll('button')].map((button) => button.getBoundingClientRect());
            const overlap = buttons.some((first, index) => buttons.slice(index + 1).some((second) =>
              Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1
              && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1
            ));
            return group.scrollWidth > group.clientWidth + 1 || buttons.some((button) => button.left < bounds.left - 1 || button.right > bounds.right + 1) || overlap
              ? [{ width: group.clientWidth, scrollWidth: group.scrollWidth, overlap }]
              : [];
          }));
          expect(estadoOverflows, `Los estados de asistencia deben caber sin encimarse a ${width}px / ${theme}`).toEqual([]);
        }
        await assertNoHorizontalOverflow(page, `Pase de lista ${width}px / ${theme} con datos ficticios`);
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-asistencias-lista-dummy-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });

        await page.getByRole('tab', { name: /Reglas y Tolerancias/i }).click();
        await expect(page.getByRole('tabpanel', { name: /Reglas y Tolerancias/i })).toBeVisible();
        if (width === 320) {
          const controlesFueraDeRegla = await page.locator('.asistencias-config-grid').evaluate((grid) => {
            const bounds = grid.getBoundingClientRect();
            const style = getComputedStyle(grid);
            const contentRight = bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
            return [...grid.querySelectorAll<HTMLElement>('input, select, button')]
              .filter((control) => control.getBoundingClientRect().right > contentRight + 1)
              .map((control) => ({ texto: control.getAttribute('aria-label') || control.innerText || control.tagName, right: control.getBoundingClientRect().right, contentRight }));
          });
          expect(controlesFueraDeRegla, `Los controles de regla deben caber a 320px / ${theme}`).toEqual([]);

          const etiquetaMateria = await page.locator('.asistencias-filtros-bar .asistencias-field-lbl').first().evaluate((element) => ({
            text: element.textContent?.trim(),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            labelRight: element.getBoundingClientRect().right,
            filterContentRight: (() => {
              const filter = element.closest<HTMLElement>('.asistencias-filtros-bar');
              if (!filter) return -Infinity;
              const bounds = filter.getBoundingClientRect();
              const style = getComputedStyle(filter);
              return bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
            })(),
            textOutsideLabel: (() => {
              const content = element.querySelector('.asistencias-field-lbl__text');
              if (!content) return true;
              const range = document.createRange();
              range.selectNodeContents(content);
              const label = element.getBoundingClientRect();
              return Array.from(range.getClientRects()).some((rect) =>
                rect.left < label.left - 1 || rect.right > label.right + 1 || rect.top < label.top - 1 || rect.bottom > label.bottom + 1
              );
            })()
          }));
          expect(etiquetaMateria.scrollWidth, `La etiqueta del selector de materia no debe recortarse / ${theme}: ${JSON.stringify(etiquetaMateria)}`)
            .toBeLessThanOrEqual(etiquetaMateria.clientWidth + 1);
          expect(etiquetaMateria.textOutsideLabel, `El texto completo del selector de materia debe caber en su etiqueta / ${theme}: ${JSON.stringify(etiquetaMateria)}`)
            .toBe(false);
          expect(etiquetaMateria.labelRight, `El campo de materia debe permanecer dentro del panel / ${theme}: ${JSON.stringify(etiquetaMateria)}`)
            .toBeLessThanOrEqual(etiquetaMateria.filterContentRight + 1);

          const valoresFiltro = await page.locator('.asistencias-filtros-bar select').evaluateAll((selects) => selects.map((select) => {
            const control = select as HTMLSelectElement;
            const style = getComputedStyle(control);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return { value: control.selectedOptions[0]?.textContent?.trim() ?? '', fits: false, reason: 'canvas no disponible' };
            context.font = style.font;
            const value = control.selectedOptions[0]?.textContent?.trim() ?? '';
            const textWidth = context.measureText(value).width;
            const availableWidth = control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            return { value, textWidth: Math.ceil(textWidth), availableWidth: Math.floor(availableWidth), fits: textWidth <= availableWidth };
          }));
          expect(valoresFiltro, `Deben aparecer los filtros de periodo y grupo / ${theme}`).toHaveLength(2);
          expect(valoresFiltro.every((value) => value.fits), `Ningún valor de filtro debe truncarse a 320px / ${theme}: ${JSON.stringify(valoresFiltro)}`)
            .toBe(true);

          const reglaActiva = await page.locator('.asistencias-panel-card').filter({ has: page.getByRole('heading', { name: /Reglas Activas/ }) }).evaluate((panel) => {
            const panelRect = panel.getBoundingClientRect();
            const panelStyle = getComputedStyle(panel);
            const card = panel.querySelector<HTMLElement>('.asistencias-regla-card');
            const body = card?.querySelector<HTMLElement>('.asistencias-regla-card__body');
            const equivalencia = card?.querySelector<HTMLElement>('.asistencias-r-stat');
            return {
              found: Boolean(card && body && equivalencia),
              panelContentRight: panelRect.right - parseFloat(panelStyle.borderRightWidth) - parseFloat(panelStyle.paddingRight),
              cardRight: card?.getBoundingClientRect().right ?? Infinity,
              bodyClientWidth: body?.clientWidth ?? 0,
              bodyScrollWidth: body?.scrollWidth ?? Infinity,
              equivalenciaClientWidth: equivalencia?.clientWidth ?? 0,
              equivalenciaScrollWidth: equivalencia?.scrollWidth ?? Infinity
            };
          });
          expect(reglaActiva.found, 'Debe existir la tarjeta con la equivalencia de retardos.').toBe(true);
          expect(reglaActiva.cardRight, `La tarjeta de regla debe caber a 320px / ${theme}: ${JSON.stringify(reglaActiva)}`)
            .toBeLessThanOrEqual(reglaActiva.panelContentRight + 1);
          expect(reglaActiva.bodyScrollWidth, `El texto de la regla no debe desbordar a 320px / ${theme}: ${JSON.stringify(reglaActiva)}`)
            .toBeLessThanOrEqual(reglaActiva.bodyClientWidth + 1);
          expect(reglaActiva.equivalenciaScrollWidth, `La equivalencia debe caber a 320px / ${theme}: ${JSON.stringify(reglaActiva)}`)
            .toBeLessThanOrEqual(reglaActiva.equivalenciaClientWidth + 1);
        }
        const accionLimite = page.getByLabel('Acción al superar el límite');
        await expect(accionLimite).toHaveValue('bloquear_examen');
        await expect(accionLimite).toHaveAccessibleDescription(/bloquea el examen; las excepciones se autorizan desde Resumen/i);
        await accionLimite.selectOption('advertir');
        await expect(accionLimite).toHaveAccessibleDescription(/muestra una advertencia sin bloquear el examen/i);
        await accionLimite.selectOption('bloquear_examen');
        if (width === 320 && theme === 'dark') {
          await page.getByRole('checkbox', { name: /Contar retardos como faltas equivalentes/i }).check();
          const guardadosPrevios = guardadosRegla;
          const accionGuardarRegla = page.getByRole('button', { name: 'Guardar regla' });
          const guardarEnCurso = page.locator('.boton--guardar-regla');
          await Promise.all([
            expect(guardarEnCurso).toBeDisabled(),
            expect(guardarEnCurso).toHaveAttribute('aria-busy', 'true'),
            expect(guardarEnCurso).toContainText('Guardando regla…'),
            accionGuardarRegla.click()
          ]);
          const bounds = await guardarEnCurso.boundingBox();
          const card = await page.locator('.asistencias-panel-card').filter({ has: page.getByRole('heading', { name: /Configurar regla de asistencia/i }) }).boundingBox();
          expect(bounds && card && bounds.x >= card.x && bounds.x + bounds.width <= card.x + card.width + 1,
            `El botón en progreso debe caber en la tarjeta a 320px / ${theme}`).toBe(true);
          await page.screenshot({ path: supplementalEvidencePath('ux-asistencias-regla-guardando-dummy-320-dark.png'), animations: 'disabled' });
          await expect(guardarEnCurso).toBeEnabled();
          await expect(guardarEnCurso).toContainText('Guardar regla');
          expect(guardadosRegla).toBe(guardadosPrevios + 1);
          await expect(page.locator('.asistencias-regla-card')).toContainText('Acción: Bloquear examen');
          await expect(page.locator('.toast-viewport .toast-text')).toContainText('Acción: bloquear examen');
        }
        if (width === 320) {
          const retardoLabel = await page.locator('.asistencias-checkbox-label').evaluate((label) => {
            const title = label.querySelector<HTMLElement>('span:first-of-type');
            const note = label.querySelector<HTMLElement>('.nota');
            const checkbox = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (!title || !note) return { found: false };
            const labelBounds = label.getBoundingClientRect();
            const titleBounds = title.getBoundingClientRect();
            const noteBounds = note.getBoundingClientRect();
            const checkboxBounds = checkbox?.getBoundingClientRect();
            return {
              found: true,
              display: getComputedStyle(label).display,
              titleWidth: Math.round(titleBounds.width),
              noteWidth: Math.round(noteBounds.width),
              aligned: Math.abs(titleBounds.left - noteBounds.left) <= 1,
              withinLabel: noteBounds.right <= labelBounds.right + 1,
              checkboxAlignedToTitle: checkboxBounds ? Math.abs(checkboxBounds.top - titleBounds.top) <= 4 : false
            };
          });
          expect(retardoLabel.found, 'La regla de retardos debe mostrar su etiqueta y la nota de valor inicial.').toBe(true);
          expect(retardoLabel.display).toBe('grid');
          expect(retardoLabel.titleWidth).toBeGreaterThanOrEqual(120);
          expect(retardoLabel.noteWidth).toBeGreaterThanOrEqual(120);
          expect(retardoLabel.aligned).toBe(true);
          expect(retardoLabel.withinLabel).toBe(true);
          expect(retardoLabel.checkboxAlignedToTitle).toBe(true);
          const checkboxRetardos = page.getByRole('checkbox', { name: /Contar retardos como faltas equivalentes/i });
          const botonGuardarRegla = page.getByRole('button', { name: 'Guardar regla' });
          const [checkboxBounds, botonBounds] = await Promise.all([checkboxRetardos.boundingBox(), botonGuardarRegla.boundingBox()]);
          expect(checkboxBounds && botonBounds && botonBounds.y >= checkboxBounds.y + checkboxBounds.height - 1,
            `Guardar regla debe seguir todos sus campos a 320px / ${theme}`).toBe(true);
        }
        await assertNoHorizontalOverflow(page, `Reglas ${width}px / ${theme} con datos ficticios`);
        await page.screenshot({ path: supplementalEvidencePath(`ux-audit-asistencias-reglas-dummy-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      }
    }
  });

  test('audita visualmente las cuatro vistas de Evaluaciones con datos ficticios', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-evaluaciones-dummy'));
    const periodoId = 'periodo-evaluaciones-dummy-2a';
    const alumnoId = 'alumno-evaluaciones-dummy-001';
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-evaluaciones-dummy', nombre: 'Docente de Prueba', correo: 'docente@evaluapro.local',
          permisos: ['periodos:leer', 'alumnos:leer', 'evaluaciones:leer', 'evaluaciones:gestionar'], roles: ['docente']
        } })
      });
    });
    await page.route('**/api/periodos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: [{ _id: periodoId, nombre: 'Evaluación de datos — 2A', activo: true }] })
      });
    });
    await page.route('**/api/alumnos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alumnos: [{ _id: alumnoId, nombreCompleto: 'Ana María Gómez Ruiz', matricula: 'DUMMY-E01', periodoId, activo: true }] })
      });
    });
    await page.route('**/api/evaluaciones/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.endsWith('/contexto')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            politicas: [{ codigo: 'POLICY_DUMMY_2026', version: 1, nombre: 'Política ficticia 2026', familia: 'lisc_encuadre', sistema: true, activa: true }],
            configuracion: { politicaCodigo: 'POLICY_DUMMY_2026', politicaVersion: 1 }
          })
        });
        return;
      }
      if (pathname.endsWith('/evidencias')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ evidencias: [{ id: 'evidencia-evaluaciones-dummy-001', titulo: 'Práctica ficticia de laboratorio', calificacionDecimal: 9, ponderacion: 1, corte: 1, fuente: 'manual', archivadaEn: null, updatedAt: '2026-10-27T12:00:00.000Z' }], nextCursor: null })
        });
        return;
      }
      if (pathname.endsWith('/resumen')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ resumen: {
            politicaCodigo: 'POLICY_DUMMY_2026', politicaVersion: 1,
            continuaPorCorte: { c1: 8.5, c2: 9, c3: 8 }, examenesPorCorte: { parcial1: 8, parcial2: 9, global: 8.5 },
            bloqueContinuaDecimal: 8.4, bloqueExamenesDecimal: 8.5, finalDecimal: 8.45, finalRedondeada: 8, estado: 'completo', faltantes: []
          } })
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    for (const viewport of [
      { width: 320, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 }
    ]) {
      const width = viewport.width;
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width <= 1023) {
        await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Evaluaciones' });
      } else {
        await page.goto('/?vista=evaluaciones', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('navigation', { name: /Secciones del portal docente/i })
          .getByRole('button', { name: 'Evaluaciones', exact: true })).toHaveAttribute('aria-current', 'page');
      }
      await expect(page.getByRole('heading', { name: 'Evaluaciones y políticas', exact: true })).toBeVisible();
      await page.getByRole('combobox', { name: 'Periodo' }).selectOption(periodoId);
      await page.getByRole('combobox', { name: 'Alumno' }).selectOption(alumnoId);
      await expect(page.getByRole('combobox', { name: 'Alumno' })).toHaveValue(alumnoId);
      await expect(page.getByText('1 política activa', { exact: true })).toBeVisible();
      await expect(page.locator('.evaluaciones-header-kpis .banco-mini-kpi--preguntas .banco-mini-kpi__lbl')).toHaveText('Política');
      await expect(page.locator('.evaluaciones-header-kpis .banco-mini-kpi--temas .banco-mini-kpi__lbl')).toHaveText('Alumno');
      await expect(page.locator('.evaluaciones-header-kpis .banco-mini-kpi--temaactual')).toHaveCount(0);

      for (const tabName of ['Política', 'Evidencias', 'Exámenes', 'Resumen']) {
        await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
      }
      await expect(page.getByRole('tab', { name: 'Política' })).toHaveAttribute('aria-selected', 'true');

      const tabPolitica = page.getByRole('tab', { name: 'Política' });
      const tabEvidencias = page.getByRole('tab', { name: 'Evidencias' });
      const tabExamenes = page.getByRole('tab', { name: 'Exámenes' });
      const tabResumen = page.getByRole('tab', { name: 'Resumen' });
      await tabPolitica.focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabEvidencias).toBeFocused();
      await expect(tabPolitica).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');
      await expect(tabEvidencias).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel', { name: 'Evidencias' })).toBeVisible();
      await page.keyboard.press('End');
      await expect(tabResumen).toBeFocused();
      await expect(tabEvidencias).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Space');
      await expect(tabResumen).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home');
      await expect(tabPolitica).toBeFocused();
      await page.keyboard.press('Space');
      await expect(tabPolitica).toHaveAttribute('aria-selected', 'true');
      await expect(tabExamenes).toHaveAttribute('aria-selected', 'false');

      const controlGuia = page.getByRole('button', { name: 'Ver guía rápida de Evaluaciones' });
      if (width <= 390) {
        await expect(controlGuia).toHaveAttribute('aria-expanded', 'false');
        const contenidoGuiaId = await controlGuia.getAttribute('aria-controls');
        expect(contenidoGuiaId).toBeTruthy();
        await controlGuia.focus();
        const focoGuiaVisible = await controlGuia.evaluate((element) => {
          const estilo = getComputedStyle(element);
          return estilo.outlineStyle !== 'none' && Number.parseFloat(estilo.outlineWidth) >= 2;
        });
        expect(focoGuiaVisible, 'el control de la guía debe conservar un foco visible').toBe(true);
        await page.keyboard.press('Enter');
        const controlOcultar = page.getByRole('button', { name: 'Ocultar guía rápida' });
        await expect(controlOcultar).toHaveAttribute('aria-expanded', 'true');
        await controlOcultar.focus();
        await page.keyboard.press('Space');
        await expect(page.getByRole('button', { name: 'Ver guía rápida de Evaluaciones' })).toHaveAttribute('aria-expanded', 'false');
        await page.evaluate(() => localStorage.removeItem('ep.guia.evaluaciones.oculta'));
      }
      await assertNoHorizontalOverflow(page, `Evaluaciones ${width}px / Política`);
      await assertVisibleHeadersFit(page, `Evaluaciones ${width}px / Política`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-evaluaciones-politica-dummy-${width}.png`), fullPage: true, animations: 'disabled' });

      await page.getByRole('tab', { name: 'Evidencias' }).click();
      await expect(page.getByText('Práctica ficticia de laboratorio')).toBeVisible();
      await assertNoHorizontalOverflow(page, `Evaluaciones ${width}px / Evidencias`);
      await assertVisibleHeadersFit(page, `Evaluaciones ${width}px / Evidencias`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-evaluaciones-evidencias-dummy-${width}.png`), fullPage: true, animations: 'disabled' });

      await page.getByRole('tab', { name: 'Exámenes' }).click();
      await expect(page.getByRole('tabpanel', { name: 'Exámenes' })).toBeVisible();
      await expect(page.getByRole('spinbutton', { name: 'Teórico' })).toHaveValue('');
      await expect(page.getByRole('spinbutton', { name: 'Teórico' })).toHaveAttribute('required', '');
      await expect(page.getByRole('textbox', { name: 'Prácticas (separadas por comas)' })).toHaveValue('');
      await expect(page.getByRole('button', { name: 'Guardar examen' })).toBeDisabled();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await assertNoHorizontalOverflow(page, `Evaluaciones ${width}px / Exámenes`);
      await assertVisibleHeadersFit(page, `Evaluaciones ${width}px / Exámenes`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-evaluaciones-examenes-dummy-${width}.png`), fullPage: true, animations: 'disabled' });

      await page.getByRole('tab', { name: 'Resumen' }).click();
      await page.getByRole('button', { name: /Consultar resumen/i }).click();
      const resultadosAlumno = page.getByRole('region', { name: 'Resultados del alumno' });
      await expect(resultadosAlumno.getByText('Política ficticia 2026 v1')).toBeVisible();
      await expect(resultadosAlumno.getByRole('group', { name: 'Evaluación continua' })).toBeVisible();
      await expect(resultadosAlumno.getByRole('group', { name: 'Exámenes' })).toBeVisible();
      const cortesSinColisiones = await resultadosAlumno.locator('.evaluaciones-resumen__grupo dl > div').evaluateAll((rows) =>
        rows.every((row) => {
          const label = row.querySelector('dt')?.getBoundingClientRect();
          const value = row.querySelector('dd')?.getBoundingClientRect();
          return Boolean(label && value && (label.right <= value.left + 1 || label.bottom <= value.top + 1 || value.bottom <= label.top + 1));
        })
      );
      expect(cortesSinColisiones, `las etiquetas y valores de los cortes deben quedar separados a ${width}px`).toBe(true);
      const resultadoFinal = resultadosAlumno.getByRole('group', { name: 'Calificación final' });
      await expect(resultadoFinal.getByText('8', { exact: true })).toBeVisible();
      await expect(resultadoFinal.getByText('8.4500')).toBeVisible();
      await assertEvaluacionesSummaryContrast(resultadosAlumno, `Evaluaciones ${width}px / Resumen / tema oscuro`);
      await assertNoHorizontalOverflow(page, `Evaluaciones ${width}px / Resumen`);
      await assertVisibleHeadersFit(page, `Evaluaciones ${width}px / Resumen`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-evaluaciones-resumen-dummy-${width}.png`), fullPage: true, animations: 'disabled' });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const guiaEnMovil = page.getByRole('button', { name: 'Ocultar guía rápida' });
    if (await guiaEnMovil.isVisible()) await guiaEnMovil.click();
    await expect(page.getByRole('button', { name: 'Ver guía rápida de Evaluaciones' })).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    for (const [tabName, slug] of [
      ['Política', 'politica'],
      ['Evidencias', 'evidencias'],
      ['Exámenes', 'examenes'],
      ['Resumen', 'resumen']
    ] as const) {
      const tab = page.getByRole('tab', { name: tabName });
      await tab.click();
      if (tabName === 'Resumen') await page.getByRole('button', { name: /Consultar resumen/i }).click();
      await expect(page.getByRole('tabpanel', { name: tabName })).toBeVisible();
      if (tabName === 'Evidencias') await expect(page.getByText('Práctica ficticia de laboratorio')).toBeVisible();
      if (tabName === 'Resumen') {
        const resultadosAlumno = page.getByRole('region', { name: 'Resultados del alumno' });
        await expect(resultadosAlumno.getByRole('group', { name: 'Calificación final' }).getByText('8.4500')).toBeVisible();
        await assertEvaluacionesSummaryContrast(resultadosAlumno, `Evaluaciones 390px / Resumen / tema claro`);
      }
      await assertNoHorizontalOverflow(page, `Evaluaciones 390px / ${tabName} / tema claro`);
      await assertVisibleHeadersFit(page, `Evaluaciones 390px / ${tabName} / tema claro`);
      await page.screenshot({ path: supplementalEvidencePath(`ux-audit-evaluaciones-${slug}-dummy-390-light.png`), fullPage: true, animations: 'disabled' });
    }
  });

  for (const viewport of viewports) {
    test(`acceso estable en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Ir directo a /acceso para evitar el redirect de react-router
      await page.goto('/acceso', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: /Bienvenido a EvaluaPro|Plataforma Docente|Ingresar|Crear cuenta/i }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('textbox', { name: 'Correo (obligatorio)' })).toHaveAttribute('required', '');
      await expect(page.getByRole('textbox', { name: 'Contraseña (obligatoria)' })).toHaveAttribute('required', '');
      await expect(page.getByText('(obligatorio)')).toBeVisible();
      await expect(page.getByText('(obligatoria)')).toBeVisible();
      await assertNoHorizontalOverflow(page, `Docente acceso ${viewport.name}`);
      await assertInteractiveControlsAreUsable(page, `Docente acceso ${viewport.name}`);
      if (viewport.name === 'desktop-lg' || viewport.name === 'mobile' || viewport.name === 'mobile-360' || viewport.name === 'mobile-narrow') {
        await captureEvidence(page, 'docente', 'login', viewport.name);
      }
      if (viewport.name === 'mobile-narrow' || viewport.name === 'desktop-lg') {
        for (const theme of ['light', 'dark']) {
          const themeButton = page.getByRole('button', { name: /^Tema:/ });
          const selectedLabel = theme === 'light' ? 'Tema: Claro' : 'Tema: Oscuro';
          for (let attempt = 0; attempt < 3 && await themeButton.getAttribute('aria-label') !== selectedLabel; attempt += 1) {
            const previousLabel = await themeButton.getAttribute('aria-label');
            await themeButton.click();
            await expect.poll(() => themeButton.getAttribute('aria-label')).not.toBe(previousLabel);
          }
          await expect(themeButton).toHaveAttribute('aria-label', selectedLabel);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          if (theme === 'light') {
            const badgeColors = await page.locator('.auth-showcase-badge').evaluate((badge) => {
              const style = getComputedStyle(badge);
              return { background: style.backgroundColor, border: style.borderTopColor, text: style.color };
            });
            expect(badgeColors, 'El badge claro debe usar superficie opaca y el par de acento de alto contraste').toEqual({
              background: 'rgb(255, 255, 255)',
              border: 'rgb(13, 80, 82)',
              text: 'rgb(13, 80, 82)'
            });
          }
          await captureEvidence(page, 'docente', `login-${theme}`, viewport.name);
        }
      }
      if (viewport.width <= 390) {
        const headerOverlap = await page.evaluate(() => {
          const title = document.querySelector('.auth-portal__title')?.getBoundingClientRect();
          const actions = document.querySelector('.auth-portal__top-actions')?.getBoundingClientRect();
          if (!title || !actions) return null;
          const overlapWidth = Math.max(0, Math.min(title.right, actions.right) - Math.max(title.left, actions.left));
          const overlapHeight = Math.max(0, Math.min(title.bottom, actions.bottom) - Math.max(title.top, actions.top));
          return overlapWidth * overlapHeight;
        });
        expect(headerOverlap, `El título y las acciones de Login no deben superponerse a ${viewport.width}px`).not.toBeNull();
        expect(headerOverlap, `El título y las acciones de Login no deben superponerse a ${viewport.width}px`).toBe(0);
      }
    });
  }

  test('acceso estable en viewport lateral compacto de 576px', async ({ page }) => {
    await page.setViewportSize({ width: 576, height: 900 });
    await page.goto('/acceso', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Plataforma Docente/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Correo (obligatorio)' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Contraseña (obligatoria)' })).toBeVisible();
    await assertNoHorizontalOverflow(page, 'Docente acceso en viewport lateral compacto de 576px');

    const lineCounts = await page.evaluate(() => {
      const countLines = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      };
      return {
        title: countLines('.auth-portal__title'),
        subtitle: countLines('.auth-portal__subtitle')
      };
    });
    expect(lineCounts.title, 'El nombre de la plataforma debe caber en una línea a 576px').toBe(1);
    expect(lineCounts.subtitle, 'La identidad institucional debe caber en una línea a 576px').toBe(1);
    await captureEvidence(page, 'docente', 'login', 'tablet-lateral-576');
  });

  for (const viewport of viewports) {
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
              tieneContrasena: true,
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
      await assertHeaderControlsFit(page, `Docente ${viewport.name}`);

      const tabs: TabCase[] = [
        { label: 'Materias', slug: 'periodos' },
        { label: 'Alumnos', slug: 'alumnos' },
        { label: 'Asistencias', slug: 'asistencias' },
        { label: 'Temarios', slug: 'temarios' },
        { label: 'Banco', slug: 'banco' },
        { label: 'Diseño de Exámenes', slug: 'plantillas' },
        { label: 'Entrega', slug: 'entrega' },
        { label: 'Calificaciones', slug: 'calificaciones' },
        { label: 'Rehidratación', slug: 'rehidratacion' },
        { label: 'Evaluaciones', slug: 'evaluaciones' },
        { label: 'Classroom', slug: 'classroom' },
        { label: 'Sincronización', slug: 'sincronizacion' },
        { label: 'Cuenta', slug: 'cuenta' }
      ];

      for (const tab of tabs) {
        if (viewport.width <= 1023) {
          const mobilePicker = nav.locator('#navegacion-docente-movil');
          const mobileOption = mobilePicker.getByRole('option', { name: tab.label, exact: true });
          await expect(mobilePicker).toBeVisible();
          await expect(mobilePicker).toHaveAccessibleName('Ir a sección');
          await expect(mobileOption, `falta la opción móvil "${tab.label}"`).toHaveCount(1);
          await mobilePicker.selectOption({ label: tab.label });
          await expect(mobilePicker.locator('option:checked')).toHaveText(tab.label);
          const activeTab = nav.locator('button.tab[aria-current="page"]');
          await expect(activeTab).toHaveCount(1);
          await expect(activeTab).toHaveText(tab.label);
        } else {
          const targetTab = nav.getByRole('button', { name: tab.label });
          if (await targetTab.getAttribute('aria-current') !== 'page') {
            await targetTab.click();
          }
          await expect(targetTab).toHaveAttribute('aria-current', 'page');
        }
        if (['periodos', 'alumnos', 'asistencias', 'temarios', 'banco', 'plantillas', 'entrega', 'evaluaciones', 'sincronizacion', 'cuenta'].includes(tab.slug)) {
          await assertSectionEmblem(page, `Emblema de ${tab.label} en ${viewport.name}`);
        }
        if (tab.slug === 'plantillas') {
          await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
          await expect(page.locator('.plantillas-formato-box')).toBeVisible();
          await expect(page.locator('.plantillas-studio-intro')).toBeVisible();
          await assertPlantillasFormatoContrast(page);
          await assertPlantillasStudioContrast(page);
          await assertPlantillasSummaryContrast(page);
        }
        if (tab.slug === 'calificaciones') {
          await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
          await assertHeaderPartsAreNotCardSurfaces(page, `${viewport.name} / calificaciones`);
          await assertHeaderBlocksDoNotOverlap(page, `${viewport.name} / calificaciones`);
          await assertCalificacionesKpiContrast(page, `${viewport.name} / calificaciones`);
        }
        if (tab.slug === 'temarios' && viewport.width <= 390) {
          const selectorLayout = await page.locator('.temarios-panel').evaluate((panel) => {
            const selector = panel.querySelector<HTMLElement>('.temarios-filtros-bar');
            const style = getComputedStyle(panel);
            return {
              selectorWidth: selector?.getBoundingClientRect().width ?? 0,
              contentWidth: panel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
            };
          });
          expect(selectorLayout.selectorWidth, 'El selector de materia debe ocupar el ancho útil del panel en móvil').toBeGreaterThanOrEqual(selectorLayout.contentWidth - 1);
        }
        if (tab.slug === 'sincronizacion' && viewport.width <= 720) {
          const kpis = page.locator('.sincronizacion-header-kpis > .banco-mini-kpi');
          await expect(kpis).toHaveCount(4);
          const layout = await page.locator('.sincronizacion-header-kpis').evaluate((group) => ({
            columns: getComputedStyle(group).gridTemplateColumns.trim().split(/\s+/).length,
            cards: [...group.querySelectorAll<HTMLElement>('.banco-mini-kpi')].map((card) => ({
              width: card.getBoundingClientRect().width,
              top: card.getBoundingClientRect().top
            }))
          }));
          expect(layout.columns, `Sincronización debe usar dos columnas en ${viewport.name}`).toBe(2);
          const widths = layout.cards.map((card) => card.width);
          expect(Math.max(...widths) - Math.min(...widths), `Sincronización debe usar tarjetas del mismo ancho en ${viewport.name}`).toBeLessThanOrEqual(1);
          expect(new Set(layout.cards.map((card) => card.top)).size, `Sincronización debe formar dos filas en ${viewport.name}`).toBe(2);
          await expect(page.getByRole('heading', { name: 'Respaldo completo del equipo' })).toBeVisible();
          const backupPanel = page.locator('.paquete-sincronizacion-panel').filter({
            has: page.getByRole('heading', { name: 'Respaldo completo del equipo' })
          });
          const panelBounds = await backupPanel.boundingBox();
          const descriptionBounds = await backupPanel.locator('p.nota').first().boundingBox();
          expect(panelBounds, `Panel de respaldo con geometría visible en ${viewport.name}`).not.toBeNull();
          expect(descriptionBounds, `Instrucciones del respaldo con geometría visible en ${viewport.name}`).not.toBeNull();
          expect(descriptionBounds!.x - panelBounds!.x, `Instrucciones con margen interior en ${viewport.name}`).toBeGreaterThanOrEqual(12);
          expect(panelBounds!.x + panelBounds!.width - (descriptionBounds!.x + descriptionBounds!.width), `Instrucciones dentro del margen derecho en ${viewport.name}`).toBeGreaterThanOrEqual(12);
          const restoreLabel = page.locator('.paquete-sincronizacion-panel label').filter({ hasText: 'Importar respaldo completo (.ep-snapshot)' });
          await expect(restoreLabel).toBeVisible();
          const restoreBounds = await restoreLabel.boundingBox();
          expect(restoreBounds, `Importar respaldo debe tener geometría visible en ${viewport.name}`).not.toBeNull();
          expect(restoreBounds!.x, `Importar respaldo no debe salir del borde izquierdo en ${viewport.name}`).toBeGreaterThanOrEqual(0);
          expect(restoreBounds!.x + restoreBounds!.width, `Importar respaldo no debe salir del borde derecho en ${viewport.name}`).toBeLessThanOrEqual(viewport.width + 1);
          const exportButton = page.getByRole('button', { name: 'Exportar respaldo completo' });
          await expect(exportButton).toBeVisible();
          const exportBounds = await exportButton.boundingBox();
          expect(exportBounds, `Exportar respaldo debe tener geometría visible en ${viewport.name}`).not.toBeNull();
          expect(exportBounds!.x, `Exportar respaldo no debe salir del borde izquierdo en ${viewport.name}`).toBeGreaterThanOrEqual(0);
          expect(exportBounds!.x + exportBounds!.width, `Exportar respaldo no debe salir del borde derecho en ${viewport.name}`).toBeLessThanOrEqual(viewport.width + 1);
          await page.screenshot({
            path: `test-results/gui-docente-sincronizacion-respaldo-${viewport.width}.png`,
            fullPage: true,
            animations: 'disabled'
          });
          if (viewport.width === 320) {
            await backupPanel.screenshot({
              path: 'test-results/gui-docente-sincronizacion-respaldo-panel-320.png',
              animations: 'disabled'
            });
          }
        }
        if (tab.slug === 'plantillas' && viewport.width === 320) {
          await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR || 'test-results'}/gui-docente-plantillas-320-before-fix.png`, fullPage: true, animations: 'disabled' });
        }
        await page.waitForTimeout(300);
        await assertNoHorizontalOverflow(page, `Docente ${viewport.name} / ${tab.slug}`);
        await assertVisibleHeadersFit(page, `Docente ${viewport.name} / ${tab.slug}`);
        await assertInteractiveControlsAreUsable(page, `Docente ${viewport.name} / ${tab.slug}`);
        if (tab.slug === 'entrega') {
          const conexionMovil = page.locator('.entregas-qr-companion');
          const controlConexionMovil = conexionMovil.locator('summary');
          await expect(controlConexionMovil).toContainText('Conexión móvil (opcional)');
          await controlConexionMovil.focus();
          await page.keyboard.press('Enter');
          await expect.poll(() => conexionMovil.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);
          if (viewport.width <= 390) {
            await assertEntregaKpisUseBalancedMobileGrid(page, `Entrega ${viewport.name}`);
            await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
            await assertKpiLightContrast(page, '.entrega-header-kpis', 4, `Entrega ${viewport.name}`);
            await captureEvidence(page, 'docente', 'entrega-light', viewport.name);
            await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
            await captureEvidence(page, 'docente', 'entrega-dark', viewport.name);
            await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
          }
          const qr = page.getByRole('img', { name: 'QR para abrir en movil' });
          await expect(qr).toBeVisible();
          await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
          await expect(page.getByText(/No se pudo detectar la IP local|No se pudo generar el QR/)).toHaveCount(0);
          await page.mouse.move(0, 0);
          await page.locator('.toast').waitFor({ state: 'detached', timeout: 8_000 }).catch(() => undefined);
        }
        if (tab.slug === 'evaluaciones' && viewport.width <= 390) {
          await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
          await assertKpiLightContrast(page, '.evaluaciones-header-kpis', 2, `Evaluaciones ${viewport.name}`);
          await captureEvidence(page, 'docente', 'evaluaciones-light', viewport.name);
          await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
          await captureEvidence(page, 'docente', 'evaluaciones-dark', viewport.name);
          await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
        }
        if (tab.slug === 'sincronizacion' && viewport.width <= 390) {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        }
        await captureEvidence(page, 'docente', tab.slug, viewport.name);
        if (viewport.name === 'mobile' && ['asistencias', 'temarios', 'classroom'].includes(tab.slug)) {
          const evidenceDir = process.env.E2E_SCREENSHOT_DIR || 'reports/qa/latest';
          await page.screenshot({
            path: `${evidenceDir}/gui-docente-${tab.slug}-mobile-full.png`,
            fullPage: true,
            animations: 'disabled'
          });
        }
      }
    });
  }

  test('Entrega y Evaluaciones distribuyen KPI legibles sin desbordar en 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addInitScript(() => localStorage.setItem('tokenDocente', 'token-entrega-mobile-narrow-dummy'));
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-entrega-mobile-narrow-dummy',
          nombre: 'Docente de prueba',
          correo: 'entrega@example.invalid',
          permisos: ['periodos:leer', 'entregas:gestionar', 'omr:analizar', 'evaluaciones:leer'],
          roles: ['docente']
        } })
      });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Entrega' });
    await expect(page.locator('.entrega-header-kpis')).toBeVisible();
    await assertEntregaKpisUseBalancedMobileGrid(page, 'Entrega mobile-narrow');
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await assertKpiLightContrast(page, '.entrega-header-kpis', 4, 'Entrega mobile-narrow');
    await captureEvidence(page, 'docente', 'entrega-mobile-narrow', '320');
    await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Evaluaciones' });
    await expect(page.locator('.evaluaciones-header-kpis')).toBeVisible();
    await assertKpiLightContrast(page, '.evaluaciones-header-kpis', 2, 'Evaluaciones mobile-narrow');
    await captureEvidence(page, 'docente', 'evaluaciones-mobile-narrow', '320');
  });

  test('audita Banco de reactivos con contenido ficticio a 320/390 px y ambos temas', async ({ page }) => {
    const periodoId = 'periodo-banco-ux-dummy';
    let perfilBanco: 'completo' | 'sin-gestion' | 'sin-archivo' = 'completo';
    let incluirPreguntaHeredada = false;
    let falloConsultaBanco = false;
    let falloConsultaTemasBanco = false;
    let falloPreviewBanco = true;
    await page.addInitScript(() => {
      localStorage.setItem('tokenDocente', 'token-banco-ux-dummy');
      localStorage.removeItem('ep.guia.banco.oculta');
    });
    await page.route('**/api/autenticacion/perfil', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ docente: {
          _id: 'docente-banco-ux-dummy',
          nombre: 'Docente de prueba',
          correo: 'banco@example.invalid',
          permisos: [
            'periodos:leer', 'banco:leer',
            ...(perfilBanco === 'sin-gestion' ? [] : ['banco:gestionar', 'banco:ingestar', 'banco:publicar']),
            ...(perfilBanco === 'sin-archivo' ? [] : ['banco:archivar'])
          ],
          roles: ['docente']
        } })
      });
    });
    await page.route('**/api/periodos**', async (route) => {
      const archivadas = new URL(route.request().url()).searchParams.get('activo') === '0';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ periodos: archivadas ? [] : [{
          _id: periodoId,
          nombre: 'Física de prueba — 3A',
          grupos: ['3A'],
          activo: true
        }] })
      });
    });
    await page.route('**/api/banco-preguntas/temas**', async (route) => {
      if (falloConsultaTemasBanco) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Servicio no disponible' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ temas: [{ _id: 'tema-mecanica-dummy', periodoId, nombre: 'Mecánica' }] })
      });
    });
    await page.route('**/api/banco-preguntas/importaciones**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ importaciones: [] }) });
    });
    await page.route('**/api/banco-preguntas/importaciones/preview', async (route) => {
      if (falloPreviewBanco) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: {
          codigo: 'REACTIVOS_PAYLOAD_INVALIDO',
          mensaje: 'El lote de reactivos no cumple el contrato v1'
        } }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          importId: 'import-banco-preview-dummy',
          planHash: 'a'.repeat(64),
          payload: {},
          summary: { create: 1, noOp: 0, newVersion: 0, conflict: 0, error: 0 },
          rows: [{ line: 1, externalKey: 'reactivo-preview-dummy', operation: 'create', status: 'valid' }]
        })
      });
    });
    await page.route('**/api/banco-preguntas', async (route) => {
      if (falloConsultaBanco) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Servicio no disponible' }) });
        return;
      }
      const preguntas: Array<Record<string, unknown>> = [{
          _id: 'pregunta-banco-dummy-001',
          reactivoId: 'reactivo-banco-dummy-001',
          periodoId,
          tema: 'Mecánica',
          activo: true,
          versionActual: 1,
          versiones: [{
            numeroVersion: 1,
            enunciado: '¿Qué magnitud se conserva en un sistema aislado durante una colisión elástica?',
            opciones: [
              { texto: 'La cantidad de movimiento', esCorrecta: true },
              { texto: 'La temperatura', esCorrecta: false },
              { texto: 'La fuerza externa', esCorrecta: false },
              { texto: 'La posición inicial', esCorrecta: false },
              { texto: 'El volumen', esCorrecta: false }
            ]
          }],
          createdAt: '2026-09-01T12:00:00.000Z'
        }];
        if (incluirPreguntaHeredada) {
          preguntas.push({
            _id: 'pregunta-banco-heredada-dummy-002',
            periodoId,
            tema: 'Mecánica',
            activo: true,
            versionActual: 1,
            versiones: [{
              numeroVersion: 1,
              enunciado: '¿Cuál es la unidad de fuerza en el Sistema Internacional?',
              opciones: [
                { texto: 'Newton', esCorrecta: true },
                { texto: 'Joule', esCorrecta: false },
                { texto: 'Watt', esCorrecta: false },
                { texto: 'Pascal', esCorrecta: false },
                { texto: 'Coulomb', esCorrecta: false }
              ]
            }],
            createdAt: '2026-09-02T12:00:00.000Z'
          });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ preguntas })
        });
    });

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: /Secciones del portal docente/i });
      await expect(nav).toBeVisible({ timeout: 15_000 });
      await nav.locator('#navegacion-docente-movil').selectOption({ label: 'Banco' });
      await expect(page.getByRole('heading', { name: 'Banco de preguntas' })).toBeVisible();
      const controlGuia = page.locator('#toggle-guia-banco');
      await expect(controlGuia).toHaveAccessibleName('Ver guía rápida de Banco de reactivos');
      await expect(controlGuia).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#guia-banco-panel')).toBeHidden();
      await controlGuia.focus();
      await page.keyboard.press('Enter');
      await expect(controlGuia).toBeFocused();
      await expect(controlGuia).toHaveAccessibleName('Ocultar guía rápida de Banco de reactivos');
      await expect(controlGuia).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('region', { name: 'Ayuda: Banco de preguntas y estimación' })).toBeVisible();
      await page.keyboard.press('Space');
      await expect(controlGuia).toBeFocused();
      await expect(controlGuia).toHaveAccessibleName('Ver guía rápida de Banco de reactivos');
      await expect(controlGuia).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#guia-banco-panel')).toBeHidden();
      await expect(page.getByText(/cantidad de movimiento/i)).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Buscar en enunciado' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Asignar tema al reactivo' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Filtrar por tema' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Opciones de respuesta', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copiar plantilla' })).toHaveClass(/\bboton\b/);
      if (width === 320) {
        const optionEditorWidths = await page.locator('#banco-captura .banco-opcion-card .rich-editor').evaluateAll((editors) =>
          editors.map((editor) => Math.round(editor.getBoundingClientRect().width))
        );
        expect(optionEditorWidths, 'Deben mostrarse los cinco editores de respuesta').toHaveLength(5);
        expect(Math.min(...optionEditorWidths), 'Cada editor de opción debe conservar ancho útil a 320 px').toBeGreaterThanOrEqual(140);
        const clippedToolbars = await page.locator('#banco-captura .rich-editor__toolbar').evaluateAll((toolbars) => toolbars.flatMap((toolbar) => {
          const bounds = toolbar.getBoundingClientRect();
          const clippedButtons = [...toolbar.querySelectorAll('button')].filter((button) => {
            const buttonBounds = button.getBoundingClientRect();
            return buttonBounds.left < bounds.left - 1 || buttonBounds.right > bounds.right + 1;
          });
          return clippedButtons.length > 0 || toolbar.scrollWidth > toolbar.clientWidth + 1
            ? [{ width: toolbar.clientWidth, scrollWidth: toolbar.scrollWidth, clippedButtons: clippedButtons.length }]
            : [];
        }));
        expect(clippedToolbars, 'Las herramientas del editor deben quedar visibles a 320 px').toEqual([]);
      }
      const borradorCaptura = page.getByPlaceholder(/Redacta una pregunta clara y directa/i);
      await borradorCaptura.fill('Borrador de navegación');
      const imagenInput = page.locator('#banco-file-input-crear');
      await expect(imagenInput).toHaveAttribute('accept', 'image/*');
      await expect(imagenInput).toHaveAttribute('aria-hidden', 'true');
      await expect(imagenInput).toHaveAttribute('tabindex', '-1');
      const imagenInputGeometry = await imagenInput.evaluate((input) => {
        const style = getComputedStyle(input);
        return { opacity: style.opacity, clipPath: style.clipPath };
      });
      expect(imagenInputGeometry.opacity, `Banco ${width}px: el selector nativo de imagen permanece accesible sin pintar la fila truncada`).toBe('0');
      expect(imagenInputGeometry.clipPath).toBe('inset(50%)');
      const imagePickerTrigger = page.locator('.banco-file-custom-btn').first();
      await expect(imagePickerTrigger).toHaveAccessibleName('Seleccionar imagen de apoyo');
      const imagePickerBounds = await imagePickerTrigger.evaluate((trigger) => {
        const rect = trigger.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      expect(imagePickerBounds.width).toBeGreaterThan(0);
      expect(imagePickerBounds.height, `Banco ${width}px: el disparador de imagen ofrece un objetivo táctil legible`).toBeGreaterThanOrEqual(44);
      const imagePickerLayout = await imagePickerTrigger.evaluate((trigger) => {
        const field = trigger.closest<HTMLElement>('.banco-imagen-box');
        if (!field) return { found: false, left: -Infinity, right: Infinity, contentLeft: Infinity, contentRight: -Infinity };
        const button = trigger.getBoundingClientRect();
        const bounds = field.getBoundingClientRect();
        const style = getComputedStyle(field);
        return {
          found: true,
          left: button.left,
          right: button.right,
          contentLeft: bounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
          contentRight: bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight)
        };
      });
      expect(imagePickerLayout.found, `Banco ${width}px: el botón debe conservar su campo de imagen`).toBe(true);
      expect(imagePickerLayout.left, `Banco ${width}px: el botón de imagen debe quedar dentro de su campo`).toBeGreaterThanOrEqual(imagePickerLayout.contentLeft - 1);
      expect(imagePickerLayout.right, `Banco ${width}px: el botón de imagen no debe recortarse en su campo`).toBeLessThanOrEqual(imagePickerLayout.contentRight + 1);
      const taskNav = page.getByRole('navigation', { name: 'Tareas del banco de reactivos' });
      const taskNavDecoration = await taskNav.locator('a').evaluateAll((links) =>
        links.map((link) => getComputedStyle(link).textDecorationLine)
      );
      expect(taskNavDecoration, `Banco ${width}px: los saltos deben tener estilo de botón, no apariencia de enlace sin formato`).toEqual(['none', 'none', 'none', 'none']);
      const taskDestinations = [
        ['Capturar', 'banco-captura'],
        ['Importar', 'banco-importacion'],
        ['Gestionar temas', 'banco-temas'],
        ['Consultar reactivos', 'banco-listado']
      ] as const;
      for (const [label, targetId] of taskDestinations) {
        const link = taskNav.getByRole('link', { name: label });
        await link.focus();
        await link.press('Enter');
        await expect(page.locator(`#${targetId}`), `Banco ${width}px: foco en ${label}`).toBeFocused();
        await expect(borradorCaptura, `Banco ${width}px: borrador preservado tras ir a ${label}`).toHaveValue('Borrador de navegación');
      }
      const fileInput = page.locator('#banco-importacion input[type="file"]');
      await expect(fileInput).toHaveClass(/sr-only/);
      await expect(fileInput).toHaveAttribute('aria-hidden', 'true');
      await expect(fileInput).toHaveAttribute('tabindex', '-1');
      await expect(page.getByRole('button', { name: 'Seleccionar archivo de reactivos' })).toBeVisible();
      const filePickerBounds = await page.locator('.banco-reactivos-import__file-trigger').evaluate((trigger) => {
        const rect = trigger.getBoundingClientRect();
        const parent = trigger.closest('.banco-reactivos-import__upload')!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, parentLeft: parent.left, parentRight: parent.right };
      });
      expect(filePickerBounds.left, `Banco ${width}px: selector de archivo dentro de la tarjeta`).toBeGreaterThanOrEqual(filePickerBounds.parentLeft - 1);
      expect(filePickerBounds.right, `Banco ${width}px: selector de archivo dentro de la tarjeta`).toBeLessThanOrEqual(filePickerBounds.parentRight + 1);
      expect(filePickerBounds.bottom - filePickerBounds.top, `Banco ${width}px: selector de archivo con área táctil suficiente`).toBeGreaterThanOrEqual(44);
      const selectorImportacion = page.locator('#banco-importacion .banco-reactivos-import__file');
      await expect(selectorImportacion).toHaveAttribute('role', 'status');
      await expect(selectorImportacion).toHaveText('Sin archivo seleccionado.');
      const estadoArchivoBounds = await selectorImportacion.evaluate((element) => {
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
