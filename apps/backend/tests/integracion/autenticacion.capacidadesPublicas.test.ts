/**
 * Contrato público de capacidades OAuth para el bootstrap runtime de la UI.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/configuracion.js', () => ({
  configuracion: {
    googleOauthClientId: 'google-client-id-test',
    googleClassroomClientId: '',
    googleClassroomClientSecret: '',
    googleClassroomRedirectUri: '',
    classroomTokenCipherKey: '',
    classroomEnabled: false,
    correoModuloActivo: false,
    notificacionesWebhookUrl: '',
    notificacionesWebhookToken: '',
    respaldoCifradoSecreto: '',
    entorno: 'test',
    requireGoogleOAuth: false
  }
}));

vi.mock('../../src/infraestructura/baseDatos/sqlite.js', () => ({
  prisma: { docente: { count: async () => 0 } }
}));

import { capacidadesIntegracionesPublicas } from '../../src/modulos/modulo_autenticacion/controladorAutenticacion.js';

describe('capacidades OAuth públicas', () => {
  it('expone el Client ID público para iniciar Google OAuth en runtime', async () => {
    const res = { json: vi.fn() };

    await capacidadesIntegracionesPublicas({} as never, res as never);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      capacidadesIntegraciones: expect.objectContaining({
        oauthGoogleBackend: true,
        googleOauthClientId: 'google-client-id-test'
      })
    }));
  });
});
