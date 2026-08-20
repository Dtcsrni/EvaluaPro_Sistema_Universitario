/**
 * Selector de app docente o alumno segun variable de entorno.
 */
import { useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AppAlumno } from './apps/app_alumno/AppAlumno';
import { AppAdminNegocio } from './apps/app_admin_negocio/AppAdminNegocio';
import { AppDocente } from './apps/app_docente/AppDocente';
import { TemaProvider } from './tema/TemaProvider';
import { TooltipLayer } from './ui/ux/tooltip/TooltipLayer';
import { VersionInfoPage } from './ui/version/VersionInfoPage';
import { PaginaFirmaEncuadre } from './ui/encuadre/PaginaFirmaEncuadre';

function normalizarRutaAsset(valor: string): string {
  const limpio = String(valor || '').trim();
  if (!limpio) return '';
  try {
    return new URL(limpio, window.location.origin).pathname;
  } catch {
    return limpio.split('?')[0] || '';
  }
}

function obtenerAssetPrincipalActual(): string {
  if (typeof document === 'undefined') return '';
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return normalizarRutaAsset(script?.getAttribute('src') || '');
}

function extraerAssetPrincipalDesdeHtml(html: string): string {
  const fuente = String(html || '');
  const match = fuente.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i);
  return normalizarRutaAsset(match?.[1] || '');
}

function extraerVersionPwaDesdeManifest(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const meta = (json as { x_evaluapro?: { version?: string } }).x_evaluapro;
  return String(meta?.version || '').trim();
}

function establecerFavicon(href: string) {
  if (typeof document === 'undefined') return;
  const head = document.head;
  if (!head) return;

  const existentes = Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'));
  const link = existentes[0] || document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = href;
  if (!existentes[0]) head.appendChild(link);
}

function App() {
  const destino = import.meta.env.VITE_APP_DESTINO || 'docente';
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const esVersionInfo = typeof window !== 'undefined' && String(window.location.hash || '').startsWith('#/version-info');
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const esFirmaEncuadre = hash.startsWith('#/firmar-encuadre/');
  const tokenFirma = esFirmaEncuadre ? hash.replace('#/firmar-encuadre/', '') : '';

  useEffect(() => {
    const esAlumno = destino === 'alumno';
    const esAdminNegocio = destino === 'admin_negocio';
    document.title = esAlumno
      ? 'Portal Alumno - EvaluaPro'
      : esAdminNegocio
        ? 'Panel de Negocio - EvaluaPro'
        : 'Plataforma Docente - EvaluaPro';
    establecerFavicon(esAlumno ? '/favicon-alumno.svg' : '/favicon-docente.svg');
  }, [destino]);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let activo = true;
    let assetActual = obtenerAssetPrincipalActual();
    let versionManifestInicial: string | null = null;

    const verificarCambios = async () => {
      if (!activo) return;
      try {
        const [respuestaHtml, respuestaManifest] = await Promise.all([
          fetch('/index.html', { cache: 'no-store', credentials: 'same-origin' }),
          fetch(String(document.querySelector<HTMLLinkElement>('link#app-manifest')?.href || '/manifest-docente.webmanifest'), {
            cache: 'no-store',
            credentials: 'same-origin'
          })
        ]);
        if (!respuestaHtml.ok) return;
        const html = await respuestaHtml.text();
        const assetPublicado = extraerAssetPrincipalDesdeHtml(html);
        if (!assetPublicado) return;
        if (!assetActual) {
          assetActual = assetPublicado;
        } else if (assetPublicado !== assetActual) {
          window.location.reload();
          return;
        }

        if (respuestaManifest.ok) {
          const manifest = await respuestaManifest.json().catch(() => null);
          const versionManifest = extraerVersionPwaDesdeManifest(manifest);
          if (versionManifest) {
            if (versionManifestInicial === null) {
              versionManifestInicial = versionManifest;
            } else if (versionManifest !== versionManifestInicial) {
              window.location.reload();
            }
          }
        }
      } catch {
        // silencioso: siguiente ciclo vuelve a intentar
      }
    };

    const intervalo = window.setInterval(() => {
      void verificarCambios();
    }, 30_000);

    void verificarCambios();

    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const onPwaState = () => {
      const estado = window.__EVALUAPRO_PWA__;
      if (!estado?.legacyDetected) return;
      if (String(sessionStorage.getItem('ep.pwa.legacy.warned') || '') === '1') return;
      sessionStorage.setItem('ep.pwa.legacy.warned', '1');
      if (estado.installed) {
        try {
          window.location.reload();
        } catch {
          // no-op
        }
      }
    };
    window.addEventListener('evaluapro:pwa-state', onPwaState as EventListener);
    return () => {
      window.removeEventListener('evaluapro:pwa-state', onPwaState as EventListener);
    };
  }, []);

  const contenido = esVersionInfo
    ? <VersionInfoPage />
    : esFirmaEncuadre
      ? <PaginaFirmaEncuadre token={tokenFirma} />
      : (destino === 'alumno' ? <AppAlumno /> : destino === 'admin_negocio' ? <AppAdminNegocio /> : <AppDocente />);

  return (
    <TemaProvider>
      <main className={`page page--${destino}`} data-app-destino={destino}>
        {googleClientId && destino !== 'alumno' ? <GoogleOAuthProvider clientId={googleClientId}>{contenido}</GoogleOAuthProvider> : contenido}
      </main>
      {!esVersionInfo ? <TooltipLayer /> : null}
    </TemaProvider>
  );
}

export default App;
