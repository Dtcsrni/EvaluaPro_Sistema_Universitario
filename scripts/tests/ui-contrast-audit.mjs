import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cssPath = path.join(repoRoot, 'apps/frontend/src/styles/cards.css');
const css = fs.readFileSync(cssPath, 'utf8');
const foundationsCss = fs.readFileSync(path.join(repoRoot, 'apps/frontend/src/styles/foundations.css'), 'utf8');

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const normalized = hex.replace('#', '');
  assert.match(normalized, /^[0-9a-f]{6}$/i, `color inválido: ${hex}`);
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
  const [red, green, blue] = channels.map(channelToLinear);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const checks = [
  { id: 'dark-heading-on-card', foreground: '#f8fbff', background: '#214464', minimum: 4.5 },
  { id: 'dark-supporting-on-card', foreground: '#d9e8f5', background: '#214464', minimum: 4.5 },
  { id: 'dark-muted-on-card', foreground: '#c8d8eb', background: '#214464', minimum: 4.5 },
  { id: 'dark-placeholder-on-input', foreground: '#b9cfe2', background: '#061326', minimum: 4.5 },
  { id: 'dark-heading-on-panel', foreground: '#f8fbff', background: '#102a46', minimum: 4.5 },
  { id: 'dark-supporting-on-panel', foreground: '#d9e8f5', background: '#102a46', minimum: 4.5 },
  { id: 'light-heading-on-card', foreground: '#0f172a', background: '#ffffff', minimum: 4.5 },
  { id: 'light-supporting-on-card', foreground: '#334155', background: '#ffffff', minimum: 4.5 },
  { id: 'light-muted-on-card', foreground: '#475569', background: '#ffffff', minimum: 4.5 },
  { id: 'dark-primary-button', foreground: '#ffffff', background: '#0b6fa8', minimum: 4.5 },
  { id: 'dark-secondary-button', foreground: '#f8fbff', background: '#234869', minimum: 4.5 },
  { id: 'light-primary-button', foreground: '#ffffff', background: '#0b6fa8', minimum: 4.5 },
  { id: 'light-secondary-button', foreground: '#102033', background: '#f4f8fb', minimum: 4.5 },
];

assert.match(css, /--muted:\s*#c8d8eb/);
assert.match(css, /color:\s*#f8fbff\s*!important/);
assert.match(css, /color:\s*#d9e8f5\s*!important/);
assert.match(css, /color:\s*#b9cfe2\s*!important/);
assert.match(foundationsCss, /--ui-canvas:\s*#07162b/);
assert.match(foundationsCss, /--ui-text-primary:\s*#f8fbff/);
assert.match(foundationsCss, /--ui-button-primary-bg:\s*#0b6fa8/);
assert.match(css, /--ui-card-blur:\s*var\(--ui-glass-blur\)/);
assert.match(css, /background:\s*linear-gradient\(112deg/);

const results = checks.map((check) => ({
  ...check,
  ratio: contrastRatio(check.foreground, check.background),
}));

for (const result of results) {
  assert.ok(
    result.ratio >= result.minimum,
    `${result.id}: ${result.ratio.toFixed(2)}:1 < ${result.minimum}:1`,
  );
  console.log(`${result.id}: ${result.ratio.toFixed(2)}:1 PASS`);
}

console.log(`WCAG 2.x contraste: ${results.length}/${results.length} pares PASS`);
