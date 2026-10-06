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
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

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
        numeroPaginas: 1,
        preguntasIds
      })
      .expect(201);
    const plantillaId = plantillaResp.body.plantilla._id as string;

    const editResp = await request(app)
      .post(`/api/examenes/plantillas/${plantillaId}`)
      .set(auth)
      .send({
        titulo: 'Parcial 1 (editado)',
        numeroPaginas: 1
      })
      .expect(200);
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
    expect(archivarResp.body?.plantilla?.archivadoEn).toBeTruthy();

    const listResp = await request(app).get('/api/examenes/plantillas').set(auth).expect(200);
    expect(listResp.body?.plantillas?.length ?? 0).toBe(0);
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
