import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  aplicarContratosClassroomGrades,
  contratoImportacionClassroomRequestBody,
  contratoImportarAlumnosClassroomRequestBody,
  contratoMapeoAlumnosClassroomRequestBody,
  esquemaResultadoSyncClassroom,
  respuestaSyncClassroom,
  respuestaHistorialSyncClassroom,
  respuestaInicioOauthClassroom,
  respuestaMapeosClassroom,
  respuestaEvidenciasEvaluacion,
  respuestasCatalogoClassroom
} from '../api/classroom-grading-openapi.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const openapi = JSON.parse(await readFile(path.join(root, 'scripts/api/openapi.json'), 'utf8'));

test('preview y confirmación de Classroom documentan la selección por parcial', () => {
  for (const [route, validator] of [
    ['/evaluaciones/v2/classroom/importaciones/preview', 'esquemaPreviewImportacionClassroom'],
    ['/evaluaciones/v2/classroom/importaciones/ejecutar', 'esquemaEjecutarImportacionClassroom']
  ]) {
    const operation = openapi.paths?.[route]?.post;
    assert.ok(operation);
    assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
    assert.ok(operation['x-evaluapro-permissions']?.includes('classroom:pull'));
    assert.ok(operation['x-evaluapro-validators']?.includes(validator));
    assert.deepEqual(operation.requestBody, contratoImportacionClassroomRequestBody);
    assert.match(operation.description, /pares curso\/actividad repetidos/);
    assert.deepEqual(operation.responses['200'], respuestaSyncClassroom);
  }

  const result = openapi.components.schemas.ClassroomGradeSyncResult;
  assert.deepEqual(result, esquemaResultadoSyncClassroom);
  assert.ok(result.required.includes('promediosEvaluacionContinuaTercerParcial'));
  assert.ok(result.required.includes('acumuladoTareasSegundoParcial'));
  assert.ok(result.properties.actividades.items.properties.submissions.items.properties.matchStrategy.enum.includes('manual'));
  const activity = contratoImportacionClassroomRequestBody.content['application/json'].schema.properties.actividades.items;
  assert.equal(activity.properties.corte.minimum, 1);
  assert.equal(activity.properties.corte.maximum, 3);
  assert.equal(activity.properties.incluirEnPromedio.type, 'boolean');
  assert.equal(activity.properties.courseWorkId.maxLength, 128);
  assert.equal(activity.additionalProperties, false);
});

test('importación y vínculo de alumnos Classroom publican sus cuerpos estrictos', () => {
  const importar = openapi.paths?.['/evaluaciones/v2/classroom/cursos/{courseId}/importar-alumnos']?.post;
  assert.ok(importar);
  assert.ok(importar.parameters?.some((parameter) => parameter.name === 'courseId' && parameter.in === 'path' && parameter.required));
  assert.ok(importar['x-evaluapro-validators']?.includes('esquemaImportarAlumnosClassroom'));
  assert.ok(importar['x-evaluapro-permissions']?.includes('alumnos:gestionar'));
  assert.match(importar.description, /conserva los vínculos.*selección/i);
  assert.match(importar.description, /Deriva nombre y correo desde Classroom/);
  assert.match(importar.description, /rechaza identidades ajenas al curso/);
  assert.deepEqual(importar.requestBody, contratoImportarAlumnosClassroomRequestBody);
  assert.match(importar.description, /identidades ajenas al curso o repetidas antes de escribir/);

  const mapear = openapi.paths?.['/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos']?.put;
  assert.ok(mapear);
  assert.ok(mapear.parameters?.some((parameter) => parameter.name === 'courseId' && parameter.in === 'path' && parameter.required));
  assert.ok(mapear['x-evaluapro-validators']?.includes('esquemaActualizarMapeoAlumnosCurso'));
  assert.deepEqual(mapear.requestBody, contratoMapeoAlumnosClassroomRequestBody);
  assert.match(mapear.description, /reemplaza el conjunto de vínculos/i);
  assert.match(mapear.description, /identidades omitidas quedan sin vincular/i);
  assert.deepEqual(mapear.responses['409'], { $ref: '#/components/responses/Error' });
  assert.equal(mapear.requestBody.content['application/json'].schema.properties.asignaciones.items.properties.alumnoId.anyOf[1].type, 'null');
});

