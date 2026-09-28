import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { EvaluaproClient, EvaluaproApiError } from '../api/evaluapro-client.mjs';

test('cliente agrega /api, usa bearer y no reintenta una escritura incierta', async () => {
  const calls = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://127.0.0.1:4519/', token: 'test-token', equipoId: 'equipo-1',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      throw new Error('connection reset');
    }
  });
  await assert.rejects(client.request('/omr/jobs', { method: 'POST', body: { sourceType: 'pdf' } }), (error) => {
    assert.equal(error.name, 'EvaluaproNetworkError');
    assert.equal(error.mutationOutcomeUnknown, true);
    return true;
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:4519/api/omr/jobs');
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(calls[0].options.headers.get('X-EvaluaPro-Equipo'), 'equipo-1');
});

test('GET no marca resultado de mutación incierto y conserva requestId en errores HTTP', async () => {
  const client = new EvaluaproClient({ baseUrl: 'https://localhost' , fetchImpl: async () => new Response(JSON.stringify({
    error: { codigo: 'OMR_JOB_NO_ENCONTRADO', mensaje: 'No encontrado', requestId: 'req-1' }
  }), { status: 404, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(client.request('/omr/jobs/nope'), (error) => {
    assert.ok(error instanceof EvaluaproApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, 'OMR_JOB_NO_ENCONTRADO');
    assert.equal(error.requestId, 'req-1');
    return true;
  });
});

test('preview de reactivos exige planHash y no confirma automáticamente', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ importId: 'i-1', planHash: 'h-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const flow = await client.importarReactivos({ batchId: 'b-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.endsWith('/api/banco-preguntas/importaciones/preview'), true);
  await flow.confirmar();
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /i-1\/confirmar$/);
  assert.deepEqual(JSON.parse(calls[1].init.body), { planHash: 'h-1', payload: { batchId: 'b-1' } });
});

test('alta y nueva versión de reactivo pasan por preview/confirm y requieren concurrencia explícita', async () => {
  const calls = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      const data = calls.length % 2 === 1 ? { importId: `import-${calls.length}`, planHash: 'hash' } : { reactivos: [{ id: 'reactivo-1' }] };
      return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  const item = { externalKey: 'BIO-1', itemId: null, expectedVersion: null };
  const payload = { contract: 'evaluapro.reactivos.batch', schemaVersion: 1, batchId: 'batch-1', target: { periodoId: 'periodo-1', temaIds: ['tema-1'] }, source: { kind: 'manual' }, items: [item] };
  const alta = await client.crearReactivo(payload);
  assert.equal(calls.length, 1);
  await alta.confirmar();
  assert.equal(calls.length, 2);

  const version = await client.versionarReactivo({ ...payload, batchId: 'batch-2', items: [{ ...item, itemId: 'reactivo-1', expectedVersion: 2 }] });
  assert.equal(calls.length, 3);
  await version.confirmar();
  assert.equal(calls.length, 4);
  await assert.rejects(client.versionarReactivo({ ...payload, items: [item] }), /expectedVersion/);
});

test('cliente permite listar reactivos con filtros y obtener el detalle canónico', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url) => {
    calls.push(new URL(url));
    return new Response(JSON.stringify({ reactivos: [], reactivo: { id: 'reactivo-1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });

  const listado = await client.listarReactivos({ periodoId: 'periodo-1', temaId: 'tema-1', estado: 'review', limite: 20, cursor: 'cXk' });
  assert.deepEqual(listado.reactivos, []);
  assert.equal(calls[0].pathname, '/api/banco-preguntas/reactivos');
  assert.equal(calls[0].searchParams.get('periodoId'), 'periodo-1');
  assert.equal(calls[0].searchParams.get('temaId'), 'tema-1');
  assert.equal(calls[0].searchParams.get('estado'), 'review');
  assert.equal(calls[0].searchParams.get('limite'), '20');
  assert.equal(calls[0].searchParams.get('cursor'), 'cXk');

  assert.deepEqual(await client.obtenerReactivo('reactivo-1'), { id: 'reactivo-1' });
  assert.equal(calls[1].pathname, '/api/banco-preguntas/reactivos/reactivo-1');
});

test('cliente recupera historial de importaciones de reactivos y protege revisión/publicación', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ importaciones: [{ importId: 'import-1' }], rows: [], estado: 'preview' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.listarImportacionesReactivos({ limite: 10 });
  await client.obtenerImportacionReactivos('import/1');
  await assert.rejects(client.revisarReactivo('reactivo-1'), /confirmarEscritura/);
  await assert.rejects(client.publicarReactivo('reactivo-1'), /confirmarEscritura/);
  await assert.rejects(client.retirarReactivo('reactivo-1'), /confirmarEscritura/);
  assert.equal(calls.length, 2, 'acciones sin confirmar no deben llamar al servidor');
  await client.revisarReactivo('reactivo-1', { confirmarEscritura: true });
  await client.publicarReactivo('reactivo-1', { confirmarEscritura: true });
  await client.retirarReactivo('reactivo-1', { confirmarEscritura: true });

  assert.equal(calls[0].url.pathname, '/api/banco-preguntas/importaciones');
  assert.equal(calls[0].url.searchParams.get('limite'), '10');
  assert.equal(calls[1].url.pathname, '/api/banco-preguntas/importaciones/import%2F1');
  assert.deepEqual(calls.slice(2).map(({ url }) => url.pathname), [
    '/api/banco-preguntas/reactivos/reactivo-1/revisar',
    '/api/banco-preguntas/reactivos/reactivo-1/publicar',
    '/api/banco-preguntas/reactivos/reactivo-1/retirar'
  ]);
});

test('cliente recorre todas las páginas del historial de importaciones sin repetir cursores', async () => {
  const calls = [];
  let page = 0;
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url) => {
    calls.push(new URL(url));
    page += 1;
    const body = page === 1
      ? { importaciones: [{ importId: 'import-1' }], nextCursor: '00000000-0000-4000-8000-000000000001' }
      : { importaciones: [{ importId: 'import-2' }], nextCursor: null };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  } });

  const importaciones = await client.listarTodasImportacionesReactivos({ limite: 1 });
  assert.deepEqual(importaciones.map((item) => item.importId), ['import-1', 'import-2']);
  assert.equal(calls[0].searchParams.get('limite'), '1');
  assert.equal(calls[0].searchParams.has('cursor'), false);
  assert.equal(calls[1].searchParams.get('cursor'), '00000000-0000-4000-8000-000000000001');
});

