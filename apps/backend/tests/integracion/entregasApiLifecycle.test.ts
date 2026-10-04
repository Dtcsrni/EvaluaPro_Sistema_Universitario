import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { prisma } from '../../src/infraestructura/baseDatos/sqlite.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';
import { prepararEscenarioFlujo, registrarDocente } from './_flujoDocenteHelper.js';

describe('ciclo de consulta API de entregas', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => { await limpiarMongoTest(); });
  afterAll(async () => { await cerrarMongoTest(); });

  it('filtra, pagina y consulta entregas propias sin exponer correo del alumno', async () => {
    const escenario = await prepararEscenarioFlujo(app, 'parcial', 'entregas-owner@prueba.test');
    const examen = await prisma.examenGenerado.findUniqueOrThrow({
      where: { id: escenario.examenId }, select: { docenteId: true }
    });
    await prisma.entrega.createMany({ data: [0, 1].map(() => ({
      examenGeneradoId: escenario.examenId,
      alumnoId: escenario.alumnoId,
      docenteId: examen.docenteId,
      estado: 'pendiente'
    })) });

    const primera = await request(app).get(`/api/entregas?periodoId=${escenario.periodoId}&limite=1`).set(escenario.auth).expect(200);
    expect(primera.body.entregas).toHaveLength(1);
    expect(primera.body.nextCursor).toEqual(expect.any(String));
    expect(JSON.stringify(primera.body)).not.toContain('alumno-parcial@prueba.test');

    const query = new URLSearchParams({ periodoId: escenario.periodoId, limite: '1', cursor: primera.body.nextCursor });
    const segunda = await request(app).get(`/api/entregas?${query}`).set(escenario.auth).expect(200);
    expect(segunda.body.entregas).toHaveLength(1);
    expect(segunda.body.entregas[0].id).not.toBe(primera.body.entregas[0].id);

    const detalle = await request(app).get(`/api/entregas/${primera.body.entregas[0].id}`).set(escenario.auth).expect(200);
    expect(detalle.body.entrega.id).toBe(primera.body.entregas[0].id);
    expect(detalle.body.entrega.alumno).not.toHaveProperty('correo');

    const tokenAjeno = await registrarDocente(app, 'entregas-foreign@prueba.test');
    const authAjeno = { Authorization: `Bearer ${tokenAjeno}` };
    const listaAjena = await request(app).get('/api/entregas').set(authAjeno).expect(200);
    expect(listaAjena.body.entregas).toEqual([]);
    await request(app).get(`/api/entregas/${primera.body.entregas[0].id}`).set(authAjeno).expect(404);
    await request(app).get('/api/entregas?cursor=not-a-cursor').set(escenario.auth).expect(400);
    await request(app).get('/api/entregas?limite=101').set(escenario.auth).expect(400);
  });
});
