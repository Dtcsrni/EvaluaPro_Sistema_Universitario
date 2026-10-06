import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { verificarCredencialGoogle } = vi.hoisted(() => ({ verificarCredencialGoogle: vi.fn() }));
vi.mock('../../src/modulos/modulo_autenticacion/servicioGoogle.js', () => ({ verificarCredencialGoogle }));

import { crearApp } from '../../src/app.js';
import { ErrorAplicacion } from '../../src/compartido/errores/errorAplicacion.js';
import * as logger from '../../src/infraestructura/logging/logger.js';
import { cerrarSqliteTest, conectarSqliteTest, limpiarSqliteTest } from '../utils/sqliteTestDatabase.js';

describe('trazabilidad del login', () => {
  const app = crearApp();
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await conectarSqliteTest();
  });

  beforeEach(async () => {
    await limpiarSqliteTest();
    vi.clearAllMocks();
    verificarCredencialGoogle.mockResolvedValue({
      correo: 'docente@prueba.test',
      sub: 'google-sub-privado',
      nombreCompleto: 'Docente Google'
    });
    logSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
  });

  afterAll(async () => {
    await cerrarSqliteTest();
  });

  it('correlaciona las etapas del login Google sin registrar credencial, correo ni sub', async () => {
    await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente Prueba', correo: 'docente@prueba.test', contrasena: 'Secreto123!' })
      .expect(201);

    const flowId = 'b7a0a8f6-8d17-4d87-8e8c-41c39fcb2390';
    await request(app)
      .post('/api/autenticacion/google')
      .set('x-auth-flow-id', flowId)
      .send({ credential: 'id-token-que-no-debe-aparecer' })
      .expect(200);

    const etapas = logSpy.mock.calls
      .filter(([, mensaje]) => mensaje === 'Etapa de autenticación docente')
      .map(([, , meta]) => meta as Record<string, unknown>);
    expect(etapas.map((evento) => evento.stage)).toEqual([
      'validacion_credencial_google', 'validacion_credencial_google',
      'busqueda_cuenta', 'busqueda_cuenta', 'sesion_emitida', 'sesion_emitida'
    ]);
    expect(etapas.every((evento) => evento.authFlowId === flowId)).toBe(true);
    expect(etapas.every((evento) => typeof evento.requestId === 'string')).toBe(true);

    const serializado = JSON.stringify(logSpy.mock.calls);
    expect(serializado).not.toContain('id-token-que-no-debe-aparecer');
    expect(serializado).not.toContain('docente@prueba.test');
    expect(serializado).not.toContain('google-sub-privado');
  });

  it('correlaciona el login por contraseña sin registrar correo ni contraseña', async () => {
    await request(app)
      .post('/api/autenticacion/registrar')
      .send({ nombreCompleto: 'Docente Prueba', correo: 'docente@prueba.test', contrasena: 'Secreto123!' })
      .expect(201);

    const flowId = 'b7a0a8f6-8d17-4d87-8e8c-41c39fcb2390';
    await request(app)
      .post('/api/autenticacion/ingresar')
      .set('x-auth-flow-id', flowId)
      .send({ correo: 'docente@prueba.test', contrasena: 'Secreto123!' })
      .expect(200);

    const etapas = logSpy.mock.calls
      .filter(([, mensaje]) => mensaje === 'Etapa de autenticación docente')
      .map(([, , meta]) => meta as Record<string, unknown>);
    expect(etapas.map((evento) => evento.stage)).toEqual([
      'busqueda_cuenta', 'busqueda_cuenta', 'validacion_contrasena', 'validacion_contrasena',
      'sesion_emitida', 'sesion_emitida'
    ]);
    expect(etapas.every((evento) => evento.authFlowId === flowId && evento.authMethod === 'contrasena')).toBe(true);
    const serializado = JSON.stringify(logSpy.mock.calls);
    expect(serializado).not.toContain('docente@prueba.test');
    expect(serializado).not.toContain('Secreto123!');
  });

  it('registra código seguro cuando Google rechaza la credencial', async () => {
    verificarCredencialGoogle.mockRejectedValueOnce(
      new ErrorAplicacion('GOOGLE_CREDENCIAL_INVALIDA', 'Credencial invalida', 401)
    );

    await request(app)
      .post('/api/autenticacion/google')
      .set('x-auth-flow-id', 'b7a0a8f6-8d17-4d87-8e8c-41c39fcb2390')
      .send({ credential: 'credencial-privada' })
      .expect(401);

    const evento = logSpy.mock.calls
      .filter(([, mensaje]) => mensaje === 'Etapa de autenticación docente')
      .map(([, , meta]) => meta as Record<string, unknown>)
      .find((meta) => meta.stage === 'validacion_credencial_google' && meta.outcome === 'error');
    expect(evento).toMatchObject({ code: 'GOOGLE_CREDENCIAL_INVALIDA', authMethod: 'google' });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('credencial-privada');
  });

  it('ignora un identificador de flujo que no sea UUID', async () => {
    verificarCredencialGoogle.mockRejectedValueOnce(
      new ErrorAplicacion('GOOGLE_CREDENCIAL_INVALIDA', 'Credencial invalida', 401)
    );

    await request(app)
      .post('/api/autenticacion/google')
      .set('x-auth-flow-id', 'docente@prueba.test')
      .send({ credential: 'credencial-privada' })
      .expect(401);

    const evento = logSpy.mock.calls
      .filter(([, mensaje]) => mensaje === 'Etapa de autenticación docente')
      .map(([, , meta]) => meta as Record<string, unknown>)
      .find((meta) => meta.stage === 'validacion_credencial_google' && meta.outcome === 'iniciado');
    expect(evento).not.toHaveProperty('authFlowId');
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('docente@prueba.test');
  });
});
