import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routePath = path.join(root, 'apps/backend/src/modulos/modulo_sincronizacion_nube/rutasSincronizacionNube.ts');
const middlewarePath = path.join(root, 'apps/backend/src/modulos/modulo_sincronizacion_nube/middlewareInstantaneaLocal.ts');

test('routes-check admite el validador estricto del cuerpo binario de instantánea local', () => {
  const rutas = fs.readFileSync(routePath, 'utf8');
  const middleware = fs.readFileSync(middlewarePath, 'utf8');

  assert.match(rutas, /router\.post\('\/local\/importar',[\s\S]*?recibirInstantaneaLocal,[\s\S]*?importarInstantaneaLocal\)/);
  assert.match(middleware, /req\.is\('application\/vnd\.evaluapro\.snapshot'\)/);
  assert.match(middleware, /longitudCabecera < 2 \|\| longitudCabecera > 4096/);
  assert.match(middleware, /metodo !== 'contrasena' && metodo !== 'google'/);
  assert.match(middleware, /typeof cabecera\.dryRun !== 'boolean'/);
  assert.match(middleware, /credencial\.length > 8192/);
  assert.match(middleware, /total > MAX_CONTENIDO_LOCAL_STREAM_BYTES \+ 2 \* 1024 \* 1024/);
  assert.match(middleware, /total === 0/);

  const resultado = execFileSync(process.execPath, ['scripts/routes-check.mjs'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.match(resultado, /\[routes-check\] ok/);
});
