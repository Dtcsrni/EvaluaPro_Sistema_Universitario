Warning: truncated output (original token count: 140325)
Total output lines: 8937

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
  for (const [theme, expectedBor…100325 tokens truncated…ent.getBoundingClientRect().right,
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
      test.setTimeout(120_000);
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
    // Este escenario recarga la app varias veces y verifica permisos, temas y estados de error.
    test.setTimeout(90_000);
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

