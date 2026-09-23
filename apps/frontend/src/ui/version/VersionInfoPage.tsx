/**
 * VersionInfoPage
 *
 * Responsabilidad: Centro de versión y especificación técnica de EvaluaPro.
 * Limites: Preservar accesibilidad y contratos de props existentes.
 */
import { useEffect, useMemo, useState } from 'react';
import rootPackage from '../../../../../package.json';
import frontendPackage from '../../../package.json';
import backendPackage from '../../../../backend/package.json';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  CirclePlus,
  Clock3,
  Code2,
  Database,
  FileText,
  GitBranch,
  IconoLucide,
  Monitor,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench
} from '../iconosCatalogo';
import lucideLicenseText from './legal/lucide-react.LICENSE.txt?raw';
import { formatearFechaChangelog, parsearChangelog, type EntradaChangelog } from './changelog';
import {
  obtenerVersionApp,
  obtenerVersionTecnicaApp,
  OMR_CANONICAL_CONTRACT_ID,
  OMR_CANONICAL_DISPLAY_LABEL,
  OMR_CANONICAL_VERSION
} from './versionInfo';

type VersionInfoPayload = {
  app?: { name?: string; version?: string; displayVersion?: string };
  omr?: { contractId?: string; templateVersion?: number; displayLabel?: string; oldVersionsOperational?: boolean };
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

type ManifestPackage = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

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
  omrContractId: string;
  omrDisplayLabel: string;
  omrTemplateVersion: number;
  oldVersionsOperational: boolean;
};

const CHANGELOG_DEFAULT = `# Changelog

## [${obtenerVersionApp()}] - 2026-09-22

### Added
- Centro de versión con historial de cambios filtrable y lectura por versión.
- Catálogo Lucide integrado con iconos accesibles y avisos de licencia.

### Fixed
- Pase de lista con nombres completos, estados visibles y validaciones de pertenencia.

### Verification
- Build docente, lint, pruebas focalizadas y contraste WCAG AA verificados localmente.
`;

function versionDeclarada(manifest: ManifestPackage, nombre: string) {
  const declaracion = manifest.dependencies?.[nombre] || manifest.devDependencies?.[nombre] || '';
  return declaracion.replace(/^[~^<>=\s]+/, '').split(/\s|\|\|/)[0] || 'sin versión';
}

function versionesDeclaradas(manifest: ManifestPackage, nombres: string[]) {
  return nombres.map((nombre) => versionDeclarada(manifest, nombre)).join(' / ');
}

const FRONTEND_PACKAGE = frontendPackage as ManifestPackage;
const BACKEND_PACKAGE = backendPackage as ManifestPackage;
const ROOT_PACKAGE = rootPackage as ManifestPackage;
const VERSION_NODE_REQUERIDA = ROOT_PACKAGE.engines?.node || '>=24';
const VERSIONES_TECNOLOGIAS = {
  react: versionDeclarada(FRONTEND_PACKAGE, 'react'),
  typescript: versionDeclarada(FRONTEND_PACKAGE, 'typescript'),
  vite: versionDeclarada(FRONTEND_PACKAGE, 'vite'),
  prisma: versionDeclarada(BACKEND_PACKAGE, '@prisma/client')
};

