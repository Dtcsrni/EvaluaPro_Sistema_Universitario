import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const oauth = vi.hoisted(() => ({
  generateAuthUrl: vi.fn(),
  generateCodeVerifierAsync: vi.fn(),
  getToken: vi.fn(),
  verifyIdToken: vi.fn()
}));

vi.mock('google-auth-library', () => ({
  ClientAuthentication: { None: 'none' },
  CodeChallengeMethod: { S256: 'S256' },
  OAuth2Client: class {
    generateAuthUrl(...args: unknown[]) { return oauth.generateAuthUrl(...args); }
    generateCodeVerifierAsync(...args: unknown[]) { return oauth.generateCodeVerifierAsync(...args); }
    getToken(...args: unknown[]) { return oauth.getToken(...args); }
    verifyIdToken(...args: unknown[]) { return oauth.verifyIdToken(...args); }
  }
}));

vi.mock('../src/configuracion.js', () => ({
  configuracion: { googleDesktopClientId: 'desktop-client-test' }
}));

import {
  cancelarFlujoOAuthGoogleDesktop,
  confirmarResultadoOAuthGoogleDesktop,
  iniciarOAuthGoogleDesktop,
  obtenerResultadoOAuthGoogleDesktop
} from '../src/modulos/modulo_autenticacion/servicioGoogleDesktop.js';

const flujos: string[] = [];

async function iniciar() {
  const flujo = await iniciarOAuthGoogleDesktop();
  flujos.push(flujo.flowId);
  return flujo;
}

async function callback(url: string, state: string, extras: Record<string, string> = {}) {
  const destino = new URL(url);
  destino.searchParams.set('state', state);
  destino.searchParams.set('iss', 'https://accounts.google.com');
  destino.searchParams.set('code', 'authorization-code');
  for (const [key, value] of Object.entries(extras)) destino.searchParams.set(key, value);
  return fetch(destino);
}

describe('OAuth Desktop para login docente', () => {
  beforeEach(() => {
    oauth.generateAuthUrl.mockReset().mockImplementation((params: Record<string, unknown>) => {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, Array.isArray(value) ? value.join(' ') : String(value)));
      return url.toString();
    });
    oauth.generateCodeVerifierAsync.mockReset().mockResolvedValue({ codeVerifier: 'pkce-verifier', codeChallenge: 'pkce-challenge' });
    oauth.getToken.mockReset().mockResolvedValue({ tokens: { id_token: 'verified-id-token' } });
    oauth.verifyIdToken.mockReset().mockResolvedValue({
      getPayload: () => ({ email: 'docente@cuh.mx', email_verified: true, sub: 'google-sub-1' })
    });
  });

  afterEach(() => {
    for (const flowId of flujos.splice(0)) cancelarFlujoOAuthGoogleDesktop(flowId);
  });

  it('inicia con PKCE S256 y solo identidad básica; recupera y confirma el resultado', async () => {
    const flujo = await iniciar();
    const authUrl = new URL(flujo.url);
    const redirectUri = authUrl.searchParams.get('redirect_uri');

    expect(authUrl.searchParams.get('scope')?.split(' ').sort()).toEqual(['email', 'openid', 'profile']);
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('code_challenge')).toBe('pkce-challenge');
    expect(authUrl.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth2callback$/);

    const respuesta = await callback(redirectUri!, authUrl.searchParams.get('state')!);
    expect(respuesta.status).toBe(200);
    expect(oauth.getToken).toHaveBeenCalledWith({
      code: 'authorization-code',
      codeVerifier: 'pkce-verifier',
      redirect_uri: redirectUri
    });
    expect(oauth.verifyIdToken).toHaveBeenCalledWith({ idToken: 'verified-id-token', audience: 'desktop-client-test' });
    expect(obtenerResultadoOAuthGoogleDesktop(flujo.flowId)).toEqual({ estado: 'listo', credential: 'verified-id-token' });
    expect(obtenerResultadoOAuthGoogleDesktop(flujo.flowId)).toEqual({ estado: 'listo', credential: 'verified-id-token' });
    expect(confirmarResultadoOAuthGoogleDesktop(flujo.flowId)).toBe(true);
    expect(obtenerResultadoOAuthGoogleDesktop(flujo.flowId)).toEqual({ estado: 'expirado' });
  });

  it('rechaza state inválido sin consumir el flujo pendiente', async () => {
    const flujo = await iniciar();
    const authUrl = new URL(flujo.url);
    const redirectUri = authUrl.searchParams.get('redirect_uri')!;

    const respuesta = await callback(redirectUri, 'wrong-state');

    expect(respuesta.status).toBe(400);
    expect(obtenerResultadoOAuthGoogleDesktop(flujo.flowId)).toEqual({ estado: 'pendiente' });
    expect(oauth.getToken).not.toHaveBeenCalled();
  });

  it('no entrega ID token cuando Google no verifica el correo', async () => {
    const flujo = await iniciar();
    const authUrl = new URL(flujo.url);
    const redirectUri = authUrl.searchParams.get('redirect_uri')!;
    oauth.verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'docente@cuh.mx', email_verified: false, sub: 'google-sub-1' })
    });

    const respuesta = await callback(redirectUri, authUrl.searchParams.get('state')!);

    expect(respuesta.status).toBe(400);
    expect(obtenerResultadoOAuthGoogleDesktop(flujo.flowId)).toMatchObject({ estado: 'error', codigo: 'GOOGLE_EMAIL_NO_VERIFICADO' });
  });

  it('no crea un flujo sin Client ID Desktop', async () => {
    vi.doMock('../src/configuracion.js', () => ({ configuracion: { googleDesktopClientId: '' } }));
    vi.resetModules();
    const modulo = await import('../src/modulos/modulo_autenticacion/servicioGoogleDesktop.js');

    await expect(modulo.iniciarOAuthGoogleDesktop()).rejects.toMatchObject({ codigo: 'GOOGLE_DESKTOP_NO_CONFIG' });
  });
});
