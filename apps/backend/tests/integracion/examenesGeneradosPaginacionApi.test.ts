import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('paginación de exámenes generados por API', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => { await limpiarMongoTest(); });
  afterAll(async () => { await cerrarMongoTest(); });

  async function crearDocenteYPlantilla(correo: string) {
    const registro = await request(app).post('/api/autenticacion/registrar').send({
      nombreCompleto: 'Docente Paginación', correo, contrasena: 'Secreto123!'
    }).expect(201);
    const auth = { Authorization: 'Bearer ' + registro.body.token };
    const periodoRespuesta = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Periodo paginación', fechaInicio: '2026-01-01', fechaFin: '2026-06-01'
    }).expect(201);
    const periodoId = String(periodoRespuesta.body.periodo._id);
    const docente = await prisma.periodo.findUniqueOrThrow({ where: { id: periodoId }, select: { docenteId: true } });
    const plantilla = await prisma.examenPlantilla.create({
      data: {
        docenteId: docente.docenteId,
        periodoId,
        tipo: 'parcial',
        titulo: 'Plantilla paginación',
        tituloNormalizado: 'plantilla paginacion',
        bookletConfig: '{}',
        omrConfig: '{}',
        configuracionPdf: '{}'
      }
    });
    return { auth, docenteId: docente.docenteId, periodoId, plantillaId: plantilla.id };
  }

  async function crearExamenes(params: { docenteId: string; periodoId: string; plantillaId: string; prefijo: string; total: number }) {
    for (let index = 0; index < params.total; index += 1) {
      await prisma.examenGenerado.create({
        data: {
          docenteId: params.docenteId,
          periodoId: params.periodoId,
          plantillaId: params.plantillaId,
          folio: `${params.prefijo}-${String(index + 1).padStart(3, '0')}`,
          mapaVariante: JSON.stringify({ ordenPreguntas: [] }),
          ...(index === 0 ? {
            mapaOmr: JSON.stringify({ privateListCanary: 'OMR_DETAIL_SHOULD_NOT_BE_LISTED' }),
            answerKeySet: JSON.stringify({ privateListCanary: 'ANSWER_KEY_SHOULD_NOT_BE_LISTED' }),
            bookletArtifact: JSON.stringify({ path: '/private/artifact.pdf', privateListCanary: 'ARTIFACT_SHOULD_NOT_BE_LISTED' }),
            paginas: JSON.stringify([{ numero: 1, qrTexto: 'FOLIO-PAGE-METADATA' }])
          } : {}),
          generadoEn: new Date(Date.UTC(2026, 0, index + 1))
        }
      });
    }
  }

  it('recorre páginas estables, conserva filtros y valida límites/cursor', async () => {
    const owner = await crearDocenteYPlantilla('examenes-pagina-owner@prueba.test');
    await crearExamenes({ docenteId: owner.docenteId, periodoId: owner.periodoId, plantillaId: owner.plantillaId, prefijo: 'OWN', total: 5 });
    const otro = await crearDocenteYPlantilla('examenes-pagina-ajeno@prueba.test');
    await crearExamenes({ docenteId: otro.docenteId, periodoId: otro.periodoId, plantillaId: otro.plantillaId, prefijo: 'OTHER', total: 2 });

    const esperados = await prisma.examenGenerado.findMany({
      where: { docenteId: owner.docenteId, periodoId: owner.periodoId, archivadoEn: null },
      orderBy: [{ generadoEn: 'desc' }, { id: 'desc' }],
      select: { id: true }
    });
    const primera = await request(app)
      .get(`/api/examenes/generados?periodoId=${owner.periodoId}&limite=2`)
      .set(owner.auth)
      .expect(200);
    expect(primera.body.examenes.map((item: { _id: string }) => item._id)).toEqual(esperados.slice(0, 2).map((item) => item.id));
    expect(primera.body.nextCursor).toEqual(expect.any(String));

    const segunda = await request(app)
      .get(`/api/examenes/generados?periodoId=${owner.periodoId}&limite=2&cursor=${encodeURIComponent(primera.body.nextCursor)}`)
      .set(owner.auth)
      .expect(200);
    expect(segunda.body.examenes.map((item: { _id: string }) => item._id)).toEqual(esperados.slice(2, 4).map((item) => item.id));
    expect(segunda.body.nextCursor).toEqual(expect.any(String));

    const tercera = await request(app)
      .get(`/api/examenes/generados?periodoId=${owner.periodoId}&limite=2&cursor=${encodeURIComponent(segunda.body.nextCursor)}`)
      .set(owner.auth)
      .expect(200);
    expect(tercera.body.examenes.map((item: { _id: string }) => item._id)).toEqual(esperados.slice(4).map((item) => item.id));
    expect(tercera.body.nextCursor).toBeNull();

    await request(app).get('/api/examenes/generados?limite=201').set(owner.auth).expect(400);
    await request(app).get('/api/examenes/generados?archivado=maybe').set(owner.auth).expect(400);
    await request(app).get('/api/examenes/generados?cursor=e30').set(owner.auth).expect(400);
    const listaPropia = await request(app).get('/api/examenes/generados?limite=10').set(owner.auth).expect(200);
    expect(listaPropia.body.examenes).toHaveLength(5);
    expect(JSON.stringify(listaPropia.body)).not.toContain('OTHER-');
    const resumenConMetadatos = listaPropia.body.examenes.find((item: { folio: string }) => item.folio === 'OWN-001');
    expect(resumenConMetadatos.paginas).toEqual([{ numero: 1, qrTexto: 'FOLIO-PAGE-METADATA' }]);
    expect(JSON.stringify(listaPropia.body)).not.toContain('OMR_DETAIL_SHOULD_NOT_BE_LISTED');
    expect(JSON.stringify(listaPropia.body)).not.toContain('ANSWER_KEY_SHOULD_NOT_BE_LISTED');
    expect(JSON.stringify(listaPropia.body)).not.toContain('ARTIFACT_SHOULD_NOT_BE_LISTED');
    const listaAjena = await request(app).get('/api/examenes/generados?limite=10').set(otro.auth).expect(200);
    expect(listaAjena.body.examenes).toHaveLength(2);
    expect(JSON.stringify(listaAjena.body)).not.toContain('OWN-');
  });
});
