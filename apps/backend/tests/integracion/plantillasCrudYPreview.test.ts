/**
 * plantillasCrudYPreview.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamenGenerado } from '../../src/modulos/modulo_generacion_pdf/modeloExamenGenerado.js';
import { BancoPregunta } from '../../src/modulos/modulo_banco_preguntas/modeloBancoPregunta.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';
import * as servicioGeneracionPdf from '../../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';

describe('plantillas CRUD + previsualizacion', () => {
  const app = crearApp();
  const TOTAL_PREGUNTAS_TEST = 8;
  const TEST_TIMEOUT_PLANTILLAS_MS = 90_000;
  const preguntasFixture = [
    { enunciado: '¿Qué medida se obtiene al sumar todos los datos y dividirlos entre la cantidad de observaciones?', opciones: ['Media aritmética', 'Mediana', 'Moda', 'Rango', 'Varianza'] },
    { enunciado: 'En una lista ordenada con cantidad impar de datos, ¿qué valor corresponde a la mediana?', opciones: ['El valor central', 'La suma de los datos', 'El valor más frecuente', 'La diferencia entre extremos', 'El promedio de los extremos'] },
    { enunciado: '¿Qué representa la moda de un conjunto de mediciones?', opciones: ['El valor que más se repite', 'El valor central', 'La suma de los datos', 'La diferencia entre extremos', 'La raíz de la varianza'] },
    { enunciado: '¿Cómo se calcula el rango de un conjunto de datos?', opciones: ['Restando el mínimo al máximo', 'Sumando todos los datos', 'Dividiendo la suma entre la cantidad', 'Contando el valor más frecuente', 'Eligiendo el valor central'] },
    { enunciado: 'De 24 observaciones, 6 pertenecen a la misma categoría. ¿Qué porcentaje representan?', opciones: ['25%', '6%', '18%', '40%', '75%'] },
    { enunciado: '¿Cuál es la mediana del conjunto ordenado 2, 5, 7, 9, 12?', opciones: ['7', '5', '9', '12', '2'] },
    { enunciado: 'Si la media de cinco datos es 8, ¿cuál es la suma de esos datos?', opciones: ['40', '13', '8', '5', '3'] },
    { enunciado: '¿Qué tipo de gráfica permite comparar frecuencias entre categorías discretas?', opciones: ['Gráfica de barras', 'Histograma continuo', 'Diagrama de dispersión', 'Diagrama de caja', 'Curva acumulada'] }
  ];

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
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
        const pregunta = preguntasFixture[index % preguntasFixture.length]!;
        return {
          externalKey: `plantilla-${params.periodoId}-${numero}`,
          itemId: null,
          expectedVersion: null,
          format: 'omr.mcq5',
          stem: { format: 'richtext', value: pregunta.enunciado },
          options: pregunta.opciones.map((value, optionIndex) => ({
            key: String.fromCharCode(65 + optionIndex),
            value,
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
        numeroPaginas: 2,
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
        numeroPaginas: 2
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
      .send({ periodoId, tipo: 'parcial', titulo: 'Alta fallida', numeroPaginas: 2, preguntasIds: [preguntaInexistente] })
      .expect(500);
    expect(await prisma.examenPlantilla.count({ where: { titulo: 'Alta fallida' } })).toBe(0);

    const creada = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Plantilla inicial', numeroPaginas: 2, preguntasIds })
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
      periodoId, tipo: 'parcial', titulo: 'Plantilla idempotente', numeroPaginas: 2, preguntasIds
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
      periodoId, tipo: 'parcial', titulo: 'Plantilla para borrar', numeroPaginas: 2, preguntasIds
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
        numeroPaginas: 2,
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
      .send({ periodoId, tipo: 'parcial', titulo: 'Parcial alterno', numeroPaginas: 2, preguntasIds })
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
        numeroPaginas: 2,
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
            enunciado: '¿Qué medida estadística se obtiene al sumar los datos y dividir entre su cantidad?',
            opciones: {
              create: [
                { texto: 'Media aritmética', esCorrecta: true },
                { texto: 'Mediana', esCorrecta: false },
                { texto: 'Moda', esCorrecta: false },
                { texto: 'Rango', esCorrecta: false },
                { texto: 'Varianza', esCorrecta: false }
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

  it('usa el objetivo como orientación y conserva el mapa exacto de todos los reactivos que caben', async () => {
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
        numeroPaginas: 2,
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
      select: { mapaOmr: true, mapaVariante: true, questionMap: true }
    });
    const mapaOmr = JSON.parse(String(examenGuardado?.mapaOmr ?? '{}'));
    const mapaVariante = JSON.parse(String(examenGuardado?.mapaVariante ?? '{}'));
    const questionMap = JSON.parse(String(examenGuardado?.questionMap ?? '{}'));
    expect(mapaVariante.ordenPreguntas).toHaveLength(8);
    expect(Object.keys(questionMap)).toHaveLength(8);
    expect(mapaOmr.paginas?.[0]?.marcasPagina?.orientacion).toEqual({
      esquina: 'tl',
      tipo: 'centro_vacio',
      radio: expect.any(Number)
    });
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('ajusta conteos por alumno con semilla estable y reanuda el mismo mapa de lote', async () => {
    const correoDocente = 'capacidad-variable@prueba.test';
    const token = await registrarDocente(correoDocente);
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Prueba capacidad', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;
    const docente = await prisma.docente.findUniqueOrThrow({ where: { correo: correoDocente }, select: { id: true } });
    const alumnoIds = Array.from({ length: 8 }, (_, indice) => `00000000-0000-4000-8000-${String(indice + 11).padStart(12, '0')}`);
    for (const [indice, id] of alumnoIds.entries()) {
      await prisma.alumno.create({
        data: {
          id,
          periodoId,
          matricula: `CUH5124104${String(indice + 1).padStart(2, '0')}`,
          nombreCompleto: `Alumno capacidad ${indice + 1}`,
          correo: `capacidad-${indice + 1}@prueba.test`,
          grupo: 'A',
          ordenLista: indice + 1
        }
      });
    }

    for (let indice = 0; indice < 64; indice += 1) {
      const tema = indice % 4 + 1;
      const largo = tema >= 3 ? 350 + ((indice * 23) % 220) : 100 + ((indice * 17) % 56);
      const enunciado = `Reactivo ${indice + 1}. ${'Analiza la evidencia y selecciona la interpretación que corresponda. '.repeat(12)}`.slice(0, largo);
      await prisma.bancoPregunta.create({
        data: {
          id: `10000000-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
          docenteId: docente.id,
          periodoId,
          tema: `Tema ${tema}`,
          versiones: {
            create: {
              numeroVersion: 1,
              enunciado,
              opciones: {
                create: ['Opción uno', 'Opción dos', 'Opción tres', 'Opción cuatro', 'Opción cinco'].map((texto, opcion) => ({
                  texto: `${texto} ${indice + 1}`,
                  esCorrecta: opcion === indice % 5
                }))
              }
            }
          }
        }
      });
    }

    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Capacidad por alumno', numeroPaginas: 2, reactivosObjetivo: 1, temas: ['Tema 1', 'Tema 2', 'Tema 3', 'Tema 4'] })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;
    const preview = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar`)
      .set(auth)
      .expect(200);
    expect(preview.body.layoutConfirmado).toBe(true);
    expect(preview.body.totalDisponibles).toBe(64);
    expect(preview.body.totalUsados).toBeGreaterThan(0);
    expect(preview.body.totalUsados).toBeLessThan(64);

    const loteId = 'LOT_VAR_CAP_01';
    const lote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId, variantPolicy: 'shared' })
      .expect(201);
    expect(lote.body.variantPolicy).toBe('shared');
    const examenes = await prisma.examenGenerado.findMany({
      where: { loteId },
      orderBy: { alumno: { ordenLista: 'asc' } },
      select: { id: true, mapaVariante: true, mapaOmr: true, questionMap: true }
    });
    const conteos = examenes.map((examen) => JSON.parse(String(examen.mapaVariante)).ordenPreguntas.length);
    expect(conteos).toHaveLength(alumnoIds.length);
    expect(new Set(conteos).size).toBeGreaterThan(1);
    const mapasCompartidos = examenes.map((examen) => JSON.parse(String(examen.mapaVariante)) as {
      ordenPreguntas: string[];
      ordenOpcionesPorPregunta: Record<string, number[]>;
    });
    for (const idPregunta of new Set(mapasCompartidos.flatMap((mapa) => mapa.ordenPreguntas))) {
      const ordenesCompartidos = mapasCompartidos
        .map((mapa) => mapa.ordenOpcionesPorPregunta[idPregunta])
        .filter((orden): orden is number[] => Array.isArray(orden));
      expect(new Set(ordenesCompartidos.map((orden) => orden.join(','))).size).toBeLessThanOrEqual(1);
    }
    for (const examen of examenes) {
      const mapaVariante = JSON.parse(String(examen.mapaVariante));
      const questionMap = JSON.parse(String(examen.questionMap));
      const mapaOmr = JSON.parse(String(examen.mapaOmr));
      expect(new Set(mapaVariante.ordenPreguntas).size).toBe(mapaVariante.ordenPreguntas.length);
      expect(Object.keys(questionMap)).toHaveLength(mapaVariante.ordenPreguntas.length);
      expect(mapaOmr.paginas).toHaveLength(2);
      expect(mapaOmr.paginas.every((pagina: { preguntas: unknown[] }) => pagina.preguntas.length > 0)).toBe(true);
    }

    const reintento = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId, variantPolicy: 'shared' })
      .expect(201);
    expect(reintento.body.examenesGenerados.map((examen: { _id: string }) => examen._id))
      .toEqual(lote.body.examenesGenerados.map((examen: { _id: string }) => examen._id));
    const mapasTrasReintento = await prisma.examenGenerado.findMany({
      where: { loteId },
      orderBy: { alumno: { ordenLista: 'asc' } },
      select: { mapaVariante: true }
    });
    expect(mapasTrasReintento.map((examen) => examen.mapaVariante)).toEqual(examenes.map((examen) => examen.mapaVariante));
    expect(await prisma.examenGenerado.count({ where: { loteId } })).toBe(alumnoIds.length);
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('prevalida todas las variantes antes de persistir el primer examen y señala al alumno que falla', async () => {
    const token = await registrarDocente('preflight-lote@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Materia Preflight', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', grupos: ['A'] })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    for (const [indice, nombreCompleto] of ['Ana Preflight', 'Luis Preflight'].entries()) {
      await request(app)
        .post('/api/alumnos')
        .set(auth)
        .send({ periodoId, matricula: `CUH51241020${indice}`, nombreCompleto, correo: `preflight-${indice}@prueba.test`, grupo: 'A' })
        .expect(201);
    }

    const preguntasIds = await crearPreguntas({ auth, periodoId, total: 8, tema: 'Tema Preflight' });
    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Plantilla Preflight', numeroPaginas: 2, reactivosObjetivo: 1, preguntasIds })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;
    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const renderOriginal = servicioGeneracionPdf.generarPdfExamen;
    const renderSpy = vi.spyOn(servicioGeneracionPdf, 'generarPdfExamen');
    renderSpy
      .mockImplementationOnce(renderOriginal)
      .mockImplementationOnce(async () => {
        throw Object.assign(new Error('El PDF individual tiene 3 páginas; el máximo configurado es 2.'), {
          code: 'LOTE_CANTIDAD_PAGINAS_INVALIDA',
          detalles: { paginasEncontradas: 3, paginasMaximas: 2 }
        });
      });

    let respuestaLote;
    try {
      respuestaLote = await request(app)
        .post('/api/examenes/generados/lote')
        .set(auth)
        .send({ plantillaId, loteId: 'LOT_PREFLIGHT_01' });
    } finally {
      renderSpy.mockRestore();
    }

    expect(respuestaLote.status).toBe(409);
    expect(respuestaLote.body.error).toMatchObject({
      codigo: 'LOTE_CANTIDAD_PAGINAS_INVALIDA',
      detalles: { etapa: 'prevalidacion', alumnoId: expect.any(String), paginasEncontradas: 3, paginasMaximas: 2 }
    });
    expect(respuestaLote.body.error.mensaje).toMatch(/No se pudo validar el examen de .*Ana Preflight|No se pudo validar el examen de .*Luis Preflight/);
    expect(await prisma.examenGenerado.count({ where: { loteId: 'LOT_PREFLIGHT_01' } })).toBe(0);
  }, TEST_TIMEOUT_PLANTILLAS_MS);

  it('genera por defecto un lote único de toda la materia y limita cuando se indica un grupo', async () => {
    const token = await registrarDocente('grupos-lote@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const periodoResp = await request(app)
      .post('/api/periodos')
      .set(auth)
      .send({ nombre: 'Materia con grupos', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', grupos: ['A', 'B'] })
      .expect(201);
    const periodoId = periodoResp.body.periodo._id as string;

    for (const indice of Array.from({ length: 14 }, (_, index) => 13 - index)) {
      const grupo = indice < 10 ? 'A' : 'B';
      const matricula = `CUH${String(512410300 + indice + 1).padStart(9, '0')}`;
      await request(app)
        .post('/api/alumnos')
        .set(auth)
        .send({ periodoId, matricula, nombreCompleto: `Alumno ${indice + 1} Grupo ${grupo}`, grupo, correo: `${matricula}@prueba.test` })
        .expect(201);
    }

    const preguntasIds = await crearPreguntas({ auth, periodoId, total: TOTAL_PREGUNTAS_TEST, tema: 'Tema multigrupo' });
    const plantillaResp = await request(app)
      .post('/api/examenes/plantillas')
      .set(auth)
      .send({ periodoId, tipo: 'parcial', titulo: 'Primer Parcial', numeroPaginas: 2, reactivosObjetivo: 1, preguntasIds })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;
    await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar/pdf/visual`)
      .set(auth)
      .expect(200);

    const loteId = 'LOT_MATERIA_01';
    const respuestaMateria = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId })
      .expect(201);
    expect(respuestaMateria.body.totalAlumnos).toBe(14);
    const examenesMateria = await prisma.examenGenerado.findMany({ where: { loteId }, select: { id: true, alumnoId: true } });
    expect(examenesMateria).toHaveLength(14);
    const alumnosMateria = await prisma.alumno.findMany({ where: { periodoId }, select: { id: true }, orderBy: [{ ordenLista: 'asc' }, { id: 'asc' }] });
    const alumnoPorExamenEnOrden = respuestaMateria.body.examenesGenerados.map((examen: { _id: string }) =>
      examenesMateria.find((persistido) => persistido.id === examen._id)?.alumnoId);
    expect(alumnoPorExamenEnOrden).toEqual(alumnosMateria.map((alumno) => alumno.id));
    expect((await prisma.alumno.findMany({ where: { periodoId }, orderBy: [{ ordenLista: 'asc' }, { id: 'asc' }] })).map((alumno) => alumno.ordenLista))
      .toEqual(Array.from({ length: 14 }, (_value, index) => index + 1));
    const descargaMateria = await request(app)
      .get(`/api/examenes/generados/lote/${loteId}/pdf`)
      .set(auth)
      .expect(200);
    expect(descargaMateria.headers['content-disposition']).toContain('grupos-A_B');

    await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId: 'BAD_GRP_01', grupo: 'C' })
      .expect(400)
      .expect((response) => expect(response.body.error.codigo).toBe('GRUPO_NO_VALIDO'));
    expect(await prisma.examenGenerado.count({ where: { loteId: 'BAD_GRP_01' } })).toBe(0);

    await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId, grupo: 'A' })
      .expect(409)
      .expect((response) => expect(response.body.error.codigo).toBe('LOTE_REANUDACION_INCOMPATIBLE'));
    expect(await prisma.examenGenerado.count({ where: { loteId } })).toBe(14);

    const estudiantesB = await prisma.alumno.findMany({ where: { periodoId, grupo: 'B' }, select: { id: true } });
    const loteGrupoId = 'LOT_GRUPO_B01';
    const respuestaLote = await request(app)
      .post('/api/examenes/generados/lote')
      .set(auth)
      .send({ plantillaId, loteId: loteGrupoId, grupo: 'B' })
      .expect(201);
    expect(respuestaLote.body.totalAlumnos).toBe(4);
    const examenesLoteGrupo = await prisma.examenGenerado.findMany({ where: { loteId: loteGrupoId }, select: { alumnoId: true } });
    expect(examenesLoteGrupo.map((examen) => examen.alumnoId).sort()).toEqual(estudiantesB.map((alumno) => alumno.id).sort());
    const descargaGrupo = await request(app)
      .get(`/api/examenes/generados/lote/${loteGrupoId}/pdf`)
      .set(auth)
      .expect(200);
    expect(descargaGrupo.headers['content-disposition']).toContain('grupo-B');
  }, TEST_TIMEOUT_PLANTILLAS_MS);
});
