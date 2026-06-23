/**
 * generar-readmes-carpetas
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TARGETS = [
  'apps/backend/src',
  'apps/frontend/src',
  'apps/portal_alumno_cloud/src',
  'scripts',
  'ci',
  'ops',
  'docs/diagramas/src'
];

const OMIT_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  'logs'
]);

function toRel(p) {
  return path.relative(rootDir, p).replace(/\\/g, '/');
}

function tituloCarpeta(relDir) {
  const base = path.basename(relDir);
  return base.replace(/[-_]/g, ' ');
}

function descripcionContexto(relDir) {
  if (relDir.startsWith('apps/backend/src/modulos/')) {
    return 'Módulo de dominio del backend docente (rutas, controlador, servicios, modelos y validaciones).';
  }
  if (relDir.startsWith('apps/backend/src/compartido/')) {
    return 'Utilidades y contratos compartidos del backend docente.';
  }
  if (relDir.startsWith('apps/backend/src/infraestructura/')) {
    return 'Adaptadores de infraestructura del backend (IO, base de datos, logging, seguridad).';
  }
  if (relDir.startsWith('apps/frontend/src/apps/app_docente/features/')) {
    return 'Submódulo de feature del frontend docente.';
  }
  if (relDir.startsWith('apps/frontend/src/apps/app_docente/')) {
    return 'Módulo del flujo docente en frontend.';
  }
  if (relDir.startsWith('apps/frontend/src/ui/')) {
    return 'Componentes y utilidades de UI reutilizables del frontend.';
  }
  if (relDir.startsWith('apps/frontend/src/servicios_api/')) {
    return 'Clientes HTTP y normalización de comunicación API del frontend.';
  }
  if (relDir.startsWith('apps/portal_alumno_cloud/src/')) {
    return 'Módulo interno del portal alumno cloud (read-model, sesión y observabilidad).';
  }
  if (relDir.startsWith('docs/diagramas/src/')) {
    return 'Fuentes Mermaid versionadas para arquitectura, flujos y secuencias.';
  }
  if (relDir.startsWith('ops/')) {
    return 'Artefactos de operación y observabilidad.';
  }
  if (relDir.startsWith('scripts/')) {
    return 'Scripts operativos y de automatización del monorepo.';
  }
  if (relDir.startsWith('ci/')) {
    return 'Contrato y matriz de pipeline CI/CD.';
  }
  return 'Carpeta interna del proyecto.';
}

function reglas(relDir) {
  const reglasBase = [
    'Mantener cambios pequeños y trazables con pruebas/validación asociada.',
    'Actualizar documentación relacionada cuando cambie el comportamiento observable.'
  ];
  if (relDir.startsWith('apps/backend/src/modulos/')) {
    reglasBase.push('Respetar multi-tenancy por docente y contratos de error/validación.');
  }
  if (relDir.startsWith('apps/frontend/src/apps/app_docente/')) {
    reglasBase.push('Evitar lógica de negocio profunda en componentes de presentación; preferir hooks/services.');
  }
  if (relDir.startsWith('docs/diagramas/src/')) {
    reglasBase.push('Regenerar y verificar diagramas tras cambios: `npm run diagramas:generate` y `npm run diagramas:render`.');
  }
  return reglasBase;
}

async function listarArchivos(directorioAbsoluto) {
  const items = await fs.readdir(directorioAbsoluto, { withFileTypes: true });
  return items
    .filter((it) => it.isFile())
    .map((it) => it.name)
    .filter((name) => !name.toLowerCase().startsWith('readme'))
    .sort((a, b) => a.localeCompare(b, 'es'));
}

async function walkDirs(baseAbs) {
  const out = [];
  const stack = [baseAbs];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (OMIT_DIRS.has(e.name)) continue;
      const full = path.join(current, e.name);
      out.push(full);
      stack.push(full);
    }
  }
  return out;
}

async function crearReadmeSiFalta(dirAbs) {
  const relDir = toRel(dirAbs);
  const readmePath = path.join(dirAbs, 'README.md');
  try {
    await fs.access(readmePath);
    return false;
  } catch {
    // sin README local
  }

  const archivos = await listarArchivos(dirAbs);
  if (archivos.length === 0) return false;

  const contenido = [
    `# ${tituloCarpeta(relDir)}`,
    '',
    descripcionContexto(relDir),
    '',
    `Ruta: \`${relDir}\`.`,
    '',
    '## Archivos clave',
    ...(archivos.length > 0 ? archivos.map((f) => `- \`${f}\``) : ['- (sin archivos de código directos)']),
    '',
    '## Reglas de mantenimiento',
    ...reglas(relDir).map((r) => `- ${r}`),
    '',
    '## Nota',
    '- Este README fue generado automáticamente como base; ampliar con decisiones de diseño específicas del módulo cuando aplique.',
    ''
  ].join('\n');

  await fs.writeFile(readmePath, contenido, 'utf8');
  return true;
}

async function main() {
  let creados = 0;
  for (const targetRel of TARGETS) {
    const targetAbs = path.join(rootDir, targetRel);
    try {
      await fs.access(targetAbs);
    } catch {
      continue;
    }
    const dirs = await walkDirs(targetAbs);
    for (const d of dirs) {
      if (await crearReadmeSiFalta(d)) creados += 1;
    }
  }

  console.log(`[generar-readmes-carpetas] readmes creados: ${creados}`);
}

main().catch((error) => {
  console.error(`[generar-readmes-carpetas] error: ${error.message}`);
  process.exit(1);
});