test('el historial Classroom declara materia requerida y hasta 20 registros', () => {
  const operation = openapi.paths?.['/evaluaciones/v2/classroom/importaciones/historial']?.get;
  assert.ok(operation);
  assert.ok(operation.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(operation['x-evaluapro-permissions']?.includes('classroom:pull'));
  assert.ok(operation.parameters?.some((parameter) => parameter.name === 'periodoId' && parameter.in === 'query' && parameter.required));
  assert.deepEqual(operation.responses['200'], respuestaHistorialSyncClassroom);
  assert.equal(respuestaHistorialSyncClassroom.content['application/json'].schema.properties.historial.maxItems, 20);
  const historialItem = respuestaHistorialSyncClassroom.content['application/json'].schema.properties.historial.items;
  assert.equal(historialItem.properties.resumen.additionalProperties, false);
  assert.ok(historialItem.properties.resumen.properties.submissionsProcesadas);
  assert.equal(historialItem.properties.errores.items.additionalProperties, false);
});

test('la conexión Classroom documenta la respuesta OAuth y la desconexión HTTP 204', () => {
  const inicio = openapi.paths?.['/evaluaciones/v2/classroom/oauth/iniciar']?.get;
  assert.ok(inicio?.tags?.includes('Classroom'));
  assert.ok(inicio?.['x-evaluapro-permissions']?.includes('classroom:conectar'));
  assert.deepEqual(inicio.responses['200'], respuestaInicioOauthClassroom);
  assert.deepEqual(inicio.responses['200'].content['application/json'].schema.required, ['url', 'conectado', 'correoGoogle']);

  const desconectar = openapi.paths?.['/evaluaciones/v2/classroom/oauth/desconectar']?.post;
  assert.ok(desconectar?.['x-evaluapro-permissions']?.includes('classroom:conectar'));
  assert.equal(desconectar.responses['200'], undefined);
  assert.deepEqual(desconectar.responses['204'], { description: 'Integración desconectada correctamente; no contiene cuerpo.' });

  const mapeos = openapi.paths?.['/evaluaciones/v2/classroom/mapeos']?.get;
  assert.ok(mapeos?.parameters?.some((parameter) => parameter.name === 'periodoId' && parameter.in === 'query'));
  assert.deepEqual(mapeos.responses['200'], respuestaMapeosClassroom);
});

test('la consulta de evidencias documenta filtros de paginación y los campos usados por Calificaciones', () => {
  const operation = openapi.paths?.['/evaluaciones/evidencias']?.get;
  assert.ok(operation);
  assert.ok(operation['x-evaluapro-permissions']?.includes('evaluaciones:leer'));
  for (const name of ['periodoId', 'alumnoId', 'incluirArchivadas', 'limite', 'cursor']) {
    assert.ok(operation.parameters?.some((parameter) => parameter.name === name && parameter.in === 'query' && parameter.required === false));
  }
  assert.deepEqual(operation.responses['200'], respuestaEvidenciasEvaluacion);
  const evidencia = respuestaEvidenciasEvaluacion.content['application/json'].schema.properties.evidencias.items;
  for (const campo of ['id', 'periodoId', 'alumnoId', 'titulo', 'calificacionDecimal', 'estadoCaptura', 'classroom', 'metadata']) {
    assert.ok(evidencia.properties[campo], `faltó ${campo} en el contrato de evidencia`);
  }
  assert.equal(evidencia.additionalProperties, false);
});

test('lecturas Classroom tipan curso, actividad y roster como los consume Calificaciones', () => {
  const casos = [
    ['/evaluaciones/v2/classroom/estado', 'get', respuestasCatalogoClassroom.estado],
    ['/evaluaciones/v2/classroom/cursos', 'get', respuestasCatalogoClassroom.cursos],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/actividades', 'get', respuestasCatalogoClassroom.actividades],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/alumnos', 'get', respuestasCatalogoClassroom.roster],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos', 'put', respuestasCatalogoClassroom.roster],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/importar-alumnos', 'post', respuestasCatalogoClassroom.importarAlumnos]
  ];
  for (const [ruta, metodo, respuesta] of casos) {
    const operacion = openapi.paths?.[ruta]?.[metodo];
    assert.ok(operacion, `${metodo.toUpperCase()} ${ruta} debe existir`);
    assert.deepEqual(operacion.responses['200'], respuesta);
  }
  const roster = openapi.paths['/evaluaciones/v2/classroom/cursos/{courseId}/alumnos'].get;
  assert.ok(roster.parameters.some((parameter) => parameter.name === 'periodoId' && parameter.required));
  const actividades = openapi.paths['/evaluaciones/v2/classroom/cursos/{courseId}/actividades'].get;
  assert.ok(actividades.parameters.some((parameter) => parameter.name === 'periodoId' && !parameter.required));
});

