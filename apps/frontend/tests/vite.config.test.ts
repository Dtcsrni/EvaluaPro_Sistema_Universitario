/**
 * vite.config.test
 *
 * Responsabilidad: Proteger el contrato de configuracion del build frontend.
 */
import { describe, expect, it } from 'vitest';
import { validarGoogleBuild } from '../vite.config';

describe('validarGoogleBuild', () => {
  it('falla si OAuth es obligatorio y falta el client id frontend', () => {
    expect(() => validarGoogleBuild({ REQUIRE_GOOGLE_OAUTH: '1' })).toThrow('VITE_GOOGLE_CLIENT_ID');
  });

  it('acepta OAuth obligatorio cuando el client id frontend esta presente', () => {
    expect(validarGoogleBuild({ REQUIRE_GOOGLE_OAUTH: 'true', VITE_GOOGLE_CLIENT_ID: 'client-id', GOOGLE_OAUTH_CLIENT_ID: 'client-id' })).toEqual({
      requireGoogleOAuth: true,
      configured: true
    });
  });

  it('falla si el client id frontend no coincide con el backend', () => {
    expect(() => validarGoogleBuild({
      REQUIRE_GOOGLE_OAUTH: '1',
      VITE_GOOGLE_CLIENT_ID: 'frontend-client-id',
      GOOGLE_OAUTH_CLIENT_ID: 'backend-client-id'
    })).toThrow('debe coincidir');
  });
});
