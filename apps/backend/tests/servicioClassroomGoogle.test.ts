import { afterEach, describe, expect, it, vi } from 'vitest';

type ConfigParcial = Partial<{
  googleClassroomClientId: string;
  googleOauthClientId: string;
  googleClassroomClientSecret: string;
  googleClassroomRedirectUri: string;
  classroomTokenCipherKey: string;
  jwtSecreto: string;
}>;

type OauthMock = {
  generateAuthUrl: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
  setCredentials: ReturnType<typeof vi.fn>;
  getAccessToken: ReturnType<typeof vi.fn>;
};

type IntegracionMock = {
  findOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
};

const configBase = {
  googleClassroomClientId: 'classroom-client-id',
  googleOauthClientId: 'oauth-client-id',
  googleClassroomClientSecret: 'classroom-secret',
  googleClassroomRedirectUri: 'https://localhost/classroom/callback',
  classroomTokenCipherKey: 'k'.repeat(32),
  jwtSecreto: 'jwt-secret'
};

async function cargarModulo(opciones?: {
  config?: ConfigParcial;
  jwtVerify?: ReturnType<typeof vi.fn>;
  jwtSign?: ReturnType<typeof vi.fn>;
  oauth?: Partial<OauthMock>;
  integracion?: Partial<IntegracionMock>;
  cifrarTexto?: ReturnType<typeof vi.fn>;
  descifrarTexto?: ReturnType<typeof vi.fn>;
}) {
  vi.resetModules();

  const oauth: OauthMock = {
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1'),
    getToken: vi.fn().mockResolvedValue({ tokens: {} }),
    setCredentials: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token-123' }),
    ...opciones?.oauth
  };
  const OAuth2Client = vi.fn(function OAuth2ClientMock() {
    return oauth;
  });

  const jwtSign = opciones?.jwtSign ?? vi.fn().mockReturnValue('jwt-state-ok');
  const jwtVerify =
    opciones?.jwtVerify ??
    vi.fn().mockReturnValue({
      docenteId: 'docente-1',
      purpose: 'classroom_oauth'
    });

  const integracion: IntegracionMock = {
    findOne: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    ...opciones?.integracion
  };

  const cifrarTexto = opciones?.cifrarTexto ?? vi.fn((valor: string) => `enc:${valor}`);
  const descifrarTexto = opciones?.descifrarTexto ?? vi.fn((valor: string) => String(valor).replace(/^enc:/, ''));

  vi.doMock('google-auth-library', () => ({ OAuth2Client }));
  vi.doMock('jsonwebtoken', () => ({ default: { sign: jwtSign, verify: jwtVerify } }));
  vi.doMock('../src/modulos/modulo_integraciones_classroom/modeloIntegracionClassroom', () => ({
    IntegracionClassroom: integracion
  }));
  vi.doMock('../src/compartido/seguridad/cifrado', () => ({ cifrarTexto, descifrarTexto }));
  vi.doMock('../src/configuracion', () => ({
    configuracion: {
      ...configBase,
      ...opciones?.config
    }
  }));

  const mod = await import('../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle');
  return { mod, oauth, OAuth2Client, jwtSign, jwtVerify, integracion, cifrarTexto, descifrarTexto };
}