test('cliente obtiene alumno por ID canónico', async () => {
  let visited;
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url) => {
      visited = new URL(url);
      return new Response(JSON.stringify({ alumno: { id: 'alumno-1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  assert.deepEqual(await client.obtenerAlumno('alumno-1'), { id: 'alumno-1' });
  assert.equal(visited.pathname, '/api/alumnos/alumno-1');
});

test('cliente cubre ciclo de periodos y alumnos y exige confirmar bajas de desarrollo', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({
      periodos: [{ id: 'period-1' }], periodo: { id: 'period-1' },
      alumnos: [{ id: 'student-1' }], alumno: { id: 'student-1' }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });

  await client.listarPeriodos({ activo: false, limite: 10 });
  assert.equal(calls[0].url.searchParams.get('activo'), 'false');
  assert.equal(calls[0].url.searchParams.get('limite'), '10');
  await assert.rejects(client.crearPeriodo({ nombre: 'Ciencias' }), /confirmarEscritura/);
  await assert.rejects(client.actualizarPeriodo('period-1', { nombre: 'Biología' }), /confirmarEscritura/);
  await assert.rejects(client.archivarPeriodo('period-1'), /confirmarEliminacion/);
  await assert.rejects(client.crearAlumno({ periodoId: 'period-1', matricula: 'ABC1' }), /confirmarEscritura/);
  await assert.rejects(client.actualizarAlumno('student-1', { grupo: 'B' }), /confirmarEscritura/);
  assert.equal(calls.length, 1, 'las mutaciones del roster sin confirmar no deben llamar al servidor');
  await client.crearPeriodo({ nombre: 'Ciencias' }, { confirmarEscritura: true });
  await client.actualizarPeriodo('period-1', { nombre: 'Biología' }, { confirmarEscritura: true });
  await client.archivarPeriodo('period-1', { confirmarEliminacion: true });
  await assert.rejects(client.eliminarPeriodoDev('period-1'), /confirmarEliminacion/);
  await client.eliminarPeriodoDev('period-1', { confirmarEliminacion: true });
  assert.equal(calls[4].url.pathname, '/api/periodos/period-1/eliminar');

  await client.listarAlumnos({ periodoId: 'period-1', limite: 25 });
  assert.equal(calls[5].url.searchParams.get('periodoId'), 'period-1');
  await client.obtenerAlumno('student-1');
  await client.crearAlumno({ periodoId: 'period-1', matricula: 'ABC1' }, { confirmarEscritura: true });
  await client.actualizarAlumno('student-1', { grupo: 'B' }, { confirmarEscritura: true });
  await assert.rejects(client.eliminarAlumnoDev('student-1'), /confirmarEliminacion/);
  await client.eliminarAlumnoDev('student-1', { confirmarEliminacion: true });
  assert.equal(calls.at(-1).url.pathname, '/api/alumnos/student-1/eliminar');
});

test('cliente cubre el flujo de temarios y protege su eliminación', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ temarios: [{ id: 'topic-plan-1' }], temario: { id: 'topic-plan-1' }, nodos: [] }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.listarTemarios({ periodoId: 'period-1' });
  assert.equal(calls[0].url.searchParams.get('periodoId'), 'period-1');
  await client.obtenerNodosTemario('topic-plan-1');
  await client.obtenerTemario('topic-plan-1');
  await client.listarAuditoriaTemario('topic-plan-1', { limite: 10 });
  assert.equal(calls.at(-1).url.pathname, '/api/temarios/topic-plan-1/auditoria');
  assert.equal(calls.at(-1).url.searchParams.get('limite'), '10');
  await client.listarTodaAuditoriaTemario('topic-plan-1');
  await assert.rejects(client.crearTemarioManual({ periodoId: 'period-1', nombre: 'Plan', texto: '1 Introducción' }), /confirmarEscritura/);
  await client.crearTemarioManual({ periodoId: 'period-1', nombre: 'Plan', texto: '1 Introducción' }, { confirmarEscritura: true });
  const archivo = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  await assert.rejects(client.crearTemarioDesdePdf({ periodoId: 'period-1', archivo, nombre: 'Plan.pdf' }), /confirmarEscritura/);
  await client.crearTemarioDesdePdf({ periodoId: 'period-1', archivo, nombre: 'Plan.pdf' }, { confirmarEscritura: true });
  const llamadaPdf = calls.find((call) => call.init.body instanceof FormData);
  assert.equal(llamadaPdf.init.body.get('periodoId'), 'period-1');
  assert.equal(llamadaPdf.init.body.get('archivo').type, 'application/pdf');
  await assert.rejects(client.actualizarTemario('topic-plan-1', { expectedUpdatedAt: '2026-01-01T00:00:00.000Z', motivoCambio: 'Corrección' }), /confirmarEscritura/);
  await client.actualizarTemario('topic-plan-1', {
    nombre: 'Plan actualizado', texto: '1 Introducción revisada',
    expectedUpdatedAt: '2026-01-01T00:00:00.000Z', motivoCambio: 'Corrección docente'
  }, { confirmarEscritura: true });
  assert.equal(calls.at(-1).init.method, 'PUT');
  assert.equal(calls.at(-1).url.pathname, '/api/temarios/topic-plan-1');
  await assert.rejects(client.actualizarEstadoNodoTemario('node-1', { estado: 'cubierto' }), /confirmarEscritura/);
  await client.actualizarEstadoNodoTemario('node-1', { estado: 'cubierto' }, { confirmarEscritura: true });
  await assert.rejects(client.eliminarTemario('topic-plan-1'), /confirmarEliminacion/);
  await assert.rejects(client.eliminarTemario('topic-plan-1', { confirmarEliminacion: true }), /expectedUpdatedAt y motivoCambio/);
  await client.eliminarTemario('topic-plan-1', {
    confirmarEliminacion: true,
    expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    motivoCambio: 'Temario capturado por error'
  });
  assert.equal(calls.at(-1).url.pathname, '/api/temarios/topic-plan-1/eliminar');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    confirmarEliminacion: true,
    expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    motivoCambio: 'Temario capturado por error'
  });
});

