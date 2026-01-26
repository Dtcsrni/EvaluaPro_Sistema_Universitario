import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const cssPath = path.join(root, 'apps', 'frontend', 'src', 'styles.css');
const css = fs.readFileSync(cssPath, 'utf8');

function extractVars(selector) {
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = css.match(re);
  if (!match) return {};
  const block = match[1];
  const vars = {};
  for (const line of block.split(';')) {
    const m = line.match(/--([A-Za-z0-9-_]+)\s*:\s*([^;]+)/);
    if (!m) continue;
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

function parseColor(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = parseInt(hex[3] + hex[3], 16) / 255;
      return { r, g, b, a };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return { r, g, b, a };
    }
    return null;
  }
  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => p.trim());
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts.length > 3 ? Number(parts[3]) : 1;
    if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }
  return null;
}

function blend(fg, bg) {
  const a = fg.a;
  const r = Math.round(fg.r * a + bg.r * (1 - a));
  const g = Math.round(fg.g * a + bg.g * (1 - a));
  const b = Math.round(fg.b * a + bg.b * (1 - a));
  return { r, g, b, a: 1 };
}

function srgbToLinear(x) {
  const v = x / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(color) {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveVar(value, vars) {
  const varMatch = String(value).match(/var\((--[A-Za-z0-9-_]+)\)/);
  if (!varMatch) return value;
  const resolved = vars[varMatch[1]];
  if (!resolved) return value;
  return resolveVar(resolved, vars);
}

function resolveColor(value, vars, fallbackBg) {
  const resolved = resolveVar(value, vars);
  const color = parseColor(resolved);
  if (!color) return null;
  if (color.a < 1) {
    return blend(color, fallbackBg);
  }
  return color;
}

function runTheme(label, vars, fallbackBg) {
  const pairs = [
    { name: 'texto/superficie', fg: '--texto', bg: '--superficie' },
    { name: 'texto/superficieSolida', fg: '--texto', bg: '--superficieSolida' },
    { name: 'textoSuave/superficie', fg: '--textoSuave', bg: '--superficie' },
    { name: 'muted/superficie', fg: '--muted', bg: '--superficie' },
    { name: 'chip', fg: '--chipTexto', bg: '--chipBg' },
    { name: 'peligro', fg: '--peligroTexto', bg: '--peligroBg' },
    { name: 'aviso', fg: '--avisoTexto', bg: '--avisoBg' },
    { name: 'exito', fg: '--exitoTexto', bg: '--exitoBg' },
    { name: 'boton', fg: '#ffffff', bg: '--primario' }
  ];

  console.log(`\n${label}`);
  for (const pair of pairs) {
    const fg = resolveColor(vars[pair.fg] ?? pair.fg, vars, fallbackBg);
    const bg = resolveColor(vars[pair.bg] ?? pair.bg, vars, fallbackBg);
    if (!fg || !bg) {
      console.log(`- ${pair.name}: skip`);
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    const ok = ratio >= 4.5;
    console.log(`- ${pair.name}: ${ratio.toFixed(2)} ${ok ? 'OK' : 'FAIL'}`);
  }
}

const lightVars = extractVars(':root');
const darkVars = extractVars(':root\\[data-theme=\"dark\"\\]');

runTheme('Light', lightVars, { r: 255, g: 255, b: 255, a: 1 });
runTheme('Dark', darkVars, { r: 0, g: 0, b: 0, a: 1 });
