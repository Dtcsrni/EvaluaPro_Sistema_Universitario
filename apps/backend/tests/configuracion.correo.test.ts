/**
 * configuracion.correo.test
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

describe('configuracion correo', () => {
  afterEach(() => {
    restaurarEnv();
    vi.resetModules();
  });

  it('desactiva correo por defecto si no hay webhook', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORREO_MODULO_ACTIVO = '';
    process.env.NOTIFICACIONES_WEBHOOK_URL = '';
    process.env.NOTIFICACIONES_WEBHOOK_TOKEN = '';
    const mod = await import('../src/configuracion');
    expect(mod.configuracion.correoModuloActivo).toBe(false);
  });

  it('falla si se activa correo sin webhook completo', async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORREO_MODULO_ACTIVO = '1';
    process.env.NOTIFICACIONES_WEBHOOK_URL = 'https://hooks.example.com/notif';
    process.env.NOTIFICACIONES_WEBHOOK_TOKEN = '';
    await expect(import('../src/configuracion')).rejects.toThrow(
      'CORREO_MODULO_ACTIVO=1 requiere NOTIFICACIONES_WEBHOOK_URL y NOTIFICACIONES_WEBHOOK_TOKEN'
    );
  });

  it('fija allowlist de superadmin solo a cuentas de negocio autorizadas', async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPERADMIN_GOOGLE_EMAILS = 'otro@dominio.com';
    const mod = await import('../src/configuracion');
    expect(mod.configuracion.superadminGoogleEmails).toEqual([
      'armsystechno@gmail.com',
      'erick.vega@cuh.mx'
    ]);
  });
});
