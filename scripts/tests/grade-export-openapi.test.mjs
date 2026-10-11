import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aplicarContratoExportacionCalificaciones, contratosExportacionCalificaciones } from '../api/grade-export-openapi.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const openapi = JSON.parse(await readFile(path.join(root, 'scripts/api/openapi.json'), 'utf8'));

test('OpenAPI describe las descargas de calificaciones en CSV y XLSX', () => {
  const csv = openapi.paths?.['/analiticas/calificaciones-csv']?.get;
  const xlsx = openapi.paths?.['/analiticas/calificaciones-xlsx']?.get;
  assert.ok(csv && xlsx);
  for (const operation of [csv, xlsx]) {
    assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
    assert.ok(operation['x-evaluapro-permissions']?.includes('analiticas:leer'));
    assert.ok(operation.parameters?.some((parameter) => parameter.name === 'periodoId' && parameter.in === 'query' && parameter.required));
  }
  assert.deepEqual(csv.responses['200'], contratosExportacionCalificaciones.csv);
  assert.deepEqual(xlsx.responses['200'], contratosExportacionCalificaciones.xlsx);
  assert.equal(xlsx.responses['200'].content['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].schema.format, 'binary');
});

test('el generador corrige solo las respuestas de exportación CSV y XLSX', () => {
  const copia = structuredClone(openapi);
  const classroomAntes = structuredClone(copia.paths['/evaluaciones/v2/classroom/importaciones/preview']);
  aplicarContratoExportacionCalificaciones(copia);
  assert.deepEqual(copia.paths['/analiticas/calificaciones-csv'].get.responses['200'], contratosExportacionCalificaciones.csv);
  assert.deepEqual(copia.paths['/analiticas/calificaciones-xlsx'].get.responses['200'], contratosExportacionCalificaciones.xlsx);
  assert.deepEqual(copia.paths['/evaluaciones/v2/classroom/importaciones/preview'], classroomAntes);
});

test('reaplicar contratos de exportación no duplica periodoId', () => {
  const copia = structuredClone(openapi);
  aplicarContratoExportacionCalificaciones(copia);
  aplicarContratoExportacionCalificaciones(copia);
  for (const ruta of ['/analiticas/calificaciones-csv', '/analiticas/calificaciones-xlsx']) {
    const parametros = copia.paths[ruta].get.parameters.filter(({ name, in: ubicacion }) => name === 'periodoId' && ubicacion === 'query');
    assert.equal(parametros.length, 1);
  }
});
