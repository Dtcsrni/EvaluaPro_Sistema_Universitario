/**
 * inventario-codigo
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const salida = path.join(rootDir, 'docs', 'INVENTARIO_CODIGO_EXHAUSTIVO.md');

const EXTENSIONES = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'yml', 'yaml', 'sh', 'cmd', 'ps1']);

const AREAS = [
  { nombre: 'backend', match: (r) => r.startsWith('apps/backend/') },
  { nombre: 'frontend', match: (r) => r.startsWith('apps/frontend/') },
  { nombre: 'portal_alumno_cloud', match: (r) => r.startsWith('apps/portal_alumno_cloud/') },
  { nombre: 'ci', match: (r) => r.startsWith('ci/') || r.startsWith('.github/workflows/') },
  { nombre: 'scripts', match: (r) => r.startsWith('scripts/') },
  { nombre: 'ops', match: (r) => r.startsWith('ops/') },
  { nombre: 'docs', match: (r) => r.startsWith('docs/') },
  { nombre: 'raiz', match: (r) => !r.includes('/') }
];

function extensionValida(ruta) {
  const ext = path.extname(ruta).slice(1).toLowerCase();
  return EXTENSIONES.has(ext);
}

function excluirRuta(ruta) {
  return ruta.startsWith('node_modules/') || ruta.includes('/node_modules/');
}

function seccion(nombre, archivos) {
  if (archivos.length === 0) return '';
  const lineas = [`## ${nombre}`, ''];
  for (const archivo of [...archivos].sort((a, b) => a.localeCompare(b, 'es'))) {
    lineas.push(`- ${archivo}`);
  }
  lineas.push('');
  return lineas.join('\n');
}

async function listarVersionados() {
  const { stdout } = await exec('git ls-files', { cwd: rootDir, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const candidatos = stdout
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((r) => !excluirRuta(r))
    .filter((r) => extensionValida(r));

  const existentes = await Promise.all(
    candidatos.map(async (ruta) => {
      try {
        await fs.access(path.join(rootDir, ruta));
        return ruta;
      } catch {
        return null;
      }
    })
  );

  return existentes.filter(Boolean);
}

async function generar() {
  const versionados = await listarVersionados();
  const ahora = new Date();
  const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`;

  const conteos = Object.fromEntries(AREAS.map((a) => [a.nombre, versionados.filter(a.match).length]));

  const contenido = [
    '# Inventario Exhaustivo de Codigo',
    '',
    `Fecha de generacion: ${fecha}`,
    'Fuente: git ls-files filtrado por existencia en workspace (solo archivos versionados presentes, excluye node_modules).',
    '',
    '## Resumen',
    '',
    `- Total de piezas de codigo/config ejecutable inventariadas: ${versionados.length}`,
    '- Extensiones incluidas: ts, tsx, js, jsx, mjs, cjs, json, yml, yaml, sh, cmd, ps1.',
    '',
    '## Conteo por area',
    '',
    '| Area | Archivos |',
    '| --- | ---: |',
    `| backend | ${conteos.backend} |`,
    `| frontend | ${conteos.frontend} |`,
    `| portal_alumno_cloud | ${conteos.portal_alumno_cloud} |`,
    `| ci | ${conteos.ci} |`,
    `| scripts | ${conteos.scripts} |`,
    `| ops | ${conteos.ops} |`,
    `| docs | ${conteos.docs} |`,
    `| raiz | ${conteos.raiz} |`,
    '',
    seccion('Backend (apps/backend)', versionados.filter((r) => r.startsWith('apps/backend/'))),
    seccion('Frontend (apps/frontend)', versionados.filter((r) => r.startsWith('apps/frontend/'))),
    seccion('Portal (apps/portal_alumno_cloud)', versionados.filter((r) => r.startsWith('apps/portal_alumno_cloud/'))),
    seccion('CI/CD (ci + .github/workflows)', versionados.filter((r) => r.startsWith('ci/') || r.startsWith('.github/workflows/'))),
    seccion('Scripts (scripts)', versionados.filter((r) => r.startsWith('scripts/'))),
    seccion('Observabilidad/Ops (ops)', versionados.filter((r) => r.startsWith('ops/'))),
    seccion('Documentacion tecnica/contractual (docs)', versionados.filter((r) => r.startsWith('docs/'))),
    seccion('Raiz del repositorio', versionados.filter((r) => !r.includes('/')))
  ].join('\n');

  await fs.writeFile(salida, contenido, 'utf8');
  console.log(`[inventario-codigo] escrito: ${path.relative(rootDir, salida).replace(/\\/g, '/')}`);
  console.log(`[inventario-codigo] total: ${versionados.length}`);
}

generar().catch((error) => {
  console.error(`[inventario-codigo] error: ${error.message}`);
  process.exit(1);
});
