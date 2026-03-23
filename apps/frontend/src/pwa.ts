/**
 * pwa
 *
 * Responsabilidad: Configurar identidad, migracion y estado observable PWA.
 * Limites: Mantener manifests/shell frescos y evitar instalaciones legacy.
 */

type DestinoPwa = 'docente' | 'alumno';

type DisplayModePwa = 'browser' | 'standalone' | 'minimal-ui' | 'fullscreen';

type EstadoPwa = {
  schemaVersion: string;
  destino: DestinoPwa;
  manifestHref: string;
  manifestId: string;
  runtime: 'browser' | 'installed';
  displayMode: DisplayModePwa;
  installed: boolean;
  installPromptAvailable: boolean;
  legacyDetected: boolean;
  cleanupPerformed: boolean;
  cleanupSkipped: boolean;
  swRegistered: boolean;
  swScript: string;
  version: string;
};

type BeforeInstallPromptEventCompat = Event & {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

declare global {
  interface Window {
    __EVALUAPRO_PWA__?: EstadoPwa;
    __EVALUAPRO_PWA_PROMPT__?: BeforeInstallPromptEventCompat | null;
  }
}

const destino = ((import.meta.env.VITE_APP_DESTINO || 'docente').toLowerCase() === 'alumno' ? 'alumno' : 'docente') as DestinoPwa;
const versionVisible = String(import.meta.env.VITE_APP_DISPLAY_VERSION || import.meta.env.VITE_APP_VERSION || '0.0.0');
const pwaDeshabilitada = /^(1|true|yes|si)$/i.test(String(import.meta.env.VITE_DISABLE_PWA || ''));
const PWA_SCHEMA_VERSION = '2026-03-21.1';
const SW_PATH = '/portal-sw.js';
const CACHE_PREFIX = 'ep-portal-assets-';
const CURRENT_CACHE = 'ep-portal-assets-v2026-03-21.1';
const CLEANUP_MARK = `ep.pwa.cleanup.${destino}.${PWA_SCHEMA_VERSION}`;

function getManifestHref(destinoActual: DestinoPwa) {
  return destinoActual === 'alumno' ? '/manifest-alumno.webmanifest' : '/manifest-docente.webmanifest';
}

function getManifestId(destinoActual: DestinoPwa) {
  return destinoActual === 'alumno' ? '/pwa/evaluapro/alumno' : '/pwa/evaluapro/docente';
}

function getFaviconHref(destinoActual: DestinoPwa) {
  return destinoActual === 'alumno' ? '/favicon-alumno.svg' : '/favicon-docente.svg';
}

function getAppleTouchHref(destinoActual: DestinoPwa) {
  return destinoActual === 'alumno' ? '/pwa-alumno-192.png' : '/pwa-docente-192.png';
}

function setHref(selector: string, href: string) {
  const el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) return;
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

function detectarDisplayMode(): DisplayModePwa {
  try {
    if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
  } catch {
    // no-op
  }
  return 'browser';
}

function detectarInstalada(): boolean {
  const displayMode = detectarDisplayMode();
  return displayMode !== 'browser' || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function publicarEstadoPwa(parcial: Partial<EstadoPwa> = {}): EstadoPwa {
  const previo = window.__EVALUAPRO_PWA__;
  const displayMode = detectarDisplayMode();
  const estado: EstadoPwa = {
    schemaVersion: PWA_SCHEMA_VERSION,
    destino,
    manifestHref: getManifestHref(destino),
    manifestId: getManifestId(destino),
    runtime: detectarInstalada() ? 'installed' : 'browser',
    displayMode,
    installed: detectarInstalada(),
    installPromptAvailable: false,
    legacyDetected: false,
    cleanupPerformed: false,
    cleanupSkipped: false,
    swRegistered: false,
    swScript: SW_PATH,
    version: versionVisible,
    ...(previo || {}),
    ...parcial
  };

  window.__EVALUAPRO_PWA__ = Object.freeze({ ...estado });
  document.documentElement.dataset.pwaMode = estado.runtime;
  document.documentElement.dataset.pwaDisplay = estado.displayMode;
  document.documentElement.dataset.pwaDestino = estado.destino;
  document.documentElement.dataset.pwaInstalled = estado.installed ? '1' : '0';
  document.documentElement.dataset.pwaLegacy = estado.legacyDetected ? '1' : '0';
  document.documentElement.dataset.pwaVersion = estado.version;
  window.dispatchEvent(new CustomEvent('evaluapro:pwa-state', { detail: estado }));
  return estado;
}

async function verificarManifestActivo(): Promise<Partial<EstadoPwa>> {
  try {
    const response = await fetch(getManifestHref(destino), { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return {};
    const manifest = await response.json();
    const manifestId = String(manifest?.id || '');
    const manifestDestino = String(manifest?.x_evaluapro?.destino || '');
    const legacyDetected = manifestId !== getManifestId(destino) || manifestDestino !== destino;
    return {
      manifestId: manifestId || getManifestId(destino),
      legacyDetected
    };
  } catch {
    return {};
  }
}

async function limpiarInstalacionLegacy() {
  if (typeof window === 'undefined') return { cleanupPerformed: false, cleanupSkipped: true };

  try {
    if (localStorage.getItem(CLEANUP_MARK)) {
      return { cleanupPerformed: false, cleanupSkipped: true };
    }
  } catch {
    // no-op
  }

  let cleanupPerformed = false;

  try {
    if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const scripts = [registration.active, registration.waiting, registration.installing]
          .filter(Boolean)
          .map((worker) => {
            try {
              return new URL((worker as ServiceWorker).scriptURL).pathname;
            } catch {
              return '';
            }
          })
          .filter(Boolean);

        if (scripts.some((script) => script !== SW_PATH)) {
          cleanupPerformed = (await registration.unregister()) || cleanupPerformed;
        }
      }
    }
  } catch {
    // no-op
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX) && key !== CURRENT_CACHE) {
          cleanupPerformed = (await caches.delete(key)) || cleanupPerformed;
        }
      }
    }
  } catch {
    // no-op
  }

  try {
    localStorage.setItem(CLEANUP_MARK, JSON.stringify({ at: Date.now(), cleanupPerformed }));
  } catch {
    // no-op
  }

  return { cleanupPerformed, cleanupSkipped: false };
}

