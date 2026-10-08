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
  'id="como-funciona"',
  'id="datos"',
  'id="licencias"',
  'id="faq"',
  'aria-label="Navegación principal"',
  'docente-local',
  'El docente debe revisar',
  'Descargar para Windows',
  'releases/latest',
  'armsystechno@gmail.com'
];

const requiredCss = ['.hero', '.faq', '.reveal', '.btn-primary', '.product-preview', 'prefers-reduced-motion'];
const requiredJs = ["classList.add('has-js')", 'IntersectionObserver', 'aria-expanded', 'Escape'];

for (const token of requiredHtml) {
  assert(html.includes(token), `Falta token HTML: ${token}`);
}

for (const token of requiredCss) {
  assert(css.includes(token), `Falta token CSS: ${token}`);
}

for (const token of requiredJs) {
  assert(js.includes(token), `Falta token JS: ${token}`);
}

assert(css.includes('.topbar nav { width: 100%; display: grid;'), 'La navegación y descarga deben permanecer visibles si JavaScript no carga');
assert(css.includes('html.has-js .topbar nav { display: none; }'), 'El menú compacto solo se oculta cuando JavaScript ya está activo');
assert(css.includes('html.has-js .nav-toggle { display: inline-flex; }'), 'El botón de menú solo aparece cuando su controlador está disponible');

assert((html.match(/<h1(?:\s|>)/gi) ?? []).length === 1, 'La página debe tener un único h1');

const sectionIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
for (const [, target] of html.matchAll(/href="#([^\"]+)"/g)) {
  assert(sectionIds.has(target), `El ancla interna #${target} no apunta a una sección existente`);
}

for (const staleClaim of [
  'v1.1.1',
  '100% Precisión',
  'sincroniza automáticamente con Google Classroom',
  'Respuesta garantizada en 24 horas',
  'SLA de soporte técnico 24/7',
  '100% Confianza OMR'
]) {
  assert(!html.includes(staleClaim), `La landing conserva una afirmación obsoleta o no sustentada: ${staleClaim}`);
}

console.log('[marketing-site-smoke] ok');
