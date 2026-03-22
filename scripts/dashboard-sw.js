/**
 * dashboard-sw
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/*
  Dashboard Service Worker
  - Evita cachear HTML de navegación para no reintroducir "no se ven los cambios".
  - No responde con una shell offline para navegación: si el dashboard local cayó,
    los endpoints /api/* también están caídos y las acciones de recuperación desde
    esa shell serían imposibles.
  - Cachea sólo assets estáticos (icon/manifest) y usa SWR para otros GET no-API.
  - /api/* siempre network-only.
*/

const CACHE_NAME = 'ep-dashboard-assets-v2026-03-21.2';
const PRECACHE_URLS = [
  '/assets/dashboard-icon.svg',
  '/assets/dashboard-icon-192.png',
  '/assets/dashboard-icon-512.png',
  '/assets/dashboard-icon-maskable-512.png',
  '/manifest.webmanifest'
];
const SAFE_ASSET_PATHS = new Set(PRECACHE_URLS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
        .catch(() => undefined),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', (event) => {
  const data = event?.data;
  if (data && typeof data === 'object' && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // No cachear API.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Navegación: network-only sin fallback HTML. Si el proceso local cayó,
  // dejar que el navegador muestre el error real en vez de una pantalla
  // offline con acciones imposibles contra un /api inexistente.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req));
    return;
  }

  if (!SAFE_ASSET_PATHS.has(url.pathname)) {
    event.respondWith(fetch(req));
    return;
  }

  // Assets del shell PWA: cache-first con revalidacion.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
