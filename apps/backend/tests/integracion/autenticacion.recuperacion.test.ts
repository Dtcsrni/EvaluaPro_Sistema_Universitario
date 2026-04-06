/**
 * autenticacion.recuperacion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

describe('autenticacion - recuperacion de contrasena', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('solicita recuperacion, restablece y permite login con nueva contrasena', async () => {
    await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Recuperacion',
        correo: 'docente.reset@local.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);

    const solicitud = await request(app)
      .post('/api/autenticacion/solicitar-recuperacion-contrasena')
      .send({ correo: 'docente.reset@local.test' })
      .expect(202);

    const token = String(solicitud.body?.debugToken || '');
    expect(token.length).toBeGreaterThanOrEqual(20);

    await request(app)
      .post('/api/autenticacion/restablecer-contrasena')
      .send({ token, contrasenaNueva: 'NuevaClave123!' })
      .expect(204);

    await request(app)
      .post('/api/autenticacion/ingresar')
      .send({ correo: 'docente.reset@local.test', contrasena: 'NuevaClave123!' })
      .expect(200);

    await request(app)
      .post('/api/autenticacion/restablecer-contrasena')
      .send({ token, contrasenaNueva: 'OtraClave123!' })
      .expect(400);
  });

  it('responde 202 aunque el correo no exista (no-enumerable)', async () => {
    await request(app)
      .post('/api/autenticacion/solicitar-recuperacion-contrasena')
      .send({ correo: 'no-existe@local.test' })
      .expect(202);
  });
});
