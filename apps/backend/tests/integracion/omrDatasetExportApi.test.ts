import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('API exportación de dataset OMR', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarSqliteTest(); });
  beforeEach(async () => { await limpiarSqliteTest(); });
  afterAll(async () => { await cerrarSqliteTest(); });

  async function registrar(correo: string) {
    const response = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente QA', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return { Authorization: `Bearer ${response.body.token as string}` };
  }

  async function crearJob(docenteId: string) {
    return await prisma.omrScanJob.create({
      data: {
        id: 'job-dataset-test', docenteId, estado: 'completed', totalHojas: 0, procesadas: 0,
        metadata: JSON.stringify({ version: 1, status: 'completed', assessmentId: 'assessment-not-present', files: [], pages: [], packages: [] })
      }
    });
  }

  it('requiere sesión, aislamiento de docente, confirmación de identificables y páginas únicas', async () => {
    const owner = await registrar('dataset-owner@prueba.test');
    const other = await registrar('dataset-other@prueba.test');
    const docente = await prisma.docente.findUniqueOrThrow({ where: { correo: 'dataset-owner@prueba.test' } });
    const job = await crearJob(docente.id);

    await request(app).post('/api/omr/ingestas/job-dataset-test/dataset-export').send({
      pageIndexes: [1], confirmarDatosIdentificables: true
    }).expect(401);
    await request(app).post('/api/omr/ingestas/job-dataset-test/dataset-export').set(other).send({
      pageIndexes: [1], confirmarDatosIdentificables: true
    }).expect(404);
    await request(app).post('/api/omr/ingestas/job-dataset-test/dataset-export').set(owner).send({ pageIndexes: [1] }).expect(400);
    await request(app).post('/api/omr/ingestas/job-dataset-test/dataset-export').set(owner).send({
      pageIndexes: [1, 1], confirmarDatosIdentificables: true
    }).expect(400);
    const sinPagina = await request(app).post('/api/omr/ingestas/job-dataset-test/dataset-export').set(owner).send({
      pageIndexes: [1], confirmarDatosIdentificables: true
    }).expect(422);
    expect(sinPagina.body.error.codigo).toBe('OMR_DATASET_PAGINA_INVALIDA');
    expect(await prisma.omrScanJob.count()).toBe(1);
    expect((await prisma.omrScanJob.findUniqueOrThrow({ where: { id: job.id } })).metadata).toBe(job.metadata);
  });
});
