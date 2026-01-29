import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from './utils/mongo';

describe('rate limit', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('responde 429 al exceder el limite', async () => {
    const anterior = {
      RATE_LIMIT_LIMIT: process.env.RATE_LIMIT_LIMIT,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS
    };

    process.env.RATE_LIMIT_LIMIT = '2';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    vi.resetModules();
    const { crearApp } = await import('../src/app');
    const app = crearApp();

    await limpiarMongoTest();

    const payload = { nombreCompleto: 'Docente Test', correo: 'docente@prueba.test', contrasena: 'Secreto123!' };

    await request(app).post('/api/autenticacion/registrar').send(payload).expect(201);
    await request(app)
      .post('/api/autenticacion/registrar')
      .send({ ...payload, correo: 'docente2@prueba.test' })
      .expect(201);
    const respuesta = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ ...payload, correo: 'docente3@prueba.test' })
      .expect(429);

    expect(respuesta.headers['retry-after']).toBeTruthy();

    process.env.RATE_LIMIT_LIMIT = anterior.RATE_LIMIT_LIMIT;
    process.env.RATE_LIMIT_WINDOW_MS = anterior.RATE_LIMIT_WINDOW_MS;
    vi.resetModules();
  });
});
