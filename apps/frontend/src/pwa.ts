// Configuración PWA para portales Docente/Alumno.
// - Selecciona manifest + favicon según VITE_APP_DESTINO.
// - Registra un Service Worker que no cachea HTML navegacional ni /api/*.

const destino = (import.meta.env.VITE_APP_DESTINO || 'docente').toLowerCase();
const esAlumno = destino === 'alumno';

function setHref(selector: string, href: string) {
  const el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) return;
  // Evita writes inútiles.
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

try {
  setHref('link#app-manifest[rel="manifest"]', esAlumno ? '/manifest-alumno.webmanifest' : '/manifest-docente.webmanifest');
  setHref('link#app-favicon[rel="icon"]', esAlumno ? '/favicon-alumno.svg' : '/favicon-docente.svg');
} catch {
  // no-op
}

function registrarServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/portal-sw.js', { scope: '/' })
      .then((registration) => {
        // Intento de activar updates rápido para que cambios de UI no queden “pegados”.
        registration.update().catch(() => undefined);

        const sw = registration.waiting;
        if (sw) sw.postMessage({ type: 'SKIP_WAITING' });

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => undefined);
  });
}

try {
  registrarServiceWorker();
} catch {
  // no-op
}
