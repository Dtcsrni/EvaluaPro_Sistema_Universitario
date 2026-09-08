/**
 * Contrato de rendimiento del frontend.
 * Verifica que cada destino y los módulos docentes pesados se carguen bajo demanda.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('los destinos principales se cargan bajo demanda', async () => {
  const source = await readFile(resolve(root, 'apps/frontend/src/App.tsx'), 'utf8');

  assert.match(source, /const AppAlumno = lazy\(\(\) => import\(/);
  assert.match(source, /const AppAdminNegocio = lazy\(\(\) => import\(/);
  assert.match(source, /const AppDocente = lazy\(\(\) => import\(/);
  assert.doesNotMatch(source, /import\s+\{\s*App(?:Alumno|AdminNegocio|Docente)\s*\}\s+from/);
});

test('los módulos docentes de mayor coste se cargan bajo demanda', async () => {
  const source = await readFile(resolve(root, 'apps/frontend/src/apps/app_docente/AppDocente.tsx'), 'utf8');
  const modulosPesados = [
    'SeccionBanco',
    'SeccionPlantillas',
    'SeccionCalificaciones',
    'SeccionClassroom',
    'SeccionAsistencias',
    'SeccionSincronizacion'
  ];

  for (const modulo of modulosPesados) {
    assert.match(source, new RegExp(`const ${modulo} = lazy\\(\\(\\) => import\\(`));
  }
});

test('los comandos frontend evitan el temporal de configuración de Vite en Windows', async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, 'apps/frontend/package.json'), 'utf8'));
  const scripts = packageJson.scripts ?? {};
  const scriptsQueCarganVite = [
    'dev',
    'dev:alumno',
    'dev:docente',
    'build',
    'preview',
    'preview:alumno',
    'preview:docente',
    'test',
    'test:coverage'
  ];

  for (const scriptName of scriptsQueCarganVite) {
    assert.match(String(scripts[scriptName]), /--configLoader(?:=|\s+|['\"],['\"]?)runner/);
  }
});

test('el build frontend no intenta borrar una salida servida en Windows', async () => {
  const source = await readFile(resolve(root, 'apps/frontend/vite.config.ts'), 'utf8');
  assert.match(source, /emptyOutDir:\s*process\.platform\s*!==\s*['"]win32['"]/);
  assert.match(source, /copyPublicDir:\s*process\.platform\s*!==\s*['"]win32['"]/);
  assert.match(source, /pluginPublicoWindowsSeguro/);
});

test('el typecheck frontend no depende de tsbuildinfo bloqueable', async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, 'apps/frontend/package.json'), 'utf8'));
  assert.match(String(packageJson.scripts?.build), /--composite false\s+--incremental false/);
  assert.match(String(packageJson.scripts?.typecheck), /--composite false\s+--incremental false/);
});

test('el build usa staging cuando Windows mantiene la salida viva', async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, 'apps/frontend/package.json'), 'utf8'));
  const source = await readFile(resolve(root, 'scripts/vite-build-safe.mjs'), 'utf8');

  assert.match(String(packageJson.scripts?.build), /vite-build-safe\.mjs/);
  assert.match(source, /puertoActivo/);
  assert.match(source, /evaluapro-builds/);
  assert.match(source, /EPERM\/EACCES/);
  assert.match(source, /promoverStaging/);
  assert.match(source, /fs\.cpSync\(staging, destino/);
  assert.match(source, /fs\.rmSync\(staging, \{ recursive: true, force: true \}\)/);
});