const TECNOLOGIAS_DEFAULT: TecnologiaVersion[] = [
  { id: 'react', label: `React ${VERSIONES_TECNOLOGIAS.react}`, website: 'https://react.dev' },
  { id: 'typescript', label: `TypeScript ${VERSIONES_TECNOLOGIAS.typescript}`, website: 'https://www.typescriptlang.org' },
  { id: 'vite', label: `Vite ${VERSIONES_TECNOLOGIAS.vite}`, website: 'https://vite.dev' },
  { id: 'nodejs', label: `Node.js ${VERSION_NODE_REQUERIDA}`, website: 'https://nodejs.org' },
  { id: 'sqlite', label: 'SQLite 3 Local', website: 'https://www.sqlite.org' },
  { id: 'prisma', label: `Prisma ORM ${VERSIONES_TECNOLOGIAS.prisma}`, website: 'https://www.prisma.io' },
  { id: 'omr', label: 'Motor OMR Óptico', website: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario' },
  { id: 'crypto', label: 'Cifrado AES-256-GCM', website: 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario' }
];

const ETIQUETAS_TECNOLOGIAS = {
  react: `React ${VERSIONES_TECNOLOGIAS.react}`,
  typescript: `TypeScript ${VERSIONES_TECNOLOGIAS.typescript}`,
  vite: `Vite ${VERSIONES_TECNOLOGIAS.vite}`,
  prisma: `Prisma ORM ${VERSIONES_TECNOLOGIAS.prisma}`,
  nodejs: `Node.js ${VERSION_NODE_REQUERIDA}`
} as const;

const LICENCIAS_DIRECTAS = [
  { paquete: '@react-oauth/google', version: versionDeclarada(FRONTEND_PACKAGE, '@react-oauth/google'), licencia: 'MIT' },
  { paquete: 'jsqr', version: versionDeclarada(FRONTEND_PACKAGE, 'jsqr'), licencia: 'Apache-2.0' },
  { paquete: 'lucide-react', version: versionDeclarada(FRONTEND_PACKAGE, 'lucide-react'), licencia: 'ISC + MIT para iconos derivados de Feather' },
  { paquete: 'react / react-dom', version: versionesDeclaradas(FRONTEND_PACKAGE, ['react', 'react-dom']), licencia: 'MIT' },
  { paquete: 'typescript', version: versionDeclarada(FRONTEND_PACKAGE, 'typescript'), licencia: 'Apache-2.0 · herramienta de compilación' },
  { paquete: 'vite', version: versionDeclarada(FRONTEND_PACKAGE, 'vite'), licencia: 'MIT · herramienta de compilación' },
  { paquete: 'tesseract.js / tesseract.js-core', version: versionDeclarada(FRONTEND_PACKAGE, 'tesseract.js'), licencia: 'Apache-2.0' },
  { paquete: '@pdf-lib/fontkit', version: versionDeclarada(BACKEND_PACKAGE, '@pdf-lib/fontkit'), licencia: 'MIT' },
  { paquete: '@prisma/client / prisma', version: versionesDeclaradas(BACKEND_PACKAGE, ['@prisma/client', 'prisma']), licencia: 'Apache-2.0' },
  { paquete: 'bcryptjs', version: versionDeclarada(BACKEND_PACKAGE, 'bcryptjs'), licencia: 'BSD-3-Clause' },
  { paquete: 'cors, decimal.js, docx, exceljs, express', version: versionesDeclaradas(BACKEND_PACKAGE, ['cors', 'decimal.js', 'docx', 'exceljs', 'express']), licencia: 'MIT' },
  { paquete: 'express-rate-limit, helmet, jsonwebtoken, multer, pdf-lib, qrcode, zod', version: versionesDeclaradas(BACKEND_PACKAGE, ['express-rate-limit', 'helmet', 'jsonwebtoken', 'multer', 'pdf-lib', 'qrcode', 'zod']), licencia: 'MIT' },
  { paquete: 'dotenv', version: versionDeclarada(BACKEND_PACKAGE, 'dotenv'), licencia: 'BSD-2-Clause' },
  { paquete: 'google-auth-library, pdf-parse, playwright, sharp', version: versionesDeclaradas(BACKEND_PACKAGE, ['google-auth-library', 'pdf-parse', 'playwright', 'sharp']), licencia: 'Apache-2.0' }
];

const LICENCIAS_PLATAFORMA = [
  { elemento: 'Node.js', version: `${VERSION_NODE_REQUERIDA} · versión exacta reportada por el runtime`, licencia: 'MIT + avisos de componentes incluidos' },
  { elemento: 'SQLite local', version: '3 · versión del motor no expuesta por el endpoint', licencia: 'Public Domain' },
  { elemento: 'Motor OMR de EvaluaPro', version: OMR_CANONICAL_CONTRACT_ID, licencia: 'AGPL-3.0-or-later' },
  { elemento: 'AES-256-GCM', version: 'algoritmo criptográfico', licencia: 'Sin licencia de componente' }
];

function renderIconoTecnologia(id: string) {
  switch (id.toLowerCase()) {
    case 'react':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(30 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(90 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(150 12 12)" />
          <circle cx="12" cy="12" r="2" fill="#38bdf8" />
        </svg>
      );
    case 'typescript':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" className="version-tech-svg">
          <rect width="18" height="18" x="3" y="3" rx="3" stroke="#60a5fa" />
          <path d="M8 8h6M11 8v8" />
          <path d="M15 15c1 1 3 0 3-1.5s-2-1.5-2-2.5 1.5-1.5 2.5-.5" />
        </svg>
      );
    case 'vite':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="version-tech-svg">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(167, 139, 250, 0.2)" stroke="#a78bfa" />
        </svg>
      );
    case 'nodejs':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <path d="M12 2l9 5.2v10.4L12 22.8l-9-5.2V7.2L12 2z" fill="rgba(74, 222, 128, 0.15)" stroke="#4ade80" />
          <circle cx="12" cy="12" r="3" fill="#4ade80" />
        </svg>
      );
    case 'sqlite':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case 'prisma':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="version-tech-svg">
          <polygon points="12 2 2 20 22 20 12 2" fill="rgba(45, 212, 191, 0.2)" stroke="#2dd4bf" />
          <line x1="12" y1="2" x2="12" y2="20" />
        </svg>
      );
    case 'omr':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#f43f5e" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'crypto':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="version-tech-svg">
          <rect width="18" height="11" x="3" y="11" rx="2" fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#fbbf24" />
          <circle cx="12" cy="16" r="1.5" fill="#fbbf24" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="version-tech-svg">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
  }
}

