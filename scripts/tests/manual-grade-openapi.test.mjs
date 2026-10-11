import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  aplicarContratoCalificacionLista,
  aplicarContratoConsultaLista,
  aplicarContratoPreviewBono,
  contratoCalificacionListaRequestBody,
  contratoCalificacionListaResponse,
  contratoConsultaListaResponse,
  contratoPreviewBonoRequestBody,
  contratoPreviewBonoResponse
} from '../api/manual-grade-openapi.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const openapi = JSON.parse(await readFile(path.join(root, 'scripts/api/openapi.json'), 'utf8'));

test('OpenAPI documenta los campos y límites de cada calificación manual', () => {
  const operation = openapi.paths?.['/analiticas/lista-academica/calificaciones']?.post;
  assert.ok(operation, 'debe existir el endpoint autenticado de captura manual');
  assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(operation['x-evaluapro-permissions']?.includes('calificaciones:calificar'));
  assert.ok(operation['x-evaluapro-validators']?.includes('esquemaGuardarCalificacionLista'));
  assert.equal(operation.summary, 'Registrar calificación manual en la lista académica');
  for (const status of ['200', '201', '400', '401', '403', '404', '409', 'default']) assert.ok(operation.responses[status]);
  assert.deepEqual(operation.requestBody, contratoCalificacionListaRequestBody);
  assert.deepEqual(operation.responses['200'].content['application/json'], contratoCalificacionListaResponse);
  assert.deepEqual(operation.responses['201'].content['application/json'], contratoCalificacionListaResponse);
  const registro = contratoCalificacionListaResponse.schema.properties.calificacion;
  assert.ok(registro.required.includes('version'));
  assert.equal(registro.properties.clientRequestId, undefined, 'clientRequestId identifica la mutación, no es campo del registro persistido');
  assert.equal(contratoCalificacionListaResponse.schema.properties.repetida.const, true);

  const variantes = operation.requestBody.content['application/json'].schema.oneOf;
  assert.deepEqual(variantes.map(({ properties }) => [properties.componente.const, properties.calificacion.maximum ?? properties.calificacion.enum]), [
    ['Practica 2do Parcial', 10],
    ['Exámen 2do Parcial', 5.25],
    ['Exámen Global', 5],
    ['Bono extracurricular', 1],
    ['Solicitud Extra', [0, 1]]
  ]);
  for (const schema of variantes) {
    assert.deepEqual(schema.required, ['periodoId', 'alumnoId', 'componente', 'calificacion', 'clientRequestId']);
    assert.equal(schema.additionalProperties, false);
  }
});

test('el generador puede sincronizar únicamente el cuerpo del endpoint manual', () => {
  const copia = structuredClone(openapi);
  aplicarContratoCalificacionLista(copia);
  assert.deepEqual(copia.paths['/analiticas/lista-academica/calificaciones'].post.requestBody, contratoCalificacionListaRequestBody);
});

test('OpenAPI devuelve desde la lista las calificaciones y versiones usadas por GUI', () => {
  const operation = openapi.paths?.['/analiticas/lista-academica']?.get;
  assert.ok(operation);
  assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(operation['x-evaluapro-permissions']?.includes('analiticas:leer'));
  assert.ok(operation.parameters?.some((parameter) => parameter.name === 'periodoId' && parameter.in === 'query' && parameter.required === true));
  assert.deepEqual(operation.responses['200'], contratoConsultaListaResponse);
  const fila = operation.responses['200'].content['application/json'].schema.properties.filas.items;
  for (const name of ['examenGlobalLista', 'continuaTercerParcialLista', 'calificacionTercerParcial', 'bonoExtracurricular', 'calificacionFinalCurso']) {
    assert.equal(fila.properties[name].type, 'string');
  }
  assert.deepEqual(fila.properties.bonoDistribucion.required, ['examenGlobal', 'continuaGlobal', 'examenParcial2', 'continuaParcial2', 'examenParcial1', 'continuaParcial1']);
  assert.equal(fila.properties.examenGlobalListaVersion.anyOf[1].type, 'null');
});

test('el generador puede sincronizar la respuesta de lectura académica', () => {
  const copia = structuredClone(openapi);
  aplicarContratoConsultaLista(copia);
  aplicarContratoConsultaLista(copia);
  const operation = copia.paths['/analiticas/lista-academica'].get;
  assert.deepEqual(operation.responses['200'], contratoConsultaListaResponse);
  assert.ok(operation.parameters.some((parameter) => parameter.name === 'periodoId' && parameter.required === true));
  assert.equal(operation.parameters.filter(({ name, in: ubicacion }) => name === 'periodoId' && ubicacion === 'query').length, 1);
});

test('OpenAPI tipa el preview no mutante y su distribución por los seis componentes', () => {
  const operation = openapi.paths?.['/analiticas/lista-academica/bono/preview']?.post;
  assert.ok(operation, 'debe existir el endpoint de preview del bono');
  assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(operation['x-evaluapro-permissions']?.includes('calificaciones:calificar'));
  assert.ok(operation['x-evaluapro-validators']?.includes('esquemaPreviewBonoExtracurricular'));
  assert.deepEqual(operation.requestBody, contratoPreviewBonoRequestBody);
  assert.deepEqual(operation.responses['200'], contratoPreviewBonoResponse);
  assert.equal(operation.responses['200'].content['application/json'].schema.properties.preview.properties.requiereConfirmacion.const, true);
  assert.equal(operation.responses['200'].content['application/json'].schema.properties.preview.properties.bonoDistribucion.required.length, 6);
});

test('el generador puede sincronizar el contrato del preview sin sustituir otras respuestas', () => {
  const copia = structuredClone(openapi);
  aplicarContratoPreviewBono(copia);
  const operation = copia.paths['/analiticas/lista-academica/bono/preview'].post;
  assert.deepEqual(operation.requestBody, contratoPreviewBonoRequestBody);
  assert.deepEqual(operation.responses['200'], contratoPreviewBonoResponse);
  assert.ok(operation.responses['403']);
});
