import assert from 'node:assert/strict';
import test from 'node:test';
import { EvaluaproClient } from '../api/evaluapro-client.mjs';

test('SDK valida y confirma la incorporación de alumnos Classroom al padrón local', async () => {
  const llamadas = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost',
    token: 'token',
    fetchImpl: async (url, init = {}) => {
      llamadas.push({ url: new URL(url), init });
      return new Response(JSON.stringify({ creados: 1, actualizados: 0, totalProcesados: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  const payload = {
    periodoId: 'periodo-1',
    alumnos: [{ classroomUserId: 'google-user-1', matricula: 'MAT-001' }]
  };

  await assert.rejects(client.importarAlumnosClassroom('course-1', payload), /confirmarEscritura/);
  await assert.rejects(client.importarAlumnosClassroom('', payload, { confirmarEscritura: true }), /courseId/);
  await assert.rejects(client.importarAlumnosClassroom('course-1', { periodoId: 'periodo-1', alumnos: [] }, { confirmarEscritura: true }), /entre 1 y 500 alumnos/);
  await assert.rejects(client.importarAlumnosClassroom('course-1', {
    periodoId: 'periodo-1', alumnos: [{ classroomUserId: 'google-user-1', matricula: 'A'.repeat(65) }]
  }, { confirmarEscritura: true }), /identidad Classroom y matrícula válidas/);
  await assert.rejects(client.importarAlumnosClassroom('course-1', {
    periodoId: 'periodo-1', alumnos: [{ classroomUserId: 'google-user-1', fullName: 'Nombre no verificable' }]
  }, { confirmarEscritura: true }), /identidad Classroom y matrícula válidas/);
  await assert.rejects(client.importarAlumnosClassroom('course-1', {
    periodoId: 'periodo-1', alumnos: [
      { classroomUserId: 'google-user-1' },
      { classroomUserId: ' google-user-1 ' }
    ]
  }, { confirmarEscritura: true }), /identidad Classroom no puede repetirse/);
  await assert.rejects(client.importarAlumnosClassroom('course-1', {
    periodoId: 'periodo-1', alumnos: [
      { classroomUserId: 'google-user-1', matricula: 'MAT-001' },
      { classroomUserId: 'google-user-2', matricula: ' mat-001 ' }
    ]
  }, { confirmarEscritura: true }), /matrícula no puede repetirse/);
  assert.equal(llamadas.length, 0, 'validaciones locales y falta de confirmación no deben escribir');

  assert.deepEqual(await client.importarAlumnosClassroom('course/1', payload, { confirmarEscritura: true }), {
    creados: 1, actualizados: 0, totalProcesados: 1
  });
  assert.equal(llamadas[0].url.pathname, '/api/evaluaciones/v2/classroom/cursos/course%2F1/importar-alumnos');
  assert.equal(llamadas[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(llamadas[0].init.body), payload);
});

test('SDK cubre conexión, estado, desconexión confirmada y consulta de mapeos Classroom', async () => {
  const llamadas = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost',
    token: 'token',
    fetchImpl: async (url, init = {}) => {
      const ruta = new URL(url);
      llamadas.push({ ruta, init });
      if (ruta.pathname.endsWith('/oauth/desconectar')) return new Response(null, { status: 204 });
      if (ruta.pathname.endsWith('/oauth/iniciar')) {
        return Response.json({ url: 'https://accounts.google.test/authorize', conectado: false, correoGoogle: null });
      }
      if (ruta.pathname.endsWith('/estado')) return Response.json({ estado: { conectado: true } });
      return Response.json({ conectado: true, correoGoogle: 'docente@example.test', mapeos: [], deprecado: true });
    }
  });

  assert.deepEqual(await client.estadoClassroom(), { conectado: true });
  assert.deepEqual(await client.iniciarOauthClassroom(), {
    url: 'https://accounts.google.test/authorize', conectado: false, correoGoogle: null
  });
  await assert.rejects(client.desconectarOauthClassroom(), /confirmarEscritura/);
  assert.deepEqual(await client.desconectarOauthClassroom({ confirmarEscritura: true }), { desconectado: true });
  assert.deepEqual(await client.mapeosClassroom('periodo/1'), {
    conectado: true, correoGoogle: 'docente@example.test', mapeos: [], deprecado: true
  });
  assert.equal(llamadas.length, 4, 'la falta de confirmación debe impedir la llamada POST');
  assert.equal(llamadas[2].ruta.pathname, '/api/evaluaciones/v2/classroom/oauth/desconectar');
  assert.equal(llamadas[2].init.method, 'POST');
  assert.equal(llamadas[3].ruta.searchParams.get('periodoId'), 'periodo/1');
});

test('request genérico del SDK no omite confirmación en escrituras de calificación o Classroom', async () => {
  const llamadas = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost',
    token: 'token',
    fetchImpl: async (url, init = {}) => {
      llamadas.push({ url: new URL(url), init });
      return Response.json({ ok: true });
    }
  });
  const escrituras = [
    ['/analiticas/lista-academica/calificaciones', 'POST'],
    ['/analiticas/lista-academica/resultados-extra-externos', 'POST'],
    ['/evaluaciones/v2/classroom/oauth/desconectar', 'POST'],
    ['/evaluaciones/v2/classroom/importaciones/ejecutar?fuente=ui', 'POST'],
    ['/evaluaciones/v2/classroom/cursos/course-1/importar-alumnos', 'POST'],
    ['/evaluaciones/v2/classroom/cursos/course-1/mapeo-alumnos', 'PUT']
  ];

  for (const [ruta, method] of escrituras) {
    await assert.rejects(client.request(ruta, { method, body: {} }), /confirmarEscritura: true/);
  }
  assert.equal(llamadas.length, 0, 'la confirmación debe comprobarse antes de hacer fetch');

  await client.request('/analiticas/lista-academica/calificaciones', {
    method: 'POST', body: {}, confirmarEscritura: true
  });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].init.method, 'POST');
});

