/**
 * autenticacion.googleOnly.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente.js';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

vi.mock('../../src/modulos/modulo_autenticacion/servicioGoogle', () => ({
  verificarCredencialGoogle: vi.fn(async () => ({
    correo: 'docente@prueba.test',
    sub: 'google-sub-only',
    nombreCompleto: 'Docente Google Only',
    imagenPerfil: 'https://lh3.googleusercontent.com/a/foto-docente'
  }))
}));

async function crearAppGoogleOnly() {
  vi.resetModules();
  process.env.REQUIRE_GOOGLE_OAUTH = '1';
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id-test';
  const mod = await import('../../src/app.js');
  return mod.crearApp();
}

describe('autenticacion google-only', () => {
  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterEach(() => {
    delete process.env.REQUIRE_GOOGLE_OAUTH;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  it('expone capacidades y bloquea flujos por contraseña', async () => {
    const app = await crearAppGoogleOnly();

    const capacidades = await request(app).get('/api/autenticacion/capacidades-integraciones').expect(200);
    expect(capacidades.body?.capacidadesIntegraciones).toMatchObject({
      requireGoogleOAuth: true,
      passwordLoginAllowed: false,
      oauthGoogleBackend: true,
      oauthGoogleDesktopBackend: true,
      googleOauthClientId: 'google-client-id-test',
      snapshotGoogleDisponible: true
    });

    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Password',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(403);
    expect(registro.body?.error?.codigo).toBe('GOOGLE_OAUTH_REQUIRED');
  });

  it('expone y protege el flujo OAuth Desktop con origen permitido y cuerpo estricto', async () => {
    const app = await crearAppGoogleOnly();
    const sinOrigen = await request(app)
      .post('/api/autenticacion/google-desktop/iniciar')
      .send({})
      .expect(403);
    expect(sinOrigen.body?.error?.codigo).toBe('ORIGEN_NO_AUTORIZADO');

    const origen = 'http://localhost:5173';
    const inicio = await request(app)
      .post('/api/autenticacion/google-desktop/iniciar')
      .set('Origin', origen)
      .send({ extra: true })
      .expect(400);
    expect(inicio.body?.error?.codigo).toBeTruthy();

    const flujo = await request(app)
      .post('/api/autenticacion/google-desktop/iniciar')
      .set('Origin', origen)
      .send({})
      .expect(201);
    expect(flujo.body?.flowId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(flujo.body?.url).toContain('accounts.google.com');

    const resultado = await request(app)
      .post('/api/autenticacion/google-desktop/resultado')
      .set('Origin', origen)
      .send({ flowId: flujo.body.flowId })
      .expect(200);
    expect(resultado.body).toEqual({ estado: 'pendiente' });

    await request(app)
      .post('/api/autenticacion/google-desktop/cancelar')
      .set('Origin', origen)
      .send({ flowId: flujo.body.flowId })
      .expect(200);
  });

  it('permite sondear OAuth Desktop sin agotar los límites globales o de credenciales', async () => {
    const keys = [
      'NODE_ENV',
      'JWT_SECRETO',
      'CORS_ORIGENES',
      'RATE_LIMIT_LIMIT',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_CREDENCIALES_LIMIT',
      'CLASSROOM_ENABLED',
      'EVALUAPRO_FLAVOR',
      'REQUIRE_GOOGLE_OAUTH',
      'GOOGLE_OAUTH_CLIENT_ID'
    ] as const;
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRETO = 'test-only-oauth-rate-limit-secret';
      process.env.CORS_ORIGENES = 'http://localhost:5173';
      process.env.RATE_LIMIT_LIMIT = '5';
      process.env.RATE_LIMIT_WINDOW_MS = '900000';
      process.env.RATE_LIMIT_CREDENCIALES_LIMIT = '2';
      process.env.CLASSROOM_ENABLED = '0';
      process.env.EVALUAPRO_FLAVOR = 'docente-local';
      process.env.REQUIRE_GOOGLE_OAUTH = '1';
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id-test';

      const app = await crearAppGoogleOnly();
      const origen = 'http://localhost:5173';
      const flujo = await request(app)
        .post('/api/autenticacion/google-desktop/iniciar')
        .set('Origin', origen)
        .send({})
        .expect(201);

      for (let intento = 0; intento < 45; intento += 1) {
        const resultado = await request(app)
          .post('/api/autenticacion/google-desktop/resultado')
          .set('Origin', origen)
          .send({ flowId: flujo.body.flowId })
          .expect(200);
        expect(resultado.body).toEqual({ estado: 'pendiente' });
      }

      await request(app)
        .get('/api/autenticacion/capacidades-integraciones')
        .expect(200);

      for (let intento = 45; intento < 1_000; intento += 1) {
        await request(app)
          .post('/api/autenticacion/google-desktop/resultado')
          .set('Origin', origen)
          .send({ flowId: flujo.body.flowId })
          .expect(200);
      }

      await request(app)
        .post('/api/autenticacion/google-desktop/resultado')
        .set('Origin', origen)
        .send({ flowId: flujo.body.flowId })
        .expect(429);

      await request(app)
        .post('/api/autenticacion/google-desktop/cancelar')
        .set('Origin', origen)
        .send({ flowId: flujo.body.flowId })
        .expect(200);
    } finally {
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      vi.resetModules();
    }
  });

  it('autovincula por correo verificado en el primer login Google', async () => {
    const app = await crearAppGoogleOnly();
    const docente = await Docente.create({
      nombreCompleto: 'Docente Existente',
      correo: 'docente@prueba.test',
      roles: ['docente'],
      activo: true
    });

    const login = await request(app)
      .post('/api/autenticacion/google')
      .send({ credential: 'fake-id-token-google' })
      .expect(200);

    expect(login.body?.token).toBeTruthy();
    const actualizado = await Docente.findById(docente._id).lean();
    expect(actualizado?.googleSub).toBe('google-sub-only');
    expect(actualizado?.imagenPerfil).toBe('https://lh3.googleusercontent.com/a/foto-docente');

    const perfil = await request(app)
      .get('/api/autenticacion/perfil')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(perfil.body?.docente?.imagenPerfil).toBe('https://lh3.googleusercontent.com/a/foto-docente');
  });

  it('bloquea definir contraseña aun con sesión iniciada', async () => {
    const app = await crearAppGoogleOnly();
    const docente = await Docente.create({
      nombreCompleto: 'Docente Vinculado',
      correo: 'docente@prueba.test',
      googleSub: 'google-sub-only',
      roles: ['docente'],
      activo: true
    });
    const token = crearTokenDocente({ docenteId: String(docente._id), roles: ['docente'] });

    const respuesta = await request(app)
      .post('/api/autenticacion/definir-contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({ contrasenaNueva: 'Nueva12345!', credential: 'fake-id-token-google' })
      .expect(403);

    expect(respuesta.body?.error?.codigo).toBe('GOOGLE_OAUTH_REQUIRED');
  });
});
