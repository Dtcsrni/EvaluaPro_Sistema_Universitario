import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo.js';

describe('ciclo de vida de temas de banco por API', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarMongoTest(); });
  beforeEach(async () => { await limpiarMongoTest(); });
  afterAll(async () => { await cerrarMongoTest(); });

  async function registrar(correo: string) {
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente Banco', correo, contrasena: 'Secreto123!' })
      .expect(201);
    return respuesta.body.token as string;
  }

  it('crea, lee, actualiza y archiva tema con aislamiento de docente', async () => {
    const token = await registrar('temas-owner@prueba.test');
    const auth = { Authorization: `Bearer ${token}` };
    const periodo = await request(app).post('/api/periodos').set(auth).send({
      nombre: 'Biología', fechaInicio: '2026-01-01', fechaFin: '2026-06-01', grupos: ['A']
    }).expect(201);
    const crearRequestId = 'ac6db1c8-429f-4c5b-9d5e-251f4e35b6aa';
    const actualizarRequestId = 'e08c3352-0e59-4a73-98a2-2c62f7393f76';
    const archivarRequestId = '7ca30196-60b0-4df2-9d11-26a74ebbc2e3';
    const payloadCrear = { periodoId: periodo.body.periodo._id, nombre: 'Genética', clientRequestId: crearRequestId };
    const creado = await request(app).post('/api/banco-preguntas/temas').set(auth).send(payloadCrear).expect(201);
    const temaId = String(creado.body.tema._id);
    await request(app).post('/api/banco-preguntas/temas').set(auth).send(payloadCrear).expect(201).expect(({ body }) => {
      expect(body.repetida).toBe(true);
      expect(body.tema.id).toBe(temaId);
    });
    await request(app).post('/api/banco-preguntas/temas').set(auth).send({ ...payloadCrear, nombre: 'Otro tema' }).expect(409);

    const detalle = await request(app).get(`/api/banco-preguntas/temas/${temaId}`).set(auth).expect(200);
    expect(detalle.body.tema.nombre).toBe('Genética');
    const payloadActualizar = { nombre: 'Genética molecular', clientRequestId: actualizarRequestId };
    const actualizado = await request(app).post(`/api/banco-preguntas/temas/${temaId}/actualizar`).set(auth).send(payloadActualizar).expect(200);
    expect(actualizado.body.tema.nombre).toBe('Genética molecular');
    await request(app).post(`/api/banco-preguntas/temas/${temaId}/actualizar`).set(auth).send(payloadActualizar).expect(200).expect(({ body }) => {
      expect(body.repetida).toBe(true);
    });
    const archivado = await request(app).post(`/api/banco-preguntas/temas/${temaId}/archivar`).set(auth).send({ clientRequestId: archivarRequestId }).expect(200);
    expect(archivado.body.tema.activo).toBe(false);
    await request(app).post(`/api/banco-preguntas/temas/${temaId}/archivar`).set(auth).send({ clientRequestId: archivarRequestId }).expect(200).expect(({ body }) => {
      expect(body.repetida).toBe(true);
    });
    const auditoriaPrimera = await request(app).get(`/api/banco-preguntas/temas/${temaId}/auditoria?limite=2`).set(auth).expect(200);
    expect(auditoriaPrimera.body.eventos).toHaveLength(2);
    expect(auditoriaPrimera.body.nextCursor).toEqual(expect.any(String));
    const auditoriaSegunda = await request(app)
      .get(`/api/banco-preguntas/temas/${temaId}/auditoria?limite=2&cursor=${encodeURIComponent(auditoriaPrimera.body.nextCursor)}`)
      .set(auth)
      .expect(200);
    expect([...auditoriaPrimera.body.eventos, ...auditoriaSegunda.body.eventos].map((evento: { accion: string }) => evento.accion).sort())
      .toEqual(['actualizar', 'archivar', 'crear']);
    expect(auditoriaSegunda.body.nextCursor).toBeNull();
    await request(app).get(`/api/banco-preguntas/temas/${temaId}/auditoria?cursor=e30`).set(auth).expect(400);

    const tokenAjeno = await registrar('temas-foreign@prueba.test');
    await request(app).get(`/api/banco-preguntas/temas/${temaId}`).set({ Authorization: `Bearer ${tokenAjeno}` }).expect(404);
  });
});
