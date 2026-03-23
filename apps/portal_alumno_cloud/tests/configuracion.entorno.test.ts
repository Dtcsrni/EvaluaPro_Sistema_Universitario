/**
 * configuracion.entorno.test
 *
 * Evita que el portal cloud contamine `process.env` global al correr suites en
 * `NODE_ENV=test`, pero conserva la carga de dotenv en desarrollo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const dotenvConfigMock = vi.hoisted(() => vi.fn());

vi.mock('dotenv', () => ({
  default: {
    config: dotenvConfigMock
  }
}));

const backup = { ...process.env };

function restaurarEnv() {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, backup);
}

describe('configuracion portal (entorno)', () => {
  afterEach(() => {
    restaurarEnv();
    dotenvConfigMock.mockReset();
    vi.resetModules();
  });

  it('no carga dotenv cuando NODE_ENV es test', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORTAL_API_KEY = 'portal-key';

    const { configuracion } = await import('../src/configuracion');

    expect(configuracion.entorno).toBe('test');
    expect(dotenvConfigMock).not.toHaveBeenCalled();
  });

  it('carga dotenv en desarrollo', async () => {
    process.env.NODE_ENV = 'development';

    const { configuracion } = await import('../src/configuracion');

    expect(configuracion.entorno).toBe('development');
    expect(dotenvConfigMock).toHaveBeenCalledTimes(1);
  });
});
