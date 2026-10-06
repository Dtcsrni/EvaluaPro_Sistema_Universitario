/**
 * servicioGoogle
 *
 * Responsabilidad: comprobar la normalización de la foto de cuenta Google sin red ni credenciales reales.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const google = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken(...args: unknown[]) {
      return google.verifyIdToken(...args);
    }
  }
}));

vi.mock('../src/configuracion.js', () => ({
  configuracion: { googleOauthClientId: 'google-client-test' }
}));

import { verificarCredencialGoogle } from '../src/modulos/modulo_autenticacion/servicioGoogle.js';

describe('verificarCredencialGoogle', () => {
  beforeEach(() => google.verifyIdToken.mockReset());

  it('conserva la foto HTTPS del payload verificado', async () => {
    google.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'Docente@prueba.test',
        sub: 'google-sub',
        email_verified: true,
        name: 'Docente Prueba',
        picture: 'https://lh3.googleusercontent.com/a/foto'
      })
    });

    await expect(verificarCredencialGoogle('credential')).resolves.toEqual({
      correo: 'docente@prueba.test',
      sub: 'google-sub',
      nombreCompleto: 'Docente Prueba',
      imagenPerfil: 'https://lh3.googleusercontent.com/a/foto'
    });
    expect(google.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'credential',
      audience: 'google-client-test'
    });
  });

  it('omite fotos que no usan HTTPS', async () => {
    google.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'docente@prueba.test',
        sub: 'google-sub',
        email_verified: true,
        picture: 'http://example.test/foto.png'
      })
    });

    await expect(verificarCredencialGoogle('credential')).resolves.toEqual({
      correo: 'docente@prueba.test',
      sub: 'google-sub',
      nombreCompleto: undefined,
      imagenPerfil: undefined
    });
  });
});
