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

    const verificarCambios = async () => {
      if (!activo) return;
      try {
        const respuesta = await fetch('/index.html', { cache: 'no-store', credentials: 'same-origin' });
        if (!respuesta.ok) return;
        const html = await respuesta.text();
        const assetPublicado = extraerAssetPrincipalDesdeHtml(html);
        if (!assetPublicado) return;
        if (!assetActual) {
          assetActual = assetPublicado;
          return;
        }
        if (assetPublicado !== assetActual) {
          window.location.reload();
        }
      } catch {
        // silencioso: siguiente ciclo vuelve a intentar
      }
    };

    const intervalo = window.setInterval(() => {
      void verificarCambios();
    }, 30_000);

    return () => {
      activo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  const contenido = esVersionInfo
    ? <VersionInfoPage />
    : (destino === 'alumno' ? <AppAlumno /> : destino === 'admin_negocio' ? <AppAdminNegocio /> : <AppDocente />);

  return (
    <TemaProvider>
      <main className="page">
        {googleClientId && destino !== 'alumno' ? <GoogleOAuthProvider clientId={googleClientId}>{contenido}</GoogleOAuthProvider> : contenido}
      </main>
      {!esVersionInfo ? <TooltipLayer /> : null}
    </TemaProvider>
  );
}

export default App;
