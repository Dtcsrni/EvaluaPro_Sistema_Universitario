import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from './utils/sqliteTestDatabase.js';

describe('preflight API docente', () => {
  const app = crearApp();

  beforeAll(async () => conectarSqliteTest());
  beforeEach(async () => limpiarSqliteTest());
  afterAll(async () => cerrarSqliteTest());

  it('exige sesion y no devuelve preflight a una petición anónima', async () => {
    const respuesta = await request(app).get('/api/preflight').expect(401);
    expect(respuesta.body.error?.codigo).toBe('NO_AUTORIZADO');
  });

  it('devuelve estado no sensible de sesión, versión, periodo, Classroom y lease', async () => {
    const correo = `preflight-${randomUUID()}@test.local`;
    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente Preflight', correo, contrasena: 'Secreto123!' })
      .expect(201);

    const respuesta = await request(app)
      .get('/api/preflight')
      .set('Authorization', `Bearer ${registro.body.token}`)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      protocol: 'v2',
      app: { name: 'evaluapro', version: expect.any(String) },
      session: {
        authenticated: true,
        roles: ['docente'],
        permissions: expect.arrayContaining(['calificaciones:calificar', 'classroom:pull'])
      },
      periods: { activeAvailable: false, activeCount: 0 },
      classroom: {
        linkedLocally: false,
        remoteConnectivity: 'not_checked'
      },
      writeLease: { configured: expect.any(Boolean), mode: expect.stringMatching(/not_configured|unknown/) }
    });
    expect(JSON.stringify(respuesta.body)).not.toContain(correo);
    expect(JSON.stringify(respuesta.body)).not.toContain(registro.body.token);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/refreshToken|accessToken|directorio|googleSub/i);
  });
});
