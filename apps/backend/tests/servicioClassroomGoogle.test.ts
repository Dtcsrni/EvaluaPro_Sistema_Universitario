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
  generateCodeVerifierAsync: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
  verifyIdToken: ReturnType<typeof vi.fn>;
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
    generateAuthUrl: vi.fn((params: Record<string, unknown>) => {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, Array.isArray(value) ? value.join(' ') : String(value)));
      return url.toString();
    }),
    generateCodeVerifierAsync: vi.fn().mockResolvedValue({ codeVerifier: 'pkce-verifier', codeChallenge: 'pkce-challenge' }),
    getToken: vi.fn().mockResolvedValue({ tokens: {} }),
    verifyIdToken: vi.fn().mockResolvedValue({ getPayload: () => ({ email: 'docente@cuh.mx', email_verified: true, sub: 'google-user-77' }) }),
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
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    ...opciones?.integracion
  };
  const prisma = opciones?.prisma ?? {
    docente: { findUnique: vi.fn().mockResolvedValue({ googleSub: 'google-user-77' }) }
  };

  const cifrarTexto = opciones?.cifrarTexto ?? vi.fn((valor: string) => `enc:${valor}`);
  const descifrarTexto = opciones?.descifrarTexto ?? vi.fn((valor: string) => String(valor).replace(/^enc:/, ''));
  const protegerTokenClassroom = vi.fn((valor: string) => `dpapi:test:${valor}`);
  const descifrarTokenClassroom = vi.fn((valor: string, llave?: string) => {
    if (String(valor).startsWith('dpapi:test:')) return { token: String(valor).slice('dpapi:test:'.length), migrado: false };
    if (llave) return { token: descifrarTexto(valor, llave), migrado: true };
    throw new Error('legacy token without key');
  });
  const logMock = opciones?.log ?? vi.fn();

  vi.doMock('google-auth-library', () => ({ OAuth2Client, CodeChallengeMethod: { S256: 'S256' } }));
  vi.doMock('jsonwebtoken', () => ({ default: { sign: jwtSign, verify: jwtVerify } }));
  vi.doMock('../src/modulos/modulo_integraciones_classroom/modeloIntegracionClassroom', () => ({
    IntegracionClassroom: integracion
  }));
  vi.doMock('../src/infraestructura/baseDatos/sqlite', () => ({ prisma }));
  vi.doMock('../src/compartido/seguridad/cifrado', () => ({ cifrarTexto, descifrarTexto }));
  vi.doMock('../src/modulos/modulo_integraciones_classroom/proteccionTokensClassroom.js', () => ({ protegerTokenClassroom, descifrarTokenClassroom }));
  vi.doMock('../src/infraestructura/logging/logger', () => ({ log: logMock }));
  vi.doMock('../src/configuracion', () => ({
    configuracion: {
      ...configBase,
      ...opciones?.config
    }
  }));

  const mod = await import('../src/modulos/modulo_integraciones_classroom/servicioClassroomGoogle.js');
  return { mod, oauth, OAuth2Client, jwtSign, jwtVerify, integracion, prisma, cifrarTexto, descifrarTexto, protegerTokenClassroom, descifrarTokenClassroom, logMock };
}