function comoTexto(valor: unknown, fallback: string) {
  const texto = typeof valor === 'string' ? valor : '';
  return texto || fallback;
}

function viewModelSistema(data: VersionInfoPayload | null) {
  return {
    node: comoTexto(data?.system?.node, `Node.js ${VERSION_NODE_REQUERIDA}`),
    platform: comoTexto(data?.system?.platform, 'win32'),
    arch: comoTexto(data?.system?.arch, 'x64'),
    hostname: comoTexto(data?.system?.hostname, 'Localhost'),
    env: comoTexto(data?.system?.env, 'production'),
    generatedAt: comoTexto(data?.system?.generatedAt, new Date().toISOString())
  };
}

const DEFAULT_DEV_NOMBRE = 'I.S.C. Erick Renato Vega Ceron';
const DEFAULT_DEV_ROL = 'Desarrollo';
const DEFAULT_REPO_URL = 'https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario';

function resolverDesarrollador(data: VersionInfoPayload | null) {
  const envNombre = String(import.meta.env.VITE_DEVELOPER_NAME || DEFAULT_DEV_NOMBRE);
  const envRol = String(import.meta.env.VITE_DEVELOPER_ROLE || DEFAULT_DEV_ROL);
  return {
    developer: comoTexto(data?.developer?.nombre, envNombre),
    rol: comoTexto(data?.developer?.rol, envRol),
    repositoryUrl: comoTexto(data?.repositoryUrl, DEFAULT_REPO_URL)
  };
}

function resolverAplicacion(data: VersionInfoPayload | null, fallbackVersion: string) {
  const app = data?.app;
  const fallbackTecnico = obtenerVersionTecnicaApp() || '1.1.1';
  const technicalVersion = comoTexto(app?.version, fallbackTecnico);
  return {
    version: comoTexto(app?.displayVersion, fallbackVersion || technicalVersion || '1.1.1'),
    technicalVersion,
    nombre: comoTexto(app?.name, 'evaluapro')
  };
}

function resolverContenido(data: VersionInfoPayload | null) {
  const technologies = Array.isArray(data?.technologies) ? data.technologies : TECNOLOGIAS_DEFAULT;
  return {
    changelog: comoTexto(data?.changelog, '').trim() || CHANGELOG_DEFAULT,
    technologies: technologies.map((technology) => {
      const id = String(technology?.id || '').toLowerCase() as keyof typeof ETIQUETAS_TECNOLOGIAS;
      const label = ETIQUETAS_TECNOLOGIAS[id];
      return label ? { ...technology, label } : technology;
    })
  };
}

function resolverOmr(data: VersionInfoPayload | null) {
  return {
    omrContractId: comoTexto(data?.omr?.contractId, OMR_CANONICAL_CONTRACT_ID),
    omrDisplayLabel: comoTexto(data?.omr?.displayLabel, OMR_CANONICAL_DISPLAY_LABEL),
    omrTemplateVersion: Number(data?.omr?.templateVersion || OMR_CANONICAL_VERSION),
    oldVersionsOperational: data?.omr?.oldVersionsOperational === true
  };
}

