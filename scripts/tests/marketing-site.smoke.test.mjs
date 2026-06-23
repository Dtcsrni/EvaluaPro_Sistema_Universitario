/**
 * marketing-site.smoke.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', '..');
const siteDir = path.join(root, 'site');
const indexPath = path.join(siteDir, 'index.html');
const cssPath = path.join(siteDir, 'styles.css');
const jsPath = path.join(siteDir, 'app.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const p of [siteDir, indexPath, cssPath, jsPath]) {
  assert(fs.existsSync(p), `No existe: ${p}`);
}

const html = fs.readFileSync(indexPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const requiredHtml = [
  'id="inicio"',
  'id="producto"',
  'id="licencias"',
  'id="faq"',
  'Solicitar demo',
  'Cotizar licencia',
  'armsystechno@gmail.com'
];

const requiredCss = ['.hero', '.pricing', '.faq', '.reveal', '.btn-primary'];
const requiredJs = ['IntersectionObserver', 'metric', 'requestAnimationFrame'];

for (const token of requiredHtml) {
  assert(html.includes(token), `Falta token HTML: ${token}`);
}

for (const token of requiredCss) {
  assert(css.includes(token), `Falta token CSS: ${token}`);
}

for (const token of requiredJs) {
  assert(js.includes(token), `Falta token JS: ${token}`);
}

console.log('[marketing-site-smoke] ok');
