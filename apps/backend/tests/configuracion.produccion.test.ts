/**
 * configuracion.produccion.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const backup = { ...process.env };

function restaurarEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, backup);
}

describe('configuracion (produccion)', () => {
  afterEach(() => {
    restaurarEnv();
    vi.resetModules();
  });

  it('falla si faltan variables criticas del portal cloud en production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRETO = 'secret';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/evaluapro';
    process.env.CORS_ORIGENES = 'https://docente.example.com';
    delete process.env.PORTAL_ALUMNO_URL;
    delete process.env.PORTAL_ALUMNO_API_KEY;

    await expect(import('../src/configuracion')).rejects.toThrow('PORTAL_ALUMNO_URL es requerido en producción');
  });

  it('permite diferir portal cloud en flavor docente-local', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EVALUAPRO_FLAVOR = 'docente-local';
    process.env.JWT_SECRETO = 'secret';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/evaluapro';
    process.env.CORS_ORIGENES = 'http://localhost:4173';
    delete process.env.PORTAL_ALUMNO_URL;
    delete process.env.PORTAL_ALUMNO_API_KEY;

    const { configuracion } = await import('../src/configuracion');

    expect(configuracion.flavorId).toBe('docente-local');
    expect(configuracion.portalSyncRequired).toBe(false);
    expect(configuracion.portalAlumnoUrl).toBe('');
  });

  it('permite exigir sync cloud explicitamente en docente-local', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EVALUAPRO_FLAVOR = 'docente-local';
    process.env.PORTAL_SYNC_REQUIRED = '1';
    process.env.JWT_SECRETO = 'secret';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/evaluapro';
    process.env.CORS_ORIGENES = 'http://localhost:4173';
    delete process.env.PORTAL_ALUMNO_URL;
    delete process.env.PORTAL_ALUMNO_API_KEY;

    await expect(import('../src/configuracion')).rejects.toThrow('PORTAL_ALUMNO_URL es requerido en producción');
  });

  it('falla si falta CORS_ORIGENES en production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRETO = 'secret';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/evaluapro';
    process.env.PORTAL_ALUMNO_URL = 'https://portal.example.com';
    process.env.PORTAL_ALUMNO_API_KEY = 'portal-key';
    process.env.CORS_ORIGENES = '';

    await expect(import('../src/configuracion')).rejects.toThrow('CORS_ORIGENES es requerido en producción');
  });
});
