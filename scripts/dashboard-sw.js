/**
 * dashboard-sw
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/*
  Dashboard Service Worker
  - Evita cachear HTML de navegación para no reintroducir "no se ven los cambios".
  - Cachea sólo assets estáticos (icon/manifest) y usa SWR para otros GET no-API.
  - /api/* siempre network-only.
*/

const CACHE_NAME = 'ep-dashboard-assets-v2026-03-03.1';
const PRECACHE_URLS = ['/assets/dashboard-icon.svg', '/manifest.webmanifest'];

function offlineHtml() {
  const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Dashboard sin conexión</title>
<style>
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#02030a;color:rgba(240,244,255,.94);display:grid;place-items:center;min-height:100vh;padding:24px}
  .card{max-width:720px;border:1px solid rgba(148,163,184,.22);border-radius:16px;padding:18px 20px;background:rgba(8,10,14,.92);box-shadow:0 22px 56px rgba(0,0,0,.58)}
  h1{margin:0 0 8px;font-size:18px}
  p{margin:0;color:rgba(175,186,210,.92);line-height:1.45}
  .hint{margin-top:12px;font-size:13px}
  .actions{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}
  .btn{appearance:none;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:rgba(34,232,255,.16);color:rgba(235,248,255,.96);padding:10px 14px;font-weight:600;cursor:pointer}
  .btn.secondary{background:rgba(148,163,184,.12)}
  .btn[disabled]{opacity:.62;cursor:wait}
  .status{margin-top:10px;font-size:13px;min-height:20px}
  a{color:#22e8ff}
</style>
</head><body>
  <div class="card">
    <h1>Sin conexión</h1>
    <p>No se pudo contactar al servidor local del dashboard. Verifica que esté corriendo en este equipo.</p>
    <div class="actions">
      <button id="start-system" class="btn" type="button">Iniciar sistema</button>
      <button id="repair-system" class="btn" type="button">Reparar entorno</button>
      <button id="retry-connection" class="btn secondary" type="button">Reintentar conexión</button>
    </div>
    <p id="start-status" class="status" aria-live="polite"></p>
    <p class="hint">Tip: abre <a href="/">/</a> cuando vuelva la conexión.</p>
  </div>
  <script>
    (function () {
      const button = document.getElementById('start-system');
      const repairButton = document.getElementById('repair-system');
      const retryButton = document.getElementById('retry-connection');
      const status = document.getElementById('start-status');
      if (!button || !status) return;

      const setStatus = (text) => {
        status.textContent = text;
      };

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const postStart = async (task) => {
        const response = await fetch('/api/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task })
        });
        if (!response.ok) throw new Error('start_failed');
      };

      const postRepairRun = async () => {
        const response = await fetch('/api/repair/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (!response.ok) throw new Error('repair_run_failed');
        return response.json().catch(() => ({}));
      };

      const getRepairProgress = async () => {
        return getJson('/api/repair/progress');
      };

      const waitForRepairOk = async (timeoutMs) => {
        const deadline = Date.now() + Math.max(10000, timeoutMs || 180000);
        while (Date.now() < deadline) {
          try {
            const progress = await getRepairProgress();
            const state = String((progress && progress.state) || '').toLowerCase();
            if (state === 'ok') return { ok: true };
            if (state === 'error') return { ok: false, state };
          } catch (_) {}
          await wait(1500);
        }
        return { ok: false, state: 'timeout' };
      };

      const getJson = async (url) => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('request_failed');
        return response.json();
      };

      const stackHealthy = async () => {
        const health = await getJson('/api/health');
        const services = health && health.services ? health.services : {};
        const apiOk = Boolean(services.apiDocente && services.apiDocente.ok);
        const portalOk = Boolean(services.apiPortal && services.apiPortal.ok);
        return apiOk && portalOk;
      };

      const waitForHealthyStack = async (timeoutMs) => {
        const deadline = Date.now() + Math.max(5000, timeoutMs || 90000);
        while (Date.now() < deadline) {
          try {
            if (await stackHealthy()) return true;
          } catch (_) {}
          await wait(1400);
        }
        return false;
      };

      let suggestedShortcut = 'EvaluaPro - Prod';

      const startFlow = async () => {
        try {
          if (await stackHealthy()) {
            setStatus('El sistema ya está activo. Reabriendo dashboard...');
            setTimeout(() => {
              window.location.href = '/';
            }, 900);
            return;
          }
        } catch (_) {}

        setStatus('Iniciando stack Docker y servicios...');

        let desiredMode = 'prod';
        try {
          const statusInfo = await getJson('/api/status');
          if (statusInfo && (statusInfo.mode === 'dev' || statusInfo.modeConfig === 'dev')) {
            desiredMode = 'dev';
          }
        } catch (_) {}

        suggestedShortcut = desiredMode === 'dev' ? 'EvaluaPro - Dev' : 'EvaluaPro - Prod';

        await postStart(desiredMode);
        try {
          await postStart('portal');
        } catch (_) {}

        setStatus('Esperando que el stack quede operativo...');
        const healthy = await waitForHealthyStack(90000);
        if (!healthy) throw new Error('stack_not_ready');

        setStatus('Sistema iniciado. Reabriendo dashboard...');
        setTimeout(() => {
          window.location.href = '/';
        }, 900);
      };

      button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        if (repairButton) repairButton.disabled = true;
        if (retryButton) retryButton.disabled = true;
        setStatus('Solicitando inicio del sistema...');

        try {
          await startFlow();
          return;
        } catch (_) {
          setStatus('No fue posible iniciarlo desde esta pantalla. Usa el acceso directo "' + suggestedShortcut + '" y vuelve a intentar.');
        }

        button.disabled = false;
        if (repairButton) repairButton.disabled = false;
        if (retryButton) retryButton.disabled = false;
      });

      if (repairButton) {
        repairButton.addEventListener('click', async () => {
          if (repairButton.disabled) return;
          repairButton.disabled = true;
          button.disabled = true;
          if (retryButton) retryButton.disabled = true;
          setStatus('Iniciando reparación automática...');

          try {
            await postRepairRun();
            setStatus('Reparación en curso. Esperando resultado...');
            const result = await waitForRepairOk(180000);
            if (!result.ok) throw new Error(result.state || 'repair_failed');
            setStatus('Reparación completada. Reabriendo dashboard...');
            setTimeout(() => {
              window.location.href = '/';
            }, 1000);
            return;
          } catch (_) {
            setStatus('No fue posible reparar desde esta pantalla. Usa el acceso directo "EvaluaPro - Reparar Entorno" y vuelve a intentar.');
          }

          repairButton.disabled = false;
          button.disabled = false;
          if (retryButton) retryButton.disabled = false;
        });
      }

      if (retryButton) {
        retryButton.addEventListener('click', () => {
          window.location.href = '/';
        });
      }
    })();
  </script>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

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

  // Navegación: network-only con fallback.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => offlineHtml()));
    return;
  }

  // Assets y otros GET: stale-while-revalidate.
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
