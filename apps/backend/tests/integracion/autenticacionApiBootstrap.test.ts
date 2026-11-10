/** Regression: API-local authorization bootstrap must not require an existing bearer. */
import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('bootstrap de clientes API locales', () => {
  const app = crearApp();

  beforeAll(async () => { await conectarSqliteTest(); });
  beforeEach(async () => { await limpiarSqliteTest(); });
  afterAll(async () => { await cerrarSqliteTest(); });

  it('valida la solicitud de autorización sin sesión bearer previa', async () => {
    const response = await request(app)
      .post('/api/autenticacion/api-clientes/solicitudes')
      .send({})
      .expect(400);

    expect(response.body.error?.mensaje).not.toBe('Token requerido');
  });

  it('valida el intercambio PKCE sin sesión bearer previa', async () => {
    const response = await request(app)
      .post('/api/autenticacion/api-clientes/solicitudes/intercambiar')
      .send({})
      .expect(400);

    expect(response.body.error?.mensaje).not.toBe('Token requerido');
  });

  it('completa solicitud anónima, consentimiento docente, intercambio y refresh delegado', async () => {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const permisos = ['examenes:leer', 'omr:analizar', 'calificaciones:calificar'];

    const solicitud = await request(app)
      .post('/api/autenticacion/api-clientes/solicitudes')
      .send({ codeChallenge, nombreCliente: 'EvaluaPro API CLI', permisos })
      .expect(201);

    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente API', correo: 'docente-api-delegado@prueba.test', contrasena: 'Secreto123!' })
      .expect(201);
    const auth = { Authorization: `Bearer ${registro.body.token as string}` };

    await request(app)
      .post('/api/autenticacion/api-clientes/solicitudes/inspeccionar')
      .set(auth)
      .send({ codigo: solicitud.body.codigo })
      .expect(200);
    const aprobacion = await request(app)
      .post('/api/autenticacion/api-clientes/solicitudes/resolver')
      .set(auth)
      .send({ codigo: solicitud.body.codigo, permitir: true, permisos })
      .expect(200);
    expect(aprobacion.body).not.toHaveProperty('refreshToken');

    const intercambio = await request(app)
      .post('/api/autenticacion/api-clientes/solicitudes/intercambiar')
      .send({ solicitudId: solicitud.body.solicitudId, codeVerifier })
      .expect(200);
    expect(intercambio.body.refreshToken).toMatch(/^epr_/);
    expect(intercambio.body.credencialId).toBe(aprobacion.body.credencialId);

    const refresh = await request(app)
      .post('/api/autenticacion/api-clientes/refrescar')
      .send({ refreshToken: intercambio.body.refreshToken })
      .expect(200);
    expect(refresh.body.token).toBeTruthy();
    expect(refresh.body.permisos).toEqual(permisos);

    await request(app)
      .get('/api/preflight')
      .set({ Authorization: `Bearer ${refresh.body.token}` })
      .expect(200);
    await request(app)
      .get('/api/autenticacion/credenciales')
      .set({ Authorization: `Bearer ${refresh.body.token}` })
      .expect(403);

    const listado = await request(app)
      .get('/api/autenticacion/api-clientes/credenciales')
      .set(auth)
      .expect(200);
    expect(JSON.stringify(listado.body)).not.toContain('refreshToken');
  });
});