describe('servicioClassroomGoogle', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('construye autorización PKCE con callback loopback y cliente público', async () => {
    const { mod, oauth, OAuth2Client } = await cargarModulo();
    const resultado = await mod.construirUrlOauthClassroom('docente-42', {
      loginHint: 'Docente@CUH.MX', expectedGoogleSub: 'google-user-77'
    });
    const auth = new URL(resultado.url);
    expect(resultado.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth2callback$/);
    expect(OAuth2Client).toHaveBeenCalledWith(configBase.googleClassroomClientId, configBase.googleClassroomClientSecret, resultado.redirectUri);
    expect(auth.searchParams.get('state')).toBe(resultado.state);
    expect(oauth.generateCodeVerifierAsync).toHaveBeenCalledOnce();
    expect(oauth.generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({
      login_hint: 'docente@cuh.mx', code_challenge: 'pkce-challenge', code_challenge_method: 'S256', redirect_uri: resultado.redirectUri
    }));
    const requestedScopes = oauth.generateAuthUrl.mock.calls[0]?.[0]?.scope as string[];
    expect(requestedScopes).toContain('https://www.googleapis.com/auth/classroom.student-submissions.students.readonly');
    const callback = new URL(resultado.redirectUri);
    callback.searchParams.set('state', resultado.state);
    callback.searchParams.set('error', 'access_denied');
    callback.searchParams.set('iss', 'https://accounts.google.com');
    expect((await fetch(callback)).status).toBe(400);
  });

  it('requiere el client ID específico de Classroom y respeta CLASSROOM_ENABLED=0', async () => {
    const sinClientId = await cargarModulo({ config: { googleClassroomClientId: '' } });
    await expect(sinClientId.mod.construirUrlOauthClassroom('docente-1', { loginHint: 'd@cuh.mx', expectedGoogleSub: 'sub-1' }))
      .rejects.toMatchObject({ codigo: 'CLASSROOM_NO_CONFIG' });
    const sinClientSecret = await cargarModulo({ config: { googleClassroomClientSecret: '' } });
    await expect(sinClientSecret.mod.construirUrlOauthClassroom('docente-1', { loginHint: 'd@cuh.mx', expectedGoogleSub: 'sub-1' }))
      .rejects.toMatchObject({ codigo: 'CLASSROOM_NO_CONFIG' });
    const deshabilitado = await cargarModulo({ config: { classroomEnabled: false } });
    await expect(deshabilitado.mod.construirUrlOauthClassroom('docente-1', { loginHint: 'd@cuh.mx', expectedGoogleSub: 'sub-1' }))
      .rejects.toMatchObject({ codigo: 'CLASSROOM_NO_CONFIG' });
  });

  it('completa callback loopback con PKCE, state de un solo uso e identidad verificada', async () => {
    const { mod, oauth, integracion, protegerTokenClassroom } = await cargarModulo({
      oauth: { getToken: vi.fn().mockResolvedValue({ tokens: {
        id_token: 'verified-id-token', refresh_token: 'refresh-xyz', access_token: 'access-xyz',
        scope: 'scope-a scope-b', expiry_date: 1730000000000
      } }) }
    });
    const resultado = await mod.construirUrlOauthClassroom('docente-42', {
      loginHint: 'docente@cuh.mx', expectedGoogleSub: 'google-user-77'
    });
    const auth = new URL(resultado.url);
    const callback = new URL(resultado.redirectUri);
    callback.searchParams.set('state', auth.searchParams.get('state') || '');
    callback.searchParams.set('code', 'oauth-code');
    callback.searchParams.set('iss', 'https://accounts.google.com');
    const response = await fetch(callback);
    expect(response.status, await response.text()).toBe(200);
    expect(oauth.getToken).toHaveBeenCalledWith({ code: 'oauth-code', codeVerifier: 'pkce-verifier', redirect_uri: resultado.redirectUri });
    expect(oauth.verifyIdToken).toHaveBeenCalledWith({ idToken: 'verified-id-token', audience: configBase.googleClassroomClientId });
    expect(protegerTokenClassroom).toHaveBeenCalledWith('refresh-xyz');
    expect(protegerTokenClassroom).toHaveBeenCalledWith('access-xyz');
    expect(integracion.updateOne).toHaveBeenCalledWith({ docenteId: 'docente-42' }, expect.objectContaining({
      $set: expect.objectContaining({ googleSub: 'google-user-77', correoGoogle: 'docente@cuh.mx' })
    }), { upsert: true });
    await expect(fetch(callback)).rejects.toThrow();
  });
  it('obtiene token de acceso y actualiza integracion', async () => {
    const { mod, integracion, oauth, protegerTokenClassroom, OAuth2Client } = await cargarModulo({
      integracion: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'int-1',
          googleSub: 'google-user-77',
          refreshTokenCifrado: 'dpapi:test:refresh-ok',
          activo: true
        })
      }
    });

    const token = await mod.obtenerTokenAccesoClassroom('docente-9');

    expect(token).toBe('access-token-123');
    expect(OAuth2Client).toHaveBeenCalledWith(configBase.googleClassroomClientId, configBase.googleClassroomClientSecret, undefined);
    expect(oauth.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-ok' });
    expect(protegerTokenClassroom).toHaveBeenCalledWith('access-token-123');
    expect(integracion.updateOne).toHaveBeenCalled();
  });

  it('rechaza renovar token Classroom cuando el sub de la integración no coincide con el login docente', async () => {
    const { mod, oauth } = await cargarModulo({
      integracion: {
        findOne: vi.fn().mockResolvedValue({
          _id: 'int-legacy',
          googleSub: 'google-user-other',
          refreshTokenCifrado: 'dpapi:test:refresh-other',
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
          refreshTokenCifrado: 'dpapi:test:refresh-ok',
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
        findOne: vi.fn().mockResolvedValue({ _id: 'int-1', googleSub: 'google-user-77', refreshTokenCifrado: 'dpapi:test:refresh', activo: true })
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
        findOne: vi.fn().mockResolvedValue({ _id: 'int-revoked', googleSub: 'google-user-77', refreshTokenCifrado: 'dpapi:test:refresh', activo: true })
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

  it('elimina duplicados de recurso entre páginas sin perder filas sin ID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: vi.fn().mockResolvedValue({ courseWork: [{ id: 'activity-1', title: 'A' }, { title: 'sin id' }], nextPageToken: 'page-2' })
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: vi.fn().mockResolvedValue({ courseWork: [{ id: 'activity-1', title: 'A duplicada' }, { id: 'activity-2', title: 'B' }] })
      });
    vi.stubGlobal('fetch', fetchMock);
    const { mod } = await cargarModulo();

    await expect(mod.classroomGetAll('token', 'courses/course-1/courseWork', 'courseWork')).resolves.toEqual([
      { id: 'activity-1', title: 'A' }, { title: 'sin id' }, { id: 'activity-2', title: 'B' }
    ]);
  });
});