test('cliente cubre CRUD de taxonomía de reactivos por ID', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ temas: [{ id: 'theme-1' }], tema: { id: 'theme-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.listarTemasBanco('period-1');
  assert.equal(calls[0].url.searchParams.get('periodoId'), 'period-1');
  await assert.rejects(client.crearTemaBanco({ periodoId: 'period-1', nombre: 'Genética' }), /confirmarEscritura/);
  await assert.rejects(client.actualizarTemaBanco('theme-1', { nombre: 'Biología molecular' }), /confirmarEscritura/);
  await assert.rejects(client.archivarTemaBanco('theme-1'), /confirmarEliminacion/);
  assert.equal(calls.length, 1, 'las mutaciones no confirmadas no deben enviar solicitudes');
  await assert.rejects(client.crearTemaBanco({ periodoId: 'period-1', nombre: 'Genética' }, { confirmarEscritura: true }), /clientRequestId UUID/);
  const crearId = 'ac6db1c8-429f-4c5b-9d5e-251f4e35b6aa';
  const actualizarId = 'e08c3352-0e59-4a73-98a2-2c62f7393f76';
  const archivarId = '7ca30196-60b0-4df2-9d11-26a74ebbc2e3';
  await client.crearTemaBanco({ periodoId: 'period-1', nombre: 'Genética' }, { confirmarEscritura: true, clientRequestId: crearId });
  await client.obtenerTemaBanco('theme-1');
  await client.actualizarTemaBanco('theme-1', { nombre: 'Biología molecular' }, { confirmarEscritura: true, clientRequestId: actualizarId });
  await client.archivarTemaBanco('theme-1', { confirmarEliminacion: true, clientRequestId: archivarId });
  assert.deepEqual(calls.slice(1).map(({ url }) => url.pathname), [
    '/api/banco-preguntas/temas',
    '/api/banco-preguntas/temas/theme-1',
    '/api/banco-preguntas/temas/theme-1/actualizar',
    '/api/banco-preguntas/temas/theme-1/archivar'
  ]);
  assert.equal(JSON.parse(calls[1].init.body).clientRequestId, crearId);
  assert.equal(JSON.parse(calls[3].init.body).clientRequestId, actualizarId);
  assert.equal(JSON.parse(calls[4].init.body).clientRequestId, archivarId);
});

test('cliente expone asistencia por API y exige confirmación para escribir la lista', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ sesiones: [], registros: [], ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.listarSesionesAsistencia({ periodoId: 'period-1' });
  assert.equal(calls[0].url.searchParams.get('periodoId'), 'period-1');
  await assert.rejects(client.crearSesionAsistencia({ periodoId: 'period-1' }), /confirmarEscritura/);
  await client.crearSesionAsistencia({ periodoId: 'period-1' }, { confirmarEscritura: true });
  await client.obtenerRegistrosAsistencia('session-1');
  await assert.rejects(client.guardarRegistrosAsistencia('session-1', { registros: [] }), /confirmarEscritura/);
  await client.guardarRegistrosAsistencia('session-1', { registros: [] }, { confirmarEscritura: true });
  await assert.rejects(client.eliminarSesionAsistencia('session-1'), /confirmarEliminacion/);
  await client.eliminarSesionAsistencia('session-1', { confirmarEliminacion: true });
  await client.listarReglasAsistencia();
  await assert.rejects(client.guardarReglaAsistencia({ periodoId: 'period-1' }), /confirmarEscritura/);
  await client.guardarReglaAsistencia({ periodoId: 'period-1' }, { confirmarEscritura: true });
  await client.eliminarReglaAsistencia('rule-1', { confirmarEliminacion: true });
  await client.listarExcepcionesAsistencia();
  await assert.rejects(client.crearExcepcionAsistencia({ alumnoId: 'student-1' }), /confirmarEscritura/);
  await client.crearExcepcionAsistencia({ alumnoId: 'student-1' }, { confirmarEscritura: true });
  await client.eliminarExcepcionAsistencia('exception-1', { confirmarEliminacion: true });
  await client.obtenerResumenAsistencia();
  await client.verificarDerechoExamen('student-1');
  assert.equal(calls[3].url.pathname, '/api/asistencias/sesiones/session-1/registros');
  assert.equal(calls.at(-1).url.pathname, '/api/asistencias/derecho-examen/student-1');
});

test('cliente expone papelera de desarrollo y exige confirmación para restaurar', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ items: [{ id: 'trash-1' }] }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  const page = await client.listarPapelera({ limite: 30 });
  assert.equal(page.items[0].id, 'trash-1');
  assert.equal(calls[0].url.pathname, '/api/papelera');
  assert.equal(calls[0].url.searchParams.get('limite'), '30');
  await assert.rejects(client.restaurarPapelera('trash-1'), /confirmarEscritura/);
  assert.equal(calls.length, 1, 'restaurar sin confirmar no debe enviar solicitud');
  await client.restaurarPapelera('trash-1', { confirmarEscritura: true });
  assert.equal(calls[1].url.pathname, '/api/papelera/trash-1/restaurar');
});

