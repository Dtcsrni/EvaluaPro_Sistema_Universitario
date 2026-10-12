import { useEffect, useState } from 'react';
import { Icono } from '../iconos';
import { compararVersiones, obtenerVersionTecnicaApp } from './versionInfo';

const OWNER = 'Dtcsrni';
const REPOSITORY = 'EvaluaPro_Sistema_Universitario';
const ASSET_NAME = 'EvaluaPro-InstallerHub-docente-local.exe';
const POSTPONED_VERSION_KEY = 'evaluapro:update-postponed-version';

type LatestRelease = {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  html_url?: string;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

type HubBridgeWindow = Window & {
  chrome?: { webview?: { postMessage?: (message: unknown) => void } };
};

export function UpdateAvailabilityBanner() {
  const [release, setRelease] = useState<{ version: string; url: string } | null>(null);
  const [postponed, setPostponed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    void (async () => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${OWNER}/${REPOSITORY}/releases/latest`,
          { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal }
        );
        if (!response.ok) return;
        const candidate = await response.json() as LatestRelease;
        const version = String(candidate.tag_name || '').replace(/^v/i, '').trim();
        const assets = Array.isArray(candidate.assets) ? candidate.assets : [];
        const hasInstaller = assets.some((asset) => asset.name === ASSET_NAME);
        const hasChecksum = assets.some((asset) => asset.name === `${ASSET_NAME}.sha256`);
        const releaseUrl = String(candidate.html_url || '');

        if (
          candidate.draft === true || candidate.prerelease === true || !hasInstaller || !hasChecksum
          || !/^\d+\.\d+\.\d+$/.test(version)
          || compararVersiones(version, obtenerVersionTecnicaApp()) <= 0
          || !releaseUrl.startsWith(`https://github.com/${OWNER}/${REPOSITORY}/releases/tag/`)
        ) return;

        setRelease({ version, url: releaseUrl });
        try {
          setPostponed(window.sessionStorage.getItem(POSTPONED_VERSION_KEY) === version);
        } catch {
          setPostponed(false);
        }
      } catch {
        // Una consulta opcional nunca debe retrasar ni bloquear el inicio docente.
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!release || postponed) return null;

  const openHub = () => {
    const webview = (window as HubBridgeWindow).chrome?.webview;
    if (webview?.postMessage) {
      webview.postMessage({ type: 'EVALUAPRO_UPDATE_HUB', version: release.version });
      return;
    }
    window.open(release.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mensaje update-availability-banner" role="status" aria-live="polite">
      <span className="mensaje__icono" aria-hidden="true"><Icono nombre="info" /></span>
      <span className="mensaje__contenido">
        Hay una nueva versión disponible: <strong>v{release.version}</strong>.
      </span>
      <button type="button" className="btn btn-secundario" onClick={openHub}>
        Actualizar a v{release.version}
      </button>
      <a href={release.url} target="_blank" rel="noopener noreferrer">
        Ver novedades
      </a>
      <button
        type="button"
        className="btn btn-secundario"
        aria-label={`Posponer el aviso de la versión ${release.version}`}
        onClick={() => {
          try { window.sessionStorage.setItem(POSTPONED_VERSION_KEY, release.version); } catch {
            // El posponer en memoria sigue funcionando si el storage esta bloqueado.
          }
          setPostponed(true);
        }}
      >
        Posponer
      </button>
    </div>
  );
}
