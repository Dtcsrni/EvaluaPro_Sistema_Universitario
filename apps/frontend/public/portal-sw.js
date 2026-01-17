/*
  Service Worker para portales Docente/Alumno (Vite).
  - No cachea HTML de navegación (evita "no se ven los cambios").
  - No cachea /api/* (siempre red).
  - Cachea assets estáticos (JS/CSS/SVG) con stale-while-revalidate.
*/

const CACHE = 'seu-portal-assets-v2026-01-17.1';

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

  // Assets: SWR.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) return cached;
    const network = await fetchPromise;
    return network || new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
