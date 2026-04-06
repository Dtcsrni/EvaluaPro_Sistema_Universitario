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

describe('configuracion portal (produccion)', () => {
  afterEach(() => {
    restaurarEnv();
    vi.resetModules();
  });

  it('falla si CORS_ORIGENES no esta definido en production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/portal';
    process.env.PORTAL_API_KEY = 'portal-key';
    process.env.CORS_ORIGENES = '';

    await expect(import('../src/configuracion')).rejects.toThrow('CORS_ORIGENES es requerido en producción (portal)');
  });

  it('falla si CORS_ORIGENES usa wildcard en production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/portal';
    process.env.PORTAL_API_KEY = 'portal-key';
    process.env.CORS_ORIGENES = '*';

    await expect(import('../src/configuracion')).rejects.toThrow('CORS_ORIGENES no puede usar "*" en producción (portal)');
  });
});