describe('servicioClassroomGoogle', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('construye URL OAuth con estado firmado', async () => {
    const { mod, oauth, OAuth2Client, jwtSign } = await cargarModulo();
    const resultado = mod.construirUrlOauthClassroom('docente-42');

    expect(resultado.url).toContain('accounts.google.com');
    expect(resultado.state).toBe('jwt-state-ok');
    expect(OAuth2Client).toHaveBeenCalledWith(
      configBase.googleClassroomClientId,
      configBase.googleClassroomClientSecret,
      configBase.googleClassroomRedirectUri
    );
    expect(jwtSign).toHaveBeenCalled();
    expect(oauth.generateAuthUrl).toHaveBeenCalled();
  });

  it('falla si la configuracion de classroom es incompleta', async () => {
    const { mod } = await cargarModulo({
      config: { googleClassroomClientSecret: '' }
    });
    await expect(() => mod.construirUrlOauthClassroom('docente-1')).toThrow(
      'Google Classroom no está configurado (clientId/clientSecret/redirectUri)'
    );
  });

  it('falla callback OAuth si faltan code/state', async () => {
    const { mod } = await cargarModulo();
    await expect(mod.completarOauthClassroom({ code: '', state: '' })).rejects.toMatchObject({
      codigo: 'CLASSROOM_OAUTH_CODIGO_INVALIDO',
      estadoHttp: 400
    });
  });

  it('falla callback OAuth con estado invalido', async () => {
    const { mod } = await cargarModulo({
      jwtVerify: vi.fn(() => {
        throw new Error('invalid');
      })
    });

    await expect(mod.completarOauthClassroom({ code: 'abc', state: 'bad' })).rejects.toMatchObject({
      codigo: 'CLASSROOM_OAUTH_ESTADO_INVALIDO',
      estadoHttp: 400
    });
  });

  it('falla callback OAuth si no se obtiene refresh token', async () => {
    const { mod } = await cargarModulo({
      oauth: {
        getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'at-1' } })
      },
      integracion: {
        findOne: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null)
        })
      }
    });

    await expect(mod.completarOauthClassroom({ code: 'ok', state: 'jwt-state-ok' })).rejects.toMatchObject({
      codigo: 'CLASSROOM_OAUTH_REFRESH_TOKEN',
      estadoHttp: 409
    });
  });

  it('completa callback OAuth usando refresh token de respuesta y perfil Google', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ email: 'Docente@CUH.MX', sub: 'google-user-77' })
      })
    );
    const { mod, integracion, cifrarTexto } = await cargarModulo({
      oauth: {
        getToken: vi.fn().mockResolvedValue({
          tokens: {
            refresh_token: 'refresh-xyz',
            access_token: 'access-xyz',
            scope: 'scope-a scope-b',
            expiry_date: 1730000000000
          }
        })
      },
      integracion: {
        findOne: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            docenteId: 'docente-1',
            correoGoogle: 'previo@cuh.mx',
            googleUserId: 'sub-prev'
          })
        })
      }
    });

    const resultado = await mod.completarOauthClassroom({ code: 'ok', state: 'jwt-state-ok' });

    expect(resultado).toMatchObject({
      docenteId: 'docente-1',
      correoGoogle: 'docente@cuh.mx',
      conectado: true
    });
    expect(cifrarTexto).toHaveBeenCalledWith('refresh-xyz', configBase.classroomTokenCipherKey);
    expect(cifrarTexto).toHaveBeenCalledWith('access-xyz', configBase.classroomTokenCipherKey);
    expect(integracion.updateOne).toHaveBeenCalled();
  });

  it('obtiene token de acceso y actualiza integracion', async () => {
    const { mod, integracion, descifrarTexto, oauth, cifrarTexto } = await cargarModulo({
      integracion: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'int-1',
          refreshTokenCifrado: 'enc:refresh-ok',
          activo: true
        })
      }
    });

    const token = await mod.obtenerTokenAccesoClassroom('docente-9');

    expect(token).toBe('access-token-123');
    expect(descifrarTexto).toHaveBeenCalledWith('enc:refresh-ok', configBase.classroomTokenCipherKey);
    expect(oauth.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-ok' });
    expect(cifrarTexto).toHaveBeenCalledWith('access-token-123', configBase.classroomTokenCipherKey);
    expect(integracion.updateOne).toHaveBeenCalled();
  });

  it('falla al obtener token de acceso cuando no hay integracion activa', async () => {
    const { mod } = await cargarModulo({
      integracion: {
        findOne: vi.fn().mockResolvedValue(null)
      }
    });

    await expect(mod.obtenerTokenAccesoClassroom('docente-x')).rejects.toMatchObject({
      codigo: 'CLASSROOM_NO_CONECTADO',
      estadoHttp: 404
    });
  });

  it('falla al obtener token de acceso cuando Google no retorna token', async () => {
    const { mod, integracion } = await cargarModulo({
      oauth: {
        getAccessToken: vi.fn().mockResolvedValue({ token: '' })
      },
      integracion: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'int-2',
          refreshTokenCifrado: 'enc:refresh-ok',
          activo: true
        })
      }
    });

    await expect(mod.obtenerTokenAccesoClassroom('docente-y')).rejects.toMatchObject({
      codigo: 'CLASSROOM_TOKEN_INVALIDO',
      estadoHttp: 502
    });
    expect(integracion.updateOne).toHaveBeenCalled();
  });

  it('classroomGet construye query y falla con mensaje de API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: { message: 'quota exceeded' }
        })
      })
    );
    const { mod } = await cargarModulo();

    await expect(
      mod.classroomGet('token-1', '/courses', {
        pageSize: 20,
        pageToken: '',
        teacherId: 'me'
      })
    ).rejects.toMatchObject({
      codigo: 'CLASSROOM_API_ERROR',
      estadoHttp: 502,
      message: 'quota exceeded'
    });
  });
});
