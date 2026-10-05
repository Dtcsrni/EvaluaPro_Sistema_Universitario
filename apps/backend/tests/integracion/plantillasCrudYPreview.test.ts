/**
 * plantillasCrudYPreview.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExamenGenerado } from '../../src/modulos/modulo_generacion_pdf/modeloExamenGenerado.js';
import { BancoPregunta } from '../../src/modulos/modulo_banco_preguntas/modeloBancoPregunta.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { crearApp } from '../../src/app.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('plantillas CRUD + previsualizacion', () => {
  const app = crearApp();
  const TOTAL_PREGUNTAS_TEST = 8;
  const TEST_TIMEOUT_PLANTILLAS_MS = 90_000;

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  async function registrarDocente(correo = 'docente@prueba.test') {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo,
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPreguntas(params: { auth: { Authorization: string }; periodoId: string; total: number; tema?: string }) {
    const temaResp = await request(app)
      .post('/api/banco-preguntas/temas')
      .set(params.auth)
      .send({ periodoId: params.periodoId, nombre: params.tema ?? 'Tema de prueba' })
      .expect(201);
    const temaId = temaResp.body.tema._id as string;
    const batch = {
      contract: 'evaluapro.reactivos.batch',
      schemaVersion: 1,
      batchId: `plantillas-preview-${params.periodoId}-${Date.now()}`,
      target: { periodoId: params.periodoId, temaIds: [temaId] },
      source: { kind: 'manual', generator: 'plantillasCrudYPreview.test', generatedAt: new Date().toISOString() },
      items: Array.from({ length: params.total }, (_, index) => {
        const numero = index + 1;
        const sufijo = params.tema ? ` ${numero}` : '';
        return {
          externalKey: `plantilla-${params.periodoId}-${numero}`,
          itemId: null,
          expectedVersion: null,
          format: 'omr.mcq5',
          stem: { format: 'richtext', value: `Pregunta ${numero}` },
          options: ['A', 'B', 'C', 'D', 'E'].map((key, optionIndex) => ({
            key,
            value: `Opcion ${key}${sufijo}`,
            isCorrect: optionIndex === 0
          })),
          metadata: { difficultyHypothesis: 'medium' },
          provenance: { origin: 'authored', confidence: 1, notes: 'fixture de integracion' }
        };
      })
    };
    const preview = await request(app)
      .post('/api/banco-preguntas/importaciones/preview')
      .set(params.auth)
      .send(batch)
      .expect(200);
    const confirmado = await request(app)
      .post(`/api/banco-preguntas/importaciones/${preview.body.importId}/confirmar`)
      .set(params.auth)
      .send({ planHash: preview.body.planHash, payload: batch })
      .expect(200);
    const preguntasIds: string[] = [];
    for (const reactivoId of confirmado.body.reactivoIds as string[]) {
      await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/revisar`)
        .set(params.auth)
        .send({})
        .expect(200);
      const publicado = await request(app)
        .post(`/api/banco-preguntas/reactivos/${reactivoId}/publicar`)
        .set(params.auth)
        .send({})
        .expect(200);
      preguntasIds.push(publicado.body.legacyPreguntaId as string);
    }
    return preguntasIds;
  }

  async function descargarPreviewPdf(auth: { Authorization: string }, plantillaId: string) {
    return request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf`)
      .set(auth)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
  }

  it('permite editar, previsualizar y archivar una plantilla sin examenes generados', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo 2025',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntasIds = await crearPreguntas({ auth, periodoId, total: TOTAL_PREGUNTAS_TEST });

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 1,
        preguntasIds
      })
      .expect(201);
    expect(plantillaResp.body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    const editResp = await request(app)
      .post(`/api/examenes/plantillas/${plantillaId}`)
      .set(auth)
      .send({
        titulo: 'Parcial 1 (editado)',
        numeroPaginas: 1
      })
      .expect(200);
    expect(editResp.body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(editResp.body?.plantilla?.titulo).toBe('Parcial 1 (editado)');

    const detalle = await request(app).get(`/api/examenes/plantillas/${plantillaId}`).set(auth).expect(200);
    expect(detalle.body.plantilla).toMatchObject({ _id: plantillaId, titulo: 'Parcial 1 (editado)', preguntasIds });
    const tokenAjeno = await registrarDocente('docente-ajeno@prueba.test');
    await request(app).get(`/api/examenes/plantillas/${plantillaId}`).set({ Authorization: `Bearer ${tokenAjeno}` }).expect(404);

    const prev = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar`)
      .set(auth)
      .expect((response) => { expect(response.status, JSON.stringify(response.body)).toBe(200); });
    expect(prev.body?.plantillaId).toBe(String(plantillaId));
    expect(Array.isArray(prev.body?.paginas)).toBe(true);
    expect(prev.body.paginas.length).toBeGreaterThan(0);

    const previewPdf = await descargarPreviewPdf(auth, plantillaId);
    expect(String(previewPdf.headers['content-type'] || '')).toContain('application/pdf');

    const previewVisual = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);
    expect(String(previewVisual.headers['content-type'] || '')).toContain('application/json');
    expect(previewVisual.body?.pdfBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(previewVisual.body?.paginas?.length).toBeGreaterThan(0);
    expect(previewVisual.body?.paginas?.[0]?.dataUrl).toMatch(/^data:image\/png;base64,/);

    const generadosDespuesPreview = await ExamenGenerado.countDocuments({});
    expect(generadosDespuesPreview).toBe(0);

    const archivarResp = await request(app).post(`/api/examenes/plantillas/${plantillaId}/archivar`).set(auth).expect(200);
    expect(archivarResp.body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(archivarResp.body?.plantilla?.archivadoEn).toBeTruthy();

    const listResp = await request(app).get('/api/examenes/plantillas').set(auth).expect(200);
    expect(listResp.body?.plantillas?.length ?? 0).toBe(0);
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('revierte el alta y la sustitución de preguntas si una relación falla', async () => {
    const token = await registrarDocente('plantilla-atomica@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Periodo atómico', fechaInicio: '2025-01-01', fechaFin: '2025-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;
    const preguntasIds = await crearPreguntas({ auth, periodoId, total: 1 });
    const preguntaInexistente = '00000000-0000-4000-8000-000000000000';

    await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Alta fallida', numeroPaginas: 1, preguntasIds: [preguntaInexistente] })
      .expect(500);
    expect(await prisma.examenPlantilla.count({ where: { titulo: 'Alta fallida' } })).toBe(0);

    const creada = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Plantilla inicial', numeroPaginas: 1, preguntasIds })
      .expect(201);
    const plantillaId = creada.body.plantilla._id as string;

    await request(app)
      .post(`/api/examenes/plantillas/${plantillaId}`)
      .set(auth)
      .send({ titulo: 'Edición fallida', preguntasIds: [preguntaInexistente] })
      .expect(500);

    const detalle = await request(app).get(`/api/examenes/plantillas/${plantillaId}`).set(auth).expect(200);
    expect(detalle.body.plantilla.titulo).toBe('Plantilla inicial');
    expect(detalle.body.plantilla.preguntasIds).toEqual(preguntasIds);
    expect(await prisma.preguntaPlantilla.count({ where: { plantillaId } })).toBe(1);
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('versiona la auditoría de plantilla y recupera alta, edición, archivo y borrado por clientRequestId', async () => {
    const token = await registrarDocente('plantilla-idempotente@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Periodo idempotente', fechaInicio: '2025-01-01', fechaFin: '2025-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;
    const preguntasIds = await crearPreguntas({ auth, periodoId, total: 1 });
    const crearPayload = {
      clientRequestId: 'e9515b20-b017-4a3a-a83d-20e7740718c1',
      periodoId, tipo: 'parcial', titulo: 'Plantilla idempotente', numeroPaginas: 1, preguntasIds
    };
    const creada = await request(app).post('/api/examenes/plantillas').set(auth).send(crearPayload).expect(201);
    const repetida = await request(app).post('/api/examenes/plantillas').set(auth).send(crearPayload).expect(201);
    const plantillaId = creada.body.plantilla._id as string;
    expect(repetida.body.plantilla._id).toBe(plantillaId);
    expect(repetida.body.repetida).toBe(true);
    expect(await prisma.examenPlantilla.count({ where: { docenteId: creada.body.plantilla.docenteId, titulo: 'Plantilla idempotente' } })).toBe(1);
    await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ ...crearPayload, titulo: 'Otro título' })
      .expect(409);
    await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ ...crearPayload, clientRequestId: 'no-es-uuid' })
      .expect(400);

    const editarPayload = { clientRequestId: '477b79c9-d6ce-42c3-95f8-2536d41616e6', titulo: 'Plantilla actualizada' };
    await request(app).post(`/api/examenes/plantillas/${plantillaId}`).set(auth).send(editarPayload).expect(200);
    const edicionRepetida = await request(app).post(`/api/examenes/plantillas/${plantillaId}`).set(auth).send(editarPayload).expect(200);
    expect(edicionRepetida.body.repetida).toBe(true);
    expect(edicionRepetida.body.plantilla.titulo).toBe('Plantilla actualizada');

    const archivoId = '1755c6d9-4731-4aa3-9bbf-f4ed156170c8';
    await request(app).post(`/api/examenes/plantillas/${plantillaId}/archivar`).set(auth).send({ clientRequestId: archivoId }).expect(200);
    const archivoRepetido = await request(app).post(`/api/examenes/plantillas/${plantillaId}/archivar`).set(auth).send({ clientRequestId: archivoId }).expect(200);
    expect(archivoRepetido.body.repetida).toBe(true);
    const archivoYaArchivado = await request(app).post(`/api/examenes/plantillas/${plantillaId}/archivar`).set(auth)
      .send({ clientRequestId: '6cbd7864-046f-4a61-86c1-2800ff750aac' }).expect(200);
    expect(archivoYaArchivado.body.repetida).toBe(false);
    expect(archivoYaArchivado.body.plantilla.archivadoEn).toBeTruthy();

    const auditoria = await request(app).get(`/api/examenes/plantillas/${plantillaId}/auditoria?limite=2`).set(auth).expect(200);
    expect(auditoria.body.eventos.map((evento: { accion: string }) => evento.accion)).toEqual(['archivar', 'archivar']);
    expect(auditoria.body.nextCursor).toBeTruthy();
    const siguiente = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/auditoria?limite=2&cursor=${encodeURIComponent(auditoria.body.nextCursor)}`)
      .set(auth)
      .expect(200);
    expect(siguiente.body.eventos.map((evento: { accion: string }) => evento.accion)).toEqual(['actualizar', 'crear']);
    const cursorInvalido = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/auditoria?cursor=not-json`)
      .set(auth)
      .expect(400);
    expect(cursorInvalido.body.error.codigo).toBe('PLANTILLA_AUDITORIA_CURSOR_INVALIDO');

    const eliminada = await request(app).post(`/api/examenes/plantillas/${plantillaId}/eliminar`).set(auth)
      .send({ clientRequestId: '0cc29ec7-ff1e-49bc-b507-c6f112f01024' }).expect(409);
    expect(eliminada.body.error.codigo).toBe('PLANTILLA_ARCHIVADA');

    const eliminable = await request(app).post('/api/examenes/plantillas').set(auth).send({
      clientRequestId: 'da42e23a-e4d9-4682-862b-dcd1d4e88e3a',
      periodoId, tipo: 'parcial', titulo: 'Plantilla para borrar', numeroPaginas: 1, preguntasIds
    }).expect(201);
    const eliminableId = eliminable.body.plantilla._id as string;
    const borrado = await request(app).post(`/api/examenes/plantillas/${eliminableId}/eliminar`).set(auth)
      .send({ clientRequestId: '39bf8c12-617a-4481-968f-61d62f65bcdb' }).expect(200);
    const borradoRepetido = await request(app).post(`/api/examenes/plantillas/${eliminableId}/eliminar`).set(auth)
      .send({ clientRequestId: '39bf8c12-617a-4481-968f-61d62f65bcdb' }).expect(200);
    expect(borrado.body.eliminados).toEqual(borradoRepetido.body.eliminados);
    expect(borradoRepetido.body.repetida).toBe(true);
    expect(await prisma.papeleraItem.count({ where: { docenteId: creada.body.plantilla.docenteId, itemId: eliminableId } })).toBe(1);
    const auditoriaBorrado = await request(app).get(`/api/examenes/plantillas/${eliminableId}/auditoria`).set(auth).expect(200);
    expect(auditoriaBorrado.body.eventos.map((evento: { accion: string }) => evento.accion)).toEqual(['eliminar', 'crear']);
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('permite archivar una plantilla con examenes generados', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo 2025',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntasIds = await crearPreguntas({ auth, periodoId, total: TOTAL_PREGUNTAS_TEST });

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial 1',
        numeroPaginas: 1,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);
    const clientRequestId = '1c375f3a-64f0-4a4f-b67b-e709888d76f3';
    const [primeraGeneracion, reintentoConcurrente] = await Promise.all([
      request(app).post('/api/examenes/generados').set(auth).send({ plantillaId, clientRequestId }).expect(201),
      request(app).post('/api/examenes/generados').set(auth).send({ plantillaId, clientRequestId }).expect(201)
    ]);
    expect(primeraGeneracion.body.examenGenerado._id).toBe(clientRequestId);
    expect(reintentoConcurrente.body.examenGenerado._id).toBe(clientRequestId);
    expect(await ExamenGenerado.countDocuments({ id: clientRequestId })).toBe(1);

    const otraPlantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Parcial alterno', numeroPaginas: 1, preguntasIds })
      .expect(201);
    await request(app)
      .post('/api/examenes/generados')
      .set(auth)
      .send({ plantillaId: otraPlantillaResp.body.plantilla._id, clientRequestId })
      .expect(409);

    const tokenAjeno = await registrarDocente('docente-ajeno@prueba.test');
    await request(app)
      .post('/api/examenes/generados')
      .set({ Authorization: `Bearer ${tokenAjeno}` })
      .send({ plantillaId, clientRequestId })
      .expect(409);

    const archivarResp = await request(app).post(`/api/examenes/plantillas/${plantillaId}/archivar`).set(auth).expect(200);
    expect(archivarResp.body?.plantilla?.archivadoEn).toBeTruthy();
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('invalida cache de preview pdf cuando cambia una pregunta del banco', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Periodo 2025',
        fechaInicio: '2025-01-01',
        fechaFin: '2025-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    const preguntasIds = await crearPreguntas({ auth, periodoId, total: TOTAL_PREGUNTAS_TEST });

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Parcial cache preview',
        numeroPaginas: 1,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    const previewAntes = await descargarPreviewPdf(auth, plantillaId);

    const pregunta = await BancoPregunta.findById(preguntasIds[0]);
    expect(pregunta).toBeTruthy();
    
    // Usar prisma directamente para actualizar las versiones de la pregunta
    const { prisma } = await import('../../src/infraestructura/baseDatos/sqlite.js');
    await prisma.bancoPregunta.update({
      where: { id: preguntasIds[0] },
      data: {
        versionActual: 2,
        versiones: {
          create: {
            numeroVersion: 2,
            enunciado: 'Pregunta 1 actualizada para invalidar preview',
            opciones: {
              create: [
                { texto: 'Opcion A', esCorrecta: true },
                { texto: 'Opcion B', esCorrecta: false },
                { texto: 'Opcion C', esCorrecta: false },
                { texto: 'Opcion D', esCorrecta: false },
                { texto: 'Opcion E', esCorrecta: false }
              ]
            }
          }
        }
      }
    });

    const previewDespues = await descargarPreviewPdf(auth, plantillaId);

    expect(String(previewAntes.headers['content-disposition'] || '')).not.toBe(String(previewDespues.headers['content-disposition'] || ''));
    expect(Buffer.compare(previewAntes.body as Buffer, previewDespues.body as Buffer)).not.toBe(0);
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('permite generar en lote despues de previsualizar una plantilla limitada por objetivo', async () => {
    const token = await registrarDocente();
    const auth = { Authorization: `Bearer ${token}` };

    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({
        nombre: 'Inteligencia de Negocios',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-06-01',
        grupos: ['A']
      })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    await request(app)
      .post('/api/alumnos')
      .set(auth)
      .send({
        periodoId,
        matricula: 'CUH512410199',
        nombreCompleto: 'Alumno Lote Preview',
        correo: 'alumno-lote-preview@prueba.test',
        grupo: 'A'
      })
      .expect(201);

    const preguntasIds = await crearPreguntas({ auth, periodoId, total: 8, tema: 'Segundo Parcial' });
    const { prisma } = await import('../../src/infraestructura/baseDatos/sqlite.js');
    for (const [indice, preguntaId] of preguntasIds.entries()) {
      await prisma.bancoPregunta.update({
        where: { id: preguntaId },
        data: { updatedAt: new Date(Date.UTC(2026, 0, indice + 1)) }
      });
    }

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({
        periodoId,
        tipo: 'parcial',
        titulo: 'Segundo Parcial',
        numeroPaginas: 1,
        reactivosObjetivo: 1,
        temas: ['Segundo Parcial']
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const lote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId: 'LOT_PREVIEW_01' });
    expect(lote.status, JSON.stringify(lote.body)).toBe(201);

    expect(lote.body?.loteId).toBe('LOT_PREVIEW_01');
    expect(lote.body?.examenesGenerados).toHaveLength(1);
    const examenGuardado = await prisma.examenGenerado.findFirst({
      where: { loteId: 'LOT_PREVIEW_01' },
      select: { mapaOmr: true }
    });
    const mapaOmr = JSON.parse(String(examenGuardado?.mapaOmr ?? '{}'));
    expect(mapaOmr.paginas?.[0]?.marcasPagina?.orientacion).toEqual({
      esquina: 'tl',
      tipo: 'centro_vacio',
      radio: expect.any(Number)
    });
  }, TEST_TIMEOUT_PLANTILLAS_MS);
});