function conectarEventosInstalacion() {
  window.addEventListener('beforeinstallprompt', (event) => {
    const promptEvent = event as BeforeInstallPromptEventCompat;
    promptEvent.preventDefault?.();
    window.__EVALUAPRO_PWA_PROMPT__ = promptEvent;
    publicarEstadoPwa({ installPromptAvailable: true });
  });

  window.addEventListener('appinstalled', () => {
    window.__EVALUAPRO_PWA_PROMPT__ = null;
    publicarEstadoPwa({
      installed: true,
      runtime: 'installed',
      installPromptAvailable: false,
      displayMode: detectarDisplayMode()
    });
  });

  window.addEventListener('pageshow', () => {
    publicarEstadoPwa();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') publicarEstadoPwa();
  });
}

export function aplicarRecursosPwa(destinoActual: DestinoPwa = destino) {
  setHref('link#app-manifest[rel="manifest"]', getManifestHref(destinoActual));
  setHref('link#app-favicon[rel="icon"]', getFaviconHref(destinoActual));
  setHref('link#app-apple-touch[rel="apple-touch-icon"]', getAppleTouchHref(destinoActual));
}

export async function inicializarPwa() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return publicarEstadoPwa();
  if (pwaDeshabilitada) {
    aplicarRecursosPwa(destino);
    return publicarEstadoPwa({ swRegistered: false, swScript: '', installPromptAvailable: false });
  }

  aplicarRecursosPwa(destino);
  conectarEventosInstalacion();
  publicarEstadoPwa();

  const [manifestState, cleanupState] = await Promise.all([
    verificarManifestActivo(),
    limpiarInstalacionLegacy()
  ]);

  const estado = publicarEstadoPwa({
    ...manifestState,
    ...cleanupState
  });

  if (!import.meta.env.PROD) return estado;
  if (!('serviceWorker' in navigator)) return estado;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_PATH, { scope: '/' })
      .then((registration) => {
        publicarEstadoPwa({ swRegistered: true, swScript: SW_PATH });
        registration.update().catch(() => undefined);

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

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
      .catch(() => {
        publicarEstadoPwa({ swRegistered: false, swScript: SW_PATH });
      });
  });

  return estado;
}

try {
  void inicializarPwa();
} catch {
  // no-op
}

export { publicarEstadoPwa, detectarDisplayMode, detectarInstalada };
