import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const spec = JSON.parse(fs.readFileSync(path.join(root, 'scripts/api/openapi.json'), 'utf8'));
const catalog = fs.readFileSync(path.join(root, 'scripts/api/CRUD_CATALOG.md'), 'utf8');

test('el contrato del lote expone grupo y mantiene estrictos los campos admitidos', () => {
  const operation = spec.paths?.['/examenes/generados/lote']?.post;
  assert.ok(operation);
  assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(operation['x-evaluapro-permissions']?.includes('examenes:generar'));
  assert.ok(operation['x-evaluapro-validators']?.includes('esquemaGenerarExamenesLote'));
  const schema = operation.requestBody?.content?.['application/json']?.schema;
  assert.deepEqual(schema.required, ['plantillaId']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.grupo, { type: 'string', minLength: 1, maxLength: 64 });
});

test('el ZIP y el sondeo de cohorte están documentados en OpenAPI y el catálogo', () => {
  const zip = spec.paths?.['/examenes/generados/lote/{loteId}/zip']?.get;
  assert.ok(zip);
  assert.ok(zip.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(zip['x-evaluapro-permissions']?.includes('examenes:descargar'));
  assert.equal(zip.responses?.['200']?.content?.['application/zip']?.schema?.format, 'binary');
  assert.match(catalog, /`\/examenes\/generados\/lote\/\{loteId\}\/zip` \| GET/);

  const progreso = spec.paths?.['/examenes/generados/lote/{loteId}/progreso']?.get;
  assert.ok(progreso?.parameters?.some(({ name, in: location }) => name === 'totalEsperado' && location === 'query'));
  assert.ok(progreso?.parameters?.some(({ name, in: location }) => name === 'grupo' && location === 'query'));
});