test('cliente lista y obtiene plantillas por ID', async () => {
  const visited = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url) => {
      visited.push(new URL(url));
      return new Response(JSON.stringify({ plantillas: [], plantilla: { id: 'template-1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  await client.listarPlantillas({ periodoId: 'periodo-1', archivado: false, limite: 10 });
  assert.equal(visited[0].pathname, '/api/examenes/plantillas');
  assert.equal(visited[0].searchParams.get('periodoId'), 'periodo-1');
  assert.equal(visited[0].searchParams.get('archivado'), 'false');
  assert.deepEqual(await client.obtenerPlantilla('template-1'), { id: 'template-1' });
  assert.equal(visited[1].pathname, '/api/examenes/plantillas/template-1');
});

test('cliente expone ciclo de vida seguro de plantillas y lotes de exámenes', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, init });
    if (parsed.pathname.endsWith('/previsualizar/pdf')) {
      return new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } });
    }
    return new Response(JSON.stringify({ plantilla: { id: 'template-1' }, examen: { id: 'exam-1' }, examenes: [], assessment: { _id: 'exam-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await assert.rejects(client.crearPlantilla({ titulo: 'Parcial' }), /confirmarEscritura/);
  await assert.rejects(client.actualizarPlantilla('template-1', { titulo: 'Parcial 1' }), /confirmarEscritura/);
  await assert.rejects(client.archivarPlantilla('template-1'), /confirmarEliminacion/);
  assert.equal(calls.length, 0, 'plantillas sin confirmar no deben enviar solicitudes');
  await client.crearPlantilla({ titulo: 'Parcial' }, { confirmarEscritura: true });
  await client.actualizarPlantilla('template-1', { titulo: 'Parcial 1' }, { confirmarEscritura: true });
  await client.archivarPlantilla('template-1', { confirmarEliminacion: true });
  await client.previsualizarPlantilla('template-1');
  assert.equal(calls[0].url.pathname, '/api/examenes/plantillas');
  assert.equal(calls[1].url.pathname, '/api/examenes/plantillas/template-1');
  assert.equal(calls[2].url.pathname, '/api/examenes/plantillas/template-1/archivar');
  assert.equal(calls[3].url.pathname, '/api/examenes/plantillas/template-1/previsualizar');
  const pdf = await client.previsualizarPlantillaPdf('template-1', { forzarRegeneracion: true });
  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(calls[4].url.searchParams.get('refresh'), '1');
  await client.previsualizarPlantillaPdfVisual('template-1');

  await assert.rejects(client.generarLoteExamenes({ plantillaId: 'template-1' }, { confirmarEscritura: true }), /loteId estable/);
  await assert.rejects(client.generarLoteExamenes({ plantillaId: 'template-1', loteId: 'LOTE2026A' }), /confirmarEscritura/);
  await client.generarLoteExamenes({ plantillaId: 'template-1', loteId: 'LOTE2026A' }, { confirmarEscritura: true });
  assert.equal(calls[6].url.pathname, '/api/examenes/generados/lote');
  assert.deepEqual(JSON.parse(calls[6].init.body), { plantillaId: 'template-1', loteId: 'LOTE2026A' });
  await client.listarExamenesGenerados({ periodoId: 'period-1', alumnoId: 'student-1', limite: 5 });
  assert.equal(calls[7].url.searchParams.get('periodoId'), 'period-1');
  assert.equal(calls[7].url.searchParams.get('alumnoId'), 'student-1');
  await client.obtenerExamenGenerado('exam-1');
  assert.equal(calls[8].url.pathname, '/api/examenes/generados/exam-1');
  await assert.rejects(client.archivarExamenGenerado('exam-1'), /confirmarEliminacion/);
  await client.archivarExamenGenerado('exam-1', { confirmarEliminacion: true });
  assert.equal(calls[9].url.pathname, '/api/examenes/generados/exam-1/archivar');
  assert.deepEqual(await client.obtenerExamenPorFolio('FOLIO / 1'), { id: 'exam-1' });
  assert.equal(calls[10].url.pathname, '/api/examenes/generados/folio/FOLIO%20%2F%201');
  assert.equal(Buffer.isBuffer(await client.descargarPdfExamenGenerado('exam-1')), true);
  assert.equal(calls[11].url.pathname, '/api/examenes/generados/exam-1/pdf');
  assert.equal(Buffer.isBuffer(await client.descargarPdfLoteExamenes('LOTE2026A')), true);
  assert.equal(calls[12].url.pathname, '/api/examenes/generados/lote/LOTE2026A/pdf');
  await assert.rejects(client.regenerarPdfExamenGenerado('exam-1'), /confirmarEscritura/);
  assert.equal(calls.length, 13, 'regenerar sin confirmar no debe enviar solicitud');
  await client.regenerarPdfExamenGenerado('exam-1', { forzar: true, confirmarEscritura: true });
  assert.equal(calls[13].url.pathname, '/api/examenes/generados/exam-1/regenerar');
  assert.deepEqual(JSON.parse(calls[13].init.body), { forzar: true });
  await assert.rejects(client.eliminarPlantilla('template-1'), /confirmarEliminacion/);
  assert.equal(calls.length, 14, 'eliminar sin confirmar no debe enviar solicitud');
  await client.eliminarPlantilla('template-1', { confirmarEliminacion: true });
  assert.equal(calls[14].url.pathname, '/api/examenes/plantillas/template-1/eliminar');
});

test('preflight identifica periodo y no consulta lease sin ID de equipo', async () => {
  const visited = [];
  const responses = [
    { ready: true }, { version: '1.1.6' }, { docente: { permisos: ['periodos:leer', 'sincronizacion:listar'] } },
    { periodos: [{ id: 'periodo-1' }] }
  ];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url) => {
    visited.push(new URL(url).pathname);
    return new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const result = await client.preflight({ periodoId: 'periodo-1' });
  assert.equal(result.periodo.state, 'available');
  assert.equal(result.lease.state, 'needs_team_id');
  assert.equal(visited.includes('/api/sincronizaciones/local/lease'), false);
});

test('cliente pagina exámenes generados y ofrece la acumulación de todas las páginas', async () => {
  const llamadas = [];
  const respuestas = [
    { examenes: [{ _id: 'exam-1' }], nextCursor: 'cursor-2' },
    { examenes: [{ _id: 'exam-2' }], nextCursor: null },
    { examenes: [{ _id: 'exam-1' }], nextCursor: 'cursor-2' },
    { examenes: [{ _id: 'exam-2' }], nextCursor: null }
  ];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url) => {
    llamadas.push(new URL(url));
    return new Response(JSON.stringify(respuestas.shift()), { status: 200, headers: { 'content-type': 'application/json' } });
  } });

  const primera = await client.listarPaginaExamenesGenerados({ periodoId: 'period-1', limite: 1 });
  const segunda = await client.listarPaginaExamenesGenerados({ periodoId: 'period-1', limite: 1, cursor: primera.nextCursor });
  assert.equal(segunda.examenes[0]._id, 'exam-2');
  assert.equal(llamadas[1].searchParams.get('cursor'), 'cursor-2');
  const todas = await client.listarTodosExamenesGenerados({ periodoId: 'period-1', limite: 1 });
  assert.deepEqual(todas.map((item) => item._id), ['exam-1', 'exam-2']);
  assert.equal(llamadas[3].searchParams.get('cursor'), 'cursor-2');
});

