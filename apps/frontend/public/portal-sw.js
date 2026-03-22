/**
 * portal-sw
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/*
  Service Worker para portales Docente/Alumno (Vite).
  - No cachea HTML de navegación (evita "no se ven los cambios").
  - No cachea /api/* (siempre red).
  - Cachea solo assets seguros del shell PWA con network-first.
  - Evita cachear GET arbitrarios para no mezclar destinos ni dejar manifests viejos pegados.
*/

const CACHE = 'ep-portal-assets-v2026-03-21.1';
const SAFE_PATHS = new Set([
  '/favicon.svg',
  '/favicon-docente.svg',
  '/favicon-alumno.svg',
  '/pwa-docente-192.png',
  '/pwa-docente-512.png',
  '/pwa-docente-maskable-512.png',
  '/pwa-alumno-192.png',
  '/pwa-alumno-512.png',
  '/pwa-alumno-maskable-512.png',
  '/manifest-docente.webmanifest',
  '/manifest-alumno.webmanifest'
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    self.skipWaiting();
    const cache = await caches.open(CACHE);
    await cache.addAll([
      '/favicon.svg',
      '/favicon-docente.svg',
      '/favicon-alumno.svg',
      '/manifest-docente.webmanifest',
      '/manifest-alumno.webmanifest'
    ]);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isApi(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigation(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isSafeAsset(url) {
  return SAFE_PATHS.has(url.pathname) || url.pathname.startsWith('/assets/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: red (sin cache) para evitar UI stale.
  if (isNavigation(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // API: red.
  if (isApi(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (!isSafeAsset(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Assets del shell PWA: network-first (si falla red, usa cache).
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const network = await fetch(request);
      if (network && network.ok) {
        cache.put(request, network.clone());
      }
      return network;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      return new Response('', { status: 504, statusText: 'Gateway Timeout' });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
