/**
 * autenticacion.googleOnly.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Docente } from '../../src/modulos/modulo_autenticacion/modeloDocente';
import { crearTokenDocente } from '../../src/modulos/modulo_autenticacion/servicioTokens';
import { cerrarMongoTest, conectarMongoTest, limpiarMongoTest } from '../utils/mongo';

vi.mock('../../src/modulos/modulo_autenticacion/servicioGoogle', () => ({
  verificarCredencialGoogle: vi.fn(async () => ({
    correo: 'docente@prueba.test',
    sub: 'google-sub-only',
    nombreCompleto: 'Docente Google Only'
  }))
}));

async function crearAppGoogleOnly() {
  vi.resetModules();
  process.env.REQUIRE_GOOGLE_OAUTH = '1';
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id-test';
  const mod = await import('../../src/app');
  return mod.crearApp();
}

describe('autenticacion google-only', () => {
  beforeAll(async () => {
    await conectarMongoTest();
  });

  beforeEach(async () => {
    await limpiarMongoTest();
  });

  afterEach(() => {
    delete process.env.REQUIRE_GOOGLE_OAUTH;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  });

  afterAll(async () => {
    await cerrarMongoTest();
  });

  it('expone capacidades y bloquea flujos por contraseña', async () => {
    const app = await crearAppGoogleOnly();

    const capacidades = await request(app).get('/api/autenticacion/capacidades-integraciones').expect(200);
    expect(capacidades.body?.capacidadesIntegraciones).toMatchObject({
      requireGoogleOAuth: true,
      passwordLoginAllowed: false,
      oauthGoogleBackend: true
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

  it('autovincula por correo institucional en el primer login Google', async () => {
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