test('rutas relativas no pueden escapar del prefijo /api', async () => {
  const client = new EvaluaproClient({ baseUrl: 'http://localhost' });
  await assert.rejects(client.request('../autenticacion/perfil'), TypeError);
});

test('job OMR automatizado requiere clientRequestId persistente y las notas piden confirmación', async () => {
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token' });
  await assert.rejects(client.crearJobOmr({ generatedAssessmentId: 'exam-1', sourceType: 'pdf', capturas: [] }, { confirmarEscritura: true }), /clientRequestId UUID/);
  await assert.rejects(client.crearJobOmr({ generatedAssessmentId: 'exam-1', sourceType: 'pdf', capturas: [], clientRequestId: '0ed65266-1404-4293-95a9-6262694f8c21' }), /confirmarEscritura/);
  await assert.rejects(client.calificarExamen({ examenGeneradoId: 'exam-1' }), /Confirma explícitamente/);
  await assert.rejects(client.calificarExamen({ examenGeneradoId: 'exam-1' }, { confirmarEscritura: true }), /clientRequestId UUID/);
  await assert.rejects(client.request('/calificaciones/calificar', { method: 'POST', body: {} }), /confirmarEscritura/);
});

test('ingesta PDF OMR conserva multipart, UUID y permite resolver una página por API', async () => {
  const calls = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      return new Response(JSON.stringify({ job: { jobId: 'job-1' } }), { status: calls.length === 1 ? 202 : 200, headers: { 'content-type': 'application/json' } });
    }
  });
  const id = '0ed65266-1404-4293-95a9-6262694f8c21';
  const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
  const solicitud = { generatedAssessmentId: 'exam-1', clientRequestId: id, archivos: [{ nombre: 'scan.pdf', file }] };
  await assert.rejects(client.ingresarPdfsOmr(solicitud), /confirmarEscritura/);
  const job = await client.ingresarPdfsOmr(solicitud, { confirmarEscritura: true });
  assert.equal(job.jobId, 'job-1');
  assert.equal(calls[0].url.pathname, '/api/omr/ingestas');
  assert.equal(calls[0].init.body.get('clientRequestId'), id);
  assert.equal(calls[0].init.body.getAll('archivos').length, 1);
  await client.recuperarIngestaPdfOmr(id);
  assert.equal(calls[1].url.pathname, `/api/omr/ingestas/por-clave/${id}`);
  const resolucion = { generatedAssessmentId: 'exam-1', examPage: 2, resolutionReason: 'Revisión manual' };
  await assert.rejects(client.resolverPaginaIngestaOmr('job-1', 1, resolucion), /confirmarEscritura/);
  await client.resolverPaginaIngestaOmr('job-1', 1, resolucion, { confirmarEscritura: true });
  assert.equal(calls[2].url.pathname, '/api/omr/ingestas/job-1/paginas/1/resolver');
  assert.deepEqual(JSON.parse(calls[2].init.body), { generatedAssessmentId: 'exam-1', examPage: 2, resolutionReason: 'Revisión manual' });
});

test('cliente completa prevalidación, resolución y finalización del job OMR', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ resultados: [], job: { jobId: 'job-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.prevalidarCapturasOmr([{ nombreArchivo: 'scan.png', imagenBase64: 'aGVsbG8gd29ybGQ=' }]);
  await assert.rejects(client.resolverExcepcionJobOmr('job-1', 'sheet-1', {}, { confirmarEscritura: true }), /resolutionReason/);
  await assert.rejects(client.resolverExcepcionJobOmr('job-1', 'sheet-1', { resolutionReason: 'Identidad verificada' }), /confirmarEscritura/);
  await client.resolverExcepcionJobOmr('job-1', 'sheet-1', { resolutionReason: 'Identidad verificada' }, { confirmarEscritura: true });
  await assert.rejects(client.finalizarJobOmr('job-1'), /confirmarEscritura/);
  await client.finalizarJobOmr('job-1', { confirmarEscritura: true });
  assert.equal(calls[0].url.pathname, '/api/omr/prevalidar-lote');
  assert.equal(calls[1].url.pathname, '/api/omr/jobs/job-1/exceptions/sheet-1/resolve');
  assert.equal(calls[2].url.pathname, '/api/omr/jobs/job-1/finalize');
});