test('documenta el historial por alumno/corte y la captura WebP privada', () => {
  const historial = openapi.paths?.['/evaluaciones/v2/classroom/alumnos/{alumnoId}/cortes/{corte}/historial']?.get;
  assert.ok(historial);
  assert.ok(historial.security?.some(({ bearerAuth }) => bearerAuth));
  assert.ok(historial.parameters?.some((parameter) => parameter.name === 'periodoId' && parameter.in === 'query' && parameter.required));
  assert.ok(historial.parameters?.some((parameter) => parameter.name === 'limite' && parameter.schema.maximum === 100));
  assert.deepEqual(historial.parameters?.find((parameter) => parameter.name === 'corte')?.schema.enum, [1, 2, 3]);

  const captura = openapi.paths?.['/evaluaciones/v2/classroom/historial-cortes/{snapshotId}/captura']?.get;
  assert.ok(captura);
  assert.equal(captura.responses['200'].content['image/webp'].schema.format, 'binary');
  assert.equal(captura.responses['200'].headers['Cache-Control'].schema.const, 'private, no-store');
});

test('documenta el historial paginado por entrega sin copiar datos de la entrega', () => {
  const historial = openapi.paths?.['/evaluaciones/v2/classroom/alumnos/{alumnoId}/entregas/{submissionId}/historial']?.get;
  assert.ok(historial);
  assert.ok(historial.security?.some(({ bearerAuth }) => bearerAuth));
  for (const nombre of ['alumnoId', 'submissionId', 'periodoId', 'courseId', 'courseWorkId']) {
    assert.ok(historial.parameters?.some((parameter) => parameter.name === nombre && parameter.required));
  }
  assert.equal(historial.parameters?.find((parameter) => parameter.name === 'limite')?.schema.maximum, 100);
  const evento = historial.responses['200'].content['application/json'].schema.properties.eventos.items;
  assert.equal(evento.additionalProperties, false);
  assert.ok(evento.properties.estado.enum.includes('revision_pendiente'));
  assert.equal(evento.properties.emailAddress, undefined);
  assert.equal(evento.properties.adjunto, undefined);
});

test('el generador vuelve a aplicar los contratos Classroom sin alterar otras rutas', () => {
  const copia = structuredClone(openapi);
  aplicarContratosClassroomGrades(copia);
  for (const route of [
    '/evaluaciones/v2/classroom/importaciones/preview',
    '/evaluaciones/v2/classroom/importaciones/ejecutar'
  ]) assert.deepEqual(copia.paths[route].post.requestBody, contratoImportacionClassroomRequestBody);
});
