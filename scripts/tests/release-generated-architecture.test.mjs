import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function section(document, title) {
  const start = document.indexOf(`## ${title}\n`);
  assert.notEqual(start, -1, `Falta la sección ## ${title}`);
  const contentStart = start + `## ${title}\n`.length;
  const nextHeading = document.indexOf('\n## ', contentStart);
  return document.slice(contentStart, nextHeading === -1 ? undefined : nextHeading);
}

test('AUTO_ENV separa variables de runtime y de scripts legados', () => {
  const generated = read('docs/AUTO_ENV.md');
  const backendRuntime = section(generated, 'Backend');
  const backendScripts = section(generated, 'Scripts backend');

  assert.match(backendRuntime, /`DATABASE_URL`/);
  assert.doesNotMatch(backendRuntime, /`MONGODB_URI(?:_HOST)?`/);
  assert.match(backendScripts, /`MONGODB_URI`/);
  assert.match(generated, /no representan configuración del runtime publicado/);
});

test('fuentes y SVG de arquitectura documentan SQLite y no MongoDB', () => {
  const artifacts = [
    'docs/diagramas/src/arquitectura/arquitectura-logica.mmd',
    'docs/diagramas/src/arquitectura/arquitectura-despliegue.mmd',
    'docs/diagramas/rendered/arquitectura/arquitectura-logica.svg',
    'docs/diagramas/rendered/arquitectura/arquitectura-despliegue.svg'
  ];

  for (const relativePath of artifacts) {
    const content = read(relativePath);
    assert.match(content, /SQLite/i, `${relativePath} debe representar SQLite`);
    assert.doesNotMatch(content, /MongoDB|mongoCloud|mongo_cloud/i, `${relativePath} conserva una base Mongo obsoleta`);
  }

  const logical = read(artifacts[0]);
  const deployment = read(artifacts[1]);
  assert.match(logical, /fuente canónica docente/i);
  assert.match(logical, /read-model derivado/i);
  assert.match(deployment, /SQLite local/i);
  assert.match(deployment, /SQLite del portal/i);
});