test('listarJobsOmr serializa filtros y cursor en la consulta', async () => {
  let visited;
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url) => {
      visited = new URL(url);
      return new Response(JSON.stringify({ jobs: [], nextCursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  await client.listarJobsOmr({ generatedAssessmentId: 'exam 1', status: 'completed', limite: 10, cursor: 'abc==' });
  assert.equal(visited.pathname, '/api/omr/jobs');
  assert.equal(visited.searchParams.get('generatedAssessmentId'), 'exam 1');
  assert.equal(visited.searchParams.get('status'), 'completed');
  assert.equal(visited.searchParams.get('limite'), '10');
  assert.equal(visited.searchParams.get('cursor'), 'abc==');
});

test('calificarExamen transmite la clave persistente después de confirmación explícita', async () => {
  let captured;
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url, init) => {
      captured = { url: new URL(url), body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ calificacion: { id: 'grade-1' } }), { status: 201, headers: { 'content-type': 'application/json' } });
    }
  });
  const clientRequestId = 'a359e1ab-bce1-4e3a-95d2-6c0f91c7d7f9';
  const result = await client.calificarExamen({ examenGeneradoId: 'exam-1', clientRequestId }, { confirmarEscritura: true });
  assert.equal(result.calificacion.id, 'grade-1');
  assert.equal(captured.url.pathname, '/api/calificaciones/calificar');
  assert.equal(captured.body.clientRequestId, clientRequestId);
});

test('cliente consulta calificaciones y protege resolución/sincronización de revisiones', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ calificaciones: [], solicitudes: [], ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.obtenerCalificacionesExamen('exam-1');
  await client.listarSolicitudesRevisionCalificacion();
  await assert.rejects(client.resolverSolicitudRevisionCalificacion('review-1', {}), /confirmarEscritura/);
  await client.resolverSolicitudRevisionCalificacion('review-1', { decision: 'aceptar' }, { confirmarEscritura: true });
  await assert.rejects(client.sincronizarSolicitudesRevisionCalificacion({}), /confirmarEscritura/);
  await client.sincronizarSolicitudesRevisionCalificacion({}, { confirmarEscritura: true });
  assert.deepEqual(calls.map(({ url }) => url.pathname), [
    '/api/calificaciones/examen/exam-1',
    '/api/calificaciones/revision/solicitudes',
    '/api/calificaciones/revision/solicitudes/review-1/resolver',
    '/api/calificaciones/revision/solicitudes/sincronizar'
  ]);
});

test('cliente consulta la lista académica y protege calificaciones manuales versionadas', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ filas: [], calificacion: { version: 2 } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });

  await client.listaAcademica('period-1');
  await assert.rejects(client.guardarCalificacionLista({ periodoId: 'period-1' }), /confirmarEscritura/);
  assert.equal(calls.length, 1, 'la escritura no confirmada no debe llamar al servidor');
  await assert.rejects(client.guardarCalificacionLista({ clientRequestId: 'invalid' }, { confirmarEscritura: true }), /clientRequestId UUID/);
  assert.equal(calls.length, 1, 'una clave inválida no debe llamar al servidor');
  const clientRequestId = 'e919a2f1-2de4-4c4a-b21a-d9271a252e3d';
  const result = await client.guardarCalificacionLista({
    periodoId: 'period-1', alumnoId: 'student-1', componente: 'EXAMEN_P2', calificacion: 9.5, version: 1, clientRequestId
  }, { confirmarEscritura: true });
  assert.equal(result.calificacion.version, 2);
  assert.equal(calls[0].url.pathname, '/api/analiticas/lista-academica');
  assert.equal(calls[0].url.searchParams.get('periodoId'), 'period-1');
  assert.equal(calls[1].url.pathname, '/api/analiticas/lista-academica/calificaciones');
  assert.equal(JSON.parse(calls[1].init.body).version, 1);
});


test('cliente lista entregas con cursor y protege sus mutaciones', async () => {
  const calls = [];
  const client = new EvaluaproClient({
    baseUrl: 'http://localhost', token: 'token',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: new URL(url), init });
      return new Response(JSON.stringify({ entregas: [], nextCursor: null, entrega: { id: 'delivery-1' }, actualizado: true }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    }
  });

  await client.listarEntregas({ periodoId: 'period-1', loteId: 'batch-1', estado: 'entregado', limite: 10, cursor: 'cursor-1' });
  await client.obtenerEntrega('delivery/1');
  await assert.rejects(client.vincularEntrega({ examenGeneradoId: 'exam-1', alumnoId: 'student-1' }), /confirmarEscritura/);
  await assert.rejects(client.vincularEntregaPorFolio({ folio: 'F-1', alumnoId: 'student-1' }), /confirmarEscritura/);
  await assert.rejects(client.deshacerEntregaPorFolio({ folio: 'F-1' }), /confirmarEscritura/);
  await client.vincularEntrega({ examenGeneradoId: 'exam-1', alumnoId: 'student-1' }, { confirmarEscritura: true });
  await client.vincularEntregaPorFolio({ folio: 'F-1', alumnoId: 'student-1' }, { confirmarEscritura: true });
  await client.deshacerEntregaPorFolio({ folio: 'F-1', motivo: 'corrección' }, { confirmarEscritura: true });

  assert.equal(calls[0].url.pathname, '/api/entregas');
  assert.equal(calls[0].url.searchParams.get('periodoId'), 'period-1');
  assert.equal(calls[0].url.searchParams.get('loteId'), 'batch-1');
  assert.equal(calls[1].url.pathname, '/api/entregas/delivery%2F1');
  assert.deepEqual(calls.slice(2).map(({ url, init }) => [url.pathname, init.method]), [
    ['/api/entregas/vincular', 'POST'],
    ['/api/entregas/vincular-folio', 'POST'],
    ['/api/entregas/deshacer-folio', 'POST']
  ]);
});


