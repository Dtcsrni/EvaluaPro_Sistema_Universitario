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
    ['.evaluaciones-resumen__bloques span', 'etiqueta de bl