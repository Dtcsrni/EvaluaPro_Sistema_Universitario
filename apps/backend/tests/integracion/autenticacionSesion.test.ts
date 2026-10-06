/**
 * autenticacionSesion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas de sesiones persistentes (refresh) y login opcional con Google.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modulos/modulo_autenticacion/servicioGoogle', () => {
  return {
    verificarCredencialGoogle: vi.fn(async () => ({
      correo: 'docente@prueba.test',
      sub: 'google-sub-test',
      nombreCompleto: 'Docente Google'
    }))
  };
});

import { crearApp } from '../../src/app.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('autenticacion (sesiones)', () => {
  const app = crearApp();

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  it('emite refresh cookie al registrar y permite refrescar token', async () => {
    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);

    const setCookie = registro.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('refreshDocente=');

    const cookieHeader = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : String(setCookie);

    const refresco = await request(app)
      .post('/api/autenticacion/refrescar')
      .set('Cookie', cookieHeader)
      .send({})
      .expect(200);

    expect(refresco.body.token).toBeTruthy();
  });

  it('acepta registro y login con un correo fuera de cualquier dominio institucional', async () => {
    await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Externo',
        correo: 'docente@externo.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);

    const login = await request(app)
      .post('/api/autenticacion/ingresar')
      .send({ correo: 'docente@externo.test', contrasena: 'Secreto123!' })
      .expect(200);

    expect(login.body.token).toBeTruthy();
  });

  it('expone y persiste páginas predeterminadas pares por tipo de examen', async () => {
    const registro = await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente Preferencias', correo: 'paginas@prueba.test', contrasena: 'Secreto123!' })
      .expect(201);
    const auth = { Authorization: `Bearer ${registro.body.token as string}` };

    const perfilInicial = await request(app).get('/api/autenticacion/perfil').set(auth).expect(200);
    expect(perfilInicial.body.docente.preferenciasPdf.paginasPorTipo).toEqual({ parcial: 2, global: 4, extraordinario: 4 });

    const actualizado = await request(app).post('/api/autenticacion/preferencias/pdf').set(auth).send({
      paginasPorTipo: { parcial: 2, global: 6, extraordinario: 8 }
    }).expect(200);
    expect(actualizado.body.preferenciasPdf.paginasPorTipo).toEqual({ parcial: 2, global: 6, extraordinario: 8 });

    const perfilActualizado = await request(app).get('/api/autenticacion/perfil').set(auth).expect(200);
    expect(perfilActualizado.body.docente.preferenciasPdf.paginasPorTipo).toEqual({ parcial: 2, global: 6, extraordinario: 8 });

    await request(app).post('/api/autenticacion/preferencias/pdf').set(auth).send({
      paginasPorTipo: { parcial: 3, global: 4, extraordinario: 4 }
    }).expect(400);
  });

  it('permite ingresar con Google para un docente existente', async () => {
    await request(app)
      .post('/api/autenticacion/registrar')
      .send({
        nombreCompleto: 'Docente Prueba',
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(201);

    const login = await request(app)
      .post('/api/autenticacion/google')
      .send({ credential: 'fake-id-token' })
      .expect(200);

    expect(login.body.token).toBeTruthy();
    const setCookie = login.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('refreshDocente=');
  });

  it('permite registrar con Google y luego ingresar con Google', async () => {
    const registro = await request(app)
      .post('/api/autenticacion/registrar-google')
      .send({
        credential: 'fake-id-token',
        nombreCompleto: 'Docente Registro Google'
      })
      .expect(201);

    expect(registro.body.token).toBeTruthy();
    const setCookie = registro.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('refreshDocente=');

    const login = await request(app)
      .post('/api/autenticacion/google')
      .send({ credential: 'fake-id-token' })
      .expect(200);

    expect(login.body.token).toBeTruthy();
  });

  it('permite definir contrasena despues de registrar con Google', async () => {
    const registro = await request(app)
      .post('/api/autenticacion/registrar-google')
      .send({
        credential: 'fake-id-token',
        nombreCompleto: 'Docente Registro Google'
      })
      .expect(201);

    expect(registro.body.token).toBeTruthy();

    // Sin password, el login por correo+contrasena debe fallar.
    await request(app)
      .post('/api/autenticacion/ingresar')
      .send({
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(401);

    await request(app)
      .post('/api/autenticacion/definir-contrasena')
      .set('Authorization', `Bearer ${registro.body.token}`)
      .send({ contrasenaNueva: 'Secreto123!', credential: 'fake-id-token' })
      .expect(204);

    const loginPwd = await request(app)
      .post('/api/autenticacion/ingresar')
      .send({
        correo: 'docente@prueba.test',
        contrasena: 'Secreto123!'
      })
      .expect(200);

    expect(loginPwd.body.token).toBeTruthy();
  });

  it('permite recuperar contrasena via Google y luego ingresar con password', async () => {
    // Registrar con Google (vincula googleSub).
    await request(app)
      .post('/api/autenticacion/registrar-google')
      .send({
        credential: 'fake-id-token',
        nombreCompleto: 'Docente Registro Google'
      })
      .expect(201);

    const recupero = await request(app)
      .post('/api/autenticacion/recuperar-contrasena-google')
      .send({ credential: 'fake-id-token', contrasenaNueva: 'Nueva12345!' })
      .expect(200);

    expect(recupero.body.token).toBeTruthy();

    const loginPwd = await request(app)
      .post('/api/autenticacion/ingresar')
      .send({ correo: 'docente@prueba.test', contrasena: 'Nueva12345!' })
      .expect(200);

    expect(loginPwd.body.token).toBeTruthy();
  });
});
