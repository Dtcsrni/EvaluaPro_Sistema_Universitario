/**
 * configuracion.entorno.test
 *
 * Garantiza que la configuración de test no cargue el `.env` raíz y que el
 * comportamiento de desarrollo conserve el bootstrap esperado.
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

describe('configuracion (entorno)', () => {
  afterEach(() => {
    restaurarEnv();
    dotenvConfigMock.mockReset();
    vi.resetModules();
  });

  it('no carga dotenv cuando NODE_ENV es test', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORTAL_ALUMNO_URL = 'http://localhost:8080';
    process.env.PORTAL_ALUMNO_API_KEY = 'portal-key';

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
