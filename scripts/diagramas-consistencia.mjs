import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const shouldCheck = args.has('--check');

if (!shouldCheck) {
  console.error('Uso: node scripts/diagramas-consistencia.mjs --check');
  process.exit(2);
}

function normalizarSaltosLinea(texto) {
  return texto.replace(/\r\n/g, '\n');
}

function rutaRel(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
      continue;
    }
    files.push(full);
  }
  return files;
}

function extraerRutasRouter(rutasTsContent) {
  const re = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,/g;
  const rutas = [];
  for (const m of rutasTsContent.matchAll(re)) {
    rutas.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return rutas;
}

function extraerMontajesBackend(rutasTsContent) {
  const re = /router\.use\(\s*['"]([^'"]+)['"]\s*,/g;
  const montajes = [];
  for (const m of rutasTsContent.matchAll(re)) {
    montajes.push(m[1]);
  }
  return montajes;
}

function normalizarPathDiagrama(rawPath) {
  // Quita paréntesis de anotaciones (Bearer), querystring, y trailing chars.
  let p = rawPath.trim();
  p = p.replace(/\)\s*$/, ')');
  p = p.replace(/\s*\(.*?\)\s*$/g, '');
  p = p.split('?')[0];
  p = p.replace(/[),.;]+$/g, '');
  return p;
}

function extraerReferenciasHttpDesdeMermaid(content) {
  // Busca patrones comunes en diagrams: "POST /api/..." o "GET /api/...".
  // No intenta parsear Mermaid formalmente; es un lint pragmático.
  const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+((?:\/api)(?:\/[^\s<)]*)?)/g;
  const refs = [];
  for (const m of content.matchAll(re)) {
    const method = m[1].toUpperCase();
    const pathRaw = m[2];
    const normalized = normalizarPathDiagrama(pathRaw);
    if (!normalized.startsWith('/api')) continue;
    refs.push({ method, path: normalized });
  }
  return refs;
}

function setFromRoutes(routes, prefix) {
  const set = new Set();
  for (const r of routes) {
    const full = `${prefix}${r.path.startsWith('/') ? '' : '/'}${r.path}`;
    set.add(`${r.method} ${full}`);
  }
  return set;
}

async function cargarModelo() {
  const portalApp = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/portal_alumno_cloud/src/app.ts'), 'utf8'));
  const portalRutas = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/portal_alumno_cloud/src/rutas.ts'), 'utf8'));
  const backendApp = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/backend/src/app.ts'), 'utf8'));
  const backendRutas = normalizarSaltosLinea(await fs.readFile(path.join(rootDir, 'apps/backend/src/rutas.ts'), 'utf8'));

  const reAppUse = /app\.use\(\s*['"]([^'"]+)['"]\s*,/;
  const portalPrefijo = reAppUse.exec(portalApp)?.[1] ?? '/api/portal';
  const backendPrefijo = reAppUse.exec(backendApp)?.[1] ?? '/api';

  const portalRoutes = extraerRutasRouter(portalRutas);
  const portalSet = setFromRoutes(portalRoutes, portalPrefijo);

  const backendMontajes = extraerMontajesBackend(backendRutas);
  const backendMontajesSet = new Set(backendMontajes);

  return { portalPrefijo, backendPrefijo, portalSet, backendMontajesSet };
}

function mountDesdeApiPath(apiPath) {
  // /api/<mount>/...
  const parts = apiPath.split('/').filter(Boolean);
  // parts[0] === 'api'
  if (parts.length < 2) return null;
  return `/${parts[1]}`;
}

const { portalPrefijo, portalSet, backendMontajesSet } = await cargarModelo();

const secDir = path.join(rootDir, 'docs', 'diagramas', 'src', 'secuencias');
const files = (await walkFiles(secDir)).filter((f) => f.toLowerCase().endsWith('.mmd'));

if (files.length === 0) {
  console.error('[diagramas:consistencia] no hay .mmd en docs/diagramas/src/secuencias');
  process.exit(2);
}

let ok = true;
for (const filePath of files) {
  const content = normalizarSaltosLinea(await fs.readFile(filePath, 'utf8'));
  const refs = extraerReferenciasHttpDesdeMermaid(content);
  if (refs.length === 0) continue;

  for (const ref of refs) {
    const key = `${ref.method} ${ref.path}`;

    // Portal: validación exacta método+path.
    if (ref.path.startsWith(portalPrefijo)) {
      if (!portalSet.has(key)) {
        console.error(`[diagramas:consistencia] ruta portal no existe: ${key}`);
        console.error(`  en: ${rutaRel(filePath)}`);
        ok = false;
      }
      continue;
    }

    // Backend: validación por montaje (evita typos gruesos y rutas fuera de superficie).
    const mount = mountDesdeApiPath(ref.path);
    if (!mount || !backendMontajesSet.has(mount)) {
      console.error(`[diagramas:consistencia] ruta backend con montaje desconocido: ${key}`);
      console.error(`  en: ${rutaRel(filePath)}`);
      console.error(`  esperado montaje en: ${[...backendMontajesSet].sort((a, b) => a.localeCompare(b, 'es')).join(', ')}`);
      ok = false;
    }
  }
}

if (!ok) {
  process.exitCode = 1;
} else {
  console.log('[diagramas:consistencia] ok');
}