test('cliente lista metadatos de código de acceso y exige confirmar la generación', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ codigosAcceso: [], nextCursor: null, codigoAcceso: { id: 'code-1' }, codigoAccesoId: 'code-1', codigo: 'secret-on-create' }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  } });
  await client.listarCodigosAcceso({ periodoId: 'period-1', estado: 'vigente', limite: 5, cursor: 'cursor-1' });
  await client.obtenerCodigoAcceso('code-1');
  await assert.rejects(client.generarCodigoAcceso('period-1'), /confirmarEscritura/);
  await assert.rejects(client.expirarCodigoAcceso('code-1'), /confirmarEscritura/);
  const clientRequestId = 'b1f58e45-84b3-4bd7-8313-a824c6e83ee7';
  await assert.rejects(client.generarCodigoAcceso('period-1', { confirmarEscritura: true }), /clientRequestId/);
  await client.generarCodigoAcceso('period-1', { clientRequestId, confirmarEscritura: true });
  await client.expirarCodigoAcceso('code-1', { confirmarEscritura: true });
  assert.equal(calls[0].url.pathname, '/api/sincronizaciones/codigo-acceso');
  assert.equal(calls[0].url.searchParams.get('estado'), 'vigente');
  assert.equal(calls[1].url.pathname, '/api/sincronizaciones/codigo-acceso/code-1');
  assert.equal(calls[2].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].init.body), { periodoId: 'period-1', clientRequestId });
  assert.equal(calls[3].url.pathname, '/api/sincronizaciones/codigo-acceso/code-1/expirar');
});

test('cliente genera un examen individual con clave estable', async () => {
  const calls = [];
  const clientRequestId = '1c375f3a-64f0-4a4f-b67b-e709888d76f3';
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', token: 'token', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ examenGenerado: { _id: clientRequestId } }), {
      status: 201, headers: { 'content-type': 'application/json' }
    });
  } });
  await assert.rejects(client.generarExamenIndividual({ plantillaId: 'template-1' }, { confirmarEscritura: true }), /clientRequestId/);
  await assert.rejects(client.generarExamenIndividual({ plantillaId: 'template-1', clientRequestId: 'no-es-uuid' }, { confirmarEscritura: true }), /clientRequestId/);
  await assert.rejects(client.generarExamenIndividual({ plantillaId: 'template-1', clientRequestId }), /confirmarEscritura/);
  assert.equal(calls.length, 0, 'generación sin confirmar no debe enviar solicitudes');
  const respuesta = await client.generarExamenIndividual({ plantillaId: 'template-1', clientRequestId }, { confirmarEscritura: true });
  assert.equal(respuesta.examenGenerado._id, clientRequestId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/api/examenes/generados');
  assert.deepEqual(JSON.parse(calls[0].init.body), { plantillaId: 'template-1', clientRequestId });
});

test('cliente pagina los paquetes de examen y acumula sus páginas', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', fetchImpl: async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    const page = parsed.searchParams.has('cursor')
      ? { lotes: [{ loteId: 'LOT_0002' }], nextCursor: null }
      : { lotes: [{ loteId: 'LOT_0001' }], nextCursor: 'cursor-2' };
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const first = await client.listarLotesExamenes({ plantillaId: 'template-1', limite: 1 });
  assert.equal(first.lotes[0].loteId, 'LOT_0001');
  assert.deepEqual(await client.listarTodosLotesExamenes({ plantillaId: 'template-1', limite: 1 }), [
    { loteId: 'LOT_0001' }, { loteId: 'LOT_0002' }
  ]);
  assert.equal(calls[0].pathname, '/api/examenes/generados/lotes');
  assert.equal(calls[0].searchParams.get('plantillaId'), 'template-1');
});

test('cliente archiva/restaura lotes con UUID y consulta su auditoría sin navegador', async () => {
  const calls = [];
  const clientRequestId = '40b7fe4c-7ae1-4de3-a63e-28a286602760';
  const clientRequestRestoreId = '72ebf963-8fce-45f0-9af2-994498165f40';
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', fetchImpl: async (url, init = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, init });
    const data = parsed.pathname.endsWith('/auditoria')
      ? parsed.searchParams.has('cursor')
        ? { eventos: [{ id: 'event-2', accion: 'restaurar' }], nextCursor: null }
        : { eventos: [{ id: 'event-1', accion: 'archivar' }], nextCursor: 'cursor-2' }
      : parsed.pathname.endsWith('/lotes')
        ? { lotes: [{ loteId: 'LOT_2026' }], nextCursor: null }
        : { ok: true, loteId: 'LOT_2026', archivado: parsed.pathname.endsWith('/archivar') };
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  } });

  await assert.rejects(client.archivarLoteExamenes('LOT_2026', { clientRequestId }), /confirmarEscritura/);
  await assert.rejects(client.restaurarLoteExamenes('LOT_2026', { confirmarEscritura: true }), /clientRequestId UUID/);
  assert.equal(calls.length, 0);
  await client.archivarLoteExamenes('LOT_2026', { clientRequestId, confirmarEscritura: true });
  assert.equal(calls[0].url.pathname, '/api/examenes/generados/lote/LOT_2026/archivar');
  assert.deepEqual(JSON.parse(calls[0].init.body), { clientRequestId });
  await client.restaurarLoteExamenes('LOT_2026', { clientRequestId: clientRequestRestoreId, confirmarEscritura: true });
  assert.equal(calls[1].url.pathname, '/api/examenes/generados/lote/LOT_2026/restaurar');
  const archivados = await client.listarLotesExamenes({ archivado: true, limite: 10 });
  assert.equal(archivados.lotes[0].loteId, 'LOT_2026');
  assert.equal(calls[2].url.searchParams.get('archivado'), 'true');
  assert.deepEqual(await client.listarTodaAuditoriaLoteExamenes('LOT_2026', { limite: 1 }), [
    { id: 'event-1', accion: 'archivar' }, { id: 'event-2', accion: 'restaurar' }
  ]);
  assert.equal(calls[4].url.searchParams.get('cursor'), 'cursor-2');
});

