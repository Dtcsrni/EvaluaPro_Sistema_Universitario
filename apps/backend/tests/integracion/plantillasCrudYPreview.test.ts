/**
 * plantillasCrudYPreview.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExamenGenerado } from '../../src/modulos/modulo_generacion_pdf/modeloExamenGenerado';
import { BancoPregunta } from '../../src/modulos/modulo_banco_preguntas/modeloBancoPregunta';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

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

  async function registrarDocente() {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);
    return respuesta.body.token as string;
  }

  async function crearPreguntas(params: { auth: { Authorization: string }; periodoId: string; total: number }) {
    const preguntasIds: string[] = [];
    for (let i = 0; i < params.total; i += 1) {
      const preguntaResp = await request(app)
        .post('/api/banco-preguntas')
        .set(params.auth)
        .send({
          periodoId: params.periodoId,
          enunciado: `Pregunta ${i + 1}`,
          opciones: [
            { texto: 'Opcion A', esCorrecta: true },
            { texto: 'Opcion B', esCorrecta: false },
            { texto: 'Opcion C', esCorrecta: false },
            { texto: 'Opcion D', esCorrecta: false },
            { texto: 'Opcion E', esCorrecta: false }
          ]
        })
        .expect(201);
      preguntasIds.push(preguntaResp.body.pregunta._id as string);
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

    const prev = await request(app)
      .get(`/api/examenes/plantillas/${plantillaId}/previsualizar`)
      .set(auth)
      .expect(200);
    expect(prev.body?.plantillaId).toBe(String(plantillaId));
    expect(Array.isArray(prev.body?.paginas)).toBe(true);
    expect(prev.body.paginas.length).toBeGreaterThan(0);

    const previewPdf = await descargarPreviewPdf(auth, plantillaId);
    expect(String(previewPdf.headers['content-type'] || '')).toContain('application/pdf');

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

    await request(app).post('/api/examenes/generados').set(auth).send({ plantillaId }).expect(201);

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
    const { prisma } = await import('../../src/infraestructura/baseDatos/sqlite');
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
});
