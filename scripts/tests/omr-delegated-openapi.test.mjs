import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const openapi = JSON.parse(await readFile(path.join(root, 'scripts/api/openapi.json'), 'utf8'));
test('OpenAPI conserva todos los permisos requeridos por preview y escritura OMR', () => {
  for (const [route, validator, scopesRequeridos] of [
    ['/omr/ingestas/{jobId}/calificacion-preview', 'esquemaPrevisualizarCalificacionIngestaOmr', ['omr:analizar', 'calificaciones:calificar']],
    ['/omr/ingestas/{jobId}/calificar', 'esquemaCalificarIngestaPdfOmr', ['omr:analizar', 'banco:leer', 'calificaciones:calificar']]
  ]) {
    const operation = openapi.paths?.[route]?.post;
    assert.ok(operation, `debe existir ${route}`);
    assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
    assert.deepEqual(operation['x-evaluapro-permissions'], scopesRequeridos);
    assert.ok(operation['x-evaluapro-validators']?.includes(validator));
  }
});
