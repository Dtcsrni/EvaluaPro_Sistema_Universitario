/**
 * portalSw.contract
 *
 * Responsabilidad: Validar contrato del service worker del frontend.
 * Limites: Verifica reglas de cache/red sin probar instalacion real PWA.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const portalSw = fs.readFileSync(path.join(root, 'public', 'portal-sw.js'), 'utf8');

function loadPortalSw({
  fetchImpl,
  cacheMatchResult
}: {
  fetchImpl?: (request: { url: string; method: string; mode: string; headers?: { get?: (key: string) => string } }) => Promise<unknown>;
  cacheMatchResult?: unknown;
} = {}) {
  const listeners = new Map<string, (event: { request: { url: string; method: string; mode: string; headers?: { get?: (key: string) => string } }; respondWith: (value: Promise<unknown> | unknown) => void }) => void>();

  const context = {
    URL,
    Promise,
    Response: class Response {
      body: unknown;
      status: number;
      statusText: string;
      constructor(body: unknown, init: { status?: number; statusText?: string } = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.statusText = init.statusText || 'OK';
      }
    },
    fetch: fetchImpl || (async (request) => ({ ok: true, request, clone: () => ({}) })),
    caches: {
      open: async () => ({
        addAll: async () => undefined,
        put: async () => undefined,
        match: async () => cacheMatchResult
      }),
      keys: async () => [],
      delete: async () => true
    },
    self: {
      location: { origin: 'http://localhost:4173' },
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
      addEventListener(type: string, handler: (event: { request: { url: string; method: string; mode: string; headers?: { get?: (key: string) => string } }; respondWith: (value: Promise<unknown> | unknown) => void }) => void) {
        listeners.set(type, handler);
      }
    }
  };

  vm.runInNewContext(portalSw, context);

  return {
    fetchHandler: listeners.get('fetch')
  };
}

function dispatchFetch(
  fetchHandler: ((event: { request: { url: string; method: string; mode: string; headers?: { get?: (key: string) => string } }; respondWith: (value: Promise<unknown> | unknown) => void }) => void) | undefined,
  request: { url: string; method: string; mode: string; headers?: { get?: (key: string) => string } }
) {
  const normalizedRequest = {
    ...request,
    headers: request.headers || {
      get(key: string) {
        return key.toLowerCase() === 'accept' ? 'text/plain' : '';
      }
    }
  };
  let responsePromise: Promise<unknown> | null = null;
  fetchHandler?.({
    request: normalizedRequest,
    respondWith(value) {
      responsePromise = Promise.resolve(value);
    }
  });
  return responsePromise;
}

describe('portal service worker contract', () => {
  it('deja navegacion como network-only y falla con el error real', async () => {
    const fetchError = new Error('offline');
    const { fetchHandler } = loadPortalSw({
      fetchImpl: async () => {
        throw fetchError;
      }
    });

    const responsePromise = dispatchFetch(fetchHandler, {
      method: 'GET',
      mode: 'navigate',
      url: 'http://localhost:4173/'
    });

    await expect(responsePromise).rejects.toThrow('offline');
  });

  it('mantiene /api como network-only', async () => {
    const expected = { ok: true, status: 200, clone: () => expected };
    const { fetchHandler } = loadPortalSw({
      fetchImpl: async () => expected
    });

    const response = await dispatchFetch(fetchHandler, {
      method: 'GET',
      mode: 'cors',
      url: 'http://localhost:4173/api/salud'
    });

    expect(response).toBe(expected);
  });

  it('usa cache solo para assets seguros del shell PWA cuando falla la red', async () => {
    const cached = { ok: true, from: 'cache' };
    const { fetchHandler } = loadPortalSw({
      fetchImpl: async () => {
        throw new Error('network_down');
      },
      cacheMatchResult: cached
    });

    const response = await dispatchFetch(fetchHandler, {
      method: 'GET',
      mode: 'cors',
      url: 'http://localhost:4173/pwa-docente-192.png'
    });

    expect(response).toBe(cached);
  });
});