test('cliente pagina y acumula evidencias de evaluación sin escrituras implícitas', async () => {
  const calls = [];
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', fetchImpl: async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    const page = parsed.searchParams.has('cursor')
      ? { evidencias: [{ id: 'evidence-2' }], nextCursor: null }
      : { evidencias: [{ id: 'evidence-1' }], nextCursor: 'cursor-2' };
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const first = await client.listarEvidenciasEvaluacion({ periodoId: 'period-1', alumnoId: 'student-1', limite: 1 });
  assert.equal(first.evidencias[0].id, 'evidence-1');
  assert.deepEqual(await client.listarTodasEvidenciasEvaluacion({ periodoId: 'period-1', limite: 1 }), [
    { id: 'evidence-1' }, { id: 'evidence-2' }
  ]);
  assert.equal(calls[0].pathname, '/api/evaluaciones/evidencias');
  assert.equal(calls[0].searchParams.get('periodoId'), 'period-1');
});

test('cliente exige confirmación e idempotencia para mutaciones de políticas y evidencias', async () => {
  const calls = [];
  const clientRequestId = '66f4b0a7-c845-43ee-a39c-5803b5e6c513';
  const client = new EvaluaproClient({ baseUrl: 'http://localhost', fetchImpl: async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    const body = new URL(url).pathname.endsWith('/auditoria')
      ? { eventos: [{ id: 'audit-1' }], nextCursor: null }
      : { politica: { codigo: 'POLICY_DOCENTE', version: 1 }, evidencia: { id: clientRequestId } };
    return new Response(JSON.stringify(body), {
      status: 201, headers: { 'content-type': 'application/json' }
    });
  } });
  const policy = {
    codigo: 'POLICY_DOCENTE', familia: 'lisc_encuadre', nombre: 'Política docente', clientRequestId,
    parametros: { pesosGlobales: { continua: 0.5, examenes: 0.5 } }
  };
  await assert.rejects(client.crearPoliticaCalificacion(policy), /confirmarEscritura/);
  await assert.rejects(client.crearPoliticaCalificacion({ ...policy, clientRequestId: undefined }, { confirmarEscritura: true }), /clientRequestId/);
  const created = await client.crearPoliticaCalificacion(policy, { confirmarEscritura: true });
  assert.equal(created.codigo, 'POLICY_DOCENTE');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].url.pathname, '/api/evaluaciones/politicas');
  await assert.rejects(client.archivarPoliticaCalificacion('POLICY_DOCENTE'), /confirmarEliminacion/);
  await assert.rejects(client.archivarPoliticaCalificacion('POLICY_DOCENTE', { confirmarEliminacion: true, motivo: 'Duplicada' }), /clientRequestId/);
  await assert.rejects(client.archivarPoliticaCalificacion('POLICY_DOCENTE', { confirmarEliminacion: true, clientRequestId, motivo: '' }), /motivo/);
  const archived = await client.archivarPoliticaCalificacion('POLICY_DOCENTE', {
    clientRequestId, motivo: 'Política sustituida', confirmarEliminacion: true
  });
  assert.equal(archived.codigo, 'POLICY_DOCENTE');
  assert.equal(calls.at(-1).url.pathname, '/api/evaluaciones/politicas/POLICY_DOCENTE');
  assert.equal(calls.at(-1).init.method, 'DELETE');
  assert.equal(JSON.parse(calls.at(-1).init.body).clientRequestId, clientRequestId);
  const audit = await client.listarAuditoriaPoliticaCalificacion('POLICY_DOCENTE', { limite: 10 });
  assert.equal(audit.eventos[0].id, 'audit-1');
  assert.equal(calls.at(-1).url.pathname, '/api/evaluaciones/politicas/POLICY_DOCENTE/auditoria');
  await assert.rejects(client.crearEvidenciaEvaluacion({ periodoId: 'p', alumnoId: 'a', titulo: 'Evidencia' }), /confirmarEscritura/);
  await assert.rejects(client.crearEvidenciaEvaluacion({ periodoId: 'p', alumnoId: 'a', titulo: 'Evidencia' }, { confirmarEscritura: true }), /clientRequestId/);
  await assert.rejects(client.actualizarEvidenciaEvaluacion('e-1', { expectedUpdatedAt: '2026-01-01', motivoCambio: 'Corrección' }), /confirmarEscritura/);
  await assert.rejects(client.archivarEvidenciaEvaluacion('e-1', { motivo: 'Duplicada' }), /confirmarEscritura/);
  await assert.rejects(client.restaurarEvidenciaEvaluacion('e-1', { motivo: 'Validada' }), /confirmarEscritura/);
  const evidence = await client.crearEvidenciaEvaluacion({ clientRequestId, periodoId: 'p', alumnoId: 'a', titulo: 'Evidencia' }, { confirmarEscritura: true });
  assert.equal(evidence.id, clientRequestId);
  assert.equal(calls.find((call) => call.url.pathname === '/api/evaluaciones/evidencias').url.pathname, '/api/evaluaciones/evidencias');
});
