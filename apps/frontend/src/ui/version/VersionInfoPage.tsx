/**
 * VersionInfoPage
 *
 * Responsabilidad: Componente/utilidad de UI reutilizable.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import { useEffect, useMemo, useState } from 'react';
import { obtenerVersionApp, obtenerVersionTecnicaApp } from './versionInfo';

type VersionInfoPayload = {
  app?: { name?: string; version?: string; displayVersion?: string };
  repositoryUrl?: string;
  technologies?: Array<{ id?: string; label?: string; logoUrl?: string; website?: string }>;
  system?: {
    node?: string;
    platform?: string;
    arch?: string;
    hostname?: string;
    env?: string;
    uptimeSec?: number;
    generatedAt?: string;
  };
  developer?: { nombre?: string; rol?: string };
  changelog?: string;
};

type TecnologiaVersion = { id?: string; label?: string; logoUrl?: string; website?: string };

type VersionViewModel = {
  version: string;
  technicalVersion: string;
  nombre: string;
  developer: string;
  rol: string;
  changelog: string;
  repositoryUrl: string;
  technologies: TecnologiaVersion[];
  node: string;
  platform: string;
  arch: string;
  hostname: string;
  env: string;
  generatedAt: string;
};

function comoTexto(valor: unknown, fallback: string) {
  const texto = typeof valor === 'string' ? valor : '';
  return texto || fallback;
}

function viewModelSistema(data: VersionInfoPayload | null) {
  return {
    node: comoTexto(data?.system?.node, '-'),
    platform: comoTexto(data?.system?.platform, '-'),
    arch: comoTexto(data?.system?.arch, '-'),
    hostname: comoTexto(data?.system?.hostname, '-'),
    env: comoTexto(data?.system?.env, '-'),
    generatedAt: comoTexto(data?.system?.generatedAt, new Date().toISOString())
  };
}

function viewModelBase(data: VersionInfoPayload | null, fallbackVersion: string) {
  const technicalVersion = comoTexto(data?.app?.version, obtenerVersionTecnicaApp() || '0.0.0');
  return {
    version: comoTexto(data?.app?.displayVersion, fallbackVersion || technicalVersion || '0.0.0'),
    technicalVersion,
    nombre: comoTexto(data?.app?.name, 'evaluapro'),
    developer: comoTexto(data?.developer?.nombre, comoTexto(import.meta.env.VITE_DEVELOPER_NAME, 'Equipo EvaluaPro')),
    rol: comoTexto(data?.developer?.rol, comoTexto(import.meta.env.VITE_DEVELOPER_ROLE, 'Desarrollo')),
    changelog: comoTexto(data?.changelog, 'Sin changelog disponible.'),
    repositoryUrl: comoTexto(data?.repositoryUrl, 'https://github.com/Dtcsrni'),
    technologies: Array.isArray(data?.technologies) ? data.technologies : []
  };
}

function leerPortalDesdeHash() {
  try {
    const hash = String(window.location.hash || '');
    const idx = hash.indexOf('?');
    if (idx < 0) return 'docente';
    const search = new URLSearchParams(hash.slice(idx + 1));
    const portal = String(search.get('portal') || '').toLowerCase();
    return portal === 'alumno' ? 'alumno' : 'docente';
  } catch {
    return 'docente';
  }
}

function VersionTechList({ technologies }: { technologies: TecnologiaVersion[] }) {
  if (!technologies.length) {
    return <p className="version-error">Sin tecnologías registradas.</p>;
  }
  return (
    <>
      {technologies.map((tech, idx) => {
        const id = String(tech?.id || idx);
        const label = String(tech?.label || tech?.id || 'Tecnología');
        const logoUrl = String(tech?.logoUrl || '');
        const website = String(tech?.website || '#');
        return (
          <a
            key={id}
            href={website}
            target="_blank"
            rel="noreferrer noopener"
            className="version-tech-item"
          >
            <img src={logoUrl} alt={`${label} logo`} loading="lazy" className="version-tech-logo" />
            <span>{label}</span>
          </a>
        );
      })}
    </>
  );
}

function buildViewModel(data: VersionInfoPayload | null, fallbackVersion: string): VersionViewModel {
  return {
    ...viewModelBase(data, fallbackVersion),
    ...viewModelSistema(data)
  };
}

export function VersionInfoPage() {
  const [data, setData] = useState<VersionInfoPayload | null>(null);
  const [error, setError] = useState('');
  const portal = useMemo(() => leerPortalDesdeHash(), []);
  const fallbackVersion = obtenerVersionApp();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/salud/version-info', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelado) setData(json);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar version-info');
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const vm = buildViewModel(data, fallbackVersion);

  return (
    <main className="version-page">
      <section className="version-hero">
        <p className="version-eyebrow">EvaluaPro · {portal === 'alumno' ? 'Portal Alumno' : 'Portal Docente'}</p>
        <h1>Version Center</h1>
        <p className="version-sub">
          <span className="version-pulse" /> {vm.nombre} v{vm.version}
        </p>
        <p className="version-sub">
          Base técnica: {vm.technicalVersion}
        </p>
        <a className="version-repo-link" href={vm.repositoryUrl} target="_blank" rel="noreferrer noopener">
          Repositorio del desarrollador
        </a>
      </section>

      <section className="version-grid">
        <article className="version-card">
          <h2>Sistema</h2>
          <p><strong>Node:</strong> {vm.node}</p>
          <p><strong>Plataforma:</strong> {vm.platform} / {vm.arch}</p>
          <p><strong>Host:</strong> {vm.hostname}</p>
          <p><strong>Entorno:</strong> {vm.env}</p>
        </article>
        <article className="version-card">
          <h2>Desarrollador</h2>
          <p><strong>Nombre:</strong> {vm.developer}</p>
          <p><strong>Rol:</strong> {vm.rol}</p>
          <p><strong>Generado:</strong> {vm.generatedAt}</p>
        </article>
      </section>

      <section className="version-card version-card-wide">
        <h2>Tecnologías utilizadas</h2>
        <div className="version-tech-grid">
          <VersionTechList technologies={vm.technologies} />
        </div>
      </section>

      <section className="version-card version-card-wide">
        <h2>Changelog</h2>
        {error ? <p className="version-error">{error}</p> : null}
        <pre className="version-changelog">{vm.changelog}</pre>
      </section>
    </main>
  );
}