test('el flujo SDK del bono conserva validación y confirmación al usar el guard central', async () => {
  const llamadas = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost',
    token: 'token',
    fetchImpl: async (url, init = {}) => {
      llamadas.push({ url: new URL(url), init });
      return Response.json({ calificacion: { version: 2 } });
    }
  });
  const payload = {
    periodoId: 'periodo-1', alumnoId: 'alumno-1', componente: 'Bono extracurricular', calificacion: 0.5,
    clientRequestId: '4bbf1681-0300-4cf5-a792-1f8217c654d6'
  };

  await assert.rejects(client.guardarBonoExtracurricular(payload), /confirmarEscritura/);
  assert.equal(llamadas.length, 0);
  assert.deepEqual(await client.guardarBonoExtracurricular(payload, { confirmarEscritura: true }), { calificacion: { version: 2 } });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url.pathname, '/api/analiticas/lista-academica/calificaciones');
});

test('los wrappers SDK de mapeo y ejecución autorizados pasan el guard central', async () => {
  const llamadas = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost',
    token: 'token',
    fetchImpl: async (url, init = {}) => {
      llamadas.push({ url: new URL(url), init });
      return Response.json({ ok: true });
    }
  });
  const payload = {
    periodoId: 'periodo-1',
    actividades: [{ courseId: 'course-1', courseWorkId: 'work-1', corte: 3 }]
  };

  await assert.rejects(client.actualizarMapeoAlumnosClassroom('curso-1', { periodoId: 'periodo-1', asignaciones: [] }), /confirmarEscritura/);
  await assert.rejects(client.ejecutarImportacionClassroom(payload), /confirmarEscritura/);
  await assert.rejects(client.previsualizarImportacionClassroom({ periodoId: 'periodo-1', actividades: [] }), /entre 1 y 100 actividades/);
  const duplicada = {
    periodoId: 'periodo-1',
    actividades: [
      { courseId: 'course-1', courseWorkId: 'work-1', corte: 3 },
      { courseId: ' course-1 ', courseWorkId: ' work-1 ', corte: 2 }
    ]
  };
  await assert.rejects(client.previsualizarImportacionClassroom(duplicada), /misma actividad Classroom no puede repetirse/);
  await assert.rejects(client.ejecutarImportacionClassroom(duplicada, { confirmarEscritura: true }), /misma actividad Classroom no puede repetirse/);
  await assert.rejects(client.ejecutarImportacionClassroom({
    ...payload, actividades: [{ ...payload.actividades[0], corte: 4 }]
  }, { confirmarEscritura: true }), /corte debe ser/);
  await assert.rejects(client.actualizarMapeoAlumnosClassroom('curso-1', {
    periodoId: 'periodo-1', asignaciones: [
      { classroomUserId: 'user-1', alumnoId: 'alumno-1' },
      { classroomUserId: ' user-1 ', alumnoId: null }
    ]
  }, { confirmarEscritura: true }), /identidad Classroom no puede repetirse/);
  await assert.rejects(client.actualizarMapeoAlumnosClassroom('curso-1', {
    periodoId: 'periodo-1', asignaciones: [
      { classroomUserId: 'user-1', alumnoId: 'alumno-1' },
      { classroomUserId: 'user-2', alumnoId: ' alumno-1 ' }
    ]
  }, { confirmarEscritura: true }), /alumno local no puede vincularse más de una vez/);
  await assert.rejects(client.actualizarMapeoAlumnosClassroom('curso-1', {
    periodoId: 'periodo-1', asignaciones: [{ classroomUserId: 'user-1', alumnoId: '' }]
  }, { confirmarEscritura: true }), /alumnoId debe ser/);
  assert.equal(llamadas.length, 0);

  await client.actualizarMapeoAlumnosClassroom('curso-1', { periodoId: 'periodo-1', asignaciones: [] }, { confirmarEscritura: true });
  await client.previsualizarImportacionClassroom(payload);
  await client.ejecutarImportacionClassroom(payload, { confirmarEscritura: true });
  assert.deepEqual(llamadas.map(({ url, init }) => [url.pathname, init.method]), [
    ['/api/evaluaciones/v2/classroom/cursos/curso-1/mapeo-alumnos', 'PUT'],
    ['/api/evaluaciones/v2/classroom/importaciones/preview', 'POST'],
    ['/api/evaluaciones/v2/classroom/importaciones/ejecutar', 'POST']
  ]);
});
