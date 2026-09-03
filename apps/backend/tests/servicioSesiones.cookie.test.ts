import { describe, expect, it } from 'vitest';
import { debeUsarCookieRefreshSecure } from '../src/modulos/modulo_autenticacion/servicioSesiones';

describe('politica de cookie de refresh', () => {
  it('permite recuperar la sesion en docente-local servido por HTTP', () => {
    expect(debeUsarCookieRefreshSecure('production', 'docente-local')).toBe(false);
  });

  it('mantiene Secure para produccion remota', () => {
    expect(debeUsarCookieRefreshSecure('production', 'cloud')).toBe(true);
  });

  it('no activa Secure fuera de produccion', () => {
    expect(debeUsarCookieRefreshSecure('development', 'docente-local')).toBe(false);
  });
});
