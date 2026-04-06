/**
 * servicioCorreo.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const backup = { ...process.env };

function restaurarEnv() {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, backup);
}

describe('servicio correo', () => {
  afterEach(() => {
    restaurarEnv();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('retorna false cuando el modulo de correo esta desactivado', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORREO_MODULO_ACTIVO = '0';
    process.env.NOTIFICACIONES_WEBHOOK_URL = '';
    process.env.NOTIFICACIONES_WEBHOOK_TOKEN = '';

    const mod = await import('../src/infraestructura/correo/servicioCorreo');
    const ok = await mod.enviarCorreo('docente@cuh.mx', 'Prueba', 'Hola');
    expect(ok).toBe(false);
  });

  it('envia por webhook cuando el modulo esta activo y configurado', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORREO_MODULO_ACTIVO = '1';
    process.env.NOTIFICACIONES_WEBHOOK_URL = 'https://hooks.example.com/notif';
    process.env.NOTIFICACIONES_WEBHOOK_TOKEN = 'token-x';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => ''
      })
    );

    const mod = await import('../src/infraestructura/correo/servicioCorreo');
    const ok = await mod.enviarCorreo('docente@cuh.mx', 'Prueba', 'Hola');
    expect(ok).toBe(true);
  });
});
