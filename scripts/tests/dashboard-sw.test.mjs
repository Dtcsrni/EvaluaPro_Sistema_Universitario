/**
 * dashboard-sw.test
 *
 * Responsabilidad: Probar el contrato del service worker del dashboard.
 * Limites: Validar navegación sin shell offline engañosa y /api network-only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.cwd());
const dashboardSw = fs.readFileSync(path.join(root, 'scripts', 'dashboard-sw.js'), 'utf8');

function loadServiceWorker({ fetchImpl, cacheMatchResult } = {}) {
  const listeners = new Map();

  const context = {
    URL,
    Promise,
    Response: class Response {
      constructor(body, init = {}) {
        this.body = body;
        this.headers = init.headers || {};
      }
    },
    fetch: fetchImpl || (async (request) => ({ ok: true, request, clone: () => ({}) })),
    caches: {
      open: async () => ({
        addAll: async () => undefined,
        put: async () => undefined
      }),
      keys: async () => [],
      delete: async () => true,
      match: async () => cacheMatchResult
    },
    self: {
      location: { origin: 'http://127.0.0.1:4519' },
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
      addEventListener(type, handler) {
        listeners.set(type, handler);
      }
    }
  };

  vm.runInNewContext(dashboardSw, context);
  return {
    fetchHandler: listeners.get('fetch')
  };
}

function dispatchFetch(fetchHandler, request) {
  let responsePromise = null;
  fetchHandler({
    request,
    respondWith(promiseLike) {
      responsePromise = Promise.resolve(promiseLike);
    }
  });
  return responsePromise;
}

test('dashboard SW deja que navegacion falle con el error real cuando el dashboard no responde', async () => {
  const fetchError = new Error('ECONNREFUSED');
  const { fetchHandler } = loadServiceWorker({
    fetchImpl: async () => {
      throw fetchError;
    }
  });

  const responsePromise = dispatchFetch(fetchHandler, {
    method: 'GET',
    mode: 'navigate',
    url: 'http://127.0.0.1:4519/'
  });

  await assert.rejects(responsePromise, /ECONNREFUSED/);
});

test('dashboard SW mantiene /api como network-only', async () => {
  const expected = {
    ok: true,
    status: 200,
    clone: () => expected
  };
  const { fetchHandler } = loadServiceWorker({
    fetchImpl: async () => expected
  });

  const response = await dispatchFetch(fetchHandler, {
    method: 'GET',
    mode: 'cors',
    url: 'http://127.0.0.1:4519/api/health'
  });

  assert.equal(response, expected);
});