function viewModelBase(data: VersionInfoPayload | null, fallbackVersion: string) {
  return {
    ...resolverAplicacion(data, fallbackVersion),
    ...resolverContenido(data),
    ...resolverDesarrollador(data),
    ...resolverOmr(data)
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
        const website = String(tech?.website || '#');
        return (
          <a
            key={id}
            href={website}
            target="_blank"
            rel="noreferrer noopener"
            className="version-tech-item"
            data-tooltip={`Visitar documentación oficial de ${label}`}
          >
            <div className="version-tech-icon-box" aria-hidden="true">
              {renderIconoTecnologia(id)}
            </div>
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

function resolverEtiquetaEntorno(rawEnv?: string): string {
  const limpio = String(rawEnv || '').toLowerCase().trim();
  if (limpio === 'production' || limpio === 'prod') {
    return 'Producción Local (Offline-First)';
  }
  if (limpio === 'development' || limpio === 'dev') {
    return 'Desarrollo Local (Activo)';
  }
  if (limpio === 'test' || limpio === 'testing') {
    return 'Entorno de Pruebas Automatizadas';
  }
  return 'Local / Escritorio Autónomo';
}

function VersionChangelogVisual({ rawChangelog }: { rawChangelog: string }) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarOriginal, setMostrarOriginal] = useState(false);
  const versiones = useMemo(() => parsearChangelog(rawChangelog), [rawChangelog]);
  const termino = busqueda.trim().toLocaleLowerCase('es-MX');
  const versionesFiltradas = versiones.filter((version) => {
    if (!termino) return true;
    const contenido = [version.version, version.fecha, ...version.grupos.flatMap((grupo) => [
      grupo.titulo,
      ...grupo.cambios
    ])].join(' ').toLocaleLowerCase('es-MX');
    return contenido.includes(termino);
  });
  const totalCambios = versiones.reduce((total, version) => (
    total + version.grupos.reduce((suma, grupo) => suma + grupo.cambios.length, 0)
  ), 0);

  return (
    <div className="version-changelog-container">
      <div className="version-changelog-toolbar">
        <label className="version-changelog-search" htmlFor="version-changelog-search">
          <IconoLucide icon={Search} size={17} />
          <input
            id="version-changelog-search"
            type="search"
            aria-label="Buscar en el historial"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por versión o tema"
          />
        </label>
        <span className="version-changelog-count" aria-live="polite">
          {versionesFiltradas.length} {versionesFiltradas.length === 1 ? 'versión' : 'versiones'} · {totalCambios} cambios
        </span>
      </div>

      {versionesFiltradas.length ? (
        <div className="version-timeline">
          {versionesFiltradas.map((version, indice) => (
            <VersionRelease key={`${version.version}-${version.fecha}-${indice}`} release={version} expanded={indice === 0 || Boolean(termino)} />
          ))}
        </div>
      ) : (
        <div className="version-changelog-empty" role="status">
          <IconoLucide icon={FileText} size={22} />
          <p>{versiones.length ? 'No hay cambios que coincidan con la búsqueda.' : 'No hay notas de versión disponibles en este momento.'}</p>
        </div>
      )}

      {rawChangelog && (
        <details
          className="version-changelog-source"
          open={mostrarOriginal}
          onToggle={(event) => setMostrarOriginal(event.currentTarget.open)}
        >
          <summary>
            <IconoLucide icon={Code2} size={16} /> Ver texto original del changelog
            <IconoLucide icon={ChevronDown} size={16} className="version-changelog-source__chevron" />
          </summary>
          <pre className="version-changelog">{rawChangelog}</pre>
        </details>
      )}
    </div>
  );
}

function VersionLicenseInventory() {
  return (
    <details className="version-license-inventory">
      <summary><IconoLucide icon={PackageCheck} size={16} /> Ver inventario de dependencias directas</summary>
      <p className="version-license-inventory__hint">
        Inventario comprobado contra los manifiestos y lockfiles del producto. Las dependencias transitivas mantienen sus avisos en los paquetes distribuidos y en los lockfiles.
      </p>
      <ul className="version-license-inventory__list">
        {LICENCIAS_DIRECTAS.map((item) => (
          <li key={item.paquete}>
            <span><strong>{item.paquete}</strong> · {item.version}</span>
            <span className="version-license-inventory__badge">{item.licencia}</span>
          </li>
        ))}
      </ul>
      <h3 className="version-license-inventory__heading">Plataforma y código del producto</h3>
      <ul className="version-license-inventory__list">
        {LICENCIAS_PLATAFORMA.map((item) => (
          <li key={item.elemento}>
            <span><strong>{item.elemento}</strong> · {item.version}</span>
            <span className="version-license-inventory__badge">{item.licencia}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function iconoCategoria(titulo: string) {
  const categoria = titulo.toLocaleLowerCase('es-MX');
  if (categoria.includes('novedad') || categoria.includes('added') || categoria.includes('document')) return CirclePlus;
  if (categoria.includes('correcci') || categoria.includes('fixed')) return Wrench;
  if (categoria.includes('seguridad') || categoria.includes('security')) return ShieldCheck;
  if (categoria.includes('verificaci') || categoria.includes('verification') || categoria.includes('qa')) return CheckCircle2;
  if (categoria.includes('mejora') || categoria.includes('changed')) return Sparkles;
  if (categoria.includes('nota')) return FileText;
  return CircleCheck;
}

function etiquetaVersion(version: string) {
  if (version.toLocaleLowerCase('es-MX') === 'unreleased') return 'En preparación';
  return version.toLocaleLowerCase('es-MX').startsWith('v') ? version : `v${version}`;
}

function VersionRelease({ release, expanded }: { release: EntradaChangelog; expanded: boolean }) {
  const total = release.grupos.reduce((suma, grupo) => suma + grupo.cambios.length, 0);
  const enPreparacion = release.version.toLocaleLowerCase('es-MX') === 'unreleased';

  return (
    <details className={`version-timeline__release${expanded ? ' is-featured' : ''}`} open={expanded}>
      <summary className="version-timeline__summary">
        <span className="version-timeline__summary-icon" aria-hidden="true">
          <IconoLucide icon={enPreparacion ? Sparkles : PackageCheck} size={19} />
        </span>
        <span className="version-timeline__summary-main">
          <span className="version-timeline__summary-topline">
            <strong className="version-timeline__tag-version">{etiquetaVersion(release.version)}</strong>
            {enPreparacion && <span className="version-timeline__tag-status">Próximo lanzamiento</span>}
          </span>
          <span className="version-timeline__summary-meta">
            {release.fecha && <span><IconoLucide icon={CalendarDays} size={14} /> {formatearFechaChangelog(release.fecha)}</span>}
            <span><IconoLucide icon={FileText} size={14} /> {total} {total === 1 ? 'cambio' : 'cambios'}</span>
          </span>
        </span>
        <IconoLucide icon={ChevronDown} size={18} className="version-timeline__chevron" />
      </summary>

      <div className="version-timeline__content">
        {release.grupos.map((grupo, indice) => {
          const IconoCategoria = iconoCategoria(grupo.titulo);
          return (
            <section className="version-timeline__cat-block" key={`${grupo.titulo}-${indice}`}>
              <h3 className="version-timeline__cat-title">
                <IconoLucide icon={IconoCategoria} size={17} /> {grupo.titulo}
              </h3>
              <ul className="version-timeline__list">
                {grupo.cambios.map((cambio, cambioIndice) => (
                  <li className="version-timeline__item" key={`${cambio.slice(0, 32)}-${cambioIndice}`}>
                    <span className="version-timeline__bullet" aria-hidden="true" />
                    <span>{cambio}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </details>
  );
}

export function VersionInfoPage() {
  const [data, setData] = useState<VersionInfoPayload | null>(null);
  const portal = useMemo(() => leerPortalDesdeHash(), []);
  const fallbackVersion = obtenerVersionApp();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch('/api/salud/version-info', { cache: 'no-store' });
        if (res.ok) {
          const contentType = typeof res.headers?.get === 'function' ? (res.headers.get('content-type') || '') : '';
          if (!contentType || contentType.includes('application/json')) {
            const json = await res.json();
            if (!cancelado && json && typeof json === 'object') {
              setData(json as VersionInfoPayload);
            }
          }
        }
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const vm = buildViewModel(data, fallbackVersion);
  const etiquetaEntorno = resolverEtiquetaEntorno(vm.env);

  return (
    <div className="version-page">
      <header className="version-hero">
        <div className="version-hero__copy">
          <p className="version-eyebrow">EvaluaPro · {portal === 'alumno' ? 'Portal Alumno' : 'Portal Docente'}</p>
          <h1>Versión y novedades</h1>
          <p className="version-hero__intro">Consulta qué incluye esta instalación, revisa cambios y encuentra los detalles técnicos cuando los necesites.</p>
          <a className="version-repo-link" href={vm.repositoryUrl} target="_blank" rel="noreferrer noopener">
            <IconoLucide icon={GitBranch} size={17} /> Ver repositorio
          </a>
        </div>
        <div className="version-hero__installed" aria-label={`Versión instalada ${vm.version}`}>
          <span className="version-hero__installed-label"><IconoLucide icon={CircleCheck} size={16} /> Versión instalada</span>
          <strong>{vm.version}</strong>
          <span className="version-hero__technical"><IconoLucide icon={Code2} size={15} /> Versión técnica {vm.technicalVersion}</span>
        </div>
      </header>

      <nav className="version-nav" aria-label="Secciones de información de versión">
        <a href="#version-updates"><IconoLucide icon={Sparkles} size={17} /> Novedades</a>
        <a href="#version-details"><IconoLucide icon={Monitor} size={17} /> Instalación</a>
        <a href="#version-technologies"><IconoLucide icon={Database} size={17} /> Tecnologías</a>
        <a href="#version-licenses"><IconoLucide icon={FileText} size={17} /> Licencias</a>
      </nav>

      <section className="version-card version-card-wide version-updates" id="version-updates" aria-labelledby="version-updates-title">
        <div className="version-section-heading">
          <div>
            <p className="version-section-kicker"><IconoLucide icon={Sparkles} size={15} /> CAMBIOS PUBLICADOS</p>
            <h2 id="version-updates-title">Novedades e historial</h2>
            <p>Explora cada versión y filtra por funcionalidad, módulo o palabra clave.</p>
          </div>
          <span className="version-current-chip"><IconoLucide icon={CheckCircle2} size={16} /> Instalada: {vm.version}</span>
        </div>
        <VersionChangelogVisual rawChangelog={vm.changelog} />
      </section>

      <section className="version-grid" id="version-details" aria-label="Detalles de la instalación">
        <article className="version-card">
          <h2><IconoLucide icon={Monitor} size={18} /> Sistema e instalación</h2>
          <div className="version-info-rows">
            <div className="version-info-row">
              <span className="version-info-label">Entorno</span>
              <span className="version-env-badge">{etiquetaEntorno}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Arquitectura</span>
              <span className="version-info-val">Aplicación local, preparada para trabajar sin conexión</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Runtime</span>
              <span className="version-info-val">{vm.node} · {vm.platform} · {vm.arch}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Equipo</span>
              <span className="version-info-val">{vm.hostname}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Motor OMR</span>
              <span className="version-env-badge" title={vm.omrContractId}>{vm.omrDisplayLabel}</span>
            </div>
          </div>
        </article>

        <article className="version-card">
          <h2><IconoLucide icon={Clock3} size={18} /> Información de compilación</h2>
          <div className="version-info-rows">
            <div className="version-info-row">
              <span className="version-info-label">Desarrollo</span>
              <span className="version-info-val"><strong>{vm.developer}</strong> · {vm.rol}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Última consulta</span>
              <span className="version-info-val">{new Date(vm.generatedAt).toLocaleString('es-MX')}</span>
            </div>
            <div className="version-info-row">
              <span className="version-info-label">Dirección local</span>
              <span className="version-info-val"><IconoLucide icon={Database} size={15} /> 127.0.0.1</span>
            </div>
          </div>
        </article>
      </section>

      <section className="version-card version-card-wide" id="version-technologies" aria-labelledby="version-technologies-title">
        <div className="version-section-heading version-section-heading--compact">
          <div>
            <p className="version-section-kicker"><IconoLucide icon={Code2} size={15} /> COMPONENTES</p>
            <h2 id="version-technologies-title">Tecnologías utilizadas</h2>
          </div>
          <span className="version-tech-count">{vm.technologies.length} componentes</span>
        </div>
        <div className="version-tech-grid">
          <VersionTechList technologies={vm.technologies} />
        </div>
      </section>

      <section className="version-card version-card-wide version-licenses" id="version-licenses" aria-labelledby="version-licenses-title">
        <div className="version-section-heading version-section-heading--compact">
          <div>
            <p className="version-section-kicker"><IconoLucide icon={FileText} size={15} /> AVISOS DE DISTRIBUCIÓN</p>
            <h2 id="version-licenses-title">Licencias</h2>
          </div>
        </div>
        <p><strong>EvaluaPro:</strong> núcleo abierto bajo <a href="https://www.gnu.org/licenses/agpl.html" target="_blank" rel="noreferrer noopener">AGPL-3.0-or-later</a>.</p>
        <p><strong>Lucide React {versionDeclarada(FRONTEND_PACKAGE, 'lucide-react')}:</strong> licencia ISC. Los iconos derivados de Feather incluyen aviso MIT.</p>
        <VersionLicenseInventory />
        <details className="version-license-details">
          <summary>Consultar el aviso completo de Lucide</summary>
          <pre>{lucideLicenseText}</pre>
        </details>
      </section>
    </div>
  );
}
