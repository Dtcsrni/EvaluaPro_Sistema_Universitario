import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
  debeIntentarMotorCv,
  ejecutarSmokeTestOmrCv,
  preprocesarImagenOmrCv,
  setCvBackendCheckForTests
} from '../src/modulos/modulo_escaneo_omr/infra/omrCvEngine';

const ENV_BACKUP = {
  OMR_CV_ENGINE_ENABLED: process.env.OMR_CV_ENGINE_ENABLED,
  NODE_ENV: process.env.NODE_ENV
};

afterEach(() => {
  process.env.OMR_CV_ENGINE_ENABLED = ENV_BACKUP.OMR_CV_ENGINE_ENABLED;
  process.env.NODE_ENV = ENV_BACKUP.NODE_ENV;
  setCvBackendCheckForTests(null);
});

async function crearImagenBase64() {
  const buffer = await sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

describe('omrCvEngine', () => {
  it('falla smoke cuando backend CV no está disponible', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '1';
    setCvBackendCheckForTests(async () => {
      throw new Error('cv backend missing');
    });

    const smoke = await ejecutarSmokeTestOmrCv();
    expect(smoke.enabled).toBe(true);
    expect(smoke.backend).toBe('cv');
    expect(smoke.cvDisponible).toBe(false);
    expect(String(smoke.motivo ?? '')).toContain('Backend CV no disponible');
  });

  it('permite apagar engine CV por variable de entorno', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '0';

    const smoke = await ejecutarSmokeTestOmrCv();
    expect(smoke.enabled).toBe(false);
    expect(smoke.backend).toBe('cv');
    expect(smoke.cvDisponible).toBe(false);
    expect(debeIntentarMotorCv(3)).toBe(false);
  });

  it('reporta smoke exitoso cuando backend CV está disponible', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '1';
    setCvBackendCheckForTests(async () => ({}));
    const smoke = await ejecutarSmokeTestOmrCv();
    expect(smoke.enabled).toBe(true);
    expect(smoke.backend).toBe('cv');
    expect(smoke.cvDisponible).toBe(true);
  });

  it('en runtime no-test ignora desactivación por variable y mantiene CV activo', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OMR_CV_ENGINE_ENABLED = '0';
    setCvBackendCheckForTests(async () => ({}));
    const smoke = await ejecutarSmokeTestOmrCv();
    expect(smoke.enabled).toBe(true);
    expect(debeIntentarMotorCv(3)).toBe(true);
  });

  it('preprocesa imagen con backend CV disponible', async () => {
    process.env.OMR_CV_ENGINE_ENABLED = '1';
    setCvBackendCheckForTests(async () => ({}));
    const imagen = await crearImagenBase64();
    const salida = await preprocesarImagenOmrCv(imagen);
    expect(salida.startsWith('data:image/png;base64,')).toBe(true);
  });
});
