/**
 * servicioClassroomGoogle.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type ConfigParcial = Partial<{
  googleClassroomClientId: string;
  googleOauthClientId: string;
  googleClassroomClientSecret: string;
  googleClassroomRedirectUri: string;
  classroomTokenCipherKey: string;
  classroomEnabled: boolean;
  classroomRequestTimeoutMs: number;
  classroomMaxPages: number;
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

type PrismaMock = {
  docente: { findUnique: ReturnType<typeof vi.fn> };
};

const configBase = {
  googleClassroomClientId: 'classroom-client-id',
  googleOauthClientId: 'oauth-client-id',
  googleClassroomClientSecret: 'classroom-secret',
  googleClassroomRedirectUri: 'https://localhost/classroom/callback',
  classroomTokenCipherKey: 'k'.repeat(32),
  classroomEnabled: true,
  classroomRequestTimeoutMs: 15_000,
  classroomMaxPages: 100,
  jwtSecreto: 'jwt-secret'
};

async function cargarModulo(opciones?: {
  config?: ConfigParcial;
  jwtVerify?: ReturnType<typeof vi.fn>;
  jwtSign?: ReturnType<typeof vi.fn>;
  oauth?: Partial<OauthMock>;
  integracion?: Partial<IntegracionMock>;
  prisma?: PrismaMock;
  cifrarTexto?: ReturnType<typeof vi.fn>;
  descifrarTexto?: ReturnType<typeof vi.fn>;
  log?: ReturnType<typeof vi.fn>;
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
      purpose: 'classroom_oauth',
      loginHint: 'docente@cuh.mx',
      expectedGoogleSub: 'google-user-77'
    });

  const integracion: IntegracionMock = {
    findOne: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    ...opciones?.integracion
  };
  const prisma = opciones?.prisma ?? {
    docente: { findUnique: vi.fn().mockResolvedValue({ googleSub: 'google-user-77' }) }
  };

  const cifrarTexto = opciones?.cifrarTexto ?? vi.fn((valor: string) => `enc:${valor}`);
  const descifrarTexto = opciones?.descifrarTexto ?? vi.fn((valor: string) => String(valor).replace(/^enc:/, ''));
  const logMock = opciones?.log ?? vi.fn();

  vi.doMock('google-auth-library', () => ({ OAuth2Client }));
  vi.doMock('jsonwebtoken', () => ({ default: { sign: jwtSign, verify: jwtVerify } }));
  vi.doMock('../src/modulos/modulo_integraciones_classroom/modeloIntegracionClassroom', () => ({
    IntegracionClassroom: integracion
  }));
  vi.doMock('../src/infraestructura/baseDatos/sqlite', () => ({ prisma }));
  vi.doMock('../src/compartido/seguridad/cifrado', () => ({ cifrarTexto, descifrarTexto }));
  vi.doMock('../src/infraestructura/logging/logger', () => ({ log: logMock }));
  vi.doMock('../src/configuracion', () => ({
    configuracion: {
      ...configBase,
      ...opciones?.config
    }
  }));

  const mod = await import('../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle.js');
  return { mod, oauth, OAuth2Client, jwtSign, jwtVerify, integracion, prisma, cifrarTexto, descifrarTexto, logMock };
}

describe('servicioClassroomGoogle', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('construye URL OAuth con estado firmado', async () => {
    const { mod, oauth, OAuth2Client, jwtSign } = await cargarModulo();
    const resultado = mod.construirUrlOauthClassroom('docente-42', {
      loginHint: 'Docente@CUH.MX', expectedGoogleSub: 'google-user-77'
    });

    expect(resultado.url).toContain('accounts.google.com');
    expect(resultado.state).toBe('jwt-state-ok');
    expect(OAuth2Client).toHaveBeenCalledWith(
      configBase.googleClassroomClientId,
      configBase.googleClassroomClientSecret,
      configBase.googleClassroomRedirectUri
    );
    expect(jwtSign).toHaveBeenCalled();
    expect(oauth.generateAuthUrl).toHaveBeenCalled();
    expect(oauth.generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({ login_hint: 'docente@cuh.mx' }));
  });

  it('falla si la configuracion de classroom es incompleta', async () => {
    const { mod } = await cargarModulo({
      config: { googleClassroomClientSecret: '' }
    });
    await expect(() => mod.construirUrlOauthClassroom('docente-1', { loginHint: 'd@cuh.mx', expectedGoogleSub: 'sub-1' })).toThrow(
      'Google Classroom no está configurado (clientId/clientSecret/redirectUri)'
    );
  });

  it('no reutiliza el client id del login cuando falta el client id propio de classroom', async () => {
    const { mod } = await cargarModulo({
      config: { googleClassroomClientId: '' }
    });

    await expect(() => mod.construirUrlOauthClassroom('docente-1', { loginHint: 'd@cuh.mx', expectedGoogleSub: 'sub-1' })).toThrow(
      'Google Classroom no está configurado (clientId/clientSecret/redirectUri)'
    );
  });

  it('respeta CLASSROOM_ENABLED=0 aunque existan credenciales completas', async () => {
    const { mod } = await cargarModulo({
      config: { classroomEnabled: false }
    });

    await expect(() => mod.construirUrlOauthClassroom('docente-1', { loginHint: 'd@cuh.mx', expectedGoogleSub: 'sub-1' })).toThrow(
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

  it('no reutiliza refresh token si la integración previa pertenece a otra identidad Google', async () => {
    const { mod, integracion, descifrarTexto } = await cargarModulo({
      oauth: { getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'access-current' } }) },
      integracion: {
        findOne: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ googleSub: 'google-user-other', refreshTokenCifrado: 'enc:refresh-other' })
        })
      }
    });

    await expect(mod.completarOauthClassroom({ code: 'ok', state: 'jwt-state-ok' })).rejects.toMatchObject({
      codigo: 'CLASSROOM_OAUTH_REFRESH_TOKEN', estadoHttp: 409
    });
    expect(descifrarTexto).not.toHaveBeenCalled();
    expect(integracion.updateOne).not.toHaveBeenCalled();
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
    expect(integracion.updateOne).toHaveBeenCalledWith({ docenteId: 'docente-1' }, expect.objectContaining({
      $set: expect.objectContaining({ googleSub: 'google-user-77' })
    }), { upsert: true });
  });

  it('rechaza una identidad OAuth distinta y conserva la integración activa previa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ email: 'otra@cuh.mx', sub: 'google-user-other' })
    }));
    const { mod, integracion } = await cargarModulo({
      oauth: { getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'access-new', refresh_token: 'refresh-new' } }) },
      integracion: { findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ activo: true, googleSub: 'google-user-77' }) }) }
    });

    await expect(mod.completarOauthClassroom({ code: 'ok', state: 'jwt-state-ok' })).rejects.toMatchObject({
      codigo: 'CLASSROOM_GOOGLE_SUB_MISMATCH', estadoHttp: 403
    });
    expect(integracion.updateOne).not.toHaveBeenCalled();
  });

  it('obtiene token de acceso y actualiza integracion', async () => {
    const { mod, integracion, descifrarTexto, oauth, cifrarTexto } = await cargarModulo({
      integracion: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'int-1',
          googleSub: 'google-user-77',
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

  it('rechaza renovar token Classroom cuando el sub de la integración no coincide con el login docente', async () => {
    const { mod, oauth } = await cargarModulo({
      integracion: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'int-legacy',
          googleSub: 'google-user-other',
          refreshTokenCifrado: 'enc:refresh-other',
          activo: true
        })
      }
    });

    await expect(mod.obtenerTokenAccesoClassroom('docente-1')).rejects.toMatchObject({
      codigo: 'CLASSROOM_GOOGLE_SUB_MISMATCH', estadoHttp: 403
    });
    expect(oauth.setCredentials).not.toHaveBeenCalled();
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
          googleSub: 'google-user-77',
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

  it('comparte una única renovación de token entre solicitudes concurrentes del mismo docente', async () => {
    let resolverToken: ((value: { token: string }) => void) | undefined;
    const getAccessToken = vi.fn(() => new Promise<{ token: string }>((resolve) => { resolverToken = resolve; }));
    const { mod, oauth } = await cargarModulo({
      oauth: { getAccessToken: getAccessToken as OauthMock['getAccessToken'] },
      integracion: {
        findOne: vi.fn().mockResolvedValue({ _id: 'int-1', googleSub: 'google-user-77', refreshTokenCifrado: 'enc:refresh', activo: true })
      }
    });
    const primera = mod.obtenerTokenAccesoClassroom('docente-concurrente');
    const segunda = mod.obtenerTokenAccesoClassroom('docente-concurrente');
    await vi.waitFor(() => expect(oauth.getAccessToken).toHaveBeenCalledTimes(1));
    resolverToken?.({ token: 'shared-access-token' });

    await expect(Promise.all([primera, segunda])).resolves.toEqual(['shared-access-token', 'shared-access-token']);
    expect(oauth.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('clasifica invalid_grant y conserva la conexión para que el docente la reautorice', async () => {
    const { mod, integracion } = await cargarModulo({
      oauth: { getAccessToken: vi.fn().mockRejectedValue({ response: { data: { error: 'invalid_grant' } } }) },
      integracion: {
        findOne: vi.fn().mockResolvedValue({ _id: 'int-revoked', googleSub: 'google-user-77', refreshTokenCifrado: 'enc:refresh', activo: true })
      }
    });

    await expect(mod.obtenerTokenAccesoClassroom('docente-revocado')).rejects.toMatchObject({
      codigo: 'CLASSROOM_REAUTORIZAR', estadoHttp: 401
    });
    expect(integracion.updateOne).toHaveBeenCalledWith(
      { _id: 'int-revoked' },
      { $set: { ultimoError: 'Google requiere volver a autorizar Classroom' } }
    );
  });

  it('classroomGet construye query y falla con mensaje de API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'x-goog-request-id': 'google-request-1' }),
        json: vi.fn().mockResolvedValue({
          error: { message: 'permission denied', status: 'PERMISSION_DENIED', errors: [{ reason: 'SERVICE_DISABLED' }] }
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
      codigo: 'CLASSROOM_PERMISOS_INSUFICIENTES',
      estadoHttp: 403,
      message: 'La cuenta vinculada no tiene permiso para consultar este recurso de Classroom.',
      detalles: { classification: 'permission', reason: 'PERMISSION_DENIED', requestId: 'google-request-1' }
    });
  });

  it('reintenta cuota transitoria, respeta Retry-After y devuelve el payload tras recuperarse', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
        json: vi.fn().mockResolvedValue({ error: { status: 'RESOURCE_EXHAUSTED' } })
      })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue({ courses: [{ id: 'course-1' }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const { mod } = await cargarModulo();

    await expect(mod.classroomGet('sensitive-token', 'courses')).resolves.toEqual({ courses: [{ id: 'course-1' }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it('usa el timeout finito configurado para las lecturas de Classroom', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue({ courses: [] })
    });
    vi.stubGlobal('fetch', fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const { mod } = await cargarModulo({ config: { classroomRequestTimeoutMs: 2_500 } });

    await mod.classroomGet('token', 'courses');

    expect(timeoutSpy).toHaveBeenCalledWith(2_500);
  });

  it('rechaza tokens de página repetidos y corta al llegar al máximo de páginas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ courses: [], nextPageToken: 'repeat' })
    });
    vi.stubGlobal('fetch', fetchMock);
    const { mod } = await cargarModulo({ config: { classroomMaxPages: 2 } });

    await expect(mod.classroomGetAll('token', 'courses', 'courses')).rejects.toMatchObject({
      codigo: 'CLASSROOM_PAGINACION_INVALIDA', estadoHttp: 502
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockClear();
    fetchMock.mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('pageToken')?.replace('p', '') ?? 0) + 1;
      return { ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue({ courses: [], nextPageToken: `p${page}` }) };
    });
    await expect(mod.classroomGetAll('token', 'courses', 'courses')).rejects.toMatchObject({
      codigo: 'CLASSROOM_PAGINACION_LIMITE', estadoHttp: 502
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('registra correlación, ruta normalizada y páginas sin filtrar tokens ni datos del curso', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: vi.fn().mockResolvedValue({ courseWork: [{ id: 'activity-1' }], nextPageToken: 'page-secret' })
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: vi.fn().mockResolvedValue({ courseWork: [{ id: 'activity-2' }] })
      });
    vi.stubGlobal('fetch', fetchMock);
    const { mod, logMock } = await cargarModulo();

    await expect(mod.classroomGetAll(
      'token-secret', 'courses/course-private/courseWork', 'courseWork'
    )).resolves.toHaveLength(2);

    const logs = JSON.stringify(logMock.mock.calls);
    const metadata = logMock.mock.calls.map(([, , meta]) => meta as Record<string, unknown>);
    expect(new Set(metadata.map((item) => item.correlationId)).size).toBe(1);
    expect(metadata.map((item) => item.pagina).filter(Boolean)).toEqual([1, 2]);
    expect(metadata.at(-1)).toMatchObject({ paginas: 2, resultadosAcumulados: 2, ruta: 'courses/:id/courseWork' });
    expect(logs).not.toContain('token-secret');
    expect(logs).not.toContain('course-private');
    expect(logs).not.toContain('page-secret');
  });
});
